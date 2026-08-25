const { pool } = require('./index');

async function createDeployment(githubId, repoName, repoUrl, port) {
  const result = await pool.query(
    `INSERT INTO deployments (github_id, repo_name, repo_url, port, status)
     VALUES ($1, $2, $3, $4, 'building')
     RETURNING *`,
    [githubId, repoName, repoUrl, port]
  );
  return result.rows[0];
}

async function updateDeployment(id, updates) {
  const fields = [];
  const values = [];
  let idx = 1;

  for (const [key, value] of Object.entries(updates)) {
    fields.push(`${key} = $${idx}`);
    values.push(value);
    idx++;
  }

  values.push(id);
  const query = `UPDATE deployments SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${idx} RETURNING *`;
  const result = await pool.query(query, values);
  return result.rows[0];
}

async function getDeploymentsByUser(githubId) {
  const result = await pool.query('SELECT * FROM deployments WHERE github_id = $1 ORDER BY created_at DESC', [githubId]);
  return result.rows;
}

async function getDeploymentById(id) {
  const result = await pool.query('SELECT * FROM deployments WHERE id = $1', [id]);
  return result.rows[0];
}

async function getDeploymentByRepoName(repoName, githubId) {
  const result = await pool.query(
    'SELECT * FROM deployments WHERE repo_name = $1 AND github_id = $2',
    [repoName, githubId]
  );
  return result.rows[0];
}

async function addEnvVars(deploymentId, envVars) {
  const queries = envVars.map(({ key, value }) =>
    pool.query('INSERT INTO env_vars (deployment_id, key, value) VALUES ($1, $2, $3)', [deploymentId, key, value])
  );
  await Promise.all(queries);
}

async function getEnvVars(deploymentId) {
  const result = await pool.query('SELECT key, value FROM env_vars WHERE deployment_id = $1', [deploymentId]);
  return result.rows;
}

module.exports = {
  createDeployment,
  updateDeployment,
  getDeploymentsByUser,
  getDeploymentById,
  getDeploymentByRepoName,
  addEnvVars,
  getEnvVars,
};
