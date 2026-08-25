const axios = require('axios');

async function exchangeCodeForToken(code) {
  const response = await axios.post(
    'https://github.com/login/oauth/access_token',
    {
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code,
    },
    { headers: { Accept: 'application/json' } }
  );

  return response.data.access_token;
}

async function getGitHubUser(accessToken) {
  const response = await axios.get('https://api.github.com/user', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return response.data;
}

async function getUserRepositories(accessToken) {
  const response = await axios.get('https://api.github.com/user/repos', {
    headers: { Authorization: `Bearer ${accessToken}` },
    params: { per_page: 100, sort: 'updated' },
  });
  return response.data;
}

async function registerWebhook(accessToken, owner, repo, webhookUrl) {
  try {
    await axios.post(
      `https://api.github.com/repos/${owner}/${repo}/hooks`,
      {
        name: 'web',
        active: true,
        events: ['push'],
        config: {
          url: webhookUrl,
          content_type: 'json',
          secret: process.env.WEBHOOK_SECRET,
        },
      },
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
  } catch (err) {
    if (err.response?.status === 422) {
      console.log(`[GitHub] Webhook already exists for ${owner}/${repo}`);
    } else {
      throw err;
    }
  }
}

module.exports = { exchangeCodeForToken, getGitHubUser, getUserRepositories, registerWebhook };
