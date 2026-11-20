import puppeteer from "puppeteer-core";
import { execSync } from "node:child_process";
const B = process.env.BASE_URL ?? "http://localhost:3000";
const DB = process.env.DATABASE_URL ?? "postgresql://aegly:aegly@localhost:5432/aegly";
const sql = (q) => execSync(`psql ${DB} -tAc "${q.replace(/"/g, '\\"')}"`).toString().trim();
const lastLink = (to, path) => { const body = sql(`select body from outbound_messages where \"to\"='${to}' order by created_at desc limit 1`); return body.match(new RegExp(`https?://[^\\s]*${path}\\?token=[\\w-]+`))?.[0].replace(/^https?:\/\/[^/]+/, B); };
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH ?? "/usr/bin/google-chrome", args: ["--no-sandbox"] });
const errors = [];
const newPage = async () => { const p = await browser.newPage(); await p.setViewport({ width: 1440, height: 950 }); p.on("pageerror", (e) => errors.push(String(e))); p.on("dialog", (d) => d.accept()); return p; };
let page = await newPage();
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const text = () => page.evaluate(() => document.body.innerText);
const check = (n, ok) => console.log(ok ? "OK  " : "FAIL", n);
const login = async (email, pw) => { await page.goto(B + "/logi-sisse", { waitUntil: "networkidle0" }); await page.type("#email", email); await page.type("#password", pw); await page.click("button[type=submit]"); await wait(2500); };

// 1. registreerumine → kinnitamise riba → link
const owner = `omanik${Date.now()}@example.com`;
await page.goto(B + "/registreeru", { waitUntil: "networkidle0" });
check("tingimuste lingid", (await page.$$("a[href='/tingimused'], a[href='/privaatsus'], a[href='/andmetootlus']")).length >= 3);
await page.type("#businessName", "Rollide Salong"); await page.type("#ownerName", "Olev Omanik");
await page.type("#email", owner); await page.type("#password", "Kollane-kass-71");
await page.evaluate(() => document.querySelector("input[name=terms]").click());
await page.click("form button[type=submit]"); await wait(3500);
check("kinnitamise riba", (await text()).includes("Kinnita oma e-post"));
const verify = lastLink(owner, "/kinnita");
check("kinnituslink kirjas", !!verify);
await page.goto(verify, { waitUntil: "networkidle0" }); await wait(500);
check("e-post kinnitatud (riba kadus)", !(await text()).includes("Kinnita oma e-post"));

// 2. töötaja profiil + kutse
await page.goto(B + "/tootajad/uus", { waitUntil: "networkidle0" });
await page.type("#name", "Tiina Töötaja");
await page.click("main form button[type=submit], main button ::-p-text(Salvesta)"); await wait(2500);
await page.goto(B + "/seaded", { waitUntil: "networkidle0" });
const staffEmail = `tootaja${Date.now()}@example.com`;
await page.click("button ::-p-text(Kutsu kasutaja)"); await wait(400);
await page.type("#iName", "Tiina Töötaja"); await page.type("#iEmail", staffEmail);
await page.screenshot({ path: (process.env.SHOTS_DIR ?? "/tmp") + "/invite_dialog.png" });
await page.click("dialog button ::-p-text(Saada kutse)"); await wait(2500);
check("kutse saadetud", (await text()).includes("Kutse saadetud") && (await text()).includes("Kutse ootel"));
await page.screenshot({ path: (process.env.SHOTS_DIR ?? "/tmp") + "/users_card.png", fullPage: true });
const invite = lastLink(staffEmail, "/kutse");
check("kutselink", !!invite);

// 3. töötaja võtab kutse vastu
await page.deleteCookie(...(await page.cookies()));
await page.goto(invite, { waitUntil: "networkidle0" });
check("kutse leht", (await text()).includes("Liitu meeskonnaga: Rollide Salong"));
await page.type("#password", "Sinine-rong-42"); await page.type("#password2", "Sinine-rong-42");
await page.click("form button[type=submit]"); await wait(3500);
check("töötaja töölaud", page.url().endsWith("/toolaud") && (await text()).includes("Täna"));
const t = await text();
check("menüüs pole haldust", !t.includes("Aruanded") && !t.includes("Teenused") && !t.includes("Broneerimisvidin"));
await page.screenshot({ path: (process.env.SHOTS_DIR ?? "/tmp") + "/staff_dashboard.png" });
await page.goto(B + "/aruanded", { waitUntil: "networkidle0" });
check("aruanded keelatud", (await text()).includes("Sul pole sellele lehele ligipääsu"));
const res = await page.goto(B + "/kliendid/export");
check("eksport keelatud", res.status() === 403);
await page.goto(B + "/kalender", { waitUntil: "networkidle0" });
check("kalender üks veerg", (await text()).includes("Tiina Töötaja"));
await page.goto(B + "/seaded", { waitUntil: "networkidle0" });
check("seaded: pole kasutajaid/paketti", !(await text()).includes("Kasutajad ja rollid") && !(await text()).includes("Pakett ja arveldus"));

// 4. parooli taastamine
await page.deleteCookie(...(await page.cookies()));
await page.goto(B + "/logi-sisse", { waitUntil: "networkidle0" });
await page.click("a[href='/parool/unustasin']"); await wait(1500);
await page.type("#email", staffEmail); await page.click("form button[type=submit]"); await wait(2500);
check("taastamise teade", (await text()).includes("saatsime sinna lingi"));
const reset = lastLink(staffEmail, "/parool/uus");
check("taastamislink", !!reset);
await page.goto(reset, { waitUntil: "networkidle0" });
await page.type("#password", "Roheline-mets-93"); await page.type("#password2", "Roheline-mets-93");
await page.click("form button[type=submit]"); await wait(3000);
check("uus parool → töölaud", page.url().endsWith("/toolaud"));
await page.goto(reset, { waitUntil: "networkidle0" });
check("link ühekordne", (await text()).includes("aegunud või juba kasutatud"));
await page.deleteCookie(...(await page.cookies()));
await login(staffEmail, "Roheline-mets-93");
check("sisselogimine uue parooliga", page.url().endsWith("/toolaud"));

// 5. omanik: pakett ok, admin ei
await page.deleteCookie(...(await page.cookies()));
await login(owner, "Kollane-kass-71");
await page.goto(B + "/seaded/pakett", { waitUntil: "networkidle0" });
check("omanik näeb paketti", (await text()).includes("Praegune pakett"));
await page.goto(B + "/tingimused", { waitUntil: "networkidle0" });
check("tingimuste leht", (await text()).includes("Kasutustingimused") && (await text()).includes("Mustand") === false || (await text()).includes("mustand"));
console.log("errors:", errors);
await browser.close();
