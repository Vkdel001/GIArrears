import express from 'express';
import cors from 'cors';
import session from 'express-session';
import multer from 'multer';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs-extra';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Import route handlers
import authRoutes from './routes/auth.js';
import motorRoutes from './routes/motor.js';
import healthRoutes from './routes/health.js';
import arrearsRoutes from './routes/arrears.js';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'nicl-renewal-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Set to true in production with HTTPS
    httpOnly: true,
    maxAge: 8 * 60 * 60 * 1000 // 8 hours
  }
}));

// Create required directories
const createDirectories = async () => {
  const dirs = [
    'uploads/motor',
    'uploads/health',
    'uploads/arrears',
    'output_motor',
    'output_motor_printer',
    'output_renewals',
    'L0',
    'L1', 
    'L2',
    'output_mise_en_demeure',
    'L0_Merge',
    'L1_Merge',
    'L2_Merge',
    'MED_Merge',
    'merged_motor_policies',
    'merged_motor_printer_policies',
    'merged_health_policies',
    'fonts'
  ];

  for (const dir of dirs) {
    await fs.ensureDir(path.join(__dirname, dir));
  }
};

// Initialize directories
createDirectories().catch(console.error);

// Static file serving for PDF downloads
app.use('/downloads/motor/individual', express.static(path.join(__dirname, 'output_motor')));
app.use('/downloads/motor/merged', express.static(path.join(__dirname, 'merged_motor_policies')));
app.use('/downloads/motor/printer-individual', express.static(path.join(__dirname, 'output_motor_printer')));
app.use('/downloads/motor/printer-merged', express.static(path.join(__dirname, 'merged_motor_printer_policies')));
app.use('/downloads/health/individual', express.static(path.join(__dirname, 'output_renewals')));
app.use('/downloads/health/merged', express.static(path.join(__dirname, 'merged_health_policies')));

// Arrears static file serving
app.use('/downloads/arrears/individual/L0', express.static(path.join(__dirname, 'L0')));
app.use('/downloads/arrears/individual/L1', express.static(path.join(__dirname, 'L1')));
app.use('/downloads/arrears/individual/L2', express.static(path.join(__dirname, 'L2')));
app.use('/downloads/arrears/individual/MED', express.static(path.join(__dirname, 'output_mise_en_demeure')));
app.use('/downloads/arrears/merged/L0', express.static(path.join(__dirname, 'L0_Merge')));
app.use('/downloads/arrears/merged/L1', express.static(path.join(__dirname, 'L1_Merge')));
app.use('/downloads/arrears/merged/L2', express.static(path.join(__dirname, 'L2_Merge')));
app.use('/downloads/arrears/merged/MED', express.static(path.join(__dirname, 'MED_Merge')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/motor', motorRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/arrears', arrearsRoutes);

// Health check endpoint
app.get('/api/health-check', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Server Error:', error);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 NICL Renewal Backend Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌐 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
});

export default app;