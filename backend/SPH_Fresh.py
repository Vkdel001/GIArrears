# -*- coding: utf-8 -*-
# Import necessary libraries for data handling, HTTP requests, QR code generation, and PDF creation
import pandas as pd
import sys
import io
from datetime import datetime

# Set UTF-8 encoding for stdout to handle Unicode characters
if sys.stdout.encoding != 'utf-8':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
import requests
import segno
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.platypus import Table, TableStyle, Paragraph
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.enums import TA_JUSTIFY
from reportlab.lib.colors import gray

import os
import re
from datetime import datetime
from reportlab.lib.utils import ImageReader
from PyPDF2 import PdfFileReader, PdfFileWriter

# Verify font files exist
cambria_regular_path = os.path.join(os.path.dirname(__file__), 'fonts', 'cambria.ttf')
cambria_bold_path = os.path.join(os.path.dirname(__file__), 'fonts', 'cambriab.ttf')

if not os.path.isfile(cambria_regular_path):
    raise FileNotFoundError(f"Font file not found: {cambria_regular_path}")
if not os.path.isfile(cambria_bold_path):
    raise FileNotFoundError(f"Font file not found: {cambria_bold_path}")

# Register Cambria fonts
try:
    pdfmetrics.registerFont(TTFont('Cambria', cambria_regular_path))
    pdfmetrics.registerFont(TTFont('Cambria-Bold', cambria_bold_path))
    print("[OK] Cambria (from cambria.ttf) and Cambria-Bold (from cambriab.ttf) fonts registered successfully")
except Exception as e:
    raise Exception(f"Failed to register fonts: {str(e)}")

# Read the Excel file containing policyholder data
# Robust Excel file loading with multiple fallback locations
def load_excel_file():
    """Load Excel file from multiple possible locations with error handling"""
    possible_files = [
        "Generic_Template.xlsx",  # Primary location (root)
        "temp_uploads/Generic_Template.xlsx",  # Server upload location
        "Generic_template.xlsx",  # Case variation
        "temp_uploads/Generic_template.xlsx",  # Case variation in temp
    ]
    
    # Also check for any .xlsx files in current directory as fallback
    import glob
    xlsx_files = glob.glob("*.xlsx")
    possible_files.extend(xlsx_files)
    
    # Remove duplicates while preserving order
    seen = set()
    unique_files = []
    for f in possible_files:
        if f not in seen:
            seen.add(f)
            unique_files.append(f)
    
    print(f"[DEBUG] Looking for Excel file in these locations: {unique_files}")
    
    for file_path in unique_files:
        if os.path.exists(file_path):
            try:
                print(f"[INFO] Attempting to load: {file_path}")
                df = pd.read_excel(file_path, engine='openpyxl')
                
                # Validate the file has required columns
                required_cols = ['Policy No', 'Arrears Amount']
                available_cols = list(df.columns)
                missing_cols = [col for col in required_cols if col not in available_cols]
                
                if missing_cols:
                    print(f"[WARNING] File {file_path} missing required columns: {missing_cols}")
                    continue
                
                if len(df) == 0:
                    print(f"[WARNING] File {file_path} is empty")
                    continue
                
                print(f"[OK] Excel file loaded successfully from: {file_path}")
                print(f"[OK] Loaded {len(df)} rows with columns: {available_cols}")
                return df
                
            except Exception as e:
                print(f"[WARNING] Failed to load {file_path}: {str(e)}")
                continue
    
    # If we get here, no valid file was found
    print("[ERROR] No valid Excel file found!")
    print("[ERROR] Searched locations:")
    for f in unique_files:
        exists = "✓" if os.path.exists(f) else "✗"
        print(f"[ERROR]   {exists} {f}")
    
    print("[ERROR] Please ensure your Excel file is uploaded correctly")
    sys.exit(1)

# Load the Excel file using robust method
df = load_excel_file()

# Performance optimization for large files
total_rows = len(df)
if total_rows > 2000:
    print(f"[INFO] Large file detected: {total_rows} rows")
    print(f"[INFO] Estimated processing time: {total_rows * 2 / 60:.1f} minutes")
    print(f"[INFO] This may take a while - please be patient...")
elif total_rows > 5000:
    print(f"[WARNING] Very large file: {total_rows} rows")
    print(f"[WARNING] Processing may take 15-30 minutes")
    print(f"[WARNING] Consider splitting the file into smaller batches if timeout occurs")

# Create folders to store generated PDFs - dual folder structure
import sys
output_folder = "output_letters"  # Default folder

# Debug: Print all command line arguments
print(f"[DEBUG] Command line arguments: {sys.argv}")

# Check if output folder is passed as command line argument
if len(sys.argv) > 1:
    for i, arg in enumerate(sys.argv):
        if arg == '--output' and i + 1 < len(sys.argv):
            output_folder = sys.argv[i + 1]
            print(f"[DEBUG] Found --output argument: {output_folder}")
            break

# Create main folder and subfolders
os.makedirs(output_folder, exist_ok=True)
protected_folder = os.path.join(output_folder, "protected")
unprotected_folder = os.path.join(output_folder, "unprotected")
os.makedirs(protected_folder, exist_ok=True)
os.makedirs(unprotected_folder, exist_ok=True)

print(f"[INFO] Using output folder: {output_folder}")
print(f"[INFO] Protected PDFs folder: {protected_folder}")
print(f"[INFO] Unprotected PDFs folder: {unprotected_folder}")

# Define custom paragraph styles explicitly
styles = {}

# Define custom 'BodyText' style for body paragraphs (increased size)
styles['BodyText'] = ParagraphStyle(
    name='BodyText',
    fontName='Cambria',
    fontSize=10,
    leading=11,
    spaceAfter=4,
    alignment=TA_JUSTIFY
)

styles['disclaimerText'] = ParagraphStyle(
    name='disclaimerText',
    fontName='Cambria',
    fontSize=10.5,
    leading=10,
    spaceAfter=6,
    alignment=1,
    textColor=gray

)

# Define custom 'BoldText' style for headings (increased size)
styles['BoldText'] = ParagraphStyle(
    name='BoldText',
    fontName='Cambria-Bold',
    fontSize=10.5,
    leading=12,
    spaceAfter=4
)

# Define custom 'SalutationText' style for the "Dear..." line and address (increased size)
styles['SalutationText'] = ParagraphStyle(
    name='SalutationText',
    fontName='Cambria-Bold',
    fontSize=10,
    leading=6,
    spaceAfter=3
)

# Define custom 'FooterText' style for the absolute footer at the bottom
styles['FooterText'] = ParagraphStyle(
    name='FooterText',
    fontName='Cambria',
    fontSize=10.5,
    leading=13,
    spaceAfter=0,
    alignment=1  # Center alignment for footer text
)

# Define custom 'BodyFooterText' style for the "Kindly disregard..." text
styles['BodyFooterText'] = ParagraphStyle(
    name='BodyFooterText',
    fontName='Cambria',
    fontSize=10.5,
    leading=13,
    spaceAfter=6,
    alignment=0  # Left alignment
)

# Define custom 'TableText' style for table data to enforce center alignment
styles['TableText'] = ParagraphStyle(
    name='TableText',
    fontName='Cambria',
    fontSize=9,
    leading=11,
    spaceAfter=6,
    alignment=1
)

# Define custom 'TableTextBold' style for table headers
styles['TableTextBold'] = ParagraphStyle(
    name='TableTextBold',
    fontName='Cambria-Bold',
    fontSize=10,
    leading=11,
    spaceAfter=6,
    alignment=1
)

# Iterate through each row in the DataFrame to process individual policyholder data
for index, row in df.iterrows():
    # Enhanced progress reporting for large files
    total_rows = len(df)
    current_row = index + 1
    
    if total_rows > 1000:
        # For large files, show progress every 50 rows (more frequent updates)
        if current_row % 50 == 0 or current_row == 1 or current_row == total_rows:
            percentage = (current_row / total_rows) * 100
            print(f"[PROGRESS] Processing row {current_row} of {total_rows} ({percentage:.1f}%) - Starting PDF generation...")
    else:
        # For smaller files, show every row
        print(f"[PROCESSING] Row {current_row} of {total_rows}")
    
    # Extract relevant data from the current row
    owner1_title = row.get('Owner 1 Title', '')
    owner1_first_name = row.get('Owner 1 First Name', '')
    owner1_surname = row.get('Owner 1 Surname', '')
    assignee_surname = row.get('Assignee Surname Corrected', '')
    owner1_address1 = row.get('Owner 1 Policy Address 1', '')
    owner1_address2 = row.get('Owner 1 Policy Address 2', '')
    owner1_address3 = row.get('Owner 1 Policy Address 3', '')
    owner1_address4 = row.get('Owner 1 Policy Address 4', '')
    policy_no = str(row.get('Policy No', '')) if pd.notna(row.get('Policy No', '')) else ''
    policy_no_api = policy_no.replace('/', '.') if policy_no else ''
    print(f"[DEBUG] policy_no value = '{policy_no}' (type: {type(policy_no)})")
    print(f"[DEBUG] policy_no_api value = '{policy_no_api}' (type: {type(policy_no_api)})")
    frequency = row.get('Frequency', '')
    gross_premium = row.get('Computed Gross Premium', 0)
    no_installments = row.get('No of Instalments in Arrears', 0)
    arrears_amount = row.get('Arrears Amount', 0)
    agent_no = row.get('Agent No', '')
    
    # Extract additional columns for later use
    mobile_no = row.get('MOBILE_NO', '')
    nic = row.get('NIC', '')
    arrears_processing_date_raw = row.get('Arrears Processing Date', '')
    
    # Debug output for the extracted variables
    print(f"[DEBUG] Owner 1 First Name: '{owner1_first_name}'")
    print(f"[DEBUG] Owner 1 Surname: '{owner1_surname}'")
    print(f"[DEBUG] Mobile No: '{mobile_no}'")
    print(f"[DEBUG] NIC: '{nic}'")
    
    # Process arrears processing date
    if arrears_processing_date_raw and pd.notna(arrears_processing_date_raw):
        try:
            # Handle Excel serial date number (e.g., 45900.0901388889)
            if isinstance(arrears_processing_date_raw, (int, float)):
                # Convert Excel serial number to datetime
                date_obj = pd.to_datetime(arrears_processing_date_raw, origin='1899-12-30', unit='D')
                arrears_date_formatted = date_obj.strftime('%d-%B-%Y')  # "31-August-2025"
            else:
                # Handle string format "31/08/2025  02:09:48" (fallback)
                date_part = str(arrears_processing_date_raw).split()[0]
                date_obj = datetime.strptime(date_part, '%d/%m/%Y')
                arrears_date_formatted = date_obj.strftime('%d-%B-%Y')
        except:
            arrears_date_formatted = "29 August 2025"  # fallback
    else:
        arrears_date_formatted = "29 August 2025"  # fallback
    
    print(f"[DEBUG] Arrears Processing Date: '{arrears_processing_date_raw}' -> '{arrears_date_formatted}'")
    
    # Console log NIC value for each record
    print(f"[NIC] Record {index + 1}: NIC = '{nic}' (type: {type(nic)})")
    
    # Create full_name variable (first letter of first name + surname, max 24 chars)
    # Handle NaN and non-string values safely
    first_initial = ''
    if owner1_first_name and isinstance(owner1_first_name, str) and len(owner1_first_name) > 0 and owner1_first_name.lower() != 'nan':
        first_initial = owner1_first_name[0].upper()
    # Handle surname safely (check for NaN and non-string values)
    surname_part = ''
    if owner1_surname and isinstance(owner1_surname, str) and owner1_surname.lower() != 'nan':
        surname_part = owner1_surname.strip()
    
    # Combine and ensure max 24 characters
    if first_initial and surname_part:
        full_name_temp = f"{first_initial} {surname_part}"
        full_name = full_name_temp[:24] if len(full_name_temp) > 24 else full_name_temp
    elif surname_part:
        full_name = surname_part[:24] if len(surname_part) > 24 else surname_part
    else:
        full_name = ''
    
    print(f"[DEBUG] Full Name (max 24 chars): '{full_name}' (length: {len(full_name)})")
    
    # Validate required fields
    if pd.isna(policy_no) or str(policy_no).strip() == '':
        print(f"⚠️ Skipping row {index + 1}: Missing policy number")
        continue

    # Format values for use in the PDF
    name = f"{owner1_title} {owner1_first_name} {owner1_surname}"
    amount = float(arrears_amount) if pd.notna(arrears_amount) else 0.0
    no_installments = no_installments if pd.notna(no_installments) else 0
    gross_premium = float(gross_premium) if pd.notna(gross_premium) else 0.0

    # Sanitize name and policy number for safe filename creation using consistent method
    import sys
    sys.path.append('.')
    try:
        from filename_utils import sanitize_filename
        safe_name = sanitize_filename(name)
        safe_policy = sanitize_filename(str(policy_no))
    except ImportError:
        # Fallback to original method if filename_utils not available
        safe_name = re.sub(r'[^\w\s-]', '', name).strip().replace(' ', '_')
        safe_policy = re.sub(r'[^\w\s-]', '_', str(policy_no)).strip()

    # Generate QR Code for payment
    if total_rows > 1000 and current_row % 50 == 0:
        print(f"[PROGRESS] Row {current_row}: Generating QR code...")
    try:
        payload = {
            "MerchantId": 151,
            "SetTransactionAmount": False,
            "TransactionAmount": 0,
            "SetConvenienceIndicatorTip": False,
            "ConvenienceIndicatorTip": 0,
            "SetConvenienceFeeFixed": False,
            "ConvenienceFeeFixed": 0,
            "SetConvenienceFeePercentage": False,
            "ConvenienceFeePercentage": 0,
            "SetAdditionalBillNumber": True,
            "AdditionalRequiredBillNumber": False,
            "AdditionalBillNumber": str(policy_no_api),
            "SetAdditionalMobileNo": True,
            "AdditionalRequiredMobileNo": False,
            "AdditionalMobileNo": str(mobile_no),
            "SetAdditionalStoreLabel": False,
            "AdditionalRequiredStoreLabel": False,
            "AdditionalStoreLabel": "",
            "SetAdditionalLoyaltyNumber": False,
            "AdditionalRequiredLoyaltyNumber": False,
            "AdditionalLoyaltyNumber": "",
            "SetAdditionalReferenceLabel": False,
            "AdditionalRequiredReferenceLabel": False,
            "AdditionalReferenceLabel": "",
            "SetAdditionalCustomerLabel": True,
            "AdditionalRequiredCustomerLabel": False,
            "AdditionalCustomerLabel": str(full_name),
            "SetAdditionalTerminalLabel": False,
            "AdditionalRequiredTerminalLabel": False,
            "AdditionalTerminalLabel": "",
            "SetAdditionalPurposeTransaction": True,
            "AdditionalRequiredPurposeTransaction": False,
            "AdditionalPurposeTransaction": str(nic)
        }
        
        if total_rows > 1000 and current_row % 50 == 0:
            print(f"[PROGRESS] Row {current_row}: Making API call for QR code...")
        
        response = requests.post(
            "https://api.zwennpay.com:9425/api/v1.0/Common/GetMerchantQR",
            headers={"accept": "text/plain", "Content-Type": "application/json"},
            json=payload,
            timeout=20
        )
        
        if response.status_code == 200:
            qr_data = str(response.text).strip()
            if not qr_data or qr_data.lower() in ('null', 'none', 'nan'):
                print(f"⚠️ No valid QR data received for {name}")
                continue
                
            qr = segno.make(qr_data, error='L')
            qr_filename = f"qr_{safe_policy}.png"
            qr.save(qr_filename, scale=8, border=2, dark='#000000')
        else:
            print(f"❌ API request failed for {name}: {response.status_code} - {response.text}")
            continue

    except requests.exceptions.RequestException as e:
        print(f"⚠️ Network error while generating QR for {name}: {str(e)}")
        continue
    except Exception as e:
        print(f"⚠️ Error generating QR for {name}: {str(e)}")
        continue

    # Create PDF filenames for both protected and unprotected versions
    protected_pdf_filename = f"{protected_folder}/{safe_policy}_{safe_name}.pdf"
    unprotected_pdf_filename = f"{unprotected_folder}/{safe_policy}_{safe_name}.pdf"
    
    if total_rows > 1000 and current_row % 50 == 0:
        print(f"[PROGRESS] Row {current_row}: Creating PDF document...")
    
    # Create unprotected PDF first
    c = canvas.Canvas(unprotected_pdf_filename, pagesize=A4)
    width, height = A4
    margin = 50
    bottom_margin = 60  # Increased for pre-printed stationery address space
    y_pos = height - margin - 80

    # Store the top position of the date
    date_top_y = y_pos

    # Add arrears processing date from Excel file
    date_para = Paragraph(f"{arrears_date_formatted}", styles['SalutationText'])
    date_para.wrapOn(c, width - margin, height)
    date_para.drawOn(c, margin, y_pos - date_para.height)
    y_pos -= date_para.height + 12

    # Add recipient address
    address_lines = [name]
    if pd.notna(owner1_address1):
        address_lines.append(str(owner1_address1))
    if pd.notna(owner1_address2):
        address_lines.append(str(owner1_address2))
    if pd.notna(owner1_address3):
        address_lines.append(str(owner1_address3))
    if pd.notna(owner1_address4):
        address_lines.append(str(owner1_address4))
    
    for line in address_lines:
        addr_para = Paragraph(line.upper(), styles['SalutationText'])
        addr_para.wrapOn(c, width - 2 * margin, height)
        addr_para.drawOn(c, margin, y_pos - addr_para.height)
        y_pos -= addr_para.height + 6
    y_pos -= 8  # Increased space between address and salutation

    # Add salutation
    salutation_text = f"Dear {owner1_title} {owner1_surname},"
    salutation = Paragraph(salutation_text, styles['BodyText'])
    salutation.wrapOn(c, width - 2 * margin, height)
    salutation.drawOn(c, margin, y_pos - salutation.height)
    y_pos -= salutation.height + 4

    # Add subject line
    subject = Paragraph("RE: ARREARS ON YOUR LIFE INSURANCE POLICY", styles['BoldText'])
    subject.wrapOn(c, width - 2 * margin, height)
    subject.drawOn(c, margin, y_pos - subject.height)
    y_pos -= subject.height + 4

    # Add new introductory paragraph (matching new format)
    intro_text = f"At NIC, we value the trust you have placed in us to protect what matters most— your financial future & that of your loved ones. We are writing to remind you that your life insurance policy shows a <font name='Cambria-Bold'>premium amount in arrears as shown below:</font>"
    intro = Paragraph(intro_text, styles['BodyText'])
    intro.wrapOn(c, width - 2 * margin, height)
    intro.drawOn(c, margin, y_pos - intro.height)
    y_pos -= intro.height + 8  # Increased breathing space before table

    # Create and draw policy details table (new 4-column format)
    table_headers = [
        Paragraph('Policy No.', styles['TableTextBold']),
        Paragraph('Payment Frequency', styles['TableTextBold']),
        Paragraph('Premium Amount (MUR)', styles['TableTextBold']),
        Paragraph('Total Premium in Arrears (MUR)', styles['TableTextBold'])
    ]
    table_data = [
        [
            Paragraph(str(policy_no), styles['TableText']),
            Paragraph(str(frequency), styles['TableText']),
            Paragraph(f"{gross_premium:,.2f}", styles['TableText']),
            Paragraph(f"{amount:,.2f}", styles['TableText'])
        ]
    ]
    data = [table_headers] + table_data
    # Adjust column widths to use full text width (total: ~495px for A4 with 50px margins)
    table = Table(data, colWidths=[120, 120, 125, 130])
    table.setStyle(TableStyle([
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, -1), 'Cambria'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.black),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('ROWHEIGHT', (0, 0), (-1, -1), 20),
        ('LEFTPADDING', (0, 0), (-1, -1), 3),
        ('RIGHTPADDING', (0, 0), (-1, -1), 3),
        ('TEXTWRAP', (0, 0), (-1, -1), 'CJK'),
    ]))
    table_width, table_height = table.wrap(width - 2 * margin, 0)
    table.drawOn(c, margin, y_pos - table_height)
    y_pos -= table_height + 10  # Increased breathing space after table

    # Add new body content (matching new format)
    text1 = "Keeping your policy up to date is not only about making a payment. It ensures:"
    para1 = Paragraph(text1, styles['BodyText'])
    para1.wrapOn(c, width - 2 * margin, height)
    para1.drawOn(c, margin, y_pos - para1.height)
    y_pos -= para1.height + 4

    # Function to draw a professional checkmark
    def draw_checkmark(canvas, x, y, size=8):
        """Draw a professional green checkmark at the specified position"""
        canvas.setStrokeColor(colors.green)
        canvas.setLineWidth(1.5)
        # Draw checkmark as two connected lines
        canvas.line(x, y, x + size/3, y - size/3)  # First part of check
        canvas.line(x + size/3, y - size/3, x + size, y + size/3)  # Second part of check
    
    # Add checkmark bullet points with drawn checkmarks
    # Point 1: Continuity of Protection
    text2 = "<font name='Cambria-Bold'>Continuity of Protection:</font> You and your family remain covered against life's unexpected events. Even a short lapse could mean losing valuable protection just when it is most needed."
    para2 = Paragraph(text2, styles['BodyText'])
    para2.wrapOn(c, width - 2 * margin - 25, height)
    # Position checkmark to align with first line of text (lower position)
    draw_checkmark(c, margin + 10, y_pos - 8, 8)
    para2.drawOn(c, margin + 25, y_pos - para2.height)
    y_pos -= para2.height + 3

    # Point 2: Growth of Your Savings
    text3 = "<font name='Cambria-Bold'>Growth of Your Savings:</font> Every premium contributes to building long-term savings that support your financial goals,be it retirement, children's education, funding your dream project, or financial security."
    para3 = Paragraph(text3, styles['BodyText'])
    para3.wrapOn(c, width - 2 * margin - 25, height)
    # Position checkmark to align with first line of text (lower position)
    draw_checkmark(c, margin + 10, y_pos - 8, 8)
    para3.drawOn(c, margin + 25, y_pos - para3.height)
    y_pos -= para3.height + 3

    # Point 3: Peace of Mind
    text4 = "<font name='Cambria-Bold'>Peace of Mind:</font> By keeping your insurance policy lapse-free and premium up to date, you can live with confidence, knowing that your financial safety net is intact for you and your dear ones."
    para4 = Paragraph(text4, styles['BodyText'])
    para4.wrapOn(c, width - 2 * margin - 25, height)
    # Position checkmark to align with first line of text (lower position)
    draw_checkmark(c, margin + 10, y_pos - 8, 8)
    para4.drawOn(c, margin + 25, y_pos - para4.height)
    y_pos -= para4.height + 8  # Breathing space before next paragraph

    text6 = "Accordingly we encourage you to settle your outstanding premium at the earliest opportunity to ensure uninterrupted cover and continued growth of your savings and by acting now, you avoid the risk of:"
    para6 = Paragraph(text6, styles['BodyText'])
    para6.wrapOn(c, width - 2 * margin, height)
    para6.drawOn(c, margin, y_pos - para6.height)
    y_pos -= para6.height + 3

    # Add bullet points for risks (more compact)
    text7 = "• Losing valuable accumulated benefits;"
    para7 = Paragraph(text7, styles['BodyText'])
    para7.wrapOn(c, width - 2 * margin - 10, height)
    para7.drawOn(c, margin + 10, y_pos - para7.height)
    y_pos -= para7.height + 2

    text8 = "• Facing delays, reinstatement requirements, or medical reviews if the policy lapses; and"
    para8 = Paragraph(text8, styles['BodyText'])
    para8.wrapOn(c, width - 2 * margin - 10, height)
    para8.drawOn(c, margin + 10, y_pos - para8.height)
    y_pos -= para8.height + 2

    text9 = "• Exposing your loved ones to uncertainty at a time when security matters most."
    para9 = Paragraph(text9, styles['BodyText'])
    para9.wrapOn(c, width - 2 * margin - 10, height)
    para9.drawOn(c, margin + 10, y_pos - para9.height)
    y_pos -= para9.height + 6

    # Add new line for payment facilities (not a bullet point)
    text_payment_facilities = "Should you wish to avail of a facility to settle your arrears, kindly contact us on +230 602 3315 for assistance."
    para_payment_facilities = Paragraph(text_payment_facilities, styles['BodyText'])
    para_payment_facilities.wrapOn(c, width - 2 * margin, height)
    para_payment_facilities.drawOn(c, margin, y_pos - para_payment_facilities.height)
    y_pos -= para_payment_facilities.height + 10  # Increased breathing space after this section

    # Add "How to Settle Quickly and Easily?" section in black
    text10 = "<font name='Cambria-Bold'>How to Settle Quickly and Easily?</font>"
    para10 = Paragraph(text10, styles['BoldText'])
    para10.wrapOn(c, width - 2 * margin, height)
    para10.drawOn(c, margin, y_pos - para10.height)
    y_pos -= para10.height + 3

    text11 = "Payment can be made through online, mobile app, branches or bank transfer. For your convenience, you may also settle payments instantly via the MauCAS QR Code (Scan to Pay) below using any mobile banking app such as Juice, MauBank WithMe, Blink, MyT Money, or other supported applications."
    para11 = Paragraph(text11, styles['BodyText'])
    para11.wrapOn(c, width - 2 * margin, height)
    para11.drawOn(c, margin, y_pos - para11.height)
    y_pos -= para11.height + 10  # Space before QR code section

    # Compact QR code section with logos for single page layout
    if os.path.exists(qr_filename):
        page_center_x = width / 2
        
        # Add maucas logo (bigger size using available space)
        if os.path.exists("maucas2.jpeg"):
            img = ImageReader("maucas2.jpeg")
            img_width = 110  # Increased from 85 to 110 for better visibility on letterhead
            img_height = img_width * (img.getSize()[1] / img.getSize()[0])
            logo_x = page_center_x - (img_width / 2)
            c.drawImage(img, logo_x, y_pos - img_height, width=img_width, height=img_height)
            y_pos -= img_height + 2
        elif os.path.exists("maucas.jpeg"):
            img = ImageReader("maucas.jpeg")
            img_width = 110  # Increased from 85 to 110 for better visibility on letterhead
            img_height = img_width * (img.getSize()[1] / img.getSize()[0])
            logo_x = page_center_x - (img_width / 2)
            c.drawImage(img, logo_x, y_pos - img_height, width=img_width, height=img_height)
            y_pos -= img_height + 2
        
        # Add QR code (optimal size for scanning)
        qr_size = 100  # Back to 100px for reliable scanning
        qr_x = page_center_x - (qr_size / 2)
        c.drawImage(qr_filename, qr_x, y_pos - qr_size, width=qr_size, height=qr_size)
        y_pos -= qr_size + 2
        
        # Add ZwennPay logo (smaller size)
        if os.path.exists("zwennPay.jpg"):
            zwenn_img = ImageReader("zwennPay.jpg")
            zwenn_width = 50  # Smaller for compact layout
            zwenn_height = zwenn_width * (zwenn_img.getSize()[1] / zwenn_img.getSize()[0])
            zwenn_x = page_center_x - (zwenn_width / 2)
            c.drawImage(zwenn_img, zwenn_x, y_pos - zwenn_height, width=zwenn_width, height=zwenn_height)
            y_pos -= zwenn_height + 4
        else:
            print(f"⚠️ Warning: zwennPay.jpg not found - skipping ZwennPay logo")
            y_pos -= 4
    else:
        print(f"⚠️ Warning: QR code file not found - skipping QR section")
        y_pos -= 8

    # Compact footer section for single page (move closer to QR)
    footer_start_y = y_pos - 2
    
    # Compact footer format
    footer1 = Paragraph(
        "<i>If you have already settled this amount, please accept our thanks and disregard this reminder.</i>",
        styles['BodyText']
    )
    footer1.wrapOn(c, width - 2 * margin, height)
    footer1.drawOn(c, margin, footer_start_y - footer1.height)

    # Add NIC tagline (with more breathing space)
    tagline_y_pos = footer_start_y - footer1.height - 6  # Increased breathing space before tagline
    tagline = Paragraph(
        "We appreciate your commitment for protection and financial wellbeing<br/><font name='Cambria-Bold'>NIC - Serving you, Serving the Nation</font>",
        styles['BodyText']
    )
    tagline.wrapOn(c, width - 2 * margin, height)
    tagline.drawOn(c, margin, tagline_y_pos - tagline.height)
    
    # Add assignee surname if present (between NIC tagline and computer generated statement)
    assignee_y_pos = tagline_y_pos - tagline.height - 8  # Small gap after NIC tagline
    if assignee_surname and pd.notna(assignee_surname) and str(assignee_surname).strip():
        assignee_text = str(assignee_surname).strip()
        assignee_para = Paragraph(
            f"{assignee_text}",
            styles['BodyText']
        )
        assignee_para.wrapOn(c, width - 2 * margin, height)
        assignee_para.drawOn(c, margin, assignee_y_pos - assignee_para.height)
        assignee_y_pos -= assignee_para.height + 8  # Gap after assignee name
    
    # Add computer generated statement in grey color (center aligned, pushed lower)
    computer_generated_y_pos = assignee_y_pos - 17  # Spacing before computer generated statement
    
    # Create center-aligned style for computer generated statement
    computer_generated_style = ParagraphStyle(
        name='ComputerGenerated',
        fontName='Cambria',
        fontSize=9,
        leading=11,
        alignment=1,  # Center alignment
        textColor=colors.grey
    )
    
    computer_generated = Paragraph(
        "This is a computer generated statement and requires no signature",
        computer_generated_style
    )
    computer_generated.wrapOn(c, width - 2 * margin, height)
    computer_generated.drawOn(c, margin, computer_generated_y_pos - computer_generated.height)

    # Save the unprotected PDF
    c.save()
    print(f"✅ Unprotected PDF saved: {unprotected_pdf_filename}")

    # Create password-protected version using customer's NIC
    try:
        if nic and str(nic).strip():
            password = str(nic).strip()
            
            # Read the unprotected PDF
            with open(unprotected_pdf_filename, 'rb') as input_file:
                reader = PdfFileReader(input_file)
                writer = PdfFileWriter()
                
                # Copy all pages
                for page_num in range(reader.getNumPages()):
                    writer.addPage(reader.getPage(page_num))
                
                # Encrypt with NIC as password
                writer.encrypt(password)
                
                # Write password-protected PDF to protected folder
                with open(protected_pdf_filename, 'wb') as output_file:
                    writer.write(output_file)
            
            print(f"🔒 Protected PDF saved with NIC password: {protected_pdf_filename}")
        else:
            # If no NIC, copy unprotected version to protected folder
            import shutil
            shutil.copy2(unprotected_pdf_filename, protected_pdf_filename)
            print(f"⚠️ No NIC found for {name}, copied unprotected PDF to both folders")
    except Exception as e:
        print(f"⚠️ Failed to create protected PDF: {str(e)}")
        # If password protection fails, copy unprotected version
        try:
            import shutil
            shutil.copy2(unprotected_pdf_filename, protected_pdf_filename)
            print(f"📄 Copied unprotected PDF to protected folder as fallback")
        except Exception as copy_error:
            print(f"❌ Failed to copy PDF: {str(copy_error)}")

    # Clean up QR code file
    if os.path.exists(qr_filename):
        os.remove(qr_filename)

    if total_rows > 1000 and current_row % 50 == 0:
        print(f"[PROGRESS] Row {current_row}: PDF completed successfully!")
    
    print(f"✅ PDFs generated successfully for {name}")
    print(f"   📁 Protected: {protected_pdf_filename}")
    print(f"   📁 Unprotected: {unprotected_pdf_filename}")

print(f"🎉 Script completed. Processed {len(df)} rows total.")