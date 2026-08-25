const express = require('express');
const jwt = require('jsonwebtoken');
const { exchangeCodeForToken, getGitHubUser } = require('../services/github');
const { upsertUser } = require('../db/users');

const router = express.Router();

router.get('/callback', async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res.status(400).json({ error: 'Missing code parameter' });
  }

  try {
    const accessToken = await exchangeCodeForToken(code);
    const githubUser = await getGitHubUser(accessToken);

    await upsertUser(String(githubUser.id), githubUser.login, accessToken);

    const token = jwt.sign(
      { githubId: String(githubUser.id), username: githubUser.login },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.redirect(`/dashboard.html?token=${token}`);
  } catch (err) {
    console.error('[Auth] Error:', err.message);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

module.exports = router;
