# PASTE THIS ENTIRE PROMPT INTO CLAUDE CODE

Build a complete SEO Rank Tracker web application using Streamlit (Python). This is a full-featured application with UI, database, and Google Sheets integration.

## CRITICAL REQUIREMENTS

1. **Tech Stack**: Streamlit + SQLite + Google Sheets API + SERP APIs
2. **This is a WEB APPLICATION** - team members will access via browser URL
3. **All data syncs bidirectionally with Google Sheets** (clients view their data in Sheets)
4. **Password-protected admin panel**

## FEATURES TO BUILD

### 1. Dashboard Page
- Overview metrics: Total keywords, Average rank, Keywords in Top 10, Improved/Declined counts
- Ranking distribution chart (positions 1-3, 4-10, 11-20, 21-50, 51-100, Not ranked)
- Trend line chart showing average position over time
- Top movers table (biggest rank changes)
- Project filter dropdown

### 2. Projects Page
- List all projects with: name, URL, location, keyword count, last check date
- **Create new project**: Auto-creates a new Google Sheet with tabs (Keywords, Ranking History, GSC Queries, Summary)
- Edit project details
- Delete project (with confirmation)
- Quick actions: View Sheet link, Sync Now, Check Ranks

### 3. Keywords Page
- View all keywords for selected project in a table
- Columns: Keyword, Current Rank, Previous Rank, Change (with color indicators), Best Rank, URL Ranking
- Add keywords (single or bulk paste, one per line)
- Import from CSV
- Delete keywords (single or bulk select)
- Sync changes to Google Sheet button
- Export to CSV

### 4. Search Console Page
- Connect to Google Search Console API
- Fetch queries for project's website
- **New Discoveries tab**: Queries getting traffic but NOT in keyword list (with "Add to Keywords" button)
- **Opportunities tab**: High impressions but low CTR (<2%) or poor position (>10)
- **Top Performers tab**: Highest clicks/impressions
- Date range selector

### 5. Rank Checker Page
- Checkbox list to select which projects to check
- API provider dropdown (Serper/DataForSEO/ScrapingRobot)
- Show estimated cost and time
- Start button with real-time progress bar
- Log of recent rank checks
- Auto-sync results to Google Sheets after completion

### 6. Settings Page
- API key inputs for: Serper, DataForSEO, ScrapingRobot
- Test connection buttons for each API
- Google Service Account JSON upload
- Google Search Console OAuth connect
- Default SERP API selector
- App password change
- Sync log viewer

## DATABASE SCHEMA (SQLite)

```sql
-- Projects table
CREATE TABLE projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    target_location TEXT NOT NULL,
    google_sheet_id TEXT,
    google_sheet_url TEXT,
    gsc_property TEXT,
    update_frequency TEXT DEFAULT 'monthly',
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Keywords table
CREATE TABLE keywords (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    keyword TEXT NOT NULL,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    UNIQUE(project_id, keyword)
);

-- Rankings table
CREATE TABLE rankings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    keyword_id INTEGER NOT NULL,
    position INTEGER,
    previous_position INTEGER,
    url_found TEXT,
    checked_at DATE NOT NULL,
    api_used TEXT,
    FOREIGN KEY (keyword_id) REFERENCES keywords(id) ON DELETE CASCADE
);

-- GSC Queries table
CREATE TABLE gsc_queries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    query TEXT NOT NULL,
    clicks INTEGER DEFAULT 0,
    impressions INTEGER DEFAULT 0,
    ctr REAL DEFAULT 0,
    position REAL DEFAULT 0,
    date_range_start DATE,
    date_range_end DATE,
    fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Settings table
CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT
);

-- Sync log table
CREATE TABLE sync_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER,
    sync_type TEXT,
    status TEXT,
    message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
);
```

## API INTEGRATIONS

### Serper.dev
```python
import requests

def check_rank_serper(keyword: str, location: str, target_domain: str, api_key: str) -> dict:
    response = requests.post(
        "https://google.serper.dev/search",
        headers={"X-API-KEY": api_key, "Content-Type": "application/json"},
        json={"q": keyword, "location": location, "num": 100}
    )
    data = response.json()
    
    for item in data.get("organic", []):
        if target_domain in item.get("link", ""):
            return {"position": item["position"], "url": item["link"]}
    
    return {"position": None, "url": None}  # Not in top 100
```

### DataForSEO
```python
import requests
from requests.auth import HTTPBasicAuth

def check_rank_dataforseo(keyword: str, location: str, target_domain: str, username: str, password: str) -> dict:
    response = requests.post(
        "https://api.dataforseo.com/v3/serp/google/organic/live/advanced",
        auth=HTTPBasicAuth(username, password),
        json=[{"keyword": keyword, "location_name": location, "language_name": "English", "depth": 100}]
    )
    data = response.json()
    
    items = data.get("tasks", [{}])[0].get("result", [{}])[0].get("items", [])
    for item in items:
        if target_domain in item.get("url", ""):
            return {"position": item["rank_absolute"], "url": item["url"]}
    
    return {"position": None, "url": None}
```

### ScrapingRobot
```python
import requests
from bs4 import BeautifulSoup
from urllib.parse import quote_plus

def check_rank_scrapingrobot(keyword: str, location: str, target_domain: str, api_key: str) -> dict:
    # Map location to Google country code
    location_codes = {"India": "in", "USA": "us", "Global / US": "us", ...}
    gl = location_codes.get(location, "us")
    
    google_url = f"https://www.google.com/search?q={quote_plus(keyword)}&num=100&gl={gl}"
    
    response = requests.get(
        "https://api.scrapingrobot.com/",
        params={"token": api_key, "url": google_url, "render": "false"}
    )
    
    soup = BeautifulSoup(response.text, "html.parser")
    # Parse organic results and find target domain position
    # ... parsing logic
```

### Google Sheets
```python
import gspread
from google.oauth2.service_account import Credentials

SCOPES = [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive'
]

def get_sheets_client(credentials_path: str):
    creds = Credentials.from_service_account_file(credentials_path, scopes=SCOPES)
    return gspread.authorize(creds)

def create_project_sheet(client, project_name: str) -> tuple[str, str]:
    """Create new sheet with required tabs, return (sheet_id, sheet_url)"""
    sheet = client.create(f"SEO Rankings - {project_name}")
    
    # Create tabs
    sheet.add_worksheet("Keywords", rows=1000, cols=10)
    sheet.add_worksheet("Ranking History", rows=1000, cols=50)
    sheet.add_worksheet("GSC Queries", rows=1000, cols=10)
    sheet.add_worksheet("Summary", rows=20, cols=5)
    
    # Delete default Sheet1
    sheet.del_worksheet(sheet.sheet1)
    
    # Set up headers
    keywords_ws = sheet.worksheet("Keywords")
    keywords_ws.update("A1:G1", [["Keyword", "Current Rank", "Previous Rank", "Change", "Best Rank", "URL Ranking", "Last Checked"]])
    
    return sheet.id, sheet.url

def sync_rankings_to_sheet(client, sheet_id: str, rankings_data: list):
    """Push ranking data to Google Sheet"""
    sheet = client.open_by_key(sheet_id)
    ws = sheet.worksheet("Keywords")
    
    # Clear existing data (keep headers)
    ws.batch_clear(["A2:G1000"])
    
    # Write new data
    if rankings_data:
        ws.update(f"A2:G{len(rankings_data)+1}", rankings_data)
```

### Google Search Console
```python
from googleapiclient.discovery import build
from google.oauth2.credentials import Credentials

def get_gsc_queries(credentials, site_url: str, start_date: str, end_date: str) -> list:
    service = build('searchconsole', 'v1', credentials=credentials)
    
    response = service.searchanalytics().query(
        siteUrl=site_url,
        body={
            'startDate': start_date,
            'endDate': end_date,
            'dimensions': ['query'],
            'rowLimit': 1000
        }
    ).execute()
    
    return [{
        'query': row['keys'][0],
        'clicks': row['clicks'],
        'impressions': row['impressions'],
        'ctr': row['ctr'],
        'position': row['position']
    } for row in response.get('rows', [])]
```

## PROJECT STRUCTURE

```
D:\seo-rank-tracker\
├── app.py                      # Main Streamlit app with multipage setup
├── requirements.txt
├── config.py
├── .env
│
├── database/
│   ├── __init__.py
│   ├── db.py                   # SQLite connection, table creation
│   └── models.py               # CRUD operations
│
├── services/
│   ├── __init__.py
│   ├── serp_api.py             # Serper, DataForSEO, ScrapingRobot
│   ├── google_sheets.py        # Sheets operations
│   ├── search_console.py       # GSC integration
│   └── rank_checker.py         # Orchestrates rank checking
│
├── pages/
│   ├── 1_📊_Dashboard.py
│   ├── 2_📁_Projects.py
│   ├── 3_🔑_Keywords.py
│   ├── 4_📈_Search_Console.py
│   ├── 5_📅_Rank_Checker.py
│   └── 6_⚙️_Settings.py
│
├── components/
│   ├── __init__.py
│   ├── charts.py
│   ├── tables.py
│   └── auth.py                 # Password protection
│
├── data/
│   └── seo_tracker.db          # SQLite database
│
└── credentials/
    └── google_service_account.json
```

## REQUIREMENTS.TXT

```
streamlit>=1.28.0
pandas>=2.0.0
plotly>=5.15.0
gspread>=5.10.0
google-api-python-client>=2.100.0
google-auth>=2.22.0
google-auth-oauthlib>=1.0.0
requests>=2.31.0
beautifulsoup4>=4.12.0
python-dotenv>=1.0.0
tenacity>=8.2.0
```

## INITIAL PROJECTS TO SEED (Import these on first run)

```python
INITIAL_PROJECTS = [
    {"name": "Hardcastle Petrofer", "url": "hawcoindia.com", "location": "India", "keywords": 58},
    {"name": "Jekson - Argentina", "url": "jeksonvision.com", "location": "Argentina", "keywords": 76},
    {"name": "Jekson - Brazil", "url": "jeksonvision.com", "location": "Brasil", "keywords": 76},
    {"name": "Jekson - Canada", "url": "jeksonvision.com", "location": "Canada", "keywords": 76},
    {"name": "Jekson - France", "url": "jeksonvision.com", "location": "France", "keywords": 76},
    {"name": "Jekson - Germany", "url": "jeksonvision.com", "location": "Germany", "keywords": 76},
    {"name": "Jekson - Kenya", "url": "jeksonvision.com", "location": "Kenya", "keywords": 76},
    {"name": "Jekson - Nigeria", "url": "jeksonvision.com", "location": "Nigeria", "keywords": 76},
    {"name": "Jekson - Switzerland", "url": "jeksonvision.com", "location": "Switzerland", "keywords": 76},
    {"name": "Jekson Vision", "url": "jeksonvision.com", "location": "Global / US", "keywords": 75},
    {"name": "Jekson Vision - India", "url": "jeksonvision.com", "location": "India", "keywords": 74},
    {"name": "Jekson Vision - Italy 1", "url": "jeksonvision.com", "location": "Italia", "keywords": 76},
    {"name": "Organica - India", "url": "organicabiotech.com", "location": "India", "keywords": 57},
    {"name": "Organica - New Keywords", "url": "organicabiotech.com", "location": "India", "keywords": 32},
    {"name": "Organica Biotech - Wastewater Treatment", "url": "organicabiotech.com", "location": "India", "keywords": 19},
    {"name": "Veeda Lifesciences", "url": "veedalifesciences.com", "location": "India", "keywords": 61},
    {"name": "Veeda Lifesciences - Bangladesh", "url": "veedalifesciences.com", "location": "Bangladesh", "keywords": 61},
    {"name": "Veeda Lifesciences - Belgium", "url": "veedalifesciences.com", "location": "Belgium", "keywords": 61},
    {"name": "Veeda Lifesciences - China", "url": "veedalifesciences.com", "location": "Global / US", "keywords": 61},
    {"name": "Veeda Lifesciences - Denmark", "url": "veedalifesciences.com", "location": "Denmark", "keywords": 61},
    {"name": "Veeda Lifesciences - France", "url": "veedalifesciences.com", "location": "France", "keywords": 61},
    {"name": "Veeda Lifesciences - Germany", "url": "veedalifesciences.com", "location": "Germany", "keywords": 61},
    {"name": "Veeda Lifesciences - Greece", "url": "veedalifesciences.com", "location": "Greece", "keywords": 61},
    {"name": "Veeda Lifesciences - Italy", "url": "veedalifesciences.com", "location": "Italia", "keywords": 61},
    {"name": "Veeda Lifesciences - Malaysia", "url": "veedalifesciences.com", "location": "Malaysia", "keywords": 61},
    {"name": "Veeda Lifesciences - Netherland", "url": "veedalifesciences.com", "location": "Netherlands", "keywords": 61},
    {"name": "Veeda Lifesciences - Oman", "url": "veedalifesciences.com", "location": "Oman", "keywords": 61},
    {"name": "Veeda Lifesciences - Spain", "url": "veedalifesciences.com", "location": "Spain", "keywords": 61},
    {"name": "Veeda Lifesciences - Switzerland", "url": "veedalifesciences.com", "location": "Switzerland", "keywords": 61},
    {"name": "Veeda Lifesciences - Taiwan", "url": "veedalifesciences.com", "location": "Taiwan", "keywords": 61},
    {"name": "Veeda Lifesciences - UAE", "url": "veedalifesciences.com", "location": "UAE", "keywords": 61},
    {"name": "Veeda Lifesciences - USA", "url": "veedalifesciences.com", "location": "Global / US", "keywords": 61},
    {"name": "Vertex", "url": "vertexcs.com", "location": "Global / US", "keywords": 93},
    {"name": "Vertex - New Keywords - USA", "url": "vertexcs.com", "location": "Global / US", "keywords": 35},
    {"name": "Zydus", "url": "zyduslife.com", "location": "India", "keywords": 228, "update_frequency": "weekly"},
]
```

## BUILD INSTRUCTIONS

1. Create all folders and files in the structure above
2. Start with database/db.py - set up SQLite and create all tables
3. Build database/models.py - CRUD functions for all tables
4. Build services/serp_api.py - all three API integrations
5. Build services/google_sheets.py - create, read, write sheets
6. Build services/search_console.py - GSC API
7. Build components/auth.py - simple password auth
8. Build each page in pages/ folder
9. Build main app.py with Streamlit multipage setup
10. Test each component as you build

## IMPORTANT NOTES

- Use Streamlit's native session_state for authentication
- Use st.data_editor for editable tables
- Use plotly for all charts
- Add 1-2 second delays between SERP API calls
- Show progress bars for long operations
- All errors should be logged to sync_log table
- Test API connections before saving keys

Now build this application step by step. Start by creating the project structure and requirements.txt, then proceed through each component.
