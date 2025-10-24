#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Simple alternative PDF merger using reportlab to recreate PDFs
This avoids PyPDF2 compatibility issues entirely
"""

import os
import glob
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
from PIL import Image
import fitz  # PyMuPDF - more reliable than PyPDF2

def convert_pdf_to_images_and_merge():
    """Convert PDFs to images and recreate as new PDF - most reliable method"""
    
    # Paths to all forms that need to be merged
    required_pdfs = [
        "Renewal Acceptance Form - HealthSense Plan V2 0.pdf",
        "Annex.pdf"
    ]
    
    # Check if all required PDFs exist
    missing_files = []
    for pdf_path in required_pdfs:
        if not os.path.exists(pdf_path):
            missing_files.append(pdf_path)
    
    if missing_files:
        print(f"❌ Error: Missing required PDF files:")
        for file in missing_files:
            print(f"   - {file}")
        print("Please ensure all form PDFs are in the current directory.")
        return
    
    # Find all generated renewal PDFs - check for dual folder structure
    output_folder = "output_renewals"
    if not os.path.exists(output_folder):
        print(f"❌ Error: {output_folder} folder not found!")
        return
    
    # Check if using new dual folder structure
    unprotected_folder = os.path.join(output_folder, "unprotected")
    if os.path.exists(unprotected_folder):
        print(f"📁 Using unprotected PDFs from: {unprotected_folder}")
        pdf_files = glob.glob(f"{unprotected_folder}/*.pdf")
        working_folder = unprotected_folder
    else:
        print(f"📁 Using PDFs from: {output_folder}")
        pdf_files = glob.glob(f"{output_folder}/*.pdf")
        working_folder = output_folder
    
    if not pdf_files:
        print(f"❌ No PDF files found in {output_folder}")
        return
    
    print(f"📋 Found {len(pdf_files)} renewal letters to merge...")
    print(f"📋 Will merge with {len(required_pdfs)} additional forms:")
    for i, pdf_path in enumerate(required_pdfs, 1):
        print(f"   {i}. {os.path.basename(pdf_path)}")
    print()
    
    success_count = 0
    error_count = 0
    
    for pdf_file in pdf_files:
        try:
            filename = os.path.basename(pdf_file)
            print(f"🔄 Processing: {filename}")
            
            # Create backup
            backup_file = pdf_file.replace('.pdf', '_backup.pdf')
            os.rename(pdf_file, backup_file)
            
            # Open all PDFs with PyMuPDF
            letter_doc = fitz.open(backup_file)
            
            # Create new PDF
            merged_doc = fitz.open()
            
            # Add pages from renewal letter (pages 1-2)
            for page_num in range(letter_doc.page_count):
                merged_doc.insert_pdf(letter_doc, from_page=page_num, to_page=page_num)
            
            # Add pages from each required PDF in order
            for pdf_path in required_pdfs:
                try:
                    form_doc = fitz.open(pdf_path)
                    print(f"   📄 Adding {form_doc.page_count} pages from {os.path.basename(pdf_path)}")
                    
                    # Add all pages from this PDF
                    for page_num in range(form_doc.page_count):
                        merged_doc.insert_pdf(form_doc, from_page=page_num, to_page=page_num)
                    
                    form_doc.close()
                    
                except Exception as e:
                    print(f"   ⚠️ Warning: Could not merge {pdf_path}: {str(e)}")
                    continue
            
            # Save merged PDF
            merged_doc.save(pdf_file)
            
            # Close documents
            letter_doc.close()
            merged_doc.close()
            

            
            # Check if merge was successful
            if os.path.exists(pdf_file) and os.path.getsize(pdf_file) > 10000:
                os.remove(backup_file)
                
                # Count total pages in merged PDF for verification
                try:
                    verify_doc = fitz.open(pdf_file)
                    total_pages = verify_doc.page_count
                    verify_doc.close()
                    print(f"✅ Merged: {filename} ({total_pages} total pages)")
                except:
                    print(f"✅ Merged: {filename}")
                
                success_count += 1
                        
            else:
                # Restore backup
                os.rename(backup_file, pdf_file)
                print(f"❌ Merge failed: {filename}")
                error_count += 1
                
        except Exception as e:
            # Restore backup if merging failed
            if os.path.exists(backup_file):
                os.rename(backup_file, pdf_file)
            
            print(f"❌ Failed to merge: {filename} - {str(e)}")
            error_count += 1
    
    # Clean up any unwanted AcceptanceForm files that might have been created
    cleanup_count = 0
    acceptance_files = glob.glob(f"{output_folder}/*_AcceptanceForm.pdf")
    for acceptance_file in acceptance_files:
        try:
            os.remove(acceptance_file)
            cleanup_count += 1
        except:
            pass
    
    print(f"\n🎉 Merging completed!")
    print(f"✅ Successfully merged: {success_count} files")
    if error_count > 0:
        print(f"❌ Failed to merge: {error_count} files")
    if cleanup_count > 0:
        print(f"🧹 Cleaned up {cleanup_count} unwanted AcceptanceForm files")

if __name__ == "__main__":
    try:
        import fitz
        print("� MMerging PDFs...")
        print()
        
        convert_pdf_to_images_and_merge()
        
    except ImportError:
        print("❌ PyMuPDF not installed. Please install it:")
        print("pip install PyMuPDF")
        print("\nAlternatively, try the regular merge_acceptance_form.py script")