# NICL Renewal System - Frontend

React-based frontend for the NICL Motor and Healthcare Insurance Renewal System with team-based authentication.

## Features

### Authentication
- **Team-based access control**
- **Motor Team**: sakay@nicl.mu, vikas.khanna@zwennpay.com
- **Health Team**: mjugun@nicl.mu, sheeralall@nicl.mu, vikas.khanna@zwennpay.com
- **Dual authentication**: OTP via email + Super password backup
- **Super passwords**: NICLMOTOR@2025 (Motor), NICLHEALTH@2025 (Health)

### Motor Insurance Workflow
1. **Upload Excel**: output_motor_renewal.xlsx
2. **Generate PDFs**: Individual renewal notices
3. **Merge PDFs**: Single file for printing
4. **Send Emails**: With "NICL Motor" sender

### Healthcare Insurance Workflow
1. **Upload Excel**: RENEWAL_LISTING.xlsx
2. **Generate PDFs**: Individual renewal letters
3. **Attach Forms**: Add HEALTHSENSE documents (First Merge)
4. **Final Merge**: Combine all for printing (Second Merge)
5. **Send Emails**: With "NICL Health" sender

## Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## Environment Variables

Create `.env` file:
```
VITE_API_BASE_URL=http://localhost:3001
```

## Project Structure

```
src/
├── components/
│   ├── auth/
│   │   └── AuthScreen.jsx          # Team-based authentication
│   ├── motor/
│   │   └── MotorDashboard.jsx      # Motor team interface
│   ├── health/
│   │   └── HealthDashboard.jsx     # Health team interface
│   └── shared/
│       ├── FileUpload.jsx          # File upload component
│       └── ProcessStep.jsx         # Workflow step component
├── config/
│   └── auth.js                     # Authentication configuration
├── services/
│   └── api.js                      # API service layer
├── App.jsx                         # Main application
└── main.jsx                        # Entry point
```

## Team Access

### Motor Team
- **Users**: sakay@nicl.mu, vikas.khanna@zwennpay.com
- **Theme**: Blue color scheme
- **Workflow**: 4 steps (Upload → Generate → Merge → Email)

### Health Team  
- **Users**: mjugun@nicl.mu, sheeralall@nicl.mu, vikas.khanna@zwennpay.com
- **Theme**: Green color scheme
- **Workflow**: 5 steps (Upload → Generate → Attach → Merge → Email)

## Development

```bash
# Start development server
npm run dev

# Lint code
npm run lint

# Build for production
npm run build

# Preview production build
npm run preview
```

## Backend Integration

The frontend expects a Node.js backend running on port 3001 with the following API endpoints:

### Authentication
- `POST /api/auth/send-otp`
- `POST /api/auth/verify-otp`
- `POST /api/auth/password-login`
- `POST /api/auth/logout`
- `GET /api/auth/session`

### Motor APIs
- `POST /api/motor/upload-excel`
- `POST /api/motor/generate-pdfs`
- `POST /api/motor/merge-pdfs`
- `POST /api/motor/send-emails`

### Health APIs
- `POST /api/health/upload-excel`
- `POST /api/health/generate-pdfs`
- `POST /api/health/attach-forms`
- `POST /api/health/merge-all`
- `POST /api/health/send-emails`