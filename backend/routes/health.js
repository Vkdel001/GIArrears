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
const requireHealthAuth = (req, res, next) => {
  if (!req.session.user || req.session.team !== 'health') {
    return res.status(403).json({ error: 'Health team access required' });
  }
  next();
};

// Apply auth middleware to all health routes
router.use(requireHealthAuth);

// Configure multer for health file uploads
const healthStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/health');
    fs.ensureDirSync(uploadDir);
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, 'RENEWAL_LISTING.xlsx');
  }
});

const healthUpload = multer({ 
  storage: healthStorage,
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
router.post('/upload-excel', healthUpload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log(`📁 Health Excel uploaded by ${req.session.user}: ${req.file.originalname}`);

    // Count records in Excel file - simplified approach with detailed logging
    let recordCount = 0;
    try {
      console.log(`🔍 Starting health record count for: ${req.file.originalname}`);
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
          console.log(`📊 Health records counted via xlsx: ${recordCount}`);
        } catch (xlsxError) {
          console.log('📊 xlsx method failed, trying Python fallback...');
          console.error('xlsx error:', xlsxError.message);
          
          // Fallback to Python method with better error handling
          const targetPath = path.join(__dirname, '../RENEWAL_LISTING.xlsx');
          await fs.copy(req.file.path, targetPath);
          
          const countScript = path.join(__dirname, '../count_health_records.py');
          const scriptContent = `
import pandas as pd
import sys
import traceback

try:
    df = pd.read_excel('RENEWAL_LISTING.xlsx')
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
      
      console.log(`✅ Final health record count: ${recordCount}`);
    } catch (error) {
      console.error('❌ Error in health record counting process:', error);
      recordCount = 0;
    }

    res.json({
      success: true,
      message: 'Excel file uploaded successfully',
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      recordCount: recordCount
    });

  } catch (error) {
    console.error('Health upload error:', error);
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

// Generate PDFs
router.post('/generate-pdfs', async (req, res) => {
  try {
    const scriptPath = path.join(__dirname, '../healthcare_renewal_final.py');
    
    // Check if script exists
    if (!await fs.pathExists(scriptPath)) {
      return res.status(500).json({ error: 'Healthcare renewal script not found' });
    }

    // Check if Excel file exists
    const excelPath = path.join(__dirname, '../uploads/health/RENEWAL_LISTING.xlsx');
    if (!await fs.pathExists(excelPath)) {
      return res.status(400).json({ error: 'Please upload Excel file first' });
    }

    console.log(`🔄 Starting health PDF generation for ${req.session.user}`);
    updateProgress('running', 10, 'Cleaning up old files...', 'generate');

    // Clean up old PDF files before generating new ones
    const outputDir = path.join(__dirname, '../output_renewals');
    const mergedDir = path.join(__dirname, '../merged_health_policies');
    
    try {
      if (await fs.pathExists(outputDir)) {
        await fs.emptyDir(outputDir);
        console.log('🗑️ Cleaned up old health individual PDFs');
      }
      if (await fs.pathExists(mergedDir)) {
        await fs.emptyDir(mergedDir);
        console.log('🗑️ Cleaned up old health merged PDFs');
      }
    } catch (cleanupError) {
      console.warn('⚠️ Warning: Could not clean up old health files:', cleanupError.message);
    }

    updateProgress('running', 15, 'Preparing Excel file...', 'generate');

    // Copy Excel file to script directory
    const targetExcelPath = path.join(__dirname, '../RENEWAL_LISTING.xlsx');
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
      console.log('Health Script:', message.trim());
      
      // Update progress based on output
      progressCount += 2;
      const progress = Math.min(20 + progressCount, 90);
      updateProgress('running', progress, 'Generating PDFs...', 'generate');
    });

    pythonProcess.stderr.on('data', (data) => {
      const message = data.toString();
      errorOutput += message;
      console.error('Health Script Error:', message.trim());
    });

    pythonProcess.on('close', async (code) => {
      try {
        // Clean up copied Excel file
        await fs.remove(targetExcelPath);

        if (code === 0) {
          console.log(`✅ Health PDF generation completed for ${req.session.user}`);
          updateProgress('completed', 100, 'PDFs generated successfully', 'generate');
          res.json({
            success: true,
            message: 'PDFs generated successfully',
            output: output.trim()
          });
        } else {
          console.error(`❌ Health PDF generation failed with code ${code}`);
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
      console.error('Health script spawn error:', error);
      res.status(500).json({
        error: 'Failed to start PDF generation',
        details: error.message
      });
    });

  } catch (error) {
    console.error('Health generate PDFs error:', error);
    res.status(500).json({ error: 'Failed to generate PDFs' });
  }
});

// Attach HEALTHSENSE forms (First merge - simple_merge.py)
router.post('/attach-forms', async (req, res) => {
  try {
    const scriptPath = path.join(__dirname, '../simple_merge.py');
    
    // Check if script exists
    if (!await fs.pathExists(scriptPath)) {
      return res.status(500).json({ error: 'Simple merge script not found' });
    }

    // Check if output folder exists and has PDFs
    const outputDir = path.join(__dirname, '../output_renewals');
    if (!await fs.pathExists(outputDir)) {
      return res.status(400).json({ error: 'No PDFs found. Please generate PDFs first.' });
    }

    const pdfFiles = await fs.readdir(outputDir);
    const pdfCount = pdfFiles.filter(file => file.endsWith('.pdf')).length;
    
    if (pdfCount === 0) {
      return res.status(400).json({ error: 'No PDFs found in output folder. Please generate PDFs first.' });
    }

    // Check if required HEALTHSENSE files exist
    const requiredFiles = [
      'Renewal Acceptance Form - HealthSense Plan V2 0.pdf',
      'Annex.pdf'
    ];

    for (const file of requiredFiles) {
      const filePath = path.join(__dirname, '..', file);
      if (!await fs.pathExists(filePath)) {
        return res.status(400).json({ 
          error: `Required HEALTHSENSE file not found: ${file}`,
          details: 'Please ensure all HEALTHSENSE PDF files are in the backend directory'
        });
      }
    }

    console.log(`🔄 Starting HEALTHSENSE forms attachment for ${req.session.user} (${pdfCount} PDFs)`);
    updateProgress('running', 10, `Attaching HEALTHSENSE forms to ${pdfCount} PDFs...`, 'attach');

    const pythonProcess = spawn('python', [scriptPath], {
      cwd: path.dirname(scriptPath)
    });

    let output = '';
    let errorOutput = '';

    pythonProcess.stdout.on('data', (data) => {
      const message = data.toString();
      output += message;
      console.log('Health Attach:', message.trim());
      
      // Update progress
      updateProgress('running', 50, 'Attaching forms in progress...', 'attach');
    });

    pythonProcess.stderr.on('data', (data) => {
      const message = data.toString();
      errorOutput += message;
      console.error('Health Attach Error:', message.trim());
    });

    pythonProcess.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ HEALTHSENSE forms attachment completed for ${req.session.user}`);
        updateProgress('completed', 100, 'HEALTHSENSE forms attached successfully', 'attach');
        res.json({
          success: true,
          message: 'HEALTHSENSE forms attached successfully (First merge completed)',
          output: output.trim()
        });
      } else {
        console.error(`❌ HEALTHSENSE forms attachment failed with code ${code}`);
        updateProgress('failed', 0, 'Forms attachment failed', 'attach');
        res.status(500).json({
          error: 'Forms attachment failed',
          details: errorOutput || output,
          exitCode: code
        });
      }
    });

    pythonProcess.on('error', (error) => {
      console.error('Health attach script spawn error:', error);
      res.status(500).json({
        error: 'Failed to start forms attachment',
        details: error.message
      });
    });

  } catch (error) {
    console.error('Health attach forms error:', error);
    res.status(500).json({ error: 'Failed to attach forms' });
  }
});

// Final merge (Second merge - health_renewal_mergefile.py)
router.post('/merge-all', async (req, res) => {
  try {
    const scriptPath = path.join(__dirname, '../health_renewal_mergefile.py');
    
    // Check if script exists
    if (!await fs.pathExists(scriptPath)) {
      return res.status(500).json({ error: 'Health merge script not found' });
    }

    // Check if output folder exists and has PDFs
    const outputDir = path.join(__dirname, '../output_renewals');
    if (!await fs.pathExists(outputDir)) {
      return res.status(400).json({ error: 'No PDFs found. Please attach forms first.' });
    }

    const pdfFiles = await fs.readdir(outputDir);
    const pdfCount = pdfFiles.filter(file => file.endsWith('.pdf')).length;
    
    if (pdfCount === 0) {
      return res.status(400).json({ error: 'No PDFs found in output folder. Please attach forms first.' });
    }

    console.log(`🔄 Starting final health PDF merge for ${req.session.user} (${pdfCount} PDFs)`);
    updateProgress('running', 10, `Final merging ${pdfCount} PDFs...`, 'merge');

    const pythonProcess = spawn('python', [scriptPath], {
      cwd: path.dirname(scriptPath)
    });

    let output = '';
    let errorOutput = '';

    pythonProcess.stdout.on('data', (data) => {
      const message = data.toString();
      output += message;
      console.log('Health Final Merge:', message.trim());
      
      // Update progress
      updateProgress('running', 50, 'Final merge in progress...', 'merge');
    });

    pythonProcess.stderr.on('data', (data) => {
      const message = data.toString();
      errorOutput += message;
      console.error('Health Final Merge Error:', message.trim());
    });

    pythonProcess.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ Final health PDF merge completed for ${req.session.user}`);
        updateProgress('completed', 100, 'Final merge completed successfully', 'merge');
        res.json({
          success: true,
          message: 'Final merge completed successfully (Second merge completed)',
          output: output.trim()
        });
      } else {
        console.error(`❌ Final health PDF merge failed with code ${code}`);
        updateProgress('failed', 0, 'Final merge failed', 'merge');
        res.status(500).json({
          error: 'Final merge failed',
          details: errorOutput || output,
          exitCode: code
        });
      }
    });

    pythonProcess.on('error', (error) => {
      console.error('Health final merge script spawn error:', error);
      res.status(500).json({
        error: 'Failed to start final merge',
        details: error.message
      });
    });

  } catch (error) {
    console.error('Health merge all error:', error);
    res.status(500).json({ error: 'Failed to perform final merge' });
  }
});

// Send emails
router.post('/send-emails', async (req, res) => {
  try {
    const { sendRenewalEmails } = await import('../services/brevoService.js');
    
    // Check if PDFs exist (should be merged PDFs with HEALTHSENSE attachments)
    const outputDir = path.join(__dirname, '../output_renewals');
    if (!await fs.pathExists(outputDir)) {
      return res.status(400).json({ error: 'No PDFs found. Please complete the merge process first.' });
    }

    const pdfFiles = await fs.readdir(outputDir);
    const pdfCount = pdfFiles.filter(file => file.endsWith('.pdf')).length;
    
    if (pdfCount === 0) {
      return res.status(400).json({ error: 'No PDFs found. Please complete the merge process first.' });
    }

    // For demo purposes, create sample recipients
    // In production, this would come from the Excel file or database
    const recipients = [
      {
        email: req.session.user, // Send to current user for testing
        name: 'Test Customer',
        policyNo: 'HEALTH001'
      }
    ];

    console.log(`📧 Health email sending requested by ${req.session.user} for ${pdfCount} PDFs`);
    updateProgress('running', 10, 'Preparing emails...', 'email');

    // Send emails using Brevo
    updateProgress('running', 50, 'Sending emails...', 'email');
    const results = await sendRenewalEmails('health', recipients, outputDir);
    updateProgress('completed', 100, `Emails sent: ${results.success} success, ${results.failed} failed`, 'email');
    
    res.json({
      success: true,
      message: `Email sending completed: ${results.success} sent, ${results.failed} failed`,
      sender: 'NICL Health',
      results: results
    });

  } catch (error) {
    console.error('Health send emails error:', error);
    res.status(500).json({ 
      error: 'Failed to send emails',
      details: error.message 
    });
  }
});

// Get files list
router.get('/files', async (req, res) => {
  try {
    const outputDir = path.join(__dirname, '../output_renewals');
    const mergedDir = path.join(__dirname, '../merged_health_policies');
    
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
              downloadUrl: `/downloads/health/individual/${file}`,
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
              downloadUrl: `/downloads/health/merged/${file}`,
              size: Math.round(stats.size / 1024), // Size in KB
              modified: stats.mtime
            };
          })
      );
    }

    res.json(files);

  } catch (error) {
    console.error('Health get files error:', error);
    res.status(500).json({ error: 'Failed to get files list' });
  }
});

// Download individual PDF
router.get('/download/individual/:filename', async (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(__dirname, '../output_renewals', filename);
    
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
    console.error('Health download individual error:', error);
    res.status(500).json({ error: 'Failed to download file' });
  }
});

// Download merged PDF
router.get('/download/merged/:filename', async (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(__dirname, '../merged_health_policies', filename);
    
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
    console.error('Health download merged error:', error);
    res.status(500).json({ error: 'Failed to download file' });
  }
});

// Download all individual PDFs as zip
router.get('/download/all-individual', async (req, res) => {
  try {
    const archiver = (await import('archiver')).default;
    const outputDir = path.join(__dirname, '../output_renewals');
    
    if (!await fs.pathExists(outputDir)) {
      return res.status(404).json({ error: 'No PDFs found' });
    }

    const files = await fs.readdir(outputDir);
    const pdfFiles = files.filter(file => file.endsWith('.pdf'));
    
    if (pdfFiles.length === 0) {
      return res.status(404).json({ error: 'No PDF files found' });
    }

    console.log(`📦 Starting health zip download: ${pdfFiles.length} files for ${req.session.user}`);

    // Set response headers for zip download
    const zipName = `health_renewal_notices_${new Date().toISOString().split('T')[0]}.zip`;
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
    
    console.log(`✅ Health zip download completed: ${pdfFiles.length} files for ${req.session.user}`);

  } catch (error) {
    console.error('Health download all error:', error);
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
      attach: false,
      merge: false,
      canSendEmails: false,
      currentStep: 1
    };

    // Check if Excel file exists
    const excelPath = path.join(__dirname, '../uploads/health/RENEWAL_LISTING.xlsx');
    if (await fs.pathExists(excelPath)) {
      status.upload = true;
      status.currentStep = 2;
    }

    // Check if PDFs exist
    const outputDir = path.join(__dirname, '../output_renewals');
    if (await fs.pathExists(outputDir)) {
      const pdfFiles = await fs.readdir(outputDir);
      const pdfCount = pdfFiles.filter(file => file.endsWith('.pdf')).length;
      
      if (pdfCount > 0) {
        status.generate = true;
        status.currentStep = 3;
        
        // For health, if PDFs exist, assume attach step is also done
        // (since simple_merge.py modifies existing PDFs in place)
        status.attach = true;
        status.currentStep = 4;
      }
    }

    // Check if merged PDFs exist
    const mergedDir = path.join(__dirname, '../merged_health_policies');
    if (await fs.pathExists(mergedDir)) {
      const mergedFiles = await fs.readdir(mergedDir);
      const mergedCount = mergedFiles.filter(file => file.endsWith('.pdf')).length;
      
      if (mergedCount > 0) {
        status.merge = true;
        status.currentStep = 5;
        status.canSendEmails = true;
      }
    }

    res.json(status);

  } catch (error) {
    console.error('Health status check error:', error);
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
  console.log(`📊 Health Progress: ${progress}% - ${message}`);
};

export default router;