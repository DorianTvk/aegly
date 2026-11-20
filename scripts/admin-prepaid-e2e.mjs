// Halduspaneel: paketi müük, kasutamine käsitsi broneeringul, GDPR eksport ja kustutamine
import puppeteer from "puppeteer-core";
import { execSync } from "node:child_process";
const B = process.env.BASE_URL ?? "http://localhost:3000";
const DB = process.env.DATABASE_URL ?? "postgresql://aegly:aegly@localhost:5432/aegly";
const sql = (q) => execSync(`psql ${DB} -qtAc "${q.replace(/"/g, '\\"')}"`).toString().trim();
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH ?? "/usr/bin/google-chrome", args: ["--no-sandbox"] });
const page = await browser.newPage(); await page.setViewport({ width: 1280, height: 950 });
const errors = []; page.on("pageerror", (e) => errors.push(String(e)));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const text = () => page.evaluate(() => document.body.innerText);
let fails = 0;
const check = (n, ok) => { console.log(ok ? "OK  " : "FAIL", n); if (!ok) fails++; };
const clickText = async (sel, t) => { for (const e of await page.$$(sel)) if ((await e.evaluate((x) => x.textContent)).includes(t)) { await e.click(); return true; } return false; };

const biz = sql("select id from businesses where slug='studio-lumi'");
const T = Date.now();
const cl = sql(`insert into clients (id, business_id, name, email, phone) values ('ac${T}', '${biz}', 'Anu Admin${T % 1000}', 'anu${T}@example.com', '+37255${String(T).slice(-6)}') returning id`);
const pkg = sql(`select p.id from packages p join package_items i on i.package_id=p.id join services s on s.id=i.service_id where p.business_id='${biz}' and p.active and s.name='Klassikaline massaaž' limit 1`);
const pkgName = sql(`select name from packages where id='${pkg}'`);

await page.goto(B + "/logi-sisse", { waitUntil: "networkidle0" });
await page.type("#email", "triin@studiolumi.ee"); await page.type("#password", "aegly-demo"); await page.click("form button[type=submit]"); await wait(2500);
await page.goto(B + "/api/vaade?m=salon", { waitUntil: "networkidle0" });

// 1. paketi müük kliendikaardil
await page.goto(B + `/kliendid/${cl}`, { waitUntil: "networkidle0" });
await clickText("button", "Müü pakett"); await wait(400);
await page.select("#sellPkg", pkg);
await clickText("dialog[open] button", "Müü ·"); await wait(2000);
const cp = sql(`select id from client_packages where client_id='${cl}'`);
check("pakett müüdud", !!cp && (await text()).includes(pkgName));
const total = Number(sql(`select uses_total from client_packages where id='${cp}'`));

// 2. käsitsi broneering paketiga
await page.goto(B + `/broneeringud/uus?klient=${cl}`, { waitUntil: "networkidle0" });
if (!(await text()).includes(`Anu Admin`)) {
  await page.type("input[aria-label='Otsi klienti']", "Anu Admin"); await wait(1200);
  await page.click("ul button ::-p-text(Anu Admin)"); await wait(300);
}
const svc = sql(`select id from services where business_id='${biz}' and name='Klassikaline massaaž'`);
await page.select("#mService", svc); await wait(1500);
let d = new Date(Date.now() + 86400000 * 3); while ([0, 6].includes(d.getDay())) d = new Date(d.getTime() + 86400000);
await page.$eval("#mDate", (e, v) => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; set.call(e, v); e.dispatchEvent(new Event("input", { bubbles: true })); }, d.toISOString().slice(0, 10));
await wait(1800);
const slot = (await page.$$("button[aria-pressed]")).find(Boolean);
for (const b of await page.$$("button[aria-pressed]")) { if (/^\d\d:\d\d$/.test(await b.evaluate((e) => e.textContent))) { await b.click(); break; } }
await wait(1800);
check("paketi valik pakutakse", (await text()).includes(`Kasuta kliendi paketti „${pkgName}“`));
await clickText("button", "Loo broneering"); await wait(3000);
check("broneering loodud", page.url().includes("/broneeringud/") && !page.url().includes("/uus"));
check("pakett seotud", sql(`select count(*) from bookings where client_id='${cl}' and client_package_id='${cp}'`) === "1");
check("kord maha arvatud", Number(sql(`select uses_left from client_packages where id='${cp}'`)) === total - 1);

// 3. käsitsi −/+
await page.goto(B + `/kliendid/${cl}`, { waitUntil: "networkidle0" });
await page.click("button[aria-label='Märgi üks kord kasutatuks']"); await wait(1500);
check("− töötab", Number(sql(`select uses_left from client_packages where id='${cp}'`)) === total - 2);
await page.click("button[aria-label='Tagasta üks kord']"); await wait(1500);
check("+ töötab", Number(sql(`select uses_left from client_packages where id='${cp}'`)) === total - 1);

// 4. GDPR eksport
sql(`insert into outbound_messages (id, business_id, kind, channel, "to", body, status) values ('om${T}', '${biz}', 'TEST', 'EMAIL', 'anu${T}@example.com', 'Tere Anu, sinu broneering', 'SENT')`);
const json = await page.evaluate(async (u) => (await fetch(u)).json(), B + `/kliendid/${cl}/export`);
check("eksport: klient", json.client?.email === `anu${T}@example.com`);
check("eksport: broneering ja pakett", json.bookings?.length === 1 && json.packages?.length === 1);
check("eksport: saadetud teated", json.messagesSent?.some((m) => m.body.includes("Tere Anu")));

// 5. kustutamine
page.on("dialog", (dl) => dl.accept());
await clickText("button", "Kustuta"); await wait(500);
await clickText("dialog[open] button", "Kustuta"); await wait(2500);
check("klient anonüümitud", sql(`select name from clients where id='${cl}'`) === "Kustutatud klient");
check("teate sisu kustutatud", sql(`select body from outbound_messages where id='om${T}'`) === "[kustutatud]");
check("logis nime pole", sql(`select count(*) from audit_log where business_id='${biz}' and summary like '%Anu Admin${T % 1000}%'`) === "0");

console.log("errors:", errors);
await browser.close();
process.exit(fails ? 1 : 0);
