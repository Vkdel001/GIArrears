export const AUTH_CONFIG = {
  motor: {
    authorizedEmails: ["sakay@nicl.mu", "vikas.khanna@zwennpay.com"],
    superPassword: "NICLMOTOR@2025",
    teamName: "Motor Insurance Team",
    theme: "motor-theme"
  },
  health: {
    authorizedEmails: ["mjugun@nicl.mu", "sheeralall@nicl.mu", "vikas.khanna@zwennpay.com"],
    superPassword: "NICLHEALTH@2025", 
    teamName: "Health Insurance Team",
    theme: "health-theme"
  },
  arrears: {
    authorizedEmails: ["collections@nicl.mu", "giarrearsrecovery@nicl.mu", "vikas.khanna@zwennpay.com"],
    superPassword: "NICLARREARS@2025",
    teamName: "Collections & Arrears Team", 
    theme: "arrears-theme"
  }
};

export const detectTeam = (email) => {
  if (AUTH_CONFIG.motor.authorizedEmails.includes(email)) {
    return 'motor';
  }
  if (AUTH_CONFIG.health.authorizedEmails.includes(email)) {
    return 'health';
  }
  if (AUTH_CONFIG.arrears.authorizedEmails.includes(email)) {
    return 'arrears';
  }
  return null;
};

export const getTeamConfig = (team) => {
  return AUTH_CONFIG[team] || null;
};