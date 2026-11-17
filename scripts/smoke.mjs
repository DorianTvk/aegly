// Brauseri suitsutest: registreerumine, töötaja, teenus, tööaeg, erandid, salongide eraldatus.
// Eeldab: npm run build && npm start, andmebaas seemendatud. Käivita: npm run test:smoke
import puppeteer from "puppeteer-core";
const B = process.env.BASE_URL ?? "http://localhost:3000";
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH ?? "/usr/bin/google-chrome", args: ["--no-sandbox"], headless: true });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 1000 });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const text = () => page.evaluate(() => document.body.innerText);
const check = (name, ok) => console.log(ok ? "OK  " : "FAIL", name);
const until = (re) => page.waitForFunction((src) => new RegExp(src).test(location.pathname + location.search), { timeout: 10000 }, re.source);

// 1. Registreerumine uue salongiga
await page.goto(B + "/registreeru", { waitUntil: "networkidle0" });
await page.click("main button[type=submit], form button[type=submit]:not([aria-label])"); await wait(800);
check("registreerumise valideerimine", (await text()).includes("Ettevõtte nimi on liiga lühike"));
const email = `test${Date.now()}@example.com`;
await page.type("#businessName", "Testsalong Õie");
await page.type("#ownerName", "Test Kasutaja");
await page.type("#email", email);
await page.type("#password", "parool123");
await page.click("input[name=terms]");
await page.click("main button[type=submit], form button[type=submit]:not([aria-label])"); await until(/\/toolaud/); await wait(800);
check("registreerumine → töölaud", page.url().endsWith("/toolaud") && (await text()).includes("Tere, Test"));
check("uus salong: seadistus 0/6", (await text()).includes("0 / 6"));

// 2. Uus salong: lisa töötaja
await page.goto(B + "/tootajad/uus", { waitUntil: "networkidle0" });
await page.type("#name", "Maria Testija");
await page.type("#title", "Massöör");
await page.click("main button[type=submit], form button[type=submit]:not([aria-label])"); await until(/tab=tooaeg/); await wait(800);
check("töötaja lisatud → tööaeg", page.url().includes("tab=tooaeg") && (await text()).includes("Iganädalane tööaeg"));
await page.screenshot({ path: (process.env.SHOTS_DIR ?? "/tmp") + "/tootaja_tooaeg_uus.png", fullPage: true });

// 3. Uus teenus selle töötajaga
await page.goto(B + "/teenused/uus", { waitUntil: "networkidle0" });
await page.type("#name", "Testmassaaž");
await page.type("#price", "49,90");
await page.click("input[name=staff]");
await page.click("main button[type=submit], form button[type=submit]:not([aria-label])"); await until(/\/teenused\/(?!uus)\w+/); await wait(800);
check("teenus lisatud", /\/teenused\/\w+/.test(page.url()) && (await text()).includes("Testmassaaž"));
await page.goto(B + "/teenused", { waitUntil: "networkidle0" });
check("teenuste nimekirjas 49,90 €", (await text()).includes("49,90 €"));

// 4. Eelvaade näitab vabu aegu
await page.goto(B + "/tooajad", { waitUntil: "networkidle0" }); await wait(1500);
const t4 = await text();
check("eelvaade näitab aegu", /\b(09|10|11):\d\d\b/.test(t4) || t4.includes("Sel päeval on suletud"));

// 5. Välja ja Studio Lumi sisse – teise salongi andmeid ei näe
await page.click("button[aria-label='Logi välja']"); await until(/logi-sisse/); await wait(500);
check("väljalogimine", page.url().includes("/logi-sisse"));
await page.type("#email", "triin@studiolumi.ee"); await page.type("#password", "vale");
await page.click("main button[type=submit], form button[type=submit]:not([aria-label])"); await wait(1000);
check("vale parool", (await text()).includes("Vale e-post või parool"));
await page.$eval("#password", (e) => (e.value = ""));
await page.type("#password", "aegly-demo");
await page.click("main button[type=submit], form button[type=submit]:not([aria-label])"); await until(/toolaud/);
await page.goto(B + "/teenused", { waitUntil: "networkidle0" });
check("eraldatus: Testmassaaž ei paista Studio Lumis", !(await text()).includes("Testmassaaž"));

// 6. Kadri tööaeg + erand
await page.goto(B + "/tootajad", { waitUntil: "networkidle0" });
const kadri = await page.$$eval("a[href^='/tootajad/']", (as) => as.find((a) => a.textContent.includes("Kadri"))?.getAttribute("href"));
await page.goto(B + kadri + "?tab=tooaeg", { waitUntil: "networkidle0" });
await page.screenshot({ path: (process.env.SHOTS_DIR ?? "/tmp") + "/tootaja_tooaeg.png", fullPage: true });
check("Kadri graafik 09:00–12:00 + 13:00–18:00", (await page.$$eval("select", (s) => s.map((x) => x.value))).join(",").includes("09:00,12:00,13:00,18:00"));
await page.click("button ::-p-text(Salvesta tööaeg)"); await wait(1200);
check("tööaja salvestus", (await text()).includes("Tööaeg salvestatud"));
await page.click("button ::-p-text(Lisa erand)"); await wait(300);
await page.type("#note", "Koolitus Tartus");
await page.select("#type", "TRAINING");
await page.click("main form button[type=submit]"); await wait(1200);
check("erand lisatud", (await text()).includes("Koolitus Tartus"));

// 7. Teenuse muutmine
await page.goto(B + "/teenused", { waitUntil: "networkidle0" });
const klass = await page.$$eval("a[href^='/teenused/']", (as) => as.find((a) => a.textContent.includes("Klassikaline"))?.getAttribute("href"));
await page.goto(B + klass, { waitUntil: "networkidle0" });
await page.screenshot({ path: (process.env.SHOTS_DIR ?? "/tmp") + "/teenus_muutmine.png", fullPage: true });
check("Karli kohandatud hind 60,00", (await page.$eval("input[name^='staffPrice_']:not([disabled])+span, input[name^='staffPrice_']", () => true)) && (await page.$$eval("input[name^='staffPrice_']", (i) => i.map((x) => x.value))).includes("60,00"));
await page.click("main button[type=submit], form button[type=submit]:not([aria-label])"); await wait(1500);
check("teenuse salvestus", (await text()).includes("Muudatused salvestatud"));

console.log("errors:", errors);
await browser.close();
