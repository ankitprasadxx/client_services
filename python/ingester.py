import sqlite3
from schema import get_connection
from datetime import datetime

def ingest(cleaned_data, filename, batch_id):
    """
    Master ingest function.
    Takes cleaned data dict from cleaner.py and writes to SQLite.
    Deduplicates on name + title + location.
    Never deletes existing records — only inserts or updates.
    """
    conn = get_connection()
    c = conn.cursor()

    stats = {
        'rows_found':    len(cleaned_data['employees']),
        'rows_inserted': 0,
        'rows_updated':  0,
        'rows_skipped':  0,
        'errors':        []
    }

    # Build lookup maps for bridge tables
    client_map  = {}   # name → [client, ...]
    role_map    = {}   # name → [{role, category}, ...]
    skill_map   = {}   # name → [skill, ...]
    shift_map   = {}   # name → {regular, us, weekend}

    for r in cleaned_data.get('clients', []):
        client_map.setdefault(r['name'], []).append(r['client'])

    for r in cleaned_data.get('roles', []):
        role_map.setdefault(r['name'], []).append({
            'role': r['role'], 'category': r['category']
        })

    for r in cleaned_data.get('skills', []):
        skill_map.setdefault(r['name'], []).append(r['skill'])

    for r in cleaned_data.get('shifts', []):
        shift_map[r['name']] = r

    # ── Process each employee ───────────────────────────────────────────────
    for emp in cleaned_data['employees']:
        name     = emp['name']
        title    = emp['title']
        location = emp['location']

        try:
            # Check if employee already exists
            existing = c.execute("""
                SELECT id, tenure_months, client_raw, location,
                       reporting_manager, german_knowledge, is_assigned
                FROM employees
                WHERE name = ? AND title = ? AND location = ?
            """, (name, title, location)).fetchone()

            if existing:
                emp_id = existing['id']
                # Compare fields to decide update or skip
                changed = (
                    abs(float(existing['tenure_months'] or 0) - float(emp['tenure_months'])) > 0.1
                    or (existing['client_raw'] or '') != (emp['client_raw'] or '')
                    or (existing['reporting_manager'] or '') != (emp['reporting_manager'] or '')
                    or (existing['german_knowledge'] or 'No') != (emp['german_knowledge'] or 'No')
                    or (existing['is_assigned'] or '') != (emp['is_assigned'] or '')
                )

                if changed:
                    c.execute("""
                        UPDATE employees SET
                            client_raw          = ?,
                            tenure_months       = ?,
                            tenure_months_clean = ?,
                            reporting_manager   = ?,
                            reporting_to        = ?,
                            german_knowledge    = ?,
                            is_assigned         = ?,
                            tenure_band         = ?,
                            upload_batch_id     = ?,
                            updated_at          = ?
                        WHERE id = ?
                    """, (
                        emp['client_raw'], emp['tenure_months'],
                        emp['tenure_months_clean'], emp['reporting_manager'],
                        emp['reporting_to'], emp['german_knowledge'],
                        emp['is_assigned'], emp['tenure_band'],
                        batch_id, datetime.now().isoformat(), emp_id
                    ))
                    # Refresh bridge records
                    _refresh_bridges(c, emp_id, name, client_map, role_map, skill_map, shift_map)
                    stats['rows_updated'] += 1
                else:
                    stats['rows_skipped'] += 1

            else:
                # New employee — insert
                c.execute("""
                    INSERT INTO employees (
                        name, title, level, client_raw,
                        tenure_months, tenure_months_clean,
                        location, reporting_manager, reporting_to,
                        german_knowledge, is_assigned, tenure_band,
                        upload_batch_id
                    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
                """, (
                    name, title, emp['level'], emp['client_raw'],
                    emp['tenure_months'], emp['tenure_months_clean'],
                    location, emp['reporting_manager'], emp['reporting_to'],
                    emp['german_knowledge'], emp['is_assigned'],
                    emp['tenure_band'], batch_id
                ))
                emp_id = c.lastrowid
                _refresh_bridges(c, emp_id, name, client_map, role_map, skill_map, shift_map)
                stats['rows_inserted'] += 1

        except Exception as e:
            stats['errors'].append(f"{name}: {str(e)}")
            print(f"[ingester] ERROR on {name}: {e}")

    # ── Project leads ────────────────────────────────────────────────────────
    for lead in cleaned_data.get('leads', []):
        try:
            c.execute("""
                INSERT OR IGNORE INTO team_leads (lead_name, project)
                VALUES (?, ?)
            """, (lead['lead_name'], lead['project']))
        except Exception as e:
            stats['errors'].append(f"Lead {lead}: {e}")

    # ── Project distribution ─────────────────────────────────────────────────
    for proj in cleaned_data.get('projects', []):
        try:
            c.execute("""
                INSERT OR REPLACE INTO project_distribution
                (project, primary_lead, secondary_lead)
                VALUES (?, ?, ?)
            """, (proj['project'], proj['primary_lead'], proj['secondary_lead']))
        except Exception as e:
            stats['errors'].append(f"Project {proj}: {e}")

    conn.commit()
    conn.close()

    print(f"[ingester] Done — inserted:{stats['rows_inserted']} "
          f"updated:{stats['rows_updated']} skipped:{stats['rows_skipped']}")
    return stats


def _refresh_bridges(c, emp_id, name, client_map, role_map, skill_map, shift_map):
    """Delete and re-insert all bridge records for one employee."""

    # Clients
    c.execute("DELETE FROM employee_clients WHERE employee_id = ?", (emp_id,))
    for client in client_map.get(name, []):
        c.execute("""
            INSERT OR IGNORE INTO employee_clients (employee_id, client)
            VALUES (?, ?)
        """, (emp_id, client))

    # Roles
    c.execute("DELETE FROM employee_roles WHERE employee_id = ?", (emp_id,))
    for r in role_map.get(name, []):
        c.execute("""
            INSERT OR IGNORE INTO employee_roles (employee_id, role, category)
            VALUES (?, ?, ?)
        """, (emp_id, r['role'], r['category']))

    # Skills
    c.execute("DELETE FROM employee_skills WHERE employee_id = ?", (emp_id,))
    for skill in skill_map.get(name, []):
        c.execute("""
            INSERT OR IGNORE INTO employee_skills (employee_id, skill)
            VALUES (?, ?)
        """, (emp_id, skill))

    # Shifts
    shift = shift_map.get(name, {'regular_shift': 1, 'us_shift': 0, 'weekend_shift': 0})
    c.execute("DELETE FROM working_shifts WHERE employee_id = ?", (emp_id,))
    c.execute("""
        INSERT OR IGNORE INTO working_shifts
        (employee_id, regular_shift, us_shift, weekend_shift)
        VALUES (?, ?, ?, ?)
    """, (emp_id, shift.get('regular_shift', 1),
          shift.get('us_shift', 0), shift.get('weekend_shift', 0)))