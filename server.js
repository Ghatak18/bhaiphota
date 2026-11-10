// Telegram notification backend for the Bhai Phota website.
// Node.js 18+ is required for the built-in fetch API.
require('dotenv').config();

const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');

const PORT = Number(process.env.PORT || 3000);
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

if (!BOT_TOKEN || !CHAT_ID) {
  console.error('Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID environment variable.');
  process.exit(1);
}

const hits = new Map();
const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 5;
const MAX_BODY_BYTES = 4096;

function sendJson(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  res.end(JSON.stringify(data));
}

function isRateLimited(req) {
  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown')
    .toString().split(',')[0].trim();
  const now = Date.now();
  const previous = hits.get(ip) || { count: 0, start: now };
  if (now - previous.start > WINDOW_MS) {
    previous.count = 0;
    previous.start = now;
  }
  previous.count += 1;
  hits.set(ip, previous);
  return previous.count > MAX_REQUESTS_PER_WINDOW;
}

async function sendTelegramMessage(text) {
  const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: CHAT_ID, text })
  });
  const result = await response.json();
  if (!response.ok || !result.ok) {
    console.error('Telegram API error:', result);
    throw new Error('Telegram delivery failed');
  }
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (Buffer.byteLength(body, 'utf8') > MAX_BODY_BYTES) {
        reject(new Error('Request body too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try { resolve(JSON.parse(body || '{}')); }
      catch { reject(new Error('Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  // Serve the frontend and API from the same Render web service.
  if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
    try {
      const html = await fs.readFile(path.join(__dirname, 'index.html'));
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache',
        'X-Content-Type-Options': 'nosniff'
      });
      return res.end(html);
    } catch (error) {
      console.error('Could not load index.html:', error);
      return sendJson(res, 500, { ok: false, error: 'Website could not be loaded.' });
    }
  }

  if (req.method === 'GET' && req.url === '/health') {
    return sendJson(res, 200, { ok: true, service: 'bhai-phota-notifications' });
  }

  if (req.method !== 'POST' || !['/api/phota', '/api/message'].includes(req.url)) {
    return sendJson(res, 404, { ok: false, error: 'Not found' });
  }

  if (isRateLimited(req)) {
    return sendJson(res, 429, { ok: false, error: 'Too many requests. Try again later.' });
  }

  try {
    const payload = await readJsonBody(req);

    if (req.url === '/api/phota') {
      if (payload.event !== 'bhai_phota') {
        return sendJson(res, 400, { ok: false, error: 'Invalid event' });
      }
      await sendTelegramMessage('❤️ Someone just gave you Bhai Phota!\n\nYour website received a new phota. শুভ ভাইফোঁটা!');
      return sendJson(res, 200, { ok: true });
    }

    const name = typeof payload.name === 'string' ? payload.name.trim().slice(0, 50) : '';
    const message = typeof payload.message === 'string' ? payload.message.trim() : '';
    if (!message || message.length > 1000) {
      return sendJson(res, 400, { ok: false, error: 'Please enter a message (up to 1000 characters).' });
    }

    const telegramText = [
      '💌 New message after Bhai Phota!',
      '',
      name ? `From: ${name}` : 'From: Someone who gave you phota',
      '',
      message,
      '',
      'শুভ ভাইফোঁটা! ❤️'
    ].join('\n');
    await sendTelegramMessage(telegramText);
    return sendJson(res, 200, { ok: true });
  } catch (error) {
    console.error('Request error:', error);
    if (error.message === 'Request body too large') {
      return sendJson(res, 413, { ok: false, error: 'Message is too large.' });
    }
    if (error.message === 'Telegram delivery failed') {
      return sendJson(res, 502, { ok: false, error: 'Telegram delivery failed. Please try again.' });
    }
    return sendJson(res, 400, { ok: false, error: 'Invalid request.' });
  }
});

server.listen(PORT, () => console.log(`Bhai Phota notification API listening on ${PORT}`));
