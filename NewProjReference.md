# QR Code Payment Integration - Technical Reference Document

## 📋 **Document Overview**

This document provides comprehensive technical and process details for the QR code payment integration system used in the NICL Arrears Letter Generation System. The integration enables customers to make instant payments via mobile banking apps using MauCAS QR codes powered by ZwennPay.

---

## 🎯 **System Purpose**

Enable customers to make instant arrears payments by scanning a QR code embedded in their arrears letters using any MauCAS-compatible mobile banking application (Juice, MauBank WithMe, Blink, MyT Money, etc.).

---

## 🏗️ **Architecture Overview**

### **Components:**
1. **ZwennPay API** - QR code data generation service
2. **Segno Library** - Python QR code image generation
3. **ReportLab** - PDF generation and logo embedding
4. **MauCAS Payment System** - Backend payment processing

### **Flow Diagram:**
```
Customer Data → ZwennPay API → QR Data String → Segno Library → QR Image → PDF Embedding → Customer Letter
                                                                              ↓
                                                                    MauCAS + ZwennPay Logos
```

---

## 🔧 **Technical Implementation**

### **1. Customer Label Generation**

**Purpose:** Create a concise customer identifier (max 24 characters) for the QR code.

**Process:**
```python
# Extract and clean policy holder name
clean_policy_holder = policy_holder.strip().replace('-', ' ')
name_parts = clean_policy_holder.split()

# Remove titles (Mr, Mrs, Ms, Miss, Dr, Prof, Sir, Madam)
if name_parts and name_parts[0] in titles:
    name_parts = name_parts[1:]

# Create first initial + surname format
if len(name_parts) >= 2:
    first_initial = name_parts[0][0].upper()
    surname = name_parts[-1]
    customer_label = f"{first_initial} {surname}"
else:
    customer_label = name_parts[0][:24]

# Truncate to 24 characters if needed
customer_label = customer_label[:24]
```

**Examples:**
- Input: "Mr. Ramesh Kumar Patel" → Output: "R Patel"
- Input: "Mrs. Priya Sharma" → Output: "P Sharma"
- Input: "John-Paul Smith" → Output: "J Smith"

**Character Limit Rationale:**
- MauCAS API has a 24-character limit for customer labels
- Ensures compatibility across all mobile banking apps
- Maintains readability on small screens

---

### **2. Mobile Number Processing**

**Purpose:** Extract and format mobile numbers from Excel data.

**Process:**
```python
# Handle various data types (float, string, empty)
try:
    mobile_raw = ph_mobile
    if pd.notna(mobile_raw) and mobile_raw != '':
        # Convert float to clean integer string (removes decimals)
        mobile_no = str(int(float(mobile_raw)))
    else:
        mobile_no = ''
except (ValueError, TypeError):
    mobile_no = ''
```

**Data Type Handling:**
- **Float**: `5712345678.0` → `"5712345678"`
- **String**: `"5712345678"` → `"5712345678"`
- **Empty/NaN**: → `""`

**Why This Matters:**
- Excel often stores numbers as floats
- API requires string format without decimals
- Empty values must be handled gracefully

---

### **3. ZwennPay API Integration**

#### **API Endpoint:**
```
POST https://api.zwennpay.com:9425/api/v1.0/Common/GetMerchantQR
```

#### **Request Headers:**
```json
{
  "accept": "text/plain",
  "Content-Type": "application/json"
}
```

#### **Request Payload Structure:**
```json
{
  "MerchantId": 153,
  "SetTransactionAmount": false,
  "TransactionAmount": 0,
  "SetConvenienceIndicatorTip": false,
  "ConvenienceIndicatorTip": 0,
  "SetConvenienceFeeFixed": false,
  "ConvenienceFeeFixed": 0,
  "SetConvenienceFeePercentage": false,
  "ConvenienceFeePercentage": 0,
  "SetAdditionalBillNumber": true,
  "AdditionalRequiredBillNumber": false,
  "AdditionalBillNumber": "MED.2023.230.10.254",
  "SetAdditionalMobileNo": true,
  "AdditionalRequiredMobileNo": false,
  "AdditionalMobileNo": "5712345678",
  "SetAdditionalStoreLabel": false,
  "AdditionalRequiredStoreLabel": false,
  "AdditionalStoreLabel": "",
  "SetAdditionalLoyaltyNumber": false,
  "AdditionalRequiredLoyaltyNumber": false,
  "AdditionalLoyaltyNumber": "",
  "SetAdditionalReferenceLabel": false,
  "AdditionalRequiredReferenceLabel": false,
  "AdditionalReferenceLabel": "",
  "SetAdditionalCustomerLabel": true,
  "AdditionalRequiredCustomerLabel": false,
  "AdditionalCustomerLabel": "R Patel",
  "SetAdditionalTerminalLabel": false,
  "AdditionalRequiredTerminalLabel": false,
  "AdditionalTerminalLabel": "",
  "SetAdditionalPurposeTransaction": true,
  "AdditionalRequiredPurposeTransaction": false,
  "AdditionalPurposeTransaction": "Arrears Payment"
}
```

#### **Payload Field Explanations:**

| Field | Value | Purpose |
|-------|-------|---------|
| `MerchantId` | `153` | NICL's unique merchant identifier in ZwennPay system |
| `SetTransactionAmount` | `false` | Allow customer to enter amount (not pre-filled) |
| `TransactionAmount` | `0` | Not used when SetTransactionAmount is false |
| `SetAdditionalBillNumber` | `true` | Enable policy number tracking |
| `AdditionalBillNumber` | Policy number with `/` replaced by `.` | Payment identification (e.g., "MED.2023.230.10.254") |
| `SetAdditionalMobileNo` | `true` | Enable mobile number tracking |
| `AdditionalMobileNo` | Customer mobile | Contact information for payment confirmation |
| `SetAdditionalCustomerLabel` | `true` | Enable customer name display |
| `AdditionalCustomerLabel` | First initial + surname | Customer identification (max 24 chars) |
| `SetAdditionalPurposeTransaction` | `true` | Enable transaction purpose |
| `AdditionalPurposeTransaction` | `"Arrears Payment"` | Payment category for reporting |

#### **Policy Number Formatting:**
```python
# Replace forward slashes with dots for API compatibility
policy_number = str(pol_no).replace('/', '.')

# Examples:
# "MED/2023/230/10/254" → "MED.2023.230.10.254"
# "L0/2024/100/5/123" → "L0.2024.100.5.123"
```

**Why Replace Slashes:**
- Forward slashes can cause issues in some payment systems
- Dots are universally accepted as separators
- Maintains readability and structure

#### **API Response Handling:**

**Success Response (HTTP 200):**
```python
response.status_code == 200
response.text = "00020101021226660014mu.maucas.qr01091531234560204123..."
```

**Response Validation:**
```python
qr_data = str(response.text).strip()

# Check for valid data
if qr_data and qr_data.lower() not in ('null', 'none', 'nan'):
    # Valid QR data received
    proceed_with_qr_generation()
else:
    # Invalid or empty response
    skip_qr_generation()
```

**Error Responses:**
- **HTTP 400**: Invalid payload format
- **HTTP 401**: Authentication failure
- **HTTP 500**: Server error
- **Timeout**: Network connectivity issues

#### **Timeout Configuration:**
```python
timeout=20  # 20 seconds
```

**Rationale:**
- API typically responds in 1-3 seconds
- 20 seconds allows for network latency
- Prevents indefinite hanging
- Allows graceful failure and continuation

---

### **4. QR Code Image Generation**

#### **Library Used:**
```python
import segno
```

**Segno** is a pure Python QR code generator that creates high-quality QR codes.

#### **Generation Process:**
```python
# Create QR code object
qr = segno.make(qr_data, error='L')

# Save as PNG image
qr_filename = f"qr_{safe_policy}.png"
qr.save(qr_filename, scale=8, border=2, dark='#000000')
```

#### **Parameters Explained:**

| Parameter | Value | Purpose |
|-----------|-------|---------|
| `qr_data` | API response string | The MauCAS payment data to encode |
| `error='L'` | Low error correction (~7%) | Smaller QR code, faster scanning |
| `scale=8` | 8 pixels per module | Optimal size for printing and scanning |
| `border=2` | 2 modules quiet zone | Minimum border for reliable scanning |
| `dark='#000000'` | Pure black | Maximum contrast for scanning |

#### **Error Correction Levels:**

| Level | Recovery | Use Case |
|-------|----------|----------|
| L | ~7% | Clean printing (our choice) |
| M | ~15% | Standard use |
| Q | ~25% | Potential damage |
| H | ~30% | High damage risk |

**Why Level L:**
- PDF printing is clean and high-quality
- Smaller QR code size
- Faster scanning
- Sufficient for our use case

#### **QR Code Specifications:**
- **Format**: PNG image
- **Color**: Black on transparent background
- **Size**: ~64x64 modules (512x512 pixels at scale=8)
- **File naming**: `qr_{policy_number}.png`
- **Temporary storage**: Deleted after PDF generation

---

### **5. PDF Embedding Process**

#### **QR Code Section Layout:**

```
┌─────────────────────────────┐
│      MauCAS Logo (90px)     │
├─────────────────────────────┤
│      QR Code (80x80px)      │
├─────────────────────────────┤
│   "NIC Health Insurance"    │
├─────────────────────────────┤
│    ZwennPay Logo (60px)     │
└─────────────────────────────┘
```

#### **Implementation Code:**
```python
# Check if QR was generated successfully
if qr_filename and os.path.exists(qr_filename):
    # Calculate center position
    page_center_x = width / 2
    
    y_pos -= 10  # Space before QR section
    
    # 1. Add MauCAS logo (centered)
    if os.path.exists("maucas2.jpeg"):
        img = ImageReader("maucas2.jpeg")
        img_width = 90
        img_height = img_width * (img.getSize()[1] / img.getSize()[0])
        logo_x = page_center_x - (img_width / 2)
        c.drawImage(img, logo_x, y_pos - img_height, 
                   width=img_width, height=img_height)
        y_pos -= img_height + 2
    
    # 2. Add QR code (centered)
    qr_size = 80
    qr_x = page_center_x - (qr_size / 2)
    c.drawImage(qr_filename, qr_x, y_pos - qr_size, 
               width=qr_size, height=qr_size)
    y_pos -= qr_size + 2
    
    # 3. Add "NIC Health Insurance" text (centered)
    c.setFont("Cambria-Bold", 10)
    text_width = c.stringWidth("NIC Health Insurance", "Cambria-Bold", 10)
    text_x = page_center_x - (text_width / 2)
    c.drawString(text_x, y_pos - 8, "NIC Health Insurance")
    y_pos -= 10
    
    # 4. Add ZwennPay logo (centered)
    if os.path.exists("zwennPay.jpg"):
        zwenn_img = ImageReader("zwennPay.jpg")
        zwenn_width = 60
        zwenn_height = zwenn_width * (zwenn_img.getSize()[1] / zwenn_img.getSize()[0])
        zwenn_x = page_center_x - (zwenn_width / 2)
        c.drawImage(zwenn_img, zwenn_x, y_pos - zwenn_height, 
                   width=zwenn_width, height=zwenn_height)
        y_pos -= zwenn_height + 8
```

#### **Size Specifications:**

| Element | Size | Rationale |
|---------|------|-----------|
| MauCAS Logo | 90px width | Brand visibility, not overwhelming |
| QR Code | 80x80px | Optimal for mobile scanning |
| Text | 10pt Cambria Bold | Clear, professional |
| ZwennPay Logo | 60px width | Supporting brand, smaller |

#### **Spacing Between Elements:**

| Gap | Size | Purpose |
|-----|------|---------|
| Before QR section | 10px | Separation from text above |
| MauCAS → QR | 2px | Tight grouping |
| QR → Text | 2px | Visual connection |
| Text → ZwennPay | 2px | Compact layout |
| After ZwennPay | 8px | Separation from text below |

**Total QR Section Height:** ~180-200px

---

### **6. Logo Asset Management**

#### **Required Logo Files:**

| File | Format | Purpose | Location |
|------|--------|---------|----------|
| `maucas2.jpeg` | JPEG | MauCAS payment system branding | `backend/` |
| `zwennPay.jpg` | JPEG | ZwennPay service provider branding | `backend/` |
| `NICLOGO.jpg` | JPEG | Company logo (top of letter) | `backend/` |
| `isphere_logo.jpg` | JPEG | I.sphere app logo | `backend/` |

#### **Logo Specifications:**

**MauCAS Logo:**
- **Recommended size**: 300x100px minimum
- **Aspect ratio**: Preserved automatically
- **Color**: Full color (blue/orange branding)
- **Background**: White or transparent

**ZwennPay Logo:**
- **Recommended size**: 200x80px minimum
- **Aspect ratio**: Preserved automatically
- **Color**: Full color (pink/purple branding)
- **Background**: White or transparent

#### **Aspect Ratio Preservation:**
```python
# Calculate height maintaining aspect ratio
img_height = img_width * (img.getSize()[1] / img.getSize()[0])
```

**Example:**
- Original: 300x100px (3:1 ratio)
- Target width: 90px
- Calculated height: 90 * (100/300) = 30px
- Result: 90x30px (maintains 3:1 ratio)

---

## 🔄 **Complete Process Flow**

### **Step-by-Step Execution:**

```
1. Read Customer Data from Excel
   ├─ Policy Number (POL_NO)
   ├─ Policy Holder Name (POLICY_HOLDER)
   ├─ Title (PH_TITLE)
   ├─ Mobile Number (PH_MOBILE)
   └─ Arrears Amount (TrueArrears)

2. Process Customer Label
   ├─ Remove title prefix
   ├─ Extract first initial
   ├─ Extract surname
   └─ Format: "F Surname" (max 24 chars)

3. Process Mobile Number
   ├─ Convert float to integer
   ├─ Convert to string
   └─ Handle empty values

4. Format Policy Number
   └─ Replace "/" with "." for API

5. Build API Payload
   ├─ MerchantId: 153
   ├─ Bill Number: Formatted policy number
   ├─ Mobile: Processed mobile number
   ├─ Customer Label: Formatted name
   └─ Purpose: "Arrears Payment"

6. Call ZwennPay API
   ├─ POST request with 20s timeout
   ├─ Receive QR data string
   └─ Validate response

7. Generate QR Code Image
   ├─ Use Segno library
   ├─ Error correction: Level L
   ├─ Scale: 8, Border: 2
   └─ Save as PNG: qr_{policy}.png

8. Create PDF Letter
   ├─ Add company logos
   ├─ Add customer address
   ├─ Add letter content
   ├─ Add arrears table
   └─ Add payment instructions

9. Embed QR Section
   ├─ Add MauCAS logo (90px, centered)
   ├─ Add QR code (80x80px, centered)
   ├─ Add "NIC Health Insurance" text
   └─ Add ZwennPay logo (60px, centered)

10. Finalize PDF
    ├─ Add closing text
    ├─ Save PDF file
    └─ Delete temporary QR image

11. Update Excel Comments
    └─ "Letter generated successfully"
```

---

## ⚠️ **Error Handling**

### **API Failure Scenarios:**

#### **1. Network Timeout**
```python
except requests.exceptions.RequestException as e:
    print(f"⚠️ Network error while generating QR: {str(e)}")
    # Continue without QR code
```

**Action:** Letter is generated without QR code section.

#### **2. Invalid API Response**
```python
if qr_data and qr_data.lower() not in ('null', 'none', 'nan'):
    # Valid data
else:
    print(f"⚠️ No valid QR data received")
    # Continue without QR code
```

**Action:** Letter is generated without QR code section.

#### **3. HTTP Error Codes**
```python
if response.status_code == 200:
    # Success
else:
    print(f"❌ API request failed: {response.status_code}")
    # Continue without QR code
```

**Action:** Letter is generated without QR code section.

#### **4. QR Generation Failure**
```python
except Exception as e:
    print(f"⚠️ Error generating QR: {str(e)}")
    # Continue without QR code
```

**Action:** Letter is generated without QR code section.

### **Graceful Degradation:**

**Philosophy:** QR code failure should NOT prevent letter generation.

**Implementation:**
```python
# QR generation is wrapped in try-except
try:
    # Generate QR code
    qr_filename = generate_qr_code()
except:
    qr_filename = None

# Later in PDF generation
if qr_filename and os.path.exists(qr_filename):
    # Add QR section
else:
    # Skip QR section, continue with rest of letter
```

**Result:**
- ✅ Letter always generated
- ✅ QR section included when possible
- ✅ No QR section when API fails
- ✅ Customer still receives payment instructions

---

## 📊 **Performance Considerations**

### **API Call Timing:**
- **Average response time**: 1-3 seconds
- **Timeout setting**: 20 seconds
- **Retry logic**: None (graceful failure)

### **QR Code Generation:**
- **Generation time**: <100ms per QR code
- **File size**: ~2-5KB per PNG
- **Memory usage**: Minimal (temporary file)

### **Batch Processing:**
- **Sequential processing**: One record at a time
- **Progress tracking**: Every 25 records
- **Estimated time**: ~3-5 seconds per letter (including QR)

### **Optimization Strategies:**

**1. Temporary File Cleanup:**
```python
# Clean up QR file after PDF generation
if qr_filename and os.path.exists(qr_filename):
    os.remove(qr_filename)
```

**2. Reuse API Connection:**
```python
# Requests library handles connection pooling automatically
```

**3. Error Recovery:**
```python
# Continue processing even if individual QR fails
# No batch failure due to single QR error
```

---

## 🔒 **Security Considerations**

### **API Security:**
- **HTTPS**: All API calls use encrypted connection
- **Merchant ID**: Hardcoded, not exposed to customers
- **No sensitive data**: QR contains payment routing only
- **Timeout protection**: Prevents hanging connections

### **Data Privacy:**
- **Customer data**: Only name initial + surname in QR
- **Mobile number**: Optional, used for payment confirmation
- **Policy number**: Encoded in QR for payment tracking
- **No financial data**: Amount not embedded in QR

### **File Security:**
- **Temporary files**: Deleted immediately after use
- **No persistent storage**: QR images not retained
- **Safe filenames**: Sanitized to prevent injection

---

## 🧪 **Testing Guidelines**

### **Unit Testing:**

**1. Customer Label Generation:**
```python
# Test cases
assert format_customer_label("Mr. John Smith") == "J Smith"
assert format_customer_label("Mrs. Mary-Jane Watson") == "M Watson"
assert format_customer_label("VeryLongFirstName VeryLongSurname") == "V VeryLongSurname"[:24]
```

**2. Mobile Number Processing:**
```python
# Test cases
assert process_mobile(5712345678.0) == "5712345678"
assert process_mobile("5712345678") == "5712345678"
assert process_mobile(None) == ""
assert process_mobile("") == ""
```

**3. Policy Number Formatting:**
```python
# Test cases
assert format_policy("MED/2023/230/10/254") == "MED.2023.230.10.254"
assert format_policy("L0/2024/100") == "L0.2024.100"
```

### **Integration Testing:**

**1. API Connectivity:**
```bash
# Test API endpoint
curl -X POST "https://api.zwennpay.com:9425/api/v1.0/Common/GetMerchantQR" \
  -H "Content-Type: application/json" \
  -d '{"MerchantId": 153, ...}'
```

**2. QR Code Scanning:**
- Generate test QR code
- Scan with mobile banking apps
- Verify payment details display correctly

**3. PDF Generation:**
- Generate sample letter
- Verify QR section positioning
- Check logo quality and alignment

### **Error Scenario Testing:**

**1. API Timeout:**
```python
# Simulate timeout
response = requests.post(url, json=payload, timeout=0.001)
# Verify graceful handling
```

**2. Invalid Response:**
```python
# Test with null/empty responses
qr_data = "null"
# Verify letter generates without QR
```

**3. Missing Logo Files:**
```python
# Rename logo files temporarily
# Verify letter generates with warnings
```

---

## 📱 **Mobile Banking App Compatibility**

### **Supported Apps:**
- ✅ **Juice** (MCB)
- ✅ **MauBank WithMe** (Mauritius Commercial Bank)
- ✅ **Blink** (SBM Bank)
- ✅ **MyT Money** (Mauritius Telecom)
- ✅ **Other MauCAS-compatible apps**

### **Scanning Process:**
1. Customer opens mobile banking app
2. Selects "Scan to Pay" or "QR Payment" option
3. Scans QR code from letter
4. App displays:
   - Merchant: NIC General Insurance Co. Ltd
   - Bill Number: Policy number
   - Customer: Name initial + surname
   - Purpose: Arrears Payment
5. Customer enters payment amount
6. Confirms and completes payment

### **Payment Tracking:**
- Policy number embedded in QR enables automatic allocation
- Mobile number enables SMS confirmation
- Customer label helps manual verification if needed

---

## 🔧 **Troubleshooting Guide**

### **Common Issues:**

#### **Issue 1: QR Code Not Generating**

**Symptoms:**
- Warning message: "⚠️ No valid QR data received"
- Letter generated without QR section

**Possible Causes:**
1. API connectivity issues
2. Invalid merchant ID
3. Network timeout
4. API service downtime

**Solutions:**
```bash
# Test API connectivity
curl -X POST "https://api.zwennpay.com:9425/api/v1.0/Common/GetMerchantQR" \
  -H "Content-Type: application/json" \
  -d '{"MerchantId": 153}'

# Check network connectivity
ping api.zwennpay.com

# Verify timeout setting
# Increase timeout if network is slow
timeout=30  # Instead of 20
```

#### **Issue 2: QR Code Not Scanning**

**Symptoms:**
- Mobile app cannot read QR code
- "Invalid QR code" error

**Possible Causes:**
1. Low print quality
2. QR code too small
3. Damaged/smudged print

**Solutions:**
```python
# Increase QR code size
qr_size = 100  # Instead of 80

# Increase scale for better quality
qr.save(qr_filename, scale=10, border=2)  # Instead of scale=8

# Use higher error correction
qr = segno.make(qr_data, error='M')  # Instead of 'L'
```

#### **Issue 3: Logos Not Displaying**

**Symptoms:**
- Warning: "⚠️ Warning: maucas2.jpeg not found"
- QR section missing logos

**Possible Causes:**
1. Logo files missing from backend folder
2. Incorrect file names
3. File permission issues

**Solutions:**
```bash
# Check if logo files exist
ls -la backend/*.jpg backend/*.jpeg

# Verify file names match exactly
# maucas2.jpeg (not maucas.jpeg or MauCAS2.jpeg)
# zwennPay.jpg (not zwennpay.jpg or ZwennPay.jpg)

# Check file permissions
chmod 644 backend/*.jpg backend/*.jpeg
```

#### **Issue 4: QR Section Cut Off in Print**

**Symptoms:**
- QR code or logos cut off at page bottom
- Signature not visible

**Possible Causes:**
1. Insufficient space on page
2. Printer margins too large
3. Content spacing too generous

**Solutions:**
```python
# Reduce spacing throughout letter
y_pos -= 15  # Instead of 20

# Make QR section more compact
qr_size = 70  # Instead of 80
img_width = 80  # Instead of 90

# Check available space before QR section
if y_pos < 250:  # Minimum space needed
    # Adjust spacing or move to new page
```

---

## 📚 **Dependencies**

### **Python Libraries:**

```python
import requests      # HTTP API calls
import segno         # QR code generation
from reportlab.lib.utils import ImageReader  # Image handling
```

### **Installation:**
```bash
pip install requests segno reportlab
```

### **Version Requirements:**
- **requests**: >=2.25.0
- **segno**: >=1.4.0
- **reportlab**: >=3.6.0

---

## 🔄 **Future Enhancements**

### **Potential Improvements:**

**1. Dynamic Amount Embedding:**
```python
# Pre-fill payment amount in QR
"SetTransactionAmount": True,
"TransactionAmount": float(true_arrears)
```

**Benefits:**
- Customer doesn't need to enter amount
- Reduces payment errors
- Faster payment process

**2. QR Code Caching:**
```python
# Cache QR codes for repeated use
qr_cache = {}
if policy_no in qr_cache:
    qr_filename = qr_cache[policy_no]
else:
    qr_filename = generate_qr_code()
    qr_cache[policy_no] = qr_filename
```

**Benefits:**
- Faster batch processing
- Reduced API calls
- Lower network dependency

**3. Retry Logic:**
```python
# Retry failed API calls
max_retries = 3
for attempt in range(max_retries):
    try:
        response = call_api()
        if response.ok:
            break
    except:
        if attempt == max_retries - 1:
            # Final failure
            qr_filename = None
```

**Benefits:**
- Better resilience
- Higher success rate
- Handles temporary network issues

**4. QR Code Analytics:**
```python
# Track QR generation success rate
qr_stats = {
    'total': 0,
    'success': 0,
    'failed': 0,
    'api_errors': 0,
    'network_errors': 0
}
```

**Benefits:**
- Monitor system health
- Identify issues early
- Optimize performance

---

## 📞 **Support & Contacts**

### **Technical Support:**
- **ZwennPay API**: support@zwennpay.com
- **MauCAS System**: support@maucas.mu
- **NICL IT Team**: it@nicl.mu

### **API Documentation:**
- **ZwennPay API Docs**: https://api.zwennpay.com/docs
- **MauCAS Integration Guide**: https://maucas.mu/integration

### **Emergency Contacts:**
- **API Issues**: +230 xxx xxxx (ZwennPay Support)
- **Payment Issues**: +230 602 3000 (NICL Customer Service)

---

## 📝 **Change Log**

### **Version 1.0 (Current)**
- Initial implementation
- MauCAS QR code integration
- ZwennPay API integration
- Logo embedding (MauCAS + ZwennPay)
- Error handling and graceful degradation
- Batch processing support

### **Future Versions:**
- v1.1: Dynamic amount embedding
- v1.2: QR code caching
- v1.3: Retry logic implementation
- v1.4: Analytics and monitoring

---

**Document Version:** 1.0  
**Last Updated:** November 7, 2024  
**Author:** NICL IT Team  
**Status:** Production Ready
