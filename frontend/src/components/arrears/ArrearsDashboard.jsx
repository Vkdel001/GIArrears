import React, { useState, useEffect } from 'react';
import { AlertTriangle, Upload, FileText, Merge, Mail, LogOut, User, Download, BarChart3 } from 'lucide-react';
import FileUpload from '../shared/FileUpload';
import ProcessStep from '../shared/ProcessStep';
import FileList from '../shared/FileList';
import { arrearsAPI } from '../../services/api';

const ArrearsDashboard = ({ user, onLogout }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [recordCount, setRecordCount] = useState(0);
  const [recoveryDistribution, setRecoveryDistribution] = useState({});
  
  // Process states
  const [processes, setProcesses] = useState({
    upload: { status: 'pending', progress: 0 },
    generate: { status: 'pending', progress: 0 },
    merge: { status: 'pending', progress: 0 },
    email: { status: 'pending', progress: 0 }
  });
  
  const [files, setFiles] = useState({
    individual: { L0: [], L1: [], L2: [], MED: [] },
    merged: { L0: [], L1: [], L2: [], MED: [] }
  });
  
  const [filesLoading, setFilesLoading] = useState(false);
  const [recoveryStats, setRecoveryStats] = useState({
    L0: { individual: 0, merged: 0 },
    L1: { individual: 0, merged: 0 },
    L2: { individual: 0, merged: 0 },
    MED: { individual: 0, merged: 0 }
  });

  // Check existing workflow status on component mount
  useEffect(() => {
    checkWorkflowStatus();
    loadFiles();
  }, []);

  const checkWorkflowStatus = async () => {
    try {
      const response = await arrearsAPI.getStatus();
      const status = response.data;
      
      // Update processes based on existing files
      setProcesses(prev => ({
        ...prev,
        upload: { status: status.upload ? 'completed' : 'pending', progress: status.upload ? 100 : 0 },
        generate: { status: status.generate ? 'completed' : 'pending', progress: status.generate ? 100 : 0 },
        merge: { status: status.merge ? 'completed' : 'pending', progress: status.merge ? 100 : 0 }
      }));
      
      // Set current step and recovery stats
      setCurrentStep(status.currentStep);
      setRecoveryStats(status.recoveryStats || {});
      
      if (status.upload) {
        setUploadedFile({ name: 'Extracted_Arrears_Data.xlsx' });
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
      const response = await arrearsAPI.getProgress();
      const progress = response.data;
      
      if (progress.step && progress.status !== 'idle') {
        updateProcess(progress.step, progress.status, progress.progress);
      }
    } catch (error) {
      console.error('Failed to get progress:', error);
    }
  };

  // Start polling when a process is running
  useEffect(() => {
    const hasRunningProcess = Object.values(processes).some(p => p.status === 'running');
    
    if (hasRunningProcess) {
      const interval = setInterval(pollProgress, 1000); // Poll every second
      return () => clearInterval(interval);
    }
  }, [processes]);

  const handleFileUpload = async (file) => {
    updateProcess('upload', 'running', 0);
    
    try {
      const response = await arrearsAPI.uploadExcel(file);
      setUploadedFile(file);
      setRecordCount(response.data.recordCount || 0);
      setRecoveryDistribution(response.data.recoveryDistribution || {});
      updateProcess('upload', 'completed', 100);
      setCurrentStep(2);
    } catch (error) {
      updateProcess('upload', 'error', 0);
      console.error('Upload failed:', error);
    }
  };

  const handleGenerateLetters = async () => {
    updateProcess('generate', 'running', 0);
    
    try {
      await arrearsAPI.generateLetters();
      updateProcess('generate', 'completed', 100);
      setCurrentStep(3);
      // Refresh status to get updated stats
      setTimeout(checkWorkflowStatus, 1000);
    } catch (error) {
      updateProcess('generate', 'error', 0);
      console.error('Letter generation failed:', error);
    }
  };

  const handleMergeLetters = async () => {
    updateProcess('merge', 'running', 0);
    
    try {
      await arrearsAPI.mergeLetters();
      updateProcess('merge', 'completed', 100);
      setCurrentStep(4);
      // Refresh files and status
      setTimeout(() => {
        loadFiles();
        checkWorkflowStatus();
      }, 1000);
    } catch (error) {
      updateProcess('merge', 'error', 0);
      console.error('Letter merging failed:', error);
    }
  };

  const handleSendEmails = async () => {
    updateProcess('email', 'running', 0);
    
    try {
      await arrearsAPI.sendEmails({ recoveryTypes: ['all'] });
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
      const response = await arrearsAPI.getFiles();
      setFiles(response.data);
    } catch (error) {
      console.error('Failed to load files:', error);
    } finally {
      setFilesLoading(false);
    }
  };

  // Handle file downloads
  const handleDownloadIndividual = (type, filename) => {
    arrearsAPI.downloadIndividual(type, filename);
  };

  const handleDownloadMerged = (type, filename) => {
    arrearsAPI.downloadMerged(type, filename);
  };

  const handleDownloadAllIndividual = (type) => {
    arrearsAPI.downloadAllIndividual(type);
  };

  // Recovery type configurations
  const recoveryTypeConfig = {
    L0: { name: 'Level 0', color: '#f59e0b', description: 'Initial Notice' },
    L1: { name: 'Level 1', color: '#f97316', description: 'First Reminder' },
    L2: { name: 'Level 2', color: '#dc2626', description: 'Final Notice' },
    MED: { name: 'Legal (MED)', color: '#991b1b', description: 'Mise en Demeure' }
  };

  return (
    <div className="container">
      {/* Header */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <AlertTriangle size={32} style={{ color: 'var(--primary-color)' }} />
            <div>
              <h1 style={{ margin: 0, color: 'var(--primary-color)' }}>Arrears Letter Generation System</h1>
              <p style={{ margin: 0, color: '#6b7280' }}>Generate and manage insurance arrears letters by recovery level</p>
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

      {/* Recovery Distribution Stats */}
      {Object.keys(recoveryDistribution).length > 0 && (
        <div className="card" style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <BarChart3 size={24} style={{ color: 'var(--primary-color)' }} />
            <h3 style={{ margin: 0, color: 'var(--primary-color)' }}>Recovery Action Distribution</h3>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            {Object.entries(recoveryDistribution).map(([type, count]) => {
              const config = recoveryTypeConfig[type] || { name: type, color: '#6b7280', description: 'Other' };
              return (
                <div key={type} style={{ 
                  padding: '16px', 
                  background: `${config.color}15`, 
                  borderRadius: '8px',
                  border: `2px solid ${config.color}30`
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h4 style={{ margin: 0, color: config.color, fontSize: '14px' }}>{config.name}</h4>
                      <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#6b7280' }}>{config.description}</p>
                    </div>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: config.color }}>
                      {count.toLocaleString()}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Workflow Steps */}
      <div style={{ display: 'grid', gap: '24px' }}>
        
        {/* Step 1: Upload Excel */}
        <ProcessStep
          stepNumber={1}
          title="Upload Excel File"
          description="Upload Extracted_Arrears_Data.xlsx with policy and arrears data"
          icon={<Upload size={24} />}
          status={processes.upload.status}
          progress={processes.upload.progress}
          isActive={currentStep === 1}
          isCompleted={processes.upload.status === 'completed'}
        >
          <FileUpload
            onFileSelect={handleFileUpload}
            acceptedTypes=".xlsx,.xls"
            expectedFileName="Extracted_Arrears_Data.xlsx"
            disabled={processes.upload.status === 'running'}
          />
          {uploadedFile && (
            <div style={{ marginTop: '12px', padding: '12px', background: '#f0fdf4', borderRadius: '8px' }}>
              <p style={{ color: '#16a34a', margin: 0 }}>
                ✅ Uploaded: {uploadedFile.name}
              </p>
              <p style={{ color: '#16a34a', margin: '4px 0 0 0', fontSize: '14px' }}>
                📊 Total records: {recordCount.toLocaleString()}
              </p>
            </div>
          )}
        </ProcessStep>

        {/* Step 2: Generate Letters */}
        <ProcessStep
          stepNumber={2}
          title="Generate Arrears Letters"
          description="Create letters for each recovery type (L0, L1, L2, MED)"
          icon={<FileText size={24} />}
          status={processes.generate.status}
          progress={processes.generate.progress}
          isActive={currentStep === 2}
          isCompleted={processes.generate.status === 'completed'}
          disabled={currentStep < 2}
        >
          <div style={{ marginBottom: '16px' }}>
            <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 8px 0' }}>
              This will generate individual PDF letters for each recovery action type:
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '8px', fontSize: '12px' }}>
              {Object.entries(recoveryStats).map(([type, stats]) => {
                const config = recoveryTypeConfig[type];
                return (
                  <div key={type} style={{ 
                    padding: '8px', 
                    background: `${config.color}10`, 
                    borderRadius: '4px',
                    textAlign: 'center'
                  }}>
                    <div style={{ fontWeight: 'bold', color: config.color }}>{config.name}</div>
                    <div style={{ color: '#6b7280' }}>{stats.individual} letters</div>
                  </div>
                );
              })}
            </div>
          </div>
          <button 
            onClick={handleGenerateLetters}
            className="btn btn-primary"
            disabled={currentStep < 2 || processes.generate.status === 'running'}
          >
            {processes.generate.status === 'running' ? 'Generating Letters...' : 'Generate Letters'}
          </button>
        </ProcessStep>

        {/* Step 3: Merge Letters */}
        <ProcessStep
          stepNumber={3}
          title="Merge Letters by Recovery Type"
          description="Combine letters into single PDFs for each recovery level"
          icon={<Merge size={24} />}
          status={processes.merge.status}
          progress={processes.merge.progress}
          isActive={currentStep === 3}
          isCompleted={processes.merge.status === 'completed'}
          disabled={currentStep < 3}
        >
          <div style={{ marginBottom: '16px' }}>
            <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 8px 0' }}>
              This will create merged PDFs for batch printing:
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '8px', fontSize: '12px' }}>
              {Object.entries(recoveryStats).map(([type, stats]) => {
                const config = recoveryTypeConfig[type];
                return (
                  <div key={type} style={{ 
                    padding: '8px', 
                    background: `${config.color}10`, 
                    borderRadius: '4px',
                    textAlign: 'center'
                  }}>
                    <div style={{ fontWeight: 'bold', color: config.color }}>{config.name}</div>
                    <div style={{ color: '#6b7280' }}>
                      {stats.individual} → {stats.merged} merged
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <button 
            onClick={handleMergeLetters}
            className="btn btn-primary"
            disabled={currentStep < 3 || processes.merge.status === 'running'}
          >
            {processes.merge.status === 'running' ? 'Merging Letters...' : 'Merge Letters'}
          </button>
        </ProcessStep>

        {/* Step 4: Send Emails */}
        <ProcessStep
          stepNumber={4}
          title="Send Emails (Optional)"
          description="Email arrears letters with recovery-type-specific templates"
          icon={<Mail size={24} />}
          status={processes.email.status}
          progress={processes.email.progress}
          isActive={currentStep === 4}
          isCompleted={processes.email.status === 'completed'}
          disabled={currentStep < 4}
        >
          <div style={{ marginBottom: '16px' }}>
            <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 8px 0' }}>
              Send emails with different tones based on recovery level:
            </p>
            <ul style={{ fontSize: '12px', color: '#6b7280', margin: 0, paddingLeft: '20px' }}>
              <li><strong>L0:</strong> Friendly reminder tone</li>
              <li><strong>L1:</strong> Formal notice tone</li>
              <li><strong>L2:</strong> Urgent notice tone</li>
              <li><strong>MED:</strong> Legal notice tone</li>
            </ul>
          </div>
          <button 
            onClick={handleSendEmails}
            className="btn btn-primary"
            disabled={currentStep < 4 || processes.email.status === 'running'}
          >
            {processes.email.status === 'running' ? 'Sending Emails...' : 'Send Emails'}
          </button>
        </ProcessStep>

      </div>

      {/* File Downloads Section */}
      {(Object.values(files.individual).some(arr => arr.length > 0) || 
        Object.values(files.merged).some(arr => arr.length > 0)) && (
        <div style={{ marginTop: '32px' }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '12px', 
            marginBottom: '24px',
            padding: '16px',
            background: 'linear-gradient(135deg, #dc2626, #ef4444)',
            borderRadius: '12px',
            color: 'white'
          }}>
            <Download size={24} />
            <h2 style={{ margin: 0, fontSize: '20px' }}>Download Generated Files</h2>
          </div>

          {/* Individual PDFs by Recovery Type */}
          <div style={{ marginBottom: '32px' }}>
            <h3 style={{ color: 'var(--primary-color)', marginBottom: '16px' }}>Individual Letters by Recovery Type</h3>
            <div style={{ display: 'grid', gap: '16px', gridTemplateColumns: 'repeat(4, 1fr)' }}>
              {Object.entries(files.individual).map(([type, typeFiles]) => {
                const config = recoveryTypeConfig[type];
                return (
                  <FileList
                    key={type}
                    title={`${config.name} (${config.description})`}
                    files={typeFiles}
                    onDownload={(filename) => handleDownloadIndividual(type, filename)}
                    onDownloadAll={() => handleDownloadAllIndividual(type)}
                    onRefresh={loadFiles}
                    isLoading={filesLoading}
                    emptyMessage={`No ${config.name} letters generated yet`}
                    headerColor={config.color}
                  />
                );
              })}
            </div>
          </div>

          {/* Merged PDFs by Recovery Type */}
          <div>
            <h3 style={{ color: 'var(--primary-color)', marginBottom: '16px' }}>Merged Files for Printing</h3>
            <div style={{ display: 'grid', gap: '16px', gridTemplateColumns: 'repeat(4, 1fr)' }}>
              {Object.entries(files.merged).map(([type, typeFiles]) => {
                const config = recoveryTypeConfig[type];
                return (
                  <FileList
                    key={type}
                    title={`${config.name} Merged`}
                    files={typeFiles}
                    onDownload={(filename) => handleDownloadMerged(type, filename)}
                    onRefresh={loadFiles}
                    isLoading={filesLoading}
                    emptyMessage={`No ${config.name} merged files available yet`}
                    headerColor={config.color}
                  />
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ArrearsDashboard;