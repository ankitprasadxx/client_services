require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const express = require('express');
const cors    = require('cors');
const path    = require('path');
const axios   = require('axios');

const app  = express();
const PORT = process.env.PORT || 3000;
const PYTHON_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:5000';

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ── Routes ──────────────────────────────────────────────────────────────────
app.use('/api/upload',    require('./routes/upload'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/ai',        require('./routes/ai'));

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/health', async (req, res) => {
  let pythonOk = false;
  try {
    const r = await axios.get(`${PYTHON_URL}/health`, { timeout: 3000 });
    pythonOk = r.data.status === 'ok';
  } catch (_) {}
  res.json({
    node:   'ok',
    python: pythonOk ? 'ok' : 'unavailable',
    db:     pythonOk
  });
});

// ── Catch-all → serve index.html ────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Wait for Python to be ready, then start ─────────────────────────────────
async function waitForPython(retries = 10, delay = 2000) {
  for (let i = 0; i < retries; i++) {
    try {
      await axios.get(`${PYTHON_URL}/health`, { timeout: 2000 });
      console.log('[server] Python service is ready.');
      return true;
    } catch (_) {
      console.log(`[server] Waiting for Python... (${i + 1}/${retries})`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  console.warn('[server] Python service not available — continuing anyway.');
  return false;
}

app.listen(PORT, async () => {
  console.log(`[server] Node.js running on http://localhost:${PORT}`);
  await waitForPython();
});