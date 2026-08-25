# deployer-diddy

Clone a repo, build the image, kill the old container, spin up the new one. That's it.

---

## Requirements

- Node.js 18+
- Git
- Docker (running)

---

## Setup

```bash
git clone <this-repo>
cd deployer-diddy
npm i
npm run deploy
```

---

## What it does

1. Asks how you want to provide config — CLI prompts or a JSON file
2. Clones your repo into `workspace/<app-name>/repo/`
3. Builds a Docker image from the repo's Dockerfile
4. Stops and removes the old container (if one exists)
5. Spins up the new container
6. Asks if you want to deploy again or exit

---

## Config (JSON option)

```json
{
  "appName": "my-app",
  "repoUrl": "https://github.com/user/repo",
  "branch": "main",
  "hostPort": "8080",
  "containerPort": "3000",
  "envVars": {
    "NODE_ENV": "production"
  }
}
```

`envVars` is optional.

---

## Logs

Every deploy writes logs to:

```
workspace/<app-name>/logs/deploy.log
```

---

## Note

Your app's repo needs a `Dockerfile` at the root. deployer-diddy doesn't run build commands — that's the Dockerfile's job.
