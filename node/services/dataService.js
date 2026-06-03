const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = process.env.DB_PATH
  ? process.env.DB_PATH
  : path.join(__dirname, '..', '..', 'database', 'clientservices.db');

function getDb() {
  return new Database(DB_PATH, { readonly: true });
}

// ── OVERVIEW ──────────────────────────────────────────────────────────────
function getOverview(filters = {}) {
  const db = getDb();

  const whereClauses = [];
  const params = [];

  if (filters.client) {
    whereClauses.push(`e.id IN (
      SELECT employee_id FROM employee_clients WHERE client = ?
    )`);
    params.push(filters.client);
  }
  if (filters.category) {
    whereClauses.push(`e.id IN (
      SELECT employee_id FROM employee_roles WHERE category = ?
    )`);
    params.push(filters.category);
  }
  if (filters.location) {
    whereClauses.push(`e.location = ?`);
    params.push(filters.location);
  }

  const baseWhere = whereClauses.length
    ? 'WHERE ' + whereClauses.join(' AND ')
    : '';
  const mgmtFilter = whereClauses.length
    ? baseWhere + " AND e.level != 'Management'"
    : "WHERE e.level != 'Management'";

  const headcount = db.prepare(
    `SELECT COUNT(*) as n FROM employees e ${mgmtFilter}`
  ).get(...params).n;

  const deployed = db.prepare(
    `SELECT COUNT(*) as n FROM employees e ${mgmtFilter} AND e.is_assigned = 'Deployed'`
  ).get(...params).n;

  const unassigned = db.prepare(
    `SELECT COUNT(*) as n FROM employees e ${mgmtFilter} AND e.is_assigned = 'Unassigned'`
  ).get(...params).n;

  const multiClient = db.prepare(`
    SELECT COUNT(*) as n FROM (
      SELECT ec.employee_id FROM employee_clients ec
      JOIN employees e ON ec.employee_id = e.id
      WHERE ec.client NOT IN ('All','') ${filters.client ? 'AND ec.client = ?' : ''}
      GROUP BY ec.employee_id HAVING COUNT(ec.client) > 1
    )
  `).get(...(filters.client ? [filters.client] : [])).n;

  // Clients
  let clientQuery = `
    SELECT ec.client, COUNT(DISTINCT ec.employee_id) as count
    FROM employee_clients ec
    JOIN employees e ON ec.employee_id = e.id
    WHERE ec.client NOT IN ('All','')
    ${filters.category ? "AND e.id IN (SELECT employee_id FROM employee_roles WHERE category = ?)" : ''}
    GROUP BY ec.client ORDER BY count DESC
  `;
  const clientParams = filters.category ? [filters.category] : [];
  const clients = db.prepare(clientQuery).all(...clientParams);

  // Role categories
  let roleQuery = `
    SELECT er.category, COUNT(DISTINCT er.employee_id) as count
    FROM employee_roles er
    JOIN employees e ON er.employee_id = e.id
    ${filters.client ? "WHERE e.id IN (SELECT employee_id FROM employee_clients WHERE client = ?)" : ''}
    GROUP BY er.category ORDER BY count DESC
  `;
  const roleParams = filters.client ? [filters.client] : [];
  const roleCategories = db.prepare(roleQuery).all(...roleParams);

  // Tenure bands
  const tenureBands = db.prepare(`
    SELECT tenure_band, COUNT(*) as count FROM employees e
    ${mgmtFilter} GROUP BY tenure_band
  `).all(...params);

  // Locations
  const locations = db.prepare(`
    SELECT location, COUNT(*) as count FROM employees e
    ${mgmtFilter} GROUP BY location ORDER BY count DESC
  `).all(...params);

  // Skills
  const skills = db.prepare(`
    SELECT es.skill, COUNT(DISTINCT es.employee_id) as count
    FROM employee_skills es
    JOIN employees e ON es.employee_id = e.id
    ${mgmtFilter}
    GROUP BY es.skill ORDER BY count DESC LIMIT 20
  `).all(...params);

  // Shift availability
  const shifts = db.prepare(`
    SELECT
      SUM(ws.regular_shift) as regular,
      SUM(ws.us_shift)      as us_shift,
      SUM(ws.weekend_shift) as weekend
    FROM working_shifts ws
    JOIN employees e ON ws.employee_id = e.id
    ${mgmtFilter}
  `).get(...params);

  // Last upload
  const lastUpload = db.prepare(`
    SELECT filename, uploaded_at, rows_inserted, rows_updated, rows_skipped, status
    FROM upload_log ORDER BY id DESC LIMIT 1
  `).get();

  db.close();

  return {
    kpis: { headcount, deployed, unassigned, multiClient },
    clients,
    roleCategories,
    tenureBands,
    locations,
    skills,
    shifts,
    lastUpload
  };
}

// ── EMPLOYEES LIST (filtered) ─────────────────────────────────────────────
function getEmployees(filters = {}) {
  const db = getDb();

  const whereClauses = ["e.level != 'Management'"];
  const params = [];

  if (filters.client) {
    whereClauses.push(`e.id IN (
      SELECT employee_id FROM employee_clients WHERE client = ?
    )`);
    params.push(filters.client);
  }
  if (filters.category) {
    whereClauses.push(`e.id IN (
      SELECT employee_id FROM employee_roles WHERE category = ?
    )`);
    params.push(filters.category);
  }
  if (filters.location) {
    whereClauses.push(`e.location = ?`);
    params.push(filters.location);
  }
  if (filters.level) {
    whereClauses.push(`e.level = ?`);
    params.push(filters.level);
  }
  if (filters.shift === 'us') {
    whereClauses.push(`e.id IN (
      SELECT employee_id FROM working_shifts WHERE us_shift = 1
    )`);
  }
  if (filters.shift === 'weekend') {
    whereClauses.push(`e.id IN (
      SELECT employee_id FROM working_shifts WHERE weekend_shift = 1
    )`);
  }
  // if (filters.search) {
  //   whereClauses.push(`(
  //     e.name LIKE ? OR e.title LIKE ? OR e.location LIKE ?
  //   )`);
  //   const s = `%${filters.search}%`;
  //   params.push(s, s, s);
  // }
  if (filters.search) {
    whereClauses.push(`(
      e.name     LIKE ? OR
      e.title    LIKE ? OR
      e.location LIKE ? OR
      e.id IN (SELECT employee_id FROM employee_skills WHERE skill LIKE ?) OR
      e.id IN (SELECT employee_id FROM employee_roles  WHERE role  LIKE ?) OR
      e.id IN (SELECT employee_id FROM employee_roles  WHERE category LIKE ?) OR
      e.id IN (SELECT employee_id FROM employee_clients WHERE client LIKE ?)
    )`);
    const s = `%${filters.search}%`;
    params.push(s, s, s, s, s, s, s);
  }
  const where = 'WHERE ' + whereClauses.join(' AND ');

  const employees = db.prepare(`
    SELECT
      e.id, e.name, e.title, e.level,
      e.tenure_months, e.tenure_months_clean, e.tenure_band,
      e.location, e.is_assigned, e.german_knowledge,
      e.reporting_manager,
      GROUP_CONCAT(DISTINCT ec.client)  as clients,
      GROUP_CONCAT(DISTINCT er.role)    as roles,
      GROUP_CONCAT(DISTINCT er.category) as categories,
      GROUP_CONCAT(DISTINCT es.skill)   as skills,
      ws.regular_shift, ws.us_shift, ws.weekend_shift
    FROM employees e
    LEFT JOIN employee_clients ec ON e.id = ec.employee_id AND ec.client NOT IN ('All','')
    LEFT JOIN employee_roles   er ON e.id = er.employee_id
    LEFT JOIN employee_skills  es ON e.id = es.employee_id
    LEFT JOIN working_shifts   ws ON e.id = ws.employee_id
    ${where}
    GROUP BY e.id
    ORDER BY e.tenure_months DESC, e.name ASC
  `).all(...params);

  db.close();
  return employees;
}

// ── CLIENT DETAIL ─────────────────────────────────────────────────────────
function getClientDetail(client) {
  const db = getDb();

  const employees = db.prepare(`
    SELECT
      e.id, e.name, e.title, e.level,
      e.tenure_months_clean, e.tenure_band,
      e.location, e.is_assigned,
      GROUP_CONCAT(DISTINCT er.role)      as roles,
      GROUP_CONCAT(DISTINCT er.category)  as categories,
      GROUP_CONCAT(DISTINCT es.skill)     as skills
    FROM employees e
    JOIN employee_clients ec ON e.id = ec.employee_id
    LEFT JOIN employee_roles  er ON e.id = er.employee_id
    LEFT JOIN employee_skills es ON e.id = es.employee_id
    WHERE ec.client = ?
    GROUP BY e.id ORDER BY e.tenure_months DESC
  `).all(client);

  const roleMatrix = db.prepare(`
    SELECT er.category, COUNT(DISTINCT er.employee_id) as count
    FROM employee_roles er
    JOIN employee_clients ec ON er.employee_id = ec.employee_id
    WHERE ec.client = ?
    GROUP BY er.category
  `).all(client);

  const skills = db.prepare(`
    SELECT es.skill, COUNT(DISTINCT es.employee_id) as count
    FROM employee_skills es
    JOIN employee_clients ec ON es.employee_id = ec.employee_id
    WHERE ec.client = ?
    GROUP BY es.skill ORDER BY count DESC
  `).all(client);

  const lead = db.prepare(`
    SELECT primary_lead, secondary_lead
    FROM project_distribution WHERE project = ?
  `).get(client);

  db.close();
  return { client, employees, roleMatrix, skills, lead: lead || {} };
}

// ── SHIFT DATA ────────────────────────────────────────────────────────────
function getShiftData() {
  const db = getDb();

  const all = db.prepare(`
    SELECT e.name, e.title, e.location,
           ws.regular_shift, ws.us_shift, ws.weekend_shift,
           GROUP_CONCAT(DISTINCT ec.client) as clients
    FROM working_shifts ws
    JOIN employees e ON ws.employee_id = e.id
    LEFT JOIN employee_clients ec ON e.id = ec.employee_id
    WHERE e.level != 'Management'
    GROUP BY e.id ORDER BY e.name
  `).all();

  db.close();
  return all;
}

// ── UPLOAD HISTORY ────────────────────────────────────────────────────────
function getUploadHistory() {
  const db = getDb();
  const rows = db.prepare(`
    SELECT id, filename, uploaded_at, rows_found,
           rows_inserted, rows_updated, rows_skipped, status, error_message
    FROM upload_log ORDER BY id DESC LIMIT 20
  `).all();
  db.close();
  return rows;
}

// ── AI SNAPSHOT ───────────────────────────────────────────────────────────
function getAiSnapshot() {
  const db = getDb();

  const headcount = db.prepare(
    "SELECT COUNT(*) as n FROM employees WHERE level != 'Management'"
  ).get().n;

  const clients = db.prepare(`
    SELECT ec.client, COUNT(DISTINCT ec.employee_id) as count
    FROM employee_clients ec
    JOIN employees e ON ec.employee_id = e.id
    WHERE ec.client NOT IN ('All','')
    GROUP BY ec.client ORDER BY count DESC
  `).all();

  const roles = db.prepare(`
    SELECT category, COUNT(DISTINCT employee_id) as count
    FROM employee_roles GROUP BY category ORDER BY count DESC
  `).all();

  const team = db.prepare(`
    SELECT e.name, e.title, e.level, e.tenure_months_clean,
           e.location, e.is_assigned, e.german_knowledge,
           GROUP_CONCAT(DISTINCT ec.client) as clients,
           GROUP_CONCAT(DISTINCT es.skill)  as skills,
           ws.us_shift, ws.weekend_shift
    FROM employees e
    LEFT JOIN employee_clients ec ON e.id = ec.employee_id
    LEFT JOIN employee_skills  es ON e.id = es.employee_id
    LEFT JOIN working_shifts   ws ON e.id = ws.employee_id
    WHERE e.level != 'Management'
    GROUP BY e.id ORDER BY e.name
  `).all();

  const leads = db.prepare(
    "SELECT project, primary_lead, secondary_lead FROM project_distribution"
  ).all();

  const unassigned = db.prepare(
    "SELECT name FROM employees WHERE is_assigned = 'Unassigned'"
  ).all().map(r => r.name);

  db.close();
  return { headcount, clients, roles, team, leads, unassigned };
}
function getLeadsData() {
  const db = getDb();

  const projects = db.prepare(`
    SELECT
      pd.project,
      pd.primary_lead,
      pd.secondary_lead,
      COUNT(DISTINCT ec.employee_id) as analyst_count
    FROM project_distribution pd
    LEFT JOIN employee_clients ec ON ec.client = pd.project
    GROUP BY pd.project
    ORDER BY analyst_count DESC
  `).all();

  // For each lead name, get their details from employees
  const leadDetails = {};
  projects.forEach(p => {
    [p.primary_lead, p.secondary_lead].filter(Boolean).forEach(name => {
      if (name && !leadDetails[name]) {
        const emp = db.prepare(`
          SELECT name, title, level, location, tenure_months_clean
          FROM employees WHERE name = ?
        `).get(name);
        leadDetails[name] = emp || { name, title: 'Lead', level: 'Senior' };
      }
    });
  });

  // Client analyst counts for the lead cards
  const clientAnalysts = db.prepare(`
    SELECT ec.client,
           GROUP_CONCAT(DISTINCT e.name) as analysts
    FROM employee_clients ec
    JOIN employees e ON ec.employee_id = e.id
    WHERE ec.client NOT IN ('All','')
    GROUP BY ec.client
  `).all();

  const analystMap = {};
  clientAnalysts.forEach(r => { analystMap[r.client] = r.analysts; });

  db.close();
  return { projects, leadDetails, analystMap };
}
module.exports = {
  getOverview,
  getEmployees,
  getClientDetail,
  getShiftData,
  getUploadHistory,
  getAiSnapshot,
  getLeadsData
};