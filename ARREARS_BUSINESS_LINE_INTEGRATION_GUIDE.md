# Arrears Business Line Integration Guide

## Overview
This guide provides step-by-step instructions for adding new business lines (product types) to the NICL Arrears Letter Generation System. Follow this guide to avoid common pitfalls and ensure seamless integration.

## Current Business Lines
- **Health Insurance** (`health`) - Uses `Extracted_Arrears_Data.xlsx`
- **Non-Motors Insurance** (`nonmotor`) - Uses `NonMotor_Arrears.xlsx`

## Architecture Overview

The arrears system uses a **product-based configuration approach** where each business line has:
1. **Input File**: Excel file with arrears data
2. **Generator Script**: Python script to create individual PDFs
3. **Merger Script**: Python script to merge PDFs by recovery type
4. **Output Folders**: Directories for individual PDFs (L0, L1, L2, MED)
5. **Merged Folders**: Directories for merged PDFs by recovery type

## Step-by-Step Integration Process

### Step 1: Backend Configuration (CRITICAL)

**File**: `backend/routes/arrears.js`

Add your new business line to the `PRODUCT_CONFIG` object:

```javascript
const PRODUCT_CONFIG = {
    // Existing configurations...
    
    // NEW BUSINESS LINE TEMPLATE
    [YOUR_PRODUCT_KEY]: {
        name: 'Your Product Display Name',
        inputFile: 'Your_Input_File.xlsx',
        generator: 'Your_Generator_Script.py',
        merger: 'Your_Merger_Script.py',
        outputFolders: {
            L0: '../Your_L0_Folder',
            L1: '../Your_L1_Folder', 
            L2: '../Your_L2_Folder',
            MED: '../Your_MED_Folder'
        },
        mergedFolders: {
            L0: '../Your_L0_Merge_Folder',
            L1: '../Your_L1_Merge_Folder',
            L2: '../Your_L2_Merge_Folder', 
            MED: '../Your_MED_Merge_Folder'
        }
    }
};
```

**Example for Marine Insurance**:
```javascript
marine: {
    name: 'Marine Insurance',
    inputFile: 'Marine_Arrears.xlsx',
    generator: 'Marine_L0.py',
    merger: 'merge_marine_pdfs.py',
    outputFolders: {
        L0: '../Marine_L0',
        L1: '../Marine_L1',
        L2: '../Marine_L2',
        MED: '../Marine_MED'
    },
    mergedFolders: {
        L0: '../Marine_L0_Merge',
        L1: '../Marine_L1_Merge',
        L2: '../Marine_L2_Merge',
        MED: '../Marine_MED_Merge'
    }
}
```

### Step 2: Frontend Configuration

**File**: `frontend/src/components/arrears/ArrearsDashboard.jsx`

Add your product type to the `productTypeConfig` object:

```javascript
const productTypeConfig = {
    // Existing configurations...
    
    // NEW BUSINESS LINE TEMPLATE
    [YOUR_PRODUCT_KEY]: {
        name: 'Your Product Display Name',
        inputFile: 'Your_Input_File.xlsx',
        color: '#your-color-hex',
        icon: '🔷', // Choose appropriate emoji
        description: 'Your product description for arrears processing'
    }
};
```

**Example for Marine Insurance**:
```javascript
marine: {
    name: 'Marine Insurance',
    inputFile: 'Marine_Arrears.xlsx',
    color: '#0ea5e9',
    icon: '🚢',
    description: 'Marine insurance arrears processing'
}
```

### Step 3: Create Generator Script

**File**: `backend/Your_Generator_Script.py`

**CRITICAL REQUIREMENTS**:

1. **Use the correct output folder** (must match backend config)
2. **Handle Excel column mapping** for your business line
3. **Include proper error handling and logging**
4. **Generate PDFs with consistent naming convention**

**Template Structure**:
```python
# -*- coding: utf-8 -*-
# NICL [Your Business Line] Insurance Arrears Letter Generation Script

import pandas as pd
import sys
import os
from datetime import datetime
# ... other imports

# Read Excel file
try:
    df = pd.read_excel("Your_Input_File.xlsx", engine='openpyxl')
    print(f"[OK] Excel file loaded successfully with {len(df)} rows")
except FileNotFoundError:
    print("[ERROR] Excel file 'Your_Input_File.xlsx' not found")
    sys.exit(1)

# Create output folder (MUST match backend config)
output_folder = "Your_L0_Folder"  # Match outputFolders.L0 in backend config
os.makedirs(output_folder, exist_ok=True)
print(f"[INFO] Using output folder: {output_folder}")

# Process each row
for index, row in df.iterrows():
    # Extract data based on your Excel columns
    policy_holder = str(row.get('Policy Holder Column', ''))
    policy_no = str(row.get('Policy Number Column', ''))
    outstanding_amount = row.get('Outstanding Amount Column', 0)
    # ... map other columns
    
    # Validation logic
    if not policy_no or not policy_holder:
        print(f"⚠️ Skipping row {index + 1}: Missing essential data")
        continue
    
    if float(outstanding_amount) < 100:
        print(f"⚠️ Skipping row {index + 1}: Amount too low")
        continue
    
    # Generate PDF
    pdf_filename = f"{output_folder}/{index+1:03d}_YourProduct_L0_{policy_no}_arrears.pdf"
    # ... PDF generation logic
    
    print(f"✅ Generated: {pdf_filename}")

print(f"🎉 [Your Business Line] letter generation completed!")
```

### Step 4: Create Merger Script

**File**: `backend/Your_Merger_Script.py`

**CRITICAL REQUIREMENTS**:

1. **Use correct input/output folders** (must match backend config)
2. **Handle PyMuPDF for reliable PDF merging**
3. **Include proper error handling**

**Template Structure**:
```python
#!/usr/bin/env python3
"""
[Your Business Line] Insurance Arrears PDF Merger
"""

import os
import glob
import sys
from datetime import datetime

try:
    import fitz  # PyMuPDF
    print("Using PyMuPDF (fitz) library")
except ImportError:
    print("❌ PyMuPDF not installed. Please install it:")
    print("pip install PyMuPDF")
    sys.exit(1)

def merge_your_product_pdfs():
    # Define folders (MUST match backend config)
    input_folder = "Your_L0_Folder"  # Match outputFolders.L0
    output_folder = "Your_L0_Merge_Folder"  # Match mergedFolders.L0
    
    # Check input folder
    if not os.path.exists(input_folder):
        print(f"❌ Error: Input folder '{input_folder}' not found!")
        return
    
    # Create output folder
    os.makedirs(output_folder, exist_ok=True)
    
    # Find PDF files
    pdf_files = glob.glob(os.path.join(input_folder, "*.pdf"))
    if not pdf_files:
        print(f"❌ No PDF files found in '{input_folder}'!")
        return
    
    pdf_files.sort()
    print(f"📄 Found {len(pdf_files)} PDF files to merge")
    
    # Create merged PDF
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    merged_filename = f"Merged_YourProduct_L0_Arrears_{timestamp}.pdf"
    merged_filepath = os.path.join(output_folder, merged_filename)
    
    try:
        merged_doc = fitz.open()
        
        for pdf_file in pdf_files:
            source_doc = fitz.open(pdf_file)
            merged_doc.insert_pdf(source_doc)
            source_doc.close()
        
        merged_doc.save(merged_filepath)
        merged_doc.close()
        
        print(f"✅ Successfully merged {len(pdf_files)} PDFs!")
        print(f"📄 Merged PDF saved as: {merged_filepath}")
        
    except Exception as e:
        print(f"❌ Error during merging: {str(e)}")

if __name__ == "__main__":
    print("🔄 Starting PDF merge process...")
    merge_your_product_pdfs()
    print("🎉 PDF merge process completed!")
```

### Step 5: Create Required Folders

Create the following folder structure in the `backend` directory:

```
backend/
├── Your_L0_Folder/          # Individual L0 PDFs
├── Your_L1_Folder/          # Individual L1 PDFs (if needed)
├── Your_L2_Folder/          # Individual L2 PDFs (if needed)
├── Your_MED_Folder/         # Individual MED PDFs (if needed)
├── Your_L0_Merge_Folder/    # Merged L0 PDFs
├── Your_L1_Merge_Folder/    # Merged L1 PDFs (if needed)
├── Your_L2_Merge_Folder/    # Merged L2 PDFs (if needed)
└── Your_MED_Merge_Folder/   # Merged MED PDFs (if needed)
```

### Step 6: Excel File Requirements

Your input Excel file must contain these **minimum required columns**:

**Essential Columns**:
- Policy Number (any name, e.g., "Policy No", "POL_NO")
- Policy Holder Name (any name, e.g., "Policy Holder", "POLICY_HOLDER")
- Outstanding Amount (any name, e.g., "Outstanding Amount", "TrueArrears")
- Address fields (can be combined or separate)

**Optional Columns**:
- Recovery Action (for multi-level processing: L0, L1, L2, MED)
- Email Address (for email functionality)
- Mobile Number (for QR code generation)
- Start Date, End Date (for policy period)

**Example Excel Structure**:
```
| Policy No | Policy Holder | Outstanding Amount | Address 1 | Address 2 | Address 3 | Recovery_action |
|-----------|---------------|-------------------|-----------|-----------|-----------|-----------------|
| MAR001    | John Doe      | 1500.00          | 123 Main  | Port Louis| Mauritius | L0              |
```

## Common Pitfalls and Solutions

### 1. **Folder Path Mismatch**
**Problem**: Frontend shows "0 files generated" even though PDFs exist
**Solution**: Ensure folder paths in backend config exactly match the actual folders used by scripts

### 2. **File Cleanup Issues**
**Problem**: Old files accumulate, showing incorrect counts
**Solution**: The backend now handles cleanup automatically, but ensure your scripts use the correct folder names

### 3. **Column Mapping Errors**
**Problem**: Script fails to read Excel data
**Solution**: Check exact column names in Excel and map them correctly in your generator script

### 4. **Download Issues**
**Problem**: Downloads fail or show wrong files
**Solution**: Ensure productType is passed correctly in all API calls

### 5. **PDF Generation Failures**
**Problem**: PDFs not generated or corrupted
**Solution**: Include proper error handling and validation in generator script

## Testing Checklist

Before deploying a new business line, test the following:

### Backend Testing
- [ ] Configuration added to `PRODUCT_CONFIG`
- [ ] All folder paths are correct
- [ ] Generator script runs without errors
- [ ] Merger script runs without errors
- [ ] Files are created in correct folders

### Frontend Testing
- [ ] Product type appears in selection dropdown
- [ ] Upload works with correct Excel file
- [ ] File counts display correctly
- [ ] Generate button works
- [ ] Merge button works
- [ ] Downloads work for individual and merged files

### Integration Testing
- [ ] Upload → Generate → Merge → Download workflow works end-to-end
- [ ] File cleanup works (old files are removed)
- [ ] Progress tracking works
- [ ] Error handling works for invalid data

## Maintenance Notes

### Adding Recovery Levels
If your business line needs different recovery levels (not just L0), update:
1. Backend config `outputFolders` and `mergedFolders`
2. Generator script to handle different recovery actions
3. Create separate merger scripts or modify existing one

### Customizing PDF Templates
Each business line can have its own PDF template by:
1. Modifying the PDF generation section in the generator script
2. Using different logos, colors, or layouts
3. Adjusting bank account information or QR codes

### Email Templates
For business-line-specific email templates:
1. Update `backend/services/brevoService.js`
2. Add product-type-specific email templates
3. Modify email sending logic to use appropriate templates

## Support and Troubleshooting

### Log Files
Check these locations for debugging:
- Backend console output during generation/merging
- Browser console for frontend errors
- Network tab for API call failures

### Common Error Messages
- "Script not found": Check file paths in backend config
- "No files found": Check folder paths and file generation
- "Download failed": Check productType parameter passing

### Performance Considerations
- Large Excel files (>1000 records) may take 10-20 minutes to process
- PDF merging is faster (3-5 minutes for large files)
- Consider batch processing for very large datasets

## Example: Complete Marine Insurance Integration

Here's a complete example of adding Marine Insurance:

### 1. Backend Config Addition
```javascript
marine: {
    name: 'Marine Insurance',
    inputFile: 'Marine_Arrears.xlsx',
    generator: 'Marine_L0.py',
    merger: 'merge_marine_pdfs.py',
    outputFolders: {
        L0: '../Marine_L0',
        L1: '../Marine_L1',
        L2: '../Marine_L2',
        MED: '../Marine_MED'
    },
    mergedFolders: {
        L0: '../Marine_L0_Merge',
        L1: '../Marine_L1_Merge',
        L2: '../Marine_L2_Merge',
        MED: '../Marine_MED_Merge'
    }
}
```

### 2. Frontend Config Addition
```javascript
marine: {
    name: 'Marine Insurance',
    inputFile: 'Marine_Arrears.xlsx',
    color: '#0ea5e9',
    icon: '🚢',
    description: 'Marine insurance arrears processing'
}
```

### 3. File Structure
```
backend/
├── Marine_L0.py
├── merge_marine_pdfs.py
├── Marine_Arrears.xlsx
├── Marine_L0/
├── Marine_L0_Merge/
└── ... (other folders as needed)
```

This completes the integration of a new business line with minimal trial and error!

---

**Last Updated**: December 2024
**Version**: 1.0
**Maintainer**: NICL Development Team