import React from 'react';
import { CheckCircle, AlertCircle, Clock, Play } from 'lucide-react';

const ProcessStep = ({ 
  stepNumber, 
  title, 
  description, 
  icon, 
  status, 
  progress, 
  isActive, 
  isCompleted, 
  disabled, 
  children 
}) => {
  const getStatusIcon = () => {
    switch (status) {
      case 'completed':
        return <CheckCircle size={20} style={{ color: '#10b981' }} />;
      case 'processing':
      case 'running':
        return <Clock size={20} style={{ color: '#3b82f6' }} />;
      case 'error':
        return <AlertCircle size={20} style={{ color: '#ef4444' }} />;
      default:
        return isActive ? <Play size={20} style={{ color: 'var(--primary-color)' }} /> : null;
    }
  };

  const getStatusColor = () => {
    if (disabled) return '#e5e7eb';
    switch (status) {
      case 'completed':
        return '#10b981';
      case 'processing':
      case 'running':
        return '#3b82f6';
      case 'error':
        return '#ef4444';
      default:
        return isActive ? 'var(--primary-color)' : '#9ca3af';
    }
  };

  const getBorderColor = () => {
    if (disabled) return '#f3f4f6';
    if (isActive) return 'var(--primary-color)';
    if (isCompleted) return '#10b981';
    return '#e5e7eb';
  };

  return (
    <div 
      className="card"
      style={{
        border: `2px solid ${getBorderColor()}`,
        opacity: disabled ? 0.6 : 1,
        transition: 'all 0.2s'
      }}
    >
      {/* Step Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
        <div 
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            backgroundColor: getStatusColor(),
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 'bold',
            fontSize: '18px'
          }}
        >
          {status === 'completed' || status === 'processing' || status === 'error' ? 
            getStatusIcon() : stepNumber
          }
        </div>
        
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
            {icon}
            <h3 style={{ margin: 0, color: getStatusColor() }}>{title}</h3>
            {getStatusIcon()}
          </div>
          <p style={{ margin: 0, color: '#6b7280' }}>{description}</p>
        </div>
      </div>

      {/* Progress Bar */}
      {(status === 'processing' || status === 'running') && (
        <div style={{ marginBottom: '20px' }}>
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${progress}%` }}
            />
          </div>
          <p style={{ margin: '8px 0 0 0', fontSize: '14px', color: '#6b7280' }}>
            {progress}% complete
          </p>
        </div>
      )}

      {/* Step Content */}
      {(isActive || isCompleted) && !disabled && (
        <div>
          {children}
        </div>
      )}

      {/* Status Messages */}
      {status === 'completed' && (
        <div style={{ 
          marginTop: '16px',
          padding: '12px',
          background: '#f0fdf4',
          borderRadius: '8px',
          color: '#16a34a'
        }}>
          ✅ Step completed successfully
        </div>
      )}

      {status === 'error' && (
        <div style={{ 
          marginTop: '16px',
          padding: '12px',
          background: '#fef2f2',
          borderRadius: '8px',
          color: '#dc2626'
        }}>
          ❌ Step failed. Please try again or check the logs.
        </div>
      )}

      {disabled && (
        <div style={{ 
          marginTop: '16px',
          padding: '12px',
          background: '#f9fafb',
          borderRadius: '8px',
          color: '#6b7280'
        }}>
          Complete previous steps to unlock this step
        </div>
      )}
    </div>
  );
};

export default ProcessStep;