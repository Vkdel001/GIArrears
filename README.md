# NICL Arrears Letter Generation System

A comprehensive web-based system for generating, managing, and distributing insurance arrears letters with multiple recovery levels and automated email delivery.

## 🎯 Overview

The NICL Arrears Letter Generation System processes Excel data to create professional PDF letters for customers with outstanding premium payments. The system supports multiple recovery escalation levels (L0, L1, L2, MED) with different tones and urgency levels.

## ✨ Features

### 🔄 Multi-Level Recovery System
- **L0**: Initial Notice (friendly tone)
- **L1**: First Reminder (formal tone)  
- **L2**: Final Notice (urgent tone)
- **MED**: Legal Notice - Mise en Demeure (legal tone)

### 📊 Comprehensive Processing
- **Excel Upload**: Process `Extracted_Arrears_Data.xlsx` with validation
- **Smart Routing**: Automatic routing based on `Recovery_action` column
- **Batch Processing**: Handle thousands of records efficiently
- **Progress Tracking**: Real-time progress updates with detailed statistics

### 🎨 Professional PDF Generation
- **QR Code Integration**: MauCAS payment QR codes via ZwennPay API
- **Company Branding**: NIC and I.sphere logos
- **Legal Compliance**: Proper legal language and formatting
- **Address Intelligence**: Smart Mauritius address parsing

### 📧 Email Integration
- **Recovery-Specific Templates**: Different email tones per recovery level
- **Brevo Integration**: Professional email delivery
- **Attachment Support**: PDF letters automatically attached
- **Batch Email Management**: Send by recovery type or all at once

### 📁 File Management
- **Individual Downloads**: Download specific letters
- **Bulk Downloads**: Zip files for each recovery type
- **Merged PDFs**: Combined files for batch printing
- **Organized Structure**: Separate folders per recovery level

## 🏗️ Architecture

### Backend (Node.js/Express)
```
backend/
├── routes/
│   ├── auth.js          # Authentication & team management
│   ├── arrears.js       # Arrears-specific API endpoints
│   ├── health.js        # Health renewal system
│   └── motor.js         # Motor renewal system
├── services/
│   └── brevoService.js  # Email service integration
├── fonts/               # PDF font files
├── *.py                 # Python processing scripts
└── server.js           # Main server file
```

### Frontend (React.js)
```
frontend/src/
├── components/
│   ├── arrears/         # Arrears dashboard
│   ├── health/          # Health renewal dashboard  
│   ├── motor/           # Motor renewal dashboard
│   └── shared/          # Reusable components
├── services/
│   └── api.js          # API integration
└── config/
    └── auth.js         # Authentication configuration
```

### Python Scripts
- **`recovery_processor.py`**: Master controller for letter generation
- **`arrears_merger.py`**: PDF merging by recovery type
- **`GI_MED_Arrears.py`**: MED letter generation
- **`L0.py`, `L1.py`, `L2.py`**: Recovery level letter generators

## 🚀 Quick Start

### Prerequisites
- Node.js 16+ 
- Python 3.7+
- Required Python packages: `pandas`, `reportlab`, `requests`, `segno`, `PyMuPDF`

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd nicl-arrears-system
   ```

2. **Backend Setup**
   ```bash
   cd backend
   npm install
   ```

3. **Frontend Setup**
   ```bash
   cd frontend
   npm install
   ```

4. **Python Dependencies**
   ```bash
   pip install pandas openpyxl reportlab requests segno PyMuPDF
   ```

5. **Environment Configuration**
   ```bash
   # Create backend/.env
   BREVO_API_KEY=your_brevo_api_key
   SESSION_SECRET=your_session_secret
   NODE_ENV=development
   ```

### Running the Application

1. **Start Backend Server**
   ```bash
   cd backend
   npm start
   ```

2. **Start Frontend Development Server**
   ```bash
   cd frontend
   npm run dev
   ```

3. **Access the Application**
   - Frontend: `http://localhost:3000`
   - Backend API: `http://localhost:3001`

## 🔐 Authentication

### Team Access
- **Arrears Team**: `collections@nicl.mu` / `NICLARREARS@2025`
- **Health Team**: `mjugun@nicl.mu` / `NICLHEALTH@2025`
- **Motor Team**: `sakay@nicl.mu` / `NICLMOTOR@2025`

### Login Methods
- **OTP**: Email-based one-time password
- **Password**: Direct password authentication

## 📋 Usage Workflow

### 1. Upload Excel Data
- Upload `Extracted_Arrears_Data.xlsx`
- System analyzes recovery action distribution
- Validates required columns and data quality

### 2. Generate Letters
- Processes all recovery types automatically
- Creates individual PDF letters with QR codes
- Updates Excel with processing status and comments

### 3. Merge Letters
- Combines letters by recovery type for printing
- Creates timestamped merged PDF files
- Organizes files in recovery-specific folders

### 4. Download & Distribute
- Download individual letters or bulk zip files
- Send emails with recovery-appropriate templates
- Track delivery and processing statistics

## 📊 Data Requirements

### Required Excel Columns
- `Recovery_action`: L0, L1, L2, MED, etc.
- `POL_NO`: Policy number
- `POLICY_HOLDER`: Customer name
- `TrueArrears`: Outstanding amount (minimum MUR 100)
- `PH_EMAIL`: Customer email address
- Address fields: `POL_PH_ADDR1`, `POL_PH_ADDR2`, `POL_PH_ADDR4`, `FULL_ADDRESS`

### Validation Rules
- Minimum arrears amount: MUR 100
- Valid address required (at least one address field)
- Policy number and customer name mandatory
- Recovery action must be recognized

## 🛠️ Configuration

### Recovery Types
```javascript
const recoveryTypeConfig = {
  L0: { name: 'Level 0', color: '#f59e0b', description: 'Initial Notice' },
  L1: { name: 'Level 1', color: '#f97316', description: 'First Reminder' },
  L2: { name: 'Level 2', color: '#dc2626', description: 'Final Notice' },
  MED: { name: 'Legal (MED)', color: '#991b1b', description: 'Mise en Demeure' }
};
```

### Email Templates
- **L0**: Friendly reminder tone with amber branding
- **L1**: Formal notice tone with orange branding
- **L2**: Urgent notice tone with red branding
- **MED**: Legal notice tone with dark red branding

## 📁 Output Structure

```
Output Folders:
├── L0/                    # Individual L0 PDFs
├── L1/                    # Individual L1 PDFs
├── L2/                    # Individual L2 PDFs
├── output_mise_en_demeure/ # Individual MED PDFs
├── L0_Merge/              # Merged L0 PDFs
├── L1_Merge/              # Merged L1 PDFs
├── L2_Merge/              # Merged L2 PDFs
└── MED_Merge/             # Merged MED PDFs
```

## 🔧 API Endpoints

### Arrears API
- `POST /api/arrears/upload-excel` - Upload Excel file
- `POST /api/arrears/generate-letters` - Generate letters
- `POST /api/arrears/merge-letters` - Merge by recovery type
- `POST /api/arrears/send-emails` - Send email notifications
- `GET /api/arrears/files` - List generated files
- `GET /api/arrears/status` - Check workflow status
- `GET /api/arrears/progress` - Real-time progress tracking

### Download Endpoints
- `GET /api/arrears/download/individual/:type/:filename`
- `GET /api/arrears/download/merged/:type/:filename`
- `GET /api/arrears/download/all-individual/:type`

## 🧪 Testing

### Test Data
- Use sample Excel file with various recovery actions
- Test with different address formats
- Verify QR code generation and email delivery

### Validation Checks
- Upload validation with invalid data
- Progress tracking during large batch processing
- File download functionality
- Email template rendering

## 🚀 Deployment

### Production Environment
1. Set `NODE_ENV=production`
2. Configure proper HTTPS certificates
3. Set up process management (PM2)
4. Configure email service credentials
5. Set up file storage and backup

### Environment Variables
```bash
# Required
BREVO_API_KEY=your_production_api_key
SESSION_SECRET=secure_random_string

# Optional
FRONTEND_URL=https://your-domain.com
PORT=3001
```

## 📈 Performance

### Optimization Features
- **Batch Processing**: Handles 3000+ records efficiently
- **Progress Tracking**: Real-time updates every 50 records
- **Memory Management**: Optimized for large datasets
- **File Cleanup**: Automatic cleanup of old files
- **Compression**: Maximum compression for zip downloads

### Scalability
- Supports concurrent user sessions
- Handles multiple recovery types simultaneously
- Efficient file management and storage
- Optimized database queries and API calls

## 🤝 Contributing

### Development Setup
1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

### Code Standards
- Follow ESLint configuration
- Use meaningful commit messages
- Add comments for complex logic
- Test new features thoroughly

## 📝 License

This project is proprietary software owned by National Insurance Company Limited (NICL).

## 📞 Support

For technical support or questions:
- **Email**: support@nicl.mu
- **Phone**: 602 3000
- **Internal**: Contact IT Department

---

**Built with ❤️ for NICL by the Development Team**