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

// Helper function to update progress
const updateProgress = (status, progress, message, step = null) => {
    currentProgress = { status, progress, message, step };
    console.log(`📊 Arrears Progress: ${progress}% - ${message}`);
};

// Upload Excel file
router.post('/upload-excel', arrearsUpload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        console.log(`📁 Arrears Excel uploaded by ${req.session.user}: ${req.file.originalname}`);

        // For now, just return basic info - we'll add analysis later
        res.json({
            success: true,
            message: 'Arrears Excel file uploaded successfully',
            filename: req.file.filename,
            originalName: req.file.originalname,
            size: req.file.size,
            recordCount: 0, // Will be implemented later
            recoveryDistribution: {} // Will be implemented later
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

        // Check if Excel file exists
        const excelPath = path.join(__dirname, '../Extracted_Arrears_Data.xlsx');
        if (!await fs.pathExists(excelPath)) {
            return res.status(400).json({ error: 'Please upload Excel file first' });
        }

        console.log(`🔄 Starting arrears letter generation for ${req.session.user}`);
        updateProgress('running', 10, 'Starting letter generation...', 'generate');

        const pythonProcess = spawn('python', [scriptPath], {
            cwd: path.dirname(scriptPath)
        });

        let output = '';
        let errorOutput = '';

        pythonProcess.stdout.on('data', (data) => {
            const message = data.toString();
            output += message;
            console.log('Arrears Script:', message.trim());

            // Update progress
            updateProgress('running', 50, 'Generating letters...', 'generate');
        });

        pythonProcess.stderr.on('data', (data) => {
            const message = data.toString();
            errorOutput += message;
            console.error('Arrears Script Error:', message.trim());
        });

        pythonProcess.on('close', async (code) => {
            if (code === 0) {
                console.log(`✅ Arrears letter generation completed for ${req.session.user}`);
                updateProgress('completed', 100, 'Letters generated successfully', 'generate');
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
            console.error('Arrears script spawn error:', error);
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

        const pythonProcess = spawn('python', [scriptPath], {
            cwd: path.dirname(scriptPath)
        });

        let output = '';
        let errorOutput = '';

        pythonProcess.stdout.on('data', (data) => {
            const message = data.toString();
            output += message;
            console.log('Arrears Merge:', message.trim());

            updateProgress('running', 50, 'Merging in progress...', 'merge');
        });

        pythonProcess.stderr.on('data', (data) => {
            const message = data.toString();
            errorOutput += message;
            console.error('Arrears Merge Error:', message.trim());
        });

        pythonProcess.on('close', (code) => {
            if (code === 0) {
                console.log(`✅ Arrears letter merging completed for ${req.session.user}`);
                updateProgress('completed', 100, 'Letters merged successfully', 'merge');
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
            console.error('Arrears merge script spawn error:', error);
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

// Send emails (placeholder)
router.post('/send-emails', async (req, res) => {
    try {
        console.log(`📧 Arrears email sending requested by ${req.session.user}`);
        updateProgress('running', 50, 'Sending emails...', 'email');

        // Placeholder - will implement email functionality later
        setTimeout(() => {
            updateProgress('completed', 100, 'Emails sent successfully', 'email');
            res.json({
                success: true,
                message: 'Email sending completed (placeholder)',
                sender: 'NICL Collections'
            });
        }, 2000);

    } catch (error) {
        console.error('Arrears send emails error:', error);
        res.status(500).json({
            error: 'Failed to send emails',
            details: error.message
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

        // Check if Excel file exists
        const excelPath = path.join(__dirname, '../Extracted_Arrears_Data.xlsx');
        if (await fs.pathExists(excelPath)) {
            status.upload = true;
            status.currentStep = 2;
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
