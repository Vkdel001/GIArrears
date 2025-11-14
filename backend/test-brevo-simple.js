import SibApiV3Sdk from '@getbrevo/brevo';
import dotenv from 'dotenv';

dotenv.config();

const testBrevoSimple = async () => {
  console.log('🧪 Testing Brevo API with current configuration...');
  
  if (!process.env.BREVO_API_KEY) {
    console.error('❌ No Brevo API key found in .env file');
    return;
  }
  
  console.log('✅ Brevo API key found');
  console.log('🔑 API Key (first 20 chars):', process.env.BREVO_API_KEY.substring(0, 20) + '...');
  
  try {
    // Test 1: Check account info
    console.log('\n📋 Test 1: Checking account info...');
    const response = await fetch('https://api.brevo.com/v3/account', {
      method: 'GET',
      headers: {
        'accept': 'application/json',
        'api-key': process.env.BREVO_API_KEY
      }
    });
    
    if (response.ok) {
      const accountData = await response.json();
      console.log('✅ Account check successful');
      console.log('📊 Email credits remaining:', accountData.plan?.[0]?.credits || 'Unknown');
    } else {
      console.error('❌ Account check failed:', response.status, response.statusText);
      const errorText = await response.text();
      console.error('Error details:', errorText);
      return;
    }
    
    // Test 2: Check sender domains
    console.log('\n📋 Test 2: Checking sender domains...');
    const domainsResponse = await fetch('https://api.brevo.com/v3/senders/domains', {
      method: 'GET',
      headers: {
        'accept': 'application/json',
        'api-key': process.env.BREVO_API_KEY
      }
    });
    
    if (domainsResponse.ok) {
      const domainsData = await domainsResponse.json();
      console.log('✅ Domains check successful');
      console.log('📧 Verified domains:', domainsData.domains?.map(d => d.domain) || []);
      
      // Check if our sender domain is verified
      const ourDomain = 'niclmauritius.site';
      const isVerified = domainsData.domains?.some(d => d.domain === ourDomain && d.domain_status === 'verified');
      console.log(`🔍 Domain ${ourDomain} verified:`, isVerified ? '✅ Yes' : '❌ No');
    } else {
      console.error('❌ Domains check failed:', domainsResponse.status);
    }
    
    // Test 3: Simple test email
    console.log('\n📋 Test 3: Sending simple test email...');
    const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
    const defaultClient = SibApiV3Sdk.ApiClient.instance;
    const apiKeyAuth = defaultClient.authentications['api-key'];
    apiKeyAuth.apiKey = process.env.BREVO_API_KEY;
    
    const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
    
    sendSmtpEmail.sender = {
      name: 'NICG Test',
      email: 'collections@niclmauritius.site'  // Same as arrears config
    };
    
    sendSmtpEmail.to = [{
      email: 'vkdel001@gmail.com',  // Same as failing email
      name: 'Test Recipient'
    }];
    
    sendSmtpEmail.subject = 'Brevo Test Email - Simple';
    sendSmtpEmail.htmlContent = '<h1>Test Email</h1><p>If you receive this, Brevo basic sending works!</p>';
    
    const result = await apiInstance.sendTransacEmail(sendSmtpEmail);
    console.log('✅ Test email sent successfully!');
    console.log('📧 Message ID:', result.messageId);
    
  } catch (error) {
    console.error('❌ Brevo test failed:');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error status:', error.status || error.statusCode);
    console.error('Error response:', error.response?.data || error.response?.text || 'No response data');
    
    if (error.stack) {
      console.error('Error stack (first 3 lines):');
      console.error(error.stack.split('\n').slice(0, 3).join('\n'));
    }
  }
};

testBrevoSimple();