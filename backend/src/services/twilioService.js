const twilio = require('twilio');

function getTwilioClient() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) return null;
  return twilio(sid, token);
}

async function sendSms({ to, body }) {
  const normalizedTo = String(to || '').trim();
  if (!normalizedTo.startsWith('+')) {
    const err = new Error(`Recipient number must be in E.164 format, got: ${to}`);
    err.status = 400;
    throw err;
  }
  const from = process.env.TWILIO_FROM_NUMBER;
  const allowMock = process.env.TWILIO_MOCK === 'true' || process.env.NODE_ENV !== 'production';
  if (!from && !allowMock) {
    const err = new Error('Missing TWILIO_FROM_NUMBER');
    err.status = 500;
    throw err;
  }

  const client = getTwilioClient();
  if (!client && !allowMock) {
    const err = new Error('Missing TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN');
    err.status = 500;
    throw err;
  }

  if (!client) {
    return {
      sid: `MOCK_${Date.now()}`,
      status: 'mocked',
      to: normalizedTo,
      body,
      mocked: true,
    };
  }

  return await client.messages.create({ to: normalizedTo, from, body });
}

module.exports = { sendSms };

