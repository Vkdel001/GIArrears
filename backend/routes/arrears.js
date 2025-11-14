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
const requireArrearsAuth = (req, res, next) => {
    if (!req.session.user || req.session.team !== 'arrears') {
        return res.status(403).json({ error: 'Arrears team access required' });
    }
    next();
};

// Apply auth middleware to all arrears routes
router.use(requireArrearsAuth);

// Configure multer for arrears file uploads
const arrearsStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../uploads/arrears');
        fs.ensureDirSync(uploadDir);
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, 'Extracted_Arrears_Data.xlsx');
    }
});

const arrearsUpload = multer({
    storage: arrearsStorage,
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

// Progress tracking
let currentProgress = {
    status: 'idle',
    progress: 0,
    message: 'No active process',
    step: null
};

// Helper function to parse progress output from Python scripts
const parseProgressOutput = (message) => {
    // Parse [PROGRESS] Processing row X of Y (Z.Z%)
    const progressMatch = message.match(/\[PROGRESS\]\s+Processing row (\d+) of (\d+) \((\d+\.?\d*)%\)/);
    if (progressMatch) {
        const [, current, total, percentage] = progressMatch;
        return {
            progress: Math.min(Math.max(parseFloat(percentage), 15), 90),
            message: `Processing ${current}/${total} records (${percentage}%)`,
            details: {
                current: parseInt(current),
                total: parseInt(total),
                percentage: parseFloat(percentage)
            }
        };
    }

    // Parse [STAGE] Starting L0/L1/L2/MED processing
    const stageMatch = message.match(/\[STAGE\]\s+Starting (\w+) letters? processing/i);
    if (stageMatch) {
        const recoveryType = stageMatch[1];
        return {
            progress: 20,
            message: `Starting ${recoveryType} letters processing...`,
            details: { stage: recoveryType }
        };
    }

    // Parse recovery action processing messages
    const processingMatch = message.match(/📋 Processing (.+): (\d+) records/);
    if (processingMatch) {
        const [, recoveryType, recordCount] = processingMatch;
        return {
            progress: 25,
            message: `Processing ${recoveryType}: ${recordCount} records`,
            details: { stage: recoveryType, count: parseInt(recordCount) }
        };
    }

    // Parse total records message
    const totalRecordsMatch = message.match(/📊 Total records to process: (\d+)/);
    if (totalRecordsMatch) {
        const [, totalCount] = totalRecordsMatch;
        return {
            progress: 12,
            message: `Found ${totalCount} total records to process`,
            details: { totalRecords: parseInt(totalCount) }
        };
    }

    // Parse script execution messages
    const executingMatch = message.match(/🔄 Executing (\w+\.py)/);
    if (executingMatch) {
        const [, scriptName] = executingMatch;
        return {
            progress: 30,
            message: `Executing ${scriptName}...`,
            details: { script: scriptName }
        };
    }

    // Parse completion messages for each recovery type
    const completedMatch = message.match(/✅ (\w+\.py) completed successfully/);
    if (completedMatch) {
        const [, scriptName] = completedMatch;
        return {
            progress: 80,
            message: `${scriptName} completed successfully`,
            details: { script: scriptName, status: 'completed' }
        };
    }

    // Parse summary statistics
    const summaryMatch = message.match(/Letters generated: (\d+)/);
    if (summaryMatch) {
        const [, generatedCount] = summaryMatch;
        return {
            progress: 85,
            message: `Generated ${generatedCount} letters`,
            details: { generated: parseInt(generatedCount) }
        };
    }

    // Parse success/skip messages for statistics (don't update progress bar)
    const successMatch = message.match(/✅.*generated/i);
    const skipMatch = message.match(/⚠️.*skipp/i);

    if (successMatch || skipMatch) {
        return {
            progress: null, // Don't update progress bar for individual records
            message: null,
            details: {
                type: successMatch ? 'success' : 'skip',
                message: message.trim()
            }
        };
    }

    return null;
};

// Helper function to update progress
const updateProgress = (status, progress, message, step = null, details = null) => {
    currentProgress = {
        status,
        progress,
        message,
        step,
        details: details || currentProgress.details || {}
    };
    console.log(`📊 Arrears Progress: ${progress}% - ${message}`);
};

// Upload Excel file
router.post('/upload-excel', arrearsUpload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        console.log(`📁 Arrears Excel uploaded by ${req.session.user}: ${req.file.originalname}`);

        // Analyze Excel file for record count and recovery distribution
        let recordCount = 0;
        let recoveryDistribution = {};

        console.log(`🔍 Starting arrears record analysis for: ${req.file.originalname}`);

        // Primary method: Use Node.js xlsx library for reliable analysis
        try {
            const XLSX = await import('xlsx');
            const workbook = XLSX.readFile(req.file.path);
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet);

            recordCount = jsonData.length;

            // Calculate recovery distribution
            if (jsonData.length > 0 && jsonData[0].Recovery_action !== undefined) {
                const distribution = {};
                jsonData.forEach(row => {
                    const action = row.Recovery_action || 'Unknown';
                    distribution[action] = (distribution[action] || 0) + 1;
                });
                recoveryDistribution = distribution;
            } else {
                recoveryDistribution = { 'Unknown': recordCount };
            }

            console.log(`✅ Excel analysis completed: ${recordCount} records`);
            console.log(`📊 Recovery distribution:`, recoveryDistribution);

        } catch (analysisError) {
            console.error('❌ Node.js analysis failed:', analysisError.message);
            console.log('🔄 Trying Python fallback analysis...');

            // Fallback method: Use Python pandas
            try {
                const analysisScript = path.join(__dirname, '../analyze_arrears_data.py');
                const scriptContent = `
import pandas as pd
import sys
import json

try:
    df = pd.read_excel('${req.file.path.replace(/\\/g, '/')}')
    
    # Basic count
    total_count = len(df)
    
    # Recovery action distribution
    if 'Recovery_action' in df.columns:
        recovery_dist = df['Recovery_action'].value_counts().to_dict()
        # Convert numpy types to regular Python types for JSON serialization
        recovery_dist = {str(k): int(v) for k, v in recovery_dist.items()}
    else:
        recovery_dist = {'Unknown': total_count}
    
    result = {
        'success': True,
        'total_count': total_count,
        'recovery_distribution': recovery_dist
    }
    
    print(json.dumps(result))
    
except Exception as e:
    error_result = {
        'success': False,
        'error': str(e)
    }
    print(json.dumps(error_result))
`;

                await fs.writeFile(analysisScript, scriptContent);

                const { execSync } = await import('child_process');
                const result = execSync(`python "${analysisScript}"`, {
                    encoding: 'utf8',
                    cwd: path.dirname(analysisScript),
                    timeout: 30000
                });

                const analysisResult = JSON.parse(result.trim());

                if (analysisResult.success) {
                    recordCount = analysisResult.total_count;
                    recoveryDistribution = analysisResult.recovery_distribution;
                    console.log(`✅ Python fallback analysis completed: ${recordCount} records`);
                    console.log(`📊 Recovery distribution:`, recoveryDistribution);
                } else {
                    console.error('❌ Python analysis failed:', analysisResult.error);
                    recordCount = 0;
                    recoveryDistribution = {};
                }

                // Clean up temporary files
                try {
                    await fs.remove(analysisScript);
                } catch (cleanupError) {
                    console.warn('⚠️ Warning: Could not remove analysis script:', cleanupError.message);
                }

            } catch (pythonError) {
                console.error('❌ Python fallback also failed:', pythonError.message);
                recordCount = 0;
                recoveryDistribution = {};
            }
        }

        // Copy file to main location for processing (after successful analysis)
        if (recordCount > 0) {
            const targetPath = path.join(__dirname, '../Extracted_Arrears_Data.xlsx');
            try {
                // Use a safer approach - try to copy directly, overwriting if needed
                await fs.copy(req.file.path, targetPath, { overwrite: true });
                console.log('📁 File copied to processing location');
            } catch (copyError) {
                console.warn('⚠️ Warning: Could not copy to processing location:', copyError.message);
                // Try alternative approach - rename the uploaded file
                try {
                    if (await fs.pathExists(targetPath)) {
                        // If target exists, try to remove it with retry
                        let retries = 3;
                        while (retries > 0) {
                            try {
                                await fs.remove(targetPath);
                                break;
                            } catch (removeError) {
                                retries--;
                                if (retries === 0) {
                                    throw removeError;
                                }
                                // Wait a bit before retry
                                await new Promise(resolve => setTimeout(resolve, 100));
                            }
                        }
                    }
                    await fs.move(req.file.path, targetPath);
                    console.log('📁 File moved to processing location');
                } catch (moveError) {
                    console.warn('⚠️ Warning: Could not move to processing location:', moveError.message);
                    // Continue anyway - analysis was successful, file is in uploads folder
                }
            }
        }

        res.json({
            success: true,
            message: 'Arrears Excel file uploaded successfully',
            filename: req.file.filename,
            originalName: req.file.originalname,
            size: req.file.size,
            recordCount: recordCount,
            recoveryDistribution: recoveryDistribution
        });

    } catch (error) {
        console.error('Arrears upload error:', error);
        res.status(500).json({ error: 'Failed to upload file' });
    }
});

// Generate arrears letters
router.post('/generate-letters', async (req, res) => {
    try {
        const scriptPath = path.join(__dirname, '../recovery_processor.py');

        // Check if script exists
        if (!await fs.pathExists(scriptPath)) {
            return res.status(500).json({ error: 'Recovery processor script not found' });
        }

        // Check if Excel file exists in either location
        const excelPaths = [
            path.join(__dirname, '../Extracted_Arrears_Data.xlsx'),
            path.join(__dirname, '../uploads/arrears/Extracted_Arrears_Data.xlsx')
        ];

        let excelExists = false;
        for (const excelPath of excelPaths) {
            if (await fs.pathExists(excelPath)) {
                excelExists = true;
                break;
            }
        }

        if (!excelExists) {
            return res.status(400).json({ error: 'Please upload Excel file first' });
        }

        console.log(`🔄 Starting arrears letter generation for ${req.session.user}`);
        updateProgress('running', 10, 'Starting letter generation...', 'generate');

        // Start time-based progress updates
        const startTime = Date.now();
        let progressPercent = 10;

        const progressInterval = setInterval(() => {
            const elapsedMinutes = Math.floor((Date.now() - startTime) / 60000);
            const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000) % 60;
            const timeDisplay = `${elapsedMinutes.toString().padStart(2, '0')}:${elapsedSeconds.toString().padStart(2, '0')}`;

            // Increase progress by 5% every minute, cap at 90%
            if (elapsedMinutes > 0 && progressPercent < 90) {
                progressPercent = Math.min(10 + (elapsedMinutes * 5), 90);
            }

            updateProgress('running', progressPercent, `Processing letters... ${timeDisplay}`, 'generate', {
                elapsed: timeDisplay,
                elapsedMinutes,
                elapsedSeconds
            });
        }, 1000); // Update every second

        const pythonProcess = spawn('python', [scriptPath], {
            cwd: path.dirname(scriptPath)
        });

        let output = '';
        let errorOutput = '';

        pythonProcess.stdout.on('data', (data) => {
            const message = data.toString();
            output += message;

            // Split message by lines to handle multiple messages in one chunk
            const lines = message.split('\n').filter(line => line.trim());

            for (const line of lines) {
                console.log('Arrears Script:', line.trim());

                // Parse enhanced progress information
                const progressInfo = parseProgressOutput(line);
                if (progressInfo && progressInfo.progress !== null) {
                    console.log(`📊 Progress Update: ${progressInfo.progress}% - ${progressInfo.message}`);
                    updateProgress('running', progressInfo.progress, progressInfo.message, 'generate', progressInfo.details);
                }
            }
        });

        pythonProcess.stderr.on('data', (data) => {
            const message = data.toString();
            errorOutput += message;
            console.error('Arrears Script Error:', message.trim());
        });

        pythonProcess.on('close', async (code) => {
            // Clear the progress interval
            clearInterval(progressInterval);

            if (code === 0) {
                console.log(`✅ Arrears letter generation completed for ${req.session.user}`);
                const totalTime = Math.floor((Date.now() - startTime) / 1000);
                const minutes = Math.floor(totalTime / 60);
                const seconds = totalTime % 60;
                const finalTimeDisplay = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

                updateProgress('completed', 100, `Letters generated successfully in ${finalTimeDisplay}`, 'generate');
                res.json({
                    success: true,
                    message: 'Arrears letters generated successfully',
                    output: output.trim()
                });
            } else {
                console.error(`❌ Arrears letter generation failed with code ${code}`);
                updateProgress('failed', 0, 'Letter generation failed', 'generate');
                res.status(500).json({
                    error: 'Letter generation failed',
                    details: errorOutput || output,
                    exitCode: code
                });
            }
        });

        pythonProcess.on('error', (error) => {
            // Clear the progress interval
            clearInterval(progressInterval);

            console.error('Arrears script spawn error:', error);
            updateProgress('failed', 0, 'Failed to start letter generation', 'generate');
            res.status(500).json({
                error: 'Failed to start letter generation',
                details: error.message
            });
        });

    } catch (error) {
        console.error('Arrears generate letters error:', error);
        res.status(500).json({ error: 'Failed to generate letters' });
    }
});

// Merge letters by recovery type
router.post('/merge-letters', async (req, res) => {
    try {
        const scriptPath = path.join(__dirname, '../arrears_merger.py');

        // Check if script exists
        if (!await fs.pathExists(scriptPath)) {
            return res.status(500).json({ error: 'Arrears merger script not found' });
        }

        console.log(`🔄 Starting arrears letter merging for ${req.session.user}`);
        updateProgress('running', 5, 'Cleaning up old merged files...', 'merge');

        // Clean up old merged PDFs before creating new ones
        const mergeDirs = [
            path.join(__dirname, '../L0_Merge'),
            path.join(__dirname, '../L1_Merge'),
            path.join(__dirname, '../L2_Merge'),
            path.join(__dirname, '../MED_Merge')
        ];

        try {
            let totalCleaned = 0;
            for (const dir of mergeDirs) {
                if (await fs.pathExists(dir)) {
                    const files = await fs.readdir(dir);
                    const pdfFiles = files.filter(file => file.endsWith('.pdf'));
                    for (const file of pdfFiles) {
                        await fs.remove(path.join(dir, file));
                        totalCleaned++;
                    }
                    if (pdfFiles.length > 0) {
                        console.log(`🗑️ Cleaned up ${pdfFiles.length} old merged PDFs from ${path.basename(dir)}`);
                    }
                }
            }
            if (totalCleaned > 0) {
                console.log(`✅ Total cleanup: ${totalCleaned} old merged PDFs removed`);
            }
        } catch (cleanupError) {
            console.warn('⚠️ Warning: Could not clean up old merged files:', cleanupError.message);
        }

        updateProgress('running', 10, 'Starting merger script...', 'merge');

        // Start time-based progress updates for merge (faster process)
        const startTime = Date.now();
        let progressPercent = 10;

        const progressInterval = setInterval(() => {
            const elapsedMinutes = Math.floor((Date.now() - startTime) / 60000);
            const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000) % 60;
            const timeDisplay = `${elapsedMinutes.toString().padStart(2, '0')}:${elapsedSeconds.toString().padStart(2, '0')}`;

            // Increase progress by 5% every 30 seconds, cap at 90%
            const elapsed30SecIntervals = Math.floor((Date.now() - startTime) / 30000);
            if (elapsed30SecIntervals > 0 && progressPercent < 90) {
                progressPercent = Math.min(10 + (elapsed30SecIntervals * 5), 90);
            }

            updateProgress('running', progressPercent, `Merging PDFs... ${timeDisplay}`, 'merge', {
                elapsed: timeDisplay,
                elapsedMinutes,
                elapsedSeconds
            });
        }, 1000); // Update every second

        const pythonProcess = spawn('python', [scriptPath], {
            cwd: path.dirname(scriptPath)
        });

        let output = '';
        let errorOutput = '';

        pythonProcess.stdout.on('data', (data) => {
            const message = data.toString();
            output += message;
            console.log('Arrears Merge:', message.trim());
        });

        pythonProcess.stderr.on('data', (data) => {
            const message = data.toString();
            errorOutput += message;
            console.error('Arrears Merge Error:', message.trim());
        });

        pythonProcess.on('close', (code) => {
            // Clear the progress interval
            clearInterval(progressInterval);

            if (code === 0) {
                console.log(`✅ Arrears letter merging completed for ${req.session.user}`);
                const totalTime = Math.floor((Date.now() - startTime) / 1000);
                const minutes = Math.floor(totalTime / 60);
                const seconds = totalTime % 60;
                const finalTimeDisplay = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

                updateProgress('completed', 100, `Letters merged successfully in ${finalTimeDisplay}`, 'merge');
                res.json({
                    success: true,
                    message: 'Arrears letters merged successfully by recovery type',
                    output: output.trim()
                });
            } else {
                console.error(`❌ Arrears letter merging failed with code ${code}`);
                updateProgress('failed', 0, 'Letter merging failed', 'merge');
                res.status(500).json({
                    error: 'Letter merging failed',
                    details: errorOutput || output,
                    exitCode: code
                });
            }
        });

        pythonProcess.on('error', (error) => {
            // Clear the progress interval
            clearInterval(progressInterval);

            console.error('Arrears merge script spawn error:', error);
            updateProgress('failed', 0, 'Failed to start letter merging', 'merge');
            res.status(500).json({
                error: 'Failed to start letter merging',
                details: error.message
            });
        });

    } catch (error) {
        console.error('Arrears merge letters error:', error);
        res.status(500).json({ error: 'Failed to merge letters' });
    }
});

// Send emails
router.post('/send-emails', async (req, res) => {
    try {
        console.log(`📧 Arrears email sending requested by ${req.session.user}`);
        updateProgress('running', 10, 'Preparing email data...', 'email');

        // Check if Excel file exists
        const excelPaths = [
            path.join(__dirname, '../Extracted_Arrears_Data.xlsx'),
            path.join(__dirname, '../uploads/arrears/Extracted_Arrears_Data.xlsx')
        ];
        
        let excelPath = null;
        for (const testPath of excelPaths) {
            if (await fs.pathExists(testPath)) {
                excelPath = testPath;
                break;
            }
        }
        
        if (!excelPath) {
            return res.status(400).json({ error: 'Excel file not found. Please upload the arrears data first.' });
        }

        updateProgress('running', 20, 'Reading recipient data...', 'email');

        // Read Excel file to get recipient data
        const XLSX = await import('xlsx');
        const workbook = XLSX.default.readFile(excelPath);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.default.utils.sheet_to_json(worksheet);

        // Filter recipients with valid email addresses
        const recipients = data
            .filter(row => row.PH_EMAIL && row.PH_EMAIL.includes('@'))
            .map(row => ({
                email: row.PH_EMAIL.trim(),
                name: row.POLICY_HOLDER || 'Valued Customer',
                policyNo: row.POL_NO || 'N/A',
                recoveryType: (row.Recovery_action || 'L0').includes('L0') ? 'L0' : 
                             (row.Recovery_action || 'L0').includes('L1') ? 'L1' :
                             (row.Recovery_action || 'L0').includes('L2') ? 'L2' :
                             (row.Recovery_action || 'L0').includes('MED') ? 'MED' : 'L0',
                arrears: row.TrueArrears || 0
            }));

        if (recipients.length === 0) {
            return res.status(400).json({ 
                error: 'No valid email addresses found in the Excel file.',
                details: 'Please ensure the PH_EMAIL column contains valid email addresses.'
            });
        }

        console.log(`📧 Found ${recipients.length} recipients with valid email addresses`);
        console.log(`📋 Sample recipients:`, recipients.slice(0, 3).map(r => ({ email: r.email, name: r.name, recoveryType: r.recoveryType })));
        
        // Debug: Show all recovery types
        const recoveryTypeCounts = {};
        recipients.forEach(r => {
            recoveryTypeCounts[r.recoveryType] = (recoveryTypeCounts[r.recoveryType] || 0) + 1;
        });
        console.log(`📊 Recovery type distribution:`, recoveryTypeCounts);
        
        updateProgress('running', 30, `Sending emails to ${recipients.length} recipients...`, 'email');

        // Import and use the Brevo service
        console.log('📦 Importing Brevo service...');
        const brevoService = await import('../services/brevoService.js');
        console.log('📦 Brevo service imported:', typeof brevoService.sendArrearsEmails);
        
        if (!brevoService.sendArrearsEmails) {
            throw new Error('sendArrearsEmails function not found in Brevo service');
        }
        
        // Get recovery types from request or default to all
        const { recoveryTypes = ['all'] } = req.body;
        console.log('📋 Recovery types filter:', recoveryTypes);
        
        // Send emails
        console.log('📧 Calling sendArrearsEmails...');
        const results = await brevoService.sendArrearsEmails(recipients, recoveryTypes);
        console.log('📧 Email sending results:', results);
        
        updateProgress('completed', 100, `Emails sent: ${results.success} successful, ${results.failed} failed`, 'email');

        res.json({
            success: true,
            message: 'Arrears email sending completed',
            results: {
                totalRecipients: recipients.length,
                successful: results.success,
                failed: results.failed,
                errors: results.errors
            },
            sender: 'NICL Collections'
        });

    } catch (error) {
        console.error('❌ Arrears send emails error:', error);
        console.error('❌ Error stack:', error.stack);
        updateProgress('failed', 0, 'Email sending failed', 'email');
        res.status(500).json({
            error: 'Failed to send emails',
            details: error.message,
            type: error.name || 'Unknown Error'
        });
    }
});

// Get files list by recovery type
router.get('/files', async (req, res) => {
    try {
        const files = {
            individual: {
                L0: [],
                L1: [],
                L2: [],
                MED: []
            },
            merged: {
                L0: [],
                L1: [],
                L2: [],
                MED: []
            }
        };

        // Individual PDFs by recovery type
        const individualDirs = {
            L0: path.join(__dirname, '../L0'),
            L1: path.join(__dirname, '../L1'),
            L2: path.join(__dirname, '../L2'),
            MED: path.join(__dirname, '../output_mise_en_demeure')
        };

        for (const [type, dirPath] of Object.entries(individualDirs)) {
            if (await fs.pathExists(dirPath)) {
                const dirFiles = await fs.readdir(dirPath);
                files.individual[type] = await Promise.all(
                    dirFiles
                        .filter(file => file.endsWith('.pdf'))
                        .map(async file => {
                            const filePath = path.join(dirPath, file);
                            const stats = await fs.stat(filePath);
                            return {
                                name: file,
                                downloadUrl: `/downloads/arrears/individual/${type}/${file}`,
                                size: Math.round(stats.size / 1024), // Size in KB
                                modified: stats.mtime
                            };
                        })
                );
            }
        }

        // Merged PDFs by recovery type
        const mergedDirs = {
            L0: path.join(__dirname, '../L0_Merge'),
            L1: path.join(__dirname, '../L1_Merge'),
            L2: path.join(__dirname, '../L2_Merge'),
            MED: path.join(__dirname, '../MED_Merge')
        };

        for (const [type, dirPath] of Object.entries(mergedDirs)) {
            if (await fs.pathExists(dirPath)) {
                const dirFiles = await fs.readdir(dirPath);
                files.merged[type] = await Promise.all(
                    dirFiles
                        .filter(file => file.endsWith('.pdf'))
                        .map(async file => {
                            const filePath = path.join(dirPath, file);
                            const stats = await fs.stat(filePath);
                            return {
                                name: file,
                                downloadUrl: `/downloads/arrears/merged/${type}/${file}`,
                                size: Math.round(stats.size / 1024), // Size in KB
                                modified: stats.mtime
                            };
                        })
                );
            }
        }

        res.json(files);

    } catch (error) {
        console.error('Arrears get files error:', error);
        res.status(500).json({ error: 'Failed to get files list' });
    }
});

// Download individual PDF by recovery type
router.get('/download/individual/:type/:filename', async (req, res) => {
    try {
        const { type, filename } = req.params;

        const dirMap = {
            L0: '../L0',
            L1: '../L1',
            L2: '../L2',
            MED: '../output_mise_en_demeure'
        };

        if (!dirMap[type]) {
            return res.status(400).json({ error: 'Invalid recovery type' });
        }

        const filePath = path.join(__dirname, dirMap[type], filename);

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
        console.error('Arrears download individual error:', error);
        res.status(500).json({ error: 'Failed to download file' });
    }
});

// Download merged PDF by recovery type
router.get('/download/merged/:type/:filename', async (req, res) => {
    try {
        const { type, filename } = req.params;

        const dirMap = {
            L0: '../L0_Merge',
            L1: '../L1_Merge',
            L2: '../L2_Merge',
            MED: '../MED_Merge'
        };

        if (!dirMap[type]) {
            return res.status(400).json({ error: 'Invalid recovery type' });
        }

        const filePath = path.join(__dirname, dirMap[type], filename);

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
        console.error('Arrears download merged error:', error);
        res.status(500).json({ error: 'Failed to download file' });
    }
});

// Download all individual PDFs as zip by recovery type
router.get('/download/all-individual/:type', async (req, res) => {
    try {
        const { type } = req.params;

        const dirMap = {
            L0: '../L0',
            L1: '../L1',
            L2: '../L2',
            MED: '../output_mise_en_demeure'
        };

        if (!dirMap[type]) {
            return res.status(400).json({ error: 'Invalid recovery type' });
        }

        const outputDir = path.join(__dirname, dirMap[type]);

        if (!await fs.pathExists(outputDir)) {
            return res.status(404).json({ error: 'No PDFs found' });
        }

        const files = await fs.readdir(outputDir);
        const pdfFiles = files.filter(file => file.endsWith('.pdf'));

        if (pdfFiles.length === 0) {
            return res.status(404).json({ error: 'No PDF files found' });
        }

        console.log(`📦 Starting ${type} zip download: ${pdfFiles.length} files for ${req.session.user}`);

        // Set response headers for zip download
        const zipName = `arrears_${type}_letters_${new Date().toISOString().split('T')[0]}.zip`;
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${zipName}"`);

        // Create zip archive
        const archiver = (await import('archiver')).default;
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
                console.log(`Added to ${type} zip: ${file}`);
            } else {
                console.warn(`File not found, skipping: ${file}`);
            }
        }

        // Finalize the archive
        console.log(`Finalizing ${type} archive...`);
        await archive.finalize();

        console.log(`✅ ${type} zip download completed: ${pdfFiles.length} files for ${req.session.user}`);

    } catch (error) {
        console.error(`${type} download all error:`, error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to create zip file' });
        } else {
            res.end();
        }
    }
});

// Check workflow status
router.get('/status', async (req, res) => {
    try {
        const status = {
            upload: false,
            generate: false,
            merge: false,
            canSendEmails: false,
            currentStep: 1,
            recoveryStats: {
                L0: { individual: 0, merged: 0 },
                L1: { individual: 0, merged: 0 },
                L2: { individual: 0, merged: 0 },
                MED: { individual: 0, merged: 0 }
            }
        };

        // Check if Excel file exists in either location
        const excelPaths = [
            path.join(__dirname, '../Extracted_Arrears_Data.xlsx'),
            path.join(__dirname, '../uploads/arrears/Extracted_Arrears_Data.xlsx')
        ];

        for (const excelPath of excelPaths) {
            if (await fs.pathExists(excelPath)) {
                status.upload = true;
                status.currentStep = 2;
                break;
            }
        }

        // Check individual PDFs by recovery type
        const individualDirs = {
            L0: path.join(__dirname, '../L0'),
            L1: path.join(__dirname, '../L1'),
            L2: path.join(__dirname, '../L2'),
            MED: path.join(__dirname, '../output_mise_en_demeure')
        };

        let totalIndividual = 0;
        for (const [type, dirPath] of Object.entries(individualDirs)) {
            if (await fs.pathExists(dirPath)) {
                const files = await fs.readdir(dirPath);
                const pdfCount = files.filter(file => file.endsWith('.pdf')).length;
                status.recoveryStats[type].individual = pdfCount;
                totalIndividual += pdfCount;
            }
        }

        if (totalIndividual > 0) {
            status.generate = true;
            status.currentStep = 3;
        }

        // Check merged PDFs by recovery type
        const mergedDirs = {
            L0: path.join(__dirname, '../L0_Merge'),
            L1: path.join(__dirname, '../L1_Merge'),
            L2: path.join(__dirname, '../L2_Merge'),
            MED: path.join(__dirname, '../MED_Merge')
        };

        let totalMerged = 0;
        for (const [type, dirPath] of Object.entries(mergedDirs)) {
            if (await fs.pathExists(dirPath)) {
                const files = await fs.readdir(dirPath);
                const pdfCount = files.filter(file => file.endsWith('.pdf')).length;
                status.recoveryStats[type].merged = pdfCount;
                totalMerged += pdfCount;
            }
        }

        if (totalMerged > 0) {
            status.merge = true;
            status.currentStep = 4;
            status.canSendEmails = true;
        }

        res.json(status);

    } catch (error) {
        console.error('Arrears status check error:', error);
        res.status(500).json({ error: 'Failed to check status' });
    }
});

// Get progress (real-time progress tracking)
router.get('/progress', (req, res) => {
    res.json(currentProgress);
});

export default router;
