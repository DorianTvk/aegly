// Pakett ja kinkekaart broneerimisel + poe vaated: BASE_URL=http://localhost:3100 DATABASE_URL=... node scripts/shop-e2e.mjs
import puppeteer from "puppeteer-core";
import { execSync } from "node:child_process";
const B = process.env.BASE_URL ?? "http://localhost:3000";
const DB = process.env.DATABASE_URL ?? "postgresql://aegly:aegly@localhost:5432/aegly";
const sql = (q) => execSync(`psql ${DB} -qtAc "${q.replace(/"/g, '\\"')}"`).toString().trim();
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH ?? "/usr/bin/google-chrome", args: ["--no-sandbox"] });
const page = await browser.newPage(); await page.setViewport({ width: 1200, height: 900 });
const errors = []; page.on("pageerror", (e) => errors.push(String(e)));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const text = () => page.evaluate(() => document.body.innerText);
let fails = 0;
const check = (n, ok) => { console.log(ok ? "OK  " : "FAIL", n); if (!ok) fails++; };
const click = async (sel) => { await page.waitForSelector(sel, { timeout: 8000 }); await page.click(sel); };

// andmed: pakett (5× klassikaline massaaž) kliendile + kinkekaart 20 €
const biz = sql("select id from businesses where slug='studio-lumi'");
const svc = sql(`select id from services where business_id='${biz}' and name='Klassikaline massaaž'`);
const T = Date.now();
const pkgEmail = `pakett${T}@example.com`, giftEmail = `kink${T}@example.com`;
const pkg = sql(`insert into packages (id, business_id, type, name, price_cents, sell_in_widget) values ('pk${T}', '${biz}', 'MULTI_VISIT', 'Massaaž 5×', 20000, false) on conflict do nothing returning id`);
sql(`insert into package_items (package_id, service_id, quantity) values ('${pkg}', '${svc}', 5)`);
const cl = sql(`insert into clients (id, business_id, name, email) values ('cl${T}', '${biz}', 'Paula Pakett', '${pkgEmail}') returning id`);
const cp = sql(`insert into client_packages (id, client_id, package_id, uses_total, uses_left) values ('cp${T}', '${cl}', '${pkg}', 5, 5) returning id`);
const code = `GC-T${String(T).slice(-3)}-ABC`;
sql(`insert into gift_cards (id, business_id, code, value_cents, balance_cents, expires_at) values ('gc${T}', '${biz}', '${code}', 2000, 2000, now() + interval '1 year')`);

async function toDetails() {
  await page.goto(B + "/w/studio-lumi?lang=et", { waitUntil: "networkidle0" });
  await click("button[aria-label='Vali Klassikaline massaaž']"); await wait(300);
  await click("button ::-p-text(Jätka)"); await wait(2000);
  if ((await text()).includes("Vali spetsialist")) { await click("button ::-p-text(Jätka)"); await wait(2000); }
  await click("button[aria-label='Järgmine nädal']"); await wait(2000);
  for (let i = 0; i < 14 && !(await page.$("[role=radiogroup][aria-label=Kellaaeg] button")); i++) {
    await page.evaluate(() => { const b = [...document.querySelectorAll(".grid-cols-7 button")]; const sel = b.findIndex((x) => x.getAttribute("aria-pressed") === "true"); if (sel < b.length - 1) b[sel + 1].click(); else document.querySelector("button[aria-label='Järgmine nädal']").click(); });
    await wait(1500);
  }
  await click("[role=radiogroup][aria-label=Kellaaeg] button"); await wait(200);
  await click("button ::-p-text(Jätka)"); await wait(1500);
}
const fill = async (name, email) => {
  await page.type("#w-name", name); await page.type("#w-email", email); await page.type("#w-phone", "5123 4567");
  await page.evaluate(() => [...document.querySelectorAll("label")].find((l) => l.textContent.includes("broneerimistingimustega")).querySelector("input").click());
};

// 1. pakett
await toDetails();
await fill("Paula Pakett", pkgEmail);
await click("button ::-p-text(Jätka)"); await wait(2000);
let t = await text();
check("pakett pakutakse", t.includes("Kasuta paketti „Massaaž 5×“ (jäänud 5 korda)"));
check("pakett katab", t.includes("Pakett katab selle aja"));
await page.screenshot({ path: "/tmp/shop_pkg_confirm.png" });
await click("button ::-p-text(Kinnita broneering)"); await wait(2500);
t = await text();
check("broneeritud paketiga", t.includes("Aeg on broneeritud!"));
check("kord maha arvatud", sql(`select uses_left from client_packages where id='${cp}'`) === "4");
const manage = await page.$eval("a[href^='/b/']:not([href$='.ics'])", (a) => a.href);
await page.goto(manage, { waitUntil: "networkidle0" });
await click("button ::-p-text(Tühista broneering)"); await wait(300);
await click("button ::-p-text(Haigestusin)");
await click("button ::-p-text(Jah, tühista)"); await wait(2000);
check("tühistamisel kord tagasi", sql(`select uses_left from client_packages where id='${cp}'`) === "5");

// 2. kinkekaart
await toDetails();
await fill("Kai Kink", giftEmail);
await click("button ::-p-text(Mul on kinkekaart)"); await wait(200);
await page.type("#w-gift", "gc-t" + String(T).slice(-3) + "abc");
await click("#w-gift + button"); await wait(1500);
t = await text();
check("kinkekaart rakendatud", t.includes(`${code}: kasutatakse 20,00 €`));
await click("button ::-p-text(Jätka)"); await wait(2000);
t = await text();
check("kinnitusel kinkekaardi rida", t.includes(`Kinkekaart ${code}`));
await page.screenshot({ path: "/tmp/shop_gift_confirm.png" });
const btn = await page.$$eval("button", (b) => b.map((x) => x.textContent).find((x) => /Maksa ettemaks|Kinnita broneering/.test(x)));
if (btn?.includes("Kinnita")) {
  await click("button ::-p-text(Kinnita broneering)"); await wait(2500);
  check("broneeritud kinkekaardiga", (await text()).includes("Aeg on broneeritud!"));
  check("saldo maha arvatud", sql(`select balance_cents from gift_cards where code='${code}'`) === "0");
  check("kasutus kirjas", sql(`select count(*) from gift_card_redemptions where gift_card_id='gc${T}' and booking_id is not null`) === "1");
} else console.log("(ettemaksuga – broneerimine vajab Stripe'i, jätan vahele)");

// 3. vale kood
await toDetails();
await fill("Vale Kood", `vale${T}@example.com`);
await click("button ::-p-text(Mul on kinkekaart)"); await page.type("#w-gift", "GC-XXXX-YYY"); await click("#w-gift + button"); await wait(1500);
check("vale kood → viga", (await text()).includes("Sellist kinkekaarti ei ole"));

console.log("errors:", errors);
await browser.close();
process.exit(fails ? 1 : 0);
