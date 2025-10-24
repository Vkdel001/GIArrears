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
from reportlab.lib.enums import TA_JUSTIFY, TA_CENTER, TA_LEFT
from reportlab.lib.colors import gray, blue, Color

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
    print("[OK] Cambria fonts registered successfully")
except Exception as e:
    raise Exception(f"Failed to register fonts: {str(e)}")

# Read the Excel file containing renewal data
try:
    df = pd.read_excel("RENEWAL_LISTING.xlsx", engine='openpyxl')
    print(f"[OK] Excel file loaded successfully with {len(df)} rows")
    print(f"[INFO] Available columns: {list(df.columns)}")
    
    if len(df) == 0:
        print("[WARNING] Excel file is empty")
        sys.exit(1)
        
except FileNotFoundError:
    print("[ERROR] Excel file 'RENEWAL_LISTING.xlsx' not found in the current directory")
    sys.exit(1)
except Exception as e:
    print(f"[ERROR] Error reading Excel file: {str(e)}")
    sys.exit(1)

# Create output folder
output_folder = "output_renewals"
if len(sys.argv) > 1:
    for i, arg in enumerate(sys.argv):
        if arg == '--output' and i + 1 < len(sys.argv):
            output_folder = sys.argv[i + 1]
            break

os.makedirs(output_folder, exist_ok=True)
print(f"[INFO] Using output folder: {output_folder}")

# Define custom paragraph styles with proper spacing
styles = {}

styles['BodyText'] = ParagraphStyle(
    name='BodyText',
    fontName='Cambria',
    fontSize=10.5,
    leading=12,  # Further reduced to 12
    spaceAfter=6,  # Further reduced to 6
    alignment=TA_JUSTIFY
)

styles['BoldText'] = ParagraphStyle(
    name='BoldText',
    fontName='Cambria-Bold',
    fontSize=11,
    leading=15,
    spaceAfter=12
)

styles['SalutationText'] = ParagraphStyle(
    name='SalutationText',
    fontName='Cambria-Bold',
    fontSize=10.5,
    leading=13,
    spaceAfter=4  # Reduced spacing for address lines
)

styles['AddressText'] = ParagraphStyle(
    name='AddressText',
    fontName='Cambria-Bold',
    fontSize=10.5,
    leading=12,
    spaceAfter=3  # Even tighter spacing for address
)

styles['TableText'] = ParagraphStyle(
    name='TableText',
    fontName='Cambria',
    fontSize=9,
    leading=12,
    spaceAfter=4,
    alignment=TA_CENTER
)

styles['TableTextBold'] = ParagraphStyle(
    name='TableTextBold',
    fontName='Cambria-Bold',
    fontSize=9,
    leading=12,
    spaceAfter=4,
    alignment=TA_CENTER
)

# Define the correct blue color from the attachment (RGB: 70, 130, 180 - Steel Blue)
custom_blue = Color(70/255, 130/255, 180/255)

styles['BlueHeading'] = ParagraphStyle(
    name='BlueHeading',
    fontName='Cambria-Bold',
    fontSize=11,
    leading=13,  # Further reduced to 13
    spaceAfter=6,   # Further reduced to 6
    spaceBefore=5,  # Further reduced to 5
    textColor=custom_blue
)

styles['SmallText'] = ParagraphStyle(
    name='SmallText',
    fontName='Cambria',
    fontSize=9,
    leading=12,
    spaceAfter=8,
    alignment=TA_JUSTIFY
)

# Function to format dates
def format_date(date_value):
    if pd.isna(date_value):
        return ""
    try:
        if isinstance(date_value, (int, float)):
            date_obj = pd.to_datetime(date_value, origin='1899-12-30', unit='D')
        else:
            date_obj = pd.to_datetime(date_value)
        return date_obj.strftime('%d %B %Y')
    except:
        return str(date_value)

# Function to format currency (rounded to avoid decimals)
def format_currency(amount):
    try:
        rounded_amount = round(float(amount))  # Round to nearest whole number
        return f"MUR {rounded_amount:,}"  # No decimal places
    except:
        return "MUR 0"

# Function to add content with proper spacing
def add_paragraph(c, text, style, x, y, max_width):
    """Add a paragraph and return the new y position"""
    para = Paragraph(text, style)
    para.wrapOn(c, max_width, 1000)
    para.drawOn(c, x, y - para.height)
    return y - para.height - style.spaceAfter

# Function to check if new page is needed
def check_new_page(c, y_pos, required_space, width, height, margin):
    if y_pos < required_space:
        c.showPage()
        
        # Add NIC logo to new page as well
        if os.path.exists("NICLOGO.jpg"):
            nic_logo_img = ImageReader("NICLOGO.jpg")
            nic_logo_width = 120
            nic_logo_height = nic_logo_width * (nic_logo_img.getSize()[1] / nic_logo_img.getSize()[0])
            nic_logo_x = (width - nic_logo_width) / 2  # Center horizontally
            nic_logo_y = height - nic_logo_height - 20  # Top of page
            c.drawImage(nic_logo_img, nic_logo_x, nic_logo_y, width=nic_logo_width, height=nic_logo_height)
            
            # Return position below logo
            return nic_logo_y - 30
        else:
            return height - margin
    return y_pos# Process each row in the DataFrame
for index, row in df.iterrows():
    print(f"[PROCESSING] Row {index + 1} of {len(df)}")
    
    # Extract data from Excel columns
    pol_no = str(row.get('POL_NO', '')) if pd.notna(row.get('POL_NO', '')) else ''
    name = str(row.get('NAME', '')) if pd.notna(row.get('NAME', '')) else ''
    surname = str(row.get('SURNAME', '')) if pd.notna(row.get('SURNAME', '')) else ''
    title = str(row.get('TITLE', '')) if pd.notna(row.get('TITLE', '')) else ''
    address1 = str(row.get('ADDRESS1', '')) if pd.notna(row.get('ADDRESS1', '')) else ''
    address2 = str(row.get('ADDRESS2', '')) if pd.notna(row.get('ADDRESS2', '')) else ''
    address3 = str(row.get('ADDRESS3', '')) if pd.notna(row.get('ADDRESS3', '')) else ''
    
    # Policy dates
    expiry_from = row.get('EXPIRY_POL_FROM_DT', '')
    expiry_to = row.get('EXPIRY_POL_TO_DT', '')
    renewal_start = row.get('REN_POL_START_DT', '')
    renewal_end = row.get('REN_POL_TO_DT', '')
    
    # Policy details
    plan = str(row.get('PLAN', '')) if pd.notna(row.get('PLAN', '')) else ''
    cat_plan = str(row.get('CAT_PLAN', '')) if pd.notna(row.get('CAT_PLAN', '')) else ''
    inpatient_limit = row.get('INPATIENT_LIMIT', 0)
    outpatient_limit = row.get('OUTPATIENT_LIMIT', 0)
    cat_limit = row.get('CAT_LIMIT', 0)
    
    # Handle blank/nan values - replace with dash
    if pd.isna(cat_limit) or str(cat_limit).lower() in ['nan', 'none', '']:
        cat_limit_display = '-'
    else:
        cat_limit_display = f"{cat_limit:,.0f}"
    
    # Premium information
    total_premium = row.get('TOTAL_PREMIUM', 0)
    fsc_levy = row.get('FSC_LEVY', 0)
    
    # Additional fields for QR generation
    # Handle mobile number - convert from float to clean integer string (removes decimals)
    try:
        mobile_raw = row.get('MOB_NO', '')
        if pd.notna(mobile_raw) and mobile_raw != '':
            mobile_no = str(int(float(mobile_raw)))
        else:
            mobile_no = ''
    except (ValueError, TypeError):
        mobile_no = ''
    
    # Skip if essential data is missing
    if not pol_no or not name:
        print(f"⚠️ Skipping row {index + 1}: Missing essential data")
        continue
    
    # Create full customer name
    full_customer_name = f"{title} {name} {surname}".strip()
    
    # Create filename-safe names
    try:
        from filename_utils import sanitize_filename
        safe_name = sanitize_filename(full_customer_name)
        safe_policy = sanitize_filename(pol_no)
    except ImportError:
        safe_name = re.sub(r'[^\w\s-]', '', full_customer_name).strip().replace(' ', '_')
        safe_policy = re.sub(r'[^\w\s-]', '_', pol_no).strip()
    
    print(f"[DEBUG] Processing: {full_customer_name} - Policy: {pol_no}")
    
    # Format dates
    expiry_from_formatted = format_date(expiry_from)
    expiry_to_formatted = format_date(expiry_to)
    renewal_start_formatted = format_date(renewal_start)
    renewal_end_formatted = format_date(renewal_end)
    
    # Create cover period string
    cover_period = f"{expiry_from_formatted} to {expiry_to_formatted}"    
# Generate QR Code for payment
    qr_filename = None
    try:
        # Create first initial + surname for customer label (max 24 chars)
        first_initial = name[0].upper() if name and len(name) > 0 else ''
        surname_part = surname.strip() if surname else ''
        
        if first_initial and surname_part:
            customer_label_temp = f"{first_initial} {surname_part}"
            customer_label = customer_label_temp[:24] if len(customer_label_temp) > 24 else customer_label_temp
        elif surname_part:
            customer_label = surname_part[:24] if len(surname_part) > 24 else surname_part
        else:
            customer_label = ''
        
        # API payload for QR generation
        payload = {
            "MerchantId": 153,
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
            "AdditionalBillNumber": str(pol_no).replace('/', '.'),
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
            "AdditionalCustomerLabel": str(customer_label),
            "SetAdditionalTerminalLabel": False,
            "AdditionalRequiredTerminalLabel": False,
            "AdditionalTerminalLabel": "",
            "SetAdditionalPurposeTransaction": True,
            "AdditionalRequiredPurposeTransaction": False,
            "AdditionalPurposeTransaction": "Healthcare Renewal"
        }
        
        response = requests.post(
            "https://api.zwennpay.com:9425/api/v1.0/Common/GetMerchantQR",
            headers={"accept": "text/plain", "Content-Type": "application/json"},
            json=payload,
            timeout=20
        )
        
        if response.status_code == 200:
            qr_data = str(response.text).strip()
            if qr_data and qr_data.lower() not in ('null', 'none', 'nan'):
                qr = segno.make(qr_data, error='L')
                qr_filename = f"qr_{safe_policy}.png"
                qr.save(qr_filename, scale=8, border=2, dark='#000000')
                print(f"✅ QR code generated for {full_customer_name}")
            else:
                print(f"⚠️ No valid QR data received for {full_customer_name}")
        else:
            print(f"❌ API request failed for {full_customer_name}: {response.status_code}")

    except Exception as e:
        print(f"⚠️ Error generating QR for {full_customer_name}: {str(e)}")    # Create PDF
    pdf_filename = f"{output_folder}/{safe_policy}_{safe_name}.pdf"
    c = canvas.Canvas(pdf_filename, pagesize=A4)
    width, height = A4
    margin = 50
    content_width = width - 2 * margin
    
    # Add NIC logo at the top center of page 1
    if os.path.exists("NICLOGO.jpg"):
        nic_logo_img = ImageReader("NICLOGO.jpg")
        nic_logo_width = 120
        nic_logo_height = nic_logo_width * (nic_logo_img.getSize()[1] / nic_logo_img.getSize()[0])
        nic_logo_x = (width - nic_logo_width) / 2  # Center horizontally
        nic_logo_y = height - nic_logo_height - 20  # Top of page
        c.drawImage(nic_logo_img, nic_logo_x, nic_logo_y, width=nic_logo_width, height=nic_logo_height)
        
        # Start content below the NIC logo (reduced gap)
        y_pos = nic_logo_y - 12  # Reduced from 20 to 12
    else:
        print(f"⚠️ Warning: NICLOGO.jpg not found - skipping NIC logo")
        y_pos = height - margin
    
    # Add NIC I.sphere app QR codes (top right) - even larger size
    if os.path.exists("isphere_logo.jpg"):
        isphere_img = ImageReader("isphere_logo.jpg")
        isphere_width = 220  # Increased from 200 to 220 for better visibility
        isphere_height = isphere_width * (isphere_img.getSize()[1] / isphere_img.getSize()[0])
        # Align right edge of logo with text right margin (width - margin)
        isphere_x = width - margin - isphere_width
        isphere_y = y_pos - isphere_height - 5
        c.drawImage(isphere_img, isphere_x, isphere_y, width=isphere_width, height=isphere_height)
        
        # Adjust y_pos if isphere logo extends lower than current position
        if isphere_y < y_pos - 25:
            y_pos = isphere_y - 5
    else:
        print(f"⚠️ Warning: isphere_logo.jpg not found - skipping NIC I.sphere logo")
    
    # Add current date (top left) - positioned ABOVE address
    current_date = datetime.now().strftime("%d %B %Y")
    date_y_pos = height - 160  # Fixed position above address area
    date_para = Paragraph(current_date, styles['SalutationText'])
    date_para.wrapOn(c, content_width, height)
    date_para.drawOn(c, margin, date_y_pos)
    
    # Position customer address for window envelope (UNCHANGED - keeps horizontal alignment with I.sphere)
    # Window envelope positioning: address should be visible through window
    envelope_address_y = height - 180  # Approximately 90mm from top for window visibility
    envelope_address_x = margin   # Aligned with date and other text (removed indent)
    
    # Add customer address - positioned for window envelope (UNCHANGED)
    address_lines = [full_customer_name.upper()]
    if address1: address_lines.append(address1.upper())
    if address2: address_lines.append(address2.upper())
    if address3: address_lines.append(address3.upper())
    
    # Use fixed positioning for envelope window (UNCHANGED)
    temp_y = envelope_address_y
    for line in address_lines:
        addr_para = Paragraph(line, styles['AddressText'])
        addr_para.wrapOn(c, content_width - 20, height)
        addr_para.drawOn(c, envelope_address_x, temp_y)
        temp_y -= addr_para.height + 3
    
    # Update y_pos to continue below the address (minimal change)
    y_pos = min(y_pos - 20, temp_y - 8)
    
    # Continue with content below address or current y_pos, whichever is lower
    y_pos = min(y_pos - 8, temp_y - 8)  # Further reduced from 12 to 8
    
    # Add salutation
    y_pos = add_paragraph(c, "Dear Sir/ Madam", styles['BodyText'], margin, y_pos, content_width)
    
    # Add subject line with proper blue color and bold font
    subject_text = f"<font name='Cambria-Bold' color='#{hex(int(70))[2:].zfill(2)}{hex(int(130))[2:].zfill(2)}{hex(int(180))[2:].zfill(2)}'>RE: RENEWAL OF YOUR HEALTHCARE INSURANCE - POLICY ID {pol_no}</font>"
    y_pos = add_paragraph(c, subject_text, styles['BodyText'], margin, y_pos, content_width)
    y_pos -= 3  # Reduce space after subject
    
    # Add policy expiry notice
    expiry_text = f"We wish to inform you that your Healthcare Insurance Policy, as detailed hereunder, will expire on <font name='Cambria-Bold'>{expiry_to_formatted}</font> and is due for renewal."
    y_pos = add_paragraph(c, expiry_text, styles['BodyText'], margin, y_pos, content_width)
    y_pos -= 3  # Reduce space after expiry notice
    
    # Check if we need a new page for the table
    y_pos = check_new_page(c, y_pos, 150, width, height, margin)
    
    # Create policy details table
    table_headers = [
        Paragraph('<font name="Cambria-Bold">Cover Period</font>', styles['TableTextBold']),
        Paragraph('<font name="Cambria-Bold">Insured Name</font>', styles['TableTextBold']),
        Paragraph('<font name="Cambria-Bold">Plan(s)*</font>', styles['TableTextBold']),
        Paragraph('<font name="Cambria-Bold">Inpatient<br/>(MUR)</font>', styles['TableTextBold']),
        Paragraph('<font name="Cambria-Bold">Outpatient<br/>(MUR)</font>', styles['TableTextBold']),
        Paragraph('<font name="Cambria-Bold">Catastrophe<br/>(MUR)</font>', styles['TableTextBold'])
    ]
    
    # Format plan text properly
    plan_text = plan
    if cat_plan and cat_plan.strip():
        plan_text = f"{plan}<br/>{cat_plan}"
    
    table_data = [
        [
            Paragraph(cover_period, styles['TableText']),
            Paragraph(f"{name} {surname}", styles['TableText']),
            Paragraph(plan_text, styles['TableText']),
            Paragraph(f"{inpatient_limit:,.0f}", styles['TableText']),
            Paragraph(f"{outpatient_limit:,.0f}", styles['TableText']),
            Paragraph(cat_limit_display, styles['TableText'])
        ]
    ]
    
    data = [table_headers] + table_data
    
    # Calculate table width to match text margins exactly
    available_table_width = content_width  # Full width between margins
    
    # Distribute columns proportionally within available width
    col_widths = [
        available_table_width * 0.22,  # Cover Period - 22%
        available_table_width * 0.20,  # Insured Name - 20%
        available_table_width * 0.18,  # Plan(s) - 18%
        available_table_width * 0.13,  # Inpatient - 13%
        available_table_width * 0.13,  # Outpatient - 13%
        available_table_width * 0.14   # Catastrophe - 14%
    ]
    
    table = Table(data, colWidths=col_widths)
    table.setStyle(TableStyle([
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, -1), 'Cambria'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.black),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('ROWHEIGHT', (0, 0), (-1, -1), 30),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    
    # Table now spans exactly from left margin to right margin
    table_width, table_height = table.wrap(content_width, 0)
    table.drawOn(c, margin, y_pos - table_height)
    y_pos -= table_height + 8  # Reduced from 20 to 8
    
    # Add note about policy details (reduced spacing)
    y_pos = add_paragraph(c, "* Please refer to your Healthcare Insurance Policy for benefit details", styles['SmallText'], margin, y_pos, content_width)
    y_pos -= 3  # Reduced from 5 to 3    
# Check if we need a new page for the premium section
    y_pos = check_new_page(c, y_pos, 200, width, height, margin)
    
    # Add Renewal Premium section with proper blue heading
    y_pos = add_paragraph(c, '<font name="Cambria-Bold" color="#4682b4">RENEWAL PREMIUM</font>', styles['BlueHeading'], margin, y_pos, content_width)
    
    # Premium text
    premium_text = f"Considering a number of factors including, inter-alia, your claims history, medical inflation and prevailing market conditions, the renewal premium for the period <font name='Cambria-Bold'>{renewal_start_formatted} to {renewal_end_formatted}</font> will be <font name='Cambria-Bold'>{format_currency(total_premium)}</font> inclusive of FSC fee and other applicable fees. Should there be any major change in your claim ratio at expiry, the renewal premium may be subject to review."
    y_pos = add_paragraph(c, premium_text, styles['BodyText'], margin, y_pos, content_width)
    y_pos -= 10  # Added breathing space between premium text and bank transfer paragraph
    
    # Add bank transfer information paragraph
    bank_transfer_text = "Kindly fill in the Renewal acceptance form and submit together with payment or evidence of bank transfer on any of the following Account Numbers: Maubank (143100007063), MCB (000444155708) or SBM (61030100056840) for renewal and issuance of your Policy."
    y_pos = add_paragraph(c, bank_transfer_text, styles['BodyText'], margin, y_pos, content_width)
    
    # Add QR code and logo after the premium text
    if qr_filename and os.path.exists(qr_filename):
        # Add payment instruction
        y_pos = add_paragraph(c, "For your convenience, you may settle payments via the QR code below using apps such as Juice or MyT Money.", styles['BoldText'], margin, y_pos, content_width)
        y_pos -= 8  # Reduced spacing
        
        # Try to keep QR on same page - optimized space estimate
        qr_section_height = 180  # Reduced from 220 to 180 for better page utilization with multi-row tables
        if y_pos < qr_section_height:
            y_pos = check_new_page(c, y_pos, qr_section_height, width, height, margin)
        
        # Calculate center position and payment box dimensions (larger for better QR)
        page_center_x = width / 2
        payment_box_width = 170  # Increased from 150 to accommodate larger QR
        payment_box_padding = 12  # Slightly increased for better appearance
        
        # Calculate the total height needed for the payment box (larger QR)
        payment_box_top = y_pos
        temp_y = y_pos - payment_box_padding
        
        # Calculate positions for all elements to determine box height (larger sizes)
        if os.path.exists("maucas2.jpeg"):
            img = ImageReader("maucas2.jpeg")
            img_width = 110  # Increased for better visibility
            img_height = img_width * (img.getSize()[1] / img.getSize()[0])
            temp_y -= img_height + 4  # Slightly more spacing
        
        temp_y -= 100 + 4  # QR code size (increased to 100) + better spacing
        temp_y -= 12 + 4   # Text height + better spacing
        
        if os.path.exists("zwennPay.jpg"):
            zwenn_img = ImageReader("zwennPay.jpg")
            zwenn_width = 80  # Increased back to original size
            zwenn_height = zwenn_width * (zwenn_img.getSize()[1] / zwenn_img.getSize()[0])
            temp_y -= zwenn_height
        
        payment_box_bottom = temp_y - payment_box_padding
        payment_box_height = payment_box_top - payment_box_bottom
        
        # Payment box positioning (border removed for cleaner appearance)
        payment_box_x = page_center_x - (payment_box_width / 2)
        
        # Reset y_pos and add padding
        y_pos = payment_box_top - payment_box_padding
        
        # Add maucas logo (centered, larger size)
        if os.path.exists("maucas2.jpeg"):
            img = ImageReader("maucas2.jpeg")
            img_width = 110  # Increased for better visibility
            img_height = img_width * (img.getSize()[1] / img.getSize()[0])
            logo_x = page_center_x - (img_width / 2)
            c.drawImage(img, logo_x, y_pos - img_height, width=img_width, height=img_height)
            y_pos -= img_height + 4  # Slightly more spacing
        
        # Add QR code (centered, larger size for better scanning)
        qr_size = 100  # Increased from 85 to 100 for much better scanning
        qr_x = page_center_x - (qr_size / 2)
        c.drawImage(qr_filename, qr_x, y_pos - qr_size, width=qr_size, height=qr_size)
        y_pos -= qr_size + 4  # Slightly more spacing
        
        # Add "NIC Health Insurance" text below QR code (centered)
        c.setFont("Cambria-Bold", 11)  # Slightly larger font
        text_width = c.stringWidth("NIC Health Insurance", "Cambria-Bold", 11)
        text_x = page_center_x - (text_width / 2)
        c.drawString(text_x, y_pos - 10, "NIC Health Insurance")  # Better spacing
        y_pos -= 14  # Better spacing
        
        # Add ZwennPay logo below the text (centered)
        if os.path.exists("zwennPay.jpg"):
            zwenn_img = ImageReader("zwennPay.jpg")
            zwenn_width = 80
            zwenn_height = zwenn_width * (zwenn_img.getSize()[1] / zwenn_img.getSize()[0])
            zwenn_x = page_center_x - (zwenn_width / 2)
            c.drawImage(zwenn_img, zwenn_x, y_pos - zwenn_height, width=zwenn_width, height=zwenn_height)
            y_pos = payment_box_bottom - 15  # Position after the box
        else:
            print(f"⚠️ Warning: zwennPay.jpg not found - skipping ZwennPay logo")
            y_pos = payment_box_bottom - 15
    
    # Check if we need a new page for remaining content
    y_pos = check_new_page(c, y_pos, 250, width, height, margin)  # Reduced from 300
    
    # Add Special Terms section
    y_pos = add_paragraph(c, '<font name="Cambria-Bold" color="#4682b4">SPECIAL TERMS</font>', styles['BlueHeading'], margin, y_pos, content_width)
    
    y_pos = add_paragraph(c, "The following special terms shall apply to the renewed Policy:", styles['BodyText'], margin, y_pos, content_width)
    
    # Special terms list with proper indentation
    term1 = "1. Premium is payable upfront unless a Credit Facility Arrangement is entered into."
    y_pos = add_paragraph(c, term1, styles['BodyText'], margin + 15, y_pos, content_width - 15)
    
    term2 = "2. Capping or exclusion, if any, on the expiring cover period will be maintained on the renewal policy."
    y_pos = add_paragraph(c, term2, styles['BodyText'], margin + 15, y_pos, content_width - 15)
    y_pos -= 10
    
    # Add Possibility to Upgrade section
    y_pos = add_paragraph(c, '<font name="Cambria-Bold" color="#4682b4">POSSIBILITY TO UPGRADE YOUR BENEFITS</font>', styles['BlueHeading'], margin, y_pos, content_width)
    
    upgrade_text = "Subject to underwriting and applicable waiting periods, you are eligible to upgrade your present benefits. This will allow for a more comprehensive cover. Please refer to the attached options, detailed herewith. We invite you to advise on any upgrade you may wish to effect for timely implementation."
    y_pos = add_paragraph(c, upgrade_text, styles['BodyText'], margin, y_pos, content_width)
    
    # Check if we need a new page for remaining sections
    y_pos = check_new_page(c, y_pos, 200, width, height, margin)  # Reduced from 250
    
    # Add Renewal Procedure section
    y_pos = add_paragraph(c, '<font name="Cambria-Bold" color="#4682b4">RENEWAL PROCEDURE</font>', styles['BlueHeading'], margin, y_pos, content_width)
    
    procedure_text = "In order to avoid any interruption in cover, we would invite you to kindly complete the attached Renewal Acceptance Form and settle your renewal premium through your insurance advisor or by visiting one of our offices or through our digital facility put at your disposal."
    y_pos = add_paragraph(c, procedure_text, styles['BodyText'], margin, y_pos, content_width)
    
    # Add Arrears section
    y_pos = add_paragraph(c, '<font name="Cambria-Bold" color="#4682b4">ARREARS</font>', styles['BlueHeading'], margin, y_pos, content_width)
    
    arrears_text1 = f"The renewal of the Policy is subject to the settlement of any premium due on your previous healthcare Insurance Policies. Accordingly, should any outstanding premium, please ensure same is settled not later than <font name='Cambria-Bold'>{expiry_to_formatted}</font>. Failing to do so may result in interruption or cancellation of your insurance cover."
    y_pos = add_paragraph(c, arrears_text1, styles['BodyText'], margin, y_pos, content_width)
    
    arrears_text2 = "We trust this proposal is appropriate to your healthcare insurance needs and we look forward to discussing same in more detail with you as may be applicable."
    y_pos = add_paragraph(c, arrears_text2, styles['BodyText'], margin, y_pos, content_width)
    
    # Additional services text
    services_text = "In addition to your current coverage, we offer a wide range of tailored insurance solutions in Motor, Travel, Property, Liability, Life & Pension, and Loan to ensure more complete protection for you and your assets."
    y_pos = add_paragraph(c, services_text, styles['BodyText'], margin, y_pos, content_width)
    
    # Contact information
    contact_text = "Should you require any further information, our Customer Service team will gladly assist you on 602 3000, <font color='#4682b4'>customerservice@nicl.mu</font> or any of our offices or our insurance advisors across the island."
    y_pos = add_paragraph(c, contact_text, styles['BodyText'], margin, y_pos, content_width)
    
    # Closing
    y_pos = add_paragraph(c, "Assuring you of our best services at all times.", styles['BodyText'], margin, y_pos, content_width)
    y_pos -= 10
    
    # Signature
    y_pos = add_paragraph(c, "Yours sincerely", styles['BodyText'], margin, y_pos, content_width)
    
    y_pos = add_paragraph(c, "Healthcare Insurance (Underwriting)", styles['BodyText'], margin, y_pos, content_width)
    y_pos -= 15
    
    # Enclosure
    y_pos = add_paragraph(c, "Encl.: Renewal Acceptance Form", styles['BodyText'], margin, y_pos, content_width)
    
    # Save PDF
    c.save()
    
    print(f"✅ Healthcare renewal PDF generated for {full_customer_name}")
    
    # Clean up QR file
    if qr_filename and os.path.exists(qr_filename):
        os.remove(qr_filename)

print(f"🎉 Healthcare renewal script completed. Processed {len(df)} rows total.")