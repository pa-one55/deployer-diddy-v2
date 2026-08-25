const fs = require('fs');
const path = require('path');

function detectLanguage(repoPath) {
  if (fs.existsSync(path.join(repoPath, 'package.json'))) return 'node';
  if (fs.existsSync(path.join(repoPath, 'requirements.txt'))) return 'python';
  return null;
}

function generateDockerfile(language) {
  if (language === 'node') {
    return `FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
`;
  }

  if (language === 'python') {
    return `FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["python", "app.py"]
`;
  }

  return null;
}

function ensureDockerfile(repoPath) {
  const dockerfilePath = path.join(repoPath, 'Dockerfile');

  if (fs.existsSync(dockerfilePath)) {
    console.log('[Dockerfile] Found existing Dockerfile');
    return;
  }

  const language = detectLanguage(repoPath);
  if (!language) {
    throw new Error('Could not detect language (no package.json or requirements.txt) and no Dockerfile found');
  }

  const dockerfile = generateDockerfile(language);
  fs.writeFileSync(dockerfilePath, dockerfile, 'utf8');
  console.log(`[Dockerfile] Generated Dockerfile for ${language}`);
}

module.exports = { ensureDockerfile };
