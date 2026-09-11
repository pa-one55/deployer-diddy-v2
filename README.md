# deployer-diddy

Deploy GitHub repos to EC2 with Docker. GitHub OAuth, webhooks, auto-redeploy on push.

---

## Requirements

- Node.js 18+
- PostgreSQL
- Docker
- Git
- GitHub OAuth App

---

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Set up PostgreSQL
```bash
# Create database
createdb deployer_diddy

# Or via psql
psql -U postgres
CREATE DATABASE deployer_diddy;
\q
```

### 3. Create GitHub OAuth App
- Go to [GitHub Developer Settings](https://github.com/settings/developers)
- New OAuth App
- **Homepage URL:** `http://localhost:3000` (or your EC2 IP)
- **Callback URL:** `http://localhost:3000/api/auth/callback`
- Copy **Client ID** and **Client Secret**

### 4. Configure environment
```bash
cp .env.example .env
# Fill in all values in .env
```

Update `frontend/index.html` line 28 with your `GITHUB_CLIENT_ID`.

### 5. Run
```bash
npm start
```

Open `http://localhost:3000`

---

## How it works

1. **Login with GitHub** → OAuth flow → JWT stored in browser
2. **Dashboard** → shows all your deployments + live URLs
3. **Deploy New** → select repo, add env vars → triggers deployment:
   - Clones repo to `workspace/<id>/repo/`
   - Auto-generates Dockerfile if missing (Node/Python detected)
   - Builds Docker image
   - Stops old container, starts new one
   - Registers GitHub webhook
   - Returns live URL: `http://<EC2_IP>:<port>`
4. **Push to GitHub** → webhook triggers redeploy automatically

---

## API Routes

| Route | Method | Auth | Description |
|-------|--------|------|-------------|
| `/api/auth/callback` | GET | - | GitHub OAuth callback |
| `/api/deploy/repos` | GET | JWT | List user's repos |
| `/api/deploy` | POST | JWT | Trigger deployment |
| `/api/deploy/list` | GET | JWT | List all deployments |
| `/api/deploy/status/:id` | GET | JWT | Get deployment status |
| `/api/deploy/logs/:id` | GET | JWT | Get deployment logs |
| `/api/webhook/:deploymentId` | POST | GitHub sig | Redeploy on push |

---

## Database Schema

**users:**
- `github_id` (PK)
- `username`
- `access_token`

**deployments:**
- `id` (SERIAL PK)
- `github_id` (FK)
- `repo_name`
- `repo_url`
- `port`
- `container_id`
- `status` (building/running/failed)

**env_vars:**
- `id` (SERIAL PK)
- `deployment_id` (FK)
- `key`
- `value`

---

## Folder Structure

```
deployer-diddy/
├── backend/
│   ├── index.js              # Express server
│   ├── routes/               # auth, deploy, webhook
│   ├── services/             # github, docker, dockerfile
│   ├── db/                   # PostgreSQL queries
│   └── middleware/           # JWT auth
├── frontend/                 # Plain HTML/CSS/JS
│   ├── index.html            # Login page
│   ├── dashboard.html        # Deployments list
│   ├── deploy.html           # Deploy form
│   └── logs.html             # Log viewer
└── workspace/                # Cloned repos + logs
```

---

## Tech Stack

- **Backend:** Node.js, Express, PostgreSQL
- **Auth:** GitHub OAuth, JWT
- **Deployment:** Docker, simple-git
- **Frontend:** Vanilla JS (no frameworks)

---

## Notes

- Port assignment: `3000 + deployment_id`
- Logs: `workspace/<id>/logs/deploy.log`
- Dockerfile auto-generated for Node (package.json) and Python (requirements.txt)
- Webhooks verified via HMAC signature
