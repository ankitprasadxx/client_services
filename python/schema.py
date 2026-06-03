import sqlite3
import os

DB_PATH = os.environ.get('DB_PATH', os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'database', 'clientservices.db'))

ROLE_CATEGORIES = {
    # Admin
    'PDFs Uploading':                    'Admin',
    'PDFs Merging':                      'Admin',
    # Transcription / Extraction
    'Pre-Processing':                    'Transcription / Extraction',
    'Processing':                        'Transcription / Extraction',
    'Validation':                        'Transcription / Extraction',
    'Admin Validation':                  'Transcription / Extraction',
    # Post Processing
    'Data Points Calculation':           'Post Processing',
    'Merging The Output Files':          'Post Processing',
    # Ungrouped
    'Report':                            'Ungrouped',
    'Mail Engagement':                   'Ungrouped',
    'Service Now':                       'Ungrouped',
    # Management
    'Runs The Client Services Program':  'Management',
}

def get_connection():
    os.makedirs(os.path.dirname(os.path.abspath(DB_PATH)), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    return conn

def create_tables():
    conn = get_connection()
    c = conn.cursor()

    c.executescript("""
        CREATE TABLE IF NOT EXISTS employees (
            id                  INTEGER PRIMARY KEY AUTOINCREMENT,
            name                TEXT NOT NULL,
            title               TEXT,
            level               TEXT,
            client_raw          TEXT,
            tenure_months       REAL DEFAULT 0,
            tenure_months_clean INTEGER DEFAULT 0,
            location            TEXT,
            reporting_manager   TEXT,
            reporting_to        TEXT,
            german_knowledge    TEXT DEFAULT 'No',
            is_assigned         TEXT DEFAULT 'Unassigned',
            tenure_band         TEXT,
            upload_batch_id     INTEGER,
            created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(name, title, location)
        );

        CREATE TABLE IF NOT EXISTS employee_clients (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            employee_id INTEGER NOT NULL,
            client      TEXT NOT NULL,
            FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
            UNIQUE(employee_id, client)
        );

        CREATE TABLE IF NOT EXISTS employee_roles (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            employee_id INTEGER NOT NULL,
            role        TEXT NOT NULL,
            category    TEXT NOT NULL DEFAULT 'Ungrouped',
            FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
            UNIQUE(employee_id, role)
        );

        CREATE TABLE IF NOT EXISTS employee_skills (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            employee_id INTEGER NOT NULL,
            skill       TEXT NOT NULL,
            FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
            UNIQUE(employee_id, skill)
        );

        CREATE TABLE IF NOT EXISTS team_leads (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            lead_name   TEXT NOT NULL,
            project     TEXT NOT NULL,
            UNIQUE(lead_name, project)
        );

        CREATE TABLE IF NOT EXISTS working_shifts (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            employee_id     INTEGER NOT NULL,
            regular_shift   INTEGER DEFAULT 1,
            us_shift        INTEGER DEFAULT 0,
            weekend_shift   INTEGER DEFAULT 0,
            FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
            UNIQUE(employee_id)
        );

        CREATE TABLE IF NOT EXISTS project_distribution (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            project         TEXT NOT NULL,
            primary_lead    TEXT,
            secondary_lead  TEXT,
            client_contact  TEXT,
            mail_contact    TEXT,
            UNIQUE(project)
        );

        CREATE TABLE IF NOT EXISTS role_categories (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            raw_role    TEXT NOT NULL UNIQUE,
            category    TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS upload_log (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            filename        TEXT,
            uploaded_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
            rows_found      INTEGER DEFAULT 0,
            rows_inserted   INTEGER DEFAULT 0,
            rows_updated    INTEGER DEFAULT 0,
            rows_skipped    INTEGER DEFAULT 0,
            status          TEXT DEFAULT 'pending',
            error_message   TEXT
        );
    """)

    # Seed role_categories lookup table
    for raw_role, category in ROLE_CATEGORIES.items():
        c.execute("""
            INSERT OR IGNORE INTO role_categories (raw_role, category)
            VALUES (?, ?)
        """, (raw_role, category))

    conn.commit()
    conn.close()
    print("[schema] All tables created successfully.")

if __name__ == '__main__':
    create_tables()