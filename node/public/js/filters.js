// ── GLOBAL FILTERS ────────────────────────────────────────────────────────
function applyFilters() {
  const client   = document.getElementById('filter-client').value;
  const category = document.getElementById('filter-category').value;
  const location = document.getElementById('filter-location').value;

  APP.activeFilters = { client, category, location };

  // Build query params
  const params = {};
  if (client)   params.client   = client;
  if (category) params.category = category;
  if (location) params.location = location;

  loadOverview(params);

  // If a filter is active show drilldown automatically
  if (client || category || location) {
    const label = [client, category, location].filter(Boolean).join(' · ');
    loadDrilldown(category || null, client || null, label);
  } else {
    closeDrilldown();
  }
}

function clearFilters() {
  document.getElementById('filter-client').value   = '';
  document.getElementById('filter-category').value = '';
  document.getElementById('filter-location').value = '';
  APP.activeFilters = { client: '', category: '', location: '' };
  loadOverview({});
  closeDrilldown();

  // Reset active role bucket
  document.querySelectorAll('.role-bucket').forEach(b => b.classList.remove('active'));
}