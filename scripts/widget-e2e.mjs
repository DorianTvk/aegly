import puppeteer from "puppeteer-core";
// Vidina ja iseteeninduse otsast lõpuni test: BASE_URL=http://localhost:3000 CHROME_PATH=... node scripts/widget-e2e.mjs [m]
const B = process.env.BASE_URL ?? "http://localhost:3000", S = (process.env.SHOTS_DIR ?? "/tmp") + "/w_";
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH ?? "/usr/bin/google-chrome", args: ["--no-sandbox"] });
const page = await browser.newPage();
const mobile = process.argv[2] === "m";
await page.setViewport(mobile ? { width: 390, height: 844, isMobile: true, deviceScaleFactor: 1 } : { width: 1200, height: 900 });
const errors = []; page.on("console", (m) => m.type() === "error" && errors.push(m.text())); page.on("pageerror", (e) => errors.push(String(e)));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const text = () => page.evaluate(() => document.body.innerText);
const check = (n, ok) => console.log(ok ? "OK  " : "FAIL", n);
const shot = (n) => page.screenshot({ path: S + (mobile ? "m_" : "") + n + ".png" });
const click = async (sel) => { await page.waitForSelector(sel, { timeout: 8000 }); await page.click(sel); };

await page.goto(B + "/w/studio-lumi?lang=et", { waitUntil: "networkidle0" });
check("W1 avavaade", (await text()).includes("Studio Lumi") && (await text()).includes("Klassikaline massaaž"));
await shot("1_avavaade");
await click("button[aria-label='Vali Klassikaline massaaž']"); await wait(300);
await shot("2_valitud");
await click("button ::-p-text(Jätka)"); await wait(2500);
const t4 = await text();
check("W4 spetsialist", t4.includes("Vali spetsialist") && t4.includes("Ükskõik kes"));
await shot("4_spetsialist");
await click("button ::-p-text(Jätka)"); await wait(2500);
check("W5 aja valik", (await text()).includes("Vali aeg"));
await shot("5_aeg");
await click("button[aria-label='Järgmine nädal']"); await wait(2000);
// leia päev, kus on aegu
for (let i = 0; i < 14; i++) {
  if (await page.$("[role=radiogroup][aria-label=Kellaaeg] button")) break;
  const next = await page.$$("button[aria-label*='202'], button[aria-pressed]");
  await page.evaluate((i) => { const b = [...document.querySelectorAll(".grid-cols-7 button")]; const sel = b.findIndex((x) => x.getAttribute("aria-pressed") === "true"); if (sel < b.length - 1) b[sel + 1].click(); else document.querySelector("button[aria-label='Järgmine nädal']").click(); }, i);
  await wait(1500);
}
await click("[role=radiogroup][aria-label=Kellaaeg] button"); await wait(200);
await shot("5_aeg_valitud");
await click("button ::-p-text(Jätka)"); await wait(1500);
check("W6 andmed", (await text()).includes("Sinu andmed"));
await page.type("#w-name", "Kertu Lill");
await page.type("#w-email", `kertu${Date.now()}@example.com`);
await page.type("#w-phone", "5123 4567");
await page.type("#w-code", "TERE10");
await click("button ::-p-text(Rakenda)"); await wait(1500);
const tc = await text(); check("sooduskood kontrollitud", tc.includes("TERE10 rakendatud") || tc.includes("kombineerida"));
await page.evaluate(() => [...document.querySelectorAll("label")].find((l) => l.textContent.includes("broneerimistingimustega")).querySelector("input").click());
await shot("6_andmed");
await click("button ::-p-text(Jätka)"); await wait(1500);
check("W7 kinnita", (await text()).includes("Kinnita broneering"));
await shot("7_kinnita");
await click("button ::-p-text(Kinnita broneering)"); await wait(2500);
const t8 = await text();
check("W8 broneeritud", t8.includes("Aeg on broneeritud!") && /BL-\d+/.test(t8));
await shot("8_kinnitus");
const manage = await page.$eval("a[href^='/b/']:not([href$='.ics'])", (a) => a.href);
await page.goto(manage, { waitUntil: "networkidle0" });
check("S1 minu broneering", (await text()).includes("Minu broneering"));
await shot("s1");
const ics = await page.evaluate(async (u) => (await fetch(u + "/kalender.ics")).text(), manage);
check("ics", ics.includes("BEGIN:VEVENT"));
await click("button ::-p-text(Muuda aega)"); await wait(2500);
for (let i = 0; i < 10 && !(await page.$("[role=radiogroup] button")); i++) {
  await page.evaluate(() => { const b = [...document.querySelectorAll(".grid-cols-7 button")]; const sel = b.findIndex((x) => x.getAttribute("aria-pressed") === "true"); if (sel < b.length - 1) b[sel + 1].click(); else document.querySelector("button[aria-label='Järgmine nädal']").click(); });
  await wait(1500);
}
const slots = await page.$$("[role=radiogroup] button"); await slots[0].click(); await wait(200);
await shot("s2");
await click("button ::-p-text(Kinnita)"); await wait(2000);
check("S2 aeg muudetud", (await text()).includes("Aeg muudetud"));
await click("button ::-p-text(Tühista broneering)"); await wait(300);
await click("button ::-p-text(Haigestusin)");
await shot("s3");
await click("button ::-p-text(Jah, tühista)"); await wait(2000);
check("S3 tühistatud", (await text()).includes("Broneering on tühistatud"));
// skript
const js = await (await fetch(B + "/w/aegly.js")).text();
check("aegly.js", js.includes("data-salon"));
console.log("errors:", errors);
await browser.close();
