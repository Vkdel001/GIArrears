import SibApiV3Sdk from '@getbrevo/brevo';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import QRCode from 'qrcode';
import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Generate ZwennPay QR code for payment
 * @param {Object} recipient - Recipient details
 * @returns {Promise<string|null>} - Base64 QR code image or null if failed
 */
const generateZwennPayQR = async (recipient) => {
  try {
    console.log(`🔄 Generating ZwennPay QR for ${recipient.name} (${recipient.policyNo})`);

    // Extract mobile number (try to get from recipient data or use empty string)
    const mobileNo = recipient.mobile || recipient.phone || '';

    // Create customer label
    const customerLabel = recipient.name || 'Valued Customer';

    // API payload (same as L0.py)
    const payload = {
      "MerchantId": 153,
      "SetTransactionAmount": false,
      "TransactionAmount": 0,
      "SetConvenienceIndicatorTip": false,
      "ConvenienceIndicatorTip": 0,
      "SetConvenienceFeeFixed": false,
      "ConvenienceFeeFixed": 0,
      "SetConvenienceFeePercentage": false,
      "ConvenienceFeePercentage": 0,
      "SetAdditionalBillNumber": true,
      "AdditionalRequiredBillNumber": false,
      "AdditionalBillNumber": recipient.policyNo.replace(/\//g, '.'),
      "SetAdditionalMobileNo": true,
      "AdditionalRequiredMobileNo": false,
      "AdditionalMobileNo": mobileNo,
      "SetAdditionalStoreLabel": false,
      "AdditionalRequiredStoreLabel": false,
      "AdditionalStoreLabel": "",
      "SetAdditionalLoyaltyNumber": false,
      "AdditionalRequiredLoyaltyNumber": false,
      "AdditionalLoyaltyNumber": "",
      "SetAdditionalReferenceLabel": false,
      "AdditionalRequiredReferenceLabel": false,
      "AdditionalReferenceLabel": "",
      "SetAdditionalCustomerLabel": true,
      "AdditionalRequiredCustomerLabel": false,
      "AdditionalCustomerLabel": customerLabel,
      "SetAdditionalTerminalLabel": false,
      "AdditionalRequiredTerminalLabel": false,
      "AdditionalTerminalLabel": "",
      "SetAdditionalPurposeTransaction": true,
      "AdditionalRequiredPurposeTransaction": false,
      "AdditionalPurposeTransaction": "Arrears Payment"
    };

    // Call ZwennPay API
    const response = await fetch("https://api.zwennpay.com:9425/api/v1.0/Common/GetMerchantQR", {
      method: 'POST',
      headers: {
        "accept": "text/plain",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload),
      timeout: 20000
    });

    if (response.ok) {
      const qrData = (await response.text()).trim();

      if (qrData && qrData.toLowerCase() !== 'null' && qrData.toLowerCase() !== 'none') {
        // Generate QR code as base64 image
        const qrCodeDataURL = await QRCode.toDataURL(qrData, {
          errorCorrectionLevel: 'L',
          type: 'image/png',
          quality: 0.92,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          },
          width: 200
        });

        console.log(`✅ QR code generated successfully for ${recipient.name}`);
        return qrCodeDataURL;
      } else {
        console.log(`⚠️ No valid QR data received for ${recipient.name}`);
        return null;
      }
    } else {
      console.log(`❌ ZwennPay API request failed for ${recipient.name}: ${response.status}`);
      return null;
    }
  } catch (error) {
    console.error(`⚠️ Error generating QR for ${recipient.name}:`, error.message);
    return null;
  }
};

// Function to format currency amounts
const formatCurrency = (amount) => {
  try {
    console.log(`💰 Formatting currency: ${amount} (type: ${typeof amount})`);
    // Convert to number and round to nearest integer
    const numAmount = parseFloat(amount.toString().replace(/,/g, ''));
    const rounded = Math.round(numAmount);
    // Format with commas
    const formatted = rounded.toLocaleString();
    console.log(`💰 Formatted result: ${formatted}`);
    return formatted;
  } catch (error) {
    console.error(`💰 Currency formatting error:`, error);
    // Fallback: return original amount if formatting fails
    return amount;
  }
};

// Initialize Brevo API
let apiInstance;
try {
  // Check if we have the API key
  console.log('🔑 Checking Brevo API key...');
  if (!process.env.BREVO_API_KEY) {
    throw new Error('BREVO_API_KEY environment variable is not set');
  }
  console.log('🔑 Brevo API key found:', process.env.BREVO_API_KEY ? 'Yes' : 'No');

  // Initialize API client
  const defaultClient = SibApiV3Sdk.ApiClient.instance;
  if (defaultClient && defaultClient.authentications) {
    const apiKeyAuth = defaultClient.authentications['api-key'];
    apiKeyAuth.apiKey = process.env.BREVO_API_KEY;
    console.log('🔑 API key set in client');
  }

  apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
  console.log('✅ Brevo API initialized successfully');
} catch (error) {
  console.error('❌ Brevo API initialization error:', error);
  console.error('❌ Error details:', error.message);
  // Create a basic instance without authentication for now
  apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
}

// Team-specific sender configurations
const SENDER_CONFIG = {
  motor: {
    name: 'NICL Motor',
    email: 'motorinsurance@niclmauritius.site',
    replyTo: 'customerservice@nicl.mu'
  },
  health: {
    name: 'NICL Health',
    email: 'noreply@niclmauritius.site',
    replyTo: 'customerservice@nicl.mu'
  },
  arrears: {
    name: 'NICL Collections',
    email: 'collections@niclmauritius.site',
    replyTo: 'giarrearsrecovery@nicl.mu'
  }
};

/**
 * Send renewal emails with PDFs attached
 * @param {string} team - 'motor' or 'health'
 * @param {Array} recipients - Array of recipient objects with email, name, policyNo, etc.
 * @param {string} pdfDirectory - Directory containing the PDF files
 * @returns {Promise} - Results of email sending
 */
export const sendRenewalEmails = async (team, recipients, pdfDirectory) => {
  const senderConfig = SENDER_CONFIG[team];
  if (!senderConfig) {
    throw new Error(`Invalid team: ${team}`);
  }

  const results = {
    success: 0,
    failed: 0,
    errors: []
  };

  console.log(`📧 Starting ${team} email sending for ${recipients.length} recipients`);

  for (const recipient of recipients) {
    try {
      // Find the PDF file for this recipient
      const pdfPath = await findPDFForRecipient(recipient, pdfDirectory);

      if (!pdfPath) {
        results.failed++;
        results.errors.push({
          email: recipient.email,
          error: 'PDF file not found'
        });
        continue;
      }

      // Read PDF file and convert to base64
      const pdfBuffer = await fs.readFile(pdfPath);
      const pdfBase64 = pdfBuffer.toString('base64');

      // Create email content
      const emailContent = createEmailContent(team, recipient);

      // Prepare email data
      const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();

      sendSmtpEmail.sender = {
        name: senderConfig.name,
        email: senderConfig.email
      };

      sendSmtpEmail.to = [{
        email: recipient.email,
        name: recipient.name || recipient.email
      }];

      sendSmtpEmail.replyTo = {
        email: senderConfig.replyTo,
        name: senderConfig.name
      };

      sendSmtpEmail.subject = `${senderConfig.name} - Insurance Renewal Notice - Policy ${recipient.policyNo || 'N/A'}`;

      sendSmtpEmail.htmlContent = emailContent.html;
      sendSmtpEmail.textContent = emailContent.text;

      // Attach PDF
      sendSmtpEmail.attachment = [{
        content: pdfBase64,
        name: path.basename(pdfPath),
        type: 'application/pdf'
      }];

      // Send email with API key in headers
      const opts = {
        'headers': {
          'api-key': process.env.BREVO_API_KEY
        }
      };
      await apiInstance.sendTransacEmail(sendSmtpEmail, opts);

      results.success++;
      console.log(`✅ Email sent to ${recipient.email} (${recipient.name || 'N/A'})`);

    } catch (error) {
      results.failed++;
      results.errors.push({
        email: recipient.email,
        error: error.message
      });
      console.error(`❌ Failed to send email to ${recipient.email}:`, error.message);
    }
  }

  console.log(`📊 Email sending completed: ${results.success} success, ${results.failed} failed`);
  return results;
};

/**
 * Find PDF file for a specific recipient
 */
const findPDFForRecipient = async (recipient, pdfDirectory) => {
  try {
    const files = await fs.readdir(pdfDirectory);
    const pdfFiles = files.filter(file => file.endsWith('.pdf'));

    // First try exact filename match (if expectedFilename is provided)
    if (recipient.expectedFilename) {
      const exactMatch = pdfFiles.find(file => file === recipient.expectedFilename);
      if (exactMatch) {
        console.log(`✅ Found exact PDF match: ${exactMatch} for ${recipient.email}`);
        return path.join(pdfDirectory, exactMatch);
      } else {
        console.log(`⚠️ Expected PDF not found: ${recipient.expectedFilename} for ${recipient.email}`);
      }
    }

    // Fallback: Try to match by policy number or name
    const searchTerms = [
      recipient.policyNo,
      recipient.name,
      recipient.email.split('@')[0]
    ].filter(Boolean);

    for (const term of searchTerms) {
      const matchingFile = pdfFiles.find(file =>
        file.toLowerCase().includes(term.toLowerCase().replace(/[^a-z0-9]/gi, '_'))
      );

      if (matchingFile) {
        console.log(`📎 Found fallback PDF match: ${matchingFile} for ${recipient.email}`);
        return path.join(pdfDirectory, matchingFile);
      }
    }

    console.log(`❌ No PDF found for ${recipient.email} (${recipient.name})`);
    return null;

  } catch (error) {
    console.error('Error finding PDF file:', error);
    return null;
  }
};

/**
 * Create email content based on team and recipient
 */
const createEmailContent = (team, recipient) => {
  const isMotor = team === 'motor';
  const teamName = isMotor ? 'Motor Insurance' : 'Healthcare Insurance';
  const primaryColor = isMotor ? '#1e40af' : '#059669';

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${teamName} Renewal Notice</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: ${primaryColor}; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0; font-size: 24px;">NICL ${isMotor ? 'Motor' : 'Health'}</h1>
            <p style="margin: 5px 0 0 0; opacity: 0.9;">National Insurance Company Limited</p>
        </div>
        
        <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px;">
            <h2 style="color: ${primaryColor}; margin-top: 0;">${teamName} Renewal Notice</h2>
            
            <p>Dear ${recipient.name || 'Valued Customer'},</p>
            
            ${isMotor ? `
            <p>This is a reminder that your NIC Motor Insurance Policy No. <strong>${recipient.policyNo}</strong> is due to expire on <strong>${recipient.expiryDate}</strong>. To ensure your continued coverage and peace of mind, you are invited to renew your policy before the expiry date.</p>
            
            <h3 style="color: ${primaryColor}; margin: 30px 0 15px 0;">Your Renewal Details</h3>
            
            <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                <tr style="background: #f8f9fa;">
                    <td style="padding: 12px; border: 1px solid #ddd; font-weight: bold; width: 40%;">Item</td>
                    <td style="padding: 12px; border: 1px solid #ddd; font-weight: bold;">Details</td>
                </tr>
                <tr>
                    <td style="padding: 12px; border: 1px solid #ddd;">Policy Number</td>
                    <td style="padding: 12px; border: 1px solid #ddd;">${recipient.policyNo}</td>
                </tr>
                <tr style="background: #f8f9fa;">
                    <td style="padding: 12px; border: 1px solid #ddd;">Current Expiry Date</td>
                    <td style="padding: 12px; border: 1px solid #ddd;">${recipient.expiryDate}</td>
                </tr>
                <tr>
                    <td style="padding: 12px; border: 1px solid #ddd;">Proposed Renewal Period</td>
                    <td style="padding: 12px; border: 1px solid #ddd;">${recipient.renewalStart} to ${recipient.renewalEnd}</td>
                </tr>
                <tr style="background: #f8f9fa;">
                    <td style="padding: 12px; border: 1px solid #ddd;">Renewal Premium</td>
                    <td style="padding: 12px; border: 1px solid #ddd;"><strong>MUR ${formatCurrency(recipient.premium)}</strong></td>
                </tr>
            </table>
            ` : `
            <p>We hope this email finds you well.</p>
            
            <p>Please find attached your <strong>${teamName} Renewal Notice</strong> ${recipient.policyNo ? `for Policy No. <strong>${recipient.policyNo}</strong>` : ''}.</p>
            
            <div style="background: white; padding: 20px; border-radius: 6px; border-left: 4px solid ${primaryColor}; margin: 20px 0;">
                <h3 style="margin-top: 0; color: ${primaryColor};">Important Information:</h3>
                <ul style="margin: 0; padding-left: 20px;">
                    <li>Please review the renewal terms and conditions carefully</li>
                    <li>Complete and return the renewal acceptance form if you wish to renew</li>
                    <li>Contact us if you have any questions or need assistance</li>
                    <li>Update your medical information if there have been any changes</li>
                </ul>
            </div>
            `}
            
            <p>For your convenience, you may also settle payments instantly via the QR Code included in your renewal notice using mobile banking apps such as Juice, MauBank WithMe, Blink, MyT Money, or other supported applications.</p>
            
            <div style="background: #e3f2fd; padding: 15px; border-radius: 6px; margin: 20px 0;">
                <p style="margin: 0;"><strong>Need Help?</strong></p>
                <p style="margin: 5px 0 0 0;">Contact our Customer Service team at <strong>602 3000</strong> or email us at <a href="mailto:customerservice@nicl.mu" style="color: ${primaryColor};">customerservice@nicl.mu</a></p>
            </div>
            
            <p>Thank you for choosing NICL for your insurance needs.</p>
            
            <p style="margin-bottom: 0;">Best regards,<br>
            <strong>NICL ${isMotor ? 'Motor' : 'Health'} Team</strong><br>
            National Insurance Company Limited</p>
        </div>
        

    </body>
    </html>
  `;

  const text = `
NICL ${isMotor ? 'Motor' : 'Health'} - ${teamName} Renewal Notice

Dear ${recipient.name || 'Valued Customer'},

${isMotor ? `
This is a reminder that your NIC Motor Insurance Policy No. ${recipient.policyNo} is due to expire on ${recipient.expiryDate}. To ensure your continued coverage and peace of mind, you are invited to renew your policy before the expiry date.

Your Renewal Details:
- Policy Number: ${recipient.policyNo}
- Current Expiry Date: ${recipient.expiryDate}
- Proposed Renewal Period: ${recipient.renewalStart} to ${recipient.renewalEnd}
- Renewal Premium: MUR ${formatCurrency(recipient.premium)}
` : `
Please find attached your ${teamName} Renewal Notice for Policy No. ${recipient.policyNo}.

Important Information:
- Please review the renewal terms and conditions carefully
- Complete and return the renewal acceptance form if you wish to renew
- Contact us if you have any questions or need assistance
- Update your medical information if there have been any changes
`}

For your convenience, you may also settle payments instantly via the QR Code included in your renewal notice using mobile banking apps.

Need Help?
Contact our Customer Service team at 602 3385 or email customerservice@nicl.mu

Thank you for choosing NICL for your insurance needs.

Best regards,
NICL ${isMotor ? 'Motor' : 'Health'} Team
National Insurance Company Limited

`.trim();

  return { html, text };
};

/**
 * Send arrears emails with PDFs attached
 * @param {Array} recipients - Array of recipient objects with email, name, policyNo, recoveryType, etc.
 * @param {Array} recoveryTypes - Array of recovery types to send ['L0', 'L1', 'L2', 'MED'] or ['all']
 * @returns {Promise} - Results of email sending
 */
export const sendArrearsEmails = async (recipients, recoveryTypes = ['all']) => {
  console.log('📧 sendArrearsEmails called with:', { recipientCount: recipients.length, recoveryTypes });

  const senderConfig = SENDER_CONFIG.arrears;
  console.log('📧 Sender config:', senderConfig);

  const results = {
    success: 0,
    failed: 0,
    errors: []
  };

  console.log(`📧 Starting arrears email sending for ${recipients.length} recipients`);
  console.log(`📋 Recovery types: ${recoveryTypes.join(', ')}`);

  for (const recipient of recipients) {
    try {
      // Skip if recovery type filter doesn't match
      if (!recoveryTypes.includes('all') && !recoveryTypes.includes(recipient.recoveryType)) {
        console.log(`⏭️ Skipping ${recipient.email} - recovery type ${recipient.recoveryType} not in filter`);
        continue;
      }

      // Find the PDF file for this recipient
      const pdfPath = await findArrearsePDFForRecipient(recipient);

      if (!pdfPath) {
        results.failed++;
        results.errors.push({
          email: recipient.email,
          error: 'Arrears PDF file not found'
        });
        continue;
      }

      // Read PDF file and convert to base64
      const pdfBuffer = await fs.readFile(pdfPath);
      const pdfBase64 = pdfBuffer.toString('base64');

      // Generate QR code and prepare logos for L0 recovery type
      if (recipient.recoveryType === 'L0') {
        const qrCodeImage = await generateZwennPayQR(recipient);
        recipient.qrCodeImage = qrCodeImage;

        // Load logos as base64 for direct embedding
        try {
          const maucasLogoPath = path.join(__dirname, '../maucas2.jpeg');
          const zwennpayLogoPath = path.join(__dirname, '../zwennPay.jpg');

          if (await fs.pathExists(maucasLogoPath)) {
            const maucasLogoBuffer = await fs.readFile(maucasLogoPath);
            recipient.maucasLogoBase64 = `data:image/jpeg;base64,${maucasLogoBuffer.toString('base64')}`;
          }

          if (await fs.pathExists(zwennpayLogoPath)) {
            const zwennpayLogoBuffer = await fs.readFile(zwennpayLogoPath);
            recipient.zwennpayLogoBase64 = `data:image/jpeg;base64,${zwennpayLogoBuffer.toString('base64')}`;
          }
        } catch (logoError) {
          console.warn(`⚠️ Warning: Could not load logos for ${recipient.email}:`, logoError.message);
        }
      }

      // Create email content
      const emailContent = createArrearsEmailContent(recipient);

      // Prepare email data
      const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();

      sendSmtpEmail.sender = {
        name: senderConfig.name,
        email: senderConfig.email
      };

      sendSmtpEmail.to = [{
        email: recipient.email,
        name: recipient.name || recipient.email
      }];

      sendSmtpEmail.replyTo = {
        email: senderConfig.replyTo,
        name: senderConfig.name
      };

      const recoveryTypeNames = {
        L0: 'Initial Notice',
        L1: 'First Reminder',
        L2: 'Final Notice',
        MED: 'Legal Notice (Mise en Demeure)'
      };

      const noticeType = recoveryTypeNames[recipient.recoveryType] || 'Arrears Notice';
      sendSmtpEmail.subject = `${senderConfig.name} - ${noticeType} - Policy ${recipient.policyNo || 'N/A'}`;

      sendSmtpEmail.htmlContent = emailContent.html;
      sendSmtpEmail.textContent = emailContent.text;

      // Prepare attachments
      const attachments = [{
        content: pdfBase64,
        name: path.basename(pdfPath),
        type: 'application/pdf'
      }];

      // No need for logo attachments - using base64 data URLs directly

      sendSmtpEmail.attachment = attachments;

      // Send email with API key in headers
      console.log(`📧 Sending email to ${recipient.email}...`);
      const opts = {
        'headers': {
          'api-key': process.env.BREVO_API_KEY
        }
      };

      console.log('📧 Email payload prepared:', {
        to: sendSmtpEmail.to,
        subject: sendSmtpEmail.subject,
        hasAttachment: sendSmtpEmail.attachment ? sendSmtpEmail.attachment.length : 0
      });

      const emailResult = await apiInstance.sendTransacEmail(sendSmtpEmail, opts);
      console.log('📧 Email API response:', emailResult);

      results.success++;
      console.log(`✅ Arrears email sent to ${recipient.email} (${recipient.name || 'N/A'}) - ${recipient.recoveryType}`);

    } catch (error) {
      results.failed++;
      results.errors.push({
        email: recipient.email,
        error: error.message
      });
      console.error(`❌ Failed to send arrears email to ${recipient.email}:`, error.message);
    }
  }

  console.log(`📊 Arrears email sending completed: ${results.success} success, ${results.failed} failed`);
  return results;
};

/**
 * Find arrears PDF file for a specific recipient
 */
const findArrearsePDFForRecipient = async (recipient) => {
  try {
    console.log(`\n🔍 === PDF MATCHING DEBUG for ${recipient.email} ===`);
    console.log(`📋 Recipient data:`, {
      email: recipient.email,
      name: recipient.name,
      policyNo: recipient.policyNo,
      recoveryType: recipient.recoveryType
    });

    // Map recovery types to directories
    const recoveryDirMap = {
      L0: path.join(__dirname, '../L0'),
      L1: path.join(__dirname, '../L1'),
      L2: path.join(__dirname, '../L2'),
      MED: path.join(__dirname, '../output_mise_en_demeure')
    };

    const pdfDirectory = recoveryDirMap[recipient.recoveryType];
    console.log(`📁 Looking in directory: ${pdfDirectory}`);

    if (!pdfDirectory || !await fs.pathExists(pdfDirectory)) {
      console.log(`❌ Directory not found for recovery type: ${recipient.recoveryType}`);
      return null;
    }

    const files = await fs.readdir(pdfDirectory);
    const pdfFiles = files.filter(file => file.endsWith('.pdf'));
    console.log(`📄 Found ${pdfFiles.length} PDF files in directory:`);
    pdfFiles.forEach((file, index) => {
      console.log(`   ${index + 1}. ${file}`);
    });

    // Simple policy number matching (most reliable)
    if (recipient.policyNo && recipient.policyNo !== 'N/A') {
      console.log(`🔍 Policy matching for "${recipient.policyNo}"`);

      // Extract the numeric part from policy number (e.g., MED/2025/230/9/1195 → 2025_230_9_1195)
      const policyParts = recipient.policyNo.replace(/^[A-Z]+\//, '').replace(/\//g, '_');
      console.log(`   Looking for policy parts: "${policyParts}"`);

      const policyMatch = pdfFiles.find(file => file.includes(policyParts));

      if (policyMatch) {
        console.log(`✅ FOUND MATCH: ${policyMatch}`);
        console.log(`🔍 === END PDF MATCHING DEBUG ===\n`);
        return path.join(pdfDirectory, policyMatch);
      } else {
        console.log(`❌ No policy match found for "${policyParts}"`);
      }
    }

    console.log(`❌ NO MATCH FOUND for ${recipient.email} (${recipient.name}) - ${recipient.recoveryType}`);
    console.log(`💡 Available PDFs in ${recipient.recoveryType} directory:`);
    pdfFiles.forEach(file => console.log(`   - ${file}`));
    console.log(`💡 Recipient details:`);
    console.log(`   - Policy: ${recipient.policyNo}`);
    console.log(`   - Name: ${recipient.name}`);
    console.log(`   - Email: ${recipient.email}`);
    console.log(`🔍 === END PDF MATCHING DEBUG ===\n`);
    return null;

  } catch (error) {
    console.error('Error finding arrears PDF file:', error);
    return null;
  }
};

/**
 * Create arrears email content based on recovery type
 */
const createArrearsEmailContent = (recipient) => {
  const recoveryType = recipient.recoveryType || 'L0';

  // Recovery type specific configurations
  const recoveryConfig = {
    L0: {
      title: 'Payment Reminder',
      urgency: 'low',
      color: '#f59e0b',
      tone: 'friendly'
    },
    L1: {
      title: 'First Payment Notice',
      urgency: 'medium',
      color: '#f97316',
      tone: 'formal'
    },
    L2: {
      title: 'Final Payment Notice',
      urgency: 'high',
      color: '#dc2626',
      tone: 'urgent'
    },
    MED: {
      title: 'Legal Notice (Mise en Demeure)',
      urgency: 'critical',
      color: '#991b1b',
      tone: 'legal'
    }
  };

  const config = recoveryConfig[recoveryType] || recoveryConfig.L0;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>NICL Collections - ${config.title}</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: ${config.color}; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0; font-size: 24px;">NICL Collections</h1>
            <p style="margin: 5px 0 0 0; opacity: 0.9;">National Insurance Company Limited</p>
        </div>
        
        <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px;">
            <h2 style="color: ${config.color}; margin-top: 0;">${config.title}</h2>
            
            <p>Dear ${recipient.name || 'Valued Customer'},</p>
            
            ${config.tone === 'friendly' ? `
            <p>We hope this email finds you well. This is a friendly reminder regarding your insurance policy premium payment.</p>
            ` : config.tone === 'formal' ? `
            <p>We are writing to inform you about an outstanding premium payment on your insurance policy.</p>
            ` : config.tone === 'urgent' ? `
            <p>This is an urgent notice regarding the outstanding premium payment on your insurance policy.</p>
            ` : `
            <p>This is a formal legal notice (Mise en Demeure) regarding the outstanding premium payment on your insurance policy.</p>
            `}
            
            <p>Please find attached your <strong>${config.title}</strong> ${recipient.policyNo ? `for Policy No. <strong>${recipient.policyNo}</strong>` : ''}.</p>
            
            <p>For your convenience, you may settle payments instantly via the QR Code shown below using mobile banking apps such as Juice, MauBank WithMe, Blink, MyT Money, or other supported applications.</p>
            
            <!-- QR Code Payment Section -->
            <div style="background: white; padding: 20px; border-radius: 6px; border: 2px solid ${config.color}; margin: 20px 0; text-align: center;">
                <h3 style="margin-top: 0; color: ${config.color};">💳 Quick Payment via QR Code</h3>
                <p style="margin: 10px 0; font-size: 16px;"><strong>Scan the QR code below to pay instantly</strong></p>
                
                ${recipient.recoveryType === 'L0' && recipient.qrCodeImage ? `
                <!-- MauCAS Logo (Above QR Code) -->
                ${recipient.maucasLogoBase64 ? `
                <div style="margin: 15px 0; text-align: center;">
                    <img src="${recipient.maucasLogoBase64}" alt="MauCAS" style="height: 42px; width: auto; max-width: 120px;" />
                </div>
                ` : ''}
                
                <!-- QR Code Image -->
                <div style="margin: 20px 0;">
                    <img src="${recipient.qrCodeImage}" alt="Payment QR Code" style="width: 200px; height: 200px; border: 2px solid #ddd; border-radius: 8px;" />
                </div>
                
                <!-- Company Label -->
                <div style="margin: 10px 0;">
                    <p style="margin: 0; font-size: 16px; font-weight: bold; color: #333;">NIC Health Insurance</p>
                </div>
                
                <!-- ZwennPay Logo (Below QR Code) -->
                ${recipient.zwennpayLogoBase64 ? `
                <div style="margin: 15px 0; text-align: center;">
                    <img src="${recipient.zwennpayLogoBase64}" alt="ZwennPay" style="height: 60px; width: auto; max-width: 150px;" />
                </div>
                ` : ''}
                ` : `
                <!-- For non-L0 recovery types -->
                <div style="background: #f8f9fa; padding: 15px; border-radius: 6px; margin: 15px 0;">
                    <p style="margin: 0; font-size: 14px; color: #666;">
                        <strong>Powered by:</strong> MauCAS Payment System<br>
                        <strong>Payment by:</strong> ZwennPay Digital Wallet
                    </p>
                </div>
                `}
                
                <!-- Supported Apps -->
                <div style="margin: 15px 0;">
                    <p style="margin: 5px 0; font-size: 14px; color: #666;">
                        <strong>Supported Mobile Banking Apps:</strong><br>
                        Juice • MauBank WithMe • Blink • MyT Money • Other Banking Apps
                    </p>
                </div>
                
                <div style="background: #e3f2fd; padding: 10px; border-radius: 4px; margin: 15px 0;">
                    <p style="margin: 0; font-size: 14px;">
                        <strong>Need Help?</strong><br>
                        📞 <strong>602 3000</strong> | 📧 <a href="mailto:giarrearsrecovery@nicl.mu" style="color: ${config.color};">giarrearsrecovery@nicl.mu</a>
                    </p>
                </div>
            </div>
            
            <p>Thank you for your prompt attention to this matter.</p>
            
            <p style="margin-bottom: 0;">Best regards,<br>
            <strong>NICL Collections Team</strong><br>
            National Insurance Company Limited</p>
        </div>
    </body>
    </html>
  `;

  const text = `
NICL Collections - ${config.title}

Dear ${recipient.name || 'Valued Customer'},

${config.tone === 'friendly' ?
      'This is a friendly reminder regarding your insurance policy premium payment.' :
      config.tone === 'formal' ?
        'We are writing to inform you about an outstanding premium payment on your insurance policy.' :
        config.tone === 'urgent' ?
          'This is an urgent notice regarding the outstanding premium payment on your insurance policy.' :
          'This is a formal legal notice (Mise en Demeure) regarding the outstanding premium payment on your insurance policy.'
    }

Please find attached your ${config.title} for Policy No. ${recipient.policyNo}.

For your convenience, you may settle payments instantly via the QR Code included in your notice using mobile banking apps such as Juice, MauBank WithMe, Blink, MyT Money, or other supported applications.

Quick Payment via QR Code:
- Scan the QR code in your attached notice to pay instantly
- Powered by MauCAS and ZwennPay payment system
- Contact: 602 3000 or giarrearsrecovery@nicl.mu

Thank you for your prompt attention to this matter.

Best regards,
NICL Collections Team
National Insurance Company Limited
`.trim();

  return { html, text };
};

export default { sendRenewalEmails, sendArrearsEmails };