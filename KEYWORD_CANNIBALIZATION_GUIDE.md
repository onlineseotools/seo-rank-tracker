# Keyword Cannibalization Admin - Complete Guide

## 🎯 Overview

The **Keyword Cannibalization Admin** is a dedicated tool for tracking and managing cannibalization issues for your **targeted keywords** (keywords you're actively tracking in your keyword list).

---

## 🆕 What's New

### New Page: Keyword Cannibalization (Page 8)
A brand-new admin page specifically designed to:
- Track cannibalization **only for your target keywords**
- Mark cannibalization issues as resolved
- Track resolution progress
- Separate active vs resolved cases

### Database Enhancement
New table: `cannibalization_resolved`
- Tracks which keywords have been fixed
- Stores resolution dates and notes
- Project-specific tracking

### Reset Buttons Added
All admin pages now have **Reset Data** buttons:
- **Search Console** (Page 4)
- **GSC Admin** (Page 7)
- **Keyword Cannibalization** (Page 8)

---

## 🔍 How It's Different from GSC Admin

### GSC Admin (Page 7)
- Shows **ALL queries** from Search Console
- Includes queries you're not tracking
- General cannibalization detection
- 6 different analytics tabs

### Keyword Cannibalization (Page 8) - NEW!
- Shows **ONLY your target keywords**
- Focused cannibalization tracking
- Mark as resolved / Track progress
- Project-specific management

---

## 📖 How to Use

### Step 1: Select Project
1. Choose website from dropdown
2. Select location/variant
3. Configure GSC property (with manual override option)

### Step 2: Set Date Range
- **Quick Presets**: 7 days to 16 months
- **Custom Range**: Pick exact dates

### Step 3: Fetch Data
Click **"Fetch GSC Data"** to load cannibalization analysis

### Step 4: Analyze Cannibalization

The tool will:
1. Fetch GSC data for the selected project
2. Filter to **only your target keywords**
3. Detect which keywords have multiple pages ranking
4. Show detailed metrics for each case

---

## 📊 Understanding the Results

### Metrics Dashboard
- **Target Keywords**: Total keywords in your list
- **Found in GSC**: How many are ranking in Search Console
- **Active Cannibalization**: Keywords with multiple pages (unresolved)
- **Resolved Cases**: Keywords you've marked as fixed

### Three Tabs

#### Tab 1: ⚠️ Active Cannibalization
Shows keywords currently having cannibalization issues:

**For Each Keyword:**
- Number of pages ranking
- Total clicks and impressions
- Best and worst positions
- All competing pages with metrics
- **Mark as Resolved** button

**Example:**
```
🔴 "seo tools" (3 pages) - 150 clicks, 5,000 impressions

Pages Ranking:
- /seo-tools         Position 5    80 clicks
- /blog/seo-tools    Position 12   50 clicks
- /tools             Position 18   20 clicks

💡 Recommendation: Consolidate content to /seo-tools and
   301 redirect competing pages

[Resolution notes: _________________]  [✅ Mark as Resolved]
```

#### Tab 2: ✅ Resolved Cases
Shows keywords you've marked as fixed:

- Resolution date
- Your notes on what you did
- Current status (pages may still show while GSC updates)
- **Unmark as Resolved** button (if needed)

**Note:** Even after fixing, GSC data may take weeks to update. This is normal!

#### Tab 3: 📋 All Keywords
Complete list of all target keywords found in GSC:

- Pages ranking
- Clicks, impressions, CTR
- Average position
- Status: ✓ OK | ⚠️ Cannibalized | ✅ Resolved

---

## ✅ Marking as Resolved

When you've fixed a cannibalization issue:

1. Open the keyword in **Active Cannibalization** tab
2. Enter notes about what you did (optional but recommended)
   - Example: "Merged content to main page, added 301 redirects"
3. Click **"Mark as Resolved"**

The keyword will move to the **Resolved Cases** tab.

### Why Mark as Resolved?

Even after fixing cannibalization, GSC data takes time to update. Marking keywords as resolved helps you:
- Track which issues you've addressed
- Measure progress
- Focus on remaining issues
- Document your fixes

---

## 🔄 Reset Data

Each admin page now has a **Reset Data** button that:
- Clears GSC data for the selected project
- Allows fresh data fetch
- Useful when switching date ranges or properties

**Location:**
- Right side of the Fetch button
- Gray "Reset Data" button

---

## 🎯 Workflow Example

### Weekly Cannibalization Check

**Monday:**
1. Go to Keyword Cannibalization page
2. Select project
3. Fetch last 28 days of data
4. Review **Active Cannibalization** tab
5. Prioritize top 5 keywords by clicks

**Tuesday-Thursday:**
Fix the issues:
- Consolidate content
- Add 301 redirects
- Update internal links
- Mark each as resolved with notes

**Friday:**
- Review **Resolved Cases** tab
- Check if any need attention
- Export data for reporting

**Next Week:**
- Fetch fresh data
- See if resolved cases are improving
- Focus on remaining active cases

---

## 📈 Understanding Cannibalization Rate

**Formula:**
```
Cannibalization Rate = (Cannibalized Keywords / Target Keywords) × 100
```

**Healthy Rates:**
- 0-5%: Excellent
- 5-10%: Good
- 10-20%: Needs attention
- 20%+: Urgent action required

---

## 💡 Common Scenarios

### Scenario 1: New Website
**Situation:** Just launched, no cannibalization

**What to Do:**
- Regular monthly checks
- Focus on building content
- Watch for future issues

### Scenario 2: Growing Website
**Situation:** 5-10 cannibalized keywords

**What to Do:**
- Review each case
- Decide: Merge content or differentiate
- Mark resolved as you fix
- Monitor progress

### Scenario 3: Large Website
**Situation:** 50+ cannibalized keywords

**What to Do:**
1. Sort by clicks (focus on high-traffic)
2. Fix top 10 this month
3. Mark as resolved
4. Track resolution rate
5. Continue monthly

---

## 🔧 Technical Details

### Data Source
- **Only** uses GSC data (no SERP API)
- Matches against your keyword list
- Page-level granularity

### Detection Logic
A keyword is considered **cannibalized** when:
1. It's in your keyword list
2. It appears in GSC data
3. Multiple pages rank for it

### Storage
Resolved cases are stored in `cannibalization_resolved` table:
- `project_id`: Which project
- `keyword`: The resolved keyword
- `resolved_date`: When you marked it
- `notes`: Your resolution notes

---

## 📋 Best Practices

### 1. Regular Checks
- Monthly for established sites
- Weekly for growing sites
- After major content updates

### 2. Prioritization
Focus on:
1. High-click keywords first
2. Keywords close to top 10
3. Commercial/money keywords

### 3. Documentation
Always add notes when marking as resolved:
- What you did
- Which page is primary
- What happened to others

### 4. Patience
GSC data updates slowly. A resolved keyword might:
- Show multiple pages for 2-4 weeks
- Gradually consolidate
- Eventually show single page

### 5. Verification
After marking as resolved:
- Wait 2 weeks
- Fetch fresh data
- Verify improvement
- Keep notes updated

---

## 🚫 Common Mistakes

### ❌ Marking Without Fixing
**Wrong:** Mark as resolved without actually fixing the issue

**Right:** Fix the issue, THEN mark as resolved with notes

### ❌ Deleting Competing Pages
**Wrong:** Delete pages immediately

**Right:**
1. Merge content to primary page
2. Set up 301 redirects
3. Monitor in GSC
4. Then consider removal

### ❌ Ignoring Low-Traffic Cannibalization
**Wrong:** Only fix high-traffic keywords

**Right:** Low-traffic cannibalization can prevent growth

### ❌ Not Tracking Progress
**Wrong:** Fix issues but don't document

**Right:** Use notes field, track resolution rate

---

## 📊 Reporting

### For Clients
Export data from **All Keywords** tab:
- Show cannibalization rate
- Resolution progress
- Before/after metrics

### For Team
Use **Resolved Cases** tab:
- Show what was fixed
- Document methodology
- Share best practices

### For Management
Key metrics to report:
- Total cannibalized keywords
- Resolution rate
- Time to resolve
- Traffic impact

---

## 🔄 Integration with Other Pages

### With Keywords Page
1. Add keywords to track
2. Check cannibalization for those keywords
3. Remove keywords if not needed

### With Rank Checker
1. Check manual rankings
2. Compare with GSC cannibalization
3. Understand discrepancies

### With GSC Admin
1. See all queries (broader view)
2. Switch to Keyword Cannibalization for focused view
3. Use both for complete picture

---

## 🆘 Troubleshooting

### No Cannibalization Detected
**Possible Reasons:**
1. Keywords not ranking yet
2. Only one page per keyword (good!)
3. Date range too short

**Solution:** Try longer date range (90 days)

### Keywords Not Showing
**Possible Reasons:**
1. Keywords not in GSC yet
2. Not added to keyword list
3. Different spelling/capitalization

**Solution:** Check Keywords page, add if missing

### Resolved Cases Still Show Multiple Pages
**This is Normal!**
- GSC data lags by weeks
- Keep monitoring
- Update notes with progress

---

## 🎯 Success Metrics

Track these over time:

1. **Cannibalization Rate**
   - Target: <10%
   - Measure: Monthly

2. **Resolution Rate**
   - Target: >80% resolved within 30 days
   - Measure: Weekly

3. **Time to Resolve**
   - Target: <14 days per keyword
   - Measure: Per case

4. **Traffic Impact**
   - Compare clicks before/after resolution
   - Track in GSC or analytics

---

## 📅 Maintenance Schedule

### Daily
- None required

### Weekly
- Check active cannibalization
- Fix top 3-5 keywords
- Mark resolved with notes

### Monthly
- Fetch fresh data
- Review resolution progress
- Update strategy
- Report metrics

### Quarterly
- Analyze trends
- Adjust workflow
- Review effectiveness
- Document learnings

---

## 🚀 Quick Start Checklist

- [ ] Go to Keyword Cannibalization page (page 8)
- [ ] Select your project
- [ ] Configure GSC property
- [ ] Choose date range (start with 28 days)
- [ ] Click "Fetch GSC Data"
- [ ] Review Active Cannibalization tab
- [ ] Pick top 3 keywords by clicks
- [ ] Create action plan for each
- [ ] Fix issues over next week
- [ ] Mark as resolved with notes
- [ ] Schedule next monthly check

---

## 📖 Additional Resources

### Related Documentation
- `GSC_SETUP_GUIDE.md` - Setting up Search Console
- `NEW_FEATURES.md` - All GSC features overview
- `USER_GUIDE.md` - Daily workflows

### Learn More About Cannibalization
- What causes it
- SEO impact
- Resolution strategies
- Prevention methods

---

## 🎉 You're All Set!

You now have a complete system for tracking and managing keyword cannibalization for your target keywords!

**Next Steps:**
1. Run your first analysis
2. Identify top issues
3. Create resolution plan
4. Track progress weekly
5. Measure results monthly

---

**Version:** 1.0
**Date:** 2026-01-03
**Status:** ✅ Production Ready
