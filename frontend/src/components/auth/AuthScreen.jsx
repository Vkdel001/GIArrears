import React, { useState } from 'react';
import { Mail, Lock, Shield, AlertCircle } from 'lucide-react';
import { detectTeam, getTeamConfig } from '../../config/auth';
import { authAPI } from '../../services/api';

const AuthScreen = ({ onLogin }) => {
  const [step, setStep] = useState('email'); // 'email', 'otp', 'password'
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [team, setTeam] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    const detectedTeam = detectTeam(email);
    if (!detectedTeam) {
      setError('Email not authorized for any team');
      return;
    }

    setTeam(detectedTeam);
    setLoading(true);

    try {
      const response = await authAPI.sendOTP(email);
      console.log('OTP Response:', response.data);
      setStep('otp');
    } catch (error) {
      console.error('OTP Error:', error);
      if (error.code === 'ERR_NETWORK') {
        setError('Cannot connect to server. Please ensure backend is running on port 3001.');
      } else {
        setError(error.response?.data?.error || 'Failed to send OTP. Please check if backend is running.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOTPSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await authAPI.verifyOTP(email, otp);
      onLogin(email, response.data.team);
    } catch (error) {
      setError(error.response?.data?.error || 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await authAPI.passwordLogin(email, password);
      onLogin(email, response.data.team);
    } catch (error) {
      setError(error.response?.data?.error || 'Invalid password');
    } finally {
      setLoading(false);
    }
  };

  const teamConfig = team ? getTeamConfig(team) : null;

  return (
    <div className={teamConfig?.theme || ''}>
      <div className="container">
        <div className="card" style={{ maxWidth: '400px', margin: '100px auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '30px' }}>
            <Shield size={48} style={{ color: 'var(--primary-color, #3b82f6)', marginBottom: '16px' }} />
            <h1 style={{ marginBottom: '8px' }}>NICL Renewal System</h1>
            {teamConfig && (
              <p style={{ color: 'var(--primary-color)', fontWeight: '600' }}>
                {teamConfig.teamName}
              </p>
            )}
          </div>

          {error && (
            <div style={{ 
              background: '#fef2f2', 
              border: '1px solid #fecaca', 
              borderRadius: '8px', 
              padding: '12px', 
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: '#dc2626'
            }}>
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          {step === 'email' && (
            <form onSubmit={handleEmailSubmit}>
              <div className="form-group">
                <label className="form-label">
                  <Mail size={16} style={{ display: 'inline', marginRight: '8px' }} />
                  Email Address
                </label>
                <input
                  type="email"
                  className="form-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  required
                />
              </div>
              <button 
                type="submit" 
                className="btn btn-primary" 
                style={{ 
                  width: '100%', 
                  marginTop: '16px',
                  padding: '12px',
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer'
                }} 
                disabled={loading}
              >
                {loading ? 'Sending OTP...' : 'Send OTP'}
              </button>
            </form>
          )}

          {step === 'otp' && (
            <div>
              <p style={{ marginBottom: '20px', textAlign: 'center' }}>
                OTP sent to <strong>{email}</strong>
              </p>
              <form onSubmit={handleOTPSubmit}>
                <div className="form-group">
                  <label className="form-label">Enter OTP</label>
                  <input
                    type="text"
                    className="form-input"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    placeholder="Enter 6-digit OTP"
                    maxLength={6}
                    required
                  />
                </div>
                <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
                  {loading ? 'Verifying...' : 'Verify OTP'}
                </button>
              </form>
              
              <div style={{ textAlign: 'center', margin: '20px 0' }}>
                <span style={{ color: '#6b7280' }}>or</span>
              </div>
              
              <button 
                onClick={() => setStep('password')} 
                className="btn btn-secondary" 
                style={{ width: '100%' }}
              >
                <Lock size={16} />
                Use Super Password
              </button>
            </div>
          )}

          {step === 'password' && (
            <div>
              <form onSubmit={handlePasswordSubmit}>
                <div className="form-group">
                  <label className="form-label">
                    <Lock size={16} style={{ display: 'inline', marginRight: '8px' }} />
                    Super Password
                  </label>
                  <input
                    type="password"
                    className="form-input"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter super password"
                    required
                  />
                </div>
                <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
                  {loading ? 'Verifying...' : 'Login'}
                </button>
              </form>
              
              <button 
                onClick={() => setStep('otp')} 
                className="btn btn-secondary" 
                style={{ width: '100%', marginTop: '12px' }}
              >
                Back to OTP
              </button>
            </div>
          )}

          {step !== 'email' && (
            <button 
              onClick={() => {
                setStep('email');
                setTeam(null);
                setError('');
              }} 
              style={{ 
                background: 'none', 
                border: 'none', 
                color: 'var(--primary-color)', 
                cursor: 'pointer',
                marginTop: '16px',
                width: '100%'
              }}
            >
              ← Change Email
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthScreen;