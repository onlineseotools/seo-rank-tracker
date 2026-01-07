# Quick Start Guide

## Getting Started in 5 Minutes

### Step 1: Install Dependencies

```bash
pip install -r requirements.txt
```

### Step 2: Run the Application

```bash
streamlit run app.py
```

The application will open in your browser at `http://localhost:8501`

### Step 3: Login

- **Default Password**: `admin123`
- Change this immediately in Settings!

### Step 4: Configure API (Choose One)

Go to **Settings** > **SERP APIs** and add credentials for at least one API:

#### Option A: Serper.dev (Recommended for beginners)
1. Sign up at [serper.dev](https://serper.dev)
2. Get your API key
3. Paste in Settings and click Save
4. Click "Test Connection"

#### Option B: DataForSEO (Enterprise)
1. Sign up at [dataforseo.com](https://dataforseo.com)
2. Get username and password
3. Enter in Settings and click Save
4. Click "Test Connection"

#### Option C: ScrapingRobot
1. Sign up at [scrapingrobot.com](https://scrapingrobot.com)
2. Get your API key
3. Paste in Settings and click Save
4. Click "Test Connection"

### Step 5: Review Projects

- Go to **Projects** page
- 35 sample projects are already loaded
- You can edit, delete, or add new projects

### Step 6: Add Keywords

1. Go to **Keywords** page
2. Select a project from dropdown
3. Click "Add Keywords" tab
4. Add keywords (one per line or single)
5. Click "Add Keywords"

### Step 7: Check Rankings

1. Go to **Rank Checker** page
2. Check the boxes next to projects you want to check
3. Select your API provider
4. Review the cost estimate
5. Click "Start Checking"
6. Wait for results (progress bar shows status)

### Step 8: View Results

1. Go to **Dashboard** to see overview
2. Or go to **Keywords** to see detailed rankings
3. Click "Sync to Google Sheets" to export (if configured)

## Optional: Google Sheets Integration

### Setup Google Sheets

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project
3. Enable these APIs:
   - Google Sheets API
   - Google Drive API
4. Create a Service Account:
   - Go to IAM & Admin > Service Accounts
   - Click "Create Service Account"
   - Give it a name
   - Click "Create and Continue"
   - Skip granting access
   - Click "Done"
5. Create a key:
   - Click on the service account
   - Go to "Keys" tab
   - Click "Add Key" > "Create New Key"
   - Choose JSON
   - Download the file
6. Upload in app:
   - Go to Settings > Google Sheets
   - Upload the JSON file
   - Click "Test Connection"

### Auto-Create Sheets for Projects

1. Go to **Projects** page
2. For each project, click "Create Sheet" button
3. A Google Sheet will be created automatically
4. Share it with your team (read-only link provided)

## Tips

- **Start small**: Test with 1-2 projects first
- **API costs**: Each keyword check costs ~$0.001-0.0025
- **Check frequency**: Don't check too often (daily max for most projects)
- **Bulk operations**: Use CSV import for many keywords
- **Sync regularly**: Sync to Google Sheets after rank checks

## Troubleshooting

**Can't login?**
- Password is `admin123` (case sensitive)
- Change it in Settings after first login

**API not working?**
- Check credentials in Settings
- Click "Test Connection" button
- Make sure you have credits in your API account

**No data showing?**
- Make sure you've added keywords
- Run a rank check first
- Check Sync Log in Settings for errors

**Google Sheets not syncing?**
- Verify service account JSON is uploaded
- Check "Test Connection" in Settings
- Make sure service account has access to Drive

## Next Steps

- Explore **Search Console** integration to discover new keywords
- Set up regular rank checking schedule
- Customize projects for your specific needs
- Export data to CSV for external analysis

## Support

Check **Settings** > **Sync Log** for detailed error messages and activity history.

---

Happy tracking! 🚀
