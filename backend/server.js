const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const db = require('./db');
const { writeQrSvg } = require('./whatsappQr');
const { requireRole } = require('./session');

const app = express();
const port = Number(process.env.PORT || 5000);
app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  if (!req.path.startsWith('/api/') || !['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();
  res.once('finish', () => {
    if (res.statusCode < 200 || res.statusCode >= 300) return;
    const action = `${req.method} ${req.route?.path || req.path}`.slice(0, 255);
    const details = JSON.stringify({ path: req.path, status: res.statusCode });
    db.query(
      'INSERT INTO audit_logs (action, performedBy, userRole, details) VALUES (?, ?, ?, ?)',
      [action, req.auditActor || req.auth?.userId || null, req.auditRole || req.auth?.role || null, details],
      error => { if (error) console.error('Could not record audit event:', error); }
    );
  });
  next();
});

app.get('/api/health', (req, res) => {
  db.query('SELECT 1 AS ok', error => {
    if (error) return res.status(503).json({ status: 'database unavailable' });
    res.json({ status: 'ok' });
  });
});

let whatsappClient;
let whatsappRetryTimer;
let whatsappStartupTimer;
let whatsappHealthTimer;
let whatsappRetryCount = 0;
let whatsappUnhealthyChecks = 0;
let shuttingDown = false;
let reconnectWhatsApp = () => {};
let whatsappState = process.env.ENABLE_WHATSAPP === 'true' ? 'starting' : 'disabled';
const whatsappQrPath = path.join(__dirname, 'whatsapp-qr.svg');
app.get('/api/whatsapp/status', (req, res) => res.json({ status: whatsappState }));

if (process.env.ENABLE_WHATSAPP === 'true') {
  const { Client, LocalAuth } = require('whatsapp-web.js');
  const qrcode = require('qrcode-terminal');
  const browserCandidates = [
    process.env.WHATSAPP_BROWSER_PATH,
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe'
  ];
  const browserExecutable = browserCandidates.find(candidate => candidate && fs.existsSync(candidate));
  function queueWhatsAppRestart(client, reason) {
    if (shuttingDown || client !== whatsappClient || whatsappRetryTimer) return;
    clearTimeout(whatsappStartupTimer);
    whatsappState = 'reconnecting';
    const delay = Math.min(15000 * 2 ** Math.min(whatsappRetryCount++, 3), 120000);
    console.error(`WhatsApp ${reason}. Retrying in ${delay / 1000} seconds.`);
    whatsappRetryTimer = setTimeout(async () => {
      whatsappRetryTimer = null;
      if (shuttingDown || client !== whatsappClient) return;
      whatsappClient = null;
      try { await client.destroy(); } catch (error) {
        console.error('WhatsApp browser cleanup failed:', error.message);
      }
      if (!shuttingDown) startWhatsApp();
    }, delay);
  }
  reconnectWhatsApp = reason => {
    if (whatsappClient) queueWhatsAppRestart(whatsappClient, reason);
  };

  function startWhatsApp() {
    whatsappState = 'starting';
    const client = new Client({
      authStrategy: new LocalAuth({ dataPath: path.join(__dirname, '.wwebjs_auth') }),
      puppeteer: {
        headless: true,
        ...(browserExecutable ? { executablePath: browserExecutable } : {})
      }
    });
    whatsappClient = client;
    whatsappStartupTimer = setTimeout(() => {
      queueWhatsAppRestart(client, 'startup timed out');
    }, 120000);
    client.on('qr', qr => {
      if (client !== whatsappClient) return;
      clearTimeout(whatsappStartupTimer);
      clearTimeout(whatsappRetryTimer);
      whatsappRetryTimer = null;
      whatsappState = 'scan-qr';
      console.log('Scan this WhatsApp QR code:');
      qrcode.generate(qr, { small: true });
      writeQrSvg(qr, whatsappQrPath);
    });
    client.on('ready', () => {
      if (client !== whatsappClient) return;
      clearTimeout(whatsappStartupTimer);
      clearTimeout(whatsappRetryTimer);
      whatsappRetryTimer = null;
      whatsappRetryCount = 0;
      whatsappUnhealthyChecks = 0;
      whatsappState = 'ready';
      fs.rmSync(whatsappQrPath, { force: true });
      console.log('WhatsApp client connected.');
    });
    client.on('disconnected', reason => {
      queueWhatsAppRestart(client, `disconnected (${reason})`);
    });
    client.on('auth_failure', message => {
      queueWhatsAppRestart(client, `authentication failed (${message})`);
    });
    client.initialize().catch(error => {
      queueWhatsAppRestart(client, `startup failed (${error.message || error})`);
    });
  }
  startWhatsApp();

  whatsappHealthTimer = setInterval(async () => {
    const client = whatsappClient;
    if (!client || whatsappState !== 'ready') return;
    let timeout;
    try {
      const state = await Promise.race([
        client.getState(),
        new Promise((_, reject) => {
          timeout = setTimeout(() => reject(new Error('state check timed out')), 10000);
        })
      ]);
      if (client !== whatsappClient) return;
      whatsappUnhealthyChecks = state === 'CONNECTED' ? 0 : whatsappUnhealthyChecks + 1;
    } catch (error) {
      if (client !== whatsappClient) return;
      whatsappUnhealthyChecks++;
      console.error('WhatsApp state check failed:', error.message);
    } finally {
      clearTimeout(timeout);
    }
    if (whatsappUnhealthyChecks >= 2) queueWhatsAppRestart(client, 'connection check failed');
  }, 60000);
}

async function sendWhatsAppMessage(phone, message) {
  if (!phone || whatsappState !== 'ready') return false;
  try {
    let number = String(phone).replace(/\D/g, '');
    if (number.startsWith('0')) number = '94' + number.slice(1);
    else if (/^7\d{8}$/.test(number)) number = '94' + number;
    await whatsappClient.sendMessage(number + '@c.us', message);
    return true;
  } catch (error) {
    console.error('WhatsApp message failed:', error.message);
    if (/detached frame|execution context|target closed|session closed|protocol error/i.test(error.message)) {
      reconnectWhatsApp('browser became unavailable');
    }
    return false;
  }
}

require('./routes/auth')(app);
app.use('/api/manager', requireRole('MANAGER'));
require('./routes/manager')(app);
require('./routes/managementReports')(app);
app.use('/api/sa', requireRole('SERVICE_ADVISOR'));
require('./routes/advisor')(app);
app.use('/api/om', requireRole('OFFICE_MANAGEMENT'));
require('./routes/office')(app, { sendWhatsAppMessage });
app.use('/api/technician', requireRole('TECHNICIAN'));
require('./routes/technician')(app);
require('./routes/customer')(app);
app.use('/api/supplier', requireRole('SUPPLIER'));
app.use('/api/supplier', (req, res, next) => {
  db.query('SELECT 1 FROM suppliers WHERE supplierId = ? AND supplierUserId = ? AND isActive = 1 LIMIT 1',
    [req.auth.supplierId, req.auth.userId], (error, rows) => {
      if (error) return res.status(500).json({ error: 'Could not verify supplier account.' });
      if (!rows.length) return res.status(403).json({ error: 'Supplier account is unavailable.' });
      next();
    });
});
require('./routes/supplier')(app);

async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  clearTimeout(whatsappRetryTimer);
  clearTimeout(whatsappStartupTimer);
  clearInterval(whatsappHealthTimer);
  try { if (whatsappClient) await whatsappClient.destroy(); } catch (error) {
    console.error('WhatsApp shutdown failed:', error.message);
  }
  try { await db.promise().end(); } catch (error) {
    console.error('Database shutdown failed:', error.message);
  }
  process.exit(0);
}
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);

db.getConnection((error, connection) => {
  if (error) {
    console.error('MySQL connection failed. Check backend/.env and your MySQL server:', error.code);
    process.exitCode = 1;
    return;
  }
  connection.release();
  app.listen(port, () => {
    console.log('Connected to MySQL database ' + (process.env.DB_NAME || 'auto_care_db'));
    console.log('Server running on port ' + port);
  });
});
