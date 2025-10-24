import React, { useState, useEffect } from 'react';
import { Heart, Upload, FileText, Paperclip, Merge, Mail, LogOut, User, Download, Printer, Monitor } from 'lucide-react';
import FileUpload from '../shared/FileUpload';
import ProcessStep from '../shared/ProcessStep';
import FileList from '../shared/FileList';
import { healthAPI } from '../../services/api';

const HealthDashboard = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState('digital'); // 'digital' or 'printer'
  const [currentStep, setCurrentStep] = useState(1);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [recordCount, setRecordCount] = useState(0);
  
  // Digital workflow processes
  const [processes, setProcesses] = useState({
    upload: { status: 'pending', progress: 0 },
    generate: { status: 'pending', progress: 0 },
    attach: { status: 'pending', progress: 0 },
    merge: { status: 'pending', progress: 0 },
    email: { status: 'pending', progress: 0 }
  });
  
  // Printer workflow processes
  const [printerProcesses, setPrinterProcesses] = useState({
    upload: { status: 'pending', progress: 0 },
    'generate-printer': { status: 'pending', progress: 0 },
    'merge-printer': { status: 'pending', progress: 0 }
  });
  
  const [printerCurrentStep, setPrinterCurrentStep] = useState(1);
  const [files, setFiles] = useState({ individual: [], merged: [] });
  const [printerFiles, setPrinterFiles] = useState({ individual: [], merged: [] });
  const [filesLoading, setFilesLoading] = useState(false);

  // Check existing workflow status on component mount
  useEffect(() => {
    checkWorkflowStatus();
    loadFiles();
    loadPrinterFiles();
  }, []);

  const checkWorkflowStatus = async () => {
    try {
      const response = await healthAPI.getStatus();
      const status = response.data;
      
      // Update processes based on existing files
      setProcesses(prev => ({
        ...prev,
        upload: { status: status.upload ? 'completed' : 'pending', progress: status.upload ? 100 : 0 },
        generate: { status: status.generate ? 'completed' : 'pending', progress: status.generate ? 100 : 0 },
        attach: { status: status.attach ? 'completed' : 'pending', progress: status.attach ? 100 : 0 },
        merge: { status: status.merge ? 'completed' : 'pending', progress: status.merge ? 100 : 0 }
      }));
      
      // Set current step based on what's completed
      setCurrentStep(status.currentStep);
      
      if (status.upload) {
        setUploadedFile({ name: 'RENEWAL_LISTING.xlsx' });
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

  const updatePrinterProcess = (step, status, progress = 0) => {
    setPrinterProcesses(prev => ({
      ...prev,
      [step]: { status, progress }
    }));
  };

  // Poll for progress updates
  const pollProgress = async () => {
    try {
      const response = await healthAPI.getProgress();
      const progress = response.data;
      
      if (progress.step && progress.status !== 'idle') {
        // Update appropriate process based on step type
        if (progress.step.includes('printer') || progress.step === 'generate-printer' || progress.step === 'merge-printer') {
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
      const response = await healthAPI.uploadExcel(file);
      setUploadedFile(file);
      setRecordCount(response.data.recordCount || 0);
      updateProcess('upload', 'completed', 100);
      setCurrentStep(2);
    } catch (error) {
      updateProcess('upload', 'error', 0);
      console.error('Upload failed:', error);
    }
  };

  const handleGeneratePDFs = async () => {
    updateProcess('generate', 'running', 0);
    
    try {
      await healthAPI.generatePDFs();
      updateProcess('generate', 'completed', 100);
      setCurrentStep(3);
    } catch (error) {
      updateProcess('generate', 'error', 0);
      console.error('PDF generation failed:', error);
    }
  };

  const handleAttachForms = async () => {
    updateProcess('attach', 'running', 0);
    
    try {
      await healthAPI.attachForms();
      updateProcess('attach', 'completed', 100);
      setCurrentStep(4);
    } catch (error) {
      updateProcess('attach', 'error', 0);
      console.error('Form attachment failed:', error);
    }
  };

  const handleMergeAll = async () => {
    updateProcess('merge', 'running', 0);
    
    try {
      await healthAPI.mergeAll();
      updateProcess('merge', 'completed', 100);
      setCurrentStep(5);
    } catch (error) {
      updateProcess('merge', 'error', 0);
      console.error('Final merge failed:', error);
    }
  };

  const handleSendEmails = async () => {
    updateProcess('email', 'running', 0);
    
    try {
      await healthAPI.sendEmails({ sender: 'NICL Health' });
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
      const response = await healthAPI.getFiles();
      setFiles(response.data);
    } catch (error) {
      console.error('Failed to load files:', error);
    } finally {
      setFilesLoading(false);
    }
  };

  // Handle file downloads
  const handleDownloadIndividual = (filename) => {
    healthAPI.downloadIndividual(filename);
  };

  const handleDownloadMerged = (filename) => {
    healthAPI.downloadMerged(filename);
  };

  const handleDownloadAllIndividual = () => {
    healthAPI.downloadAllIndividual();
  };

  // Printer workflow functions
  const handleGeneratePrinterPDFs = async () => {
    updatePrinterProcess('generate-printer', 'running', 0);
    
    try {
      await healthAPI.generatePrinterPDFs();
      updatePrinterProcess('generate-printer', 'completed', 100);
      setPrinterCurrentStep(2);
      loadPrinterFiles(); // Refresh printer files
    } catch (error) {
      updatePrinterProcess('generate-printer', 'error', 0);
      console.error('Printer PDF generation failed:', error);
    }
  };

  const handleMergePrinterPDFs = async () => {
    updatePrinterProcess('merge-printer', 'running', 0);
    
    try {
      await healthAPI.mergePrinterPDFs();
      updatePrinterProcess('merge-printer', 'completed', 100);
      loadPrinterFiles(); // Refresh printer files
    } catch (error) {
      updatePrinterProcess('merge-printer', 'error', 0);
      console.error('Printer PDF merge failed:', error);
    }
  };

  // Load printer files list
  const loadPrinterFiles = async () => {
    try {
      const response = await healthAPI.getPrinterFiles();
      setPrinterFiles(response.data);
    } catch (error) {
      console.error('Failed to load printer files:', error);
    }
  };

  // Handle printer file downloads
  const handleDownloadPrinterIndividual = (filename) => {
    healthAPI.downloadPrinterIndividual(filename);
  };

  const handleDownloadPrinterMerged = (filename) => {
    healthAPI.downloadPrinterMerged(filename);
  };

  const handleDownloadAllPrinterIndividual = () => {
    healthAPI.downloadAllPrinterIndividual();
  };

  return (
    <div className="container">
      {/* Header */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Heart size={32} style={{ color: 'var(--primary-color)' }} />
            <div>
              <h1 style={{ margin: 0, color: 'var(--primary-color)' }}>Healthcare Insurance Renewal System</h1>
              <p style={{ margin: 0, color: '#6b7280' }}>Generate and manage healthcare insurance renewal letters</p>
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

      {/* Workflow Steps */}
      <div style={{ display: 'grid', gap: '24px' }}>
        
        {/* Step 1: Upload Excel */}
        <ProcessStep
          stepNumber={1}
          title="Upload Excel File"
          description="Upload RENEWAL_LISTING.xlsx with policy data"
          icon={<Upload size={24} />}
          status={processes.upload.status}
          progress={processes.upload.progress}
          isActive={currentStep === 1}
          isCompleted={processes.upload.status === 'completed'}
        >
          <FileUpload
            onFileSelect={handleFileUpload}
            acceptedTypes=".xlsx,.xls"
            expectedFileName="RENEWAL_LISTING.xlsx"
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
          description="Create renewal letters for each policy"
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

        {/* Step 3: Attach HEALTHSENSE Forms */}
        <ProcessStep
          stepNumber={3}
          title="Attach HEALTHSENSE Forms"
          description="Add standard forms to each policy (First Merge)"
          icon={<Paperclip size={24} />}
          status={processes.attach.status}
          progress={processes.attach.progress}
          isActive={currentStep === 3}
          isCompleted={processes.attach.status === 'completed'}
          disabled={currentStep < 3}
        >
          <div style={{ marginBottom: '16px' }}>
            <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 8px 0' }}>
              This will attach the following forms to each policy:
            </p>
            <ul style={{ fontSize: '14px', color: '#6b7280', margin: 0, paddingLeft: '20px' }}>
              <li>Renewal Acceptance Form - HealthSense Plan V2 0.pdf</li>
              <li>Annex.pdf</li>
            </ul>
          </div>
          <button 
            onClick={handleAttachForms}
            className="btn btn-primary"
            disabled={currentStep < 3 || processes.attach.status === 'running'}
          >
            {processes.attach.status === 'running' ? 'Attaching Forms...' : 'Attach Forms'}
          </button>
        </ProcessStep>

        {/* Step 4: Final Merge */}
        <ProcessStep
          stepNumber={4}
          title="Final Merge"
          description="Combine all policies into single PDF for printing (Second Merge)"
          icon={<Merge size={24} />}
          status={processes.merge.status}
          progress={processes.merge.progress}
          isActive={currentStep === 4}
          isCompleted={processes.merge.status === 'completed'}
          disabled={currentStep < 4}
        >
          <button 
            onClick={handleMergeAll}
            className="btn btn-primary"
            disabled={currentStep < 4 || processes.merge.status === 'running'}
          >
            {processes.merge.status === 'running' ? 'Merging All PDFs...' : 'Final Merge'}
          </button>
        </ProcessStep>

        {/* Step 5: Send Emails */}
        <ProcessStep
          stepNumber={5}
          title="Send Emails"
          description="Email renewal letters with 'NICL Health' sender"
          icon={<Mail size={24} />}
          status={processes.email.status}
          progress={processes.email.progress}
          isActive={currentStep === 5}
          isCompleted={processes.email.status === 'completed'}
          disabled={currentStep < 5}
        >
          <button 
            onClick={handleSendEmails}
            className="btn btn-primary"
            disabled={currentStep < 5 || processes.email.status === 'running'}
          >
            {processes.email.status === 'running' ? 'Sending Emails...' : 'Send Emails'}
          </button>
        </ProcessStep>

      </div>

      {/* File Downloads Section */}
      {(files.individual.length > 0 || files.merged.length > 0) && (
        <div style={{ marginTop: '32px' }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '12px', 
            marginBottom: '24px',
            padding: '16px',
            background: 'linear-gradient(135deg, #059669, #10b981)',
            borderRadius: '12px',
            color: 'white'
          }}>
            <Download size={24} />
            <h2 style={{ margin: 0, fontSize: '20px' }}>Download Generated Files</h2>
          </div>

          <div style={{ display: 'grid', gap: '24px', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))' }}>
            {/* Individual PDFs */}
            <FileList
              title="Individual Renewal Notices"
              files={files.individual}
              onDownload={handleDownloadIndividual}
              onDownloadAll={handleDownloadAllIndividual}
              onRefresh={loadFiles}
              isLoading={filesLoading}
              emptyMessage="No individual PDFs generated yet"
            />

            {/* Merged PDFs */}
            <FileList
              title="Final Merged Policy Files"
              files={files.merged}
              onDownload={handleDownloadMerged}
              onRefresh={loadFiles}
              isLoading={filesLoading}
              emptyMessage="No merged PDFs available yet"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default HealthDashboard;