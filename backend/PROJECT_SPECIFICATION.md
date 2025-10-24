# NICL Arrears Letter Generation System
## Functional & Technical Specification

---

## 📋 PROJECT OVERVIEW

The NICL Arrears Letter Generation System is a comprehensive Python-based solution for automated generation of insurance arrears letters. The system processes Excel data containing customer and policy information to generate professional PDF letters with QR codes for payment, supporting multiple recovery action levels.

---

## 🎯 FUNCTIONAL SPECIFICATION

### Core Business Requirements

**Primary Objective:**
Generate formal "Mise en Demeure" (legal notice) letters for health insurance customers with outstanding premium payments, supporting different recovery escalation levels.

**Recovery Action Types:**
- **L0**: Initial arrears notice (includes "SMS 2 + L0" category)
- **L1**: First escalation level
- **L2**: Second escalation level  
- **MED**: Final legal notice (Mise en Demeure)

**Key Business Rules:**
1. Minimum arrears threshold: MUR 100
2. Valid customer address required
3. QR code payment integration mandatory
4. Professional document formatting with company branding
5. Batch processing with error tracking

### Functional Workflows

**1. Data Processing Workflow:**
```
Excel Input → Data Validation → Recovery Action Routing → PDF Generation → Result Consolidation
```

**2. Recovery Action Routing:**
- System reads `Recovery_action` column from Excel
- Routes records to appropriate letter generation script
- Each recovery type generates PDFs in dedicated folders

**3. Payment Integration:**
- Generates MauCAS QR codes via ZwennPay API
- Supports multiple payment methods (bank transfer + QR)
- Includes customer-specific payment references

**4. Document Generation:**
- Professional letter layout with legal language
- Company logos (NIC, I.sphere)
- Structured payment information tables
- Compliance with legal notice requirements

---

## 🔧 TECHNICAL SPECIFICATION

### System Architecture

**Core Components:**
1. **Master Controller** (`recovery_processor.py`)
2. **Letter Generators** (L0.py, L1.py, L2.py, GI_MED_Arrears.py)
3. **PDF Merger** (`arrears_merger.py`)

**Technology Stack:**
- **Language**: Python 3.7+
- **PDF Generation**: ReportLab
- **QR Code Generation**: Segno + ZwennPay API
- **Data Processing**: Pandas + OpenPyXL
- **PDF Merging**: PyMuPDF (fitz)

### File Structure

```
backend/
├── recovery_processor.py          # Master controller
├── GI_MED_Arrears.py             # MED letter generator
├── L0.py                         # L0 letter generator
├── L1.py                         # L1 letter generator
├── L2.py                         # L2 letter generator
├── arrears_merger.py             # PDF merger utility
├── fonts/
│   ├── cambria.ttf               # Regular font
│   └── cambriab.ttf              # Bold font
├── NICLOGO.jpg                   # Company logo
├── isphere_logo.jpg              # I.sphere app logo
├── maucas2.jpeg                  # MauCAS payment logo
└── zwennPay.jpg                  # ZwennPay logo

Input:
├── Extracted_Arrears_Data.xlsx   # Source data file

Output Folders:
├── L0/                           # L0 individual PDFs
├── L1/                           # L1 individual PDFs
├── L2/                           # L2 individual PDFs
├── output_mise_en_demeure/       # MED individual PDFs
├── L0_Merge/                     # L0 merged PDFs
├── L1_Merge/                     # L1 merged PDFs
├── L2_Merge/                     # L2 merged PDFs
└── MED_Merge/                    # MED merged PDFs
```

### Data Flow Architecture

**1. Master Controller Process:**
```python
# Pseudo-code workflow
df = read_excel("Extracted_Arrears_Data.xlsx")
cleanup_existing_pdfs()

for recovery_action in ['SMS 2 + L0', 'L0', 'L1', 'L2', 'MED']:
    filtered_data = df[df['Recovery_action'] == recovery_action]
    create_temp_file(f"temp_{action}.xlsx", filtered_data)
    execute_script(f"{action}.py")
    collect_results()

consolidate_results_to_main_excel()
```

**2. Individual Letter Generation:**
```python
# Each generator script workflow
df = read_excel("temp_{TYPE}.xlsx")
validate_data()

for row in df:
    if validate_record(row):
        qr_code = generate_qr_code(row)
        pdf = create_pdf_letter(row, qr_code)
        save_pdf(pdf)
        update_comments("Letter generated successfully")
    else:
        update_comments("Validation error details")

save_excel_with_comments()
```

### Database Schema (Excel Columns)

**Required Input Columns:**
- `PH_TITLE`: Customer title (Mr, Mrs, Miss, etc.)
- `POLICY_HOLDER`: Customer full name
- `POL_PH_ADDR1`: Address line 1
- `POL_PH_ADDR2`: Address line 2  
- `POL_PH_ADDR4`: Address line 3 (POL_PH_ADDR3 ignored)
- `FULL_ADDRESS`: Complete address (fallback)
- `POL_NO`: Policy number
- `TrueArrears`: Outstanding amount
- `POL_FROM_DT`: Policy start date
- `POL_TO_DT`: Policy end date
- `PH_EMAIL`: Customer email
- `PH_MOBILE`: Customer mobile number
- `PAYOR_NATIONAL_ID`: National ID
- `Recovery_action`: Recovery type (L0, L1, L2, MED, etc.)

**System-Generated Columns:**
- `COMMENTS`: Processing status and error messages

### API Integration

**ZwennPay QR Code API:**
```python
# API Configuration
endpoint = "https://api.zwennpay.com:9425/api/v1.0/Common/GetMerchantQR"
merchant_id = 153

# Payload Structure
payload = {
    "MerchantId": 153,
    "SetTransactionAmount": False,
    "AdditionalBillNumber": policy_number,
    "AdditionalMobileNo": customer_mobile,
    "AdditionalCustomerLabel": customer_name,
    "AdditionalPurposeTransaction": "Arrears Payment"
}
```

### Address Processing Algorithm

**Mauritius Address Intelligence:**
- Comprehensive database of Mauritius locations (towns, districts)
- Smart address splitting into 3 lines
- Handles various formats: comma-separated, C/O addresses, street patterns
- Fallback mechanisms for unrecognized formats

### Validation Rules

**Data Validation:**
1. **Minimum Amount**: TrueArrears >= MUR 100
2. **Essential Data**: Policy number and customer name required
3. **Address Validation**: At least one address field must be populated
4. **API Validation**: QR code generation must succeed

**Error Handling:**
- Graceful API failure handling
- Detailed error logging in COMMENTS column
- Processing continues despite individual record failures

### PDF Generation Specifications

**Document Layout:**
- **Page Size**: A4 (210 × 297 mm)
- **Margins**: 50px all sides
- **Fonts**: Cambria (regular and bold)
- **Logo Positioning**: NIC logo centered top, I.sphere logo right side

**Content Structure:**
1. Company logo and branding
2. Date and customer address
3. Legal notice title (underlined, centered)
4. Formal legal paragraphs
5. Arrears details table
6. Payment instructions
7. QR code payment section
8. Footer with contact information

**QR Code Integration:**
- MauCAS payment QR code
- Centered positioning with logos
- Policy number embedded for payment tracking

### Performance Specifications

**Processing Capacity:**
- Handles 4000+ records efficiently
- Batch processing with progress tracking
- Memory-optimized for large datasets

**Error Recovery:**
- Individual record failures don't stop batch processing
- Comprehensive error logging and reporting
- Automatic cleanup of temporary files

### Security Considerations

**Data Protection:**
- No sensitive data stored in logs
- Temporary files automatically cleaned up
- API credentials configurable

**File Security:**
- Safe filename generation (sanitized characters)
- Prevents directory traversal attacks
- Validates file paths and extensions

---

## 🚀 DEPLOYMENT SPECIFICATION

### System Requirements

**Python Dependencies:**
```
pandas>=1.3.0
openpyxl>=3.0.0
reportlab>=3.6.0
requests>=2.25.0
segno>=1.4.0
PyMuPDF>=1.20.0
```

**System Resources:**
- **RAM**: Minimum 4GB (8GB recommended for large batches)
- **Storage**: 1GB free space for output files
- **Network**: Internet connection for QR code API

### Installation Steps

1. **Install Python 3.7+**
2. **Install Dependencies:**
   ```bash
   pip install pandas openpyxl reportlab requests segno PyMuPDF
   ```
3. **Setup Fonts:**
   - Place cambria.ttf and cambriab.ttf in fonts/ folder
4. **Setup Assets:**
   - Add company logos (NICLOGO.jpg, isphere_logo.jpg, etc.)
5. **Prepare Data:**
   - Place Extracted_Arrears_Data.xlsx in backend/ folder

### Usage Instructions

**1. Generate Individual Letters:**
```bash
cd backend
python recovery_processor.py
```

**2. Merge Letters for Printing:**
```bash
python arrears_merger.py
```

**3. Monitor Progress:**
- Real-time console output with progress indicators
- Final statistics and error reports
- Updated Excel file with processing comments

### Maintenance & Monitoring

**Log Files:**
- Console output provides comprehensive logging
- Excel COMMENTS column tracks individual record status
- Error messages include specific failure reasons

**Regular Maintenance:**
- Clean up old merged PDF files periodically
- Monitor API response times and success rates
- Update Mauritius address database as needed

**Troubleshooting:**
- Check font file availability
- Verify API connectivity
- Validate Excel file format and required columns
- Ensure sufficient disk space for output files

---

## 📊 SYSTEM OUTPUTS

### Processing Reports

**Console Output Example:**
```
🚀 NICL Recovery Action Processor Started
📊 Recovery Action Distribution:
   MED: 3703 records
   L2: 290 records
   L1: 212 records
   SMS 2 + L0: 205 records

📊 FINAL PROCESSING SUMMARY:
L0  | Status: Success | Processed: 205 | Generated: 198
L1  | Status: Success | Processed: 212 | Generated: 205
L2  | Status: Success | Processed: 290 | Generated: 285
MED | Status: Success | Processed: 3703 | Generated: 3650
```

**Excel Comments Examples:**
- "Letter generated successfully"
- "Arrears amount too low (MUR 85.50 < MUR 100)"
- "No valid address available"
- "API Error - Network timeout"

### File Outputs

**Individual PDFs:**
- Filename format: `{PolicyNumber}_{CustomerName}_arrears_letter.pdf`
- Professional layout with company branding
- QR codes for instant payment

**Merged PDFs:**
- Filename format: `Arrears_{Type}_Letters_Merged_{Timestamp}.pdf`
- Timestamped for version control
- Ready for batch printing

---

## 🔄 FUTURE ENHANCEMENTS

### Planned Features
1. **Multi-language Support**: French/English letter variants
2. **Email Integration**: Direct email delivery option
3. **SMS Integration**: Automated SMS notifications
4. **Dashboard**: Web-based monitoring interface
5. **Database Integration**: Direct database connectivity
6. **Template Engine**: Configurable letter templates

### Scalability Considerations
- **Parallel Processing**: Multi-threading for large batches
- **Cloud Deployment**: AWS/Azure deployment options
- **API Rate Limiting**: Enhanced API management
- **Caching**: Address validation caching

---

*Document Version: 1.0*  
*Last Updated: October 2024*  
*System Version: Production Ready*