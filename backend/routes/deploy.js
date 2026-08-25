const express = require('express');
const path = require('path');
const fs = require('fs');
const simpleGit = require('simple-git');
const { verifyToken } = require('../middleware/auth');
const { getUserByGithubId } = require('../db/users');
const { getUserRepositories, registerWebhook } = require('../services/github');
const {
  createDeployment,
  updateDeployment,
  getDeploymentsByUser,
  getDeploymentById,
  addEnvVars,
  getEnvVars,
} = require('../db/deployments');
const { ensureDockerfile } = require('../services/dockerfile');
const { buildImage, stopAndRemoveContainer, runContainer } = require('../services/docker');

const router = express.Router();

const BASE_PORT = 3000;
const DEPLOY_BASE = process.env.DEPLOY_BASE_PATH || '/home/ubuntu/deployer-diddy-repos';

router.get('/repos', verifyToken, async (req, res) => {
  try {
    const user = await getUserByGithubId(req.user.githubId);
    const repos = await getUserRepositories(user.access_token);
    res.json({ repos: repos.map((r) => ({ name: r.name, url: r.clone_url, fullName: r.full_name })) });
  } catch (err) {
    console.error('[Deploy] Error fetching repos:', err.message);
    res.status(500).json({ error: 'Failed to fetch repositories' });
  }
});

router.post('/', verifyToken, async (req, res) => {
  const { repoName, repoUrl, envVars } = req.body;

  if (!repoName || !repoUrl) {
    return res.status(400).json({ error: 'Missing repoName or repoUrl' });
  }

  try {
    const user = await getUserByGithubId(req.user.githubId);
    const deployment = await createDeployment(req.user.githubId, repoName, repoUrl, BASE_PORT + 0);

    const port = BASE_PORT + deployment.id;
    await updateDeployment(deployment.id, { port });

    if (envVars && envVars.length > 0) {
      await addEnvVars(deployment.id, envVars);
    }

    res.json({ message: 'Deployment started', deploymentId: deployment.id, port });

    runDeploymentPipeline(deployment.id, user.access_token).catch((err) => {
      console.error(`[Deploy] Pipeline failed for deployment ${deployment.id}:`, err.message);
    });
  } catch (err) {
    console.error('[Deploy] Error:', err.message);
    res.status(500).json({ error: 'Deployment failed' });
  }
});

router.get('/status/:id', verifyToken, async (req, res) => {
  try {
    const deployment = await getDeploymentById(req.params.id);

    if (!deployment || deployment.github_id !== req.user.githubId) {
      return res.status(404).json({ error: 'Deployment not found' });
    }

    const liveUrl = deployment.status === 'running' ? `http://${process.env.EC2_IP}:${deployment.port}` : null;

    res.json({
      id: deployment.id,
      repoName: deployment.repo_name,
      status: deployment.status,
      port: deployment.port,
      liveUrl,
    });
  } catch (err) {
    console.error('[Deploy] Error fetching status:', err.message);
    res.status(500).json({ error: 'Failed to fetch deployment status' });
  }
});

router.get('/list', verifyToken, async (req, res) => {
  try {
    const deployments = await getDeploymentsByUser(req.user.githubId);
    res.json({
      deployments: deployments.map((d) => ({
        id: d.id,
        repoName: d.repo_name,
        status: d.status,
        port: d.port,
        liveUrl: d.status === 'running' ? `http://${process.env.EC2_IP}:${d.port}` : null,
        createdAt: d.created_at,
      })),
    });
  } catch (err) {
    console.error('[Deploy] Error fetching deployments:', err.message);
    res.status(500).json({ error: 'Failed to fetch deployments' });
  }
});

router.get('/logs/:id', verifyToken, async (req, res) => {
  try {
    const deployment = await getDeploymentById(req.params.id);

    if (!deployment || deployment.github_id !== req.user.githubId) {
      return res.status(404).json({ error: 'Deployment not found' });
    }

    const logPath = path.join(DEPLOY_BASE, String(deployment.id), 'logs', 'deploy.log');

    if (!fs.existsSync(logPath)) {
      return res.status(404).json({ error: 'Logs not found' });
    }

    const logs = fs.readFileSync(logPath, 'utf8');
    res.type('text/plain').send(logs);
  } catch (err) {
    console.error('[Deploy] Error fetching logs:', err.message);
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

async function runDeploymentPipeline(deploymentId, accessToken) {
  const deployment = await getDeploymentById(deploymentId);
  const deployDir = path.join(DEPLOY_BASE, String(deploymentId));
  const repoDir = path.join(deployDir, 'repo');
  const logsDir = path.join(deployDir, 'logs');
  const logFile = path.join(logsDir, 'deploy.log');

  fs.mkdirSync(logsDir, { recursive: true });

  const log = (msg) => {
    const line = `[${new Date().toISOString()}] ${msg}\n`;
    console.log(line.trim());
    fs.appendFileSync(logFile, line, 'utf8');
  };

  try {
    log('Deployment started');

    if (fs.existsSync(repoDir)) {
      log('Removing old repo directory');
      fs.rmSync(repoDir, { recursive: true, force: true });
    }

    fs.mkdirSync(repoDir, { recursive: true });

    log(`Cloning repo: ${deployment.repo_url}`);
    await simpleGit().clone(deployment.repo_url, repoDir);

    log('Checking for Dockerfile');
    ensureDockerfile(repoDir);

    const imageName = `${deployment.github_id}-${deployment.repo_name}-${deploymentId}`.toLowerCase();
    const containerName = `deployer-diddy-${deploymentId}`;

    log('Building Docker image');
    await buildImage(repoDir, imageName);

    log('Stopping old container if exists');
    await stopAndRemoveContainer(containerName);

    const envVars = await getEnvVars(deploymentId);
    envVars.push({ key: 'PORT', value: String(deployment.port) });

    log('Starting new container');
    const containerId = await runContainer(imageName, containerName, deployment.port, envVars);

    await updateDeployment(deploymentId, { container_id: containerId, status: 'running' });

    const [owner, repo] = deployment.repo_url.replace('https://github.com/', '').replace('.git', '').split('/');
    const webhookUrl = `http://${process.env.EC2_IP}:${process.env.PORT}/api/webhook/${deploymentId}`;

    log('Registering GitHub webhook');
    await registerWebhook(accessToken, owner, repo, webhookUrl);

    log('Deployment completed successfully');
  } catch (err) {
    log(`Deployment failed: ${err.message}`);
    await updateDeployment(deploymentId, { status: 'failed' });
    throw err;
  }
}

module.exports = router;
