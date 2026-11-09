// End-to-end smoke test against a running server (creates real records — use a dev/test database).
// Usage: E2E_ADMIN_PASS=... E2E_VIEWER_USER=... E2E_VIEWER_PASS=... node e2e/smoke.cjs
const { chromium } = require('playwright');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), zlib = require('node:zlib');
const B = process.env.E2E_BASE ?? 'http://localhost:3000';
const ADMIN = [process.env.E2E_ADMIN_USER ?? 'hamza', process.env.E2E_ADMIN_PASS];
const VIEWER = [process.env.E2E_VIEWER_USER, process.env.E2E_VIEWER_PASS];
if (!ADMIN[1] || !VIEWER[0] || !VIEWER[1]) { console.error('Set E2E_ADMIN_PASS, E2E_VIEWER_USER, E2E_VIEWER_PASS'); process.exit(2); }
const SP = process.env.E2E_OUT ?? fs.mkdtempSync(path.join(os.tmpdir(), 'rc-e2e-'));
// Fixtures: a real PNG receipt and an HTML file disguised as a PDF.
function png(w, h) {
  const crc = (buf) => { let c, t = []; for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } let x = 0xffffffff; for (const b of buf) x = t[(x ^ b) & 0xff] ^ (x >>> 8); return (x ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr.set([8, 2, 0, 0, 0], 8);
  const raw = Buffer.concat(Array.from({ length: h }, () => Buffer.concat([Buffer.from([0]), Buffer.alloc(w * 3, 0xaa)])));
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
fs.writeFileSync(path.join(SP, 'receipt.png'), png(40, 20));
fs.writeFileSync(path.join(SP, 'evil.pdf'), '<html><script>alert(1)</script></html>');
const log = (...a) => console.log(...a);
const ok = (cond, msg) => { if (!cond) { console.error('FAIL:', msg); process.exitCode = 1; } else log('ok -', msg); };
async function login(page, u, p) {
  await page.goto(B + '/login'); await page.waitForLoadState('networkidle');
  await page.fill('#username', u); await page.fill('#password', p); await page.click('button[type=submit]');
  await page.waitForURL(B + '/');
}
const go = async (page, url) => { await page.goto(B + url); await page.waitForLoadState('networkidle'); };
const text = (page) => page.locator('main').innerText();

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  page.on('pageerror', e => log('PAGEERROR', e.message));
  await login(page, ...ADMIN);
  const tag = Date.now().toString().slice(-5);

  // --- client with validation error first
  await go(page, '/clients/new');
  await page.fill('#name', `Mr. Ahmed Khan ${tag}`); await page.fill('#phone', 'abc');
  await page.click('main button[type=submit]'); await page.waitForSelector('text=Enter a phone number');
  ok(await page.inputValue('#name') === `Mr. Ahmed Khan ${tag}`, 'form keeps typed values after validation error');
  await page.fill('#phone', '0300-1234567'); await page.fill('#email', 'ahmed@example.com');
  await page.click('main button[type=submit]'); await page.waitForURL(/\/clients\/c/);
  const clientUrl = page.url();
  ok((await text(page)).includes('0300-1234567'), 'client created and profile shown');

  // --- commission project; check missing % error
  await go(page, '/projects/new?clientId=' + clientUrl.split('/').pop());
  await page.fill('#name', `Site B Commission ${tag}`); await page.fill('#siteAddress', 'Plot 12, Bahria Town, Lahore');
  await page.check('input[value=COMMISSION]');
  await page.click('main button[type=submit]'); await page.waitForTimeout(800);
  ok((await text(page)).includes('Enter a percentage') || (await page.locator('#commissionPercent:invalid').count()) > 0, 'commission % required');
  await page.fill('#commissionPercent', '12');
  await page.click('main button[type=submit]'); await page.waitForURL(/\/projects\/c[a-z0-9]+$/);
  const projectUrl = page.url();
  ok((await text(page)).includes('Commission Based · 12%'), 'commission project created with 12%');
  await page.screenshot({ path: path.join(SP, 'p2-project-empty.png'), fullPage: true });

  // --- record payment with receipt; reject disguised file first
  await go(page, projectUrl.replace(B, '') + '/payments/new');
  await page.fill('#amount', '1,000,000'); await page.selectOption('#method', 'BANK_TRANSFER');
  await page.fill('#reference', 'TRX-889'); await page.fill('#description', 'First installment');
  await page.setInputFiles('#attachment', path.join(SP, 'evil.pdf'));
  await page.click('main button[type=submit]'); await page.waitForSelector('form [role=alert]');
  ok((await page.textContent('form [role=alert]')).includes('Only PDF, JPG, PNG'), 'HTML disguised as .pdf is rejected');
  ok(await page.inputValue('#amount') === '1,000,000', 'amount kept after upload rejection');
  await page.setInputFiles('#attachment', path.join(SP, 'receipt.png'));
  await page.click('main button[type=submit]'); await page.waitForURL(/tab=payments/);
  ok((await text(page)).includes('Rs. 1,000,000'), 'payment saved');
  const href = await page.locator('a:has-text("Receipt")').first().getAttribute('href');
  const resp = await page.request.get(B + href);
  ok(resp.status() === 200 && resp.headers()['content-type'] === 'image/png', 'receipt downloadable as image/png');

  // second payment then edit then void
  await go(page, projectUrl.replace(B, '') + '/payments/new');
  await page.fill('#amount', '250000'); await page.selectOption('#method', 'CASH');
  await page.click('main button[type=submit]'); await page.waitForURL(/tab=payments/);
  await page.locator('tr', { hasText: 'Rs. 250,000' }).locator('a:has-text("Edit")').click();
  await page.waitForLoadState('networkidle');
  await page.fill('#amount', '200000'); await page.click('main button[type=submit]'); await page.waitForURL(/tab=payments/);
  ok((await text(page)).includes('Rs. 200,000'), 'payment edited to 200,000');
  await page.locator('tr', { hasText: 'Rs. 200,000' }).getByRole('button', { name: 'Void', exact: true }).click();
  await page.locator('dialog[open] textarea').fill('Entered by mistake');
  await page.locator('dialog[open] button:has-text("Void record")').click();
  await page.waitForSelector('text=Voided'); await page.waitForTimeout(500);
  ok((await text(page)).includes('Entered by mistake'), 'payment voided with reason shown');
  await page.screenshot({ path: path.join(SP, 'p2-payments.png'), fullPage: true });

  // dashboard numbers
  await go(page, projectUrl.replace(B, ''));
  const t = await text(page);
  ok(/Client payments received\s+Rs\. 1,000,000/.test(t), 'received excludes voided payment');
  ok(t.includes('Client has paid in advance'), 'commission billing shows client ahead (no costs yet)');
  await page.screenshot({ path: path.join(SP, 'p2-project.png'), fullPage: true });

  // ledger
  await go(page, projectUrl.replace(B, '') + '?tab=ledger');
  ok((await text(page)).includes('Totals for period'), 'ledger renders');
  await page.screenshot({ path: path.join(SP, 'p2-ledger.png'), fullPage: true });

  // edit project: client locked
  await go(page, projectUrl.replace(B, '') + '/edit');
  ok((await text(page)).includes('Locked: client payments'), 'client locked after payments');

  // project list & client page
  await go(page, '/projects?q=' + tag);
  ok((await page.locator('tbody tr').count()) === 1, 'project search works');
  await go(page, clientUrl.replace(B, ''));
  ok((await text(page)).includes('Payment history'), 'client profile with history');
  await page.screenshot({ path: path.join(SP, 'p2-client.png'), fullPage: true });

  // --- viewer
  const v = await (await browser.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
  await login(v, ...VIEWER);
  await go(v, projectUrl.replace(B, '') + '?tab=payments');
  ok((await v.locator('a:has-text("Record")').count()) === 0 && (await v.getByRole('button', { name: 'Void', exact: true }).count()) === 0, 'viewer sees no write buttons');
  ok((await v.request.get(B + href)).status() === 200, 'viewer can open receipts');
  await go(v, '/projects/new'); ok(v.url().endsWith('/forbidden'), 'viewer blocked from new project page');
  await go(v, projectUrl.replace(B, '') + '/edit'); ok(v.url().endsWith('/forbidden'), 'viewer blocked from edit page');
  const anon = await browser.newContext();
  ok((await anon.request.get(B + href, { maxRedirects: 0 })).status() !== 200, 'anonymous cannot fetch receipts');

  // mobile
  const m = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage();
  await login(m, ...ADMIN);
  await go(m, projectUrl.replace(B, ''));
  await m.screenshot({ path: path.join(SP, 'p2-mobile.png'), fullPage: true });
  await browser.close();
  log('screenshots in', SP);
})().catch(e => { console.error(e); process.exit(1); });

