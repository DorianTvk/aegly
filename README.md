# Aegly

Broneerimistarkvara ilu- ja heaolusalongidele: halduspaneel ettevõttele ja broneerimisvidin salongi kodulehele.
Disain: Figma „AEGLY“ (vahelehed OVERVIEW, ADMIN PANEL, WEB WIDGET).

**Juurutamine:** vaata [DEPLOY.md](DEPLOY.md) (Vercel + Neon, tasuta).

## Tehnoloogia

- **Next.js 16** (App Router, Cache Components), TypeScript, Tailwind CSS 4
- **PostgreSQL** + **Drizzle ORM** (`src/db/schema.ts`)
- **Stripe Connect** maksete jaoks (tulekul)
- Ikoonid: `lucide-react`, fondid: Inter ja JetBrains Mono

## Käivitamine

```bash
cp .env.example .env          # DATABASE_URL
npm install
npm run db:migrate            # loob tabelid
npm run db:seed               # Studio Lumi näidisandmed
npm run dev                   # http://localhost:3000
npm test                      # loogika testid (vitest)
npm run test:smoke            # brauseritest töötava rakenduse vastu (BASE_URL, CHROME_PATH)
```

Näidiskonto: **triin@studiolumi.ee** / **aegly-demo**

## Struktuur

| Kaust | Sisu |
| --- | --- |
| `src/app/(admin)` | Halduspaneeli vaated (00–19 Figmas) |
| `src/components` | Kest (küljeriba, päis) ja UI põhikomponendid |
| `src/db` | Andmemudel, ühendus, näidisandmed |
| `src/lib` | Puhas loogika: ajad, graafikud (testitud) |
| `src/server` | Andmebaasipäringud vaadetele |

## Seis

- [x] Andmemudel (12 objekti raportist + kinkekaardid, mitme salongi tugi)
- [x] Halduspaneeli kest, 01 Töölaud, 02 Kalender (päevavaade)
- [x] Sisselogimine ja registreerumine (sessioonid andmebaasis, scrypt)
- [x] 03–04 Teenused ja kategooriad, 06–07 Töötajad (profiil, teenused, tööaeg, puudumised), 08 Tööajad ja vabad ajad
- [x] Vabade aegade mootor (testitud raporti näitega) ja Eesti riigipühad
- [x] Hinna mootor (raporti 3 näidet testides) ja vaated 05 Paketid, 09 Hinnakiri, 10 Sooduskoodid, 11 Kampaaniad
- [x] 14–15 Kliendid ja kliendikaart (mitteilmumise kaitse, märkmed, GDPR eksport/kustutus), 16 Uus broneering, broneeringu vaade, 17 Kinkekaardid
- [x] 12 Broneerimisvidina seaded, 13 Ettevõtte profiil (logo/bänner), 18 Aruanded, 19 Teavitused (mallid), Seaded (kasutajad, kaitse, konto)
- [x] Aegly paketid (Solo 9 €, Salong 19 €, Suur salong 29 € kuus + km): valik registreerumisel (`/registreeru?pakett=solo&periood=year`), töötajate piirang, Seaded → Pakett ja arveldus, superadmin-vaade `/platvorm` (`SUPERADMIN_EMAILS`)
- [x] Broneerimisvidin: `/w/<salong>` (W1–W8, ootenimekiri W5b), telefonis täisekraanil (M0–M5), paigaldusskript `/w/aegly.js` (W0, pop-up), näidisleht `/w/<salong>/proov`
- [x] Kliendi iseteenindus `/b/<token>`: vaata, muuda aega, tühista, lisa kalendrisse (.ics) (S1–S3)
- [ ] Vidina makseosa (W7 makseviisid, W7b pangalink + aja hoidmine, W7c) ja kinkekaardi ost (W9) – koos Stripe'iga
- [ ] Teavituste saatmine (e-posti ja SMS-i teenusepakkuja)
- [ ] Stripe Connect maksed ja Stripe Billing (paketi kuumaks)
- [x] Robotikaitse sisselogimisel ja registreerumisel: katsete piirang (5 viga / e-post / 15 min, 20 / IP), lõksuväli, Cloudflare Turnstile (`TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`)
- [x] Superadmin `/platvorm/<id>`: salongi andmed, pakett ja staatus, kasutajate ajutine parool, salongi kontole sisenemine (2 h, riba „Lõpeta ja naase“), salongi kustutamine
- [x] Parooli taastamine (`/parool/unustasin`, link kehtib 1 h) ja e-posti kinnitamine (`/kinnita`, riba halduspaneelis)
- [x] Rollid: omanik / administraator / töötaja (`src/lib/permissions.ts`); töötaja näeb oma kalendrit ja broneeringuid; kutsed e-postiga (`/kutse`), töötaja sidumine profiiliga
- [x] Õiguslikud mustandid: `/tingimused`, `/privaatsus`, `/andmetootlus` (ettevõtte andmed `LEGAL_*` muutujatest, vajab juristi ülevaatust)
- [x] Teavitused: kinnitus, muudatus, tühistamine, meeldetuletus ja arvustus kliendile, teated salongile, ootenimekiri. E-post Resendiga (`RESEND_API_KEY`), SMS Messentega (`MESSENTE_API_*`); ilma võtmeteta ainult logi (Teavitused → Saadetud). Ajastatud töö `/api/cron/teavitused` iga 15 min (GitHub Actions `.github/workflows/teavitused.yml`, `CRON_SECRET`)
