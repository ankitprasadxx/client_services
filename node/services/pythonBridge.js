const axios = require('axios');
const PYTHON_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:5000';

async function ingestFile(filepath) {
  const response = await axios.post(`${PYTHON_URL}/ingest`, { filepath }, {
    timeout: 120000 // 2 min for large files
  });
  return response.data;
}

async function checkHealth() {
  try {
    const r = await axios.get(`${PYTHON_URL}/health`, { timeout: 3000 });
    return r.data.status === 'ok';
  } catch (_) {
    return false;
  }
}

async function getSnapshot() {
  const r = await axios.get(`${PYTHON_URL}/data/snapshot`, { timeout: 10000 });
  return r.data;
}

module.exports = { ingestFile, checkHealth, getSnapshot };