const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

async function buildImage(repoPath, imageName) {
  console.log(`[Docker] Building image: ${imageName}`);
  await execAsync(`docker build -t ${imageName} "${repoPath}"`);
  console.log(`[Docker] Image built: ${imageName}`);
}

async function stopAndRemoveContainer(containerName) {
  try {
    const { stdout } = await execAsync(`docker ps -a --filter name=^${containerName}$ --format "{{.Names}}"`);
    if (stdout.trim()) {
      console.log(`[Docker] Stopping and removing old container: ${containerName}`);
      await execAsync(`docker stop ${containerName}`).catch(() => {});
      await execAsync(`docker rm ${containerName}`);
    }
  } catch {
    // container doesn't exist, no action needed
  }
}

async function runContainer(imageName, containerName, port, envVars) {
  const envFlags = envVars.map(({ key, value }) => `-e ${key}="${value}"`).join(' ');
  const command = `docker run -d --name ${containerName} -p ${port}:${port} ${envFlags} ${imageName}`;

  console.log(`[Docker] Running container: ${containerName} on port ${port}`);
  const { stdout } = await execAsync(command);
  const containerId = stdout.trim();
  console.log(`[Docker] Container started: ${containerId}`);
  return containerId;
}

module.exports = { buildImage, stopAndRemoveContainer, runContainer };
