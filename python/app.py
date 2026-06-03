import os
import sys
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

# Add python dir to path
sys.path.insert(0, os.path.dirname(__file__))

from schema import create_tables, get_connection
from cleaner import clean_excel
from ingester import ingest

app = Flask(__name__)
CORS(app, origins=['http://localhost:3000'])

UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), 'uploads')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# ── Create tables on startup ────────────────────────────────────────────────
try:
    create_tables()
    print("[app] Database initialised.")
except Exception as e:
    print(f"[app] DB init error: {e}")


@app.route('/health', methods=['GET'])
def health():
    try:
        conn = get_connection()
        conn.execute("SELECT 1")
        conn.close()
        return jsonify({'status': 'ok', 'db_connected': True})
    except Exception as e:
        return jsonify({'status': 'error', 'db_connected': False, 'error': str(e)}), 500


@app.route('/ingest', methods=['POST'])
def ingest_file():
    data = request.get_json()
    if not data or 'filepath' not in data:
        return jsonify({'error': 'filepath required'}), 400

    filepath = data['filepath']
    filename = os.path.basename(filepath)

    if not os.path.exists(filepath):
        return jsonify({'error': f'File not found: {filepath}'}), 404

    # Create upload log entry
    conn = get_connection()
    c = conn.cursor()
    c.execute("""
        INSERT INTO upload_log (filename, status)
        VALUES (?, 'processing')
    """, (filename,))
    batch_id = c.lastrowid
    conn.commit()
    conn.close()

    try:
        # Step 1: Clean
        cleaned = clean_excel(filepath)

        if cleaned['errors']:
            print(f"[app] Cleaner warnings: {cleaned['errors']}")

        # Step 2: Ingest
        stats = ingest(cleaned, filename, batch_id)

        # Step 3: Update upload log
        conn = get_connection()
        c = conn.cursor()
        c.execute("""
            UPDATE upload_log SET
                rows_found    = ?,
                rows_inserted = ?,
                rows_updated  = ?,
                rows_skipped  = ?,
                status        = ?,
                error_message = ?
            WHERE id = ?
        """, (
            stats['rows_found'],
            stats['rows_inserted'],
            stats['rows_updated'],
            stats['rows_skipped'],
            'success',
            '; '.join(stats['errors'][:5]) if stats['errors'] else None,
            batch_id
        ))
        conn.commit()
        conn.close()

        # Clean up temp file
        try:
            os.remove(filepath)
        except Exception:
            pass

        return jsonify({
            'status':   'success',
            'batch_id': batch_id,
            'filename': filename,
            'inserted': stats['rows_inserted'],
            'updated':  stats['rows_updated'],
            'skipped':  stats['rows_skipped'],
            'found':    stats['rows_found'],
            'warnings': stats['errors'][:5]
        })

    except Exception as e:
        # Log failure
        conn = get_connection()
        c = conn.cursor()
        c.execute("""
            UPDATE upload_log SET status = 'failed', error_message = ?
            WHERE id = ?
        """, (str(e), batch_id))
        conn.commit()
        conn.close()
        print(f"[app] Ingest failed: {e}")
        import traceback; traceback.print_exc()
        return jsonify({'error': str(e), 'status': 'failed'}), 500


@app.route('/data/snapshot', methods=['GET'])
def data_snapshot():
    """Returns full team snapshot for AI context building."""
    try:
        conn = get_connection()
        c = conn.cursor()

        headcount = c.execute(
            "SELECT COUNT(*) as n FROM employees WHERE level != 'Management'"
        ).fetchone()['n']

        clients = c.execute("""
            SELECT ec.client, COUNT(DISTINCT ec.employee_id) as count
            FROM employee_clients ec
            JOIN employees e ON ec.employee_id = e.id
            WHERE ec.client NOT IN ('All','')
            GROUP BY ec.client ORDER BY count DESC
        """).fetchall()

        roles = c.execute("""
            SELECT er.category, COUNT(DISTINCT er.employee_id) as count
            FROM employee_roles er
            GROUP BY er.category ORDER BY count DESC
        """).fetchall()

        shifts = c.execute("""
            SELECT e.name,
                   ws.regular_shift, ws.us_shift, ws.weekend_shift
            FROM working_shifts ws
            JOIN employees e ON ws.employee_id = e.id
        """).fetchall()

        team = c.execute("""
            SELECT e.name, e.title, e.level, e.tenure_months_clean,
                   e.location, e.is_assigned, e.german_knowledge,
                   GROUP_CONCAT(DISTINCT ec.client) as clients,
                   GROUP_CONCAT(DISTINCT es.skill)  as skills
            FROM employees e
            LEFT JOIN employee_clients ec ON e.id = ec.employee_id
            LEFT JOIN employee_skills  es ON e.id = es.employee_id
            GROUP BY e.id ORDER BY e.name
        """).fetchall()

        leads = c.execute("""
            SELECT pd.project, pd.primary_lead, pd.secondary_lead
            FROM project_distribution pd
        """).fetchall()

        unassigned = c.execute(
            "SELECT name FROM employees WHERE is_assigned = 'Unassigned'"
        ).fetchall()

        conn.close()

        return jsonify({
            'headcount':  headcount,
            'clients':    [dict(r) for r in clients],
            'roles':      [dict(r) for r in roles],
            'shifts':     [dict(r) for r in shifts],
            'team':       [dict(r) for r in team],
            'leads':      [dict(r) for r in leads],
            'unassigned': [r['name'] for r in unassigned],
        })
    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    port = int(os.environ.get('PYTHON_PORT', 5000))
    print(f"[app] Python Flask running on port {port}")
    app.run(host='0.0.0.0', port=port, debug=False)