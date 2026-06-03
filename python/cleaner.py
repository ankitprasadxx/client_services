import pandas as pd
import re
import os

# ── Name aliases — handles spelling differences across sheets ──────────────
NAME_ALIASES = {
    'chetna shirke':         'Chetna B. Shirke',
    'chetna b shirke':       'Chetna B. Shirke',
    'swati yedage':          'Swati Yegade',
    'swati':                 'Swati Yegade',
    'vinita rajput':         'Vinita Rajput',
    'vinita':                'Vinita Rajput',
    'madhura':               'Madhura Deshpande',
    'om sonawane':           'Om Sonawane',
    'om':                    'Om Sonawane',
    'gayatri':               'Gayatri Panda',
    'payoshni':              'Payoshni Tingane',
    'bhagyashree':           'Bhagyashree Shinde',
    'shubham':               'Shubham Masalkar',
}

# ── Skill standardisation map ──────────────────────────────────────────────
SKILL_MAP = {
    'powerbi':                       'Power BI',
    'power bi':                      'Power BI',
    'power bio':                     'Power BI',
    'powerbI':                       'Power BI',
    'advance excel':                 'Excel',
    'advanced excel':                'Excel',
    'ms excel':                      'Excel',
    'basic of sql':                  'SQL',
    'basic sql':                     'SQL',
    'pl/sql':                        'SQL',
    'basic knowledge of sql':        'SQL',
    'basic knowledge of sql,pl/sql': 'SQL',
    'ml':                            'Machine Learning',
    'machine learning':              'Machine Learning',
    'dl':                            'Deep Learning',
    'deep learning':                 'Deep Learning',
    'gen ai':                        'Generative AI',
    'generative ai':                 'Generative AI',
    'r-programming':                 'R Programming',
    'r programming':                 'R Programming',
    'r-shiny':                       'R Shiny',
    'data analysis & interpretation':'Data Analysis',
    'data anlysis':                  'Data Analysis',
    'data analysis':                 'Data Analysis',
    'team handelling (internal)':    'Team Management',
    'team handling':                 'Team Management',
    'project management / subject matter expert': 'Project Management',
    'subject matter expert':         'Project Management',
    'ci/cd':                         'CI/CD',
    'basic(ci/cd,docker)':           'Docker',
    'basic of python':               'Python',
    'basic of html':                 'HTML',
    'basic of html,css':             'HTML/CSS',
    'html,css':                      'HTML/CSS',
    'html':                          'HTML/CSS',
    'css':                           'HTML/CSS',
    '.net':                          '.NET',
    'c#':                            'C#',
}

# ── Role standardisation map ───────────────────────────────────────────────
ROLE_MAP = {
    'validator':             'Validation',
    'validators':            'Validation',
    'admin validation':      'Admin Validation',
    'pre processor':         'Pre-Processing',
    'pre-processor':         'Pre-Processing',
    'preprocessor':          'Pre-Processing',
    'processor':             'Processing',
    'processors':            'Processing',
    'pdfs uploading':        'PDFs Uploading',
    'pdf uploading':         'PDFs Uploading',
    'pdfs merging':          'PDFs Merging',
    'pdf merging':           'PDFs Merging',
    'merging the output files': 'Merging The Output Files',
    'final output files merging': 'Merging The Output Files',
    'data points calculation':   'Data Points Calculation',
    'mail engagement':       'Mail Engagement',
    'service now':           'Service Now',
    'servicenow':            'Service Now',
    'report':                'Report',
    'runs the client services program': 'Runs The Client Services Program',
    'admin':                 'Admin',
}

# ── Role → Category map ────────────────────────────────────────────────────
ROLE_CATEGORY_MAP = {
    'PDFs Uploading':                   'Admin',
    'PDFs Merging':                     'Admin',
    'Pre-Processing':                   'Transcription / Extraction',
    'Processing':                       'Transcription / Extraction',
    'Validation':                       'Transcription / Extraction',
    'Admin Validation':                 'Transcription / Extraction',
    'Data Points Calculation':          'Post Processing',
    'Merging The Output Files':         'Post Processing',
    'Report':                           'Ungrouped',
    'Mail Engagement':                  'Ungrouped',
    'Service Now':                      'Ungrouped',
    'Admin':                            'Ungrouped',
    'Runs The Client Services Program': 'Management',
}

def normalise_name(name):
    if pd.isna(name) or str(name).strip() == '':
        return None
    name = re.sub(r'\s+', ' ', str(name)).strip()
    return NAME_ALIASES.get(name.lower(), name)

def normalise_skill(skill):
    s = str(skill).strip().lower()
    return SKILL_MAP.get(s, str(skill).strip().title())

def normalise_role(role):
    r = str(role).strip().lower()
    mapped = ROLE_MAP.get(r, str(role).strip())
    # Title case fix
    if mapped == mapped.lower():
        mapped = mapped.title()
    return mapped

def get_role_category(role):
    return ROLE_CATEGORY_MAP.get(role, 'Ungrouped')

def derive_level(title):
    if pd.isna(title):
        return 'Analyst'
    t = str(title).strip()
    if 'Head' in t:
        return 'Head'
    if 'Sr' in t or 'Senior' in t:
        return 'Senior'
    return 'Analyst'

def derive_is_assigned(client_raw):
    if pd.isna(client_raw) or str(client_raw).strip() == '':
        return 'Unassigned'
    if str(client_raw).strip().lower() == 'all':
        return 'Management'
    return 'Deployed'

def derive_tenure_band(months):
    try:
        m = float(months)
    except (ValueError, TypeError):
        m = 0
    if m < 3:
        return '0-3 months'
    if m < 12:
        return '3-12 months'
    if m < 24:
        return '1-2 years'
    if m < 48:
        return '2-4 years'
    return '4+ years'

def normalise_location(loc):
    if pd.isna(loc) or str(loc).strip() == '':
        return 'Unknown'
    l = str(loc).strip()
    # Fix known variants
    fixes = {
        'pune(lonavla)':  'Pune',
        'baramarti':      'Baramati',
        'baramati':       'Baramati',
        'pune':           'Pune',
        'nashik':         'Nashik',
        'latur':          'Latur',
        'amravati':       'Amravati',
        'akluj':          'Akluj',
        'jalgaon':        'Jalgaon',
        'phaltan':        'Phaltan',
        'yavatmal':       'Yavatmal',
        'shegaon':        'Shegaon',
        'bhubaneswar':    'Bhubaneswar',
    }
    return fixes.get(l.lower(), l.title())

def normalise_client(client):
    if pd.isna(client) or str(client).strip() == '':
        return ''
    c = str(client).strip()
    fixes = {
        'sutroBio':                 'Sutro Bio',
        'sutrobio':                 'Sutro Bio',
        'sutro bio':                'Sutro Bio',
        'genetix bio':              'Genetix Biotherapeutics',
        'genetix':                  'Genetix Biotherapeutics',
        'genetix biotherapeutics':  'Genetix Biotherapeutics',
        'jazz':                     'Jazz',
        'vaxcyte':                  'Vaxcyte',
        'regeneron':                'Regeneron',
        'incyte':                   'Incyte',
    }
    return fixes.get(c.lower(), c)

def clean_excel(filepath):
    """
    Master cleaning function.
    Reads all relevant sheets and returns cleaned DataFrames.
    """
    print(f"[cleaner] Reading file: {filepath}")
    xl = pd.ExcelFile(filepath)
    sheets = xl.sheet_names
    print(f"[cleaner] Sheets found: {sheets}")

    result = {
        'employees': [],
        'clients':   [],
        'roles':     [],
        'skills':    [],
        'shifts':    [],
        'leads':     [],
        'projects':  [],
        'errors':    []
    }

    # ── TEAM MASTER ─────────────────────────────────────────────────────────
    tm_sheet = next((s for s in sheets if 'master' in s.lower()), None)
    if not tm_sheet:
        result['errors'].append('Team_master sheet not found')
        return result

    tm = pd.read_excel(filepath, sheet_name=tm_sheet)
    tm.columns = [str(c).strip() for c in tm.columns]
    tm = tm.dropna(how='all')

    # Map column names flexibly
    col_map = {}
    for col in tm.columns:
        cl = col.lower().strip()
        if 'name' in cl and 'manager' not in cl and 'reporting' not in cl:
            col_map['name'] = col
        elif 'title' in cl:
            col_map['title'] = col
        elif 'client' in cl:
            col_map['client_raw'] = col
        elif 'tenure' in cl:
            col_map['tenure'] = col
        elif 'location' in cl:
            col_map['location'] = col
        elif 'reporting' in cl and 'manager' in cl:
            col_map['reporting_manager'] = col
        elif 'reporting' in cl and 'to' in cl:
            col_map['reporting_to'] = col
        elif 'german' in cl:
            col_map['german'] = col

    for _, row in tm.iterrows():
        name = normalise_name(row.get(col_map.get('name', 'Name'), None))
        if not name:
            continue

        title = str(row.get(col_map.get('title', 'Title'), '')).strip()
        client_raw = str(row.get(col_map.get('client_raw', 'Client'), '')).strip()
        tenure_raw = row.get(col_map.get('tenure', 'Tenure_Months'), 0)

        try:
            tenure = float(tenure_raw) if not pd.isna(tenure_raw) else 0.0
        except (ValueError, TypeError):
            tenure = 0.0

        location = normalise_location(row.get(col_map.get('location', 'Location'), ''))
        reporting_manager = str(row.get(col_map.get('reporting_manager', ''), '')).strip()
        reporting_to = str(row.get(col_map.get('reporting_to', ''), '')).strip()
        german = str(row.get(col_map.get('german', 'German_Knowledge'), 'No')).strip()
        if german.lower() not in ['yes', 'no']:
            german = 'No'

        result['employees'].append({
            'name':                name,
            'title':               title,
            'level':               derive_level(title),
            'client_raw':          client_raw,
            'tenure_months':       tenure,
            'tenure_months_clean': round(tenure),
            'location':            location,
            'reporting_manager':   reporting_manager,
            'reporting_to':        reporting_to,
            'german_knowledge':    german,
            'is_assigned':         derive_is_assigned(client_raw),
            'tenure_band':         derive_tenure_band(tenure),
        })

    # ── EMPLOYEE CLIENTS ────────────────────────────────────────────────────
    ec_sheet = next((s for s in sheets if 'client' in s.lower() and 'employee' in s.lower()), None)
    if ec_sheet:
        ec = pd.read_excel(filepath, sheet_name=ec_sheet)
        ec.columns = [str(c).strip() for c in ec.columns]
        ec = ec.dropna(how='all')
        name_col = next((c for c in ec.columns if 'name' in c.lower()), ec.columns[0])
        client_col = next((c for c in ec.columns if 'client' in c.lower()), ec.columns[1])
        for _, row in ec.iterrows():
            name = normalise_name(row[name_col])
            client = normalise_client(row[client_col])
            if name and client and client.lower() not in ['all', 'nan', '']:
                result['clients'].append({'name': name, 'client': client})
    else:
        # Fall back to splitting client_raw from master
        for emp in result['employees']:
            cr = emp['client_raw']
            if cr and cr.lower() not in ['all', '']:
                for c in cr.split(','):
                    c = normalise_client(c.strip())
                    if c:
                        result['clients'].append({'name': emp['name'], 'client': c})

    # ── EMPLOYEE ROLES ──────────────────────────────────────────────────────
    er_sheet = next((s for s in sheets if 'role' in s.lower() and 'employee' in s.lower()), None)
    if er_sheet:
        er = pd.read_excel(filepath, sheet_name=er_sheet)
        er.columns = [str(c).strip() for c in er.columns]
        er = er.dropna(how='all')
        name_col = next((c for c in er.columns if 'name' in c.lower()), er.columns[0])
        role_col = next((c for c in er.columns if 'role' in c.lower()), er.columns[1])
        for _, row in er.iterrows():
            name = normalise_name(row[name_col])
            role = normalise_role(str(row[role_col]).strip())
            if name and role and role.lower() != 'nan':
                result['roles'].append({
                    'name':     name,
                    'role':     role,
                    'category': get_role_category(role)
                })

    # ── EMPLOYEE SKILLS ─────────────────────────────────────────────────────
    es_sheet = next((s for s in sheets if 'skill' in s.lower()), None)
    if es_sheet:
        es = pd.read_excel(filepath, sheet_name=es_sheet)
        es.columns = [str(c).strip() for c in es.columns]
        es = es.dropna(how='all')
        name_col = next((c for c in es.columns if 'name' in c.lower()), es.columns[0])
        skill_col = next((c for c in es.columns if 'skill' in c.lower()), es.columns[1])
        for _, row in es.iterrows():
            name = normalise_name(row[name_col])
            skill = normalise_skill(str(row[skill_col]).strip())
            if name and skill and skill.lower() not in ['nan', '']:
                result['skills'].append({'name': name, 'skill': skill})

    # ── WORKING SHIFTS ──────────────────────────────────────────────────────
    ws_sheet = next((s for s in sheets if 'shift' in s.lower() or 'working' in s.lower()), None)
    if ws_sheet:
        ws = pd.read_excel(filepath, sheet_name=ws_sheet)
        ws.columns = [str(c).strip() for c in ws.columns]
        ws = ws.dropna(how='all')
        name_col = next((c for c in ws.columns if 'member' in c.lower() or 'name' in c.lower()), ws.columns[0])
        reg_col  = next((c for c in ws.columns if 'regular' in c.lower()), None)
        us_col   = next((c for c in ws.columns if 'us' in c.lower() and 'shift' in c.lower()), None)
        wk_col   = next((c for c in ws.columns if 'weekend' in c.lower()), None)

        for _, row in ws.iterrows():
            name = normalise_name(row[name_col])
            if not name:
                continue
            def parse_bool(val):
                if pd.isna(val):
                    return 0
                if isinstance(val, bool):
                    return 1 if val else 0
                return 1 if str(val).strip().lower() in ['true', 'yes', '1'] else 0

            result['shifts'].append({
                'name':          name,
                'regular_shift': parse_bool(row[reg_col])  if reg_col else 1,
                'us_shift':      parse_bool(row[us_col])   if us_col  else 0,
                'weekend_shift': parse_bool(row[wk_col])   if wk_col  else 0,
            })

    # ── PROJECT DISTRIBUTION ────────────────────────────────────────────────
    pd_sheet = next((s for s in sheets if 'project' in s.lower() and 'dist' in s.lower()), None)
    # # ── PROJECT DISTRIBUTION ────────────────────────────────────────────────────
    # pd_sheet = next((s for s in sheets if 'project' in s.lower() and 'dist' in s.lower()), None)
    if pd_sheet:
        pds = pd.read_excel(filepath, sheet_name=pd_sheet)
        pds.columns = [str(c).strip() for c in pds.columns]
        pds = pds.dropna(how='all')

        # Find the right columns flexibly
        proj_col = next((c for c in pds.columns if 'project' in c.lower()), None)
        prim_col = next((c for c in pds.columns if 'primary' in c.lower()), None)
        sec_col  = next((c for c in pds.columns if 'secondary' in c.lower()), None)

        if proj_col and prim_col:
            for _, row in pds.iterrows():
                proj = str(row[proj_col]).strip()
                prim = str(row[prim_col]).strip() if prim_col else ''
                sec  = str(row[sec_col]).strip()  if sec_col  else ''

                # Skip header rows and empty rows
                if not proj or proj.lower() in ['nan', 'project', 'sr. no.', '']:
                    continue
                if proj.replace('.','').strip().isdigit():
                    continue

                # Normalise client name to match employee_clients
                proj = normalise_client(proj)
                prim = normalise_name(prim) if prim and prim.lower() != 'nan' else ''
                sec  = normalise_name(sec)  if sec  and sec.lower()  != 'nan' else ''

                if proj:
                    result['projects'].append({
                        'project':       proj,
                        'primary_lead':  prim or '',
                        'secondary_lead':sec  or '',
                    })

    # ── TEAM LEADS ──────────────────────────────────────────────────────────
    tl_sheet = next((s for s in sheets if 'lead' in s.lower() or 'team lead' in s.lower()), None)
    if tl_sheet:
        tl = pd.read_excel(filepath, sheet_name=tl_sheet)
        tl.columns = [str(c).strip() for c in tl.columns]
        tl = tl.dropna(how='all')
        for _, row in tl.iterrows():
            lead = normalise_name(str(row.iloc[0]).strip()) if len(row) > 0 else ''
            proj = str(row.iloc[1]).strip() if len(row) > 1 else ''
            if lead and proj and proj.lower() != 'nan':
                result['leads'].append({'lead_name': lead, 'project': proj})

    print(f"[cleaner] Cleaned: {len(result['employees'])} employees, "
          f"{len(result['clients'])} client records, "
          f"{len(result['roles'])} role records, "
          f"{len(result['skills'])} skill records")
    return result