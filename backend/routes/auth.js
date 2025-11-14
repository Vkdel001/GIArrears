import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import SibApiV3Sdk from '@getbrevo/brevo';

const router = express.Router();

// Team configuration
const AUTH_CONFIG = {
  motor: {
    authorizedEmails: ["sakay@nicl.mu", "vikas.khanna@zwennpay.com"],
    superPassword: "NICLMOTOR@2025",
    teamName: "Motor Insurance Team"
  },
  health: {
    authorizedEmails: ["mjugun@nicl.mu", "sheeralall@nicl.mu", "vikas.khanna@zwennpay.com"],
    superPassword: "NICLHEALTH@2025",
    teamName: "Health Insurance Team"
  },
  arrears: {
    authorizedEmails: ["collections@nicl.mu", "giarrearsrecovery@nicl.mu", "mraheeman@nicl.mu", "mhasgarally@nicl.mu", "vkdel001@gmail.com", "vikas.khanna@zwennpay.com"],
    superPassword: "NICG@2025",
    teamName: "Collections & Arrears Team"
  }
};

// In-memory OTP storage (use Redis in production)
const otpStore = new Map();

// Helper function to detect team from email
const detectTeam = (email) => {
  console.log(`🔍 Checking email: "${email}"`);
  console.log(`📋 Arrears authorized emails:`, AUTH_CONFIG.arrears.authorizedEmails);

  if (AUTH_CONFIG.motor.authorizedEmails.includes(email)) {
    console.log(`✅ Found in motor team`);
    return 'motor';
  }
  if (AUTH_CONFIG.health.authorizedEmails.includes(email)) {
    console.log(`✅ Found in health team`);
    return 'health';
  }
  if (AUTH_CONFIG.arrears.authorizedEmails.includes(email)) {
    console.log(`✅ Found in arrears team`);
    return 'arrears';
  }
  console.log(`❌ Email not found in any team`);
  return null;
};

// Configure Brevo API for OTP emails  
const initializeBrevoAPI = () => {
  // Simple initialization - API key will be passed in headers
  return new SibApiV3Sdk.TransactionalEmailsApi();
};

// Generate 6-digit OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Send OTP endpoint
router.post('/send-otp', async (req, res) => {
  try {
    console.log(`📧 OTP request received for email: "${req.body.email}"`);
    const { email } = req.body;

    if (!email) {
      console.log(`❌ No email provided`);
      return res.status(400).json({ error: 'Email is required' });
    }

    console.log(`🔍 Calling detectTeam for: "${email}"`);
    const team = detectTeam(email);
    console.log(`📋 detectTeam result: ${team}`);

    if (!team) {
      console.log(`❌ Email "${email}" not authorized for any team`);
      return res.status(403).json({ error: 'Email not authorized for any team' });
    }

    const otp = generateOTP();
    const otpId = uuidv4();

    // Store OTP with 10-minute expiration
    otpStore.set(email, {
      otp,
      otpId,
      team,
      expires: Date.now() + 10 * 60 * 1000 // 10 minutes
    });

    // Send OTP via Brevo (if API key is configured)
    if (process.env.BREVO_API_KEY) {
      console.log(`🔄 Attempting to send OTP via Brevo to ${email}`);
      try {
        const apiInstance = initializeBrevoAPI();

        const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();

        sendSmtpEmail.sender = {
          name: 'NICG Arrears OTP',
          email: 'noreply@niclmauritius.site'
        };

        sendSmtpEmail.to = [{
          email: email,
          name: email.split('@')[0]
        }];

        sendSmtpEmail.subject = `NICG Arrears OTP - Verification Code`;

        sendSmtpEmail.htmlContent = `
          <!DOCTYPE html>
          <html>
          <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>NICL OTP Verification</title>
          </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background: ${team === 'motor' ? '#1e40af' : team === 'health' ? '#059669' : '#dc2626'}; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
                  <h1 style="margin: 0; font-size: 24px;">NICG Arrears OTP</h1>
                  <p style="margin: 5px 0 0 0; opacity: 0.9;">NIC General Insurance Co. Ltd</p>
              </div>
              
              <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px;">
                  <h2 style="color: ${team === 'motor' ? '#1e40af' : team === 'health' ? '#059669' : '#dc2626'}; margin-top: 0;">OTP Verification</h2>
                  
                  <p>Hello,</p>
                  
                  <p>You have requested access to the <strong>${AUTH_CONFIG[team].teamName}</strong>.</p>
                  
                  <p>Your One-Time Password (OTP) is:</p>
                  
                  <div style="background: white; padding: 30px; text-align: center; margin: 20px 0; border-radius: 8px; border: 2px solid ${team === 'motor' ? '#1e40af' : team === 'health' ? '#059669' : '#dc2626'};">
                      <h1 style="color: ${team === 'motor' ? '#1e40af' : team === 'health' ? '#059669' : '#dc2626'}; font-size: 36px; margin: 0; letter-spacing: 8px; font-family: 'Courier New', monospace;">${otp}</h1>
                  </div>
                  
                  <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 6px; margin: 20px 0;">
                      <p style="margin: 0; color: #856404;"><strong>⏰ Important:</strong> This OTP will expire in <strong>10 minutes</strong>.</p>
                  </div>
                  
                  <p>If you didn't request this OTP, please ignore this email and contact our support team if you have concerns.</p>
                  
                  <div style="background: #e3f2fd; padding: 15px; border-radius: 6px; margin: 20px 0;">
                      <p style="margin: 0;"><strong>Need Help?</strong></p>
                      <p style="margin: 5px 0 0 0;">Contact our support team at <strong>602 3000</strong> or email <a href="mailto:support@nicl.mu" style="color: ${team === 'motor' ? '#1e40af' : team === 'health' ? '#059669' : '#dc2626'};">support@nicl.mu</a></p>
                  </div>
                  
                  <p style="margin-bottom: 0;">Best regards,<br>
                  <strong>NICL IT Team</strong></p>
              </div>
              
              <div style="text-align: center; padding: 20px; color: #666; font-size: 12px;">
                  <p>This is an automated security message. Please do not reply to this email.</p>
                  <p>© ${new Date().getFullYear()} National Insurance Company Limited. All rights reserved.</p>
              </div>
          </body>
          </html>
        `;

        sendSmtpEmail.textContent = `
NICG Arrears OTP - Verification Code

Hello,

You have requested access to the ${AUTH_CONFIG[team].teamName}.

Your One-Time Password (OTP) is: ${otp}

⏰ Important: This OTP will expire in 10 minutes.

If you didn't request this OTP, please ignore this email and contact our support team if you have concerns.

Need Help?
Contact our support team at 602 3000 or email support@nicl.mu

Best regards,
NICL IT Team

This is an automated security message. Please do not reply to this email.
        `.trim();

        const opts = {
          'headers': {
            'api-key': process.env.BREVO_API_KEY
          }
        };
        const result = await apiInstance.sendTransacEmail(sendSmtpEmail, opts);
        console.log(`📧 OTP sent via Brevo to ${email} for ${team} team`);
        console.log(`📊 Brevo Response:`, result.response?.statusCode || 'Success');
      } catch (emailError) {
        console.error('❌ Brevo email sending failed:', emailError.message);
        console.error('📋 Full error:', emailError.response?.data || emailError);
        // Continue without failing - OTP is still generated for development
      }
    } else {
      console.log('⚠️ No Brevo API key configured - OTP not sent via email');
    }

    // In development, log OTP to console
    if (process.env.NODE_ENV === 'development') {
      console.log(`🔑 OTP for ${email} (${team} team): ${otp}`);
    }

    res.json({
      success: true,
      message: 'OTP sent successfully',
      team,
      // In development, include OTP in response
      ...(process.env.NODE_ENV === 'development' && { otp })
    });

  } catch (error) {
    console.error('Send OTP error:', error);
    res.status(500).json({ error: 'Failed to send OTP' });
  }
});

// Verify OTP endpoint
router.post('/verify-otp', (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ error: 'Email and OTP are required' });
    }

    const storedData = otpStore.get(email);
    if (!storedData) {
      return res.status(400).json({ error: 'No OTP found for this email' });
    }

    if (Date.now() > storedData.expires) {
      otpStore.delete(email);
      return res.status(400).json({ error: 'OTP has expired' });
    }

    if (storedData.otp !== otp) {
      return res.status(400).json({ error: 'Invalid OTP' });
    }

    // OTP verified successfully
    otpStore.delete(email);

    // Set session
    req.session.user = email;
    req.session.team = storedData.team;
    req.session.loginTime = new Date().toISOString();

    console.log(`✅ User ${email} logged in to ${storedData.team} team`);

    res.json({
      success: true,
      team: storedData.team,
      user: email
    });

  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({ error: 'Failed to verify OTP' });
  }
});

// Password login endpoint
router.post('/password-login', (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const team = detectTeam(email);
    if (!team) {
      return res.status(403).json({ error: 'Email not authorized for any team' });
    }

    const correctPassword = AUTH_CONFIG[team].superPassword;
    if (password !== correctPassword) {
      return res.status(400).json({ error: 'Invalid password' });
    }

    // Set session
    req.session.user = email;
    req.session.team = team;
    req.session.loginTime = new Date().toISOString();

    console.log(`✅ User ${email} logged in to ${team} team via password`);

    res.json({
      success: true,
      team,
      user: email
    });

  } catch (error) {
    console.error('Password login error:', error);
    res.status(500).json({ error: 'Failed to login with password' });
  }
});

// Get session endpoint
router.get('/session', (req, res) => {
  if (req.session.user && req.session.team) {
    res.json({
      user: req.session.user,
      team: req.session.team,
      loginTime: req.session.loginTime
    });
  } else {
    res.status(401).json({ error: 'No active session' });
  }
});

// Logout endpoint
router.post('/logout', (req, res) => {
  const user = req.session.user;
  const team = req.session.team;

  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
      return res.status(500).json({ error: 'Failed to logout' });
    }

    console.log(`👋 User ${user} logged out from ${team} team`);
    res.json({ success: true, message: 'Logged out successfully' });
  });
});

export default router;