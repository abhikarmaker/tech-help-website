addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

const SENDGRID_API_KEY = SAFETY_SHIM_SG_API_KEY; // replace with environment binding name
const SEND_FROM = 'no-reply@easytechvancouver.ca';
const SEND_TO = 'abhijeet.karmaker@gmail.com';

async function handleRequest(request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  const body = await request.json().catch(() => null);
  if (!body || !body.email || !body.message) {
    return new Response(JSON.stringify({ error: 'Email and message are required' }), { status: 400 });
  }

  const { name = 'Anonymous', email, phone = '', message } = body;

  const ownerMessage = {
    personalizations: [{ to: [{ email: SEND_TO }] }],
    from: { email: SEND_FROM },
    reply_to: { email },
    subject: `New EasyTech Inquiry from ${name}`,
    content: [{
      type: 'text/html',
      value: `
        <p><strong>Name:</strong> ${escapeHtml(name)}</p>
        <p><strong>Email:</strong> ${escapeHtml(email)}</p>
        <p><strong>Phone:</strong> ${escapeHtml(phone)}</p>
        <p><strong>Message:</strong></p>
        <p>${escapeHtml(message).replace(/\n/g, '<br>')}</p>
      `,
    }],
  };

  const autoReply = {
    personalizations: [{ to: [{ email }] }],
    from: { email: SEND_FROM },
    subject: 'Thanks for contacting EasyTech — request received',
    content: [{
      type: 'text/html',
      value: `
        <p>Hi ${escapeHtml(name)},</p>
        <p>Thanks for your message. We received your request and will reply within 1 business hour.</p>
        <p>Your message:</p>
        <blockquote>${escapeHtml(message).replace(/\n/g, '<br>')}</blockquote>
        <p>If it’s urgent, please WhatsApp <a href="https://wa.me/18194342389">819-434-2389</a>.</p>
        <p>Best regards,<br>EasyTech Vancouver</p>
      `,
    }],
  };

  try {
    await sendSendGrid(ownerMessage);
    await sendSendGrid(autoReply);
    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Send failed', details: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function sendSendGrid(payload) {
  const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SENDGRID_API_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`SendGrid error: ${res.status} ${errText}`);
  }
}
