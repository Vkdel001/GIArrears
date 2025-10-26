#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
NICL Arrears Letters Merger
Merges all individual arrears letters from respective folders into single PDFs for printing
Handles L0, L1, L2, and MED recovery action types
Maintains Excel row order through sequential filename sorting
"""

import os
import glob
import fitz  # PyMuPDF
import re
from datetime import datetime

def merge_recovery_letters(input_folder, output_folder, letter_type):
    """Merge all letters from a specific recovery type folder"""
    
    # Create output folder if it doesn't exist
    if not os.path.exists(output_folder):
        os.makedirs(output_folder)
        print(f"📁 Created output folder: {output_folder}")
    
    # Create output filename with timestamp
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_filename = f"Arrears_{letter_type}_Letters_Merged_{timestamp}.pdf"
    output_filepath = os.path.join(output_folder, output_filename)
    
    # Check if input folder exists
    if not os.path.exists(input_folder):
        print(f"⚠️  {input_folder} folder not found - skipping {letter_type}")
        return None
    
    # Find all PDF files in the input folder
    pdf_files = glob.glob(f"{input_folder}/*.pdf")
    
    if not pdf_files:
        print(f"⚠️  No PDF files found in {input_folder} - skipping {letter_type}")
        return None
    
    # Sort files by sequence number to maintain Excel order
    pdf_files = sort_files_by_sequence(pdf_files)
    
    # Validate sequence integrity
    sequence_valid = validate_sequence_order(pdf_files, letter_type)
    if not sequence_valid:
        print(f"   ⚠️  {letter_type} sequence validation failed, but continuing with merge...")
    
    print(f"\n📋 Processing {letter_type} Letters:")
    print(f"   📂 Input folder: {input_folder}")
    print(f"   📄 Output file: {output_filename}")
    print(f"   📊 Found {len(pdf_files)} letters to merge in Excel sequence order")
    
    try:
        # Create new merged document
        merged_doc = fitz.open()
        
        total_pages = 0
        processed_files = 0
        
        for i, pdf_file in enumerate(pdf_files, 1):
            try:
                filename = os.path.basename(pdf_file)
                
                # Open the arrears letter PDF
                letter_doc = fitz.open(pdf_file)
                page_count = letter_doc.page_count
                
                # Add all pages from this letter
                for page_num in range(page_count):
                    merged_doc.insert_pdf(letter_doc, from_page=page_num, to_page=page_num)
                
                letter_doc.close()
                
                total_pages += page_count
                processed_files += 1
                
                if i % 50 == 0 or i == len(pdf_files):  # Progress update every 50 files
                    print(f"   🔄 Progress: {i}/{len(pdf_files)} files processed")
                
            except Exception as e:
                print(f"   ❌ Failed to process {filename}: {str(e)}")
                continue
        
        if processed_files == 0:
            print(f"   ❌ No {letter_type} files could be processed successfully!")
            merged_doc.close()
            return None
        
        # Save the merged PDF
        print(f"   💾 Saving merged PDF...")
        merged_doc.save(output_filepath)
        merged_doc.close()
        
        # Verify the output file
        if os.path.exists(output_filepath):
            file_size = os.path.getsize(output_filepath)
            file_size_mb = file_size / (1024 * 1024)
            
            result = {
                'type': letter_type,
                'output_file': output_filepath,
                'processed_files': processed_files,
                'total_files': len(pdf_files),
                'total_pages': total_pages,
                'file_size_mb': file_size_mb
            }
            
            print(f"   ✅ {letter_type} merge completed!")
            print(f"   📊 {processed_files}/{len(pdf_files)} files, {total_pages} pages, {file_size_mb:.2f} MB")
            
            return result
            
        else:
            print(f"   ❌ Failed to create {letter_type} merged PDF!")
            return None
            
    except Exception as e:
        print(f"   ❌ Error during {letter_type} merging: {str(e)}")
        return None

def sort_files_by_sequence(pdf_files):
    """Sort PDF files by sequence number prefix to maintain Excel order"""
    def extract_sequence(filename):
        # Extract sequence number from filename like "0001_MED_policy.pdf"
        basename = os.path.basename(filename)
        match = re.match(r'^(\d+)_', basename)
        return int(match.group(1)) if match else float('inf')
    
    return sorted(pdf_files, key=extract_sequence)

def validate_sequence_order(pdf_files, letter_type):
    """Verify files are in proper sequence and report any gaps"""
    sequences = []
    for file in pdf_files:
        basename = os.path.basename(file)
        match = re.match(r'^(\d+)_', basename)
        if match:
            sequences.append(int(match.group(1)))
        else:
            print(f"   ⚠️  Warning: {basename} doesn't follow sequence naming pattern")
    
    if not sequences:
        return True  # No files to validate
    
    # Check for sequence integrity
    min_seq = min(sequences)
    max_seq = max(sequences)
    expected_count = max_seq - min_seq + 1
    actual_count = len(sequences)
    
    if actual_count == expected_count and len(set(sequences)) == actual_count:
        print(f"   ✅ {letter_type} files in correct Excel sequence ({min_seq}-{max_seq})")
        return True
    else:
        # Find gaps and duplicates
        expected_set = set(range(min_seq, max_seq + 1))
        actual_set = set(sequences)
        gaps = expected_set - actual_set
        duplicates = [seq for seq in sequences if sequences.count(seq) > 1]
        
        if gaps:
            print(f"   ⚠️  Warning: {letter_type} sequence gaps: {sorted(gaps)}")
        if duplicates:
            print(f"   ⚠️  Warning: {letter_type} duplicate sequences: {sorted(set(duplicates))}")
        
        return False

def cleanup_old_merged_files():
    """Clean up old merged PDF files before creating new ones"""
    
    merge_folders = ['L0_Merge', 'L1_Merge', 'L2_Merge', 'MED_Merge']
    
    print("🧹 Cleaning up old merged files...")
    
    total_cleaned = 0
    for folder in merge_folders:
        if os.path.exists(folder):
            # Find all PDF files in the folder
            pdf_files = glob.glob(os.path.join(folder, "*.pdf"))
            
            if pdf_files:
                print(f"   📁 Cleaning {folder}/ folder: {len(pdf_files)} PDFs found")
                
                for pdf_file in pdf_files:
                    try:
                        os.remove(pdf_file)
                        total_cleaned += 1
                    except Exception as e:
                        print(f"   ⚠️  Warning: Could not delete {pdf_file}: {str(e)}")
                
                print(f"   ✅ {folder}/ folder cleaned")
            else:
                print(f"   📁 {folder}/ folder: No PDFs to clean")
        else:
            print(f"   📁 {folder}/ folder: Does not exist (will be created)")
    
    if total_cleaned > 0:
        print(f"✅ Cleanup completed - removed {total_cleaned} old merged PDFs")
    else:
        print("✅ Cleanup completed - no old merged PDFs found")
    print()

def merge_all_arrears_letters():
    """Merge all arrears letters by recovery type"""
    
    print("🚀 NICL Arrears Letters Merger Started")
    print("=" * 60)
    
    # Clean up old merged files first
    cleanup_old_merged_files()
    
    # Define recovery action mappings
    recovery_mappings = [
        {
            'input_folder': 'L0',
            'output_folder': 'L0_Merge',
            'letter_type': 'L0'
        },
        {
            'input_folder': 'L1', 
            'output_folder': 'L1_Merge',
            'letter_type': 'L1'
        },
        {
            'input_folder': 'L2',
            'output_folder': 'L2_Merge', 
            'letter_type': 'L2'
        },
        {
            'input_folder': 'output_mise_en_demeure',
            'output_folder': 'MED_Merge',
            'letter_type': 'MED'
        }
    ]
    
    # Process each recovery type
    results = []
    
    for mapping in recovery_mappings:
        result = merge_recovery_letters(
            mapping['input_folder'],
            mapping['output_folder'], 
            mapping['letter_type']
        )
        
        if result:
            results.append(result)
    
    # Print final summary
    print(f"\n📊 FINAL MERGE SUMMARY:")
    print("=" * 60)
    
    if not results:
        print("❌ No letters were merged - no PDF files found in any folder")
        print("\n💡 Make sure to run recovery_processor.py first to generate letters")
        return
    
    total_files = 0
    total_pages = 0
    total_size_mb = 0
    
    for result in results:
        print(f"{result['type']:3} | Files: {result['processed_files']:4}/{result['total_files']:4} | "
              f"Pages: {result['total_pages']:4} | Size: {result['file_size_mb']:6.2f} MB")
        
        total_files += result['processed_files']
        total_pages += result['total_pages']
        total_size_mb += result['file_size_mb']
    
    print("-" * 60)
    print(f"{'TOT':3} | Files: {total_files:4}      | Pages: {total_pages:4} | Size: {total_size_mb:6.2f} MB")
    
    print(f"\n🎉 Merge process completed!")
    print(f"📁 Merged PDFs available in respective folders:")
    for result in results:
        folder = os.path.dirname(result['output_file'])
        filename = os.path.basename(result['output_file'])
        print(f"   • {result['type']:3}: {folder}/{filename}")
    
    print(f"\n📋 Ready for batch printing!")

def print_usage():
    """Print usage instructions"""
    print("NICL Arrears Letters Merger")
    print("=" * 40)
    print()
    print("This script merges individual arrears letters by recovery type")
    print("into single PDFs for batch printing.")
    print()
    print("Input Folders:")
    print("• L0/ - Level 0 arrears letters")
    print("• L1/ - Level 1 arrears letters") 
    print("• L2/ - Level 2 arrears letters")
    print("• output_mise_en_demeure/ - MED arrears letters")
    print()
    print("Output Folders:")
    print("• L0_Merge/ - Merged L0 letters")
    print("• L1_Merge/ - Merged L1 letters")
    print("• L2_Merge/ - Merged L2 letters") 
    print("• MED_Merge/ - Merged MED letters")
    print()
    print("Prerequisites:")
    print("1. Run recovery_processor.py to generate individual letters")
    print("2. Ensure PyMuPDF is installed: pip install PyMuPDF")
    print()
    print("Features:")
    print("• Timestamped output files")
    print("• Alphabetical ordering of letters")
    print("• Progress tracking for large batches")
    print("• Comprehensive statistics")
    print()

if __name__ == "__main__":
    try:
        import fitz
        print_usage()
        merge_all_arrears_letters()
        
    except ImportError:
        print("❌ PyMuPDF not installed. Please install it:")
        print("pip install PyMuPDF")
        print("Command: pip install PyMuPDF")