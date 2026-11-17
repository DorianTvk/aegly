/**
 * Näidisandmed: Studio Lumi (Figma näidisettevõte).
 * Tänased broneeringud järgivad Figma vaadet "02 Kalender", nihutatud tänasele kuupäevale.
 * Käivita: npm run db:seed
 */
import { db, schema as s } from "./index";
import { hashPassword } from "../lib/password";
import { eq } from "drizzle-orm";
import { addDaysIso, isoWeekday, todayIso, zonedDateTime } from "../lib/time";

async function main() {
  const today = todayIso();
  console.log(`Seemendan Studio Lumi andmed, täna = ${today}`);

  await db.delete(s.businesses).where(eq(s.businesses.slug, "studio-lumi")); // kaskaad kustutab seotud read

  const [biz] = await db
    .insert(s.businesses)
    .values({
      slug: "studio-lumi",
      name: "Studio Lumi",
      registryCode: "14567890",
      vatNumber: "EE102345678",
      email: "info@studiolumi.ee",
      phone: "+372 600 1234",
      address: "Tartu mnt 18, Tallinn",
      allowedDomains: ["studiolumi.ee"],
    })
    .returning();

  const [owner] = await db
    .insert(s.users)
    .values({ businessId: biz.id, email: "triin@studiolumi.ee", name: "Triin Ilves", role: "OWNER", passwordHash: await hashPassword("aegly-demo") })
    .returning();
  void owner;

  // Lahtiolekuajad: E–R 09–19, L 10–16, P suletud
  await db.insert(s.openingHours).values(
    [1, 2, 3, 4, 5, 6, 7].map((wd) => ({
      businessId: biz.id,
      weekday: wd,
      closed: wd === 7,
      startTime: wd === 7 ? null : wd === 6 ? "10:00" : "09:00",
      endTime: wd === 7 ? null : wd === 6 ? "16:00" : "19:00",
    })),
  );

  // Kategooriad (kalendri legend)
  const cats = await db
    .insert(s.serviceCategories)
    .values([
      { businessId: biz.id, name: "Massaažid", color: "#7a5af8", sortOrder: 1 },
      { businessId: biz.id, name: "Näohooldused", color: "#ee46bc", sortOrder: 2 },
      { businessId: biz.id, name: "Juuksur", color: "#0ba5ec", sortOrder: 3 },
      { businessId: biz.id, name: "Küüned", color: "#f79009", sortOrder: 4 },
    ])
    .returning();
  const cat = Object.fromEntries(cats.map((c) => [c.name, c.id]));

  const svcDefs = [
    { key: "klass", cat: "Massaažid", name: "Klassikaline massaaž", dur: 60, buf: 15, price: 5500, dep: 20, desc: "Lõõgastav kogu keha massaaž, mis leevendab pingeid ja parandab vereringet." },
    { key: "sugav", cat: "Massaažid", name: "Sügavkudede massaaž", dur: 90, buf: 15, price: 7900, dep: 20, desc: "Sügavam töö lihaspingete ja kroonilise valuga." },
    { key: "kuuma", cat: "Massaažid", name: "Kuumakivimassaaž", dur: 75, buf: 15, price: 7000, dep: 20, desc: "Soojad basaltkivid lõdvestavad lihaseid sügavalt." },
    { key: "nao", cat: "Näohooldused", name: "Näohooldus", dur: 60, buf: 10, price: 6500, dep: 20, desc: "Puhastus, niisutus ja massaaž vastavalt nahatüübile." },
    { key: "naomask", cat: "Näohooldused", name: "Näohooldus + mask", dur: 60, buf: 10, price: 7500, dep: 20, desc: "Näohooldus koos intensiivse maskiga." },
    { key: "ripsmed", cat: "Näohooldused", name: "Ripsmete värvimine", dur: 30, buf: 0, price: 2000, dep: 0, desc: "Ripsmete värvimine ja kujundus." },
    { key: "naistel", cat: "Juuksur", name: "Naiste juukselõikus", dur: 45, buf: 0, price: 3800, dep: 0, desc: "Lõikus koos pesu ja föönitamisega." },
    { key: "meestel", cat: "Juuksur", name: "Meeste juukselõikus", dur: 30, buf: 0, price: 2500, dep: 0, desc: "Klassikaline või moodne meeste lõikus." },
    { key: "varv", cat: "Juuksur", name: "Värvimine", dur: 90, buf: 0, price: 8500, dep: 20, desc: "Juuste värvimine ühes toonis." },
    { key: "foon", cat: "Juuksur", name: "Föönisoeng", dur: 45, buf: 0, price: 3000, dep: 0, desc: "Pidulik föönisoeng." },
    { key: "mani", cat: "Küüned", name: "Maniküür geellakiga", dur: 75, buf: 0, price: 3500, dep: 0, desc: "Küünte hooldus ja geellakk." },
    { key: "pedi", cat: "Küüned", name: "Pediküür", dur: 75, buf: 0, price: 4000, dep: 0, desc: "Jalgade ja küünte hooldus." },
  ] as const;

  const svcRows = await db
    .insert(s.services)
    .values(
      svcDefs.map((d, i) => ({
        businessId: biz.id,
        categoryId: cat[d.cat],
        name: d.name,
        description: d.desc,
        durationMinutes: d.dur,
        bufferMinutes: d.buf,
        priceCents: d.price,
        depositPercent: d.dep,
        priceType: d.key === "naistel" || d.key === "varv" ? ("FROM" as const) : ("FIXED" as const),
        bookableOnline: d.key !== "varv",
        sortOrder: i,
      })),
    )
    .returning();
  const svc = Object.fromEntries(svcDefs.map((d, i) => [d.key, svcRows[i]]));

  // Töötajad (kalendri järjekord)
  const staffDefs = [
    { key: "kadri", name: "Kadri Tamm", title: "Massöör", color: "#f04438", services: ["klass", "sugav", "kuuma"] },
    { key: "mari", name: "Mari Kask", title: "Kosmeetik", color: "#7a5af8", services: ["nao", "naomask", "ripsmed"] },
    { key: "liis", name: "Liis Saar", title: "Juuksur", color: "#0ba5ec", services: ["naistel", "meestel", "varv", "foon"] },
    { key: "karl", name: "Karl Mets", title: "Massöör", color: "#12b76a", services: ["klass", "sugav"] },
    { key: "anni", name: "Anni Lepp", title: "Küünetehnik", color: "#f79009", services: ["mani", "pedi"] },
  ] as const;

  const staffRows = await db
    .insert(s.staffMembers)
    .values(staffDefs.map((d, i) => ({ businessId: biz.id, name: d.name, title: d.title, color: d.color, sortOrder: i })))
    .returning();
  const staff = Object.fromEntries(staffDefs.map((d, i) => [d.key, staffRows[i]]));

  await db.insert(s.staffServices).values(
    staffDefs.flatMap((d) =>
      d.services.map((k) => ({
        staffId: staff[d.key].id,
        serviceId: svc[k].id,
        // Karli oma hind klassikalisele massaažile (raport, näide 2)
        priceCents: d.key === "karl" && k === "klass" ? 6000 : null,
      })),
    ),
  );

  // Tööajad (raport: Kadri 09–12 ja 13–18)
  const validFrom = "2026-01-01";
  const sched: Record<string, { days: number[]; start: string; end: string; lunch: [string, string] }> = {
    kadri: { days: [1, 2, 3, 4, 5], start: "09:00", end: "18:00", lunch: ["12:00", "13:00"] },
    mari: { days: [1, 2, 3, 4, 5], start: "09:00", end: "18:00", lunch: ["12:30", "13:30"] },
    liis: { days: [1, 2, 3, 4, 5, 6], start: "09:00", end: "18:00", lunch: ["12:30", "13:30"] },
    karl: { days: [2, 3, 4, 5, 6], start: "10:00", end: "19:00", lunch: ["14:00", "14:30"] },
    anni: { days: [1, 2, 3, 4, 5], start: "10:00", end: "18:00", lunch: ["13:30", "14:00"] },
  };
  await db.insert(s.workSchedules).values(
    Object.entries(sched).flatMap(([key, v]) =>
      v.days.map((wd) => ({
        staffId: staff[key].id,
        validFrom,
        weekday: wd,
        startTime: v.start,
        endTime: v.end,
        breaks: [{ start: v.lunch[0], end: v.lunch[1], label: "Lõunapaus" }],
      })),
    ),
  );

  // Karl puhkusel sel nädalal; Kadri puhkus detsembris (raport, parandus 01)
  const monday = addDaysIso(today, 1 - isoWeekday(today));
  await db.insert(s.timeOff).values([
    { staffId: staff.karl.id, type: "VACATION", startsAt: zonedDateTime(monday, "00:00"), endsAt: zonedDateTime(addDaysIso(monday, 5), "00:00"), note: "Puhkus" },
    { staffId: staff.kadri.id, type: "VACATION", startsAt: zonedDateTime("2026-12-14", "00:00"), endsAt: zonedDateTime("2026-12-19", "00:00"), note: "Puhkus" },
  ]);

  // Hinnareeglid (09)
  await db.insert(s.priceRules).values([
    { businessId: biz.id, name: "Nädalavahetuse lisatasu", kind: "PERCENT", value: 10, weekdays: [6, 7], sortOrder: 1 },
    { businessId: biz.id, name: "Õhtune aeg", kind: "FIXED", value: 500, fromTime: "18:00", categoryIds: [cat["Massaažid"]], sortOrder: 2 },
    { businessId: biz.id, name: "Viimase hetke soodustus", kind: "PERCENT", value: -15, maxLeadHours: 3, active: false, sortOrder: 3 },
    { businessId: biz.id, name: "Pühade hinnad", kind: "PERCENT", value: 15, dateFrom: "2026-12-24", dateTo: "2027-01-01", active: false, sortOrder: 4 },
  ]);

  // Kampaaniad (11)
  const [cSygis] = await db
    .insert(s.campaigns)
    .values([
      {
        businessId: biz.id, name: "Sügisene hoolitsus", kind: "PERCENT", value: 20,
        startsAt: zonedDateTime("2026-10-15", "00:00"), endsAt: zonedDateTime("2026-11-30", "23:59"),
        categoryIds: [cat["Näohooldused"]], showBanner: true, bannerText: "Sügisene hoolitsus: −20% kõigilt näohooldustelt!",
      },
      {
        businessId: biz.id, name: "Hommikune massaaž", kind: "PERCENT", value: 10,
        startsAt: zonedDateTime("2026-10-01", "00:00"), endsAt: zonedDateTime("2026-12-31", "23:59"),
        weekdays: [1, 3], fromTime: "09:00", toTime: "12:00", categoryIds: [cat["Massaažid"]],
      },
      {
        businessId: biz.id, name: "Black Friday", kind: "PERCENT", value: 25,
        startsAt: zonedDateTime("2026-11-27", "00:00"), endsAt: zonedDateTime("2026-11-30", "23:59"),
      },
      {
        businessId: biz.id, name: "Suvine sära", kind: "PERCENT", value: 15,
        startsAt: zonedDateTime("2026-06-01", "00:00"), endsAt: zonedDateTime("2026-08-31", "23:59"),
      },
    ])
    .returning();

  // Sooduskoodid (10)
  await db.insert(s.discountCodes).values([
    { businessId: biz.id, code: "TERE10", kind: "PERCENT", value: 10, maxUses: 100, usedCount: 12, maxUsesPerClient: 1, newClientsOnly: true },
    { businessId: biz.id, code: "SÜGIS15", kind: "PERCENT", value: 15, maxUses: 50, usedCount: 18, categoryIds: [cat["Massaažid"]], startsAt: zonedDateTime("2026-10-01", "00:00"), endsAt: zonedDateTime("2026-12-01", "00:00") },
    { businessId: biz.id, code: "SÕBER5", kind: "FIXED", value: 500, usedCount: 7, minAmountCents: 3000 },
    { businessId: biz.id, code: "VIP25", kind: "PERCENT", value: 25, maxUses: 20, usedCount: 4, active: false },
    { businessId: biz.id, code: "SUVI20", kind: "PERCENT", value: 20, usedCount: 41, startsAt: zonedDateTime("2026-06-01", "00:00"), endsAt: zonedDateTime("2026-09-01", "00:00") },
  ]);

  // Paketid (05)
  const [pkg5, pkgDay] = await db
    .insert(s.packages)
    .values([
      { businessId: biz.id, type: "MULTI_VISIT", name: "Massaaži 5 korra pakett", priceCents: 25000, validityDays: 180, sortOrder: 1 },
      { businessId: biz.id, type: "BUNDLE", name: "Ilupäev", priceCents: 12000, validityDays: null, sortOrder: 2 },
      { businessId: biz.id, type: "MULTI_VISIT", name: "Sügavmassaaži 4 korda", priceCents: 28000, validityDays: 180, sellInWidget: false, sortOrder: 3 },
    ])
    .returning();
  await db.insert(s.packageItems).values([
    { packageId: pkg5.id, serviceId: svc.klass.id, quantity: 5 },
    { packageId: pkgDay.id, serviceId: svc.nao.id, quantity: 1 },
    { packageId: pkgDay.id, serviceId: svc.mani.id, quantity: 1 },
    { packageId: pkgDay.id, serviceId: svc.naistel.id, quantity: 1 },
  ]);

  // Kliendid (14)
  const clientDefs = [
    ["kertu", "Kertu Lill", "kertu@example.com", "+372 5123 4567"],
    ["katrin", "Katrin Mänd", "katrin.mand@gmail.com", "+372 5555 0101"],
    ["marko", "Marko Pärn", "marko.parn@mail.ee", "+372 5344 2210"],
    ["helen", "Helen Org", "helen.org@icloud.com", "+372 5812 3344"],
    ["laura", "Laura Vaher", "laura.vaher@gmail.com", "+372 5677 8812"],
    ["grete", "Grete Kivi", "grete.kivi@gmail.com", "+372 5290 1187"],
    ["siim", "Siim Rebane", "siim.rebane@gmail.com", "+372 5011 4420"],
    ["elina", "Elina Kuusk", "elina.kuusk@hot.ee", "+372 5622 0098"],
    ["ott", "Ott Kuusk", "ott.kuusk@gmail.com", "+372 5133 7761"],
    ["kaisa", "Kaisa Mägi", "kaisa.magi@gmail.com", "+372 5400 1122"],
    ["anu", "Anu Kallas", "anu.kallas@gmail.com", "+372 5300 2211"],
    ["maria", "Maria Põld", "maria.pold@gmail.com", "+372 5900 3344"],
    ["kristi", "Kristi Raud", "kristi.raud@gmail.com", "+372 5811 4455"],
    ["triinu", "Triinu Aas", "triinu.aas@gmail.com", "+372 5722 5566"],
    ["kati", "Kati Lõhmus", "kati.lohmus@gmail.com", "+372 5633 6677"],
  ] as const;
  const clientRows = await db
    .insert(s.clients)
    .values(
      clientDefs.map(([, name, email, phone]) => ({
        businessId: biz.id, name, email, phone, consentTermsAt: new Date("2025-03-12"), consentSms: true,
      })),
    )
    .returning();
  const client = Object.fromEntries(clientDefs.map((d, i) => [d[0], clientRows[i]]));

  // Müüdud paketid (kliendikaardi saldo)
  await db.insert(s.clientPackages).values([
    { clientId: client.marko.id, packageId: pkg5.id, usesTotal: 5, usesLeft: 2, expiresAt: zonedDateTime("2027-03-14", "00:00") },
    { clientId: client.helen.id, packageId: pkg5.id, usesTotal: 5, usesLeft: 3, expiresAt: zonedDateTime("2027-04-02", "00:00") },
    { clientId: client.laura.id, packageId: pkgDay.id, usesTotal: 1, usesLeft: 1 },
  ]);

  let n = 20400;
  const book = (
    date: string, start: string, staffKey: string, svcKey: keyof typeof svc, clientKey: keyof typeof client,
    status: (typeof s.bookingStatusEnum.enumValues)[number] = "CONFIRMED", source: "WIDGET" | "ADMIN" = "WIDGET",
  ) => {
    const sv = svc[svcKey];
    const startsAt = zonedDateTime(date, start);
    const endsAt = new Date(startsAt.getTime() + sv.durationMinutes * 60_000);
    const price = staffKey === "karl" && svcKey === "klass" ? 6000 : sv.priceCents;
    return {
      number: `BL-${++n}`,
      businessId: biz.id,
      clientId: client[clientKey].id,
      serviceId: sv.id,
      staffId: staff[staffKey].id,
      startsAt, endsAt,
      bufferMinutes: sv.bufferMinutes,
      status, source,
      basePriceCents: price,
      finalPriceCents: price,
      depositCents: Math.round((price * sv.depositPercent) / 100),
      priceBreakdown: [{ label: "Baashind", amountCents: price }],
      cancelledAt: status === "CANCELLED" ? new Date() : null,
    };
  };

  // Ajalugu: eelmised 3 nädalat, deterministlik muster
  const history: ReturnType<typeof book>[] = [];
  const pattern: [string, string, keyof typeof svc][] = [
    ["kadri", "09:00", "klass"], ["kadri", "10:15", "sugav"], ["kadri", "14:00", "kuuma"],
    ["mari", "09:30", "nao"], ["mari", "11:00", "naomask"], ["mari", "15:00", "ripsmed"],
    ["liis", "09:00", "naistel"], ["liis", "10:00", "meestel"], ["liis", "14:00", "varv"],
    ["anni", "10:00", "mani"], ["anni", "15:00", "pedi"],
  ];
  const ck = clientDefs.map((c) => c[0]);
  for (let back = 21; back >= 1; back--) {
    const d = addDaysIso(today, -back);
    const wd = isoWeekday(d);
    if (wd === 7) continue;
    pattern.forEach(([st, t, sv], i) => {
      if (wd === 6 && st !== "liis") return;
      if ((back + i) % 3 === 0) return; // mitte iga päev täis
      const status = (back * 7 + i) % 41 === 0 ? "NO_SHOW" : "COMPLETED";
      const b = book(d, t, st, sv, ck[(back + i) % ck.length] as keyof typeof client, status);
      if ((sv === "nao" || sv === "naomask") && d >= "2026-10-15") {
        const disc = Math.round(b.basePriceCents * 0.2);
        Object.assign(b, {
          campaignId: cSygis.id,
          finalPriceCents: b.basePriceCents - disc,
          priceBreakdown: [
            { label: "Baashind", amountCents: b.basePriceCents, kind: "base" },
            { label: "Kampaania Sügisene hoolitsus −20 %", amountCents: -disc, kind: "campaign" },
          ],
        });
      }
      history.push(b);
    });
  }

  // Täna – Figma "02 Kalender" järgi (Karl puhkusel)
  const todays = [
    book(today, "09:00", "kadri", "klass", "katrin"),
    book(today, "10:15", "kadri", "sugav", "marko", "PENDING_PAYMENT"),
    book(today, "13:00", "kadri", "kuuma", "helen"),
    book(today, "15:00", "kadri", "klass", "ott"),
    book(today, "09:30", "mari", "nao", "laura"),
    book(today, "11:00", "mari", "naomask", "kaisa"),
    book(today, "14:30", "mari", "ripsmed", "grete", "CONFIRMED", "ADMIN"),
    book(today, "09:00", "liis", "naistel", "anu"),
    book(today, "10:00", "liis", "meestel", "siim"),
    book(today, "11:00", "liis", "varv", "grete"),
    book(today, "14:00", "liis", "naistel", "maria"),
    book(today, "16:00", "liis", "foon", "kristi"),
    book(today, "10:00", "anni", "mani", "triinu"),
    book(today, "12:00", "anni", "mani", "elina", "CANCELLED"),
    book(today, "15:00", "anni", "pedi", "kati"),
  ];

  // Tulevikus
  const tomorrow = addDaysIso(today, 1);
  const future = [
    book(tomorrow, "09:00", "kadri", "klass", "kertu"),
    book(tomorrow, "11:00", "mari", "nao", "helen"),
    book(tomorrow, "13:30", "liis", "naistel", "laura"),
  ];

  await db.insert(s.bookings).values([...history, ...todays, ...future]);
  console.log(`Valmis: ${history.length + todays.length + future.length} broneeringut, ${clientRows.length} klienti.`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
