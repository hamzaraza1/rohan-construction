// Phase 3 end-to-end check: contractors, contracts, scope, extras/deductions, payments.
// Creates real records — use a dev/test database.
// Usage: E2E_ADMIN_PASS=... E2E_VIEWER_USER=... E2E_VIEWER_PASS=... node e2e/contractors.cjs
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

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  page.on('pageerror', (e) => log('PAGEERROR', e.message));
  await login(page, ...ADMIN);
  const tag = Date.now().toString().slice(-5);

  // Client + project to work in.
  await go(page, '/clients/new');
  await page.fill('#name', `Client ${tag}`); await page.fill('#phone', '0300-0000000'); await submit(page);
  await page.waitForURL(/\/clients\/c/);
  await go(page, '/projects/new?clientId=' + page.url().split('/').pop());
  await page.fill('#name', `Site A ${tag}`); await page.fill('#siteAddress', 'Lahore'); await submit(page);
  await page.waitForURL(/\/projects\/c[a-z0-9]+$/);
  const projectPath = new URL(page.url()).pathname;

  // New contract → "+ New" contractor → back to the contract form with contractor preselected.
  await go(page, projectPath + '?tab=contracts');
  await page.click('a:has-text("New contract")'); await page.waitForLoadState('networkidle');
  await page.click('main a:has-text("+ New")'); await page.waitForLoadState('networkidle');
  await page.fill('#name', `Rafiq Builders ${tag}`); await page.fill('#phone', '0321-5555555');
  await page.fill('#specialization', 'Grey structure labour'); await submit(page);
  await page.waitForURL(/\/contracts\/new\?/);
  ok((await page.inputValue('#contractorId')) !== '', 'returned to contract form with new contractor selected');

  await page.fill('#title', 'Complete labour contract'); await page.fill('#contractAmount', '2,500,000');
  for (const [cat, v] of [['Brickwork', 'included'], ['Plaster', 'included'], ['Tiles', 'included'], ['Electrical', 'included'], ['Plumbing', 'included'], ['Paint', 'excluded'], ['Woodwork', 'excluded'], ['False Ceiling', 'excluded']]) {
    await page.selectOption(`select[aria-label="${cat} scope"]`, v);
  }
  await submit(page); await page.waitForURL(/\/contracts\/c[a-z0-9]+$/);
  const contractPath = new URL(page.url()).pathname;
  let t = await main(page);
  ok(/Agreed contract amount\s+Rs\. 2,500,000/.test(t), 'contract created with Rs. 2,500,000');
  ok(/Included[\s\S]*Brickwork[\s\S]*Excluded[\s\S]*Paint/.test(t), 'scope shows included and excluded work');
  ok(/Total paid\s+Rs\. 0/.test(t), 'commitment is not counted as paid');

  // Extras and deductions.
  const addAdj = async (type, amount, reason) => {
    await page.selectOption('#adj-type', type); await page.fill('#adj-amount', amount); await page.fill('#adj-reason', reason);
    await page.click('main button:has-text("Add")'); await page.waitForTimeout(1200);
  };
  await addAdj('EXTRA', '100000', 'Boundary wall'); await addAdj('DEDUCTION', '50000', 'Rework of plaster');
  t = await main(page);
  ok(/Net payable\s+Rs\. 2,550,000/.test(t), 'net payable = 2,500,000 + 100,000 − 50,000');

  // Advance, then installment.
  const pay = async (type, amount, overpay = false) => {
    await go(page, contractPath + '/payments/new');
    await page.selectOption('#type', type); await page.fill('#amount', amount);
    if (overpay) await page.check('input[name=allowOverpayment]');
    await submit(page);
  };
  await pay('ADVANCE', '500,000'); await page.waitForURL(B + contractPath);
  await pay('INSTALLMENT', '700,000'); await page.waitForURL(B + contractPath);
  t = await main(page);
  ok(/Total paid\s+Rs\. 1,200,000/.test(t), 'paid = 1,200,000');
  ok(/Remaining payable\s+Rs\. 1,350,000/.test(t), 'remaining = 1,350,000');

  // Overpayment is blocked unless confirmed.
  await pay('FINAL', '1,400,000');
  await page.waitForSelector('form [role=alert]');
  ok((await page.textContent('form [role=alert]')).includes('more than the remaining balance'), 'overpayment blocked without confirmation');
  ok((await page.inputValue('#amount')) === '1,400,000', 'amount kept after the error');
  await page.goBack();

  // Void the installment.
  await go(page, contractPath);
  await page.locator('tr', { hasText: 'Rs. 700,000' }).getByRole('button', { name: 'Void', exact: true }).click();
  await page.locator('dialog[open] textarea').fill('Wrong amount'); await page.locator('dialog[open] button:has-text("Void record")').click();
  await page.waitForSelector('text=Wrong amount'); await page.waitForTimeout(500);
  t = await main(page);
  ok(/Total paid\s+Rs\. 500,000/.test(t), 'voided installment no longer counts');

  // Progress.
  await page.fill('#progressPercent', '35'); await page.click('main button:has-text("Update progress")');
  await page.waitForSelector('text=Progress updated.');
  ok(true, 'progress updated');
  await page.screenshot({ path: path.join(OUT, 'p3-contract.png'), fullPage: true });

  // Project dashboard reflects the contractor payment once.
  await go(page, projectPath);
  t = await main(page);
  ok(/Contractor payments\s+Rs\. 500,000/.test(t), 'project shows contractor payments 500,000');
  ok(/Available cash balance\s+-Rs\. 500,000/.test(t), 'cash balance reduced only by the actual payment');
  ok(/Outstanding to contractors\s+Rs\. 2,050,000/.test(t), 'outstanding to contractors = 2,050,000');
  await go(page, projectPath + '?tab=contracts');
  await page.screenshot({ path: path.join(OUT, 'p3-project-contracts.png'), fullPage: true });
  await go(page, projectPath + '?tab=ledger');
  ok((await page.locator('tbody tr', { hasText: 'Contractor payment' }).count()) === 1, 'ledger has exactly one contractor payment');

  // Contractor profile.
  await go(page, '/contractors?q=' + tag);
  await Promise.all([page.waitForURL(/\/contractors\/c[a-z0-9]+$/), page.click(`a:has-text("Rafiq Builders ${tag}")`)]); await page.waitForLoadState('networkidle');
  t = await main(page);
  ok(/Total contract amounts\s+Rs\. 2,550,000/.test(t) && /Remaining payable\s+Rs\. 2,050,000/.test(t), 'contractor profile totals');
  await page.screenshot({ path: path.join(OUT, 'p3-contractor.png'), fullPage: true });

  // Read-only partner.
  const v = await (await browser.newContext()).newPage();
  await login(v, ...VIEWER);
  await go(v, contractPath);
  ok((await v.locator('a:has-text("Pay contractor")').count()) === 0 && (await v.locator('button:has-text("Update progress")').count()) === 0, 'viewer sees no write controls on contract');
  await go(v, contractPath + '/payments/new'); ok(v.url().endsWith('/forbidden'), 'viewer blocked from payment form');
  await go(v, '/contractors/new'); ok(v.url().endsWith('/forbidden'), 'viewer blocked from new contractor');

  // Phone width: no sideways scrolling.
  const m = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  await login(m, ...ADMIN);
  for (const u of [contractPath, projectPath + '?tab=contracts', '/contractors']) {
    await go(m, u);
    ok((await m.evaluate(() => document.documentElement.scrollWidth)) <= 390, `no horizontal scroll on phone: ${u.split('?')[0].split('/')[1]}`);
  }
  log('screenshots in', OUT);
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
