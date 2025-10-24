import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Auth API
export const authAPI = {
  sendOTP: (email) => api.post('/api/auth/send-otp', { email }),
  verifyOTP: (email, otp) => api.post('/api/auth/verify-otp', { email, otp }),
  passwordLogin: (email, password) => api.post('/api/auth/password-login', { email, password }),
  logout: () => api.post('/api/auth/logout'),
  getSession: () => api.get('/api/auth/session'),
};

// Motor API
export const motorAPI = {
  uploadExcel: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/api/motor/upload-excel', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  generatePDFs: () => api.post('/api/motor/generate-pdfs'),
  mergePDFs: () => api.post('/api/motor/merge-pdfs'),
  sendEmails: (emailData) => api.post('/api/motor/send-emails', emailData),
  getFiles: () => api.get('/api/motor/files'),
  getStatus: () => api.get('/api/motor/status'),
  getProgress: () => api.get('/api/motor/progress'),
  downloadIndividual: (filename) => {
    window.open(`${api.defaults.baseURL}/api/motor/download/individual/${filename}`, '_blank');
  },
  downloadMerged: (filename) => {
    window.open(`${api.defaults.baseURL}/api/motor/download/merged/${filename}`, '_blank');
  },
  downloadAllIndividual: () => {
    window.open(`${api.defaults.baseURL}/api/motor/download/all-individual`, '_blank');
  },
  // Printer version APIs
  generatePrinterPDFs: () => api.post('/api/motor/generate-printer-pdfs'),
  mergePrinterPDFs: () => api.post('/api/motor/merge-printer-pdfs'),
  getPrinterFiles: () => api.get('/api/motor/printer-files'),
  downloadPrinterIndividual: (filename) => {
    window.open(`${api.defaults.baseURL}/api/motor/download/printer-individual/${filename}`, '_blank');
  },
  downloadPrinterMerged: (filename) => {
    window.open(`${api.defaults.baseURL}/api/motor/download/printer-merged/${filename}`, '_blank');
  },
  downloadAllPrinterIndividual: () => {
    window.open(`${api.defaults.baseURL}/api/motor/download/all-printer-individual`, '_blank');
  },
};

// Health API
export const healthAPI = {
  uploadExcel: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/api/health/upload-excel', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  generatePDFs: () => api.post('/api/health/generate-pdfs'),
  attachForms: () => api.post('/api/health/attach-forms'),
  mergeAll: () => api.post('/api/health/merge-all'),
  sendEmails: (emailData) => api.post('/api/health/send-emails', emailData),
  getFiles: () => api.get('/api/health/files'),
  getStatus: () => api.get('/api/health/status'),
  getProgress: () => api.get('/api/health/progress'),
  downloadIndividual: (filename) => {
    window.open(`${api.defaults.baseURL}/api/health/download/individual/${filename}`, '_blank');
  },
  downloadMerged: (filename) => {
    window.open(`${api.defaults.baseURL}/api/health/download/merged/${filename}`, '_blank');
  },
  downloadAllIndividual: () => {
    window.open(`${api.defaults.baseURL}/api/health/download/all-individual`, '_blank');
  },
};

// Arrears API
export const arrearsAPI = {
  uploadExcel: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/api/arrears/upload-excel', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  generateLetters: () => api.post('/api/arrears/generate-letters'),
  mergeLetters: () => api.post('/api/arrears/merge-letters'),
  sendEmails: (emailData) => api.post('/api/arrears/send-emails', emailData),
  getFiles: () => api.get('/api/arrears/files'),
  getStatus: () => api.get('/api/arrears/status'),
  getProgress: () => api.get('/api/arrears/progress'),
  downloadIndividual: (type, filename) => {
    window.open(`${api.defaults.baseURL}/api/arrears/download/individual/${type}/${filename}`, '_blank');
  },
  downloadMerged: (type, filename) => {
    window.open(`${api.defaults.baseURL}/api/arrears/download/merged/${type}/${filename}`, '_blank');
  },
  downloadAllIndividual: (type) => {
    window.open(`${api.defaults.baseURL}/api/arrears/download/all-individual/${type}`, '_blank');
  },
};

export default api;