# SEO Rank Tracker

A comprehensive web application for tracking and analyzing SEO rankings across multiple projects and locations, built with Streamlit and Python.

## Features

- **Multi-Project Management**: Track rankings for multiple websites across different locations
- **Multiple SERP APIs**: Support for Serper.dev, DataForSEO, and ScrapingRobot
- **Google Sheets Integration**: Bidirectional sync with Google Sheets for easy sharing
- **Google Search Console**: Discover new keyword opportunities from GSC data
- **Interactive Dashboard**: Visual analytics with charts and metrics
- **Ranking History**: Track ranking changes over time
- **Bulk Operations**: Import/export keywords, bulk rank checking
- **Password Protected**: Secure admin panel

## Installation

1. **Install Python dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

2. **Set up the database**:
   The database will be automatically initialized on first run.

## Configuration

### 1. API Keys

Configure at least one SERP API in the Settings page:

- **Serper.dev**: Get API key from [serper.dev](https://serper.dev)
- **DataForSEO**: Get credentials from [dataforseo.com](https://dataforseo.com)
- **ScrapingRobot**: Get API key from [scrapingrobot.com](https://scrapingrobot.com)

### 2. Google Sheets (Optional)

To enable Google Sheets integration:

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project
3. Enable Google Sheets API and Google Drive API
4. Create a service account
5. Download the JSON key file
6. Upload it in Settings > Google Sheets

### 3. Google Search Console (Optional)

GSC integration requires OAuth setup. See Settings > Search Console for details.

## Running the Application

Start the Streamlit app:

```bash
streamlit run app.py
```

The application will open in your browser at `http://localhost:8501`

**Default login password**: `admin123` (change this in Settings!)

## Project Structure

```
seo-rank-tracker/
├── app.py                      # Main application entry point
├── config.py                   # Configuration settings
├── requirements.txt            # Python dependencies
│
├── database/                   # Database layer
│   ├── db.py                   # SQLite connection & setup
│   └── models.py               # CRUD operations
│
├── services/                   # Business logic
│   ├── serp_api.py            # SERP API integrations
│   ├── google_sheets.py       # Google Sheets operations
│   ├── search_console.py      # GSC integration
│   └── rank_checker.py        # Rank checking orchestration
│
├── components/                 # UI components
│   ├── auth.py                # Authentication
│   ├── charts.py              # Plotly charts
│   └── tables.py              # Table displays
│
├── pages/                      # Streamlit pages
│   ├── 1_📊_Dashboard.py
│   ├── 2_📁_Projects.py
│   ├── 3_🔑_Keywords.py
│   ├── 4_📈_Search_Console.py
│   ├── 5_📅_Rank_Checker.py
│   └── 6_⚙️_Settings.py
│
├── data/                       # SQLite database
│   └── seo_tracker.db
│
└── credentials/                # API credentials
    └── google_service_account.json
```

## Usage Guide

### 1. Set Up Projects

- Initial projects are seeded automatically
- Go to **Projects** page to create new projects or edit existing ones
- Optionally create Google Sheets for each project

### 2. Add Keywords

- Navigate to **Keywords** page
- Select a project
- Add keywords manually, in bulk, or import from CSV
- Keywords can also be discovered from Google Search Console

### 3. Check Rankings

- Go to **Rank Checker** page
- Select projects to check
- Choose SERP API provider
- Review cost and time estimates
- Click "Start Checking"
- Results automatically sync to Google Sheets

### 4. View Analytics

- **Dashboard**: Overview metrics, ranking distribution, trends, top movers
- **Keywords**: Detailed ranking data with change indicators
- **Search Console**: Discover new opportunities, analyze CTR and positions

## Features by Page

### Dashboard
- Total keywords, average position, top 10 count
- Improved/declined rankings count
- Ranking distribution chart
- Average position trend over time
- Top movers table

### Projects
- List all projects with details
- Create new projects with automatic Google Sheet creation
- Edit project settings
- Delete projects

### Keywords
- View all keywords with current/previous ranks
- Add keywords (single or bulk)
- Import from CSV, export to CSV
- Sync to Google Sheets
- Bulk delete

### Search Console
- Fetch queries from GSC
- New discoveries (queries not in keyword list)
- Opportunities (low CTR or poor position)
- Top performers
- Add GSC queries to keyword list

### Rank Checker
- Select multiple projects to check
- Choose API provider
- View cost and time estimates
- Real-time progress tracking
- Automatic Google Sheets sync
- Rank check history log

### Settings
- Configure SERP API credentials
- Upload Google Sheets service account
- Connect Google Search Console
- Change app password
- View sync logs

## Initial Projects

The application comes pre-seeded with 35 projects across multiple domains:
- Hardcastle Petrofer
- Jekson Vision (multiple countries)
- Organica Biotech
- Veeda Lifesciences (multiple countries)
- Vertex
- Zydus

You can edit or delete these and add your own projects.

## Database

The application uses SQLite with the following tables:
- **projects**: Project information
- **keywords**: Keywords per project
- **rankings**: Historical ranking data
- **gsc_queries**: Google Search Console queries
- **settings**: Application settings
- **sync_log**: Activity and error logs

## Security

- Password-protected admin panel
- API keys stored in database settings
- Service account credentials stored locally
- All pages require authentication

## Troubleshooting

**Database errors**: Delete `data/seo_tracker.db` and restart the app to reinitialize

**API errors**: Check your API credentials in Settings and test connections

**Google Sheets errors**: Ensure service account has access to your Google Drive

**Import errors**: Make sure CSV files have a 'keyword' column

## Technologies Used

- **Streamlit**: Web application framework
- **SQLite**: Local database
- **Pandas**: Data manipulation
- **Plotly**: Interactive charts
- **gspread**: Google Sheets API
- **Google API Client**: Search Console integration
- **Requests**: HTTP client for SERP APIs
- **BeautifulSoup**: HTML parsing

## Support

For issues or questions, check the application logs in Settings > Sync Log.

## License

Built for internal use. All rights reserved.

---

**Version**: 1.0
**Last Updated**: 2026-01-03
