require('dotenv').config();
const express = require('express');
const path = require('path');
const { initDB } = require('./db');

const authRoutes = require('./routes/auth');
const deployRoutes = require('./routes/deploy');
const webhookRoutes = require('./routes/webhook');

const app = express();
const PORT = process.env.PORT || 3000;

app.use('/api/webhook', webhookRoutes);

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'frontend')));

app.use('/api/auth', authRoutes);
app.use('/api/deploy', deployRoutes);

app.listen(PORT, async () => {
  console.log(`[Server] Running on port ${PORT}`);
  await initDB();
});
