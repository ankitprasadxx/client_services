// ── AI PAGE ───────────────────────────────────────────────────────────────
async function loadAiPage() {
  const loading = document.getElementById('insights-loading');
  const body    = document.getElementById('ai-insights-body');

  loading.textContent = 'Generating...';
  loading.style.display = 'inline';

  try {
    const r    = await fetch('/api/ai/insights', { method: 'POST' });
    const data = await r.json();
    body.textContent = data.insights || 'No insights available.';
  } catch (e) {
    body.textContent = '• Unable to generate insights. Check that data is loaded and your Grok API key is configured.';
  } finally {
    loading.style.display = 'none';
  }
}

async function refreshInsights() {
  await loadAiPage();
  showToast('Insights refreshed', 'success');
}

async function sendAiMessage() {
  const input    = document.getElementById('ai-input');
  const messages = document.getElementById('ai-chat-messages');
  const question = input.value.trim();
  if (!question) return;

  // Add user message
  messages.innerHTML += `
    <div class="ai-msg user">
      <div class="ai-msg-avatar">You</div>
      <div class="ai-msg-text">${escapeHtml(question)}</div>
    </div>`;

  input.value = '';
  messages.scrollTop = messages.scrollHeight;

  // Add thinking indicator
  const thinkId = 'thinking-' + Date.now();
  messages.innerHTML += `
    <div class="ai-msg ai" id="${thinkId}">
      <div class="ai-msg-avatar">AI</div>
      <div class="ai-msg-text ai-thinking">Thinking...</div>
    </div>`;
  messages.scrollTop = messages.scrollHeight;

  try {
    const r    = await fetch('/api/ai/chat', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ question })
    });
    const data = await r.json();

    // Replace thinking with answer
    const thinkEl = document.getElementById(thinkId);
    if (thinkEl) {
      thinkEl.querySelector('.ai-msg-text').textContent = data.answer || data.error || 'No response.';
      thinkEl.querySelector('.ai-msg-text').classList.remove('ai-thinking');
    }
  } catch (e) {
    const thinkEl = document.getElementById(thinkId);
    if (thinkEl) {
      thinkEl.querySelector('.ai-msg-text').textContent = `Error: ${e.message}`;
      thinkEl.querySelector('.ai-msg-text').classList.remove('ai-thinking');
    }
  }

  messages.scrollTop = messages.scrollHeight;
}

function askSuggestion(btn) {
  document.getElementById('ai-input').value = btn.textContent;
  sendAiMessage();
}

function escapeHtml(text) {
  return text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}