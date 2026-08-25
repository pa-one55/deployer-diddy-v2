const express = require('express');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const simpleGit = require('simple-git');
const { getDeploymentById, updateDeployment, getEnvVars } = require('../db/deployments');
const { ensureDockerfile } = require('../services/dockerfile');
const { buildImage, stopAndRemoveContainer, runContainer } = require('../services/docker');

const router = express.Router();

const DEPLOY_BASE = process.env.DEPLOY_BASE_PATH || '/home/ubuntu/deployer-diddy-repos';

function verifyWebhookSignature(req, res, next) {
  const signature = req.headers['x-hub-signature-256'];
  if (!signature) {
    return res.status(401).json({ error: 'Missing signature' });
  }

  const hmac = crypto.createHmac('sha256', process.env.WEBHOOK_SECRET);
  hmac.update(req.body);
  const digest = `sha256=${hmac.digest('hex')}`;

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest))) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  next();
}

router.post('/:deploymentId', express.raw({ type: 'application/json' }), verifyWebhookSignature, async (req, res) => {
  const { deploymentId } = req.params;

  let payload;
  try {
    payload = JSON.parse(req.body.toString());
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  const branch = payload.ref?.replace('refs/heads/', '');
  if (!branch) {
    return res.status(400).json({ error: 'No branch in payload' });
  }

  res.json({ message: `Webhook received for deployment ${deploymentId}, redeploying from ${branch}` });

  redeployFromWebhook(parseInt(deploymentId, 10)).catch((err) => {
    console.error(`[Webhook] Redeployment failed for ${deploymentId}:`, err.message);
  });
});

async function redeployFromWebhook(deploymentId) {
  const deployment = await getDeploymentById(deploymentId);
  if (!deployment) {
    console.error(`[Webhook] Deployment ${deploymentId} not found`);
    return;
  }

  const deployDir = path.join(DEPLOY_BASE, String(deploymentId));
  const repoDir = path.join(deployDir, 'repo');
  const logsDir = path.join(deployDir, 'logs');
  const logFile = path.join(logsDir, 'deploy.log');

  const log = (msg) => {
    const line = `[${new Date().toISOString()}] ${msg}\n`;
    console.log(line.trim());
    fs.appendFileSync(logFile, line, 'utf8');
  };

  try {
    await updateDeployment(deploymentId, { status: 'building' });

    log('Webhook triggered redeployment');

    log('Pulling latest changes');
    const git = simpleGit(repoDir);
    await git.pull();

    log('Checking for Dockerfile');
    ensureDockerfile(repoDir);

    const imageName = `${deployment.github_id}-${deployment.repo_name}-${deploymentId}`.toLowerCase();
    const containerName = `deployer-diddy-${deploymentId}`;

    log('Building Docker image');
    await buildImage(repoDir, imageName);

    log('Stopping old container');
    await stopAndRemoveContainer(containerName);

    const envVars = await getEnvVars(deploymentId);
    envVars.push({ key: 'PORT', value: String(deployment.port) });

    log('Starting new container');
    const containerId = await runContainer(imageName, containerName, deployment.port, envVars);

    await updateDeployment(deploymentId, { container_id: containerId, status: 'running' });

    log('Redeployment completed successfully');
  } catch (err) {
    log(`Redeployment failed: ${err.message}`);
    await updateDeployment(deploymentId, { status: 'failed' });
  }
}

module.exports = router;
