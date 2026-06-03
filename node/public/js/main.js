// ── STATE ────────────────────────────────────────────────────────────────
window.APP = {
  currentPage: 'overview',
  overviewData: null,
  teamData: [],
  clientsData: [],
  activeFilters: { client: '', category: '', location: '' },
  charts: {},
};

// ── INIT ─────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  setTodayDate();
  initNavigation();
  await checkHealth();
  await loadOverview();
  loadUploadHistory();
});

function setTodayDate() {
  const d = new Date();
  const opts = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  document.getElementById('today-date').textContent = d.toLocaleDateString('en-IN', opts);
}

// ── NAVIGATION ───────────────────────────────────────────────────────────
function initNavigation() {
  document.querySelectorAll('.nav-item[data-page]').forEach(el => {
    el.addEventListener('click', e => {
      e.preventDefault();
      navigateTo(el.dataset.page);
    });
  });
}

function navigateTo(page) {
  // Hide all pages
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  // Show target page
  const pageEl = document.getElementById(`page-${page}`);
  const navEl = document.querySelector(`.nav-item[data-page="${page}"]`);
  if (pageEl) pageEl.classList.add('active');
  if (navEl) navEl.classList.add('active');

  APP.currentPage = page;

  // Load page-specific data
  if (page === 'clients') loadClientsPage();
  if (page === 'team') loadTeamPage();
  if (page === 'shifts') loadShiftsPage();
  if (page === 'leads') loadLeadsPage();
  if (page === 'ai') loadAiPage();
  if (page === 'uploads') loadUploadHistory();
}


// ── HEALTH CHECK ─────────────────────────────────────────────────────────
async function checkHealth() {
  try {
    const r = await fetch('/health');
    const data = await r.json();
    const dot = document.querySelector('.status-dot');
    const txt = document.getElementById('db-status-text');
    if (data.python === 'ok') {
      dot.classList.add('ok');
      txt.textContent = 'Connected';
    } else {
      dot.classList.add('error');
      txt.textContent = 'Python offline';
    }
  } catch (_) {
    document.querySelector('.status-dot').classList.add('error');
    document.getElementById('db-status-text').textContent = 'Error';
  }
}

// ── OVERVIEW ─────────────────────────────────────────────────────────────
async function loadOverview(filters = {}) {
  try {
    const params = new URLSearchParams(filters).toString();
    const r = await fetch(`/api/dashboard/overview${params ? '?' + params : ''}`);
    const data = await r.json();
    if (data.error) throw new Error(data.error);

    APP.overviewData = data;
    renderKpis(data);
    renderRoleBuckets(data.roleCategories || []);
    renderCharts(data);
    populateFilterDropdowns(data);
  } catch (e) {
    if (e.message && e.message.includes('no such table')) {
      showEmptyState();
    } else {
      console.error('[overview]', e);
    }
  }
}

function showEmptyState() {
  document.getElementById('kpi-headcount').textContent = '0';
  document.getElementById('kpi-clients').textContent = '0';
  document.getElementById('kpi-available').textContent = '0';
  document.getElementById('kpi-multi').textContent = '0';
  document.getElementById('kpi-headcount-sub').textContent = 'Upload data to begin';
  document.getElementById('role-buckets').innerHTML = `
    <div class="empty-state" style="grid-column:1/-1">
      <div class="empty-state-icon">📂</div>
      <div class="empty-state-title">No data yet</div>
      <div class="empty-state-sub">
        <a href="#" onclick="navigateTo('uploads')" style="color:var(--blue)">Upload your Excel file</a> to get started
      </div>
    </div>`;
}

function renderKpis(data) {
  const k = data.kpis || {};
  document.getElementById('kpi-headcount').textContent = k.headcount ?? '—';
  document.getElementById('kpi-clients').textContent = (data.clients || []).filter(c => c.client && c.client !== 'All').length || '—';
  document.getElementById('kpi-available').textContent = k.unassigned ?? '—';
  document.getElementById('kpi-multi').textContent = k.multiClient ?? '—';
  document.getElementById('kpi-headcount-sub').textContent = `${k.deployed ?? 0} deployed · ${k.unassigned ?? 0} available`;

  // Risk badge on clients nav
  const atRisk = (data.clients || []).filter(c => c.count === 1).length;
  const badge = document.getElementById('nav-risk-badge');
  if (atRisk > 0) badge.classList.add('show');
  else badge.classList.remove('show');
}

function populateFilterDropdowns(data) {
  // Client filter
  const clientSel = document.getElementById('filter-client');
  const current = clientSel.value;
  clientSel.innerHTML = '<option value="">All Clients</option>';
  (data.clients || []).forEach(c => {
    if (c.client && c.client !== 'All') {
      const o = document.createElement('option');
      o.value = c.client;
      o.textContent = `${c.client} (${c.count})`;
      if (c.client === current) o.selected = true;
      clientSel.appendChild(o);
    }
  });

  // Location filter
  const locSel = document.getElementById('filter-location');
  const curLoc = locSel.value;
  locSel.innerHTML = '<option value="">All Locations</option>';
  (data.locations || []).forEach(l => {
    const o = document.createElement('option');
    o.value = l.location;
    o.textContent = `${l.location} (${l.count})`;
    if (l.location === curLoc) o.selected = true;
    locSel.appendChild(o);
  });

  // Also populate team page dropdowns
  populateTeamDropdowns(data);
}

function populateTeamDropdowns(data) {
  const teamClientSel = document.getElementById('team-client');
  if (!teamClientSel) return;
  const cur = teamClientSel.value;
  teamClientSel.innerHTML = '<option value="">All Clients</option>';
  (data.clients || []).forEach(c => {
    if (c.client && c.client !== 'All') {
      const o = document.createElement('option');
      o.value = c.client;
      o.textContent = c.client;
      if (c.client === cur) o.selected = true;
      teamClientSel.appendChild(o);
    }
  });

  const teamLocSel = document.getElementById('team-location');
  if (!teamLocSel) return;
  const curL = teamLocSel.value;
  teamLocSel.innerHTML = '<option value="">All Locations</option>';
  (data.locations || []).forEach(l => {
    const o = document.createElement('option');
    o.value = l.location;
    o.textContent = l.location;
    if (l.location === curL) o.selected = true;
    teamLocSel.appendChild(o);
  });
}

async function refreshOverview() {
  showToast('Refreshing...', '');
  await loadOverview(APP.activeFilters);
  showToast('Data refreshed', 'success');
}

// ── CLIENT LIST POPUP (KPI click) ─────────────────────────────────────────
function showClientList() {
  if (!APP.overviewData) return;
  const clients = (APP.overviewData.clients || []).filter(c => c.client && c.client !== 'All');
  const panel = document.getElementById('drilldown-panel');
  const title = document.getElementById('drilldown-title');
  const list = document.getElementById('drilldown-list');

  title.textContent = `Active Clients (${clients.length})`;
  list.innerHTML = clients.map(c => {
    const health = c.count === 1 ? 'tag-red' : c.count === 2 ? 'tag-amber' : 'tag-green';
    const label = c.count === 1 ? '⚠ Critical' : c.count === 2 ? 'Watch' : 'Healthy';
    return `
      <div class="emp-card" onclick="navigateTo('clients')">
        <div class="emp-avatar" style="background:#EFF6FF;color:#1D4ED8;font-size:13px;font-weight:700">
          ${c.client.substring(0, 2).toUpperCase()}
        </div>
        <div>
          <div class="emp-name">${c.client}</div>
          <div class="emp-meta">${c.count} analyst${c.count !== 1 ? 's' : ''} assigned</div>
        </div>
        <div><span class="tag ${health}">${label}</span></div>
      </div>`;
  }).join('');

  panel.style.display = 'block';
  panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ── ROLE BUCKETS ─────────────────────────────────────────────────────────
function renderRoleBuckets(categories) {
  const container = document.getElementById('role-buckets');

  const RAW_ROLES = {
    'Transcription / Extraction': ['Pre-Processing', 'Processing', 'Validation', 'Admin Validation'],
    'Post Processing': ['Data Points Calculation', 'Merging The Output Files'],
    'Admin': ['PDFs Uploading', 'PDFs Merging'],
    'Ungrouped': ['Report', 'Mail Engagement', 'Service Now'],
    'Management': ['Runs The Client Services Program'],
  };

  const COLORS = {
    'Transcription / Extraction': 'var(--blue)',
    'Post Processing': 'var(--green)',
    'Admin': 'var(--amber)',
    'Ungrouped': 'var(--purple)',
    'Management': 'var(--teal)',
  };

  const catMap = {};
  categories.forEach(c => { catMap[c.category] = c.count; });

  const order = ['Transcription / Extraction', 'Post Processing', 'Admin', 'Ungrouped', 'Management'];
  container.innerHTML = order.map(cat => {
    const count = catMap[cat] || 0;
    const roles = RAW_ROLES[cat] || [];
    const color = COLORS[cat] || 'var(--blue)';
    return `
      <div class="role-bucket" onclick="loadDrilldown('${cat}')" data-category="${cat}">
        <div class="rb-category">${cat}</div>
        <div class="rb-count" style="color:${color}">${count}</div>
        <div class="rb-label">analyst${count !== 1 ? 's' : ''}</div>
        <div class="rb-roles">
          ${roles.map(r => `<span class="rb-role-tag">${r}</span>`).join('')}
        </div>
      </div>`;
  }).join('');
}

// ── TOAST ─────────────────────────────────────────────────────────────────
function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast show ${type}`;
  setTimeout(() => { t.className = 'toast'; }, 3000);
}

// ── CLIENTS PAGE ─────────────────────────────────────────────────────────
async function loadClientsPage() {
  try {
    const r = await fetch('/api/dashboard/overview');
    const data = await r.json();
    const clients = (data.clients || []).filter(c => c.client && c.client !== 'All');

    const COLORS = ['#2563EB', '#16A34A', '#D97706', '#DC2626', '#7C3AED', '#0891B2', '#C026D3', '#EA580C'];
    const grid = document.getElementById('clients-grid');

    grid.innerHTML = clients.map((c, i) => {
      const color = COLORS[i % COLORS.length];
      const health = c.count === 1 ? { cls: 'tag-red', label: '⚠ Critical — 1 analyst' }
        : c.count === 2 ? { cls: 'tag-amber', label: 'Watch — 2 analysts' }
          : { cls: 'tag-green', label: 'Healthy' };
      return `
        <div class="client-card" onclick="loadClientDetail('${c.client}')">
          <div class="client-card-top" style="background:${color}"></div>
          <div class="client-card-body">
            <div class="client-card-name" style="color:${color}">${c.client}</div>
            <div class="client-card-count" style="color:${color}">${c.count}</div>
            <div class="client-card-meta">analyst${c.count !== 1 ? 's' : ''} assigned</div>
            <div><span class="tag ${health.cls}" style="margin-top:8px;display:inline-flex">${health.label}</span></div>
          </div>
        </div>`;
    }).join('');
  } catch (e) { console.error('[clients]', e); }
}

async function loadClientDetail(client) {
  try {
    const r = await fetch(`/api/dashboard/client/${encodeURIComponent(client)}`);
    const data = await r.json();

    const panel = document.getElementById('client-detail-panel');
    const title = document.getElementById('client-detail-title');
    const content = document.getElementById('client-detail-content');

    title.textContent = `${client} — Full Detail`;

    const empList = (data.employees || []).map(e => {
      const av = avatarColor(e.name);
      return `
        <div class="emp-card">
          <div class="emp-avatar" style="background:${av.bg};color:${av.c}">${initials(e.name)}</div>
          <div>
            <div class="emp-name">${e.name}</div>
            <div class="emp-meta">${e.title} · ${e.tenure_months_clean}mo · ${e.location}</div>
            <div style="margin-top:4px">
              ${(e.roles || '').split(',').filter(Boolean).map(r => `<span class="tag tag-blue">${r.trim()}</span> `).join('')}
            </div>
          </div>
          <div class="emp-tags">
            ${(e.skills || '').split(',').filter(Boolean).slice(0, 3).map(s => `<span class="tag tag-gray">${s.trim()}</span>`).join('')}
          </div>
        </div>`;
    }).join('');

    const roleMatrix = (data.roleMatrix || []).map(r =>
      `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);font-size:12px">
        <span style="color:var(--t2)">${r.category}</span>
        <span style="font-weight:600;color:var(--blue)">${r.count}</span>
      </div>`
    ).join('');

    const skillList = (data.skills || []).slice(0, 10).map(s =>
      `<span class="tag tag-gray" style="margin:2px">${s.skill} (${s.count})</span>`
    ).join('');

    content.innerHTML = `
      <div class="client-detail-grid">
        <div>
          <div class="section-title" style="margin-bottom:10px">Team (${data.employees?.length || 0})</div>
          ${empList || '<div class="empty-state-sub">No analysts found</div>'}
        </div>
        <div>
          <div class="section-title" style="margin-bottom:10px">Role Coverage</div>
          ${roleMatrix}
          <div class="section-title" style="margin-top:16px;margin-bottom:10px">Skills Available</div>
          <div style="display:flex;flex-wrap:wrap;gap:4px">${skillList}</div>
          ${data.lead?.primary_lead ? `
            <div class="section-title" style="margin-top:16px;margin-bottom:6px">Project Lead</div>
            <div style="font-size:12px;color:var(--t2)">Primary: <strong>${data.lead.primary_lead}</strong></div>
            ${data.lead.secondary_lead ? `<div style="font-size:12px;color:var(--t2)">Secondary: <strong>${data.lead.secondary_lead}</strong></div>` : ''}
          ` : ''}
        </div>
      </div>`;

    panel.style.display = 'block';
    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (e) { console.error('[clientDetail]', e); showToast('Failed to load client detail', 'error'); }
}

function closeClientDetail() {
  document.getElementById('client-detail-panel').style.display = 'none';
}

// ── TEAM PAGE ─────────────────────────────────────────────────────────────
async function loadTeamPage() {
  try {
    const r = await fetch('/api/dashboard/employees');
    const data = await r.json();
    APP.teamData = data;
    document.getElementById('team-count').textContent = data.length;
    renderTeamTable(data);
  } catch (e) { console.error('[team]', e); }
}

function renderTeamTable(rows) {
  const tbody = document.getElementById('team-tbody');
  tbody.innerHTML = rows.map(e => {
    const av = avatarColor(e.name);
    const tClass = tenureClass(e.tenure_months_clean);
    const clientStr = (e.clients || '').split(',').filter(Boolean).map(c =>
      `<span class="tag tag-blue">${c.trim()}</span>`).join(' ');
    const catStr = [...new Set((e.categories || '').split(',').filter(Boolean))].map(c =>
      `<span class="tag tag-gray">${c.trim()}</span>`).join(' ');
    const skillStr = (e.skills || '').split(',').filter(Boolean).slice(0, 3).map(s =>
      `<span class="tag tag-gray">${s.trim()}</span>`).join(' ');
    const shifts = [
      e.regular_shift ? '<span class="tag tag-green">Regular</span>' : '',
      e.us_shift ? '<span class="tag tag-blue">US</span>' : '',
      e.weekend_shift ? '<span class="tag tag-purple">Weekend</span>' : '',
    ].filter(Boolean).join(' ');

    return `
      <tr onclick="openEmpModal(${e.id})">
        <td>
          <div style="display:flex;align-items:center;gap:8px">
            <div class="emp-avatar" style="width:30px;height:30px;font-size:10px;background:${av.bg};color:${av.c}">${initials(e.name)}</div>
            <div>
              <div style="font-weight:600">${e.name}</div>
              ${e.german_knowledge === 'Yes' ? '<span class="tag tag-teal" style="font-size:9px">🌐 German</span>' : ''}
            </div>
          </div>
        </td>
        <td><span class="tag ${levelTag(e.level)}">${e.level}</span></td>
        <td>${clientStr || '<span style="color:var(--t3)">—</span>'}</td>
        <td><span class="${tClass}">${e.tenure_months_clean}mo</span></td>
        <td style="color:var(--t2)">${e.location}</td>
        <td>${catStr}</td>
        <td>${skillStr}</td>
        <td>${shifts}</td>
      </tr>`;
  }).join('');
}

async function filterTeam() {
  const filters = {
    search: document.getElementById('team-search').value,
    client: document.getElementById('team-client').value,
    category: document.getElementById('team-category').value,
    location: document.getElementById('team-location').value,
    level: document.getElementById('team-level').value,
  };
  const params = new URLSearchParams(
    Object.fromEntries(Object.entries(filters).filter(([, v]) => v))
  ).toString();
  try {
    const r = await fetch(`/api/dashboard/employees${params ? '?' + params : ''}`);
    const data = await r.json();
    document.getElementById('team-count').textContent = data.length;
    renderTeamTable(data);
  } catch (e) { console.error('[filterTeam]', e); }
}

async function openEmpModal(id) {
  const emp = APP.teamData.find(e => e.id === id);
  if (!emp) return;
  const modal = document.getElementById('emp-modal');
  const content = document.getElementById('emp-modal-content');
  const av = avatarColor(emp.name);

  content.innerHTML = `
    <button class="modal-close" onclick="closeEmpModal()">✕</button>
    <div style="display:flex;align-items:center;gap:14px;margin-bottom:20px">
      <div class="emp-avatar" style="width:52px;height:52px;font-size:18px;border-radius:50%;background:${av.bg};color:${av.c}">${initials(emp.name)}</div>
      <div>
        <div style="font-size:18px;font-weight:700">${emp.name}</div>
        <div style="font-size:12px;color:var(--t2)">${emp.title}</div>
        <span class="tag ${levelTag(emp.level)}" style="margin-top:4px">${emp.level}</span>
        ${emp.german_knowledge === 'Yes' ? '<span class="tag tag-teal" style="margin-left:4px">🌐 German</span>' : ''}
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
      <div><div style="font-size:10px;color:var(--t3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">Tenure</div>
        <div class="section-title ${tenureClass(emp.tenure_months_clean)}">${emp.tenure_months_clean} months</div>
        <div style="font-size:11px;color:var(--t3)">${emp.tenure_band}</div></div>
      <div><div style="font-size:10px;color:var(--t3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">Location</div>
        <div class="section-title">${emp.location}</div></div>
      <div><div style="font-size:10px;color:var(--t3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">Status</div>
        <span class="tag ${emp.is_assigned === 'Deployed' ? 'tag-blue' : 'tag-amber'}">${emp.is_assigned}</span></div>
      <div><div style="font-size:10px;color:var(--t3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">Reporting To</div>
        <div style="font-size:12px">${emp.reporting_manager || '—'}</div></div>
    </div>
    <div style="margin-bottom:12px">
      <div style="font-size:10px;color:var(--t3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px">Clients</div>
      <div>${(emp.clients || '').split(',').filter(Boolean).map(c => `<span class="tag tag-blue">${c.trim()}</span> `).join('') || '<span style="color:var(--t3)">Unassigned</span>'}</div>
    </div>
    <div style="margin-bottom:12px">
      <div style="font-size:10px;color:var(--t3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px">Role Categories</div>
      <div>${[...new Set((emp.categories || '').split(',').filter(Boolean))].map(c => `<span class="tag tag-gray">${c.trim()}</span> `).join('')}</div>
    </div>
    <div style="margin-bottom:12px">
      <div style="font-size:10px;color:var(--t3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px">Skills</div>
      <div>${(emp.skills || '').split(',').filter(Boolean).map(s => `<span class="tag tag-gray" style="margin:2px">${s.trim()}</span>`).join('')}</div>
    </div>
    <div>
      <div style="font-size:10px;color:var(--t3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px">Shifts</div>
      <div>
        ${emp.regular_shift ? '<span class="tag tag-green">Regular</span> ' : ''}
        ${emp.us_shift ? '<span class="tag tag-blue">US Shift</span> ' : ''}
        ${emp.weekend_shift ? '<span class="tag tag-purple">Weekend</span>' : ''}
      </div>
    </div>`;

  modal.classList.add('open');
}

function closeEmpModal(e) {
  if (!e || e.target === document.getElementById('emp-modal')) {
    document.getElementById('emp-modal').classList.remove('open');
  }
}

// ── SHIFTS PAGE ───────────────────────────────────────────────────────────
async function loadShiftsPage() {
  try {
    const r = await fetch('/api/dashboard/shifts');
    const data = await r.json();

    const regular = data.filter(e => e.regular_shift);
    const us = data.filter(e => e.us_shift);
    const weekend = data.filter(e => e.weekend_shift);

    document.getElementById('shift-kpis').innerHTML = `
      <div class="shift-kpi-card">
        <div class="shift-kpi-label">Regular Shift</div>
        <div class="shift-kpi-count" style="color:var(--green)">${regular.length}</div>
        <div style="font-size:11px;color:var(--t2)">All members</div>
      </div>
      <div class="shift-kpi-card">
        <div class="shift-kpi-label">US Shift Available</div>
        <div class="shift-kpi-count" style="color:var(--blue)">${us.length}</div>
        <div style="font-size:11px;color:var(--t2)">${us.length <= 1 ? '⚠ Critical — very limited' : 'Available'}</div>
      </div>
      <div class="shift-kpi-card">
        <div class="shift-kpi-label">Weekend Available</div>
        <div class="shift-kpi-count" style="color:var(--purple)">${weekend.length}</div>
        <div style="font-size:11px;color:var(--t2)">${weekend.length <= 1 ? '⚠ Critical — very limited' : 'Available'}</div>
      </div>`;

    function shiftPanel(title, list, color) {
      const rows = list.length ? list.map(e => {
        const av = avatarColor(e.name);
        return `
          <div class="emp-card">
            <div class="emp-avatar" style="background:${av.bg};color:${av.c}">${initials(e.name)}</div>
            <div>
              <div class="emp-name">${e.name}</div>
              <div class="emp-meta">${e.title} · ${e.location}</div>
            </div>
            <div>${(e.clients || '').split(',').filter(Boolean).slice(0, 1).map(c =>
          `<span class="tag tag-blue">${c.trim()}</span>`).join('') || ''}</div>
          </div>`;
      }).join('') : `<div class="empty-state" style="padding:20px"><div class="empty-state-sub">No one available for this shift</div></div>`;

      return `
        <div class="shift-panel">
          <div class="shift-panel-header" style="border-left:3px solid ${color}">${title} (${list.length})</div>
          <div class="shift-panel-body">${rows}</div>
        </div>`;
    }

    document.getElementById('shift-grid').innerHTML =
      shiftPanel('Regular Shift', regular, 'var(--green)') +
      shiftPanel('US Shift', us, 'var(--blue)') +
      shiftPanel('Weekend Shift', weekend, 'var(--purple)');

  } catch (e) { console.error('[shifts]', e); }
}

async function loadLeadsPage() {
  try {
    const r = await fetch('/api/dashboard/leads');
    const data = await r.json();
    const grid = document.getElementById('leads-grid');

    const COLORS = ['#2563EB', '#16A34A', '#D97706', '#DC2626', '#7C3AED', '#0891B2'];

    if (!data.projects || !data.projects.length) {
      grid.innerHTML = `<div class="empty-state">
        <div class="empty-state-icon">👥</div>
        <div class="empty-state-title">No project lead data</div>
        <div class="empty-state-sub">Add a Project Distribution sheet to your Excel file</div>
      </div>`;
      return;
    }

    grid.innerHTML = data.projects.map((p, i) => {
      const color = COLORS[i % COLORS.length];
      const primary = data.leadDetails[p.primary_lead] || {};
      const second = data.leadDetails[p.secondary_lead] || {};
      const analysts = (data.analystMap[p.project] || '').split(',').filter(Boolean);

      const primaryAv = p.primary_lead ? avatarColor(p.primary_lead) : { bg: '#EFF6FF', c: '#1D4ED8' };
      const secondAv = p.secondary_lead ? avatarColor(p.secondary_lead) : { bg: '#F3F4F6', c: '#6B7280' };

      return `
        <div class="lead-card">
          <div class="lead-card-top" style="background:${color}"></div>
          <div class="lead-card-body">
            <div class="lead-card-client" style="color:${color}">${p.project}</div>

            <div class="lead-row">
              <div class="lead-role-label">Primary</div>
              <div class="emp-avatar" style="width:32px;height:32px;font-size:11px;background:${primaryAv.bg};color:${primaryAv.c}">
                ${initials(p.primary_lead || '?')}
              </div>
              <div>
                <div class="lead-name">${p.primary_lead || '—'}</div>
                <div class="lead-meta">${primary.title || ''} · ${primary.location || ''}</div>
              </div>
              <span class="tag tag-blue" style="margin-left:auto">Primary</span>
            </div>

            ${p.secondary_lead ? `
            <div class="lead-row">
              <div class="lead-role-label">Secondary</div>
              <div class="emp-avatar" style="width:32px;height:32px;font-size:11px;background:${secondAv.bg};color:${secondAv.c}">
                ${initials(p.secondary_lead)}
              </div>
              <div>
                <div class="lead-name">${p.secondary_lead}</div>
                <div class="lead-meta">${second.title || ''} · ${second.location || ''}</div>
              </div>
              <span class="tag tag-gray" style="margin-left:auto">Secondary</span>
            </div>` : `
            <div class="lead-row">
              <div class="lead-role-label">Secondary</div>
              <div style="font-size:12px;color:var(--t3)">⚠ No secondary lead assigned</div>
            </div>`}

            <div class="lead-analyst-count">
              <span>${p.analyst_count} analyst${p.analyst_count !== 1 ? 's' : ''} on this client</span>
              <span style="color:var(--t1);font-weight:500">
                ${analysts.slice(0, 3).join(', ')}${analysts.length > 3 ? ` +${analysts.length - 3} more` : ''}
              </span>
            </div>
          </div>
        </div>`;
    }).join('');

  } catch (e) {
    console.error('[leads]', e);
    showToast('Failed to load leads data', 'error');
  }
}


// ── UPLOAD ────────────────────────────────────────────────────────────────
function handleDragOver(e) { e.preventDefault(); document.getElementById('upload-zone').classList.add('drag-over'); }
function handleDragLeave() { document.getElementById('upload-zone').classList.remove('drag-over'); }
function handleDrop(e) {
  e.preventDefault();
  document.getElementById('upload-zone').classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) uploadFile(file);
}
function handleFileSelect(e) {
  const file = e.target.files[0];
  if (file) uploadFile(file);
}

async function uploadFile(file) {
  const progress = document.getElementById('upload-progress');
  const bar = document.getElementById('progress-bar');
  const text = document.getElementById('progress-text');
  const result = document.getElementById('upload-result');

  result.style.display = 'none';
  progress.style.display = 'block';
  bar.style.width = '30%';
  text.textContent = 'Uploading file...';

  const fd = new FormData();
  fd.append('file', file);

  try {
    bar.style.width = '60%';
    text.textContent = 'Python is cleaning and processing...';

    const r = await fetch('/api/upload', { method: 'POST', body: fd });
    const data = await r.json();

    bar.style.width = '100%';
    progress.style.display = 'none';

    if (data.error) throw new Error(data.error);

    result.className = 'upload-result success';
    result.style.display = 'block';
    result.innerHTML = `
      <strong>✓ Upload successful — ${file.name}</strong><br>
      <span style="font-size:12px">
        ${data.inserted} new · ${data.updated} updated · ${data.skipped} unchanged · ${data.found} total found
      </span>
      ${data.warnings?.length ? `<br><span style="font-size:11px;opacity:.7">Warnings: ${data.warnings.join(', ')}</span>` : ''}`;

    showToast(`✓ ${data.inserted} inserted, ${data.updated} updated`, 'success');
    loadUploadHistory();
    await loadOverview();

  } catch (e) {
    bar.style.width = '100%';
    progress.style.display = 'none';
    result.className = 'upload-result error';
    result.style.display = 'block';
    result.innerHTML = `<strong>✗ Upload failed</strong><br><span style="font-size:12px">${e.message}</span>`;
    showToast('Upload failed', 'error');
  }
}

async function loadUploadHistory() {
  try {
    const r = await fetch('/api/dashboard/uploads');
    const data = await r.json();
    const tbody = document.getElementById('upload-history-body');
    if (!tbody) return;

    tbody.innerHTML = data.length ? data.map(u => `
      <tr>
        <td style="font-family:monospace;font-size:11px">${u.filename || '—'}</td>
        <td style="color:var(--t2)">${u.uploaded_at ? new Date(u.uploaded_at).toLocaleString('en-IN') : '—'}</td>
        <td>${u.rows_found ?? 0}</td>
        <td style="color:var(--green)">${u.rows_inserted ?? 0}</td>
        <td style="color:var(--blue)">${u.rows_updated ?? 0}</td>
        <td style="color:var(--t3)">${u.rows_skipped ?? 0}</td>
        <td><span class="tag ${u.status === 'success' ? 'tag-green' : 'tag-red'}">${u.status}</span></td>
      </tr>`).join('') : '<tr><td colspan="7" style="text-align:center;color:var(--t3);padding:24px">No uploads yet</td></tr>';
  } catch (_) { }
}

// ── HELPERS ───────────────────────────────────────────────────────────────
const AV_BG = ['#DBEAFE', '#DCFCE7', '#FEF3C7', '#EDE9FE', '#FCE7F3', '#CFFAFE', '#FEE2E2', '#D1FAE5'];
const AV_FG = ['#1E40AF', '#166534', '#92400E', '#5B21B6', '#9D174D', '#164E63', '#991B1B', '#065F46'];
function avatarColor(name) {
  const i = (name || ' ').charCodeAt(0) % AV_BG.length;
  return { bg: AV_BG[i], c: AV_FG[i] };
}
function initials(name) {
  return (name || '').split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();
}
function tenureClass(m) {
  if (m < 1) return 'tenure-red';
  if (m < 12) return 'tenure-amber';
  if (m < 36) return 'tenure-blue';
  return 'tenure-green';
}
function levelTag(level) {
  if (level === 'Senior') return 'tag-purple';
  if (level === 'Head') return 'tag-amber';
  return 'tag-blue';
}   