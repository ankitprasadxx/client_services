const express = require('express');
const router  = express.Router();
const { chat, generateInsights } = require('../services/aiService');
const { getAiSnapshot } = require('../services/dataService');

// POST /api/ai/chat  { question: "..." }
router.post('/chat', async (req, res) => {
  const { question } = req.body;
  if (!question || !question.trim()) {
    return res.status(400).json({ error: 'question is required' });
  }
  try {
    const snapshot = getAiSnapshot();
    const answer   = await chat(question.trim(), snapshot);
    res.json({ answer });
  } catch (e) {
    console.error('[ai/chat]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/ai/insights
router.post('/insights', async (req, res) => {
  try {
    const snapshot  = getAiSnapshot();
    const insights  = await generateInsights(snapshot);
    res.json({ insights });
  } catch (e) {
    console.error('[ai/insights]', e.message);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;