import React, { useState, useEffect } from 'react';
import { AlertTriangle, Upload, FileText, Merge, Mail, LogOut, User, Download, BarChart3, CheckCircle, X, Clock } from 'lucide-react';
import FileUpload from '../shared/FileUpload';
import ProcessStep from '../shared/ProcessStep';
import FileList from '../shared/FileList';
import { arrearsAPI } from '../../services/api';

const ArrearsDashboard = ({ user, onLogout }) => {
  // Product type selection state
  const [productType, setProductType] = useState('');
  const [showProductConfirmModal, setShowProductConfirmModal] = useState(false);
  const [selectedProductData, setSelectedProductData] = useState(null);
  
  const [currentStep, setCurrentStep] = useState(1);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [recordCount, setRecordCount] = useState(0);
  const [recoveryDistribution, setRecoveryDistribution] = useState({});
  
  // Process states
  const [processes, setProcesses] = useState({
    upload: { status: 'pending', progress: 0, message: '', details: {} },
    generate: { status: 'pending', progress: 0, message: '', details: {} },
    merge: { status: 'pending', progress: 0, message: '', details: {} },
    email: { status: 'pending', progress: 0, message: '', details: {} }
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

  // Upload confirmation modal state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadModalData, setUploadModalData] = useState(null);

  // Completion modal states
  const [showGenerateCompleteModal, setShowGenerateCompleteModal] = useState(false);
  const [showMergeCompleteModal, setShowMergeCompleteModal] = useState(false);
  const [completionData, setCompletionData] = useState(null);

  // Existing data notice
  const [showExistingDataNotice, setShowExistingDataNotice] = useState(false);
  const [existingDataInfo, setExistingDataInfo] = useState(null);
  const [hasHandledInitialLoad, setHasHandledInitialLoad] = useState(false);

  // Email confirmation modal
  const [showEmailConfirmModal, setShowEmailConfirmModal] = useState(false);
  const [emailConfirmText, setEmailConfirmText] = useState('');
  const requiredEmailText = 'Send emails to customers';

  // Check existing workflow status on component mount
  useEffect(() => {
    checkWorkflowStatus(false, true); // isInitialLoad = true
    loadFiles();
  }, []);

  const checkWorkflowStatus = async (autoLoad = false, isInitialLoad = false) => {
    if (!productType && !isInitialLoad) return; // Don't check status without product type
    
    try {
      const response = await arrearsAPI.getStatus(productType || 'health');
      const status = response.data;
      
      // Check if there's existing data
      const hasExistingData = status.upload || status.generate || status.merge;
      
      // Only show the modal on initial load and if we haven't handled it yet
      if (hasExistingData && !autoLoad && isInitialLoad && !hasHandledInitialLoad) {
        // Show notice about existing data instead of auto-loading
        setExistingDataInfo(status);
        setShowExistingDataNotice(true);
        setHasHandledInitialLoad(true);
        return;
      }
      
      if (autoLoad || hasExistingData) {
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
          const config = productTypeConfig[productType || 'health'];
          setUploadedFile({ name: config.inputFile });
        }
      }
      
      // Mark that we've handled the initial load (even if no existing data)
      if (isInitialLoad) {
        setHasHandledInitialLoad(true);
      }
      
    } catch (error) {
      console.error('Failed to check workflow status:', error);
    }
  };

  const updateProcess = (step, status, progress = 0, message = '', details = {}, showModal = false) => {
    setProcesses(prev => ({
      ...prev,
      [step]: { status, progress, message, details }
    }));

    // Show completion modals only when explicitly requested
    if (status === 'completed' && showModal) {
      if (step === 'generate') {
        setCompletionData({
          type: 'generate',
          message: message,
          details: details
        });
        setShowGenerateCompleteModal(true);
      } else if (step === 'merge') {
        setCompletionData({
          type: 'merge',
          message: message,
          details: details
        });
        setShowMergeCompleteModal(true);
      }
    }
  };

  // Poll for progress updates
  const pollProgress = async () => {
    if (!productType) return;
    
    try {
      const response = await arrearsAPI.getProgress(productType);
      const progress = response.data;
      
      if (progress.step && progress.status !== 'idle') {
        // Check if this is a transition from running to completed
        const currentStatus = processes[progress.step]?.status;
        const shouldShowModal = progress.status === 'completed' && currentStatus === 'running';
        
        updateProcess(
          progress.step, 
          progress.status, 
          progress.progress, 
          progress.message || '', 
          progress.details || {},
          shouldShowModal
        );
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
    if (!productType) {
      alert('Please select a product type first');
      return;
    }
    
    updateProcess('upload', 'running', 0);
    
    try {
      const response = await arrearsAPI.uploadExcel(file, productType);
      const recordCount = response.data.recordCount || 0;
      const recoveryDistribution = response.data.recoveryDistribution || {};
      
      // Show confirmation modal with upload details
      setUploadModalData({
        file,
        recordCount,
        recoveryDistribution
      });
      setShowUploadModal(true);
    } catch (error) {
      updateProcess('upload', 'error', 0);
      console.error('Upload failed:', error);
      
      // Show error alert
      alert(`Upload failed: ${error.response?.data?.error || error.message}`);
    }
  };

  const handleGenerateLetters = async () => {
    updateProcess('generate', 'running', 0);
    
    try {
      await arrearsAPI.generateLetters(productType);
      // Show completion modal when generation actually completes
      updateProcess('generate', 'completed', 100, 'Letters generated successfully', {}, true);
      setCurrentStep(3);
      // Refresh status to get updated stats
      setTimeout(() => checkWorkflowStatus(true), 1000);
    } catch (error) {
      updateProcess('generate', 'error', 0);
      console.error('Letter generation failed:', error);
    }
  };

  const handleMergeLetters = async () => {
    updateProcess('merge', 'running', 0);
    
    try {
      await arrearsAPI.mergeLetters(productType);
      // Show completion modal when merge actually completes
      updateProcess('merge', 'completed', 100, 'Letters merged successfully', {}, true);
      setCurrentStep(4);
      // Refresh files and status
      setTimeout(() => {
        loadFiles();
        checkWorkflowStatus(true);
      }, 1000);
    } catch (error) {
      updateProcess('merge', 'error', 0);
      console.error('Letter merging failed:', error);
    }
  };

  const handleSendEmails = () => {
    // Show confirmation modal instead of directly sending
    setEmailConfirmText('');
    setShowEmailConfirmModal(true);
  };

  const handleEmailConfirmCancel = () => {
    setShowEmailConfirmModal(false);
    setEmailConfirmText('');
  };

  const handleEmailConfirmSend = async () => {
    if (emailConfirmText.trim() === requiredEmailText) {
      setShowEmailConfirmModal(false);
      setEmailConfirmText('');
      
      updateProcess('email', 'running', 0);
      
      try {
        await arrearsAPI.sendEmails({ recoveryTypes: ['all'] });
        updateProcess('email', 'completed', 100);
      } catch (error) {
        updateProcess('email', 'error', 0);
        console.error('Email sending failed:', error);
      }
    }
  };

  // Load files list
  const loadFiles = async () => {
    if (!productType) return;
    
    setFilesLoading(true);
    try {
      const response = await arrearsAPI.getFiles(productType);
      setFiles(response.data);
    } catch (error) {
      console.error('Failed to load files:', error);
    } finally {
      setFilesLoading(false);
    }
  };

  // Handle file downloads
  const handleDownloadIndividual = (type, filename) => {
    arrearsAPI.downloadIndividual(type, filename, productType);
  };

  const handleDownloadMerged = (type, filename) => {
    arrearsAPI.downloadMerged(type, filename, productType);
  };

  const handleDownloadAllIndividual = (type) => {
    arrearsAPI.downloadAllIndividual(type, productType);
  };

  // Upload modal handlers
  const handleUploadConfirm = () => {
    if (uploadModalData) {
      setUploadedFile(uploadModalData.file);
      setRecordCount(uploadModalData.recordCount);
      setRecoveryDistribution(uploadModalData.recoveryDistribution);
      updateProcess('upload', 'completed', 100);
      setCurrentStep(2);
    }
    setShowUploadModal(false);
    setUploadModalData(null);
  };

  const handleUploadCancel = () => {
    updateProcess('upload', 'pending', 0);
    setShowUploadModal(false);
    setUploadModalData(null);
  };

  // Reset/Clear workflow
  const handleResetWorkflow = async (showConfirm = true) => {
    const doReset = async () => {
      try {
        // Call backend reset API if product type is selected
        if (productType) {
          await arrearsAPI.resetWorkflow(productType);
        }
        
        // Reset all state
        setCurrentStep(1);
        setUploadedFile(null);
        setRecordCount(0);
        setRecoveryDistribution({});
        setProcesses({
          upload: { status: 'pending', progress: 0, message: '', details: {} },
          generate: { status: 'pending', progress: 0, message: '', details: {} },
          merge: { status: 'pending', progress: 0, message: '', details: {} },
          email: { status: 'pending', progress: 0, message: '', details: {} }
        });
        setRecoveryStats({
          L0: { individual: 0, merged: 0 },
          L1: { individual: 0, merged: 0 },
          L2: { individual: 0, merged: 0 },
          MED: { individual: 0, merged: 0 }
        });
        setFiles({
          individual: { L0: [], L1: [], L2: [], MED: [] },
          merged: { L0: [], L1: [], L2: [], MED: [] }
        });
        
        // Close any open modals
        setShowUploadModal(false);
        setShowGenerateCompleteModal(false);
        setShowMergeCompleteModal(false);
        setShowExistingDataNotice(false);
        setShowEmailConfirmModal(false);
        setShowProductConfirmModal(false);
        setUploadModalData(null);
        setCompletionData(null);
        setExistingDataInfo(null);
        setSelectedProductData(null);
        setEmailConfirmText('');
        
        // Reset the initial load flag so the modal can show again if needed
        setHasHandledInitialLoad(false);
        
        console.log('🔄 Workflow reset - starting fresh');
      } catch (error) {
        console.error('Reset failed:', error);
        alert('Failed to reset workflow. Please try again.');
      }
    };

    if (showConfirm) {
      if (window.confirm('Are you sure you want to clear all progress and start fresh? This will reset all steps and remove generated files.')) {
        await doReset();
      }
    } else {
      await doReset();
    }
  };

  // Existing data handlers
  const handleResumeExistingWork = () => {
    if (existingDataInfo) {
      checkWorkflowStatus(true); // Auto-load the existing status
      setShowExistingDataNotice(false);
      setExistingDataInfo(null);
    }
  };

  const handleStartFresh = () => {
    setShowExistingDataNotice(false);
    setExistingDataInfo(null);
    // Keep the clean state (don't load existing data)
  };

  // Helper function to count total individual PDFs
  const getTotalIndividualPDFs = () => {
    return Object.values(recoveryStats).reduce((total, stats) => total + stats.individual, 0);
  };

  const getTotalMergedPDFs = () => {
    return Object.values(recoveryStats).reduce((total, stats) => total + stats.merged, 0);
  };

  // Recovery type configurations
  const recoveryTypeConfig = {
    L0: { name: 'Level 0', color: '#f59e0b', description: 'Initial Notice' },
    L1: { name: 'Level 1', color: '#f97316', description: 'First Reminder' },
    L2: { name: 'Level 2', color: '#dc2626', description: 'Final Notice' },
    MED: { name: 'Legal (MED)', color: '#991b1b', description: 'Mise en Demeure' }
  };

  // Product type configurations
  const productTypeConfig = {
    health: {
      name: 'Health Insurance',
      inputFile: 'Extracted_Arrears_Data.xlsx',
      color: '#059669',
      icon: '🏥',
      description: 'Health insurance arrears processing'
    },
    nonmotor: {
      name: 'Non-Motors Insurance',
      inputFile: 'NonMotor_Arrears.xlsx',
      color: '#dc2626',
      icon: '🛡️',
      description: 'Non-motor insurance arrears processing'
    }
  };

  // Product type selection handlers
  const handleProductTypeSelect = (type) => {
    const config = productTypeConfig[type];
    setSelectedProductData({
      type,
      config
    });
    setShowProductConfirmModal(true);
  };

  const handleProductConfirm = () => {
    if (selectedProductData) {
      setProductType(selectedProductData.type);
      setShowProductConfirmModal(false);
      setSelectedProductData(null);
      // Reset workflow when changing product type
      handleResetWorkflow(false); // Don't show confirmation for product type change
    }
  };

  const handleProductCancel = () => {
    setShowProductConfirmModal(false);
    setSelectedProductData(null);
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
            <button 
              onClick={handleResetWorkflow} 
              className="btn btn-secondary"
              title="Clear all progress and start fresh"
            >
              <X size={16} />
              Reset
            </button>
            <button onClick={onLogout} className="btn btn-secondary">
              <LogOut size={16} />
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* Product Type Selection */}
      {!productType && (
        <div className="card" style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
            <AlertTriangle size={24} style={{ color: 'var(--primary-color)' }} />
            <div>
              <h3 style={{ margin: 0, color: 'var(--primary-color)' }}>Select Product Type</h3>
              <p style={{ margin: 0, color: '#6b7280' }}>Choose the insurance product type for arrears processing</p>
            </div>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
            {Object.entries(productTypeConfig).map(([type, config]) => (
              <div
                key={type}
                onClick={() => handleProductTypeSelect(type)}
                style={{
                  padding: '20px',
                  border: `2px solid ${config.color}30`,
                  borderRadius: '12px',
                  background: `${config.color}08`,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  ':hover': {
                    borderColor: `${config.color}60`,
                    background: `${config.color}15`
                  }
                }}
                onMouseEnter={(e) => {
                  e.target.style.borderColor = `${config.color}60`;
                  e.target.style.background = `${config.color}15`;
                }}
                onMouseLeave={(e) => {
                  e.target.style.borderColor = `${config.color}30`;
                  e.target.style.background = `${config.color}08`;
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                  <span style={{ fontSize: '32px' }}>{config.icon}</span>
                  <div>
                    <h4 style={{ margin: 0, color: config.color, fontSize: '18px' }}>{config.name}</h4>
                    <p style={{ margin: '4px 0 0 0', color: '#6b7280', fontSize: '14px' }}>{config.description}</p>
                  </div>
                </div>
                <div style={{ 
                  padding: '8px 12px', 
                  background: `${config.color}20`, 
                  borderRadius: '6px',
                  fontSize: '12px',
                  color: config.color,
                  fontWeight: '500'
                }}>
                  Expected file: {config.inputFile}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Selected Product Type Banner */}
      {productType && (
        <div className="card" style={{ 
          marginBottom: '24px',
          background: `linear-gradient(135deg, ${productTypeConfig[productType].color}15, ${productTypeConfig[productType].color}25)`,
          border: `2px solid ${productTypeConfig[productType].color}40`
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '24px' }}>{productTypeConfig[productType].icon}</span>
              <div>
                <h3 style={{ margin: 0, color: productTypeConfig[productType].color }}>
                  {productTypeConfig[productType].name} - Arrears Processing
                </h3>
                <p style={{ margin: '4px 0 0 0', color: '#6b7280', fontSize: '14px' }}>
                  Input file: {productTypeConfig[productType].inputFile}
                </p>
              </div>
            </div>
            <button 
              onClick={() => {
                setProductType('');
                handleResetWorkflow(false);
              }}
              className="btn btn-secondary"
              style={{ fontSize: '12px', padding: '6px 12px' }}
            >
              Change Product Type
            </button>
          </div>
        </div>
      )}

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
            expectedFileName={productType ? productTypeConfig[productType].inputFile : "Please select product type first"}
            disabled={processes.upload.status === 'running' || !productType}
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
          
          {/* Enhanced Progress Display with Stopwatch */}
          {processes.generate.status === 'running' && (
            <div style={{ 
              marginBottom: '16px', 
              padding: '16px', 
              background: '#f0f9ff', 
              borderRadius: '8px',
              border: '1px solid #bfdbfe'
            }}>
              {/* Stopwatch Display */}
              <div style={{ 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center', 
                marginBottom: '12px',
                padding: '8px',
                background: '#1e40af',
                borderRadius: '6px',
                color: 'white'
              }}>
                <Clock size={20} style={{ marginRight: '8px' }} />
                <span style={{ 
                  fontSize: '24px', 
                  fontWeight: 'bold', 
                  fontFamily: 'monospace',
                  letterSpacing: '2px'
                }}>
                  {processes.generate.details?.elapsed || '00:00'}
                </span>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '14px', fontWeight: '500', color: '#1e40af' }}>
                  {processes.generate.message || 'Generating letters...'}
                </span>
                <span style={{ fontSize: '12px', color: '#6b7280' }}>
                  {processes.generate.progress}%
                </span>
              </div>
              
              {/* Estimated Time */}
              <div style={{ 
                fontSize: '12px', 
                color: '#6b7280', 
                textAlign: 'center',
                fontStyle: 'italic'
              }}>
                Estimated time: 10-20 minutes for large files
              </div>
            </div>
          )}
          
          <button 
            onClick={handleGenerateLetters}
            className="btn btn-primary"
            disabled={
              currentStep < 2 || 
              processes.generate.status === 'running' || 
              (processes.generate.status === 'completed' && getTotalIndividualPDFs() > 0) ||
              processes.merge.status === 'running'
            }
          >
            {processes.generate.status === 'running' ? 'Generating PDFs...' : 
             (processes.generate.status === 'completed' && getTotalIndividualPDFs() > 0) ? 'PDFs Generated ✓' : 
             'Start PDF Generation'}
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
          
          {/* Enhanced Progress Display with Stopwatch for Merge */}
          {processes.merge.status === 'running' && (
            <div style={{ 
              marginBottom: '16px', 
              padding: '16px', 
              background: '#f0fdf4', 
              borderRadius: '8px',
              border: '1px solid #bbf7d0'
            }}>
              {/* Stopwatch Display */}
              <div style={{ 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center', 
                marginBottom: '12px',
                padding: '8px',
                background: '#16a34a',
                borderRadius: '6px',
                color: 'white'
              }}>
                <Clock size={20} style={{ marginRight: '8px' }} />
                <span style={{ 
                  fontSize: '24px', 
                  fontWeight: 'bold', 
                  fontFamily: 'monospace',
                  letterSpacing: '2px'
                }}>
                  {processes.merge.details?.elapsed || '00:00'}
                </span>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '14px', fontWeight: '500', color: '#16a34a' }}>
                  {processes.merge.message || 'Merging PDFs...'}
                </span>
                <span style={{ fontSize: '12px', color: '#6b7280' }}>
                  {processes.merge.progress}%
                </span>
              </div>
              
              {/* Estimated Time */}
              <div style={{ 
                fontSize: '12px', 
                color: '#6b7280', 
                textAlign: 'center',
                fontStyle: 'italic'
              }}>
                Estimated time: 3-5 minutes for large files
              </div>
            </div>
          )}
          
          <button 
            onClick={handleMergeLetters}
            className="btn btn-primary"
            disabled={
              currentStep < 3 || 
              getTotalIndividualPDFs() === 0 ||
              processes.merge.status === 'running' || 
              (processes.merge.status === 'completed' && getTotalMergedPDFs() > 0) ||
              processes.generate.status === 'running'
            }
          >
            {processes.merge.status === 'running' ? 'Merging PDFs...' : 
             (processes.merge.status === 'completed' && getTotalMergedPDFs() > 0) ? 'PDFs Merged ✓' : 
             'Start PDF Merge'}
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

      {/* Upload Confirmation Modal */}
      {showUploadModal && uploadModalData && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '500px',
            width: '90%',
            maxHeight: '80vh',
            overflow: 'auto',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
          }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
              <CheckCircle size={32} style={{ color: '#16a34a' }} />
              <div>
                <h3 style={{ margin: 0, color: '#16a34a', fontSize: '20px' }}>Upload Successful!</h3>
                <p style={{ margin: '4px 0 0 0', color: '#6b7280', fontSize: '14px' }}>
                  {uploadModalData.file.name}
                </p>
              </div>
            </div>

            {/* Upload Statistics */}
            <div style={{ marginBottom: '24px' }}>
              <div style={{ 
                padding: '16px', 
                background: '#f0fdf4', 
                borderRadius: '8px',
                border: '1px solid #bbf7d0',
                marginBottom: '16px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <BarChart3 size={20} style={{ color: '#16a34a' }} />
                  <span style={{ fontWeight: '600', color: '#16a34a' }}>
                    Total Records: {uploadModalData.recordCount.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Recovery Distribution */}
              <h4 style={{ margin: '0 0 12px 0', color: 'var(--primary-color)' }}>Recovery Action Distribution:</h4>
              <div style={{ display: 'grid', gap: '8px' }}>
                {Object.entries(uploadModalData.recoveryDistribution).map(([type, count]) => {
                  const config = recoveryTypeConfig[type] || { name: type, color: '#6b7280', description: 'Other' };
                  return (
                    <div key={type} style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px 12px',
                      background: `${config.color}15`,
                      borderRadius: '6px',
                      border: `1px solid ${config.color}30`
                    }}>
                      <span style={{ color: config.color, fontWeight: '500' }}>
                        {config.name} ({config.description})
                      </span>
                      <span style={{ color: config.color, fontWeight: '600' }}>
                        {count.toLocaleString()}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Confirmation Message */}
            <div style={{ 
              padding: '12px', 
              background: '#fffbeb', 
              borderRadius: '6px',
              border: '1px solid #fed7aa',
              marginBottom: '24px'
            }}>
              <p style={{ margin: 0, color: '#92400e', fontSize: '14px' }}>
                Click <strong>Proceed</strong> to continue with letter generation, or <strong>Cancel</strong> to upload a different file.
              </p>
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={handleUploadCancel}
                className="btn btn-secondary"
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <X size={16} />
                Cancel
              </button>
              <button
                onClick={handleUploadConfirm}
                className="btn btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <CheckCircle size={16} />
                Proceed
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Generate Complete Modal */}
      {showGenerateCompleteModal && completionData && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '450px',
            width: '90%',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
          }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
              <CheckCircle size={32} style={{ color: '#16a34a' }} />
              <div>
                <h3 style={{ margin: 0, color: '#16a34a', fontSize: '20px' }}>Letters Generated!</h3>
                <p style={{ margin: '4px 0 0 0', color: '#6b7280', fontSize: '14px' }}>
                  PDF generation completed successfully
                </p>
              </div>
            </div>

            {/* Completion Message */}
            <div style={{ 
              padding: '16px', 
              background: '#f0fdf4', 
              borderRadius: '8px',
              border: '1px solid #bbf7d0',
              marginBottom: '20px'
            }}>
              <p style={{ margin: 0, color: '#16a34a', fontSize: '14px', textAlign: 'center' }}>
                {completionData.message}
              </p>
            </div>

            {/* Next Steps */}
            <div style={{ 
              padding: '12px', 
              background: '#fffbeb', 
              borderRadius: '6px',
              border: '1px solid #fed7aa',
              marginBottom: '24px'
            }}>
              <p style={{ margin: 0, color: '#92400e', fontSize: '14px' }}>
                <strong>Next Step:</strong> You can now merge the letters by recovery type for batch printing.
              </p>
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowGenerateCompleteModal(false);
                  setTimeout(() => checkWorkflowStatus(true), 500);
                }}
                className="btn btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <CheckCircle size={16} />
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Merge Complete Modal */}
      {showMergeCompleteModal && completionData && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '450px',
            width: '90%',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
          }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
              <CheckCircle size={32} style={{ color: '#16a34a' }} />
              <div>
                <h3 style={{ margin: 0, color: '#16a34a', fontSize: '20px' }}>Letters Merged!</h3>
                <p style={{ margin: '4px 0 0 0', color: '#6b7280', fontSize: '14px' }}>
                  PDF merging completed successfully
                </p>
              </div>
            </div>

            {/* Completion Message */}
            <div style={{ 
              padding: '16px', 
              background: '#f0fdf4', 
              borderRadius: '8px',
              border: '1px solid #bbf7d0',
              marginBottom: '20px'
            }}>
              <p style={{ margin: 0, color: '#16a34a', fontSize: '14px', textAlign: 'center' }}>
                {completionData.message}
              </p>
            </div>

            {/* Next Steps */}
            <div style={{ 
              padding: '12px', 
              background: '#fffbeb', 
              borderRadius: '6px',
              border: '1px solid #fed7aa',
              marginBottom: '24px'
            }}>
              <p style={{ margin: 0, color: '#92400e', fontSize: '14px' }}>
                <strong>Ready for Download:</strong> Your merged PDFs are now available for download and printing.
              </p>
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowMergeCompleteModal(false);
                  setTimeout(() => {
                    loadFiles();
                    checkWorkflowStatus(true);
                  }, 500);
                }}
                className="btn btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <CheckCircle size={16} />
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Existing Data Notice Modal */}
      {showExistingDataNotice && existingDataInfo && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '500px',
            width: '90%',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
          }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
              <AlertTriangle size={32} style={{ color: '#f59e0b' }} />
              <div>
                <h3 style={{ margin: 0, color: '#f59e0b', fontSize: '20px' }}>Existing Work Found</h3>
                <p style={{ margin: '4px 0 0 0', color: '#6b7280', fontSize: '14px' }}>
                  Previous workflow data detected
                </p>
              </div>
            </div>

            {/* Existing Data Summary */}
            <div style={{ 
              padding: '16px', 
              background: '#fffbeb', 
              borderRadius: '8px',
              border: '1px solid #fed7aa',
              marginBottom: '20px'
            }}>
              <p style={{ margin: '0 0 8px 0', color: '#92400e', fontSize: '14px', fontWeight: '500' }}>
                Found previous work:
              </p>
              <ul style={{ margin: 0, paddingLeft: '20px', color: '#92400e', fontSize: '14px' }}>
                {existingDataInfo.upload && <li>✅ Excel file uploaded</li>}
                {existingDataInfo.generate && <li>✅ Letters generated</li>}
                {existingDataInfo.merge && <li>✅ Letters merged</li>}
              </ul>
            </div>

            {/* Options */}
            <div style={{ 
              padding: '12px', 
              background: '#f0f9ff', 
              borderRadius: '6px',
              border: '1px solid #bfdbfe',
              marginBottom: '24px'
            }}>
              <p style={{ margin: 0, color: '#1e40af', fontSize: '14px' }}>
                Would you like to <strong>resume</strong> your previous work or <strong>start fresh</strong>?
              </p>
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={handleStartFresh}
                className="btn btn-secondary"
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <X size={16} />
                Start Fresh
              </button>
              <button
                onClick={handleResumeExistingWork}
                className="btn btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <CheckCircle size={16} />
                Resume Work
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Email Confirmation Modal */}
      {showEmailConfirmModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '500px',
            width: '90%',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
          }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
              <AlertTriangle size={32} style={{ color: '#dc2626' }} />
              <div>
                <h3 style={{ margin: 0, color: '#dc2626', fontSize: '20px' }}>Confirm Email Sending</h3>
                <p style={{ margin: '4px 0 0 0', color: '#6b7280', fontSize: '14px' }}>
                  This action will send emails to customers
                </p>
              </div>
            </div>

            {/* Warning Message */}
            <div style={{ 
              padding: '16px', 
              background: '#fef2f2', 
              borderRadius: '8px',
              border: '1px solid #fecaca',
              marginBottom: '20px'
            }}>
              <p style={{ margin: '0 0 8px 0', color: '#dc2626', fontSize: '14px', fontWeight: '500' }}>
                ⚠️ WARNING: This will send arrears letters to customers via email.
              </p>
              <p style={{ margin: 0, color: '#dc2626', fontSize: '14px' }}>
                This action cannot be undone. Please ensure all letters are correct before proceeding.
              </p>
            </div>

            {/* Confirmation Input */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ 
                display: 'block', 
                marginBottom: '8px', 
                color: '#374151', 
                fontSize: '14px', 
                fontWeight: '500' 
              }}>
                To confirm, please type: <strong>"{requiredEmailText}"</strong>
              </label>
              <input
                type="text"
                value={emailConfirmText}
                onChange={(e) => setEmailConfirmText(e.target.value)}
                placeholder={requiredEmailText}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '2px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                  borderColor: emailConfirmText.trim() === requiredEmailText ? '#10b981' : '#d1d5db'
                }}
                autoFocus
              />
              {emailConfirmText.trim() !== '' && emailConfirmText.trim() !== requiredEmailText && (
                <p style={{ margin: '4px 0 0 0', color: '#dc2626', fontSize: '12px' }}>
                  Text does not match. Please type exactly: "{requiredEmailText}"
                </p>
              )}
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={handleEmailConfirmCancel}
                className="btn btn-secondary"
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <X size={16} />
                Cancel
              </button>
              <button
                onClick={handleEmailConfirmSend}
                className="btn btn-primary"
                disabled={emailConfirmText.trim() !== requiredEmailText}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '6px',
                  opacity: emailConfirmText.trim() !== requiredEmailText ? 0.5 : 1
                }}
              >
                <Mail size={16} />
                Send Emails
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Product Type Confirmation Modal */}
      {showProductConfirmModal && selectedProductData && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '500px',
            width: '90%',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
          }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
              <span style={{ fontSize: '32px' }}>{selectedProductData.config.icon}</span>
              <div>
                <h3 style={{ margin: 0, color: selectedProductData.config.color, fontSize: '20px' }}>
                  Confirm Product Selection
                </h3>
                <p style={{ margin: '4px 0 0 0', color: '#6b7280', fontSize: '14px' }}>
                  {selectedProductData.config.name}
                </p>
              </div>
            </div>

            {/* Product Details */}
            <div style={{ 
              padding: '16px', 
              background: `${selectedProductData.config.color}10`, 
              borderRadius: '8px',
              border: `1px solid ${selectedProductData.config.color}30`,
              marginBottom: '20px'
            }}>
              <div style={{ marginBottom: '12px' }}>
                <span style={{ fontWeight: '500', color: selectedProductData.config.color }}>Product Type:</span>
                <span style={{ marginLeft: '8px', color: '#374151' }}>{selectedProductData.config.name}</span>
              </div>
              <div style={{ marginBottom: '12px' }}>
                <span style={{ fontWeight: '500', color: selectedProductData.config.color }}>Expected Input File:</span>
                <span style={{ marginLeft: '8px', color: '#374151', fontFamily: 'monospace' }}>
                  {selectedProductData.config.inputFile}
                </span>
              </div>
              <div>
                <span style={{ fontWeight: '500', color: selectedProductData.config.color }}>Description:</span>
                <span style={{ marginLeft: '8px', color: '#374151' }}>{selectedProductData.config.description}</span>
              </div>
            </div>

            {/* Confirmation Message */}
            <div style={{ 
              padding: '12px', 
              background: '#fffbeb', 
              borderRadius: '6px',
              border: '1px solid #fed7aa',
              marginBottom: '24px'
            }}>
              <p style={{ margin: 0, color: '#92400e', fontSize: '14px' }}>
                This will configure the system for <strong>{selectedProductData.config.name}</strong> arrears processing. 
                Make sure you have the correct input file ready.
              </p>
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={handleProductCancel}
                className="btn btn-secondary"
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <X size={16} />
                Cancel
              </button>
              <button
                onClick={handleProductConfirm}
                className="btn btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <CheckCircle size={16} />
                Confirm Selection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ArrearsDashboard;