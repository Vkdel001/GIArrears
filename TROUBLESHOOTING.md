# NICL Arrears System - VPS Troubleshooting Guide

This document contains solutions to common issues encountered during VPS deployment and operation of the NICL Arrears Letter Generation System.

---

## 🚨 **Critical Issue: 60-Second Frontend Timeout During PDF Generation**

### **Problem Description**
- Frontend shows timeout error after exactly 60 seconds
- Backend process continues running normally
- PDF generation appears to fail from user perspective
- Error occurs during long-running operations (letter generation, merging)

### **Root Cause**
**Nginx reverse proxy timeout** - The `/api/` location block was missing extended timeout configurations, causing API requests to timeout at nginx's default 60-second limit.

### **Solution**

#### **Step 1: Identify the Issue**
```bash
# Check nginx timeout configurations
grep -r "timeout" /etc/nginx/sites-available/ /etc/nginx/nginx.conf

# Verify which config file handles your domain
cat /etc/nginx/sites-available/collections.niclmauritius.site
```

#### **Step 2: Fix Nginx Configuration**
```bash
# Backup current config
sudo cp /etc/nginx/sites-available/collections.niclmauritius.site /etc/nginx/sites-available/collections.niclmauritius.site.backup

# Edit the nginx config
sudo nano /etc/nginx/sites-available/collections.niclmauritius.site
```

**Add timeout settings to the `/api/` location block:**

```nginx
# Backend API (port 6002) - force IPv4
location /api/ {
    proxy_pass http://127.0.0.1:6002/api/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
    
    # Extended timeout settings for long-running API operations
    proxy_connect_timeout 300s;     # 5 minutes
    proxy_send_timeout 7200s;       # 2 hours
    proxy_read_timeout 7200s;       # 2 hours
    proxy_buffering off;            # Disable buffering for real-time progress
}
```

#### **Step 3: Apply Changes**
```bash
# Test nginx configuration
sudo nginx -t

# Reload nginx (if test passes)
sudo systemctl reload nginx

# Verify nginx status
sudo systemctl status nginx

# Check nginx error logs if issues persist
tail -20 /var/log/nginx/error.log
```

### **Verification**
- PDF generation should now complete without frontend timeout
- Progress tracking should work throughout the entire process
- Backend logs should show successful completion
- No 60-second timeout errors in browser console

---

## 🔧 **Frontend Timeout Configuration Issues**

### **Problem Description**
- Timeout constants not appearing in production build
- Vite build process optimizing away timeout values
- Frontend using default axios timeouts instead of configured values

### **Root Cause**
Vite build optimization was removing the `LONG_TIMEOUT` constant and global axios timeout configurations.

### **Solution**

#### **Step 1: Update Frontend API Configuration**
Edit `frontend/src/services/api.js`:

```javascript
// BEFORE (problematic):
const LONG_TIMEOUT = 7200000;
const api = axios.create({
  timeout: LONG_TIMEOUT, // Gets optimized away
});

// AFTER (build-safe):
const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  // Remove global timeout to prevent conflicts
  headers: {
    'Content-Type': 'application/json',
  },
});

// Use inline timeout values that survive build
generateLetters: () => api.post('/api/arrears/generate-letters', {}, {
  timeout: 7200000 // 2 hours - inline to survive build
}),
```

#### **Step 2: Rebuild and Deploy**
```bash
# Navigate to frontend directory
cd /var/www/GIArrears/frontend

# Rebuild with proper environment variable
VITE_API_BASE_URL=https://collections.niclmauritius.site npm run build

# Verify timeout values are in build (should find results now)
grep -r "7200000" dist/assets/*.js && echo "✅ Timeout found in build" || echo "❌ Still not found"

# Restart frontend service
pm2 restart gi-arrears-frontend
```

### **Note**
This frontend fix was **not the root cause** of the 60-second timeout issue. The real issue was nginx configuration. However, this ensures frontend timeout handling is robust.

---

## 📁 **File Deployment and Git Workflow**

### **Updating Single Files on VPS**

#### **Method 1: Pull Specific File (Recommended)**
```bash
# SSH into VPS
ssh root@your-server-ip

# Navigate to project directory
cd /var/www/GIArrears

# Fetch latest changes
git fetch origin main

# Pull only specific file
git checkout origin/main -- frontend/src/services/api.js

# Verify file was updated
git status

# Rebuild if frontend file was changed
cd frontend
VITE_API_BASE_URL=https://collections.niclmauritius.site npm run build

# Restart services
pm2 restart gi-arrears-frontend
pm2 status
```

#### **Method 2: Full Pull**
```bash
# Pull all changes
git pull origin main

# Handle any conflicts if they arise
git status

# Rebuild and restart as needed
```

---

## 🔍 **Diagnostic Commands**

### **Check System Status**
```bash
# Check all services
pm2 status

# Check nginx status
sudo systemctl status nginx

# Check nginx configuration
sudo nginx -t

# View service logs
pm2 logs gi-arrears-frontend --lines 20
pm2 logs gi-arrears-backend --lines 20

# Check nginx logs
tail -20 /var/log/nginx/access.log
tail -20 /var/log/nginx/error.log
```

### **Check Build Status**
```bash
# Verify frontend build exists
ls -la frontend/dist/

# Check if timeout values are in build
grep -r "7200000" frontend/dist/assets/*.js

# Check environment variables
echo "NODE_ENV: $NODE_ENV"
grep -r "VITE_API_BASE_URL" frontend/
```

### **Check File Permissions**
```bash
# Ensure proper ownership
chown -R root:root /var/www/GIArrears

# Check file permissions
ls -la /var/www/GIArrears/
ls -la /var/www/GIArrears/frontend/dist/
```

---

## 🚀 **Performance Optimization**

### **Nginx Configuration Best Practices**
```nginx
# Add to both frontend and API location blocks
proxy_buffering off;                    # Real-time progress updates
proxy_cache_bypass $http_upgrade;       # WebSocket support
proxy_connect_timeout 300s;             # Connection timeout
proxy_send_timeout 7200s;               # Send timeout (2 hours)
proxy_read_timeout 7200s;               # Read timeout (2 hours)

# Optional: Increase client body size for large file uploads
client_max_body_size 50M;
```

### **PM2 Configuration**
```bash
# Restart services with proper memory limits
pm2 restart gi-arrears-frontend --max-memory-restart 500M
pm2 restart gi-arrears-backend --max-memory-restart 1G

# Save PM2 configuration
pm2 save

# Setup PM2 startup script
pm2 startup
```

---

## 🐛 **Common Issues and Solutions**

### **Issue: "Cannot connect to backend"**
**Solution:**
```bash
# Check if backend is running
pm2 status | grep backend

# Check backend logs
pm2 logs gi-arrears-backend

# Restart backend
pm2 restart gi-arrears-backend

# Check port availability
netstat -tlnp | grep :6002
```

### **Issue: "Build files not updating"**
**Solution:**
```bash
# Clear old build
rm -rf frontend/dist/

# Rebuild with environment variable
cd frontend
VITE_API_BASE_URL=https://collections.niclmauritius.site npm run build

# Restart frontend service
pm2 restart gi-arrears-frontend
```

### **Issue: "SSL certificate errors"**
**Solution:**
```bash
# Check certificate status
sudo certbot certificates

# Renew if needed
sudo certbot renew

# Restart nginx
sudo systemctl restart nginx
```

---

## 📊 **Monitoring and Maintenance**

### **Regular Health Checks**
```bash
# Daily health check script
#!/bin/bash
echo "=== NICL Arrears System Health Check ==="
echo "Date: $(date)"
echo ""

echo "PM2 Services:"
pm2 status

echo ""
echo "Nginx Status:"
sudo systemctl status nginx --no-pager

echo ""
echo "Disk Usage:"
df -h /var/www/GIArrears

echo ""
echo "Memory Usage:"
free -h

echo ""
echo "Recent Errors:"
tail -5 /var/log/nginx/error.log
```

### **Log Rotation**
```bash
# Setup log rotation for PM2
pm2 install pm2-logrotate

# Configure log rotation
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

---

## 📞 **Emergency Procedures**

### **System Recovery**
```bash
# If system is completely down
sudo systemctl restart nginx
pm2 restart all

# If database issues
sudo systemctl restart mysql  # if using MySQL

# If disk space issues
# Clean old logs
sudo find /var/log -name "*.log" -type f -mtime +7 -delete

# Clean old PM2 logs
pm2 flush
```

### **Rollback Procedure**
```bash
# Rollback to previous git commit
git log --oneline -5  # See recent commits
git checkout <previous-commit-hash>

# Rebuild
cd frontend
npm run build

# Restart services
pm2 restart all
```

---

## 📝 **Change Log**

### **2024-10-30: Nginx Timeout Fix**
- **Issue:** 60-second frontend timeout during PDF generation
- **Root Cause:** Missing timeout configurations in nginx `/api/` location block
- **Solution:** Added `proxy_read_timeout 7200s` and `proxy_send_timeout 7200s` to API location block
- **Result:** System now handles 2-hour operations without timeout

### **2024-10-30: Frontend Timeout Configuration**
- **Issue:** Vite build optimizing away timeout constants
- **Solution:** Replaced `LONG_TIMEOUT` constant with inline timeout values
- **Files Modified:** `frontend/src/services/api.js`
- **Note:** This was not the root cause but improves build reliability

---

## 🔗 **Useful Resources**

- **Nginx Documentation:** https://nginx.org/en/docs/
- **PM2 Documentation:** https://pm2.keymetrics.io/docs/
- **Vite Build Configuration:** https://vitejs.dev/config/
- **Let's Encrypt SSL:** https://letsencrypt.org/docs/

---

**Last Updated:** October 30, 2024  
**System Version:** Production v1.0  
**Maintainer:** NICL IT Team