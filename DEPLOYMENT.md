# Deployment Guide

## Option 1: Local Network Deployment (Simple)

### Run on Your Computer, Access from Network

1. **Find your local IP address:**
   ```bash
   ipconfig
   ```
   Look for "IPv4 Address" (e.g., `192.168.1.100`)

2. **Run with network access:**
   ```bash
   python -m streamlit run app.py --server.address 0.0.0.0 --server.port 8501
   ```

3. **Access from other computers on same network:**
   ```
   http://192.168.1.100:8501
   ```

**Pros:**
- Free
- Easy setup
- Works immediately

**Cons:**
- Only works when your computer is on
- Only accessible on your local network
- Not suitable for remote teams

---

## Option 2: Streamlit Cloud (Free, Recommended)

### Deploy to Streamlit's Free Cloud Platform

**Prerequisites:**
- GitHub account
- Code pushed to GitHub repository

### Steps:

1. **Create GitHub Repository:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/seo-rank-tracker.git
   git push -u origin main
   ```

2. **Deploy to Streamlit Cloud:**
   - Go to https://streamlit.io/cloud
   - Sign in with GitHub
   - Click "New app"
   - Select your repository
   - Set main file: `app.py`
   - Click "Deploy"

3. **Configure Secrets:**
   - In Streamlit Cloud dashboard
   - Go to App Settings > Secrets
   - Add your API keys:
   ```toml
   SERPER_API_KEY = "your-api-key-here"
   SCRAPINGROBOT_API_KEY = "your-api-key-here"
   ```

4. **Upload Google Sheets Credentials:**
   - Cannot upload files directly to Streamlit Cloud
   - Use secrets instead (paste JSON content)

**Pros:**
- Free (for public repos)
- Always online
- Accessible from anywhere
- Automatic updates

**Cons:**
- Code must be on GitHub (can be private with paid plan)
- Limited resources
- Shared infrastructure

---

## Option 3: Heroku (Easy, Paid)

### Deploy to Heroku Cloud Platform

**Prerequisites:**
- Heroku account
- Heroku CLI installed

### Steps:

1. **Create `Procfile`:**
   ```
   web: sh setup.sh && streamlit run app.py
   ```

2. **Create `setup.sh`:**
   ```bash
   mkdir -p ~/.streamlit/
   echo "\
   [server]\n\
   headless = true\n\
   port = $PORT\n\
   enableCORS = false\n\
   \n\
   " > ~/.streamlit/config.toml
   ```

3. **Deploy:**
   ```bash
   heroku login
   heroku create seo-rank-tracker
   git push heroku main
   ```

4. **Set environment variables:**
   ```bash
   heroku config:set SERPER_API_KEY=your-key-here
   ```

**Cost:** ~$7/month for hobby tier

---

## Option 4: AWS EC2 (Advanced)

### Deploy to Amazon Web Services

**Prerequisites:**
- AWS account
- EC2 instance (t2.micro for free tier)

### Steps:

1. **Launch EC2 instance** (Ubuntu 22.04)

2. **Connect via SSH**

3. **Install dependencies:**
   ```bash
   sudo apt update
   sudo apt install python3-pip
   pip3 install -r requirements.txt
   ```

4. **Upload your code**

5. **Run with PM2 or screen:**
   ```bash
   # Install PM2
   npm install -g pm2

   # Start app
   pm2 start "python3 -m streamlit run app.py --server.port 8501" --name seo-tracker

   # Save process
   pm2 save
   pm2 startup
   ```

6. **Configure security group:**
   - Allow inbound traffic on port 8501

**Cost:** Free tier (first year), then ~$10/month

---

## Option 5: Docker Deployment

### Containerize for Any Platform

1. **Create `Dockerfile`:**
   ```dockerfile
   FROM python:3.10-slim

   WORKDIR /app

   COPY requirements.txt .
   RUN pip install -r requirements.txt

   COPY . .

   EXPOSE 8501

   CMD ["streamlit", "run", "app.py", "--server.port=8501", "--server.address=0.0.0.0"]
   ```

2. **Create `.dockerignore`:**
   ```
   __pycache__
   *.pyc
   .git
   data/*.db
   credentials/*.json
   .env
   ```

3. **Build and run:**
   ```bash
   docker build -t seo-rank-tracker .
   docker run -p 8501:8501 seo-rank-tracker
   ```

---

## Security Considerations

### Production Checklist

- [ ] Change default password
- [ ] Use HTTPS (SSL certificate)
- [ ] Secure API keys (use environment variables)
- [ ] Regular backups of database
- [ ] Firewall configuration
- [ ] Rate limiting
- [ ] User authentication (consider adding user accounts)

### Environment Variables

Instead of storing in database, use environment variables:

```bash
export SERPER_API_KEY="your-key"
export APP_PASSWORD="secure-password"
```

Update `config.py` to read from environment:
```python
import os
SERPER_API_KEY = os.getenv('SERPER_API_KEY', '')
```

---

## Backup Strategy

### Automated Backups

**Daily Database Backup:**
```bash
#!/bin/bash
# backup.sh
DATE=$(date +%Y%m%d)
cp data/seo_tracker.db backups/seo_tracker_$DATE.db
```

**Cron job (Linux):**
```bash
0 2 * * * /path/to/backup.sh
```

**Windows Task Scheduler:**
- Create task to run backup script daily

---

## Scaling Considerations

### For Large Scale Use

**Database:**
- Migrate from SQLite to PostgreSQL
- Better concurrency
- More robust for production

**Caching:**
- Add Redis for session management
- Cache API responses

**Load Balancing:**
- Multiple app instances
- Nginx reverse proxy

**Background Jobs:**
- Celery for async rank checking
- Queue system for bulk operations

---

## Monitoring

### Track Application Health

**Streamlit Cloud:**
- Built-in monitoring
- View logs in dashboard

**Self-Hosted:**
- Use `htop` for resource monitoring
- Check logs: `pm2 logs seo-tracker`
- Set up uptime monitoring (e.g., UptimeRobot)

---

## Recommended: Streamlit Cloud

**For most users, Streamlit Cloud is the best option:**

✅ Free (with public GitHub repo)
✅ Easy setup (5 minutes)
✅ Automatic updates
✅ Always online
✅ No server maintenance

**Steps:**
1. Push code to GitHub
2. Connect to Streamlit Cloud
3. Deploy
4. Done!

---

## Need Help?

- Streamlit Docs: https://docs.streamlit.io/
- Heroku Docs: https://devcenter.heroku.com/
- AWS Docs: https://docs.aws.amazon.com/

---

**Last Updated:** 2026-01-03
