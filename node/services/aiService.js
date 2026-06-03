const fetch = require('node-fetch');

const GROK_API_URL = 'https://api.x.ai/v1/chat/completions';
const GROK_KEY     = process.env.GROK_API_KEY;

function buildContext(snapshot) {
  if (!snapshot || !snapshot.team) return 'No team data available yet.';

  const clientList = (snapshot.clients || [])
    .map(c => `  - ${c.client}: ${c.count} analyst${c.count > 1 ? 's' : ''}`)
    .join('\n');

  const roleList = (snapshot.roles || [])
    .map(r => `  - ${r.category}: ${r.count} people`)
    .join('\n');

  const usShift = (snapshot.shifts || [])
    .filter(s => s.us_shift).map(s => s.name).join(', ') || 'None';
  const weekend = (snapshot.shifts || [])
    .filter(s => s.weekend_shift).map(s => s.name).join(', ') || 'None';

  const teamList = (snapshot.team || []).map(e =>
    `  ${e.name} | ${e.title} | ${e.clients || 'Unassigned'} | ` +
    `${e.tenure_months_clean}mo | ${e.location} | ` +
    `${e.german_knowledge === 'Yes' ? 'German:Yes | ' : ''}` +
    `Skills: ${e.skills || 'N/A'}`
  ).join('\n');

  const leadList = (snapshot.leads || [])
    .map(l => `  ${l.project}: Primary=${l.primary_lead}, Secondary=${l.secondary_lead || 'None'}`)
    .join('\n');

  return `
You are an AI assistant for a COO managing a client services team.
Answer ONLY based on the live team data below.
Be concise, direct and specific — always mention names when relevant.
If data is insufficient to answer, say so clearly.

TEAM OVERVIEW:
- Total headcount: ${snapshot.headcount}
- Active clients: ${(snapshot.clients || []).length}
- Unassigned analysts: ${(snapshot.unassigned || []).join(', ') || 'None'}

CLIENTS (analyst count):
${clientList}

ROLE CATEGORIES:
${roleList}

SHIFT AVAILABILITY:
- US Shift available: ${usShift}
- Weekend available: ${weekend}

PROJECT LEADS:
${leadList}

FULL TEAM ROSTER:
${teamList}
`.trim();
}

async function chat(question, snapshot) {
  if (!GROK_KEY) {
    return 'Grok API key not configured. Add GROK_API_KEY to your .env file.';
  }

  const context = buildContext(snapshot);

  const response = await fetch(GROK_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${GROK_KEY}`
    },
    body: JSON.stringify({
      model:      'grok-3-mini',
      max_tokens: 800,
      messages: [
        { role: 'system', content: context },
        { role: 'user',   content: question }
      ]
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Grok API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || 'No response from AI.';
}

async function generateInsights(snapshot) {
  if (!GROK_KEY) {
    return buildFallbackInsights(snapshot);
  }

  const context = buildContext(snapshot);
  const prompt = `Based on the team data, generate exactly 5 bullet-point insights for the COO.
Focus on: coverage risks, capacity, key people, shift gaps, and one opportunity.
Format each as: • [insight]
Be specific — use names and numbers.`;

  try {
    const response = await fetch(GROK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${GROK_KEY}`
      },
      body: JSON.stringify({
        model:      'grok-3',
        max_tokens: 600,
        messages: [
          { role: 'system', content: context },
          { role: 'user',   content: prompt }
        ]
      })
    });

    if (!response.ok) throw new Error(`Grok error: ${response.status}`);
    const data = await response.json();
    return data.choices?.[0]?.message?.content || buildFallbackInsights(snapshot);
  } catch (e) {
    console.error('[aiService] Insights error:', e.message);
    return buildFallbackInsights(snapshot);
  }
}

function buildFallbackInsights(snapshot) {
  if (!snapshot || !snapshot.clients) return '• No data available yet. Upload your Excel file to begin.';

  const lines = [];
  const clients = snapshot.clients || [];
  const at_risk = clients.filter(c => c.count === 1);
  const thin    = clients.filter(c => c.count === 2);

  if (at_risk.length) {
    lines.push(`• ⚠ CRITICAL: ${at_risk.map(c => c.client).join(', ')} ${at_risk.length > 1 ? 'have' : 'has'} only 1 analyst — zero backup coverage.`);
  }
  if (thin.length) {
    lines.push(`• ⚡ WATCH: ${thin.map(c => c.client).join(', ')} ${thin.length > 1 ? 'have' : 'has'} only 2 analysts — thin coverage.`);
  }

  const unassigned = snapshot.unassigned || [];
  if (unassigned.length) {
    lines.push(`• 📋 ${unassigned.length} analyst${unassigned.length > 1 ? 's' : ''} available for deployment: ${unassigned.join(', ')}.`);
  }

  const german = (snapshot.team || []).filter(e => e.german_knowledge === 'Yes');
  if (german.length === 1) {
    lines.push(`• 🌐 Only ${german[0].name} speaks German — single resource risk for German-language clients.`);
  }

  const usShift = (snapshot.shifts || []).filter(s => s.us_shift);
  if (usShift.length <= 1) {
    lines.push(`• 🕐 US Shift: Only ${usShift.length === 0 ? 'nobody' : usShift[0].name} available — limits ability to onboard US-timezone clients.`);
  }

  return lines.join('\n') || '• Team data loaded. Ask me anything about the team.';
}

module.exports = { chat, generateInsights, buildFallbackInsights };