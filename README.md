# Client Services COO Dashboard

A full-stack web dashboard for COO/executive visibility into the Client Services team.
Built with Node.js + Python + SQLite + Chart.js + Grok AI.

---

## Quick Start (Windows)

1. Double-click `start.bat`
2. Dashboard opens at http://localhost:3000
3. Upload your Excel file from the Upload page

That's it.

---

## Manual Start

**Terminal 1 — Python Flask:**
```
python python/app.py
```

**Terminal 2 — Node.js:**
```
cd node
node server.js
```

Open browser: http://localhost:3000

---

## Configuration

Edit `.env` file in the project root:

```
GROK_API_KEY=xai-your-key-here    ← Get from https://console.x.ai
PYTHON_SERVICE_URL=http://localhost:5000
PORT=3000
DB_PATH=../database/clientservices.db
```

---

## Excel File Format

Your Excel file must have these sheets:
- `Team_master` — one row per employee
- `Employee_client` — one row per employee-client pair
- `Employee_role` — one row per employee-role pair
- `Employee_Skills` — one row per employee-skill pair
- `Working Shift` — shift availability per person
- `Project Distribution` — primary/secondary leads

Uploading a new file **never deletes** existing data.
Only new records are inserted. Changed records are updated.

---

## Dashboard Pages

| Page | What it shows |
|---|---|
| Overview | KPIs, role buckets, charts, filters, drilldown |
| Clients | Per-client health, analyst roster, role matrix |
| Team Roster | Full table with search + filters + profile modal |
| Shifts | Who is available for Regular / US / Weekend shifts |
| AI Assistant | Grok-powered chat + auto insights |
| Upload Data | Excel upload with history log |

---

## Stack

- **Node.js** (Express) — web server, API, frontend serving
- **Python** (Flask + pandas) — Excel cleaning, SQLite writes
- **SQLite** — local database, no setup required
- **Chart.js** — all charts (free CDN)
- **Grok API** (xAI) — AI chat and insights

---

## Folder Structure

```
client-services-dashboard/
├── python/          Python Flask service
├── node/            Node.js Express server + frontend
│   └── public/      HTML + CSS + JS frontend
├── database/        SQLite database (auto-created)
├── .env             Your API keys (never commit)
├── start.bat        One-click Windows startup
└── README.md
```
