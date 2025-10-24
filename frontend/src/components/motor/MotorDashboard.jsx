import React, { useState, useEffect } from 'react';
import { Car, Upload, FileText, Merge, Mail, LogOut, User, Download } from 'lucide-react';
import FileUpload from '../shared/FileUpload';
import ProcessStep from '../shared/ProcessStep';
import FileList from '../shared/FileList';
import { motorAPI } from '../../services/api';

const MotorDashboard = ({ user, onLogout }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [recordCount, setRecordCount] = useState(0);
  const [processes, setProcesses] = useState({
    upload: { status: 'pending', progress: 0 },
    generate: { status: 'pending', progress: 0 },
    merge: { status: 'pending', progress: 0 },
    email: { status: 'pending', progress: 0 }
  });
  const [printerProcesses, setPrinterProcesses] = useState({
    'generate-printer': { status: 'pending', progress: 0 },
    'merge-printer': { status: 'pending', progress: 0 }
  });
  const [files, setFiles] = useState({ individual: [], merged: [] });
  const [printerFiles, setPrinterFiles] = useState({ individual: [], merged: [] });
  const [filesLoading, setFilesLoading] = useState(false);
  const [printerFilesLoading, setPrinterFilesLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('digital'); // 'digital' or 'printer'

  // Check existing workflow status on component mount
  useEffect(() => {
    checkWorkflowStatus();
    loadFiles();
    loadPrinterFiles();
  }, []);

  const checkWorkflowStatus = async () => {
    try {
      const response = await motorAPI.getStatus();
      const status = response.data;
      
      // Update processes based on existing files
      setProcesses(prev => ({
        ...prev,
        upload: { status: status.upload ? 'completed' : 'pending', progress: status.upload ? 100 : 0 },
        generate: { status: status.generate ? 'completed' : 'pending', progress: status.generate ? 100 : 0 },
        merge: { status: status.merge ? 'completed' : 'pending', progress: status.merge ? 100 : 0 }
      }));
      
      // Set current step based on what's completed
      setCurrentStep(status.currentStep);
      
      if (status.upload) {
        setUploadedFile({ name: 'output_motor_renewal.xlsx' });
      }
      
    } catch (error) {
      console.error('Failed to check workflow status:', error);
    }
  };

  const updateProcess = (step, status, progress = 0) => {
    setProcesses(prev => ({
      ...prev,
      [step]: { status, progress }
    }));
  };

  // Poll for progress updates
  const pollProgress = async () => {
    try {
      const response = await motorAPI.getProgress();
      const progress = response.data;
      
      if (progress.step && progress.status !== 'idle') {
        // Check if it's a printer process
        if (progress.step.includes('printer')) {
          updatePrinterProcess(progress.step, progress.status, progress.progress);
        } else {
          updateProcess(progress.step, progress.status, progress.progress);
        }
      }
    } catch (error) {
      console.error('Failed to get progress:', error);
    }
  };

  // Start polling when a process is running
  useEffect(() => {
    const hasRunningProcess = Object.values(processes).some(p => p.status === 'running') ||
                             Object.values(printerProcesses).some(p => p.status === 'running');
    
    if (hasRunningProcess) {
      const interval = setInterval(pollProgress, 1000); // Poll every second
      return () => clearInterval(interval);
    }
  }, [processes, printerProcesses]);

  const handleFileUpload = async (file) => {
    updateProcess('upload', 'running', 0);
    
    try {
      const response = await motorAPI.uploadExcel(file);
      console.log('🔍 Frontend: Upload response received:', response.data);
      console.log('📊 Frontend: Record count from backend:', response.data.recordCount);
      
      setUploadedFile(file);
      setRecordCount(response.data.recordCount || 0);
      updateProcess('upload', 'completed', 100);
      setCurrentStep(2);
      
      console.log('✅ Frontend: Record count state set to:', response.data.recordCount || 0);
    } catch (error) {
      updateProcess('upload', 'error', 0);
      console.error('Upload failed:', error);
    }
  };

  const handleGeneratePDFs = async () => {
    updateProcess('generate', 'running', 0);
    
    try {
      await motorAPI.generatePDFs();
      updateProcess('generate', 'completed', 100);
      setCurrentStep(3);
    } catch (error) {
      updateProcess('generate', 'error', 0);
      console.error('PDF generation failed:', error);
    }
  };

  const handleMergePDFs = async () => {
    updateProcess('merge', 'running', 0);
    
    try {
      await motorAPI.mergePDFs();
      updateProcess('merge', 'completed', 100);
      setCurrentStep(4);
    } catch (error) {
      updateProcess('merge', 'error', 0);
      console.error('PDF merge failed:', error);
    }
  };

  const handleSendEmails = async () => {
    updateProcess('email', 'running', 0);
    
    try {
      await motorAPI.sendEmails({ sender: 'NICL Motor' });
      updateProcess('email', 'completed', 100);
    } catch (error) {
      updateProcess('email', 'error', 0);
      console.error('Email sending failed:', error);
    }
  };

  // Load files list
  const loadFiles = async () => {
    setFilesLoading(true);
    try {
      const response = await motorAPI.getFiles();
      setFiles(response.data);
    } catch (error) {
      console.error('Failed to load files:', error);
    } finally {
      setFilesLoading(false);
    }
  };

  // Handle file downloads
  const handleDownloadIndividual = (filename) => {
    motorAPI.downloadIndividual(filename);
  };

  const handleDownloadMerged = (filename) => {
    motorAPI.downloadMerged(filename);
  };

  const handleDownloadAllIndividual = () => {
    motorAPI.downloadAllIndividual();
  };

  // Printer process update function
  const updatePrinterProcess = (step, status, progress = 0) => {
    setPrinterProcesses(prev => ({
      ...prev,
      [step]: { status, progress }
    }));
  };

  // Printer file management
  const loadPrinterFiles = async () => {
    setPrinterFilesLoading(true);
    try {
      const response = await motorAPI.getPrinterFiles();
      setPrinterFiles(response.data);
    } catch (error) {
      console.error('Failed to load printer files:', error);
    } finally {
      setPrinterFilesLoading(false);
    }
  };

  // Printer workflow handlers
  const handleGeneratePrinterPDFs = async () => {
    updatePrinterProcess('generate-printer', 'running', 0);
    try {
      await motorAPI.generatePrinterPDFs();
      updatePrinterProcess('generate-printer', 'completed', 100);
      loadPrinterFiles(); // Refresh files list
    } catch (error) {
      updatePrinterProcess('generate-printer', 'error', 0);
      console.error('Printer PDF generation failed:', error);
    }
  };

  const handleMergePrinterPDFs = async () => {
    updatePrinterProcess('merge-printer', 'running', 0);
    try {
      await motorAPI.mergePrinterPDFs();
      updatePrinterProcess('merge-printer', 'completed', 100);
      loadPrinterFiles(); // Refresh files list
    } catch (error) {
      updatePrinterProcess('merge-printer', 'error', 0);
      console.error('Printer PDF merge failed:', error);
    }
  };

  // Printer download handlers
  const handleDownloadPrinterIndividual = (filename) => {
    motorAPI.downloadPrinterIndividual(filename);
  };

  const handleDownloadPrinterMerged = (filename) => {
    motorAPI.downloadPrinterMerged(filename);
  };

  const handleDownloadAllPrinterIndividual = () => {
    motorAPI.downloadAllPrinterIndividual();
  };

  return (
    <div className="container">
      {/* Header */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Car size={32} style={{ color: 'var(--primary-color)' }} />
            <div>
              <h1 style={{ margin: 0, color: 'var(--primary-color)' }}>Motor Insurance Renewal System</h1>
              <p style={{ margin: 0, color: '#6b7280' }}>Generate and manage motor insurance renewal notices</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#6b7280' }}>
              <User size={16} />
              <span>{user}</span>
            </div>
            <button onClick={onLogout} className="btn btn-secondary">
              <LogOut size={16} />
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* Version Tabs */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', gap: '16px', borderBottom: '2px solid #e5e7eb', paddingBottom: '16px' }}>
          <button
            onClick={() => setActiveTab('digital')}
            className={`btn ${activeTab === 'digital' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ 
              padding: '12px 24px',
              borderRadius: '8px 8px 0 0',
              borderBottom: activeTab === 'digital' ? '3px solid var(--primary-color)' : 'none'
            }}
          >
            📧 Digital Version (Email)
          </button>
          <button
            onClick={() => setActiveTab('printer')}
            className={`btn ${activeTab === 'printer' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ 
              padding: '12px 24px',
              borderRadius: '8px 8px 0 0',
              borderBottom: activeTab === 'printer' ? '3px solid var(--primary-color)' : 'none'
            }}
          >
            🖨️ Printer Version (Letterhead)
          </button>
        </div>
        
        <div style={{ padding: '16px 0' }}>
          {activeTab === 'digital' && (
            <p style={{ margin: 0, color: '#6b7280' }}>
              Generate renewal notices for email distribution with full branding and QR codes
            </p>
          )}
          {activeTab === 'printer' && (
            <p style={{ margin: 0, color: '#6b7280' }}>
              Generate renewal notices optimized for printing on pre-printed letterhead stationery
            </p>
          )}
        </div>
      </div>

      {/* Workflow Steps */}
      <div style={{ display: 'grid', gap: '24px' }}>
        
        {activeTab === 'digital' && (
          <>
            {/* Digital Version Workflow */}
        
        {/* Step 1: Upload Excel */}
        <ProcessStep
          stepNumber={1}
          title="Upload Excel File"
          description="Upload output_motor_renewal.xlsx with policy data"
          icon={<Upload size={24} />}
          status={processes.upload.status}
          progress={processes.upload.progress}
          isActive={currentStep === 1}
          isCompleted={processes.upload.status === 'completed'}
        >
          <FileUpload
            onFileSelect={handleFileUpload}
            acceptedTypes=".xlsx,.xls"
            expectedFileName="output_motor_renewal.xlsx"
            disabled={processes.upload.status === 'running'}
          />
          {uploadedFile && (
            <div style={{ marginTop: '12px', padding: '12px', background: '#f0fdf4', borderRadius: '8px' }}>
              <p style={{ color: '#16a34a', margin: 0 }}>
                ✅ Uploaded: {uploadedFile.name}
              </p>
              <p style={{ color: '#16a34a', margin: '4px 0 0 0', fontSize: '14px' }}>
                📊 Records found: {recordCount.toLocaleString()}
              </p>
            </div>
          )}
        </ProcessStep>

        {/* Step 2: Generate PDFs */}
        <ProcessStep
          stepNumber={2}
          title="Generate Individual PDFs"
          description="Create renewal notices for each policy"
          icon={<FileText size={24} />}
          status={processes.generate.status}
          progress={processes.generate.progress}
          isActive={currentStep === 2}
          isCompleted={processes.generate.status === 'completed'}
          disabled={currentStep < 2}
        >
          <button 
            onClick={handleGeneratePDFs}
            className="btn btn-primary"
            disabled={currentStep < 2 || processes.generate.status === 'running'}
          >
            {processes.generate.status === 'running' ? 'Generating PDFs...' : 'Generate PDFs'}
          </button>
        </ProcessStep>

        {/* Step 3: Merge PDFs */}
        <ProcessStep
          stepNumber={3}
          title="Merge PDFs"
          description="Combine all renewal notices into single file"
          icon={<Merge size={24} />}
          status={processes.merge.status}
          progress={processes.merge.progress}
          isActive={currentStep === 3}
          isCompleted={processes.merge.status === 'completed'}
          disabled={currentStep < 3}
        >
          <button 
            onClick={handleMergePDFs}
            className="btn btn-primary"
            disabled={currentStep < 3 || processes.merge.status === 'running'}
          >
            {processes.merge.status === 'running' ? 'Merging PDFs...' : 'Merge PDFs'}
          </button>
        </ProcessStep>

        {/* Step 4: Send Emails */}
        <ProcessStep
          stepNumber={4}
          title="Send Emails"
          description="Email renewal notices with 'NICL Motor' sender"
          icon={<Mail size={24} />}
          status={processes.email.status}
          progress={processes.email.progress}
          isActive={currentStep === 4}
          isCompleted={processes.email.status === 'completed'}
          disabled={currentStep < 4}
        >
          <button 
            onClick={handleSendEmails}
            className="btn btn-primary"
            disabled={currentStep < 4 || processes.email.status === 'running'}
          >
            {processes.email.status === 'running' ? 'Sending Emails...' : 'Send Emails'}
          </button>
        </ProcessStep>
          </>
        )}

        {activeTab === 'printer' && (
          <>
            {/* Printer Version Workflow */}
            {/* Step 1: Upload Excel (Shared) */}
            <ProcessStep
              stepNumber={1}
              title="Upload Excel File"
              description="Upload output_motor_renewal.xlsx with policy data (shared with digital version)"
              icon={<Upload size={24} />}
              status={processes.upload.status}
              progress={processes.upload.progress}
              isActive={currentStep >= 1}
              isCompleted={processes.upload.status === 'completed'}
            >
              <FileUpload
                onFileSelect={handleFileUpload}
                acceptedTypes=".xlsx,.xls"
                expectedFileName="output_motor_renewal.xlsx"
                disabled={processes.upload.status === 'running'}
              />
              {uploadedFile && (
                <div style={{ marginTop: '12px', padding: '12px', background: '#f0fdf4', borderRadius: '8px' }}>
                  <p style={{ color: '#16a34a', margin: 0 }}>
                    ✅ Uploaded: {uploadedFile.name}
                  </p>
                  <p style={{ color: '#16a34a', margin: '4px 0 0 0', fontSize: '14px' }}>
                    📊 Records found: {recordCount.toLocaleString()}
                  </p>
                </div>
              )}
            </ProcessStep>

            {/* Step 2: Generate Printer PDFs */}
            <ProcessStep
              stepNumber={2}
              title="Generate Printer PDFs"
              description="Create renewal notices optimized for letterhead printing"
              icon={<FileText size={24} />}
              status={printerProcesses['generate-printer'].status}
              progress={printerProcesses['generate-printer'].progress}
              isActive={currentStep >= 1}
              isCompleted={printerProcesses['generate-printer'].status === 'completed'}
              disabled={processes.upload.status !== 'completed'}
            >
              <button 
                onClick={handleGeneratePrinterPDFs}
                className="btn btn-primary"
                disabled={processes.upload.status !== 'completed' || printerProcesses['generate-printer'].status === 'running'}
              >
                {printerProcesses['generate-printer'].status === 'running' ? 'Generating Printer PDFs...' : 'Generate Printer PDFs'}
              </button>
            </ProcessStep>

            {/* Step 3: Merge Printer PDFs */}
            <ProcessStep
              stepNumber={3}
              title="Merge Printer PDFs"
              description="Combine all printer renewal notices into single file"
              icon={<Merge size={24} />}
              status={printerProcesses['merge-printer'].status}
              progress={printerProcesses['merge-printer'].progress}
              isActive={printerProcesses['generate-printer'].status === 'completed'}
              isCompleted={printerProcesses['merge-printer'].status === 'completed'}
              disabled={printerProcesses['generate-printer'].status !== 'completed'}
            >
              <button 
                onClick={handleMergePrinterPDFs}
                className="btn btn-primary"
                disabled={printerProcesses['generate-printer'].status !== 'completed' || printerProcesses['merge-printer'].status === 'running'}
              >
                {printerProcesses['merge-printer'].status === 'running' ? 'Merging Printer PDFs...' : 'Merge Printer PDFs'}
              </button>
            </ProcessStep>
          </>
        )}

      </div>

      {/* File Downloads Section */}
      {((activeTab === 'digital' && (files.individual.length > 0 || files.merged.length > 0)) ||
        (activeTab === 'printer' && (printerFiles.individual.length > 0 || printerFiles.merged.length > 0))) && (
        <div style={{ marginTop: '32px' }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '12px', 
            marginBottom: '24px',
            padding: '16px',
            background: 'linear-gradient(135deg, var(--primary-color), #3b82f6)',
            borderRadius: '12px',
            color: 'white'
          }}>
            <Download size={24} />
            <h2 style={{ margin: 0, fontSize: '20px' }}>
              Download Generated Files - {activeTab === 'digital' ? 'Digital Version' : 'Printer Version'}
            </h2>
          </div>

          <div style={{ display: 'grid', gap: '24px', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))' }}>
            {activeTab === 'digital' && (
              <>
                {/* Digital Individual PDFs */}
                <FileList
                  title="Individual Renewal Notices (Digital)"
                  files={files.individual}
                  onDownload={handleDownloadIndividual}
                  onDownloadAll={handleDownloadAllIndividual}
                  onRefresh={loadFiles}
                  isLoading={filesLoading}
                  emptyMessage="No individual PDFs generated yet"
                />

                {/* Digital Merged PDFs */}
                <FileList
                  title="Merged Policy Files (Digital)"
                  files={files.merged}
                  onDownload={handleDownloadMerged}
                  onRefresh={loadFiles}
                  isLoading={filesLoading}
                  emptyMessage="No merged PDFs available yet"
                />
              </>
            )}

            {activeTab === 'printer' && (
              <>
                {/* Printer Individual PDFs */}
                <FileList
                  title="Individual Renewal Notices (Printer)"
                  files={printerFiles.individual}
                  onDownload={handleDownloadPrinterIndividual}
                  onDownloadAll={handleDownloadAllPrinterIndividual}
                  onRefresh={loadPrinterFiles}
                  isLoading={printerFilesLoading}
                  emptyMessage="No printer PDFs generated yet"
                />

                {/* Printer Merged PDFs */}
                <FileList
                  title="Merged Policy Files (Printer)"
                  files={printerFiles.merged}
                  onDownload={handleDownloadPrinterMerged}
                  onRefresh={loadPrinterFiles}
                  isLoading={printerFilesLoading}
                  emptyMessage="No merged printer PDFs available yet"
                />
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MotorDashboard;