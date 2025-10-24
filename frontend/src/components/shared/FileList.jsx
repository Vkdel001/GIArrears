import React, { useState, useEffect } from 'react';
import { Download, File, Calendar, HardDrive, RefreshCw } from 'lucide-react';

const FileList = ({ 
  title, 
  files = [], 
  onDownload, 
  onDownloadAll,
  onRefresh, 
  isLoading = false,
  emptyMessage = "No files available",
  headerColor = 'var(--primary-color)'
}) => {
  const formatFileSize = (sizeInKB) => {
    if (sizeInKB < 1024) {
      return `${sizeInKB} KB`;
    }
    return `${(sizeInKB / 1024).toFixed(1)} MB`;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <h3 style={{ margin: 0, color: headerColor }}>{title}</h3>
        <div style={{ display: 'flex', gap: '8px' }}>
          {onDownloadAll && files.length > 0 && (
            <button
              onClick={onDownloadAll}
              className="btn btn-primary"
              style={{ padding: '8px 12px', fontSize: '14px' }}
            >
              <Download size={16} style={{ marginRight: '6px' }} />
              Download All
            </button>
          )}
          <button
            onClick={onRefresh}
            className="btn btn-secondary"
            disabled={isLoading}
            style={{ padding: '8px 12px', fontSize: '14px' }}
          >
            <RefreshCw size={16} style={{ marginRight: '6px' }} />
            {isLoading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </div>

      {files.length === 0 ? (
        <div style={{ 
          textAlign: 'center', 
          padding: '40px 20px', 
          color: '#6b7280',
          background: '#f9fafb',
          borderRadius: '8px',
          border: '2px dashed #e5e7eb'
        }}>
          <File size={48} style={{ margin: '0 auto 16px', opacity: 0.5 }} />
          <p style={{ margin: 0, fontSize: '16px' }}>{emptyMessage}</p>
        </div>
      ) : (
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '12px',
          maxHeight: '400px',  // Fixed height to prevent endless scrolling
          overflowY: 'auto',   // Add vertical scroll
          padding: '4px',      // Small padding for scroll area
          border: files.length > 5 ? '1px solid #e5e7eb' : 'none', // Border only when scrollable
          borderRadius: '8px'
        }}>
          {files.map((file, index) => (
            <div
              key={index}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px',
                background: '#f8f9fa',
                borderRadius: '8px',
                border: '1px solid #e5e7eb',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.target.style.background = '#f1f5f9';
                e.target.style.borderColor = 'var(--primary-color)';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = '#f8f9fa';
                e.target.style.borderColor = '#e5e7eb';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                <File size={20} style={{ color: 'var(--primary-color)' }} />
                <div>
                  <p style={{ 
                    margin: 0, 
                    fontWeight: '500', 
                    color: '#1f2937',
                    fontSize: '14px',
                    wordBreak: 'break-word'
                  }}>
                    {file.name}
                  </p>
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '16px', 
                    marginTop: '4px',
                    fontSize: '12px',
                    color: '#6b7280'
                  }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <HardDrive size={12} />
                      {formatFileSize(file.size)}
                    </span>
                    {file.modified && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Calendar size={12} />
                        {formatDate(file.modified)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              
              <button
                onClick={() => onDownload(file.name)}
                className="btn btn-primary"
                style={{ 
                  padding: '8px 16px',
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Download size={16} />
                Download
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FileList;