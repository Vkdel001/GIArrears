import React, { useState, useEffect } from 'react';
import AuthScreen from './components/auth/AuthScreen';
import MotorDashboard from './components/motor/MotorDashboard';
import HealthDashboard from './components/health/HealthDashboard';
import ArrearsDashboard from './components/arrears/ArrearsDashboard';
import { authAPI } from './services/api';
import { getTeamConfig } from './config/auth';

function App() {
  const [user, setUser] = useState(null);
  const [team, setTeam] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check for existing session on app load
  useEffect(() => {
    // Skip session check for now to avoid 401 spam
    setLoading(false);
  }, []);

  const handleLogin = (email, userTeam) => {
    setUser(email);
    setTeam(userTeam);
  };

  const handleLogout = async () => {
    try {
      await authAPI.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
      setTeam(null);
    }
  };

  if (loading) {
    return (
      <div className="container">
        <div className="card" style={{ textAlign: 'center', marginTop: '100px' }}>
          <h2>Loading...</h2>
        </div>
      </div>
    );
  }

  if (!user || !team) {
    return <AuthScreen onLogin={handleLogin} />;
  }

  const teamConfig = getTeamConfig(team);

  return (
    <div className={teamConfig.theme}>
      {team === 'motor' ? (
        <MotorDashboard user={user} onLogout={handleLogout} />
      ) : team === 'health' ? (
        <HealthDashboard user={user} onLogout={handleLogout} />
      ) : team === 'arrears' ? (
        <ArrearsDashboard user={user} onLogout={handleLogout} />
      ) : (
        <HealthDashboard user={user} onLogout={handleLogout} />
      )}
    </div>
  );
}

export default App;