const { pool } = require('./index');

async function upsertUser(githubId, username, accessToken) {
  const result = await pool.query(
    `INSERT INTO users (github_id, username, access_token)
     VALUES ($1, $2, $3)
     ON CONFLICT (github_id) DO UPDATE SET username = $2, access_token = $3
     RETURNING *`,
    [githubId, username, accessToken]
  );
  return result.rows[0];
}

async function getUserByGithubId(githubId) {
  const result = await pool.query('SELECT * FROM users WHERE github_id = $1', [githubId]);
  return result.rows[0];
}

module.exports = { upsertUser, getUserByGithubId };
