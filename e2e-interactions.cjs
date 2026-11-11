// Stage 1 frontend interaction checks. Run against a running app:
//   E2E_BASE=http://localhost:3000 node e2e-interactions.cjs
const { chromium } = require("playwright");
const BASE = process.env.E2E_BASE || "http://localhost:3000";
let pass = 0, fail = 0;
const visible = (loc) => loc.waitFor({ state: "visible", timeout: 5000 }).then(() => true, () => false);
const check = (name, ok, extra = "") => { ok ? pass++ : fail++; console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  — " + extra : ""}`); };

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  const dialog = () => page.getByRole("dialog");

  // 1. Login validation + sign in
  await page.goto(BASE + "/login");
  await page.getByRole("button", { name: "Sign in" }).click();
  check("login shows validation errors", await visible(page.getByText("Email is required")) && await visible(page.getByText("Password is required")));
  await page.fill("#password", "secret12");
  await page.getByRole("button", { name: "Show password" }).click();
  check("show/hide password toggles", (await page.getAttribute("#password", "type")) === "text");
  await page.fill("#email", "nobody@x.pk");
  await page.getByRole("button", { name: "Sign in" }).click();
  check("unknown email rejected", await visible(page.getByText("No account with this email")));
  await page.getByRole("button", { name: /Admin: hamza/ }).click();
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(BASE + "/");
  check("admin signs in to dashboard", await visible(page.getByRole("heading", { name: "Company overview" })));
  const cashBefore = await page.locator("text=Available cash").locator("..").locator("..").innerText();

  // 2. Add contractor with validation
  await page.getByRole("link", { name: "Contractors" }).first().click();
  await page.getByRole("button", { name: "Add contractor" }).click();
  await dialog().getByRole("button", { name: "Add contractor" }).click();
  check("contractor form: required errors", await visible(dialog().getByText("Name is required")) && await visible(dialog().getByText("Phone number is required")));
  await page.fill("#name", "Test Waterproofing Co");
  await page.fill("#phone", "12345");
  await dialog().getByRole("button", { name: "Add contractor" }).click();
  check("contractor form: bad phone rejected", await visible(dialog().getByText(/Pakistani number/)));
  await page.fill("#phone", "0300-1112223");
  await dialog().getByText("Excavation").click();
  await dialog().getByRole("button", { name: "Add contractor" }).click();
  await dialog().waitFor({ state: "detached" });
  await page.getByPlaceholder("Search name, phone, CNIC…").fill("Waterproofing");
  check("new contractor appears in list", await visible(page.getByRole("link", { name: "Test Waterproofing Co" })));

  // 3. Create project
  await page.goto(BASE + "/projects/new");
  await page.getByRole("button", { name: "Create project" }).click();
  check("project form: validation", await visible(page.getByText("Project name is required")));
  check("no project-type selector", (await page.getByLabel(/project type/i).count()) === 0);
  await page.fill("#name", "Test Garden Town House");
  await page.selectOption("#clientId", { label: "Nadia Hussain" });
  await page.fill("#siteAddress", "House 9, Garden Town");
  await page.fill("#contractValue", "15000000");
  await page.getByRole("button", { name: "Create project" }).click();
  await page.waitForURL(/\/projects\/n/);
  check("project created and opened", await visible(page.getByRole("heading", { name: "Test Garden Town House" })));
  const newProjectUrl = page.url();

  // 4. Record client payment from project Add-entry menu
  await page.getByRole("button", { name: "Add entry" }).click();
  await page.getByRole("menuitem", { name: /Client payment/ }).click();
  await page.fill("#amount", "2,500,000");
  await page.fill("#bankName", "HBL");
  await dialog().getByRole("button", { name: "Record payment" }).click();
  await dialog().waitFor({ state: "detached" });
  check("payment updates project cash", await visible(page.getByText("Rs. 25 Lac").first()));

  // 5. Receive material, then over-consumption is blocked
  await page.getByRole("button", { name: "Add entry" }).click();
  await page.getByRole("menuitem", { name: /Receive material/ }).click();
  await page.selectOption("#supplierId", { label: "Al-Madina Cement Traders" });
  await dialog().getByLabel("Material").selectOption({ label: "Cement (OPC) (bag)" });
  await dialog().getByLabel("Quantity").fill("100");
  await dialog().getByLabel("Rate").fill("1450");
  check("delivery total computed", await visible(dialog().getByText("Total: Rs. 145,000")));
  await dialog().getByRole("button", { name: "Save delivery" }).click();
  await dialog().waitFor({ state: "detached" });
  await page.getByRole("tab", { name: "Inventory" }).click();
  check("stock shows received cement", await visible(page.getByRole("cell", { name: "100 bag" }).first()));
  await page.getByRole("button", { name: "Use", exact: true }).click();
  await page.fill("#quantity", "150");
  await dialog().getByRole("button", { name: "Save" }).click();
  check("cannot consume more than stock", await visible(dialog().getByText(/Only 100 bag in stock/)));
  await page.fill("#quantity", "40");
  await dialog().getByRole("button", { name: "Save" }).click();
  await dialog().waitFor({ state: "detached" });
  check("consumption reduces stock", await visible(page.getByRole("cell", { name: "60 bag" }).first()));
  await page.getByRole("tab", { name: "Suppliers" }).click();
  check("supplier outstanding = delivery value", await visible(page.getByText("Rs. 145,000").first()));

  // 6. Expense with attachment, then delete with confirmation
  await page.goto(BASE + "/expenses");
  await page.getByRole("button", { name: "Add expense" }).click();
  await page.selectOption("#projectId", { label: "RC-2601 · DHA Phase 6 Residence" });
  await page.selectOption("#categoryId", { label: "Transport & Freight" });
  await page.fill("#amount", "12345");
  await page.fill("#paidTo", "Test loader");
  await page.fill("#description", "Test shifting of shuttering");
  await dialog().locator('input[type=file]').setInputFiles({ name: "bill.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 test") });
  check("receipt attached in form", await visible(dialog().getByText("bill.pdf")));
  await dialog().getByRole("button", { name: "Add expense" }).click();
  await dialog().waitFor({ state: "detached" });
  await page.getByPlaceholder("Search description, paid to…").fill("Test shifting");
  check("expense appears with receipt", await visible(page.getByText("Test shifting of shuttering")) && await visible(page.getByText("bill.pdf")));
  await page.getByRole("button", { name: "Delete" }).first().click();
  check("delete asks for confirmation", await visible(dialog().getByText("Delete this expense?")));
  await dialog().getByRole("button", { name: "Delete" }).click();
  await page.waitForTimeout(200);
  check("expense deleted", (await page.getByText("Test shifting of shuttering").count()) === 0);

  // 7. Sorting + pagination on expenses
  await page.getByPlaceholder("Search description, paid to…").fill("");
  const firstAmount = async () => (await page.locator("tbody tr").first().locator("td").nth(6).innerText()).trim();
  await page.getByRole("button", { name: /^Amount/ }).click();
  const desc = await firstAmount();
  await page.getByRole("button", { name: /^Amount/ }).click();
  const asc = await firstAmount();
  check("sorting changes order", desc !== asc, `${desc} vs ${asc}`);
  const showing1 = await page.getByText(/^Showing/).innerText();
  await page.getByRole("button", { name: "Next page" }).click();
  check("pagination moves to page 2", (await page.getByText(/^Showing/).innerText()) !== showing1);
  await page.getByLabel("Date range").selectOption("this_month");
  check("date filter narrows rows", (await page.getByText(/^Showing/).innerText()) !== showing1);

  // 8. Withdrawal
  await page.goto(BASE + "/withdrawals");
  await page.getByRole("button", { name: "Record withdrawal" }).click();
  await page.selectOption("#partnerId", { label: "Usman Tariq" });
  await page.selectOption("#projectId", { label: "RC-2601 · DHA Phase 6 Residence" });
  await page.fill("#amount", "111000");
  check("withdrawal shows cash after", await visible(dialog().getByText(/After this withdrawal/)));
  await dialog().getByRole("button", { name: "Record withdrawal" }).click();
  await dialog().waitFor({ state: "detached" });
  check("withdrawal listed", await visible(page.getByRole("cell", { name: "Rs. 111,000" })));

  // 9. Reports export
  await page.goto(BASE + "/reports?tab=expenses");
  const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Export Excel" }).click()]);
  const csv = require("fs").readFileSync(await dl.path(), "utf8");
  check("Excel export downloads CSV", dl.suggestedFilename().endsWith(".csv") && csv.includes("Date,Project,Category"));

  // 10. Persistence across reload
  await page.goto(newProjectUrl);
  check("data kept after reload", await visible(page.getByRole("heading", { name: "Test Garden Town House" })));

  // 11. Global search
  await page.getByPlaceholder(/Search projects, clients/).fill("Gulberg");
  await page.getByRole("link", { name: /Gulberg Commercial Plaza/ }).click();
  check("global search navigates", await visible(page.getByRole("heading", { name: "Gulberg Commercial Plaza" })));

  // 12. Partner (read-only) view
  await page.getByRole("button", { name: /Hamza Raza/ }).click();
  await page.getByRole("menuitem", { name: /Preview partner/ }).click();
  check("partner: no Add entry / Edit", (await page.getByRole("button", { name: "Add entry" }).count()) === 0 && (await page.getByRole("link", { name: "Edit" }).count()) === 0);
  await page.goto(BASE + "/contractors");
  check("partner: no Add contractor, no row actions", (await page.getByRole("button", { name: "Add contractor" }).count()) === 0 && (await page.getByRole("button", { name: "Delete" }).count()) === 0);
  check("partner: Settings hidden from menu", (await page.getByRole("link", { name: "Settings" }).count()) === 0);
  await page.goto(BASE + "/settings");
  check("partner: settings shows read-only", await visible(page.getByText("Read-only access").first()));
  await page.getByRole("button", { name: /Bilal Ahmed/ }).click();
  await page.getByRole("menuitem", { name: /Switch back to admin/ }).click();

  // 13. Reset demo data
  await page.goto(BASE + "/settings?tab=general");
  await page.getByRole("button", { name: "Reset demo data" }).click();
  await dialog().getByRole("button", { name: "Reset" }).click();
  await page.goto(BASE + "/projects");
  check("reset removes test project", (await page.getByText("Test Garden Town House").count()) === 0);

  // 14. Mobile navigation
  const m = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const mp = await m.newPage();
  await mp.goto(BASE + "/");
  await mp.getByRole("button", { name: "Open menu" }).click();
  await mp.getByRole("link", { name: "Suppliers" }).click();
  await mp.waitForURL(BASE + "/suppliers");
  check("mobile drawer navigates", await visible(mp.getByRole("heading", { name: "Suppliers" })));
  await mp.getByRole("button", { name: "Add supplier" }).click();
  const box = await mp.getByRole("dialog").boundingBox();
  check("mobile modal fits screen", box && box.width <= 390 && box.x >= 0);
  await m.close();

  check("no page errors", errors.length === 0, errors.slice(0, 2).join(" | "));
  console.log(`\n${pass} passed, ${fail} failed`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
