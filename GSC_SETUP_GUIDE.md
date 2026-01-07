# Google Search Console Setup Guide

## ⚠️ Important: GSC Uses Different Credentials Than Sheets

**Google Sheets** = Service Account JSON (already done ✅)
**Search Console** = OAuth Credentials (need to set up ❌)

---

## 🚀 Quick Setup (15 minutes)

### Step 1: Create OAuth Credentials

1. **Go to Google Cloud Console:**
   ```
   https://console.cloud.google.com
   ```

2. **Select or Create Project:**
   - Use existing project (same as Sheets)
   - Or create new: "SEO Rank Tracker"

3. **Enable Search Console API:**
   - Click "APIs & Services" > "Library"
   - Search: "Google Search Console API"
   - Click on it
   - Click "ENABLE"

4. **Create OAuth Consent Screen** (if not done):
   - Go to "APIs & Services" > "OAuth consent screen"
   - User Type: "External"
   - App name: "SEO Rank Tracker"
   - User support email: Your email
   - Developer contact: Your email
   - Click "Save and Continue"
   - Scopes: Skip (click "Save and Continue")
   - Test users: Add your email
   - Click "Save and Continue"

5. **Create OAuth Client ID:**
   - Go to "APIs & Services" > "Credentials"
   - Click "+ CREATE CREDENTIALS"
   - Select "OAuth client ID"
   - Application type: **"Desktop app"**
   - Name: "SEO Rank Tracker Desktop"
   - Click "CREATE"

6. **Download JSON:**
   - A popup appears with your credentials
   - Click "DOWNLOAD JSON" button
   - **IMPORTANT:** Rename the file to `client_secrets.json`
   - Move it to: `D:\Projects\seo-rank-tracker\credentials\`

---

### Step 2: Run Authentication Script

1. **Open terminal** in project folder

2. **Run the setup script:**
   ```bash
   python setup_gsc.py
   ```

3. **Follow prompts:**
   - Script will open your browser
   - Log in to Google account
   - Click "Allow" to grant permissions
   - Return to terminal

4. **Done!** You'll see "Setup Complete"

---

### Step 3: Verify Connection

1. **Run the app:**
   ```bash
   python -m streamlit run app.py
   ```

2. **Go to Settings** > **Search Console**

3. **Click "Test GSC Connection"**

4. **Should see:** "Connected successfully"

---

## 🎯 What You'll Have:

After setup, in `credentials` folder:

```
credentials/
├── google_service_account.json  ✅ (for Sheets)
├── client_secrets.json          ✅ (for GSC - OAuth)
└── gsc_token.pickle            ✅ (created automatically)
```

---

## 🐛 Troubleshooting

### Error: "client_secrets.json not found"

**Solution:**
- Make sure file is in `credentials` folder
- Check filename is exactly: `client_secrets.json`
- Check it's the OAuth JSON (not service account)

---

### Error: "Access denied" or "403"

**Solution:**
- Make sure you added yourself as test user
- In Google Cloud Console:
  - Go to "OAuth consent screen"
  - Add your email to "Test users"

---

### Error: "Redirect URI mismatch"

**Solution:**
- Make sure you selected "Desktop app" (not "Web application")
- If you accidentally created web app, delete it and create desktop app

---

### Script Opens Browser But Nothing Happens

**Solution:**
- Close the browser tab
- Run `python setup_gsc.py` again
- When browser opens, log in and click "Allow"
- Don't close terminal while waiting

---

## 📋 Checklist

Before running `setup_gsc.py`:

- [ ] Google Cloud project created
- [ ] Search Console API enabled
- [ ] OAuth consent screen configured
- [ ] Test user added (your email)
- [ ] OAuth Desktop credentials created
- [ ] `client_secrets.json` downloaded
- [ ] File renamed to `client_secrets.json`
- [ ] File placed in `credentials` folder

---

## 🔒 Security Notes

**Safe to commit:**
- ❌ `client_secrets.json` - Keep private
- ❌ `gsc_token.pickle` - Keep private
- ❌ `google_service_account.json` - Keep private

**The `.gitignore` already excludes these files.**

---

## 📞 Still Having Issues?

**Common mistakes:**

1. **Using service account JSON for GSC**
   - Won't work - GSC needs OAuth

2. **Selecting "Web application" instead of "Desktop app"**
   - Must be Desktop app

3. **Not adding yourself as test user**
   - Required for external apps

4. **Wrong Google account**
   - Must use account that has Search Console access

---

## ✅ Next Steps After Setup

Once connected:

1. **Go to GSC Admin** (new page 7)
2. **Select project**
3. **Click "Fetch & Analyze GSC Data"**
4. **Explore all 6 analytics tabs!**

---

**Ready? Run:**
```bash
python setup_gsc.py
```
