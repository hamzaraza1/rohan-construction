// Phase 4 end-to-end check: suppliers, purchase orders, advances, receipts, inventory.
// Follows the requirements example: order Rs. 500,000, advance Rs. 300,000, gradual delivery.
// Creates real records — use a dev/test database.
// Usage: E2E_ADMIN_PASS=... E2E_VIEWER_USER=... E2E_VIEWER_PASS=... node e2e/suppliers.cjs
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { chromium } = require('playwright');
const B = process.env.E2E_BASE ?? 'http://localhost:3000';
const ADMIN = [process.env.E2E_ADMIN_USER ?? 'hamza', process.env.E2E_ADMIN_PASS];
const VIEWER = [process.env.E2E_VIEWER_USER, process.env.E2E_VIEWER_PASS];
if (!ADMIN[1] || !VIEWER[0] || !VIEWER[1]) { console.error('Set E2E_ADMIN_PASS, E2E_VIEWER_USER, E2E_VIEWER_PASS'); process.exit(2); }
const OUT = process.env.E2E_OUT ?? fs.mkdtempSync(path.join(os.tmpdir(), 'rc-e2e-'));
const log = (...a) => console.log(...a);
const ok = (c, m) => { if (!c) { console.error('FAIL:', m); process.exitCode = 1; } else log('ok -', m); };
async function login(page, u, p) {
  await page.goto(B + '/login'); await page.waitForLoadState('networkidle');
  await page.fill('#username', u); await page.fill('#password', p); await page.click('button[type=submit]');
  await page.waitForURL(B + '/');
}
const go = async (page, url) => { await page.goto(url.startsWith('http') ? url : B + url); await page.waitForLoadState('networkidle'); };
const main = (page) => page.locator('main').innerText();
const submit = (page) => page.click('main button[type=submit]:visible >> nth=-1');
const money = (t, label, value) => new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s+' + value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(t);

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  page.on('pageerror', (e) => log('PAGEERROR', e.message));
  await login(page, ...ADMIN);
  const tag = Date.now().toString().slice(-5);
  const cement = `OPC Cement ${tag}`;

  // Material in catalogue.
  await go(page, '/inventory/materials');
  await page.fill('#new-name', cement); await page.fill('#new-unit', 'bag');
  await page.selectOption('#new-cat', { label: 'Cement' });
  await page.click('main button:has-text("Add material")'); await page.waitForSelector(`input[value="${cement}"]`);
  ok(true, 'material added to catalogue');

  // Client + project.
  await go(page, '/clients/new'); await page.fill('#name', `Client ${tag}`); await page.fill('#phone', '0300-1111111'); await submit(page);
  await page.waitForURL(/\/clients\/c/);
  await go(page, '/projects/new?clientId=' + page.url().split('/').pop());
  await page.fill('#name', `Site S ${tag}`); await page.fill('#siteAddress', 'Lahore'); await submit(page);
  await page.waitForURL(/\/projects\/c[a-z0-9]+$/);
  const projectPath = new URL(page.url()).pathname;

  // Purchase order with a new supplier created on the way.
  await go(page, projectPath + '?tab=suppliers');
  await page.click('a:has-text("New purchase order")'); await page.waitForLoadState('networkidle');
  await page.click('main a:has-text("+ New")'); await page.waitForLoadState('networkidle');
  await page.fill('#name', `Lucky Traders ${tag}`); await page.fill('#phone', '042-3333333');
  await page.check('label:has-text("Cement") input[name=categoryIds]'); await submit(page);
  await page.waitForURL(/\/purchase-orders\/new\?/);
  ok((await page.inputValue('#supplierId')) !== '', 'back on PO form with new supplier selected');
  await page.selectOption('select[aria-label="Line 1 material"]', { label: `${cement} (bag)` });
  await page.fill('input[aria-label="Line 1 quantity"]', '1000'); await page.fill('input[aria-label="Line 1 rate"]', '500');
  ok((await main(page)).includes('Rs. 500,000'), 'line total shown live');
  await submit(page); await page.waitForURL(/\/purchase-orders\/c[a-z0-9]+$/);
  const poPath = new URL(page.url()).pathname;
  let t = await main(page);
  ok(money(t, 'Order value', 'Rs. 500,000'), 'PO created for Rs. 500,000');

  const supplierTab = async () => { await go(page, projectPath + '?tab=suppliers'); return main(page); };
  t = await supplierTab();
  ok(money(t, 'Paid to suppliers', 'Rs. 0') && money(t, 'Material received', 'Rs. 0'), 'order alone moves no cash and adds no material');

  // Advance Rs. 300,000 against the order.
  await go(page, poPath); await page.click('a:has-text("Pay supplier")'); await page.waitForLoadState('networkidle');
  ok((await page.inputValue('#type')) === 'ADVANCE', 'payment type defaults to Advance when nothing is owed');
  await page.fill('#amount', '300,000'); await submit(page); await page.waitForURL(/tab=suppliers/);
  t = await main(page);
  ok(money(t, 'Advance balance', 'Rs. 300,000') && money(t, 'Material received', 'Rs. 0'), 'advance is not material received');

  // Deliveries.
  const receive = async (qty) => {
    await go(page, poPath); await page.click('a:has-text("Receive material")'); await page.waitForLoadState('networkidle');
    await page.fill('input[aria-label="Line 1 quantity"]', qty); await submit(page);
  };
  await receive('400'); await page.waitForURL(/\/receipts\/c/);
  t = await supplierTab();
  ok(money(t, 'Material received', 'Rs. 200,000') && money(t, 'Advance balance', 'Rs. 100,000') && money(t, 'Outstanding payable', 'Rs. 0') && money(t, 'Undelivered orders', 'Rs. 300,000'),
    'after 400 bags: received 200,000 · advance 100,000 · payable 0 · undelivered 300,000');
  await receive('500'); await page.waitForURL(/\/receipts\/c/);
  t = await supplierTab();
  ok(money(t, 'Material received', 'Rs. 450,000') && money(t, 'Advance balance', 'Rs. 0') && money(t, 'Outstanding payable', 'Rs. 150,000') && money(t, 'Undelivered orders', 'Rs. 50,000'),
    'after 500 more: received 450,000 · advance 0 · payable 150,000 · undelivered 50,000');

  // Over-delivery blocked.
  await receive('200');
  await page.waitForSelector('form [role=alert]');
  ok((await page.textContent('form [role=alert]')).includes('only 100 remain'), 'receiving more than ordered is blocked');

  // Pay the balance; close the order.
  await go(page, `/supplier-payments/new?projectId=${projectPath.split('/').pop()}&supplierId=` + (await page.locator('input[name=supplierId]').first().inputValue().catch(() => '')));
  if (!(await page.locator('#amount').count())) {
    await go(page, poPath); await page.click('a:has-text("Pay supplier")'); await page.waitForLoadState('networkidle');
  }
  ok((await page.inputValue('#amount')) === '150000' && (await page.inputValue('#type')) === 'PAYMENT', 'payment form pre-filled with payable 150,000');
  await submit(page); await page.waitForURL(/tab=suppliers/);
  await go(page, poPath);
  await page.click('main button:has-text("Close order")'); await page.locator('dialog[open] button:has-text("Close order")').click();
  await page.waitForSelector('main >> text=Closed'); await page.waitForTimeout(500);
  t = await supplierTab();
  ok(money(t, 'Outstanding payable', 'Rs. 0') && money(t, 'Undelivered orders', 'Rs. 0') && money(t, 'Paid to suppliers', 'Rs. 450,000'), 'settled: payable 0, order closed, paid 450,000');
  await page.screenshot({ path: path.join(OUT, 'p4-suppliers-tab.png'), fullPage: true });

  // Inventory: 900 bags in stock; issue 600; cannot over-issue; wastage 10.
  await go(page, projectPath + '?tab=inventory');
  t = await main(page);
  ok(t.includes('900 bag'), 'stock shows 900 bags received');
  const move = async (type, qty, notes = '') => {
    await page.selectOption('#mv-type', type); await page.selectOption('#mv-material', { index: 1 });
    await page.fill('#mv-qty', qty); if (notes) await page.fill('#mv-notes', notes);
    const loc = page.locator('form [role=alert], form [role=status]');
    const before = (await loc.count()) ? await loc.first().textContent() : null;
    await page.click('main button:has-text("Save stock entry")');
    await page.waitForFunction((prev) => {
      const el = document.querySelector('form [role=alert], form [role=status]');
      return el && (el.textContent !== prev || el.getAttribute('data-n') === null);
    }, before);
    await page.waitForTimeout(600);
    const msg = await loc.first().textContent(); log('   message:', msg); return msg;
  };
  ok((await move('ISSUE', '600', 'Slab')).includes('Issue recorded'), 'issued 600 bags');
  ok((await move('ISSUE', '400')).toLowerCase().includes('insufficient stock'), 'cannot issue more than in stock');
  ok((await move('WASTAGE', '10', 'Bags burst')).includes('Wastage recorded'), 'wastage recorded');
  await go(page, projectPath + '?tab=inventory');
  t = await main(page);
  ok(t.includes('290 bag') && t.includes('Rs. 145,000'), 'stock 290 bags valued at Rs. 145,000');
  await page.screenshot({ path: path.join(OUT, 'p4-inventory.png'), fullPage: true });

  // Project cost counts material once (on receipt), not again on payment or use.
  await go(page, projectPath);
  t = await main(page);
  ok(money(t, 'Total actual expenses', 'Rs. 450,000'), 'project cost = 450,000 (no double counting)');
  ok(money(t, 'Available cash balance', '-Rs. 450,000'), 'cash = −450,000 (advance + payment)');

  // Direct cash purchase without an order.
  await go(page, `/receipts/new?projectId=${projectPath.split('/').pop()}`);
  await page.selectOption('#supplierId', { label: `Lucky Traders ${tag}` });
  await page.selectOption('select[aria-label="Line 1 material"]', { label: `${cement} (bag)` });
  await page.fill('input[aria-label="Line 1 quantity"]', '10'); await page.fill('input[aria-label="Line 1 rate"]', '520');
  await page.check('input[name=paidNow]'); await submit(page); await page.waitForURL(/\/receipts\/c/);
  t = await supplierTab();
  ok(money(t, 'Outstanding payable', 'Rs. 0') && money(t, 'Material received', 'Rs. 455,200'), 'cash purchase: received +5,200 and paid in full');

  // Read-only partner.
  const v = await (await browser.newContext()).newPage();
  await login(v, ...VIEWER);
  await go(v, projectPath + '?tab=inventory');
  ok((await v.locator('button:has-text("Save stock entry")').count()) === 0, 'viewer cannot record stock usage');
  await go(v, poPath);
  ok((await v.locator('a:has-text("Receive material")').count()) === 0, 'viewer sees no receive button');
  await go(v, `/receipts/new?projectId=${projectPath.split('/').pop()}`); ok(v.url().endsWith('/forbidden'), 'viewer blocked from receipt form');

  // Phone width.
  const m = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  await login(m, ...ADMIN);
  for (const u of [projectPath + '?tab=suppliers', projectPath + '?tab=inventory', poPath, '/suppliers', '/inventory/materials']) {
    await go(m, u);
    ok((await m.evaluate(() => document.documentElement.scrollWidth)) <= 390, `no horizontal scroll on phone: ${u}`);
  }
  log('screenshots in', OUT);
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
