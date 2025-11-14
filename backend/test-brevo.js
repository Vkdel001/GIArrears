import SibApiV3Sdk from '@getbrevo/brevo';
import dotenv from 'dotenv';

dotenv.config();

import path from 'path';
import fs from 'fs';

const testBrevo = async () => {
  console.log('🧪 Testing Brevo API...');
  console.log('🔍 Current working directory:', process.cwd());
  console.log('🔍 Looking for .env file at:', path.join(process.cwd(), '.env'));
  console.log('🔍 .env file exists:', fs.existsSync('.env'));
  
  // Read .env file directly to compare
  const envContent = fs.readFileSync('.env', 'utf8');
  const envLines = envContent.split('\n');
  const brevoLine = envLines.find(line => line.startsWith('BREVO_API_KEY='));
  console.log('🔍 .env file BREVO_API_KEY line:', brevoLine);
  
  if (brevoLine) {
    const fileApiKey = brevoLine.split('=')[1];
    console.log('🔍 API Key from .env file (last 20 chars):', '...' + fileApiKey.slice(-20));
  }
  
  if (!process.env.BREVO_API_KEY) {
    console.error('❌ No Brevo API key found in environment');
    return;
  }
  
  console.log('✅ Brevo API key found in environment');
  console.log('🔑 API Key from process.env (last 20 chars):', '...' + process.env.BREVO_API_KEY.slice(-20));
  
  // Compare them
  if (brevoLine) {
    const fileApiKey = brevoLine.split('=')[1];
    const envApiKey = process.env.BREVO_API_KEY;
    console.log('🔍 Keys match:', fileApiKey === envApiKey ? '✅ YES' : '❌ NO - Environment variable is overriding .env file!');
  }
  
  try {
    const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
    const apiKey = apiInstance.authentications['apiKey'];
    apiKey.apiKey = process.env.BREVO_API_KEY;
    
    const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
    
    sendSmtpEmail.sender = {
      name: 'NICL Test',
      email: 'noreply@niclmauritius.site'
    };
    
    sendSmtpEmail.to = [{
      email: 'vikas.khanna@zwennpay.com',
      name: 'Vikas'
    }];
    
    sendSmtpEmail.subject = 'Brevo Test Email';
    sendSmtpEmail.htmlContent = '<h1>Test Email</h1><p>If you receive this, Brevo is working!</p>';
    
    console.log('📤 Sending test email...');
    const result = await apiInstance.sendTransacEmail(sendSmtpEmail);
    
    console.log('✅ Test email sent successfully!');
    console.log('📊 Response:', result.response?.statusCode);
    console.log('📧 Check your email inbox for the test message');
    
  } catch (error) {
    console.error('❌ Brevo test failed:');
    console.error('Error message:', error.message);
    console.error('Error details:', error.response?.data || error);
  }
};

testBrevo();