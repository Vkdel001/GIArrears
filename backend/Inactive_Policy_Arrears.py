# -*- coding: utf-8 -*-
# NICL Inactive Policy Arrears Letter Generation Script
# Common format for both Health and Non-Motor inactive policies
# Includes settlement options and legal warning
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
from reportlab.lib.utils import ImageReader
import os
import re
import argparse

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

# Parse command-line arguments
parser = argparse.ArgumentParser(description='Generate inactive policy arrears letters')
parser.add_argument('--product-type', '-p', required=True, choices=['health', 'nonmotor'],
                    help='Product type: health or nonmotor')
parser.add_argument('--input-file', '-i', required=True,
                    help='Input Excel file path')
parser.add_argument('--output-folder', '-o', required=False,
                    help='Output folder for generated PDFs')

args = parser.parse_args()

# Set product-specific configurations
if args.product_type == 'health':
    product_label = "HEALTH"
    default_output_folder = "Inactive_Health"
else:  # nonmotor
    product_label = "MOTOR/NONMOTOR"
    default_output_folder = "Inactive_NonMotor"

# Use provided output folder or default
output_folder = args.output_folder if args.output_folder else default_output_folder

print(f"[INFO] Product Type: {args.product_type.upper()}")
print(f"[INFO] Input File: {args.input_file}")
print(f"[INFO] Output Folder: {output_folder}")

# Read the Excel file containing arrears data
try:
    # Use openpyxl engine for .xlsx files
    df = pd.read_excel(args.input_file, engine='openpyxl')
    print(f"[OK] Excel file loaded successfully with {len(df)} rows")
    print(f"[INFO] Available columns: {list(df.columns)}")
    
    if len(df) == 0:
        print("[WARNING] Excel file is empty")
        sys.exit(1)
    
    # Add COMMENTS column if it doesn't exist
    if 'COMMENTS' not in df.columns:
        df['COMMENTS'] = ''
        print("[INFO] Added COMMENTS column to Excel file")
    else:
        print("[INFO] COMMENTS column already exists")
    
    # Ensure COMMENTS column is string type
    df['COMMENTS'] = df['COMMENTS'].astype(str)
    df.loc[df['COMMENTS'] == 'nan', 'COMMENTS'] = ''
        
except FileNotFoundError:
    print("[ERROR] Excel file 'Motor_Arrears.xlsx' not found in the current directory")
    sys.exit(1)
except Exception as e:
    print(f"[ERROR] Error reading Excel file: {str(e)}")
    sys.exit(1)

# Create output folder
os.makedirs(output_folder, exist_ok=True)
print(f"[INFO] Using output folder: {output_folder}")

# CLEANUP: Delete all old PDF files from output folder before generation
print(f"[CLEANUP] Removing old PDF files from {output_folder}...")
try:
    if os.path.exists(output_folder):
        old_files = [f for f in os.listdir(output_folder) if f.endswith('.pdf')]
        for old_file in old_files:
            os.remove(os.path.join(output_folder, old_file))
        if old_files:
            print(f"[CLEANUP] Removed {len(old_files)} old PDF files")
        else:
            print(f"[CLEANUP] No old PDF files found to remove")
    else:
        print(f"[CLEANUP] Output folder doesn't exist yet, will be created")
except Exception as e:
    print(f"[WARNING] Could not clean up old files: {str(e)}")

# Also cleanup old merged PDFs
merge_folder = f"{output_folder}_Merge"
print(f"[CLEANUP] Removing old merged PDF files from {merge_folder}...")
try:
    if os.path.exists(merge_folder):
        old_merged_files = [f for f in os.listdir(merge_folder) if f.endswith('.pdf')]
        for old_file in old_merged_files:
            os.remove(os.path.join(merge_folder, old_file))
        if old_merged_files:
            print(f"[CLEANUP] Removed {len(old_merged_files)} old merged PDF files")
        else:
            print(f"[CLEANUP] No old merged PDF files found to remove")
    else:
        print(f"[CLEANUP] Merge folder doesn't exist yet")
except Exception as e:
    print(f"[WARNING] Could not clean up old merged files: {str(e)}")# Define custom paragraph styles
styles = {}

styles['BodyText'] = ParagraphStyle(
    name='BodyText',
    fontName='Cambria',
    fontSize=10.5,
    leading=12,
    spaceAfter=3,
    alignment=TA_JUSTIFY
)

styles['BoldText'] = ParagraphStyle(
    name='BoldText',
    fontName='Cambria-Bold',
    fontSize=11,
    leading=15,
    spaceAfter=12
)

styles['AddressText'] = ParagraphStyle(
    name='AddressText',
    fontName='Cambria-Bold',
    fontSize=10.5,
    leading=12,
    spaceAfter=3
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

# Function to format dates from Excel to "23 October 2025" format
def format_date(date_value):
    if pd.isna(date_value):
        return ""
    try:
        if isinstance(date_value, (int, float)):
            # Excel serial number - convert using Excel's date origin
            date_obj = pd.to_datetime(date_value, origin='1899-12-30', unit='D')
        else:
            # String date - explicitly parse as DD/MM/YYYY (Mauritius format)
            date_obj = pd.to_datetime(date_value, format='%d/%m/%Y', dayfirst=True)
        return date_obj.strftime('%d %B %Y')
    except:
        # Fallback: try auto-detection with dayfirst=True
        try:
            date_obj = pd.to_datetime(date_value, dayfirst=True)
            return date_obj.strftime('%d %B %Y')
        except:
            return str(date_value)

# Function to split Mauritius addresses intelligently
def split_mauritius_address(full_address):
    """Split FULL_ADDRESS into 3 lines based on real Mauritius address patterns"""
    if not full_address or pd.isna(full_address):
        return ["", "", ""]
    
    address = str(full_address).strip()
    
    # Comprehensive Mauritius locations list
    mauritius_towns = [
        # Major Cities & Towns
        'Port Louis', 'Curepipe', 'Quatre Bornes', 'Vacoas', 'Rose Hill', 
        'Beau Bassin', 'Phoenix', 'Floreal', 'Moka', 'Mahebourg',
        
        # Port Louis District
        'Pamplemousses', 'Triolet', 'Goodlands', 'Grand Baie', 'Terre Rouge',
        'Sodnac', 'Coromandel', 'Camp Thorel', 'Arsenal', 'Mapou',
        
        # Plaines Wilhems District  
        'Forest Side', 'Vacoas Phoenix', 'Beau Bassin Rose Hill',
        
        # Moka District
        'Quartier Militaire', 'Dagotiere', 'Providence', 'Melrose', 'Verdun',
        
        # Rivière du Rempart District
        'Riviere du Rempart', 'Pereybere', 'Cap Malheureux', 'Poudre d\'Or',
        'Poudre D\'or Hamlet', 'Grand Gaube', 'Calodyne', 'Anse La Raie',
        
        # Flacq District
        'Centre de Flacq', 'Central Flacq', 'Flacq', 'Belle Mare', 
        'Trou d\'Eau Douce', 'Quatre Cocos', 'Bras d\'Eau', 'Camp de Masque',
        'Ecroignard', 'Poste de Flacq', 'Queen Victoria', 'Sebastopol',
        
        # Grand Port District
        'Rose Belle', 'New Grove', 'Plaine Magnien', 'Riviere des Anguilles',
        'Cluny', 'Union Park', 'Grand Sable', 'Bambous Virieux', 'Carre Curieux',
        'Ferney', 'Vieux Grand Port', 'Bel Air Riviere Seche',
        
        # Savanne District
        'Souillac', 'Riviere des Galets', 'Bel Ombre', 'Chemin Grenier',
        'Baie du Cap', 'Saint Felix', 'Tyack', 'Britannia', 'Saint Aubin',
        'Surinam', 'L\'Escalier', 'Riambel',
        
        # Black River District
        'Tamarin', 'Flic en Flac', 'Albion', 'La Gaulette', 'Case Noyale',
        'Chamarel', 'Le Morne', 'Petite Riviere Noire', 'Grande Riviere Noire',
        'Bambous', 'Yemen', 'Cascavelle', 'Wolmar',
        
        # Additional Areas from Sample Data
        'Petite Riviere', 'Les Mariannes', 'Long Mountain', 'Palma', 'Bon Air',
        'Saint Pierre', 'Pave', 'Mont Roches', 'Amaury', 'Lalmatie', 
        'Plaine Des Papayes', 'Fond Du Sac', 'Camp Charlot', 'Camp Barbe',
        'Lagrement', 'La Source', 'Dispensary Road', 'Old Pailles',
        
        # Rodrigues
        'Port Mathurin', 'Mont Lubin', 'La Ferme', 'Anse aux Anglais',
        'Coromandel', 'Graviers', 'Patate', 'Roche Bon Dieu'
    ]
    
    # Street indicators (expanded)
    street_indicators = ['Street', 'Road', 'Avenue', 'Lane', 'Close', 'Way', 'Drive', 
                        'Crescent', 'St', 'Rd', 'Ave', 'Boulevard', 'Blvd']
    
    # Area indicators
    area_indicators = ['Morcellement', 'Cite', 'Complex', 'Tower', 'Court', 'House', 
                      'Building', 'Estate', 'Park', 'Gardens', 'Heights', 'Lotissement',
                      'NHDC', 'Business']
    
    parts = []
    
    # Step 1: Handle comma-separated addresses first
    if ',' in address:
        comma_parts = [part.strip() for part in address.split(',') if part.strip()]
        if len(comma_parts) >= 2:
            # Check if last part is a town
            last_part = comma_parts[-1]
            is_town_last = any(town.lower() in last_part.lower() for town in mauritius_towns)
            
            if is_town_last:
                if len(comma_parts) == 2:
                    parts = [comma_parts[0], "", comma_parts[1]]
                else:
                    parts = [comma_parts[0], ' '.join(comma_parts[1:-1]), comma_parts[-1]]
            else:
                # Distribute comma parts across 3 lines
                if len(comma_parts) == 2:
                    parts = [comma_parts[0], comma_parts[1], ""]
                elif len(comma_parts) == 3:
                    parts = comma_parts
                else:
                    parts = [comma_parts[0], ' '.join(comma_parts[1:-1]), comma_parts[-1]]
    
    # Step 2: Handle C/O patterns
    if not parts and ('c/o' in address.lower() or 'care of' in address.lower()):
        import re
        # Pattern: [street] C/O [company/details] [town]
        co_match = re.search(r'(.*?)\s+(c/o|care of)\s+(.*)', address, re.IGNORECASE)
        if co_match:
            before_co = co_match.group(1).strip()
            co_part = f"{co_match.group(2)} {co_match.group(3)}".strip()
            
            # Find town in C/O part
            town_found = False
            for town in mauritius_towns:
                if town.lower() in co_part.lower():
                    town_idx = co_part.lower().rfind(town.lower())
                    co_details = co_part[:town_idx].strip()
                    town_part = co_part[town_idx:].strip()
                    parts = [before_co, co_details, town_part]
                    town_found = True
                    break
            
            if not town_found:
                # No town found, split C/O part
                co_words = co_part.split()
                if len(co_words) > 6:
                    mid = len(co_words) // 2
                    parts = [before_co, ' '.join(co_words[:mid]), ' '.join(co_words[mid:])]
                else:
                    parts = [before_co, co_part, ""]
    
    # Step 3: Handle regular patterns without commas or C/O
    if not parts:
        words = address.split()
        
        # Find the town (usually at the end)
        town_start_idx = len(words)
        town_found = False
        
        # Check for town names from the end
        for town in mauritius_towns:
            town_words = town.split()
            for i in range(len(words) - len(town_words), -1, -1):  # Search from end
                if i >= 0 and ' '.join(words[i:i+len(town_words)]).lower() == town.lower():
                    town_start_idx = i
                    town_found = True
                    break
            if town_found:
                break
        
        if town_found and town_start_idx > 0:
            before_town_words = words[:town_start_idx]
            town_words = words[town_start_idx:]
            
            # Look for street indicators or area indicators in before_town_words
            split_idx = 0
            
            # First, look for street indicators
            for i, word in enumerate(before_town_words):
                if any(indicator.lower() in word.lower() for indicator in street_indicators):
                    split_idx = i + 1
                    break
            
            # If no street indicator, look for area indicators
            if split_idx == 0:
                for i, word in enumerate(before_town_words):
                    if any(indicator.lower() in word.lower() for indicator in area_indicators):
                        split_idx = i
                        break
            
            # If still no split point and we have enough words, split roughly in middle
            if split_idx == 0 and len(before_town_words) > 3:
                split_idx = len(before_town_words) // 2
            
            if split_idx > 0 and split_idx < len(before_town_words):
                parts = [
                    ' '.join(before_town_words[:split_idx]),
                    ' '.join(before_town_words[split_idx:]),
                    ' '.join(town_words)
                ]
            else:
                parts = [
                    ' '.join(before_town_words),
                    "",
                    ' '.join(town_words)
                ]
        else:
            # No town found, try to split by street indicators
            split_idx = 0
            for i, word in enumerate(words):
                if any(indicator.lower() in word.lower() for indicator in street_indicators):
                    split_idx = i + 1
                    break
            
            if split_idx > 0 and split_idx < len(words):
                remaining_words = words[split_idx:]
                if len(remaining_words) > 3:
                    mid = len(remaining_words) // 2
                    parts = [
                        ' '.join(words[:split_idx]),
                        ' '.join(remaining_words[:mid]),
                        ' '.join(remaining_words[mid:])
                    ]
                else:
                    parts = [
                        ' '.join(words[:split_idx]),
                        ' '.join(remaining_words),
                        ""
                    ]
    
    # If no clear separators, try intelligent splitting
    if not parts:
        words = address.split()
        
        # Look for street indicators to separate street from area
        street_part = []
        area_part = []
        town_part = []
        
        found_street = False
        found_town = False
        
        for i, word in enumerate(words):
            # Check if this word is a street indicator
            if any(indicator.lower() in word.lower() for indicator in street_indicators):
                street_part = words[:i+1]
                remaining_words = words[i+1:]
                found_street = True
                break
        
        if found_street and remaining_words:
            # Look for town names in remaining words
            for town in mauritius_towns:
                town_words = town.split()
                for j in range(len(remaining_words) - len(town_words) + 1):
                    if ' '.join(remaining_words[j:j+len(town_words)]).lower() == town.lower():
                        area_part = remaining_words[:j]
                        town_part = remaining_words[j:]
                        found_town = True
                        break
                if found_town:
                    break
            
            if not found_town:
                # If no town found, split remaining words between area and town
                mid_point = len(remaining_words) // 2
                area_part = remaining_words[:mid_point]
                town_part = remaining_words[mid_point:]
        
        # Create parts based on what we found
        if street_part:
            parts.append(' '.join(street_part))
        if area_part:
            parts.append(' '.join(area_part))
        if town_part:
            parts.append(' '.join(town_part))
    
    # If still no parts, try splitting by town names
    if not parts:
        for town in mauritius_towns:
            if town.lower() in address.lower():
                idx = address.lower().find(town.lower())
                before = address[:idx].strip()
                town_and_after = address[idx:].strip()
                
                if before:
                    # Try to split the "before" part if it's long
                    before_words = before.split()
                    if len(before_words) > 4:
                        mid = len(before_words) // 2
                        parts.append(' '.join(before_words[:mid]))
                        parts.append(' '.join(before_words[mid:]))
                    else:
                        parts.append(before)
                
                parts.append(town_and_after)
                break
    
    # Final fallback: intelligent word distribution
    if not parts:
        words = address.split()
        if len(words) <= 3:
            parts = words
        elif len(words) <= 6:
            # For 4-6 words, try to make meaningful groups
            if len(words) == 4:
                parts = [words[0], ' '.join(words[1:2]), ' '.join(words[2:])]
            elif len(words) == 5:
                parts = [' '.join(words[:2]), words[2], ' '.join(words[3:])]
            else:  # 6 words
                parts = [' '.join(words[:2]), ' '.join(words[2:4]), ' '.join(words[4:])]
        else:
            # For longer addresses, distribute more evenly
            third = len(words) // 3
            parts = [
                ' '.join(words[:third+1]),
                ' '.join(words[third+1:2*third+1]),
                ' '.join(words[2*third+1:])
            ]
    
    # Clean up and ensure exactly 3 lines
    result = []
    for part in parts:
        if part and part.strip():
            result.append(part.strip())
    
    # Ensure exactly 3 lines
    while len(result) < 3:
        result.append("")
    
    # If more than 3 parts, combine intelligently
    if len(result) > 3:
        if len(result) == 4:
            # Combine middle two parts
            result = [result[0], f"{result[1]} {result[2]}", result[3]]
        else:
            # Keep first, combine middle parts, keep last
            result = [result[0], ' '.join(result[1:-1]), result[-1]]
    
    return result[:3]

# Function to format currency
def format_currency(amount):
    try:
        rounded_amount = round(float(amount))
        return f"MUR {rounded_amount:,}"
    except:
        return "MUR 0"

# Function to map Product Name to simplified product type for subject line
def map_product_name(product_name):
    """Map Excel Product Name to simplified product type for letter subject"""
    if not product_name or pd.isna(product_name):
        return "MOTOR"
    
    product_name = str(product_name).strip()
    
    # Product name mapping
    product_mapping = {
        "Motor Private": "MOTOR",
        "Motor Commercial": "MOTOR",
        "Motor Fleet": "MOTOR",
        "Travel Insurance": "TRAVEL",
        "Fire & Allied Perils": "FIRE & ALLIED PERILS",
        "Group Personal Accident": "GROUP PERSONAL ACCIDENT",
        "Public Liability": "PUBLIC LIABILITY",
        "Employer's Liability": "EMPLOYER'S LIABILITY",
        "Money Insurance": "MONEY INSURANCE",
        "Professional Indemnity": "PROFESSIONAL INDEMNITY",
        "Electronic Equipment": "ELECTRONIC EQUIPMENT",
        "Workmen Compensation": "WORKMEN COMPENSATION",
        "Contractor's Plant & Machinery": "CONTRACTOR'S PLANT & MACHINERY",
        "Contractors All Risk": "CONTRACTORS ALL RISK",
        "All Risks": "ALL RISKS",
        "Machinery All Risks": "MACHINERY ALL RISKS",
        "Marine Hull": "MARINE HULL",
        "Fidelity Guarantee": "FIDELITY GUARANTEE",
        "Director's and Officer's Liability": "DIRECTOR'S AND OFFICER'S LIABILITY",
        "Sabotage and Terrorism": "SABOTAGE AND TERRORISM"
    }
    
    # Check for OASIS products (any OASIS with numbers becomes just "OASIS")
    if "OASIS" in product_name.upper():
        return "OASIS"
    
    # Try exact match first
    if product_name in product_mapping:
        return product_mapping[product_name]
    
    # If no match, return original product name in uppercase
    return product_name.upper()

# Function to add content with proper spacing
def add_paragraph(c, text, style, x, y, max_width):
    """Add a paragraph and return the new y position"""
    para = Paragraph(text, style)
    para.wrapOn(c, max_width, 1000)
    para.drawOn(c, x, y - para.height)
    return y - para.height - style.spaceAfter

# Function to create safe filenames
def sanitize_filename(filename):
    """Create a safe filename by removing invalid characters"""
    if not filename:
        return "unknown"
    
    # Remove or replace invalid characters for Windows filenames
    invalid_chars = r'[<>:"/\\|?*\n\r\t]'
    safe_name = re.sub(invalid_chars, '_', str(filename))
    
    # Remove multiple underscores and spaces
    safe_name = re.sub(r'[_\s]+', '_', safe_name)
    
    # Remove leading/trailing underscores and dots
    safe_name = safe_name.strip('_. ')
    
    # Limit length to avoid filesystem issues
    if len(safe_name) > 50:
        safe_name = safe_name[:50].rstrip('_')
    
    # Ensure we have a valid filename
    if not safe_name or safe_name in ['', '.', '..']:
        safe_name = "unknown"
    
    return safe_name

# Function to split Mauritius addresses intelligently
def split_mauritius_address(full_address):
    """Split FULL_ADDRESS into 3 lines based on real Mauritius address patterns"""
    if not full_address or pd.isna(full_address):
        return ["", "", ""]
    
    address = str(full_address).strip()
    
    # Comprehensive Mauritius locations list
    mauritius_towns = [
        # Major Cities & Towns
        'Port Louis', 'Curepipe', 'Quatre Bornes', 'Vacoas', 'Rose Hill', 
        'Beau Bassin', 'Phoenix', 'Floreal', 'Moka', 'Mahebourg',
        
        # Port Louis District
        'Pamplemousses', 'Triolet', 'Goodlands', 'Grand Baie', 'Terre Rouge',
        'Sodnac', 'Coromandel', 'Camp Thorel', 'Arsenal', 'Mapou',
        
        # Plaines Wilhems District  
        'Forest Side', 'Vacoas Phoenix', 'Beau Bassin Rose Hill',
        
        # Moka District
        'Quartier Militaire', 'Dagotiere', 'Providence', 'Melrose', 'Verdun',
        
        # Rivière du Rempart District
        'Riviere du Rempart', 'Pereybere', 'Cap Malheureux', 'Poudre d\'Or',
        'Poudre D\'or Hamlet', 'Grand Gaube', 'Calodyne', 'Anse La Raie',
        
        # Flacq District
        'Centre de Flacq', 'Central Flacq', 'Flacq', 'Belle Mare', 
        'Trou d\'Eau Douce', 'Quatre Cocos', 'Bras d\'Eau', 'Camp de Masque',
        'Ecroignard', 'Poste de Flacq', 'Queen Victoria', 'Sebastopol',
        
        # Grand Port District
        'Rose Belle', 'New Grove', 'Plaine Magnien', 'Riviere des Anguilles',
        'Cluny', 'Union Park', 'Grand Sable', 'Bambous Virieux', 'Carre Curieux',
        'Ferney', 'Vieux Grand Port', 'Bel Air Riviere Seche',
        
        # Savanne District
        'Souillac', 'Riviere des Galets', 'Bel Ombre', 'Chemin Grenier',
        'Baie du Cap', 'Saint Felix', 'Tyack', 'Britannia', 'Saint Aubin',
        'Surinam', 'L\'Escalier', 'Riambel',
        
        # Black River District
        'Tamarin', 'Flic en Flac', 'Albion', 'La Gaulette', 'Case Noyale',
        'Chamarel', 'Le Morne', 'Petite Riviere Noire', 'Grande Riviere Noire',
        'Bambous', 'Yemen', 'Cascavelle', 'Wolmar',
        
        # Additional Areas from Sample Data
        'Petite Riviere', 'Les Mariannes', 'Long Mountain', 'Palma', 'Bon Air',
        'Saint Pierre', 'Pave', 'Mont Roches', 'Amaury', 'Lalmatie', 
        'Plaine Des Papayes', 'Fond Du Sac', 'Camp Charlot', 'Camp Barbe',
        'Lagrement', 'La Source', 'Dispensary Road', 'Old Pailles',
        
        # Rodrigues
        'Port Mathurin', 'Mont Lubin', 'La Ferme', 'Anse aux Anglais',
        'Coromandel', 'Graviers', 'Patate', 'Roche Bon Dieu'
    ]
    
    # Street indicators (expanded)
    street_indicators = ['Street', 'Road', 'Avenue', 'Lane', 'Close', 'Way', 'Drive', 
                        'Crescent', 'St', 'Rd', 'Ave', 'Boulevard', 'Blvd']
    
    # Area indicators
    area_indicators = ['Morcellement', 'Cite', 'Complex', 'Tower', 'Court', 'House', 
                      'Building', 'Estate', 'Park', 'Gardens', 'Heights', 'Lotissement',
                      'NHDC', 'Business']
    
    # First, try to split by common separators (comma, newline, semicolon)
    parts = []
    
    parts = []
    
    # Step 1: Handle comma-separated addresses first
    if ',' in address:
        comma_parts = [part.strip() for part in address.split(',') if part.strip()]
        if len(comma_parts) >= 2:
            # Check if last part is a town
            last_part = comma_parts[-1]
            is_town_last = any(town.lower() in last_part.lower() for town in mauritius_towns)
            
            if is_town_last:
                if len(comma_parts) == 2:
                    parts = [comma_parts[0], "", comma_parts[1]]
                else:
                    parts = [comma_parts[0], ' '.join(comma_parts[1:-1]), comma_parts[-1]]
            else:
                # Distribute comma parts across 3 lines
                if len(comma_parts) == 2:
                    parts = [comma_parts[0], comma_parts[1], ""]
                elif len(comma_parts) == 3:
                    parts = comma_parts
                else:
                    parts = [comma_parts[0], ' '.join(comma_parts[1:-1]), comma_parts[-1]]
    
    # Step 2: Handle C/O patterns
    if not parts and ('c/o' in address.lower() or 'care of' in address.lower()):
        import re
        # Pattern: [street] C/O [company/details] [town]
        co_match = re.search(r'(.*?)\s+(c/o|care of)\s+(.*)', address, re.IGNORECASE)
        if co_match:
            before_co = co_match.group(1).strip()
            co_part = f"{co_match.group(2)} {co_match.group(3)}".strip()
            
            # Find town in C/O part
            town_found = False
            for town in mauritius_towns:
                if town.lower() in co_part.lower():
                    town_idx = co_part.lower().rfind(town.lower())
                    co_details = co_part[:town_idx].strip()
                    town_part = co_part[town_idx:].strip()
                    parts = [before_co, co_details, town_part]
                    town_found = True
                    break
            
            if not town_found:
                # No town found, split C/O part
                co_words = co_part.split()
                if len(co_words) > 6:
                    mid = len(co_words) // 2
                    parts = [before_co, ' '.join(co_words[:mid]), ' '.join(co_words[mid:])]
                else:
                    parts = [before_co, co_part, ""]
    
    # Step 3: Handle regular patterns without commas or C/O
    if not parts:
        words = address.split()
        
        # Find the town (usually at the end)
        town_start_idx = len(words)
        town_found = False
        
        # Check for town names from the end
        for town in mauritius_towns:
            town_words = town.split()
            for i in range(len(words) - len(town_words), -1, -1):  # Search from end
                if i >= 0 and ' '.join(words[i:i+len(town_words)]).lower() == town.lower():
                    town_start_idx = i
                    town_found = True
                    break
            if town_found:
                break
        
        if town_found and town_start_idx > 0:
            before_town_words = words[:town_start_idx]
            town_words = words[town_start_idx:]
            
            # Look for street indicators or area indicators in before_town_words
            split_idx = 0
            
            # First, look for street indicators
            for i, word in enumerate(before_town_words):
                if any(indicator.lower() in word.lower() for indicator in street_indicators):
                    split_idx = i + 1
                    break
            
            # If no street indicator, look for area indicators
            if split_idx == 0:
                for i, word in enumerate(before_town_words):
                    if any(indicator.lower() in word.lower() for indicator in area_indicators):
                        split_idx = i
                        break
            
            # If still no split point and we have enough words, split roughly in middle
            if split_idx == 0 and len(before_town_words) > 3:
                split_idx = len(before_town_words) // 2
            
            if split_idx > 0 and split_idx < len(before_town_words):
                parts = [
                    ' '.join(before_town_words[:split_idx]),
                    ' '.join(before_town_words[split_idx:]),
                    ' '.join(town_words)
                ]
            else:
                parts = [
                    ' '.join(before_town_words),
                    "",
                    ' '.join(town_words)
                ]
        else:
            # No town found, try to split by street indicators
            split_idx = 0
            for i, word in enumerate(words):
                if any(indicator.lower() in word.lower() for indicator in street_indicators):
                    split_idx = i + 1
                    break
            
            if split_idx > 0 and split_idx < len(words):
                remaining_words = words[split_idx:]
                if len(remaining_words) > 3:
                    mid = len(remaining_words) // 2
                    parts = [
                        ' '.join(words[:split_idx]),
                        ' '.join(remaining_words[:mid]),
                        ' '.join(remaining_words[mid:])
                    ]
                else:
                    parts = [
                        ' '.join(words[:split_idx]),
                        ' '.join(remaining_words),
                        ""
                    ]
    
    # If no clear separators, try intelligent splitting
    if not parts:
        words = address.split()
        
        # Look for street indicators to separate street from area
        street_part = []
        area_part = []
        town_part = []
        
        found_street = False
        found_town = False
        
        for i, word in enumerate(words):
            # Check if this word is a street indicator
            if any(indicator.lower() in word.lower() for indicator in street_indicators):
                street_part = words[:i+1]
                remaining_words = words[i+1:]
                found_street = True
                break
        
        if found_street and remaining_words:
            # Look for town names in remaining words
            for town in mauritius_towns:
                town_words = town.split()
                for j in range(len(remaining_words) - len(town_words) + 1):
                    if ' '.join(remaining_words[j:j+len(town_words)]).lower() == town.lower():
                        area_part = remaining_words[:j]
                        town_part = remaining_words[j:]
                        found_town = True
                        break
                if found_town:
                    break
            
            if not found_town:
                # If no town found, split remaining words between area and town
                mid_point = len(remaining_words) // 2
                area_part = remaining_words[:mid_point]
                town_part = remaining_words[mid_point:]
        
        # Create parts based on what we found
        if street_part:
            parts.append(' '.join(street_part))
        if area_part:
            parts.append(' '.join(area_part))
        if town_part:
            parts.append(' '.join(town_part))
    
    # If still no parts, try splitting by town names
    if not parts:
        for town in mauritius_towns:
            if town.lower() in address.lower():
                idx = address.lower().find(town.lower())
                before = address[:idx].strip()
                town_and_after = address[idx:].strip()
                
                if before:
                    # Try to split the "before" part if it's long
                    before_words = before.split()
                    if len(before_words) > 4:
                        mid = len(before_words) // 2
                        parts.append(' '.join(before_words[:mid]))
                        parts.append(' '.join(before_words[mid:]))
                    else:
                        parts.append(before)
                
                parts.append(town_and_after)
                break
    
    # Final fallback: intelligent word distribution
    if not parts:
        words = address.split()
        if len(words) <= 3:
            parts = words
        elif len(words) <= 6:
            # For 4-6 words, try to make meaningful groups
            if len(words) == 4:
                parts = [words[0], ' '.join(words[1:2]), ' '.join(words[2:])]
            elif len(words) == 5:
                parts = [' '.join(words[:2]), words[2], ' '.join(words[3:])]
            else:  # 6 words
                parts = [' '.join(words[:2]), ' '.join(words[2:4]), ' '.join(words[4:])]
        else:
            # For longer addresses, distribute more evenly
            third = len(words) // 3
            parts = [
                ' '.join(words[:third+1]),
                ' '.join(words[third+1:2*third+1]),
                ' '.join(words[2*third+1:])
            ]
    
    # Ensure we have exactly 3 lines, but avoid empty lines in the middle
    result = []
    for part in parts:
        if part.strip():
            result.append(part.strip())
    
    # Clean up and ensure exactly 3 lines
    result = []
    for part in parts:
        if part and part.strip():
            result.append(part.strip())
    
    # Ensure exactly 3 lines
    while len(result) < 3:
        result.append("")
    
    # If more than 3 parts, combine intelligently
    if len(result) > 3:
        if len(result) == 4:
            # Combine middle two parts
            result = [result[0], f"{result[1]} {result[2]}", result[3]]
        else:
            # Keep first, combine middle parts, keep last
            result = [result[0], ' '.join(result[1:-1]), result[-1]]
    
    return result[:3] 
    # Process each row in the DataFrame
for index, row in df.iterrows():
    current_row = index + 1
    
    # Progress indicator every 50 records
    if current_row % 50 == 0 or current_row == 1 or current_row == len(df):
        print(f"[PROGRESS] Processing row {current_row} of {len(df)} ({(current_row/len(df)*100):.1f}%)")
    
    print(f"[PROCESSING] Row {current_row} of {len(df)}")
    
    # Extract data from Excel columns (Motor format)
    # Note: Column is spelled "Tittle" (with double 't') in Excel - handle case variations
    title = ''
    for title_col in ['Tittle', 'tittle', 'Title', 'title']:
        if title_col in row and pd.notna(row.get(title_col, '')):
            title = str(row.get(title_col, ''))
            break
    
    # Handle multiple column name variations for Policy Holder
    policy_holder = ''
    for ph_col in ['Policy Holder', 'POLICY_HOLDER', 'Policy_Holder', 'PolicyHolder']:
        if ph_col in row and pd.notna(row.get(ph_col, '')):
            policy_holder = str(row.get(ph_col, ''))
            break
    
    product_name = str(row.get('Product Name', '')) if pd.notna(row.get('Product Name', '')) else ''
    
    # Handle multiple column name variations for addresses
    addr1 = ''
    for addr1_col in ['Address 1', 'POL_PH_ADDR1', 'Pol_Ph_Addr1', 'Address1']:
        if addr1_col in row and pd.notna(row.get(addr1_col, '')):
            addr1 = str(row.get(addr1_col, ''))
            break
    
    addr2 = ''
    for addr2_col in ['Address 2', 'POL_PH_ADDR2', 'Pol_Ph_Addr2', 'Address2']:
        if addr2_col in row and pd.notna(row.get(addr2_col, '')):
            addr2 = str(row.get(addr2_col, ''))
            break
    
    addr3 = ''
    for addr3_col in ['Address 3', 'POL_PH_ADDR3', 'Pol_Ph_Addr3', 'Address3']:
        if addr3_col in row and pd.notna(row.get(addr3_col, '')):
            addr3 = str(row.get(addr3_col, ''))
            break
    
    # Handle FULL_ADDRESS column
    full_address = ''
    for full_addr_col in ['FULL_ADDRESS', 'Full_Address', 'FullAddress', 'Full Address']:
        if full_addr_col in row and pd.notna(row.get(full_addr_col, '')):
            full_address = str(row.get(full_addr_col, ''))
            break
    
    # Handle multiple column name variations for Policy No
    pol_no = ''
    for pn_col in ['Policy No', 'POL_NO', 'Policy_No', 'PolicyNo', 'Pol No']:
        if pn_col in row and pd.notna(row.get(pn_col, '')):
            pol_no = str(row.get(pn_col, ''))
            break
    # Note: Column name can be 'Outstanding Amount ' (with space), 'Outstanding Amount' (without space), or 'TrueArrears'
    outstanding_amount = 0
    for amt_col in ['Outstanding Amount ', 'Outstanding Amount', 'TrueArrears', 'True_Arrears', 'Arrears']:
        if amt_col in row and pd.notna(row.get(amt_col, 0)):
            try:
                outstanding_amount = float(row.get(amt_col, 0))
                if outstanding_amount > 0:  # Use first non-zero amount found
                    break
            except (ValueError, TypeError):
                continue
    
    # Handle multiple column name variations for dates
    start_date = ''
    for start_col in ['Start Date', 'POL_FROM_DT', 'Pol_From_Dt', 'StartDate', 'From_Date']:
        if start_col in row:
            start_date = row.get(start_col, '')
            if pd.notna(start_date):
                break
    
    end_date = ''
    for end_col in ['End Date', 'POL_TO_DT', 'Pol_To_Dt', 'EndDate', 'To_Date']:
        if end_col in row:
            end_date = row.get(end_col, '')
            if pd.notna(end_date):
                break
    
    # Handle multiple column name variations for email
    ph_email = ''
    for email_col in ['PH_EMAIL', 'Ph_Email', 'Email', 'Policy Holder Email']:
        if email_col in row and pd.notna(row.get(email_col, '')):
            ph_email = str(row.get(email_col, ''))
            break
    
    # Handle multiple column name variations for mobile
    ph_mobile = ''
    for mobile_col in ['Policy Holder Mobile Number', 'PH_MOBILE', 'Ph_Mobile', 'Mobile', 'Mobile Number']:
        if mobile_col in row and pd.notna(row.get(mobile_col, '')):
            ph_mobile = str(row.get(mobile_col, ''))
            break
    
    # Handle multiple column name variations for NID
    payor_national_id = ''
    for nid_col in ['Policy Holder NID', 'PH_NID', 'Ph_NID', 'NID', 'National ID']:
        if nid_col in row and pd.notna(row.get(nid_col, '')):
            payor_national_id = str(row.get(nid_col, ''))
            break
    
    # Debug output for first few rows
    if current_row <= 3:
        print(f"[DEBUG] Row {current_row}: Policy No='{pol_no}', Policy Holder='{policy_holder}', Outstanding Amount={outstanding_amount}")
        print(f"[DEBUG] Row {current_row}: Address1='{addr1}', Address2='{addr2}', Address3='{addr3}'")
    
    # Map product name to simplified type for subject line
    product_type = map_product_name(product_name)
    
    # Determine which product label to use in subject line
    # For health: use product_label (always "HEALTH")
    # For non-motor: use product_type (MOTOR, FIRE, TRAVEL, etc.)
    if args.product_type == 'health':
        subject_product = product_label
    else:
        subject_product = product_type
    
    # Determine merchant ID and banking text based on product type
    merchant_id = 155 if product_type == "MOTOR" else 171
    
    if product_type == "MOTOR":
        banking_text = "We therefore kindly invite you to settle the outstanding amount through credit transfer to any of the following bank accounts: Maubank (060100056724), MCB (000444155732) or SBM (61030100056822)."
    else:
        banking_text = "We therefore kindly invite you to settle the outstanding amount through credit transfer to MCB bank account number 000454749716"
    
    # Skip if essential data is missing
    if not pol_no or not policy_holder:
        df.at[index, 'COMMENTS'] = 'Missing essential data (Policy No or Policy Holder)'
        print(f"⚠️ Skipping row {index + 1}: Missing essential data (Policy No or Policy Holder)")
        continue
    
    # Validation 1: Check if arrears amount is less than 100
    try:
        arrears_amount = float(outstanding_amount) if pd.notna(outstanding_amount) else 0
    except (ValueError, TypeError):
        arrears_amount = 0
    
    if arrears_amount < 100:
        df.at[index, 'COMMENTS'] = f'Arrears amount too low (MUR {arrears_amount:.2f} < MUR 100)'
        print(f"⚠️ Skipping row {index + 1}: Arrears amount too low (MUR {arrears_amount:.2f})")
        continue
    
    # Validation 2: Check if all address fields are blank
    all_address_blank = (
        (not addr1 or addr1.strip() == '') and
        (not addr2 or addr2.strip() == '') and
        (not addr3 or addr3.strip() == '') and
        (not full_address or full_address.strip() == '')
    )
    
    if all_address_blank:
        df.at[index, 'COMMENTS'] = 'No valid address available'
        print(f"⚠️ Skipping row {index + 1}: No valid address available")
        continue
    
    # Create full customer name (combine title + name, apply title case)
    if title and title.strip() and title.lower() != 'nan':
        full_customer_name = f"{title.strip()} {policy_holder.strip()}".title()
    else:
        full_customer_name = policy_holder.strip().title()
    
    # Handle address logic - check if primary address fields are blank, then use FULL_ADDRESS
    address_lines = []
    if not addr1 and not addr2 and not addr3:
        # Use FULL_ADDRESS and split it
        if full_address:
            split_address = split_mauritius_address(full_address)
            address_lines = [line.title() for line in split_address if line]  # Remove empty lines and apply title case
        else:
            # This shouldn't happen due to validation above, but just in case
            address_lines = []
    else:
        # Use Address 1, 2, 3 directly
        if addr1 and addr1.strip():
            address_lines.append(addr1.strip().title())
        if addr2 and addr2.strip():
            address_lines.append(addr2.strip().title())
        if addr3 and addr3.strip():
            address_lines.append(addr3.strip().title())
    
    # Create filename-safe names
    safe_name = sanitize_filename(full_customer_name)
    safe_policy = sanitize_filename(pol_no)
    
    # Create sequence number for Excel order preservation
    excel_row = index + 1
    total_records = len(df)
    padding = len(str(total_records))  # Auto-adjust padding based on total records
    sequence_num = f"{excel_row:0{padding}d}"
    
    print(f"[DEBUG] Processing: {full_customer_name} - Policy: {pol_no}")
    
    # Format dates (Motor uses Start Date and End Date)
    start_date_formatted = format_date(start_date)
    end_date_formatted = format_date(end_date)
    
    # Create cover period string
    cover_period = f"{start_date_formatted} to {end_date_formatted}"
    
    # Get current date for letter and calculate deadline (current date + 10 days)
    current_date = datetime.now().strftime("%d %B %Y")
    deadline_date = (datetime.now() + pd.Timedelta(days=10)).strftime("%d %B %Y")
    
    # Generate QR Code for payment
    qr_filename = None
    try:
        # Parse POLICY_HOLDER to extract first name and surname for customer label (max 24 chars)
        if policy_holder and policy_holder.strip():
            # Clean the policy holder name - replace hyphens with spaces for API compatibility
            clean_policy_holder = policy_holder.strip().replace('-', ' ')
            name_parts = clean_policy_holder.split()
            
            # Remove common titles from the beginning
            titles = ['Mr', 'Mrs', 'Ms', 'Miss', 'Dr', 'Prof', 'Sir', 'Madam']
            if name_parts and name_parts[0] in titles:
                name_parts = name_parts[1:]  # Remove title
            
            if len(name_parts) >= 2:
                # Assume last part is surname, first part is first name
                first_name = name_parts[0]
                surname = name_parts[-1]  # Take last part as surname
                
                # Create first initial + surname
                first_initial = first_name[0].upper() if first_name else ''
                customer_label_temp = f"{first_initial} {surname}" if first_initial and surname else surname
                
                # Truncate intelligently if > 24 chars (prioritize keeping surname)
                if len(customer_label_temp) > 24:
                    if len(surname) <= 22:  # Leave space for initial + space
                        customer_label = f"{first_initial} {surname}"[:24]
                    else:
                        customer_label = surname[:24]  # Just surname if too long
                else:
                    customer_label = customer_label_temp
            elif len(name_parts) == 1:
                # Single name after removing title
                customer_label = name_parts[0][:24]
            else:
                # Fallback to original cleaned name
                customer_label = clean_policy_holder[:24]
        else:
            customer_label = ''
        
        # Handle mobile number - convert from float to clean integer string (removes decimals)
        try:
            mobile_raw = ph_mobile
            if pd.notna(mobile_raw) and mobile_raw != '':
                mobile_no = str(int(float(mobile_raw)))
            else:
                mobile_no = ''
        except (ValueError, TypeError):
            mobile_no = ''
        
        # API payload for QR generation (Motor uses Merchant ID 155)
        payload = {
            "MerchantId": merchant_id,
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
            "SetAdditionalMobileNo": False,
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
            "AdditionalPurposeTransaction": "Arrears Payment"
        }
        
        # Use requests library (same as working SPH_Fresh.py)
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
            print(f"❌ API request failed for {full_customer_name}: {response.status_code} - {response.text}")

    except requests.exceptions.RequestException as e:
        print(f"⚠️ Network error while generating QR for {full_customer_name}: {str(e)}")
    except Exception as e:
        print(f"⚠️ Error generating QR for {full_customer_name}: {str(e)}")
    
    # Create PDF with sequence number for Excel order preservation
    pdf_filename = f"{output_folder}/{sequence_num}_Inactive_{args.product_type.title()}_{safe_policy}_{safe_name}_arrears.pdf"
    c = canvas.Canvas(pdf_filename, pagesize=A4)
    width, height = A4
    margin = 50
    content_width = width - 2 * margin
    
    # Add NIC logo at the top center (pushed up for better spacing)
    y_pos = height - margin + 15  # Push up by 15px for breathing space
    if os.path.exists("NICLOGO.jpg"):
        nic_logo_img = ImageReader("NICLOGO.jpg")
        nic_logo_width = 120
        nic_logo_height = nic_logo_width * (nic_logo_img.getSize()[1] / nic_logo_img.getSize()[0])
        nic_logo_x = (width - nic_logo_width) / 2  # Center horizontally
        nic_logo_y = y_pos - nic_logo_height
        c.drawImage(nic_logo_img, nic_logo_x, nic_logo_y, width=nic_logo_width, height=nic_logo_height)
        
        # Update y_pos to continue below the logo
        y_pos = nic_logo_y - 12  # Reduced gap like in healthcare script
        print(f"✅ NIC logo added to arrears letter (positioned higher)")
    else:
        print(f"⚠️ Warning: NICLOGO.jpg not found - skipping NIC logo")
        y_pos = height - margin
    

    
    # Add current date (top left)
    date_para = Paragraph(current_date, styles['BodyText'])
    date_para.wrapOn(c, content_width, height)
    date_para.drawOn(c, margin, y_pos - date_para.height)
    y_pos -= date_para.height + 20
    
    # Store the starting position for address block (for I.sphere logo alignment)
    address_start_y = y_pos
    
    # Add customer address (Initial Caps instead of ALL CAPS)
    address_lines_with_name = [full_customer_name.title()] + [line.title() for line in address_lines]
    
    for line in address_lines_with_name:
        if line:  # Only add non-empty lines
            addr_para = Paragraph(line, styles['AddressText'])
            addr_para.wrapOn(c, content_width, height)
            addr_para.drawOn(c, margin, y_pos - addr_para.height)
            y_pos -= addr_para.height + 3
    
    # Add NIC I.sphere app logo (positioned in the designated space to the right)
    if os.path.exists("isphere_logo.jpg"):
        isphere_img = ImageReader("isphere_logo.jpg")
        isphere_width = 200  # Slightly smaller to fit nicely in the space
        isphere_height = isphere_width * (isphere_img.getSize()[1] / isphere_img.getSize()[0])
        
        # Calculate proper position: right side, well below NIC logo, aligned with address area
        # Position it in the space between NIC logo bottom and address content
        nic_logo_bottom = height - margin - 120 * (120/120) - 12  # Approximate NIC logo bottom
        isphere_x = width - margin - isphere_width  # Right aligned with margin
        isphere_y = nic_logo_bottom - 60  # 60px below NIC logo for proper clearance
        
        c.drawImage(isphere_img, isphere_x, isphere_y, width=isphere_width, height=isphere_height)
        print(f"✅ NIC I.sphere logo positioned professionally in designated space")
    else:
        print(f"⚠️ Warning: isphere_logo.jpg not found - skipping NIC I.sphere logo")
    
    y_pos -= 40  # Increased space after address to push text content down
    
    # Add salutation
    y_pos = add_paragraph(c, "Dear Valued Customer,", styles['BodyText'], margin, y_pos, content_width)
    
    # Add breathing space after salutation
    y_pos -= 8
    
    # Add subject line (uses subject_product which is product_label for health, product_type for non-motor)
    subject_text = f"<font name='Cambria-Bold'>RE: FIRST NOTICE - ARREARS ON {subject_product} INSURANCE POLICY - Policy Number: {pol_no}</font>"
    y_pos = add_paragraph(c, subject_text, styles['BodyText'], margin, y_pos, content_width)
    
    # Add main content paragraph (inactive policy format)
    main_para = f"We wish to inform you that, as at <font name='Cambria-Bold'>{current_date}</font>, our records indicate an outstanding amount of <font name='Cambria-Bold'>{format_currency(outstanding_amount)}</font> on your {args.product_type} insurance policy, as detailed below:"
    y_pos = add_paragraph(c, main_para, styles['BodyText'], margin, y_pos, content_width)    #Create arrears table
    table_headers = [
        Paragraph('<font name="Cambria-Bold">Cover Period</font>', styles['TableTextBold']),
        Paragraph('<font name="Cambria-Bold">Policy Number</font>', styles['TableTextBold']),
        Paragraph('<font name="Cambria-Bold">Amount in Arrears (MUR)</font>', styles['TableTextBold'])
    ]
    
    table_data = [
        [
            Paragraph(cover_period, styles['TableText']),
            Paragraph(pol_no, styles['TableText']),
            Paragraph(format_currency(outstanding_amount), styles['TableText'])
        ]
    ]
    
    data = [table_headers] + table_data
    
    # Calculate table width
    available_table_width = content_width
    col_widths = [
        available_table_width * 0.40,  # Cover Period - 40%
        available_table_width * 0.30,  # Policy Number - 30%
        available_table_width * 0.30   # Amount in Arrears - 30%
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
    
    table_width, table_height = table.wrap(content_width, 0)
    table.drawOn(c, margin, y_pos - table_height)
    y_pos -= table_height + 12
    
    # Add settlement reminder section (inactive policy format)
    reminder_intro = "We respectfully remind you that all claims submitted under the above insurance policy have been duly settled by the Company in accordance with the policy terms and conditions. We therefore kindly invite you to regularise the account by promptly settling the above amount in arrears through one of the following options:"
    y_pos = add_paragraph(c, reminder_intro, styles['BodyText'], margin, y_pos, content_width)
    
    # Add breathing space after reminder intro
    y_pos -= 10
    
    # Add separator line
    y_pos -= 5
    c.setStrokeColor(colors.Color(0.7, 0.7, 0.7))
    c.setLineWidth(1)
    c.line(margin, y_pos, width - margin, y_pos)
    y_pos -= 15
    
    # Option 1 - Full and Immediate Settlement
    option1_title = "<font name='Cambria-Bold'>Option 1 - Full and Immediate Settlement</font>"
    y_pos = add_paragraph(c, option1_title, styles['BoldText'], margin, y_pos, content_width)
    
    option1_text = "We invite you to settle the payment instantly via the following <font name='Cambria-Bold'>MauCAS QR Code (Scan to Pay)</font> using supported mobile banking app such as Juice, Maubank WithMe, Blink, MyT Money or other supported applications."
    y_pos = add_paragraph(c, option1_text, styles['BodyText'], margin, y_pos, content_width)
    
    # Add QR code payment section if QR was generated
    if qr_filename and os.path.exists(qr_filename):
        # Check if we need a new page for QR section
        qr_section_height = 200  # Estimated height needed for QR section
        if y_pos < qr_section_height:
            c.showPage()
            y_pos = height - margin
        
        # Calculate center position for payment elements
        page_center_x = width / 2
        
        y_pos -= 8  # Reduced space before QR section
        
        # Add MauCAS logo (centered) - 80% size
        if os.path.exists("maucas2.jpeg"):
            img = ImageReader("maucas2.jpeg")
            img_width = 88  # 80% of 110
            img_height = img_width * (img.getSize()[1] / img.getSize()[0])
            logo_x = page_center_x - (img_width / 2)
            c.drawImage(img, logo_x, y_pos - img_height, width=img_width, height=img_height)
            y_pos -= img_height + 2
        
        # Add QR code (centered) - 80% size
        qr_size = 80  # 80% of 100
        qr_x = page_center_x - (qr_size / 2)
        c.drawImage(qr_filename, qr_x, y_pos - qr_size, width=qr_size, height=qr_size)
        y_pos -= qr_size + 2
        
        # Removed "NIC Health Insurance" text to save space
        
        # Add ZwennPay logo (centered) - 80% size
        if os.path.exists("zwennPay.jpg"):
            zwenn_img = ImageReader("zwennPay.jpg")
            zwenn_width = 64  # 80% of 80
            zwenn_height = zwenn_width * (zwenn_img.getSize()[1] / zwenn_img.getSize()[0])
            zwenn_x = page_center_x - (zwenn_width / 2)
            c.drawImage(zwenn_img, zwenn_x, y_pos - zwenn_height, width=zwenn_width, height=zwenn_height)
            y_pos -= zwenn_height + 8
        else:
            print(f"⚠️ Warning: zwennPay.jpg not found - skipping ZwennPay logo")
            y_pos -= 8
    
    # Add separator line after Option 1
    y_pos -= 10
    c.setStrokeColor(colors.Color(0.7, 0.7, 0.7))
    c.setLineWidth(1)
    c.line(margin, y_pos, width - margin, y_pos)
    y_pos -= 15
    
    # Option 2 - Credit Arrangement
    option2_title = "<font name='Cambria-Bold'>Option 2 - Credit Arrangement</font>"
    y_pos = add_paragraph(c, option2_title, styles['BoldText'], margin, y_pos, content_width)
    
    option2_text = "Enter into a <font name='Cambria-Bold'>formal credit arrangement plan</font>, allowing payment of the outstanding balance over the next 3 months, according to mutually agreed terms."
    y_pos = add_paragraph(c, option2_text, styles['BodyText'], margin, y_pos, content_width)
    
    # Add breathing space
    y_pos -= 6
    
    # Add contact information for credit arrangement
    contact_para = "To proceed with this option, please contact our Arrears Recovery Team on <font name='Cambria-Bold'>602 3000</font> or via email at <font color='black'>giarrearsrecovery@nicl.mu</font> to complete the required arrangement and formalities."
    y_pos = add_paragraph(c, contact_para, styles['BodyText'], margin, y_pos, content_width)
    
    # Add separator line before legal warning
    y_pos -= 15
    c.setStrokeColor(colors.Color(0.7, 0.7, 0.7))
    c.setLineWidth(1)
    c.line(margin, y_pos, width - margin, y_pos)
    y_pos -= 15
    
    # Add legal warning (bold and italic)
    legal_warning = "<font name='Cambria-Bold'><i>Should the outstanding balance remain unpaid 30 days after issuance of this letter, we shall unfortunately be compelled to initiate legal steps for the recovery of the amount in arrears.</i></font>"
    y_pos = add_paragraph(c, legal_warning, styles['BodyText'], margin, y_pos, content_width)
    
    # Add breathing space after legal warning
    y_pos -= 10
    
    # Add availability statement
    availability_para = "We remain available to attend to any queries you may have in relation to this letter."
    y_pos = add_paragraph(c, availability_para, styles['BodyText'], margin, y_pos, content_width)
    
    # Add breathing space before closing
    y_pos -= 8
    
    # Add closing paragraph
    closing_para = "We thank you for your prompt consideration and cooperation in relation to the above settlement of overdue arrears."
    y_pos = add_paragraph(c, closing_para, styles['BodyText'], margin, y_pos, content_width)
    
    # Add breathing space before signature
    y_pos -= 15
    
    # Add closing salutation
    c.setFont("Cambria", 10.5)
    c.setFillColor(colors.black)
    c.drawString(margin, y_pos, "Yours faithfully,")
    y_pos -= 25
    
    # Add signature line
    c.setFont("Cambria-Bold", 10.5)
    c.drawString(margin, y_pos, "NIC General Insurance Co. Ltd - Arrears Recovery Team")
    y_pos -= 20
    
    # Add computer-generated letter disclaimer (centered, light grey)
    y_pos -= 15
    c.setFont("Cambria", 9)
    c.setFillColor(colors.Color(0.5, 0.5, 0.5))  # Light grey color
    disclaimer_text = "This is a computer-generated letter and does not require any signature."
    text_width = c.stringWidth(disclaimer_text, "Cambria", 9)
    text_x = (width - text_width) / 2  # Center horizontally
    c.drawString(text_x, y_pos - 10, disclaimer_text)
    
    # Save PDF
    c.save()
    
    # Update comments for successful generation
    df.at[index, 'COMMENTS'] = 'Letter generated successfully'
    
    print(f"✅ Arrears letter PDF generated for {full_customer_name}")
    
    # Clean up QR file
    if qr_filename and os.path.exists(qr_filename):
        os.remove(qr_filename)

# Save the updated Excel file with comments
try:
    df.to_excel(args.input_file, index=False, engine='openpyxl')
    print(f"✅ Excel file updated with comments")
except Exception as e:
    print(f"⚠️ Warning: Could not update Excel file: {str(e)}")

# Print summary statistics
total_rows = len(df)
generated_count = len(df[df['COMMENTS'] == 'Letter generated successfully'])
low_amount_count = len(df[df['COMMENTS'].str.contains('Arrears amount too low', na=False)])
no_address_count = len(df[df['COMMENTS'].str.contains('No valid address available', na=False)])
missing_data_count = len(df[df['COMMENTS'].str.contains('Missing essential data', na=False)])

print(f"\n📊 SUMMARY:")
print(f"Total records: {total_rows}")
print(f"Letters generated: {generated_count}")
print(f"Skipped - Low amount (< MUR 100): {low_amount_count}")
print(f"Skipped - No address: {no_address_count}")
print(f"Skipped - Missing data: {missing_data_count}")
print(f"🎉 Arrears letter generation completed!")


 

