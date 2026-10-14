const fs = require('fs');
const path = require('path');
const db = require('../db');
const puppeteer = require('puppeteer');
const letterhead = fs.readFileSync(path.join(__dirname, '..', 'assets', 'report-letterhead.png')).toString('base64');

const browserPaths = [
  process.env.REPORT_BROWSER_PATH,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe'
];

const escapeHtml = value => String(value ?? '—').replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[character]);
const money = value => `Rs. ${Number(value || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function localToday() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Colombo', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date());
  const value = key => parts.find(part => part.type === key).value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}

function dateString(date) { return date.toISOString().slice(0, 10); }

function reportPeriod(type, selectedDate) {
  const today = localToday();
  const date = selectedDate || today;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      Number.isNaN(Date.parse(`${date}T00:00:00Z`)) ||
      dateString(new Date(`${date}T00:00:00Z`)) !== date || date > today) return null;
  const point = new Date(`${date}T00:00:00Z`);
  const start = new Date(point);
  const end = new Date(point);
  if (type === 'weekly') {
    start.setUTCDate(start.getUTCDate() - (start.getUTCDay() + 6) % 7);
    end.setTime(start.getTime());
    end.setUTCDate(end.getUTCDate() + 6);
  } else if (type === 'monthly') {
    start.setUTCDate(1);
    end.setUTCMonth(start.getUTCMonth() + 1, 0);
  } else if (type === 'yearly') {
    start.setUTCMonth(0, 1);
    end.setUTCMonth(11, 31);
  }
  const endDate = dateString(end) > today ? today : dateString(end);
  return { start: dateString(start), end: endDate };
}

function table(rows) {
  const body = rows.length ? rows.map(row => `<tr>
    <td>${escapeHtml(row.itemId)}</td><td>${escapeHtml(row.itemName)}</td>
    <td>${escapeHtml(row.quantityInStock)}</td><td>${escapeHtml(row.reorderLevel)}</td>
    <td>${escapeHtml(money(row.unitPrice))}</td><td>${escapeHtml(money(row.stockValue))}</td>
  </tr>`).join('') : '<tr><td colspan="6" class="empty">No stock records available for this date.</td></tr>';
  return `<table><colgroup><col style="width:21%"><col style="width:25%"><col style="width:10%"><col style="width:12%"><col style="width:15%"><col style="width:17%"></colgroup><thead><tr><th>Part ID</th><th>Part name</th><th>Quantity</th><th>Reorder at</th><th>Unit price</th><th>Stock value</th></tr></thead><tbody>${body}</tbody></table>`;
}

function chart(rows) {
  const top = [...rows].filter(row => Number(row.stockValue) > 0)
    .sort((a, b) => Number(b.stockValue) - Number(a.stockValue)).slice(0, 8);
  const max = Math.max(1, ...top.map(row => Number(row.stockValue)));
  return `<section class="chart"><h2>Stock value by part</h2>${top.length ? top.map(row => `
    <div class="chart-row"><span>${escapeHtml(row.itemName)}</span><div class="track"><div class="bar" style="width:${Math.max(3, Number(row.stockValue) / max * 100)}%"></div></div><b>${escapeHtml(money(row.stockValue))}</b></div>
  `).join('') : '<p class="empty">No chart data for this date.</p>'}</section>`;
}

function reportHtml({ type, period, managerName, rows, changes, historyStart }) {
  const title = `${type[0].toUpperCase()}${type.slice(1)} Inventory Summary`;
  const generated = new Date().toLocaleString('en-GB', { timeZone: 'Asia/Colombo', dateStyle: 'medium', timeStyle: 'short' });
  const units = rows.reduce((sum, row) => sum + Number(row.quantityInStock), 0);
  const value = rows.reduce((sum, row) => sum + Number(row.stockValue), 0);
  const restock = rows.filter(row => Number(row.quantityInStock) <= Number(row.reorderLevel)).length;
  const metrics = [
    ['Part categories', rows.length], ['Units in stock', units],
    ['Need restocking', restock], ['Stock value', money(value)]
  ];
  const historyNote = historyStart && period.start < historyStart
    ? `<p class="note">Stock history begins on ${escapeHtml(historyStart)}. Earlier stock changes are unavailable.</p>` : '';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>
    @page { size: A4; margin: 15mm 14mm 18mm; }
    * { box-sizing: border-box; } body { margin: 0; color: #243143; font-family: Arial, sans-serif; font-size: 9pt; }
    .letterhead { width: 100%; height: auto; display: block; break-inside: avoid; }
    .title { margin: 20px 0 12px; padding: 8px 10px; border: 1px solid #abb8c4; text-align: center; text-transform: uppercase; font-size: 12pt; font-weight: 700; letter-spacing: .04em; }
    .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 18px; margin-bottom: 16px; font-size: 8pt; }
    .meta div { border-bottom: 1px solid #dde3e9; padding: 3px 0; } .meta strong { color: #526176; }
    .metrics { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 12px 0 18px; }
    .metric { background: #f3f6f9; border-left: 3px solid #567f9c; padding: 9px; min-height: 49px; }
    .metric span { display: block; color: #58677a; font-size: 7.5pt; } .metric b { display: block; margin-top: 4px; font-size: 11pt; }
    h2 { font-size: 10pt; margin: 16px 0 8px; color: #27435b; }
    table { border-collapse: collapse; width: 100%; font-size: 8pt; table-layout: fixed; } thead { display: table-header-group; }
    tr { break-inside: avoid; } th { text-align: left; color: #fff; background: #567f9c; padding: 7px 6px; }
    td { padding: 6px; border-bottom: 1px solid #dde4e9; overflow-wrap: anywhere; } tbody tr:nth-child(even) { background: #f3f5f7; }
    .empty { color: #718096; text-align: center; padding: 12px; }
    .chart { margin-top: 17px; break-inside: avoid; } .chart-row { display: grid; grid-template-columns: 100px 1fr 90px; align-items: center; gap: 7px; margin: 7px 0; font-size: 8pt; }
    .chart-row span { overflow-wrap: anywhere; } .track { height: 13px; background: #edf1f5; } .bar { height: 100%; background: #567f9c; } .chart-row b { color: #27435b; text-align: right; }
    .note { color: #8a582d; background: #fff8e9; padding: 8px; border-left: 3px solid #d6aa62; }
  </style></head><body>
    <header><img class="letterhead" src="data:image/png;base64,${letterhead}" alt="New Lakisha Auto Mart letterhead"></header>
    <div class="title">${escapeHtml(title)}</div>
    <div class="meta"><div><strong>Prepared for:</strong> ${escapeHtml(managerName)}</div><div><strong>Generated:</strong> ${escapeHtml(generated)}</div><div><strong>Period:</strong> ${escapeHtml(period.start)} to ${escapeHtml(period.end)}</div><div><strong>Stock changes recorded:</strong> ${escapeHtml(changes)}</div></div>
    <div class="metrics">${metrics.map(([label, metric]) => `<div class="metric"><span>${escapeHtml(label)}</span><b>${escapeHtml(metric)}</b></div>`).join('')}</div>
    ${historyNote}<h2>Stock position at end of period</h2>${table(rows)}${chart(rows)}
  </body></html>`;
}

async function loadReport(type, period, managerUserId) {
  const [[rows], [changeRows], [historyRows], [managerRows]] = await Promise.all([
    db.promise().query(`SELECT h.itemId, h.itemName, h.quantityInStock, h.reorderLevel, h.unitPrice,
      h.quantityInStock * h.unitPrice AS stockValue FROM inventory_stock_history h
      JOIN (SELECT itemId, MAX(historyId) AS historyId FROM inventory_stock_history
        WHERE recordedAt < DATE_ADD(?, INTERVAL 1 DAY) GROUP BY itemId) latest ON latest.historyId = h.historyId
      WHERE h.isActive = 1 ORDER BY h.itemName`, [period.end]),
    db.promise().query(`SELECT COUNT(*) AS count FROM inventory_stock_history
      WHERE recordedAt >= ? AND recordedAt < DATE_ADD(?, INTERVAL 1 DAY) AND changeType <> 'BASELINE'`, [period.start, period.end]),
    db.promise().query(`SELECT DATE_FORMAT(MIN(recordedAt), '%Y-%m-%d') AS firstDate FROM inventory_stock_history`),
    db.promise().query('SELECT name FROM user WHERE userId = ?', [managerUserId])
  ]);
  return reportHtml({ type, period, rows, changes: changeRows[0].count,
    historyStart: historyRows[0].firstDate, managerName: managerRows[0]?.name || 'Manager' });
}

async function createPdf(html) {
  const executablePath = browserPaths.find(candidate => candidate && fs.existsSync(candidate));
  const browser = await puppeteer.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'load' });
    return await page.pdf({ format: 'A4', printBackground: true, displayHeaderFooter: true,
      margin: { top: '15mm', right: '14mm', bottom: '18mm', left: '14mm' },
      headerTemplate: '<span></span>',
      footerTemplate: '<div style="width:100%;margin:0 14mm;text-align:right;color:#68798a;font:8px Arial">Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>' });
  } finally { await browser.close(); }
}

module.exports = function registerManagementReports(app) {
  app.get('/api/manager/reports/inventory/:period.pdf', async (req, res) => {
    const { period: type } = req.params;
    if (!['daily', 'weekly', 'monthly', 'yearly'].includes(type)) return res.status(404).json({ error: 'Report not found.' });
    const period = reportPeriod(type, req.query.date);
    if (!period) return res.status(400).json({ error: 'Enter a valid report date up to today.' });
    try {
      const html = await loadReport(type, period, req.auth.userId);
      const pdf = await createPdf(html);
      res.set('Content-Type', 'application/pdf');
      res.set('Content-Disposition', `inline; filename="inventory-${type}-${period.end}.pdf"`);
      res.send(Buffer.from(pdf));
    } catch (error) {
      console.error('Could not generate inventory report:', error);
      res.status(500).json({ error: 'Could not generate inventory report. Check that migration 005 has been applied.' });
    }
  });
};

module.exports.reportPeriod = reportPeriod;
