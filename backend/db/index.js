const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const initDB = async () => {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        github_id VARCHAR(255) PRIMARY KEY,
        username VARCHAR(255) NOT NULL,
        access_token TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS deployments (
        id SERIAL PRIMARY KEY,
        github_id VARCHAR(255) REFERENCES users(github_id) ON DELETE CASCADE,
        repo_name VARCHAR(255) NOT NULL,
        repo_url TEXT NOT NULL,
        port INT NOT NULL,
        container_id VARCHAR(255),
        status VARCHAR(50) NOT NULL DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS env_vars (
        id SERIAL PRIMARY KEY,
        deployment_id INT REFERENCES deployments(id) ON DELETE CASCADE,
        key VARCHAR(255) NOT NULL,
        value TEXT NOT NULL
      );
    `);

    console.log('[DB] Tables initialized');
  } finally {
    client.release();
  }
};

module.exports = { pool, initDB };
