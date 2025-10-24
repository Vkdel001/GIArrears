# NICL Letter Generation System - Complete Documentation

## Overview
This system generates renewal letters for two types of insurance: Motor Insurance and Healthcare Insurance. It includes a React frontend, Node.js backend, PDF generation scripts, and email functionality via Brevo.

## System Architecture

### Frontend (React)
- **Framework**: React with Vite
- **Authentication**: Email OTP + Super Password system
- **UI Components**: Tabbed interface for Motor and Healthcare
- **File Management**: Upload Excel, generate PDFs, combine PDFs, send emails

### Backend (Node.js)
- **Server**: Express.js
- **Authentication**: Session-based with 8-hour timeout
- **File Processing**: Excel upload, PDF generation coordination
- **Email Service**: Brevo integration with dynamic sender names

### PDF Generation Scripts
- **Motor Insurance**: `Motor_Insurance_Renewal.py`
- **Healthcare**: `healthcare_renewal.py`
- **PDF Combining**: `combine_pdfs.py`

## Project Structure

```
nicl-letter-system/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── AuthScreen.jsx
│   │   │   ├── TabNavigation.jsx
│   │   │   ├── MotorTab.jsx
│   │   │   ├── HealthcareTab.jsx
│   │   │   ├── FileBrowser.jsx
│   │   │   └── DownloadProgress.jsx
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── package.json
│   └── vite.config.js
├── backend/
│   ├── server.js
│   ├── auth_service.js
│   ├── Motor_Insurance_Renewal.py
│   ├── healthcare_renewal.py
│   ├── combine_pdfs.py
│   ├── fonts/
│   │   ├── cambria.ttf
│   │   └── cambriab.ttf
│   ├── uploads/
│   ├── output_motor/
│   ├── output_healthcare/
│   ├── combined_pdfs/
│   └── package.json
└── README.md
```

## Frontend Components

### 1. Authentication System (`AuthScreen.jsx`)

```jsx
// Key features:
// - Email OTP verification
// - Super password: "NICLAR@2025"
// - Authorized users: sbeekawa@nicl.mu, ncallicharan@nicl.mu, vikas.khanna@zwennpay.com
// - 8-hour session management

const AuthScreen = ({ onLogin }) => {
  // OTP and password authentication logic
  // Session restoration on page reload
}
```

### 2. Tab Navigation (`TabNavigation.jsx`)

```jsx
// Two main tabs:
// - Motor Insurance
// - Healthcare Insurance

const TabNavigation = ({ activeTab, onTabChange }) => {
  const tabs = [
    { id: 'motor', label: 'Motor Insurance', icon: '🚗' },
    { id: 'healthcare', label: 'Healthcare', icon: '🏥' }
  ];
}
```

### 3. Motor Tab (`MotorTab.jsx`)

```jsx
// Features:
// - Excel upload for motor renewal data
// - Generate individual PDFs
// - Combine PDFs functionality
// - Email sending with "NICL Motor" sender name
// - Progress tracking

const MotorTab = () => {
  const handleFileUpload = (file) => {
    // Upload output_motor_renewal.xlsx
  };
  
  const generatePDFs = () => {
    // Call Motor_Insurance_Renewal.py
  };
  
  const sendEmails = () => {
    // Send via Brevo with sender: "NICL Motor"
  };
}
```

### 4. Healthcare Tab (`HealthcareTab.jsx`)

```jsx
// Features:
// - Excel upload for healthcare renewal data
// - Generate individual PDFs
// - Combine PDFs functionality
// - Email sending with "NICL Health" sender name
// - Progress tracking

const HealthcareTab = () => {
  const handleFileUpload = (file) => {
    // Upload healthcare_renewal.xlsx
  };
  
  const generatePDFs = () => {
    // Call healthcare_renewal.py
  };
  
  const sendEmails = () => {
    // Send via Brevo with sender: "NICL Health"
  };
}
```

## Backend API Endpoints

### Authentication Endpoints
```javascript
// POST /api/auth/send-otp
// POST /api/auth/verify-otp
// POST /api/auth/password-login
// POST /api/auth/logout
// GET /api/auth/session
```

### Motor Insurance Endpoints
```javascript
// POST /api/motor/upload-excel
// POST /api/motor/generate-pdfs
// POST /api/motor/combine-pdfs
// POST /api/motor/send-emails
// GET /api/motor/files
// GET /api/motor/progress
```

### Healthcare Endpoints
```javascript
// POST /api/healthcare/upload-excel
// POST /api/healthcare/generate-pdfs
// POST /api/healthcare/combine-pdfs
// POST /api/healthcare/send-emails
// GET /api/healthcare/files
// GET /api/healthcare/progress
```

## Backend Implementation

### Server Configuration (`server.js`)

```javascript
const express = require('express');
const multer = require('multer');
const { spawn } = require('child_process');
const brevo = require('@getbrevo/brevo');

const app = express();

// Configure multer for different file types
const motorStorage = multer.diskStorage({
  destination: 'uploads/motor/',
  filename: (req, file, cb) => {
    cb(null, 'output_motor_renewal.xlsx');
  }
});

const healthcareStorage = multer.diskStorage({
  destination: 'uploads/healthcare/',
  filename: (req, file, cb) => {
    cb(null, 'healthcare_renewal.xlsx');
  }
});

// Motor Insurance Routes
app.post('/api/motor/generate-pdfs', (req, res) => {
  const pythonProcess = spawn('python', ['Motor_Insurance_Renewal.py']);
  // Handle process output and progress
});

// Healthcare Routes
app.post('/api/healthcare/generate-pdfs', (req, res) => {
  const pythonProcess = spawn('python', ['healthcare_renewal.py']);
  // Handle process output and progress
});

// Email sending with dynamic sender names
app.post('/api/:type/send-emails', async (req, res) => {
  const senderName = req.params.type === 'motor' ? 'NICL Motor' : 'NICL Health';
  
  const emailData = {
    sender: { name: senderName, email: 'noreply@niclmauritius.site' },
    // ... rest of email configuration
  };
});
```

### Brevo Email Configuration

```javascript
// Configure Brevo with dynamic sender names
const configureBrevoBySender = (type) => {
  const senderConfig = {
    motor: {
      name: 'NICL Motor',
      email: 'noreply@niclmauritius.site',
      replyTo: 'motor@niclmauritius.site'
    },
    healthcare: {
      name: 'NICL Health', 
      email: 'noreply@niclmauritius.site',
      replyTo: 'health@niclmauritius.site'
    }
  };
  
  return senderConfig[type];
};
```

## Python Scripts

### Motor Insurance Script (`Motor_Insurance_Renewal.py`)

**Input File**: `output_motor_renewal.xlsx`
**Output Folder**: `output_motor/`
**Required Columns**:
- Title, Firstname, Surname
- Address1, Address2, Address3
- Policy No, Cover End Dt
- Make, Model, Vehicle No, Chassis No
- New Net Premium, NIC Number
- Business Type, Old Policy No

**Key Features**:
- Password protection: "12345"
- QR code generation for payments
- 2-page PDF (Renewal Notice + KYC Declaration)
- Automatic date calculations from Cover End Dt

### Healthcare Script (`healthcare_renewal.py`)

**Input File**: `healthcare_renewal.xlsx`
**Output Folder**: `output_healthcare/`
**Required Columns**: (Define based on healthcare requirements)

**Key Features**:
- Similar structure to motor insurance
- Healthcare-specific templates
- Different branding and content

### PDF Combining Script (`combine_pdfs.py`)

```python
# Combines individual PDFs into batches
# Separate functions for motor and healthcare
# Configurable batch sizes
# Progress reporting
```

## Installation & Setup

### 1. Prerequisites
```bash
# Node.js (v16 or higher)
# Python 3.8+
# Git
```

### 2. Clone and Setup
```bash
git clone <repository-url>
cd nicl-letter-system

# Backend setup
cd backend
npm install
pip install -r requirements.txt

# Frontend setup
cd ../frontend
npm install
```

### 3. Environment Configuration

**Backend `.env`**:
```env
PORT=3001
BREVO_API_KEY=your_brevo_api_key
SESSION_SECRET=your_session_secret
AUTHORIZED_EMAILS=sbeekawa@nicl.mu,ncallicharan@nicl.mu,vikas.khanna@zwennpay.com
SUPER_PASSWORD=NICLAR@2025
```

**Frontend `.env`**:
```env
VITE_API_BASE_URL=http://localhost:3001
```

### 4. Required Files
```bash
# Place in backend folder:
backend/
├── fonts/
│   ├── cambria.ttf
│   └── cambriab.ttf
├── maucas2.jpeg
└── logo_healthcare.jpeg (if different)
```

## VPS Deployment

### 1. Server Setup
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Python and pip
sudo apt install python3 python3-pip -y

# Install PM2 for process management
sudo npm install -g pm2

# Install Nginx
sudo apt install nginx -y
```

### 2. Application Deployment
```bash
# Clone repository
git clone <repository-url> /var/www/nicl-letters
cd /var/www/nicl-letters

# Backend setup
cd backend
npm install
pip3 install -r requirements.txt

# Frontend build
cd ../frontend
npm install
npm run build

# Copy build to nginx directory
sudo cp -r dist/* /var/www/html/nicl-letters/
```

### 3. PM2 Configuration (`ecosystem.config.js`)
```javascript
module.exports = {
  apps: [{
    name: 'nicl-letters-backend',
    script: 'server.js',
    cwd: '/var/www/nicl-letters/backend',
    env: {
      NODE_ENV: 'production',
      PORT: 3002  // Different port from existing system
    }
  }]
};
```

### 4. Nginx Configuration
```nginx
# /etc/nginx/sites-available/nicl-letters
server {
    listen 80;
    server_name letters.niclmauritius.site;  # New subdomain
    
    # Frontend
    location / {
        root /var/www/html/nicl-letters;
        try_files $uri $uri/ /index.html;
    }
    
    # Backend API
    location /api/ {
        proxy_pass http://localhost:3002;
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

### 5. SSL Certificate
```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx -y

# Get SSL certificate
sudo certbot --nginx -d letters.niclmauritius.site
```

### 6. Start Services
```bash
# Enable Nginx site
sudo ln -s /etc/nginx/sites-available/nicl-letters /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Start application with PM2
cd /var/www/nicl-letters/backend
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

## Development Workflow

### 1. Local Development
```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend  
cd frontend
npm run dev
```

### 2. Testing
- Test both motor and healthcare workflows
- Verify PDF generation for both types
- Test email sending with correct sender names
- Validate file uploads and downloads

### 3. Deployment
```bash
# Build frontend
cd frontend
npm run build

# Deploy to VPS
rsync -avz --exclude node_modules . user@your-vps:/var/www/nicl-letters/

# Restart services
pm2 restart nicl-letters-backend
```

## Key Differences from Existing System

1. **Dual Letter Types**: Motor and Healthcare with separate workflows
2. **Dynamic Sender Names**: "NICL Motor" vs "NICL Health" in emails
3. **Separate File Handling**: Different upload folders and processing scripts
4. **New Port**: Runs on port 3002 (configurable)
5. **New Domain**: letters.niclmauritius.site (suggested)

## Maintenance & Monitoring

### Log Files
```bash
# PM2 logs
pm2 logs nicl-letters-backend

# Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### Backup Strategy
- Regular database backups (if applicable)
- File system backups of generated PDFs
- Configuration file backups

This documentation provides everything needed to recreate the system in a new environment with both Motor and Healthcare letter generation capabilities.