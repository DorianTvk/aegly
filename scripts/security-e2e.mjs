// Kaheastmeline sisselogimine + tegevuste logi (BASE_URL=http://localhost:3100 node scripts/security-e2e.mjs)
import puppeteer from "puppeteer-core";
import { createHmac } from "node:crypto";
import { execSync } from "node:child_process";
const B = process.env.BASE_URL ?? "http://localhost:3000";
const DB = process.env.DATABASE_URL ?? "postgresql://aegly:aegly@localhost:5432/aegly";
const sql = (q) => execSync(`psql ${DB} -tAc "${q.replace(/"/g, '\\"')}"`).toString().trim();

const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const b32 = (s) => { let bits = 0, v = 0; const o = []; for (const c of s.replace(/\s/g, "")) { v = (v << 5) | A.indexOf(c); bits += 5; if (bits >= 8) { o.push((v >>> (bits - 8)) & 255); bits -= 8; } } return Buffer.from(o); };
const totp = (secret, offset = 0) => {
  const m = Buffer.alloc(8); m.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000) + offset));
  const h = createHmac("sha1", b32(secret)).update(m).digest(); const o = h[19] & 15;
  return String((((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3]) % 1e6).padStart(6, "0");
};

const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH ?? "/usr/bin/google-chrome", args: ["--no-sandbox"] });
const errors = [];
const page = await browser.newPage(); await page.setViewport({ width: 1440, height: 950 });
page.on("pageerror", (e) => errors.push(String(e)));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const text = () => page.evaluate(() => document.body.innerText);
let fails = 0;
const inApp = () => /\/(toolaud|platvorm)/.test(page.url());
const check = (n, ok) => { console.log(ok ? "OK  " : "FAIL", n, ok ? "" : page.url()); if (!ok) fails++; };
const clickText = async (sel, t) => { const els = await page.$$(sel); for (const e of els) if ((await e.evaluate((x) => x.textContent)).includes(t)) { await e.click(); return true; } return false; };
const EMAIL = "triin@studiolumi.ee", PW = "aegly-demo";
sql(`update users set totp_secret=null, totp_enabled_at=null, totp_last_step=null, recovery_codes='[]' where email='${EMAIL}'`);
sql(`delete from auth_attempts`);
const login = async () => { await page.goto(B + "/logi-sisse", { waitUntil: "networkidle0" }); await page.type("#email", EMAIL); await page.type("#password", PW); await page.click("form button[type=submit]"); await wait(2500); };

// 1. sisse lülitamine
await login();
check("sisse logitud", inApp());
await page.goto(B + "/seaded", { waitUntil: "networkidle0" });
check("kaart nähtav", (await text()).includes("Kaheastmeline sisselogimine"));
await clickText("#turvalisus button", "Lülita sisse"); await wait(1500);
const secret = await page.$eval("p.select-all", (e) => e.textContent);
check("QR-kood ja võti", !!secret && !!(await page.$("dialog svg")));
await page.type("#tfaCode", "000000"); await clickText("dialog[open] button", "Kinnita"); await wait(1200);
check("vale kood lükatakse tagasi", (await text()).includes("Kood ei sobi"));
await page.$eval("#tfaCode", (e) => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; set.call(e, ""); e.dispatchEvent(new Event("input", { bubbles: true })); });
await page.type("#tfaCode", totp(secret)); await clickText("dialog[open] button", "Kinnita"); await wait(1500);
const codes = await page.$$eval("dialog[open] ul li", (l) => l.map((x) => x.textContent));
check("10 varukoodi", codes.length === 10);
check("andmebaasis sees", sql(`select totp_enabled_at is not null from users where email='${EMAIL}'`) === "t");

// 2. sisselogimine nõuab koodi
await page.goto(B + "/api/auth/valja"); await login();
check("küsitakse koodi", page.url().includes("/logi-sisse/kood"));
await page.goto(B + "/toolaud", { waitUntil: "networkidle0" });
check("ilma koodita halduspaneeli ei pääse", page.url().includes("/logi-sisse") && !page.url().includes("/kood"));
await login();
for (let i = 0; i < 2; i++) { await page.type("#code", "111111"); await page.click("form button[type=submit]"); await wait(1200); await page.$eval("#code", (e) => (e.value = "")); }
check("vale kood → viga", (await text()).includes("Vale kood"));
const used = totp(secret, 1);
await page.type("#code", used); await page.click("form button[type=submit]"); await wait(2500);
check("õige koodiga sees", inApp());

// 3. sama koodi ei saa uuesti kasutada; varukood töötab
await page.goto(B + "/api/auth/valja"); await login();
await page.type("#code", used); await page.click("form button[type=submit]"); await wait(1500);
check("korduv kood lükatakse tagasi", (await text()).includes("Vale kood"));
await clickText("form button", "varukoodi"); await wait(300);
await page.type("#code", codes[0].toUpperCase()); await page.click("form button[type=submit]"); await wait(2500);
check("varukoodiga sees", inApp());
check("varukood kulus", sql(`select jsonb_array_length(recovery_codes) from users where email='${EMAIL}'`) === "9");

// 4. tegevuste logi
await page.goto(B + "/seaded/logi", { waitUntil: "networkidle0" });
const log = await text();
check("logis 2FA sisselülitamine", log.includes("lülitas sisse kaheastmelise sisselogimise"));
check("logis varukoodiga sisselogimine", log.includes("logis sisse varukoodiga"));
await page.goto(B + "/seaded/logi?tyyp=broneeringud", { waitUntil: "networkidle0" });
check("filter töötab", !(await text()).includes("kaheastmelise"));

// 5. välja lülitamine
await page.goto(B + "/seaded", { waitUntil: "networkidle0" });
await clickText("#turvalisus button", "Lülita välja"); await wait(500);
await page.type("#tfaPw", PW); await page.type("#tfaOff", codes[1]); await clickText("dialog[open] button", "Lülita välja"); await wait(2500);
check("välja lülitatud", sql(`select totp_enabled_at is null from users where email='${EMAIL}'`) === "t");
await page.goto(B + "/api/auth/valja"); await login();
check("jälle ainult parooliga", inApp());

console.log("errors:", errors);
await browser.close();
process.exit(fails ? 1 : 0);
