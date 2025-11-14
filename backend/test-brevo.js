import SibApiV3Sdk from '@getbrevo/brevo';
import dotenv from 'dotenv';

dotenv.config();

const testBrevo = async () => {
  console.log('🧪 Testing Brevo API...');
  
  if (!process.env.BREVO_API_KEY) {
    console.error('❌ No Brevo API key found in .env file');
    return;
  }
  
  console.log('✅ Brevo API key found');
  
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