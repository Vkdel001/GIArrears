import React, { useRef, useState } from 'react';
import { Upload, File, AlertCircle } from 'lucide-react';

const FileUpload = ({ onFileSelect, acceptedTypes, expectedFileName, disabled }) => {
  const fileInputRef = useRef(null);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState('');

  const handleFiles = (files) => {
    const file = files[0];
    if (!file) return;

    setError('');

    // Check file type
    const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
    if (acceptedTypes && !acceptedTypes.includes(fileExtension)) {
      setError(`Please select a valid file type: ${acceptedTypes}`);
      return;
    }

    // Check expected filename (optional)
    if (expectedFileName && file.name !== expectedFileName) {
      setError(`Expected filename: ${expectedFileName}`);
      // Don't return here - allow different filenames but show warning
    }

    onFileSelect(file);
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (disabled) return;
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleChange = (e) => {
    e.preventDefault();
    if (disabled) return;
    
    if (e.target.files && e.target.files[0]) {
      handleFiles(e.target.files);
    }
  };

  const onButtonClick = () => {
    if (disabled) return;
    fileInputRef.current?.click();
  };

  return (
    <div>
      <div
        className={`file-upload-area ${dragActive ? 'drag-active' : ''} ${disabled ? 'disabled' : ''}`}
        style={{
          border: `2px dashed ${dragActive ? 'var(--primary-color)' : '#d1d5db'}`,
          borderRadius: '12px',
          padding: '40px 20px',
          textAlign: 'center',
          backgroundColor: dragActive ? 'var(--bg-color)' : '#fafafa',
          cursor: disabled ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s',
          opacity: disabled ? 0.6 : 1
        }}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={onButtonClick}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={acceptedTypes}
          onChange={handleChange}
          style={{ display: 'none' }}
          disabled={disabled}
        />
        
        <Upload 
          size={48} 
          style={{ 
            color: dragActive ? 'var(--primary-color)' : '#9ca3af',
            marginBottom: '16px'
          }} 
        />
        
        <h3 style={{ margin: '0 0 8px 0', color: '#374151' }}>
          {dragActive ? 'Drop file here' : 'Upload Excel File'}
        </h3>
        
        <p style={{ margin: '0 0 16px 0', color: '#6b7280' }}>
          Drag and drop your file here, or click to browse
        </p>
        
        {expectedFileName && (
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            gap: '8px',
            color: '#6b7280',
            fontSize: '14px'
          }}>
            <File size={16} />
            Expected: {expectedFileName}
          </div>
        )}
        
        {acceptedTypes && (
          <p style={{ margin: '8px 0 0 0', fontSize: '12px', color: '#9ca3af' }}>
            Accepted formats: {acceptedTypes}
          </p>
        )}
      </div>

      {error && (
        <div style={{ 
          marginTop: '12px',
          padding: '12px',
          background: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          color: '#dc2626'
        }}>
          <AlertCircle size={16} />
          {error}
        </div>
      )}
    </div>
  );
};

export default FileUpload;