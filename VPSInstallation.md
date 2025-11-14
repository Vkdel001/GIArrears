# VPS Installation Guide - NICL Renewal System

## Overview
This guide provides step-by-step instructions for deploying the NICL Renewal System on a DigitalOcean VPS server with domain configuration and SSL certificates.

## Prerequisites
- DigitalOcean VPS (Ubuntu 20.04+ recommended)
- Domain name (e.g., collections.niclmauritius.site)
- SSH access to the server
- Basic knowledge of Linux commands

## Table of Contents
1. [Server Setup](#server-setup)
2. [Domain and SSL Configuration](#domain-and-ssl-configuration)
3. [Application Deployment](#application-deployment)
4. [Common Issues and Solutions](#common-issues-and-solutions)
5. [Maintenance Commands](#maintenance-commands)

---

## Server Setup

### 1. Initial Server Configuration

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install essential packages
sudo apt install -y curl wget git nginx certbot python3-certbot-nginx

# Install Node.js (v18+)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 globally
sudo npm install -g pm2

# Install Python and pip
sudo apt install -y python3 python3-pip python3-venv
```

### 2. Create Application Directory

```bash
# Create application directory
sudo mkdir -p /var/www/GIArrears
sudo chown -R $USER:$USER /var/www/GIArrears
cd /var/www/GIArrears
```

---

## Domain and SSL Configuration

### 1. DNS Configuration
Point your domain to your VPS IP address:
- Create an A record: `collections.niclmauritius.site` → `YOUR_VPS_IP`
- Wait for DNS propagation (5-30 minutes)

### 2. Nginx Configuration

Create Nginx configuration file:
```bash
sudo nano /etc/nginx/sites-available/collections.niclmauritius.site
```

Add the following configuration:
```nginx
server {
    listen 80;
    server_name collections.niclmauritius.site;
    
    # Frontend (React app)
    location / {
        proxy_pass http://localhost:6001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
    
    # Backend API
    location /api {
        proxy_pass http://localhost:6002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/collections.niclmauritius.site /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 3. SSL Certificate Installation

```bash
# Install SSL certificate using Certbot
sudo certbot --nginx -d collections.niclmauritius.site

# Verify auto-renewal
sudo certbot renew --dry-run
```

---

## Application Deployment

### 1. Clone Repository

#### Option A: Clone from Git Repository (Recommended)

```bash
cd /var/www/GIArrears

# Clone the repository (replace with your actual repository URL)
git clone https://github.com/your-username/GIArrears.git .

# If the directory is not empty, you may need to force clone
# git clone https://github.com/your-username/GIArrears.git temp-repo
# mv temp-repo/* .
# mv temp-repo/.* . 2>/dev/null || true
# rm -rf temp-repo

# Set up Git configuration (optional but recommended)
git config user.name "Your Name"
git config user.email "your.email@example.com"

# Check repository status
git status
git log --oneline -5  # Show last 5 commits
```

#### Option B: Upload Files Manually

If you don't have a Git repository set up:

```bash
# Upload files using SCP from your local machine
scp -r /path/to/local/GIArrears/* root@your-server-ip:/var/www/GIArrears/

# Or use SFTP, rsync, or any file transfer method you prefer
```

#### Setting Up Git Repository (First Time Setup)

If you're setting up the repository for the first time:

```bash
# Initialize Git repository locally (on your development machine)
cd /path/to/your/local/project
git init
git add .
git commit -m "Initial commit: NICL Renewal System"

# Create repository on GitHub/GitLab and push
git remote add origin https://github.com/your-username/GIArrears.git
git branch -M main
git push -u origin main

# Then clone on server as shown in Option A above
```

#### Important Files to Check After Cloning

```bash
# Verify all necessary files are present
ls -la /var/www/GIArrears/

# Should contain:
# - backend/ (Node.js backend)
# - frontend/ (React frontend)  
# - README.md
# - .gitignore
# - VPSInstallation.md (this guide)

# Check backend structure
ls -la /var/www/GIArrears/backend/
# Should contain: server.js, package.json, routes/, services/, etc.

# Check frontend structure  
ls -la /var/www/GIArrears/frontend/
# Should contain: package.json, src/, public/, etc.
```

### 2. Backend Setup

```bash
cd /var/www/GIArrears/backend

# Install dependencies
npm install

# Create Python virtual environment
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Create ecosystem configuration
nano ecosystem.config.cjs
```

Backend ecosystem.config.cjs:
```javascript
module.exports = {
  apps: [{
    name: 'gi-arrears-backend',
    script: 'server.js',
    cwd: '/var/www/GIArrears/backend',
    env: {
      NODE_ENV: 'production',
      PORT: 6002,
      FRONTEND_URL: 'http://206.189.121.37:6001,https://collections.niclmauritius.site',
      SESSION_SECRET: 'gi-arrears-production-secret-2025',
      BREVO_API_KEY: 'your-brevo-api-key',
      PYTHON_PATH: '/var/www/GIArrears/backend/venv/bin/python'
    }
  }]
};
```

Start backend:
```bash
pm2 start ecosystem.config.cjs
```

### 3. Frontend Setup

```bash
cd /var/www/GIArrears/frontend

# Install dependencies
npm install

# ⚠️ CRITICAL: Build with correct API URL
VITE_API_BASE_URL=https://collections.niclmauritius.site npm run build

# Create ecosystem configuration
nano ecosystem.config.cjs
```

Frontend ecosystem.config.cjs:
```javascript
module.exports = {
  apps: [{
    name: 'gi-arrears-frontend',
    script: 'serve',
    args: '-s dist -l 6001',
    cwd: '/var/www/GIArrears/frontend',
    env: {
      NODE_ENV: 'production'
    }
  }]
};
```

Install serve and start frontend:
```bash
npm install -g serve
pm2 start ecosystem.config.cjs
```

### 4. Save PM2 Configuration

```bash
pm2 save
pm2 startup
# Follow the instructions provided by the startup command
```

---

## Common Issues and Solutions

### Issue 1: Mixed Content Security Error
**Problem**: Frontend works on IP but OTP fails on HTTPS domain
**Symptoms**: 
- `https://collections.niclmauritius.site` loads but OTP doesn't work
- Browser console shows mixed content errors
- Frontend tries to call HTTP API from HTTPS page

**Root Cause**: Frontend build contains hardcoded IP address instead of domain

**Solution**:
```bash
cd /var/www/GIArrears/frontend

# Check current build for IP references
grep -r "206.189.121.37\|6002" dist/assets/*.js

# If found, rebuild with correct API URL
rm -rf dist/
VITE_API_BASE_URL=https://collections.niclmauritius.site npm run build

# Verify fix
grep -r "collections.niclmauritius.site" dist/assets/*.js
grep -r "206.189.121.37\|6002" dist/assets/*.js || echo "✅ No old IP references found"

# Restart frontend
pm2 restart gi-arrears-frontend
```

### Issue 2: CORS Configuration Problems
**Problem**: Backend rejects requests from domain
**Symptoms**: API calls work with curl but fail from browser

**Solution**: Update backend ecosystem.config.cjs to accept both IP and domain:
```javascript
FRONTEND_URL: 'http://206.189.121.37:6001,https://collections.niclmauritius.site',
```

### Issue 3: Double API Path Issue
**Problem**: API calls result in `/api/api/` paths
**Symptoms**: 404 errors on API endpoints

**Solution**: Use base domain without `/api` suffix:
```bash
VITE_API_BASE_URL=https://collections.niclmauritius.site npm run build
```
**NOT**: `https://collections.niclmauritius.site/api`

### Issue 4: SSL Certificate Issues
**Problem**: Certificate not working or expired

**Solution**:
```bash
# Check certificate status
sudo certbot certificates

# Renew certificate
sudo certbot renew

# Force renewal if needed
sudo certbot renew --force-renewal
```

### Issue 5: Nginx Configuration Issues
**Problem**: 502 Bad Gateway or connection refused

**Solution**:
```bash
# Check Nginx configuration
sudo nginx -t

# Check if services are running
pm2 status

# Check Nginx logs
sudo tail -f /var/log/nginx/error.log

# Restart services if needed
sudo systemctl restart nginx
pm2 restart all
```

### Issue 6: Brevo API and Dependencies Issues
**Problem**: Backend errors with API key, XLSX, or Brevo SDK
**Symptoms**: 
- "API Key is not enabled" errors
- "XLSX.readFile is not a function" 
- "Cannot read properties of undefined (reading 'instance')"

**Root Causes**: Missing dependencies or SDK initialization issues

**Solution**:

1. **Test API Key Validity**:
```bash
# Test your Brevo API key directly
curl -X GET "https://api.brevo.com/v3/account" \
-H "accept: application/json" \
-H "api-key: YOUR_API_KEY_HERE"

# Should return account details, not an error
```

2. **Install Missing Dependencies**:
```bash
cd /var/www/GIArrears/backend

# Install required packages
npm install xlsx @getbrevo/brevo@latest
```

3. **Verify API Key in Config**:
```bash
# Check ecosystem configuration
cat ecosystem.config.cjs | grep BREVO_API_KEY

# Should match your working API key
```

4. **Restart with Updated Environment**:
```bash
# Stop and restart backend
pm2 stop gi-arrears-backend
pm2 start ecosystem.config.cjs --update-env

# Check logs for errors
pm2 logs gi-arrears-backend --lines 20
```

5. **Verify Fix**:
```bash
# Look for specific error patterns
pm2 logs gi-arrears-backend --lines 20 | grep -E "(XLSX|Brevo|unauthorized)"

# Should show no errors
```

### Issue 7: Cross-Project API Key Updates
**Problem**: Multiple projects on same server using old API keys
**Symptoms**: Other applications start failing after API key changes

**Important**: When you change API keys (like Brevo), remember to update ALL projects on the server that use the same service.

**Solution**:

1. **Find All Projects Using the API Key**:
```bash
# Search for Brevo API key references across all projects
sudo find /var/www -name "*.env" -exec grep -l "BREVO_API_KEY" {} \;
sudo find /var/www -name "ecosystem.config.cjs" -exec grep -l "BREVO_API_KEY" {} \;

# Search for old API key specifically
sudo grep -r "xkeysib-OLD_API_KEY_HERE" /var/www/
```

2. **Update Each Project**:
```bash
# For projects using .env files
cd /var/www/project-name
nano .env
# Update: BREVO_API_KEY=your-new-api-key

# For projects using ecosystem.config.cjs
cd /var/www/project-name
nano ecosystem.config.cjs
# Update the BREVO_API_KEY in env section
```

3. **Restart All Affected Services**:
```bash
# List all PM2 processes
pm2 list

# Restart specific services that use Brevo
pm2 restart project-backend-name
pm2 restart another-project-name

# Or restart all if unsure
pm2 restart all --update-env
```

4. **Verify All Projects**:
```bash
# Check logs for each project
pm2 logs project-name --lines 10

# Test API endpoints for each project
curl -X POST https://project-domain.com/api/test-endpoint
```

**Pro Tip**: Keep a list of all projects and their dependencies to avoid missing updates:
```bash
# Create a project inventory
echo "# Server Projects Inventory" > /root/projects-inventory.md
echo "## Projects using Brevo API:" >> /root/projects-inventory.md
echo "- /var/www/GIArrears (ecosystem.config.cjs)" >> /root/projects-inventory.md
echo "- /var/www/other-project (.env)" >> /root/projects-inventory.md
```

---

## Managing Complex Multi-Project Environments

When managing multiple applications on a single VPS (like the NIC infrastructure), consider these best practices:

### **Project Documentation Standards**
Each project should have comprehensive documentation including:
- **Technical Architecture**: Framework, dependencies, external integrations
- **Database Schema**: Core tables and relationships
- **Authentication & Security**: Auth flows, role-based access
- **Business Workflows**: Step-by-step process documentation
- **Service Architecture**: Core services and their responsibilities
- **Deployment Instructions**: Environment setup and configuration
- **Troubleshooting Guide**: Common issues and solutions

### **Environment Management**
```bash
# Create a master environment inventory
cat > /root/environment-inventory.md << 'EOF'
# Environment Variables Inventory

## Brevo API Key Projects:
- /var/www/GIArrears/backend/ecosystem.config.cjs
- /var/www/cashback/.env (Streamlit)
- /var/www/nicl-renewal-system/backend/.env (PM2)
- /var/www/pdf-generator/.env (PM2)
- /var/www/nic-callcenter/.env + rebuild (Vite + systemd)

## Process Management:
- PM2: GIArrears, nicl-renewal-system, pdf-generator
- Systemd: nic-reminder.service
- Manual: cashback (Streamlit as nicapp user)

## Ports in Use:
- 6001: GIArrears frontend
- 6002: GIArrears backend
- 8502: Cashback Streamlit
- 3004: NICL renewal frontend
- Various: Other services
EOF
```

### **Service Health Monitoring**
```bash
# Create a health check script
cat > /root/health-check.sh << 'EOF'
#!/bin/bash
echo "=== VPS Health Check ==="
echo "Date: $(date)"
echo ""

echo "=== PM2 Services ==="
pm2 status

echo ""
echo "=== Systemd Services ==="
systemctl status nic-reminder.service --no-pager -l

echo ""
echo "=== Manual Processes ==="
ps aux | grep -E "(streamlit|cashback)" | grep -v grep

echo ""
echo "=== Port Usage ==="
sudo netstat -tlnp | grep -E ":(6001|6002|8502|3004)"

echo ""
echo "=== Disk Usage ==="
df -h /var/www

echo ""
echo "=== Memory Usage ==="
free -h
EOF

chmod +x /root/health-check.sh
```

### **Backup Strategy**
```bash
# Create backup script for all projects
cat > /root/backup-projects.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/root/backups/$(date +%Y%m%d)"
mkdir -p $BACKUP_DIR

echo "Backing up projects to $BACKUP_DIR"

# Backup each project
for project in GIArrears cashback nicl-renewal-system pdf-generator nic-callcenter; do
    if [ -d "/var/www/$project" ]; then
        echo "Backing up $project..."
        tar -czf "$BACKUP_DIR/$project.tar.gz" -C /var/www "$project"
    fi
done

# Backup systemd services
cp /etc/systemd/system/nic-reminder.service "$BACKUP_DIR/" 2>/dev/null || true

# Backup nginx configs
cp -r /etc/nginx/sites-enabled "$BACKUP_DIR/nginx-sites" 2>/dev/null || true

echo "Backup completed: $BACKUP_DIR"
EOF

chmod +x /root/backup-projects.sh
```

### **Update Management**
```bash
# Create update script for API key changes
cat > /root/update-brevo-key.sh << 'EOF'
#!/bin/bash
if [ -z "$1" ]; then
    echo "Usage: $0 <new-brevo-api-key>"
    exit 1
fi

NEW_KEY="$1"
echo "Updating Brevo API key across all projects..."

# Update each project
echo "1. Updating GIArrears..."
cd /var/www/GIArrears/backend
sed -i "s/BREVO_API_KEY: '.*'/BREVO_API_KEY: '$NEW_KEY'/" ecosystem.config.cjs
pm2 restart gi-arrears-backend --update-env

echo "2. Updating cashback..."
cd /var/www/cashback
sed -i "s/BREVO_API_KEY=.*/BREVO_API_KEY=$NEW_KEY/" .env
# Note: Manual restart required for Streamlit

echo "3. Updating nicl-renewal-system..."
cd /var/www/nicl-renewal-system/backend
sed -i "s/BREVO_API_KEY=.*/BREVO_API_KEY=$NEW_KEY/" .env
pm2 restart nicl-renewal-system --update-env

echo "4. Updating pdf-generator..."
cd /var/www/pdf-generator
sed -i "s/BREVO_API_KEY=.*/BREVO_API_KEY=$NEW_KEY/" .env
pm2 restart pdf-generator --update-env

echo "5. Updating nic-callcenter..."
cd /var/www/nic-callcenter
sed -i "s/VITE_BREVO_API_KEY=.*/VITE_BREVO_API_KEY=$NEW_KEY/" .env
rm -rf dist/
npm run build
systemctl restart nic-reminder.service

echo "All projects updated! Remember to restart Streamlit manually."
EOF

chmod +x /root/update-brevo-key.sh
```

This approach helps maintain complex multi-project environments systematically and reduces the risk of missing critical updates during maintenance operations.

---

## Brevo API Key Update Procedures

Based on real troubleshooting experience, here are the specific procedures for updating Brevo API keys across different application types:

### **Step 1: Validate New API Key**

Before making any changes, always test the new API key:

```bash
# Test the new Brevo API key
curl -X GET "https://api.brevo.com/v3/account" \
-H "accept: application/json" \
-H "api-key: YOUR_NEW_API_KEY_HERE"

# Should return account details with credits information
# If you get an error, the API key is invalid - DO NOT PROCEED
```

### **Step 2: Application-Specific Update Procedures**

#### **Type A: PM2 Backend Applications (.env files)**

**Examples**: `/var/www/nicl-renewal-system`, `/var/www/pdf-generator`

```bash
# 1. Navigate to project
cd /var/www/project-name/backend  # or just /var/www/project-name

# 2. Update .env file
nano .env
# Change: BREVO_API_KEY=your-new-api-key-here

# 3. Restart PM2 process with updated environment
pm2 list | grep project-name  # Find the exact process name
pm2 restart project-name --update-env

# 4. Verify restart
pm2 status
pm2 logs project-name --lines 10

# 5. Test functionality
curl -X POST https://your-domain.com/api/test-endpoint
```

#### **Type B: PM2 Applications (ecosystem.config.cjs)**

**Examples**: `/var/www/GIArrears`

```bash
# 1. Navigate to project
cd /var/www/GIArrears/backend

# 2. Update ecosystem configuration
nano ecosystem.config.cjs
# Change: BREVO_API_KEY: 'your-new-api-key-here'

# 3. Restart with updated environment
pm2 stop gi-arrears-backend
pm2 start ecosystem.config.cjs --update-env

# 4. Verify restart
pm2 status
pm2 logs gi-arrears-backend --lines 10

# 5. Test API functionality
curl -X POST https://collections.niclmauritius.site/api/auth/send-otp \
-H "Content-Type: application/json" \
-d '{"email":"test@example.com"}'
```

#### **Type C: Streamlit Applications**

**Examples**: `/var/www/cashback`

```bash
# 1. Navigate to project
cd /var/www/cashback

# 2. Update .env file
nano .env
# Change: BREVO_API_KEY=your-new-api-key-here

# 3. Find and kill the Streamlit process
ps aux | grep streamlit | grep -v grep
# Note the PID (e.g., 176803)
sudo kill 176803

# 4. Restart as the correct user
sudo -u nicapp bash -c "cd /var/www/cashback && source venv/bin/activate && streamlit run pdf_processor_final_working.py --server.port=8502 --server.address=0.0.0.0 --server.headless=true" &

# 5. Verify it's running
ps aux | grep streamlit | grep -v grep
```

#### **Type D: Vite Frontend Applications (Requires Rebuild)**

**Examples**: `/var/www/nic-callcenter`

```bash
# 1. Navigate to project
cd /var/www/nic-callcenter

# 2. Update .env file
nano .env
# Change: VITE_BREVO_API_KEY=your-new-api-key-here

# 3. Update any other config files
nano test-email.cjs  # if exists
# Change: BREVO_API_KEY: 'your-new-api-key-here'

# 4. Install dependencies (if needed)
npm install

# 5. CRITICAL: Rebuild frontend to update hardcoded API key
rm -rf dist/
npm run build

# 6. Verify new API key is in build
grep -r "your-new-api-key-suffix" dist/assets/*.js | head -2

# 7. Verify old API key is gone
grep -r "old-api-key-suffix" dist/assets/*.js || echo "✅ Old API key removed"

# 8. Restart associated services
# If there's a backend service:
sudo kill $(ps aux | grep backend-reminder-service | grep -v grep | awk '{print $2}')
sudo -u www-data bash -c "cd /var/www/nic-callcenter && node backend-reminder-service.cjs" &

# If there's a systemd service:
sudo systemctl restart nic-reminder.service
sudo systemctl status nic-reminder.service
```

#### **Type E: Systemd Services**

**Examples**: Services that read from environment files

```bash
# 1. Find the service configuration
sudo systemctl status service-name
sudo find /etc/systemd -name "*service-name*"

# 2. Update environment file (usually referenced in service file)
# Check the service file for EnvironmentFile= directive
sudo cat /etc/systemd/system/service-name.service

# 3. Update the environment file
sudo nano /path/to/environment/file
# Change: BREVO_API_KEY=your-new-api-key-here

# 4. Reload systemd and restart service
sudo systemctl daemon-reload
sudo systemctl restart service-name

# 5. Verify service status
sudo systemctl status service-name
sudo journalctl -u service-name --lines 10
```

### **Step 3: Common Issues and Solutions**

#### **Issue: "API Key is not enabled" after update**

**Cause**: Missing dependencies or SDK initialization problems

**Solution**:
```bash
cd /var/www/project-name

# Install/reinstall required packages
npm install xlsx @getbrevo/brevo@latest

# Restart with fresh environment
pm2 stop project-name
pm2 start ecosystem.config.cjs --update-env
```

#### **Issue: Frontend still uses old API key**

**Cause**: API key is hardcoded in built JavaScript files

**Solution**:
```bash
cd /var/www/project-name

# Must rebuild frontend
rm -rf dist/
VITE_API_BASE_URL=https://your-domain.com npm run build  # Include any other env vars
pm2 restart frontend-service
```

#### **Issue: Mixed Content Security Error**

**Cause**: HTTPS site trying to call HTTP API

**Solution**:
```bash
# Ensure API base URL uses HTTPS
VITE_API_BASE_URL=https://your-domain.com npm run build  # NOT http://
```

### **Step 4: Verification Checklist**

After updating each application:

```bash
# 1. Check process is running
pm2 status  # for PM2 apps
ps aux | grep service-name  # for manual processes
sudo systemctl status service-name  # for systemd services

# 2. Check logs for errors
pm2 logs project-name --lines 20
sudo journalctl -u service-name --lines 20

# 3. Test API functionality
curl -X POST https://your-domain.com/api/test-endpoint

# 4. Verify old API key is gone
sudo grep -r "old-api-key-suffix" /var/www/project-name/ || echo "✅ Clean"

# 5. Verify new API key is present
grep -r "new-api-key-suffix" /var/www/project-name/ && echo "✅ Updated"
```

### **Step 5: Complete Server Update Script**

```bash
#!/bin/bash
# update-all-brevo-keys.sh
# Usage: ./update-all-brevo-keys.sh "new-api-key-here"

if [ -z "$1" ]; then
    echo "Usage: $0 <new-brevo-api-key>"
    exit 1
fi

NEW_KEY="$1"
echo "🔄 Updating Brevo API key across all projects..."

# Test API key first
echo "🔑 Testing new API key..."
RESPONSE=$(curl -s -X GET "https://api.brevo.com/v3/account" -H "api-key: $NEW_KEY")
if [[ $RESPONSE == *"error"* ]]; then
    echo "❌ API key test failed. Aborting."
    exit 1
fi
echo "✅ API key validated"

# Type A: PM2 Backend (.env)
echo "📦 Updating PM2 backend projects..."
for project in nicl-renewal-system pdf-generator; do
    if [ -d "/var/www/$project" ]; then
        echo "  → $project"
        cd "/var/www/$project"
        sed -i "s/BREVO_API_KEY=.*/BREVO_API_KEY=$NEW_KEY/" .env 2>/dev/null || \
        sed -i "s/BREVO_API_KEY=.*/BREVO_API_KEY=$NEW_KEY/" backend/.env 2>/dev/null
        pm2 restart $project --update-env 2>/dev/null || pm2 restart ${project}-backend --update-env
    fi
done

# Type B: PM2 Ecosystem Config
echo "⚙️  Updating ecosystem config projects..."
if [ -d "/var/www/GIArrears" ]; then
    echo "  → GIArrears"
    cd /var/www/GIArrears/backend
    sed -i "s/BREVO_API_KEY: '.*'/BREVO_API_KEY: '$NEW_KEY'/" ecosystem.config.cjs
    pm2 stop gi-arrears-backend
    pm2 start ecosystem.config.cjs --update-env
fi

# Type C: Streamlit
echo "🐍 Updating Streamlit projects..."
if [ -d "/var/www/cashback" ]; then
    echo "  → Cashback (manual restart required)"
    cd /var/www/cashback
    sed -i "s/BREVO_API_KEY=.*/BREVO_API_KEY=$NEW_KEY/" .env
    echo "    ⚠️  Please manually restart Streamlit process"
fi

# Type D: Vite Frontend (requires rebuild)
echo "🏗️  Updating Vite frontend projects..."
if [ -d "/var/www/nic-callcenter" ]; then
    echo "  → NIC Call Center (rebuilding...)"
    cd /var/www/nic-callcenter
    sed -i "s/VITE_BREVO_API_KEY=.*/VITE_BREVO_API_KEY=$NEW_KEY/" .env
    sed -i "s/BREVO_API_KEY: '.*'/BREVO_API_KEY: '$NEW_KEY'/" test-email.cjs 2>/dev/null
    rm -rf dist/
    npm run build
    sudo systemctl restart nic-reminder.service 2>/dev/null
fi

echo "✅ Update completed!"
echo "📋 Next steps:"
echo "   1. Manually restart Streamlit if applicable"
echo "   2. Test all applications"
echo "   3. Monitor logs for any issues"
```

### **Key Takeaways**

1. **Always test the API key first** - Invalid keys will break all services
2. **Frontend apps need rebuilds** - API keys get hardcoded during build
3. **Different restart methods** - PM2, systemd, manual processes each need different approaches
4. **Verify thoroughly** - Check logs, test endpoints, confirm old keys are gone
5. **Document your setup** - Keep track of which apps use which method

This systematic approach prevents the common pitfalls we encountered during our troubleshooting session.

---

## Maintenance Commands

### Daily Operations

```bash
# Check application status
pm2 status

# View logs
pm2 logs gi-arrears-backend --lines 50
pm2 logs gi-arrears-frontend --lines 50

# Restart services
pm2 restart gi-arrears-backend
pm2 restart gi-arrears-frontend

# Check Nginx status
sudo systemctl status nginx
```

### Git Repository Management

#### Pulling Updates from Repository

```bash
cd /var/www/GIArrears

# Check current status
git status

# Pull latest changes from main branch
git pull origin main

# If you have local changes that conflict:
git stash                    # Save local changes
git pull origin main         # Pull updates
git stash pop               # Restore local changes (resolve conflicts if any)

# Check what changed
git log --oneline -10       # Show last 10 commits
```

#### Handling Merge Conflicts

```bash
# If you encounter merge conflicts during git pull:
git status                  # Shows conflicted files
nano conflicted-file.js     # Edit and resolve conflicts manually
git add conflicted-file.js  # Mark as resolved
git commit -m "Resolve merge conflicts"
```

### Frontend Updates

**⚠️ IMPORTANT**: Always use the correct build command when updating frontend:

```bash
cd /var/www/GIArrears/frontend

# Pull latest changes (if not done already)
git pull origin main

# Install new dependencies (if any)
npm install

# Build with correct API URL
rm -rf dist/
VITE_API_BASE_URL=https://collections.niclmauritius.site npm run build

# Restart frontend
pm2 restart gi-arrears-frontend
```

### Backend Updates

```bash
cd /var/www/GIArrears/backend

# Pull latest changes (if not done already)
git pull origin main

# Install new dependencies (if any)
npm install

# Update Python dependencies (if any)
source venv/bin/activate
pip install -r requirements.txt

# Restart backend
pm2 restart gi-arrears-backend
```

### Complete Application Update Process

When updating the entire application:

```bash
cd /var/www/GIArrears

# 1. Pull latest changes
git pull origin main

# 2. Update backend
cd backend
npm install
source venv/bin/activate
pip install -r requirements.txt
pm2 restart gi-arrears-backend

# 3. Update frontend
cd ../frontend
npm install
rm -rf dist/
VITE_API_BASE_URL=https://collections.niclmauritius.site npm run build
pm2 restart gi-arrears-frontend

# 4. Verify everything is working
pm2 status
curl -I https://collections.niclmauritius.site
```

### Configuration Changes (API Keys, Environment Variables)

When you modify configuration in `ecosystem.config.cjs` files:

#### Backend Configuration Changes

```bash
cd /var/www/GIArrears/backend

# Edit the configuration file
nano ecosystem.config.cjs

# Example: Change BREVO_API_KEY or other environment variables
# env: {
#   NODE_ENV: 'production',
#   PORT: 6002,
#   BREVO_API_KEY: 'your-new-api-key-here',
#   ...
# }

# ⚠️ IMPORTANT: Restart backend to apply changes
pm2 restart gi-arrears-backend

# Verify the service restarted successfully
pm2 status
pm2 logs gi-arrears-backend --lines 10
```

#### Frontend Configuration Changes

```bash
cd /var/www/GIArrears/frontend

# Edit the configuration file
nano ecosystem.config.cjs

# After making changes, restart frontend
pm2 restart gi-arrears-frontend

# Verify the service restarted successfully
pm2 status
```

#### Alternative: Restart with Updated Environment

If you want to ensure environment variables are completely refreshed:

```bash
# Stop the service
pm2 stop gi-arrears-backend

# Start with updated environment
pm2 start ecosystem.config.cjs --update-env

# Or restart all services with updated environment
pm2 restart all --update-env
```

#### Verify Configuration Changes

```bash
# Check if the service is running with new configuration
pm2 show gi-arrears-backend

# Check logs for any errors after restart
pm2 logs gi-arrears-backend --lines 20

# Test API functionality (replace with actual test endpoint)
curl -X POST https://collections.niclmauritius.site/api/auth/send-otp \
-H "Content-Type: application/json" \
-H "Origin: https://collections.niclmauritius.site" \
-d '{"email":"test@example.com"}'
```

### System Monitoring

```bash
# Check disk space
df -h

# Check memory usage
free -h

# Check CPU usage
top

# Check port usage
sudo netstat -tlnp | grep :6001
sudo netstat -tlnp | grep :6002
```

---

## Security Considerations

1. **Firewall Configuration**:
```bash
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

2. **Regular Updates**:
```bash
sudo apt update && sudo apt upgrade -y
```

3. **SSL Certificate Auto-Renewal**:
```bash
# Verify cron job exists
sudo crontab -l | grep certbot
```

4. **Environment Variables**: Never commit sensitive data like API keys to version control

---

## Troubleshooting Checklist

When issues occur, check in this order:

1. **Services Status**: `pm2 status`
2. **Nginx Status**: `sudo systemctl status nginx`
3. **Logs**: `pm2 logs` and `sudo tail -f /var/log/nginx/error.log`
4. **DNS Resolution**: `nslookup collections.niclmauritius.site`
5. **SSL Certificate**: `sudo certbot certificates`
6. **Port Availability**: `sudo netstat -tlnp | grep :6001`
7. **Frontend Build**: Check for correct API URL in dist files

---

## Support

For additional support or issues not covered in this guide:
1. Check application logs: `pm2 logs`
2. Check Nginx logs: `sudo tail -f /var/log/nginx/error.log`
3. Verify DNS propagation: Use online DNS checker tools
4. Test API endpoints directly with curl commands

---

**Last Updated**: October 2025
**Version**: 1.0