# SEO Rank Tracker - User Guide

## Daily Workflow

### 1. Login
- URL: `http://localhost:8501` (or your deployed URL)
- Password: `admin123` (change in Settings!)

### 2. Check Rankings

**Weekly Rank Check:**
1. Go to **Rank Checker** page
2. Select projects to check (start with 2-3)
3. Choose API: **Serper.dev** (recommended)
4. Review cost estimate
5. Click **"Start Checking"**
6. Wait for completion (progress bar shows status)
7. View results in **Dashboard** or **Keywords** page

**Cost:** ~$0.001 per keyword (e.g., 100 keywords = $0.10)

### 3. Add New Keywords

1. Go to **Keywords** page
2. Select project
3. Click **"Add Keywords"** tab
4. Paste keywords (one per line)
5. Click **"Add Keywords"**

### 4. View Analytics

**Dashboard:**
- Total keywords
- Average position
- Top 10 count
- Improved/declined rankings
- Ranking distribution chart
- Position trends

**Keywords Page:**
- Detailed ranking data
- Current vs previous rank
- Best rank ever
- Change indicators
- URL ranking

### 5. Export Data

**Option 1: CSV Export**
1. Go to **Keywords** page
2. Click **"Import/Export"** tab
3. Click **"Download CSV"**

**Option 2: Google Sheets Sync**
1. Go to **Keywords** page
2. Click **"Sync to Google Sheets"** button
3. Share the Google Sheet link with your team

---

## Project Management

### Create New Project

1. Go to **Projects** page
2. Click **"Create New Project"** tab
3. Fill in:
   - Project name (e.g., "Acme Corp - USA")
   - Website URL (e.g., "acme.com")
   - Target location (e.g., "United States")
   - Update frequency (daily/weekly/monthly)
4. Check **"Create Google Sheet automatically"** (if configured)
5. Click **"Create Project"**

### Edit Project

1. Go to **Projects** page
2. Find the project
3. Click **"Edit"** button
4. Update details
5. Click **"Save Changes"**

---

## Understanding Rankings

### Ranking Differences

**Normal variance:** ±2-5 positions between:
- Different APIs
- Manual searches
- Different times of day
- Different locations

**Why?**
- Google personalizes results
- Multiple data centers
- Location differences
- Device differences (mobile/desktop)

### What to Track

✅ **Focus on:**
- Overall trends (up or down)
- Top 10 placement
- Month-over-month changes
- Competitor comparisons

❌ **Don't worry about:**
- Exact position (5 vs 7)
- Daily fluctuations
- Small variances between APIs

---

## Best Practices

### Checking Frequency

| Project Type | Check Frequency |
|-------------|-----------------|
| Active campaigns | Weekly |
| Maintenance | Monthly |
| New sites | Daily (first month) |
| Seasonal | Before/during season |

### Cost Management

- Check only active projects
- Combine multiple projects in one session
- Use CSV import for bulk keyword adding
- Archive old/inactive projects

### Accuracy Tips

1. **Use same API** for consistency
2. **Check same day/time** each week
3. **Track trends** not exact numbers
4. **Compare to yourself** over time

---

## Troubleshooting

### No Rankings Showing

**Possible causes:**
1. No keywords added → Add keywords first
2. Haven't run rank check → Go to Rank Checker
3. API error → Check Settings > Sync Log

### API Errors

1. Check API credentials in Settings
2. Verify API account has credits
3. Test connection in Settings
4. Check Sync Log for details

### Google Sheets Not Syncing

1. Verify service account JSON uploaded
2. Test connection in Settings
3. Check project has Google Sheet linked
4. Review Sync Log for errors

### Duplicate Keywords

**If you see duplicate rows:**
1. Each check creates a new record
2. View shows latest ranking only
3. All history preserved in database
4. Export shows one row per keyword

---

## Data Management

### Backup Data

**Database location:**
`D:\Projects\seo-rank-tracker\data\seo_tracker.db`

**To backup:**
1. Stop the application
2. Copy `seo_tracker.db` file
3. Store in safe location
4. Restart application

### Clean Old Data

**Via Sync Log:**
1. Go to Settings > Sync Log
2. Click "Clear All Logs" (optional)

**Note:** Ranking history is preserved automatically

---

## Security

### Change Password

1. Go to **Settings** > **App Settings**
2. Enter current password: `admin123`
3. Enter new password (min 6 characters)
4. Confirm new password
5. Click **"Change Password"**

### API Key Safety

- API keys stored in database (encrypted)
- Not visible in exports
- Only accessible via Settings page
- Change regularly for security

---

## Support

### Getting Help

1. Check **Settings** > **Sync Log** for errors
2. Review this guide
3. Check QUICKSTART.md for setup help
4. Contact your administrator

### Common Questions

**Q: Why do rankings differ from manual search?**
A: Google personalizes results. APIs show non-personalized rankings from different locations/data centers. This is normal.

**Q: How often should I check rankings?**
A: Weekly for active campaigns, monthly for maintenance.

**Q: Can multiple people use this?**
A: Yes, just share the URL. All users share same password (consider deployment for multi-user with different passwords).

**Q: What if I run out of API credits?**
A: Add credits to your API account (Serper/DataForSEO/ScrapingRobot) or switch to another API.

---

## Tips & Tricks

### Bulk Operations

- **Import 100s of keywords:** Use CSV import
- **Check multiple projects:** Select all in Rank Checker
- **Export all data:** Use CSV export feature

### Keyword Discovery

- Use **Search Console** to find new opportunities
- Look for high-impression, low-CTR queries
- Add successful GSC queries to keyword list

### Reporting

- Share Google Sheets with clients (read-only)
- Export CSV for custom reports
- Screenshot Dashboard for quick updates

### Efficiency

- Create naming convention for projects
- Use project tags in names (e.g., "Client - Country")
- Archive completed/paused projects
- Bulk add keywords before rank checking

---

**Last Updated:** 2026-01-03
**Version:** 1.0
