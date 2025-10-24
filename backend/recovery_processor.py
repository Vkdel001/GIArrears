# -*- coding: utf-8 -*-
# NICL Recovery Action Processor - Master Controller
# Processes different recovery actions (L0, L1, L2, MED) by routing to appropriate scripts

import pandas as pd
import sys
import io
import os
import subprocess
import glob
from datetime import datetime

# Set UTF-8 encoding for stdout to handle Unicode characters
if sys.stdout.encoding != 'utf-8':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

def cleanup_output_folders():
    """Clean up existing PDFs in all output folders"""
    individual_folders = ['L0', 'L1', 'L2', 'output_mise_en_demeure']
    merged_folders = ['L0_Merge', 'L1_Merge', 'L2_Merge', 'MED_Merge']
    
    print("🧹 Cleaning up existing PDFs...")
    
    # Clean individual PDF folders
    print("   🔄 Cleaning individual PDF folders...")
    for folder in individual_folders:
        if os.path.exists(folder):
            # Find all PDF files in the folder
            pdf_files = glob.glob(os.path.join(folder, "*.pdf"))
            
            if pdf_files:
                print(f"   📁 Cleaning {folder}/ folder: {len(pdf_files)} PDFs found")
                
                for pdf_file in pdf_files:
                    try:
                        os.remove(pdf_file)
                    except Exception as e:
                        print(f"   ⚠️  Warning: Could not delete {pdf_file}: {str(e)}")
                
                print(f"   ✅ {folder}/ folder cleaned")
            else:
                print(f"   📁 {folder}/ folder: No PDFs to clean")
        else:
            print(f"   📁 {folder}/ folder: Does not exist (will be created by scripts)")
    
    # Clean merged PDF folders
    print("   🔄 Cleaning merged PDF folders...")
    for folder in merged_folders:
        if os.path.exists(folder):
            # Find all PDF files in the folder
            pdf_files = glob.glob(os.path.join(folder, "*.pdf"))
            
            if pdf_files:
                print(f"   📁 Cleaning {folder}/ folder: {len(pdf_files)} PDFs found")
                
                for pdf_file in pdf_files:
                    try:
                        os.remove(pdf_file)
                    except Exception as e:
                        print(f"   ⚠️  Warning: Could not delete {pdf_file}: {str(e)}")
                
                print(f"   ✅ {folder}/ folder cleaned")
            else:
                print(f"   📁 {folder}/ folder: No PDFs to clean")
        else:
            print(f"   📁 {folder}/ folder: Does not exist (will be created)")
    
    print("✅ Complete cleanup finished - all PDF folders cleaned\n")

def main():
    print("🚀 NICL Recovery Action Processor Started")
    print("=" * 60)
    
    # Clean up existing PDFs first
    cleanup_output_folders()
    
    # Read the main Excel file
    excel_filename = "Extracted_Arrears_Data.xlsx"
    
    try:
        df = pd.read_excel(excel_filename, engine='openpyxl')
        print(f"✅ Excel file loaded successfully with {len(df)} rows")
        print(f"📋 Available columns: {list(df.columns)}")
        
        if len(df) == 0:
            print("⚠️ Excel file is empty")
            sys.exit(1)
        
        # Add COMMENTS column if it doesn't exist
        if 'COMMENTS' not in df.columns:
            df['COMMENTS'] = ''
            print("📝 Added COMMENTS column to Excel file")
        else:
            print("📝 COMMENTS column already exists")
            
    except FileNotFoundError:
        print(f"❌ Excel file '{excel_filename}' not found in the current directory")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Error reading Excel file: {str(e)}")
        sys.exit(1)
    
    # Check if Recovery_action column exists
    if 'Recovery_action' not in df.columns:
        print("❌ 'Recovery_action' column not found in Excel file")
        print(f"Available columns: {list(df.columns)}")
        sys.exit(1)
    
    # Analyze Recovery_action values
    recovery_counts = df['Recovery_action'].value_counts()
    print(f"\n📊 Recovery Action Distribution:")
    for action, count in recovery_counts.items():
        print(f"   {action}: {count} records")
    
    # Define mapping of recovery actions to scripts
    action_mapping = {
        'SMS 2 + L0': {'script': 'L0.py', 'temp_file': 'temp_L0.xlsx'},
        'L0': {'script': 'L0.py', 'temp_file': 'temp_L0.xlsx'},
        'L1': {'script': 'L1.py', 'temp_file': 'temp_L1.xlsx'},
        'L2': {'script': 'L2.py', 'temp_file': 'temp_L2.xlsx'},
        'MED': {'script': 'GI_MED_Arrears.py', 'temp_file': 'temp_MED.xlsx'}
    }
    
    # Process each recovery action type
    processed_dataframes = []
    processing_summary = {}
    
    print(f"\n🔄 Processing Recovery Actions:")
    print("-" * 40)
    
    for action, config in action_mapping.items():
        # Filter data for this recovery action
        action_df = df[df['Recovery_action'] == action].copy()
        
        if len(action_df) == 0:
            print(f"⏭️  Skipping {action}: No records found")
            continue
        
        print(f"\n📋 Processing {action}: {len(action_df)} records")
        
        # Create temporary Excel file for this action
        temp_filename = config['temp_file']
        try:
            action_df.to_excel(temp_filename, index=False, engine='openpyxl')
            print(f"   ✅ Created temporary file: {temp_filename}")
        except Exception as e:
            print(f"   ❌ Error creating temporary file {temp_filename}: {str(e)}")
            continue
        
        # Execute the appropriate script
        script_name = config['script']
        if not os.path.exists(script_name):
            print(f"   ❌ Script {script_name} not found")
            processing_summary[action] = {'status': 'Script not found', 'processed': 0}
            continue
        
        try:
            print(f"   🔄 Executing {script_name}...")
            
            # Run the script and capture output
            # Static 120-minute timeout for all processes
            timeout_seconds = 120 * 60  # 120 minutes = 7200 seconds
            print(f"   ⏱️  Processing {len(action_df)} records (120 min timeout)")
            
            result = subprocess.run(
                [sys.executable, script_name],
                capture_output=True,
                text=True,
                encoding='utf-8',
                timeout=timeout_seconds
            )
            
            if result.returncode == 0:
                print(f"   ✅ {script_name} completed successfully")
                
                # Read the updated temporary file to get comments
                try:
                    updated_df = pd.read_excel(temp_filename, engine='openpyxl')
                    processed_dataframes.append(updated_df)
                    
                    # Count successful generations
                    success_count = len(updated_df[updated_df['COMMENTS'] == 'Letter generated successfully'])
                    processing_summary[action] = {
                        'status': 'Success', 
                        'processed': len(updated_df),
                        'generated': success_count
                    }
                    print(f"   📊 Generated {success_count} letters out of {len(updated_df)} records")
                    
                except Exception as e:
                    print(f"   ⚠️  Warning: Could not read updated file {temp_filename}: {str(e)}")
                    processed_dataframes.append(action_df)  # Use original data
                    processing_summary[action] = {'status': 'Partial success', 'processed': len(action_df)}
            else:
                print(f"   ❌ {script_name} failed with return code {result.returncode}")
                print(f"   Error output: {result.stderr[:200]}...")
                processed_dataframes.append(action_df)  # Use original data
                processing_summary[action] = {'status': 'Failed', 'processed': 0}
                
        except subprocess.TimeoutExpired:
            print(f"   ⏰ {script_name} timed out after 5 minutes")
            processed_dataframes.append(action_df)
            processing_summary[action] = {'status': 'Timeout', 'processed': 0}
        except Exception as e:
            print(f"   ❌ Error executing {script_name}: {str(e)}")
            processed_dataframes.append(action_df)
            processing_summary[action] = {'status': 'Error', 'processed': 0}
        
        # Clean up temporary file
        try:
            if os.path.exists(temp_filename):
                os.remove(temp_filename)
                print(f"   🧹 Cleaned up {temp_filename}")
        except Exception as e:
            print(f"   ⚠️  Warning: Could not remove {temp_filename}: {str(e)}")
    
    # Consolidate all processed data back to main Excel
    if processed_dataframes:
        print(f"\n🔄 Consolidating results...")
        
        try:
            # Combine all processed dataframes
            consolidated_df = pd.concat(processed_dataframes, ignore_index=True)
            
            # Save back to main Excel file
            consolidated_df.to_excel(excel_filename, index=False, engine='openpyxl')
            print(f"✅ Updated main Excel file with processing results")
            
        except Exception as e:
            print(f"❌ Error consolidating results: {str(e)}")
    
    # Print final summary
    print(f"\n📊 FINAL PROCESSING SUMMARY:")
    print("=" * 60)
    
    total_processed = 0
    total_generated = 0
    
    for action, summary in processing_summary.items():
        status = summary['status']
        processed = summary.get('processed', 0)
        generated = summary.get('generated', 0)
        
        print(f"{action:15} | Status: {status:15} | Processed: {processed:3} | Generated: {generated:3}")
        
        if status == 'Success':
            total_processed += processed
            total_generated += generated
    
    print("-" * 60)
    print(f"{'TOTAL':15} | {'':23} | Processed: {total_processed:3} | Generated: {total_generated:3}")
    
    print(f"\n🎉 Recovery Action Processing Completed!")
    print(f"📁 Check respective folders for generated PDFs:")
    print(f"   • L0 letters: L0/ folder")
    print(f"   • L1 letters: L1/ folder") 
    print(f"   • L2 letters: L2/ folder")
    print(f"   • MED letters: output_mise_en_demeure/ folder")

if __name__ == "__main__":
    main()