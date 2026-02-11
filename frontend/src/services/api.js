import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  // Remove global timeout to prevent conflicts with individual request timeouts
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
  generatePDFs: () => api.post('/api/motor/generate-pdfs', {}, {
    timeout: 7200000 // 2 hours for PDF generation - inline to survive build
  }),
  mergePDFs: () => api.post('/api/motor/merge-pdfs', {}, {
    timeout: 7200000 // 2 hours for merging - inline to survive build
  }),
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
  generatePrinterPDFs: () => api.post('/api/motor/generate-printer-pdfs', {}, {
    timeout: 7200000 // 2 hours for printer PDF generation - inline to survive build
  }),
  mergePrinterPDFs: () => api.post('/api/motor/merge-printer-pdfs', {}, {
    timeout: 7200000 // 2 hours for printer merging - inline to survive build
  }),
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
  generatePDFs: () => api.post('/api/health/generate-pdfs', {}, {
    timeout: 7200000 // 2 hours for health PDF generation - inline to survive build
  }),
  attachForms: () => api.post('/api/health/attach-forms', {}, {
    timeout: 7200000 // 2 hours for form attachment - inline to survive build
  }),
  mergeAll: () => api.post('/api/health/merge-all', {}, {
    timeout: 7200000 // 2 hours for merging all - inline to survive build
  }),
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
  uploadExcel: (file, productType = 'health', policyStatus = 'active') => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('productType', productType);
    formData.append('policyStatus', policyStatus);
    return api.post('/api/arrears/upload-excel', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  generateLetters: (productType = 'health', policyStatus = 'active') => api.post('/api/arrears/generate-letters', { productType, policyStatus }, {
    timeout: 7200000 // 2 hours for letter generation - inline to survive build
  }),
  mergeLetters: (productType = 'health', policyStatus = 'active') => api.post('/api/arrears/merge-letters', { productType, policyStatus }, {
    timeout: 7200000 // 2 hours for merging - inline to survive build
  }),
  sendEmails: (emailData) => api.post('/api/arrears/send-emails', emailData),
  getFiles: (productType = 'health', policyStatus = 'active') => api.get(`/api/arrears/files?productType=${productType}&policyStatus=${policyStatus}`),
  getStatus: (productType = 'health', policyStatus = 'active') => api.get(`/api/arrears/status?productType=${productType}&policyStatus=${policyStatus}`),
  getProgress: (productType = 'health', policyStatus = 'active') => api.get(`/api/arrears/progress?productType=${productType}&policyStatus=${policyStatus}`),
  downloadIndividual: (type, filename, productType = 'health', policyStatus = 'active') => {
    window.open(`${api.defaults.baseURL}/api/arrears/download/individual/${type}/${filename}?productType=${productType}&policyStatus=${policyStatus}`, '_blank');
  },
  downloadMerged: (type, filename, productType = 'health', policyStatus = 'active') => {
    window.open(`${api.defaults.baseURL}/api/arrears/download/merged/${type}/${filename}?productType=${productType}&policyStatus=${policyStatus}`, '_blank');
  },
  downloadAllIndividual: (type, productType = 'health', policyStatus = 'active') => {
    window.open(`${api.defaults.baseURL}/api/arrears/download/all-individual/${type}?productType=${productType}&policyStatus=${policyStatus}`, '_blank');
  },
  downloadUpdatedExcel: async () => {
    try {
      // Create a temporary link element for download
      const response = await fetch(`${api.defaults.baseURL}/api/arrears/download-updated-excel`, {
        method: 'GET',
        credentials: 'include', // Include session cookies
        headers: {
          'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        }
      });

      if (!response.ok) {
        throw new Error(`Download failed: ${response.status} ${response.statusText}`);
      }

      // Get the filename from the response headers
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = 'Updated_Arrears_Data.xlsx';

      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }

      // Convert response to blob
      const blob = await response.blob();

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;

      // Trigger download
      document.body.appendChild(link);
      link.click();

      // Cleanup
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      console.log(`✅ Excel file downloaded: ${filename}`);

    } catch (error) {
      console.error('❌ Download failed:', error);

      // Fallback to window.open method
      console.log('🔄 Trying fallback download method...');
      window.open(`${api.defaults.baseURL}/api/arrears/download-updated-excel`, '_blank');
    }
  },
  resetWorkflow: (productType = 'health') => api.post('/api/arrears/reset', { productType }),
  cleanup: (productType = 'health') => api.post('/api/arrears/cleanup', { productType }),
};

export default api;