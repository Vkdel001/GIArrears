#!/usr/bin/env python3
"""
Motor Insurance PDF Merger
Combines all PDF files from output_motor folder into a single merged PDF
Uses PyMuPDF for reliable QR code and image preservation across Windows/Ubuntu
"""

import os
import glob
import sys
from datetime import datetime

try:
    import fitz  # PyMuPDF - reliable PDF handling that preserves QR codes
    print("Using PyMuPDF (fitz) library - reliable image preservation")
except ImportError:
    print("❌ PyMuPDF not installed. Please install it:")
    print("pip install PyMuPDF")
    print("\nPyMuPDF is required for reliable QR code preservation during PDF merging.")
    sys.exit(1)

def test_pdf_files():
    """Test individual PDF files to check if they're readable using PyMuPDF"""
    input_folder = "output_motor"
    pdf_files = glob.glob(os.path.join(input_folder, "*.pdf"))
    
    if not pdf_files:
        print("No PDF files found to test")
        return
    
    print(f"\n🔍 Testing {len(pdf_files)} PDF files...")
    
    for i, pdf_file in enumerate(pdf_files[:5], 1):  # Test first 5 files
        try:
            # Use PyMuPDF to test file
            doc = fitz.open(pdf_file)
            num_pages = doc.page_count
            print(f"✅ {os.path.basename(pdf_file)}: {num_pages} pages")
            
            # Test if we can access first page
            if num_pages > 0:
                page = doc[0]
                # Check if page has content (including images/QR codes)
                page_dict = page.get_text("dict")
                
            doc.close()
                    
        except Exception as e:
            print(f"❌ {os.path.basename(pdf_file)}: Error - {str(e)}")

def merge_motor_pdfs():
    """Merge all PDFs from output_motor folder into a single PDF using PyMuPDF"""
    
    # Define folders
    input_folder = "output_motor"
    output_folder = "merged_motor_policies"
    
    # Check if input folder exists
    if not os.path.exists(input_folder):
        print(f"❌ Error: Input folder '{input_folder}' not found!")
        print("Please run the Motor_Insurance_Renewal.py script first to generate PDFs.")
        return
    
    # Create output folder if it doesn't exist
    if not os.path.exists(output_folder):
        os.makedirs(output_folder)
        print(f"📁 Created output folder: {output_folder}")
    
    # Find all PDF files in the input folder
    pdf_files = glob.glob(os.path.join(input_folder, "*.pdf"))
    
    if not pdf_files:
        print(f"❌ No PDF files found in '{input_folder}' folder!")
        return
    
    # Sort PDF files by name for consistent ordering
    pdf_files.sort()
    
    print(f"📄 Found {len(pdf_files)} PDF files to merge")
    
    # Create merged PDF filename with timestamp
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    merged_filename = f"Merged_Motor_Policies_{timestamp}.pdf"
    merged_filepath = os.path.join(output_folder, merged_filename)
    
    try:
        # Create new merged document using PyMuPDF
        merged_doc = fitz.open()
        total_pages = 0
        
        # Process each PDF file
        for i, pdf_file in enumerate(pdf_files, 1):
            try:
                print(f"📖 Processing {i}/{len(pdf_files)}: {os.path.basename(pdf_file)}")
                
                # Open source PDF with PyMuPDF
                source_doc = fitz.open(pdf_file)
                
                # Check if PDF has pages
                num_pages = source_doc.page_count
                if num_pages == 0:
                    print(f"⚠️ Skipping {pdf_file}: No pages found")
                    source_doc.close()
                    continue
                
                print(f"   📄 Adding {num_pages} pages from this PDF")
                
                # Insert all pages from source PDF (preserves QR codes and all content)
                for page_num in range(num_pages):
                    try:
                        merged_doc.insert_pdf(source_doc, from_page=page_num, to_page=page_num)
                        total_pages += 1
                    except Exception as page_error:
                        print(f"   ⚠️ Error adding page {page_num + 1}: {str(page_error)}")
                        continue
                
                # Close source document
                source_doc.close()
                        
            except Exception as e:
                print(f"⚠️ Error processing {pdf_file}: {str(e)}")
                continue
        
        # Save the merged PDF
        merged_doc.save(merged_filepath)
        
        # Get final page count for verification
        final_pages = merged_doc.page_count
        
        # Close merged document
        merged_doc.close()
        
        print(f"✅ Successfully merged {len(pdf_files)} PDFs!")
        print(f"📄 Merged PDF saved as: {merged_filepath}")
        print(f"📊 Total pages in merged PDF: {final_pages}")
        
        # Verify the output file
        if os.path.exists(merged_filepath):
            file_size = os.path.getsize(merged_filepath)
            print(f"📏 File size: {file_size:,} bytes")
        
    except Exception as e:
        print(f"❌ Error during merging: {str(e)}")

if __name__ == "__main__":
    print("🔄 Starting PDF merge process...")
    
    # First test a few PDF files
    test_pdf_files()
    
    # Then proceed with merge
    merge_motor_pdfs()
    print("🎉 PDF merge process completed!")