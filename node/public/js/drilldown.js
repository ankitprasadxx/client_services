// ── DRILLDOWN ─────────────────────────────────────────────────────────────
async function loadDrilldown(category, client, customLabel) {
  const panel = document.getElementById('drilldown-panel');
  const title = document.getElementById('drilldown-title');
  const list  = document.getElementById('drilldown-list');

  // Highlight active bucket
  document.querySelectorAll('.role-bucket').forEach(b => {
    b.classList.toggle('active', b.dataset.category === category);
  });

  const params = {};
  if (category) params.category = category;
  if (client)   params.client   = client;

  // Also apply active filters
  if (APP.activeFilters.client   && !client)   params.client   = APP.activeFilters.client;
  if (APP.activeFilters.location)               params.location = APP.activeFilters.location;

  const qs = new URLSearchParams(params).toString();

  // Label
  let label = customLabel;
  if (!label) {
    if (category && client) label = `${category} · ${client}`;
    else if (category)      label = category;
    else if (client)        label = client;
    else                    label = 'All Members';
  }

  title.textContent = `${label} — Team Members`;
  list.innerHTML = '<div style="padding:20px;text-align:center;color:var(--t3)">Loading...</div>';
  panel.style.display = 'block';
  panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  try {
    const r    = await fetch(`/api/dashboard/employees${qs ? '?' + qs : ''}`);
    const data = await r.json();

    title.textContent = `${label} — ${data.length} member${data.length !== 1 ? 's' : ''}`;

    if (!data.length) {
      list.innerHTML = '<div class="empty-state" style="padding:24px"><div class="empty-state-sub">No team members match this filter</div></div>';
      return;
    }

    list.innerHTML = data.map(e => {
      const av     = avatarColor(e.name);
      const tClass = tenureClass(e.tenure_months_clean);
      const clients = (e.clients || '').split(',').filter(Boolean).map(c =>
        `<span class="tag tag-blue">${c.trim()}</span>`).join(' ');
      const skills = (e.skills || '').split(',').filter(Boolean).slice(0,4).map(s =>
        `<span class="tag tag-gray">${s.trim()}</span>`).join(' ');
      const categories = [...new Set((e.categories || '').split(',').filter(Boolean))].map(c =>
        `<span class="tag tag-gray">${c.trim()}</span>`).join(' ');

      return `
        <div class="emp-card" onclick="openEmpModal(${e.id})">
          <div class="emp-avatar" style="background:${av.bg};color:${av.c}">${initials(e.name)}</div>
          <div style="flex:1;min-width:0">
            <div style="display:flex;align-items:center;gap:6px">
              <div class="emp-name">${e.name}</div>
              <span class="tag ${levelTag(e.level)}" style="font-size:9px">${e.level}</span>
              ${e.german_knowledge === 'Yes' ? '<span class="tag tag-teal" style="font-size:9px">🌐</span>' : ''}
            </div>
            <div class="emp-meta">${e.title} · ${e.location} · <span class="${tClass}">${e.tenure_months_clean}mo</span></div>
            <div style="margin-top:4px;display:flex;flex-wrap:wrap;gap:2px">
              ${clients}
              ${categories}
            </div>
          </div>
          <div class="emp-tags" style="max-width:180px">
            ${skills}
            <div style="margin-top:4px;width:100%;text-align:right">
              ${e.us_shift      ? '<span class="tag tag-blue" style="font-size:9px">US</span> ' : ''}
              ${e.weekend_shift ? '<span class="tag tag-purple" style="font-size:9px">WE</span>' : ''}
            </div>
          </div>
        </div>`;
    }).join('');

  } catch (err) {
    list.innerHTML = `<div class="empty-state" style="padding:24px"><div class="empty-state-sub">Error: ${err.message}</div></div>`;
  }
}

function closeDrilldown() {
  document.getElementById('drilldown-panel').style.display = 'none';
  document.querySelectorAll('.role-bucket').forEach(b => b.classList.remove('active'));
}