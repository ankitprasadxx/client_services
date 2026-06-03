// ── CHART DEFAULTS ────────────────────────────────────────────────────────
Chart.defaults.font.family = "'Inter', sans-serif";
Chart.defaults.font.size   = 11;
Chart.defaults.color       = '#6B7280';
Chart.defaults.plugins.legend.display = false;
Chart.defaults.plugins.tooltip.backgroundColor = '#111827';
Chart.defaults.plugins.tooltip.padding         = 10;
Chart.defaults.plugins.tooltip.cornerRadius    = 8;
Chart.defaults.plugins.tooltip.titleFont       = { size: 12, weight: '600' };
Chart.defaults.plugins.tooltip.bodyFont        = { size: 11 };

const PALETTE = ['#2563EB','#16A34A','#D97706','#DC2626','#7C3AED','#0891B2','#C026D3','#EA580C'];

function destroyChart(id) {
  if (APP.charts[id]) { APP.charts[id].destroy(); delete APP.charts[id]; }
}

// ── RENDER ALL CHARTS ────────────────────────────────────────────────────
function renderCharts(data) {
  renderClientChart(data.clients      || []);
  renderDeploymentChart(data.kpis     || {});
  renderTenureChart(data.tenureBands  || []);
  renderSkillsChart(data.skills       || []);
  renderLocationChart(data.locations  || []);
  renderRolesChart(data.roleCategories || []);
  renderShiftsChart(data.shifts       || {});
}

// ── 1. CLIENTS BAR CHART ──────────────────────────────────────────────────
function renderClientChart(clients) {
  destroyChart('clients');
  const filtered = clients.filter(c => c.client && c.client !== 'All');
  const labels   = filtered.map(c => c.client);
  const counts   = filtered.map(c => c.count);
  const colors   = counts.map(n => n === 1 ? '#DC2626' : n === 2 ? '#D97706' : '#16A34A');

  const ctx = document.getElementById('chart-clients');
  if (!ctx) return;

  APP.charts.clients = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data: counts, backgroundColor: colors,
        borderRadius: 6, borderSkipped: false,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      indexAxis: 'y',
      onClick: (e, elements) => {
        if (elements.length) {
          const client = labels[elements[0].index];
          document.getElementById('filter-client').value = client;
          applyFilters();
          loadDrilldown(null, client);
        }
      },
      plugins: {
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.parsed.x} analyst${ctx.parsed.x !== 1 ? 's' : ''}`,
            afterLabel: ctx => {
              const n = ctx.parsed.x;
              return n === 1 ? '⚠ Critical — no backup' : n === 2 ? '⚡ Watch — thin coverage' : '✓ Healthy';
            }
          }
        }
      },
      scales: {
        x: { grid: { color: '#F3F4F6' }, ticks: { stepSize: 1 }, beginAtZero: true },
        y: { grid: { display: false } }
      }
    }
  });
}

// ── 2. DEPLOYMENT DONUT ───────────────────────────────────────────────────
function renderDeploymentChart(kpis) {
  destroyChart('deployment');
  const deployed   = kpis.deployed   || 0;
  const unassigned = kpis.unassigned || 0;

  const ctx = document.getElementById('chart-deployment');
  if (!ctx) return;

  APP.charts.deployment = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Deployed', 'Available'],
      datasets: [{
        data: [deployed, unassigned],
        backgroundColor: ['#2563EB', '#16A34A'],
        borderWidth: 0, hoverOffset: 6,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      cutout: '68%',
      plugins: {
        legend: {
          display: true,
          position: 'bottom',
          labels: { padding: 16, usePointStyle: true, pointStyleWidth: 8 }
        },
        tooltip: {
          callbacks: { label: ctx => ` ${ctx.label}: ${ctx.parsed}` }
        }
      }
    }
  });
}

// ── 3. TENURE BANDS COLUMN CHART ─────────────────────────────────────────
function renderTenureChart(bands) {
  destroyChart('tenure');
  const ORDER  = ['0-3 months','3-12 months','1-2 years','2-4 years','4+ years'];
  const COLORS = { '0-3 months':'#DC2626','3-12 months':'#D97706','1-2 years':'#2563EB','2-4 years':'#0891B2','4+ years':'#16A34A' };

  const sorted = ORDER.map(o => ({ band: o, count: (bands.find(b => b.tenure_band === o) || {}).count || 0 }));

  const ctx = document.getElementById('chart-tenure');
  if (!ctx) return;

  APP.charts.tenure = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: sorted.map(s => s.band),
      datasets: [{
        data:            sorted.map(s => s.count),
        backgroundColor: sorted.map(s => COLORS[s.band] || '#6B7280'),
        borderRadius: 6, borderSkipped: false,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { tooltip: { callbacks: { label: ctx => ` ${ctx.parsed.y} analyst${ctx.parsed.y !== 1 ? 's' : ''}` } } },
      scales: {
        x: { grid: { display: false } },
        y: { grid: { color: '#F3F4F6' }, ticks: { stepSize: 1 }, beginAtZero: true }
      }
    }
  });
}

// ── 4. SKILLS HORIZONTAL BAR ──────────────────────────────────────────────
function renderSkillsChart(skills) {
  destroyChart('skills');
  const top  = skills.slice(0, 12);
  const ctx  = document.getElementById('chart-skills');
  if (!ctx) return;

  APP.charts.skills = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: top.map(s => s.skill),
      datasets: [{
        data: top.map(s => s.count),
        backgroundColor: PALETTE.map(c => c + 'CC'),
        borderRadius: 4, borderSkipped: false,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      indexAxis: 'y',
      plugins: { tooltip: { callbacks: { label: ctx => ` ${ctx.parsed.x} members` } } },
      scales: {
        x: { grid: { color: '#F3F4F6' }, beginAtZero: true, ticks: { stepSize: 2 } },
        y: { grid: { display: false }, ticks: { font: { size: 10 } } }
      }
    }
  });
}

// ── 5. LOCATION BAR ───────────────────────────────────────────────────────
function renderLocationChart(locations) {
  destroyChart('locations');
  const ctx = document.getElementById('chart-locations');
  if (!ctx) return;

  APP.charts.locations = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: locations.map(l => l.location),
      datasets: [{
        data:            locations.map(l => l.count),
        backgroundColor: locations.map((_, i) => PALETTE[i % PALETTE.length] + 'CC'),
        borderRadius: 6, borderSkipped: false,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      indexAxis: 'y',
      onClick: (e, elements) => {
        if (elements.length) {
          const loc = locations[elements[0].index].location;
          document.getElementById('filter-location').value = loc;
          applyFilters();
        }
      },
      plugins: { tooltip: { callbacks: { label: ctx => ` ${ctx.parsed.x} members` } } },
      scales: {
        x: { grid: { color: '#F3F4F6' }, beginAtZero: true, ticks: { stepSize: 1 } },
        y: { grid: { display: false }, ticks: { font: { size: 10 } } }
      }
    }
  });
}

// ── 6. ROLE CATEGORIES PIE ────────────────────────────────────────────────
function renderRolesChart(categories) {
  destroyChart('roles');
  const ctx = document.getElementById('chart-roles');
  if (!ctx) return;

  APP.charts.roles = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: categories.map(c => c.category),
      datasets: [{
        data:            categories.map(c => c.count),
        backgroundColor: PALETTE,
        borderWidth: 0, hoverOffset: 8,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true, position: 'bottom',
          labels: { padding: 12, usePointStyle: true, pointStyleWidth: 8, font: { size: 10 } }
        },
        tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.parsed} people` } }
      }
    }
  });
}

// ── 7. SHIFTS RADAR / BAR ─────────────────────────────────────────────────
function renderShiftsChart(shifts) {
  destroyChart('shifts');
  const ctx = document.getElementById('chart-shifts');
  if (!ctx) return;

  APP.charts.shifts = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Regular Only', 'US Shift', 'Weekend'],
      datasets: [{
        data: [
          (shifts.regular || 0) - (shifts.us_shift || 0) - (shifts.weekend || 0),
          shifts.us_shift  || 0,
          shifts.weekend   || 0,
        ],
        backgroundColor: ['#16A34A','#2563EB','#7C3AED'],
        borderWidth: 0, hoverOffset: 6,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: {
          display: true, position: 'bottom',
          labels: { padding: 12, usePointStyle: true, pointStyleWidth: 8, font: { size: 10 } }
        },
        tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.parsed}` } }
      }
    }
  });
}