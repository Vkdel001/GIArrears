# NICL Renewal System - Backend

Node.js/Express backend server for the NICL Motor and Healthcare Insurance Renewal System.

## Features

### Team-Based Authentication
- **Motor Team**: sakay@nicl.mu, vikas.khanna@zwennpay.com
- **Health Team**: mjugun@nicl.mu, sheeralall@nicl.mu, vikas.khanna@zwennpay.com
- **OTP Authentication**: Email-based verification
- **Super Passwords**: NICLMOTOR@2025 (Motor), NICLHEALTH@2025 (Health)
- **Session Management**: 8-hour timeout

### Motor Insurance APIs
- File upload for `output_motor_renewal.xlsx`
- PDF generation via `Motor_Insurance_Renewal.py`
- PDF merging via `merge_motor_pdfs.py`
- Email sending with "NICL Motor" sender

### Healthcare Insurance APIs
- File upload for `RENEWAL_LISTING.xlsx`
- PDF generation via `healthcare_renewal_final.py`
- **Two-step merge process**:
  1. Attach HEALTHSENSE forms via `simple_merge.py`
  2. Final merge via `health_renewal_mergefile.py`
- Email sending with "NICL Health" sender

## Installation

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Start development server
npm run dev

# Start production server
npm start
```

## Environment Variables

```env
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
SESSION_SECRET=your-secret-key

# Optional: Email configuration for OTP
EMAIL_USER=your-gmail@gmail.com
EMAIL_PASSWORD=your-app-password

# Optional: Brevo API for renewal emails
BREVO_API_KEY=your-brevo-api-key
```

## Required Files

Place these files in the backend directory:

### Python Scripts
- `Motor_Insurance_Renewal.py`
- `merge_motor_pdfs.py`
- `healthcare_renewal_final.py`
- `simple_merge.py`
- `health_renewal_mergefile.py`

### HEALTHSENSE Forms (for healthcare)
- `Renewal Acceptance Form - HealthSense Plan V2 0.pdf`
- `HEALTHSENSE _SOB - FEB 2025.pdf`
- `HEALTHSENSE CAT COVER_SOB - FEB 2025.pdf`

### Fonts (if required by Python scripts)
- `fonts/cambria.ttf`
- `fonts/cambriab.ttf`

### Logos (if required by Python scripts)
- `maucas2.jpeg`
- `zwennPay.jpg`
- `NICLOGO.jpg`
- `isphere_logo.jpg`

## API Endpoints

### Authentication
```
POST /api/auth/send-otp          # Send OTP to email
POST /api/auth/verify-otp        # Verify OTP code
POST /api/auth/password-login    # Login with super password
POST /api/auth/logout            # Logout user
GET  /api/auth/session           # Get current session
```

### Motor Insurance (Requires motor team auth)
```
POST /api/motor/upload-excel     # Upload Excel file
POST /api/motor/generate-pdfs    # Generate individual PDFs
POST /api/motor/merge-pdfs       # Merge all PDFs
POST /api/motor/send-emails      # Send renewal emails
GET  /api/motor/files            # List generated files
GET  /api/motor/progress         # Get process progress
```

### Healthcare Insurance (Requires health team auth)
```
POST /api/health/upload-excel    # Upload Excel file
POST /api/health/generate-pdfs   # Generate individual PDFs
POST /api/health/attach-forms    # Attach HEALTHSENSE forms (First merge)
POST /api/health/merge-all       # Final merge (Second merge)
POST /api/health/send-emails     # Send renewal emails
GET  /api/health/files           # List generated files
GET  /api/health/progress        # Get process progress
```

## Directory Structure

```
backend/
├── routes/
│   ├── auth.js                  # Authentication routes
│   ├── motor.js                 # Motor insurance routes
│   └── health.js                # Healthcare insurance routes
├── uploads/
│   ├── motor/                   # Motor Excel uploads
│   └── health/                  # Health Excel uploads
├── output_motor/                # Generated motor PDFs
├── output_renewals/             # Generated health PDFs
├── merged_motor_policies/       # Merged motor PDFs
├── merged_health_policies/      # Merged health PDFs
├── fonts/                       # Font files for PDFs
├── server.js                    # Main server file
├── package.json
└── .env                         # Environment variables
```

## Development

```bash
# Install nodemon for development
npm install -g nodemon

# Start with auto-reload
npm run dev

# Check logs
tail -f logs/app.log  # If logging is implemented
```

## Security Features

1. **Team Isolation**: Motor users cannot access health APIs
2. **Session Management**: Secure session handling with timeout
3. **File Validation**: Excel file type validation
4. **Path Security**: Prevents directory traversal
5. **Error Handling**: Sanitized error messages

## Production Deployment

1. **Set NODE_ENV=production**
2. **Configure proper SESSION_SECRET**
3. **Set up HTTPS**
4. **Configure email service**
5. **Set up process manager (PM2)**
6. **Configure reverse proxy (Nginx)**

## Troubleshooting

### Common Issues

1. **Python script not found**
   - Ensure all Python scripts are in backend directory
   - Check file permissions

2. **Excel upload fails**
   - Check file size (10MB limit)
   - Verify file format (.xlsx, .xls)

3. **PDF generation fails**
   - Check Python dependencies are installed
   - Verify font files exist
   - Check Excel file format and data

4. **HEALTHSENSE attachment fails**
   - Ensure all 3 HEALTHSENSE PDF files exist
   - Check file permissions

5. **Authentication issues**
   - Verify email addresses in AUTH_CONFIG
   - Check super passwords
   - Clear browser cookies/session

### Logs

Check console output for detailed error messages and process status.