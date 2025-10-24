import express from 'express';
import multer from 'multer';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs-extra';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Authentication middleware
const requireMotorAuth = (req, res, next) => {
  if (!req.session.user || req.session.team !== 'motor') {
    return res.status(403).json({ error: 'Motor team access required' });
  }
  next();
};

// Apply auth middleware to all motor routes
router.use(requireMotorAuth);

// Configure multer for motor file uploads
const motorStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/motor');
    fs.ensureDirSync(uploadDir);
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, 'output_motor_renewal.xlsx');
  }
});

const motorUpload = multer({
  storage: motorStorage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.includes('spreadsheet') || file.originalname.endsWith('.xlsx') || file.originalname.endsWith('.xls')) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel files are allowed'), false);
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Upload Excel file
router.post('/upload-excel', motorUpload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log(`📁 Motor Excel uploaded by ${req.session.user}: ${req.file.originalname}`);

    // Count records in Excel file - simplified approach with detailed logging
    let recordCount = 0;
    try {
      console.log(`🔍 Starting record count for: ${req.file.originalname}`);
      console.log(`📁 Upload path: ${req.file.path}`);

      // Check if uploaded file exists
      const fileExists = await fs.pathExists(req.file.path);
      console.log(`📄 File exists: ${fileExists}`);

      if (!fileExists) {
        console.log('❌ Uploaded file not found');
        recordCount = 0;
      } else {
        // Try a simpler approach - use Node.js to read Excel
        try {
          const XLSX = await import('xlsx');
          const workbook = XLSX.readFile(req.file.path);
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet);
          recordCount = jsonData.length;
          console.log(`📊 Records counted via xlsx: ${recordCount}`);
        } catch (xlsxError) {
          console.log('📊 xlsx method failed, trying Python fallback...');
          console.error('xlsx error:', xlsxError.message);

          // Fallback to Python method with better error handling
          const targetPath = path.join(__dirname, '../output_motor_renewal.xlsx');
          await fs.copy(req.file.path, targetPath);

          const countScript = path.join(__dirname, '../count_records.py');
          const scriptContent = `
import pandas as pd
import sys
import traceback

try:
    df = pd.read_excel('output_motor_renewal.xlsx')
    count = len(df)
    print(f"SUCCESS:{count}")
except Exception as e:
    print(f"ERROR:{str(e)}")
    traceback.print_exc()
`;

          await fs.writeFile(countScript, scriptContent);

          const { execSync } = await import('child_process');
          const result = execSync(`python "${countScript}"`, {
            encoding: 'utf8',
            cwd: path.dirname(countScript),
            timeout: 10000
          });

          console.log(`🐍 Python result: ${result.trim()}`);

          if (result.startsWith('SUCCESS:')) {
            recordCount = parseInt(result.split(':')[1]) || 0;
          } else {
            console.error('Python counting failed:', result);
            recordCount = 0;
          }

          // Clean up temporary files
          await fs.remove(countScript);
          await fs.remove(targetPath);
        }
      }

      console.log(`✅ Final record count: ${recordCount}`);
    } catch (error) {
      console.error('❌ Error in record counting process:', error);
      recordCount = 0;
    }

    console.log(`🚀 Backend: Sending response with recordCount: ${recordCount}`);

    res.json({
      success: true,
      message: 'Excel file uploaded successfully',
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      recordCount: recordCount
    });

  } catch (error) {
    console.error('Motor upload error:', error);
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

// Generate PDFs
router.post('/generate-pdfs', async (req, res) => {
  try {
    const scriptPath = path.join(__dirname, '../Motor_Insurance_Renewal.py');

    // Check if script exists
    if (!await fs.pathExists(scriptPath)) {
      return res.status(500).json({ error: 'Motor renewal script not found' });
    }

    // Check if Excel file exists
    const excelPath = path.join(__dirname, '../uploads/motor/output_motor_renewal.xlsx');
    if (!await fs.pathExists(excelPath)) {
      return res.status(400).json({ error: 'Please upload Excel file first' });
    }

    console.log(`🔄 Starting motor PDF generation for ${req.session.user}`);
    updateProgress('running', 10, 'Cleaning up old files...', 'generate');

    // Clean up old PDF files before generating new ones
    const outputDir = path.join(__dirname, '../output_motor');
    const mergedDir = path.join(__dirname, '../merged_motor_policies');

    try {
      if (await fs.pathExists(outputDir)) {
        await fs.emptyDir(outputDir);
        console.log('🗑️ Cleaned up old individual PDFs');
      }
      if (await fs.pathExists(mergedDir)) {
        await fs.emptyDir(mergedDir);
        console.log('🗑️ Cleaned up old merged PDFs');
      }
    } catch (cleanupError) {
      console.warn('⚠️ Warning: Could not clean up old files:', cleanupError.message);
    }

    updateProgress('running', 15, 'Preparing Excel file...', 'generate');

    // Copy Excel file to script directory
    const targetExcelPath = path.join(__dirname, '../output_motor_renewal.xlsx');
    await fs.copy(excelPath, targetExcelPath);

    updateProgress('running', 20, 'Starting PDF generation...', 'generate');

    const pythonProcess = spawn('python', [scriptPath], {
      cwd: path.dirname(scriptPath)
    });

    let output = '';
    let errorOutput = '';
    let progressCount = 0;

    pythonProcess.stdout.on('data', (data) => {
      const message = data.toString();
      output += message;
      console.log('Motor Script:', message.trim());

      // Update progress based on output
      progressCount += 2;
      const progress = Math.min(20 + progressCount, 90);
      updateProgress('running', progress, 'Generating PDFs...', 'generate');
    });

    pythonProcess.stderr.on('data', (data) => {
      const message = data.toString();
      errorOutput += message;
      console.error('Motor Script Error:', message.trim());
    });

    pythonProcess.on('close', async (code) => {
      try {
        // Clean up copied Excel file
        await fs.remove(targetExcelPath);

        if (code === 0) {
          console.log(`✅ Motor PDF generation completed for ${req.session.user}`);
          updateProgress('completed', 100, 'PDFs generated successfully', 'generate');
          res.json({
            success: true,
            message: 'PDFs generated successfully',
            output: output.trim()
          });
        } else {
          console.error(`❌ Motor PDF generation failed with code ${code}`);
          updateProgress('failed', 0, 'PDF generation failed', 'generate');
          res.status(500).json({
            error: 'PDF generation failed',
            details: errorOutput || output,
            exitCode: code
          });
        }
      } catch (cleanupError) {
        console.error('Cleanup error:', cleanupError);
        // Still send the main response
        if (code === 0) {
          res.json({
            success: true,
            message: 'PDFs generated successfully',
            output: output.trim()
          });
        } else {
          res.status(500).json({
            error: 'PDF generation failed',
            details: errorOutput || output,
            exitCode: code
          });
        }
      }
    });

    pythonProcess.on('error', (error) => {
      console.error('Motor script spawn error:', error);
      res.status(500).json({
        error: 'Failed to start PDF generation',
        details: error.message
      });
    });

  } catch (error) {
    console.error('Motor generate PDFs error:', error);
    res.status(500).json({ error: 'Failed to generate PDFs' });
  }
});

// Merge PDFs
router.post('/merge-pdfs', async (req, res) => {
  try {
    const scriptPath = path.join(__dirname, '../merge_motor_pdfs.py');

    // Check if script exists
    if (!await fs.pathExists(scriptPath)) {
      return res.status(500).json({ error: 'Motor merge script not found' });
    }

    // Check if output folder exists and has PDFs
    const outputDir = path.join(__dirname, '../output_motor');
    if (!await fs.pathExists(outputDir)) {
      return res.status(400).json({ error: 'No PDFs found. Please generate PDFs first.' });
    }

    const pdfFiles = await fs.readdir(outputDir);
    const pdfCount = pdfFiles.filter(file => file.endsWith('.pdf')).length;

    if (pdfCount === 0) {
      return res.status(400).json({ error: 'No PDFs found in output folder. Please generate PDFs first.' });
    }

    console.log(`🔄 Starting motor PDF merge for ${req.session.user} (${pdfCount} PDFs)`);
    updateProgress('running', 10, `Merging ${pdfCount} PDFs...`, 'merge');

    const pythonProcess = spawn('python', [scriptPath], {
      cwd: path.dirname(scriptPath)
    });

    let output = '';
    let errorOutput = '';

    pythonProcess.stdout.on('data', (data) => {
      const message = data.toString();
      output += message;
      console.log('Motor Merge:', message.trim());

      // Update progress
      updateProgress('running', 50, 'Merging PDFs in progress...', 'merge');
    });

    pythonProcess.stderr.on('data', (data) => {
      const message = data.toString();
      errorOutput += message;
      console.error('Motor Merge Error:', message.trim());
    });

    pythonProcess.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ Motor PDF merge completed for ${req.session.user}`);
        updateProgress('completed', 100, 'PDFs merged successfully', 'merge');
        res.json({
          success: true,
          message: 'PDFs merged successfully',
          output: output.trim()
        });
      } else {
        console.error(`❌ Motor PDF merge failed with code ${code}`);
        updateProgress('failed', 0, 'PDF merge failed', 'merge');
        res.status(500).json({
          error: 'PDF merge failed',
          details: errorOutput || output,
          exitCode: code
        });
      }
    });

    pythonProcess.on('error', (error) => {
      console.error('Motor merge script spawn error:', error);
      res.status(500).json({
        error: 'Failed to start PDF merge',
        details: error.message
      });
    });

  } catch (error) {
    console.error('Motor merge PDFs error:', error);
    res.status(500).json({ error: 'Failed to merge PDFs' });
  }
});

// Generate Printer Version PDFs
router.post('/generate-printer-pdfs', async (req, res) => {
  try {
    const scriptPath = path.join(__dirname, '../Motor_Insurance_Renewal_Printer_version.py');

    // Check if script exists
    if (!await fs.pathExists(scriptPath)) {
      return res.status(500).json({ error: 'Motor printer renewal script not found' });
    }

    // Check if Excel file exists
    const excelPath = path.join(__dirname, '../uploads/motor/output_motor_renewal.xlsx');
    if (!await fs.pathExists(excelPath)) {
      return res.status(400).json({ error: 'Please upload Excel file first' });
    }

    console.log(`🔄 Starting motor printer PDF generation for ${req.session.user}`);
    updateProgress('running', 10, 'Cleaning up old printer files...', 'generate-printer');

    // Clean up old printer PDF files before generating new ones
    const printerOutputDir = path.join(__dirname, '../output_motor_printer');
    const printerMergedDir = path.join(__dirname, '../merged_motor_printer_policies');

    try {
      if (await fs.pathExists(printerOutputDir)) {
        await fs.emptyDir(printerOutputDir);
        console.log('🗑️ Cleaned up old printer individual PDFs');
      }
      if (await fs.pathExists(printerMergedDir)) {
        await fs.emptyDir(printerMergedDir);
        console.log('🗑️ Cleaned up old printer merged PDFs');
      }
    } catch (cleanupError) {
      console.warn('⚠️ Warning: Could not clean up old printer files:', cleanupError.message);
    }

    updateProgress('running', 15, 'Preparing Excel file for printer version...', 'generate-printer');

    // Copy Excel file to script directory
    const targetExcelPath = path.join(__dirname, '../output_motor_renewal.xlsx');
    await fs.copy(excelPath, targetExcelPath);

    updateProgress('running', 20, 'Starting printer PDF generation...', 'generate-printer');

    const pythonProcess = spawn('python', [scriptPath], {
      cwd: path.dirname(scriptPath)
    });

    let output = '';
    let errorOutput = '';
    let progressCount = 0;

    pythonProcess.stdout.on('data', (data) => {
      const message = data.toString();
      output += message;
      console.log('Motor Printer Script:', message.trim());

      // Update progress based on output
      progressCount += 2;
      const progress = Math.min(20 + progressCount, 90);
      updateProgress('running', progress, 'Generating printer PDFs...', 'generate-printer');
    });

    pythonProcess.stderr.on('data', (data) => {
      const message = data.toString();
      errorOutput += message;
      console.error('Motor Printer Script Error:', message.trim());
    });

    pythonProcess.on('close', async (code) => {
      try {
        // Clean up copied Excel file
        await fs.remove(targetExcelPath);

        if (code === 0) {
          console.log(`✅ Motor printer PDF generation completed for ${req.session.user}`);
          updateProgress('completed', 100, 'Printer PDFs generated successfully', 'generate-printer');
          res.json({
            success: true,
            message: 'Printer PDFs generated successfully',
            output: output.trim()
          });
        } else {
          console.error(`❌ Motor printer PDF generation failed with code ${code}`);
          updateProgress('failed', 0, 'Printer PDF generation failed', 'generate-printer');
          res.status(500).json({
            error: 'Printer PDF generation failed',
            details: errorOutput || output,
            exitCode: code
          });
        }
      } catch (cleanupError) {
        console.error('Cleanup error:', cleanupError);
        // Still send the main response
        if (code === 0) {
          res.json({
            success: true,
            message: 'Printer PDFs generated successfully',
            output: output.trim()
          });
        } else {
          res.status(500).json({
            error: 'Printer PDF generation failed',
            details: errorOutput || output,
            exitCode: code
          });
        }
      }
    });

    pythonProcess.on('error', (error) => {
      console.error('Motor printer script spawn error:', error);
      res.status(500).json({
        error: 'Failed to start printer PDF generation',
        details: error.message
      });
    });

  } catch (error) {
    console.error('Motor generate printer PDFs error:', error);
    res.status(500).json({ error: 'Failed to generate printer PDFs' });
  }
});

// Merge Printer Version PDFs
router.post('/merge-printer-pdfs', async (req, res) => {
  try {
    const scriptPath = path.join(__dirname, '../merge_motor_printer_pdfs.py');
    console.log(`🔍 Printer merge script path: ${scriptPath}`);

    // Check if script exists
    if (!await fs.pathExists(scriptPath)) {
      console.error(`❌ Script not found at: ${scriptPath}`);
      return res.status(500).json({ error: 'Motor printer merge script not found' });
    }
    console.log(`✅ Script found at: ${scriptPath}`);

    // Check if output folder exists and has PDFs
    const outputDir = path.join(__dirname, '../output_motor_printer');
    console.log(`🔍 Checking printer PDFs in: ${outputDir}`);

    if (!await fs.pathExists(outputDir)) {
      console.error(`❌ Output directory not found: ${outputDir}`);
      return res.status(400).json({ error: 'No printer PDFs found. Please generate printer PDFs first.' });
    }

    const pdfFiles = await fs.readdir(outputDir);
    const pdfCount = pdfFiles.filter(file => file.endsWith('.pdf')).length;
    console.log(`📊 Found ${pdfCount} printer PDF files in directory`);

    if (pdfCount === 0) {
      console.error(`❌ No PDF files found in: ${outputDir}`);
      return res.status(400).json({ error: 'No printer PDFs found in output folder. Please generate printer PDFs first.' });
    }

    console.log(`🔄 Starting motor printer PDF merge for ${req.session.user} (${pdfCount} PDFs)`);
    updateProgress('running', 10, `Merging ${pdfCount} printer PDFs...`, 'merge-printer');

    const pythonProcess = spawn('python', [scriptPath], {
      cwd: path.dirname(scriptPath)
    });

    let output = '';
    let errorOutput = '';

    pythonProcess.stdout.on('data', (data) => {
      const message = data.toString();
      output += message;
      console.log('Motor Printer Merge:', message.trim());

      // Update progress
      updateProgress('running', 50, 'Merging printer PDFs in progress...', 'merge-printer');
    });

    pythonProcess.stderr.on('data', (data) => {
      const message = data.toString();
      errorOutput += message;
      console.error('Motor Printer Merge Error:', message.trim());
    });

    pythonProcess.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ Motor printer PDF merge completed for ${req.session.user}`);
        updateProgress('completed', 100, 'Printer PDFs merged successfully', 'merge-printer');
        res.json({
          success: true,
          message: 'Printer PDFs merged successfully',
          output: output.trim()
        });
      } else {
        console.error(`❌ Motor printer PDF merge failed with code ${code}`);
        updateProgress('failed', 0, 'Printer PDF merge failed', 'merge-printer');
        res.status(500).json({
          error: 'Printer PDF merge failed',
          details: errorOutput || output,
          exitCode: code
        });
      }
    });

    pythonProcess.on('error', (error) => {
      console.error('Motor printer merge script spawn error:', error);
      res.status(500).json({
        error: 'Failed to start printer PDF merge',
        details: error.message
      });
    });

  } catch (error) {
    console.error('Motor merge printer PDFs error:', error);
    res.status(500).json({ error: 'Failed to merge printer PDFs' });
  }
});

// Get printer files list
router.get('/printer-files', async (req, res) => {
  try {
    const outputDir = path.join(__dirname, '../output_motor_printer');
    const mergedDir = path.join(__dirname, '../merged_motor_printer_policies');

    const files = {
      individual: [],
      merged: []
    };

    // Get individual printer PDFs
    if (await fs.pathExists(outputDir)) {
      const outputFiles = await fs.readdir(outputDir);
      files.individual = await Promise.all(
        outputFiles
          .filter(file => file.endsWith('.pdf'))
          .map(async file => {
            const filePath = path.join(outputDir, file);
            const stats = await fs.stat(filePath);
            return {
              name: file,
              downloadUrl: `/downloads/motor/printer-individual/${file}`,
              size: Math.round(stats.size / 1024), // Size in KB
              modified: stats.mtime
            };
          })
      );
    }

    // Get merged printer PDFs
    if (await fs.pathExists(mergedDir)) {
      const mergedFiles = await fs.readdir(mergedDir);
      files.merged = await Promise.all(
        mergedFiles
          .filter(file => file.endsWith('.pdf'))
          .map(async file => {
            const filePath = path.join(mergedDir, file);
            const stats = await fs.stat(filePath);
            return {
              name: file,
              downloadUrl: `/downloads/motor/printer-merged/${file}`,
              size: Math.round(stats.size / 1024), // Size in KB
              modified: stats.mtime
            };
          })
      );
    }

    res.json(files);

  } catch (error) {
    console.error('Motor get printer files error:', error);
    res.status(500).json({ error: 'Failed to get printer files list' });
  }
});

// Download all individual printer PDFs as zip
router.get('/download/all-printer-individual', async (req, res) => {
  try {
    const archiver = (await import('archiver')).default;
    const outputDir = path.join(__dirname, '../output_motor_printer');

    if (!await fs.pathExists(outputDir)) {
      return res.status(404).json({ error: 'No printer PDFs found' });
    }

    const files = await fs.readdir(outputDir);
    const pdfFiles = files.filter(file => file.endsWith('.pdf'));

    if (pdfFiles.length === 0) {
      return res.status(404).json({ error: 'No printer PDF files found' });
    }

    console.log(`📦 Starting motor printer zip download: ${pdfFiles.length} files for ${req.session.user}`);

    // Set response headers for zip download
    const zipName = `motor_printer_renewal_notices_${new Date().toISOString().split('T')[0]}.zip`;
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${zipName}"`);

    // Create zip archive
    const archive = archiver('zip', {
      zlib: { level: 9 } // Maximum compression
    });

    // Handle archive errors
    archive.on('error', (err) => {
      console.error('Archive error:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to create zip file' });
      } else {
        res.end();
      }
    });

    // Pipe archive to response
    archive.pipe(res);

    // Add files to archive with error checking
    for (const file of pdfFiles) {
      const filePath = path.join(outputDir, file);

      // Check if file exists before adding
      if (await fs.pathExists(filePath)) {
        archive.file(filePath, { name: file });
        console.log(`Added to zip: ${file}`);
      } else {
        console.warn(`File not found, skipping: ${file}`);
      }
    }

    // Finalize the archive
    console.log('Finalizing archive...');
    await archive.finalize();

    console.log(`✅ Motor printer zip download completed: ${pdfFiles.length} files for ${req.session.user}`);

  } catch (error) {
    console.error('Motor download all printer error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to create zip file' });
    } else {
      res.end();
    }
  }
});

// Download individual printer PDF
router.get('/download/printer-individual/:filename', async (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(__dirname, '../output_motor_printer', filename);

    if (!await fs.pathExists(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    res.download(filePath, filename, (err) => {
      if (err) {
        console.error('Download error:', err);
        res.status(500).json({ error: 'Failed to download file' });
      }
    });
  } catch (error) {
    console.error('Motor download printer individual error:', error);
    res.status(500).json({ error: 'Failed to download file' });
  }
});

// Download merged printer PDF
router.get('/download/printer-merged/:filename', async (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(__dirname, '../merged_motor_printer_policies', filename);

    if (!await fs.pathExists(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    res.download(filePath, filename, (err) => {
      if (err) {
        console.error('Download error:', err);
        res.status(500).json({ error: 'Failed to download file' });
      }
    });
  } catch (error) {
    console.error('Motor download printer merged error:', error);
    res.status(500).json({ error: 'Failed to download file' });
  }
});

// Send emails
router.post('/send-emails', async (req, res) => {
  try {
    const { sendRenewalEmails } = await import('../services/brevoService.js');

    // Check if PDFs exist
    const outputDir = path.join(__dirname, '../output_motor');
    if (!await fs.pathExists(outputDir)) {
      return res.status(400).json({ error: 'No PDFs found. Please generate PDFs first.' });
    }

    const pdfFiles = await fs.readdir(outputDir);
    const pdfCount = pdfFiles.filter(file => file.endsWith('.pdf')).length;

    if (pdfCount === 0) {
      return res.status(400).json({ error: 'No PDFs found. Please generate PDFs first.' });
    }

    // Read actual data from Excel file
    let recipients = [];
    try {
      const excelPath = path.join(__dirname, '../uploads/motor/output_motor_renewal.xlsx');
      if (await fs.pathExists(excelPath)) {
        const xlsx = await import('xlsx');
        const workbook = xlsx.default.readFile(excelPath);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const data = xlsx.default.utils.sheet_to_json(worksheet);

        // Process all records to send emails to actual customers
        console.log(`📧 Processing ${data.length} records for email sending`);

        for (let i = 0; i < data.length; i++) {
          const record = data[i];
          console.log('Excel record sample:', {
            'Cover End Dt': record['Cover End Dt'],
            'Policy No': record['Policy No'],
            'New Net Premium': record['New Net Premium'],
            'Title': record.Title,
            'Firstname': record.Firstname,
            'Surname': record.Surname
          });

          // Parse Excel date (could be serial number or date string)
          let coverEndDate;
          const coverEndValue = record['Cover End Dt'];

          if (typeof coverEndValue === 'number') {
            // Excel serial date number - use xlsx library's built-in conversion
            const excelDate = xlsx.default.SSF.parse_date_code(coverEndValue);
            coverEndDate = new Date(excelDate.y, excelDate.m - 1, excelDate.d);
          } else if (coverEndValue instanceof Date) {
            // Already a Date object
            coverEndDate = new Date(coverEndValue);
          } else if (coverEndValue) {
            // Try parsing as date string - handle DD/MM/YYYY format
            const dateStr = coverEndValue.toString().trim();

            // Handle DD/MM/YYYY HH:MM:SS format
            if (dateStr.includes('/')) {
              const datePart = dateStr.split(' ')[0]; // Take only date part, ignore time
              const parts = datePart.split('/');
              if (parts.length === 3) {
                // Assume DD/MM/YYYY format
                const day = parseInt(parts[0]);
                const month = parseInt(parts[1]) - 1; // Month is 0-indexed
                const year = parseInt(parts[2]);
                coverEndDate = new Date(year, month, day);
              } else {
                coverEndDate = new Date(dateStr);
              }
            } else {
              coverEndDate = new Date(dateStr);
            }
          } else {
            // Fallback to current date + 1 year
            coverEndDate = new Date();
            coverEndDate.setFullYear(coverEndDate.getFullYear() + 1);
          }

          // Calculate renewal dates
          // If policy ends on 31/12/2025, renewal should start on 01/01/2026
          const renewalStartDate = new Date(coverEndDate);
          renewalStartDate.setDate(renewalStartDate.getDate() + 1);

          // Renewal end date is exactly 1 year from renewal start, minus 1 day
          // So if renewal starts 01/01/2026, it ends 31/12/2026
          const renewalEndDate = new Date(renewalStartDate);
          renewalEndDate.setFullYear(renewalEndDate.getFullYear() + 1);
          renewalEndDate.setDate(renewalEndDate.getDate() - 1);

          console.log('Date parsing debug:', {
            originalValue: coverEndValue,
            valueType: typeof coverEndValue,
            parsedDate: coverEndDate,
            formattedDate: coverEndDate.toLocaleDateString('en-GB', {
              day: '2-digit',
              month: 'long',
              year: 'numeric'
            }),
            jsDateString: coverEndDate.toString()
          });

          // Get customer email from Excel
          const customerEmail = record['Email ID'] || record['Email'] || '';

          // Skip if no valid email
          if (!customerEmail || !customerEmail.includes('@')) {
            console.log(`⚠️ Skipping record ${i + 1}: Invalid email '${customerEmail}' for ${record.Title} ${record.Firstname} ${record.Surname}`);
            continue;
          }

          // Separate display name (for email greeting) and filename name (for PDF matching)
          let displayName;
          let filenameName;
          
          if (!record.Title || record.Title.trim() === '') {
            // Company policy: use "Dear Valued Customer" for greeting, actual name for filename
            displayName = 'Dear Valued Customer';
            filenameName = `${record.Firstname || ''} ${record.Surname || ''}`.trim();
          } else {
            // Individual policy: use full name for both
            const fullName = `${record.Title || ''} ${record.Firstname || ''} ${record.Surname || ''}`.trim();
            displayName = fullName;
            filenameName = fullName;
          }

          // Generate the exact filename using actual names (not "Dear Valued Customer")
          let safeName = filenameName;
          // Replace common problematic characters (same as PDF script)
          safeName = safeName.replace('â€"', '-');  // Replace em dash
          safeName = safeName.replace('–', '-');    // Replace en dash
          safeName = safeName.replace('—', '-');    // Replace em dash
          safeName = safeName.replace('"', '');     // Remove quotes
          safeName = safeName.replace('"', '');     // Remove smart quotes left
          safeName = safeName.replace('"', '');     // Remove smart quotes right
          safeName = safeName.replace("'", '');     // Remove smart apostrophes
          safeName = safeName.replace('`', '');     // Remove backticks

          // Remove any remaining non-ASCII characters and replace with underscore
          safeName = safeName.replace(/[^\x00-\x7F]+/g, '_');

          // Replace spaces and path separators
          safeName = safeName.replace(/ /g, '_').replace(/\//g, '_').replace(/\\/g, '_');

          // Remove multiple consecutive underscores
          safeName = safeName.replace(/_+/g, '_');

          // Remove leading/trailing underscores
          safeName = safeName.replace(/^_+|_+$/g, '');

          // Truncate name if too long (same as PDF script)
          const maxNameLength = 100;
          if (safeName.length > maxNameLength) {
            safeName = safeName.substring(0, maxNameLength);
          }

          const safePolicy = (record['Policy No'] || '').replace(/\//g, '_').replace(/\\/g, '_');
          const expectedFilename = `Motor_Renewal_${safeName}_${safePolicy}.pdf`;

          // Add to recipients array
          recipients.push({
            email: customerEmail.trim(),
            name: displayName,  // Use display name for email greeting
            policyNo: record['Policy No'] || '',
            expectedFilename: expectedFilename,
            expiryDate: coverEndDate.toLocaleDateString('en-GB', {
              day: '2-digit',
              month: 'long',
              year: 'numeric'
            }),
            renewalStart: renewalStartDate.toLocaleDateString('en-GB', {
              day: '2-digit',
              month: 'long',
              year: 'numeric'
            }),
            renewalEnd: renewalEndDate.toLocaleDateString('en-GB', {
              day: '2-digit',
              month: 'long',
              year: 'numeric'
            }),
            premium: record['New Net Premium'] || '0',
            make: record.Make || '',
            model: record.Model || '',
            vehicleNo: record['Vehicle No'] || ''
          });

          console.log(`✅ Added recipient ${i + 1}: ${customerEmail} (Display: "${displayName}", File: "${filenameName}")`);
        }
      }
    } catch (error) {
      console.error('Error reading Excel file:', error);
    }

    // Check if we have valid recipients
    if (recipients.length === 0) {
      return res.status(400).json({
        error: 'No valid email addresses found in Excel file. Please check the "Email ID" column.'
      });
    }

    console.log(`📧 Motor email sending requested by ${req.session.user} for ${recipients.length} recipients`);
    updateProgress('running', 10, 'Preparing emails...', 'email');

    // Send emails using Brevo
    updateProgress('running', 50, 'Sending emails...', 'email');
    const results = await sendRenewalEmails('motor', recipients, outputDir);
    updateProgress('completed', 100, `Emails sent: ${results.success} success, ${results.failed} failed`, 'email');

    res.json({
      success: true,
      message: `Email sending completed: ${results.success} sent, ${results.failed} failed`,
      sender: 'NICL Motor',
      results: results
    });

  } catch (error) {
    console.error('Motor send emails error:', error);
    res.status(500).json({
      error: 'Failed to send emails',
      details: error.message
    });
  }
});

// Get files list
router.get('/files', async (req, res) => {
  try {
    const outputDir = path.join(__dirname, '../output_motor');
    const mergedDir = path.join(__dirname, '../merged_motor_policies');

    const files = {
      individual: [],
      merged: []
    };

    // Get individual PDFs
    if (await fs.pathExists(outputDir)) {
      const outputFiles = await fs.readdir(outputDir);
      files.individual = await Promise.all(
        outputFiles
          .filter(file => file.endsWith('.pdf'))
          .map(async file => {
            const filePath = path.join(outputDir, file);
            const stats = await fs.stat(filePath);
            return {
              name: file,
              downloadUrl: `/downloads/motor/individual/${file}`,
              size: Math.round(stats.size / 1024), // Size in KB
              modified: stats.mtime
            };
          })
      );
    }

    // Get merged PDFs
    if (await fs.pathExists(mergedDir)) {
      const mergedFiles = await fs.readdir(mergedDir);
      files.merged = await Promise.all(
        mergedFiles
          .filter(file => file.endsWith('.pdf'))
          .map(async file => {
            const filePath = path.join(mergedDir, file);
            const stats = await fs.stat(filePath);
            return {
              name: file,
              downloadUrl: `/downloads/motor/merged/${file}`,
              size: Math.round(stats.size / 1024), // Size in KB
              modified: stats.mtime
            };
          })
      );
    }

    res.json(files);

  } catch (error) {
    console.error('Motor get files error:', error);
    res.status(500).json({ error: 'Failed to get files list' });
  }
});

// Download individual PDF
router.get('/download/individual/:filename', async (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(__dirname, '../output_motor', filename);

    if (!await fs.pathExists(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    res.download(filePath, filename, (err) => {
      if (err) {
        console.error('Download error:', err);
        res.status(500).json({ error: 'Failed to download file' });
      }
    });
  } catch (error) {
    console.error('Motor download individual error:', error);
    res.status(500).json({ error: 'Failed to download file' });
  }
});

// Download merged PDF
router.get('/download/merged/:filename', async (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(__dirname, '../merged_motor_policies', filename);

    if (!await fs.pathExists(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    res.download(filePath, filename, (err) => {
      if (err) {
        console.error('Download error:', err);
        res.status(500).json({ error: 'Failed to download file' });
      }
    });
  } catch (error) {
    console.error('Motor download merged error:', error);
    res.status(500).json({ error: 'Failed to download file' });
  }
});

// Download all individual PDFs as zip
router.get('/download/all-individual', async (req, res) => {
  try {
    const archiver = (await import('archiver')).default;
    const outputDir = path.join(__dirname, '../output_motor');

    if (!await fs.pathExists(outputDir)) {
      return res.status(404).json({ error: 'No PDFs found' });
    }

    const files = await fs.readdir(outputDir);
    const pdfFiles = files.filter(file => file.endsWith('.pdf'));

    if (pdfFiles.length === 0) {
      return res.status(404).json({ error: 'No PDF files found' });
    }

    console.log(`📦 Starting motor zip download: ${pdfFiles.length} files for ${req.session.user}`);

    // Set response headers for zip download
    const zipName = `motor_renewal_notices_${new Date().toISOString().split('T')[0]}.zip`;
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${zipName}"`);

    // Create zip archive
    const archive = archiver('zip', {
      zlib: { level: 9 } // Maximum compression
    });

    // Handle archive errors - don't send JSON response after headers are set
    archive.on('error', (err) => {
      console.error('Archive error:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to create zip file' });
      } else {
        res.end();
      }
    });

    // Handle archive warnings
    archive.on('warning', (err) => {
      if (err.code === 'ENOENT') {
        console.warn('Archive warning:', err);
      } else {
        console.error('Archive warning (critical):', err);
      }
    });

    // Pipe archive to response
    archive.pipe(res);

    // Add files to archive with error checking
    for (const file of pdfFiles) {
      const filePath = path.join(outputDir, file);

      // Check if file exists before adding
      if (await fs.pathExists(filePath)) {
        archive.file(filePath, { name: file });
        console.log(`Added to zip: ${file}`);
      } else {
        console.warn(`File not found, skipping: ${file}`);
      }
    }

    // Finalize the archive
    console.log('Finalizing archive...');
    await archive.finalize();

    console.log(`✅ Motor zip download completed: ${pdfFiles.length} files for ${req.session.user}`);

  } catch (error) {
    console.error('Motor download all error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to create zip file' });
    } else {
      res.end();
    }
  }
});

// Check workflow status - what steps are completed
router.get('/status', async (req, res) => {
  try {
    const status = {
      upload: false,
      generate: false,
      merge: false,
      canSendEmails: false,
      currentStep: 1
    };

    // Check if Excel file exists
    const excelPath = path.join(__dirname, '../uploads/motor/output_motor_renewal.xlsx');
    if (await fs.pathExists(excelPath)) {
      status.upload = true;
      status.currentStep = 2;
    }

    // Check if PDFs exist
    const outputDir = path.join(__dirname, '../output_motor');
    if (await fs.pathExists(outputDir)) {
      const pdfFiles = await fs.readdir(outputDir);
      const pdfCount = pdfFiles.filter(file => file.endsWith('.pdf')).length;

      if (pdfCount > 0) {
        status.generate = true;
        status.currentStep = 3;
      }
    }

    // Check if merged PDFs exist
    const mergedDir = path.join(__dirname, '../merged_motor_policies');
    if (await fs.pathExists(mergedDir)) {
      const mergedFiles = await fs.readdir(mergedDir);
      const mergedCount = mergedFiles.filter(file => file.endsWith('.pdf')).length;

      if (mergedCount > 0) {
        status.merge = true;
        status.currentStep = 4;
        status.canSendEmails = true;
      }
    }

    res.json(status);

  } catch (error) {
    console.error('Motor status check error:', error);
    res.status(500).json({ error: 'Failed to check status' });
  }
});

// Progress tracking
let currentProgress = {
  status: 'idle',
  progress: 0,
  message: 'No active process',
  step: null
};

// Get progress (real-time progress tracking)
router.get('/progress', (req, res) => {
  res.json(currentProgress);
});

// Helper function to update progress
const updateProgress = (status, progress, message, step = null) => {
  currentProgress = { status, progress, message, step };
  console.log(`📊 Motor Progress: ${progress}% - ${message}`);
};

export default router;