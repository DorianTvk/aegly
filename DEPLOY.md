# Aegly juurutamine (Vercel + Neon, tasuta)

Tulemus: rakendus aadressil `https://<projekt>.vercel.app`, andmebaas Neonis. Domeeni saab hiljem juurde lisada.

## 1. Andmebaas (Neon)

1. Loo konto: https://neon.tech (logi sisse GitHubiga).
2. **Create project** → nimi `aegly`, piirkond **AWS Europe Central (Frankfurt)**, Postgres viimane versioon.
3. **Connect** → vali **Pooled connection** (aadressis on `-pooler`) → kopeeri ühenduse aadress
   (`postgresql://…@…-pooler….neon.tech/neondb?sslmode=require`). See on `DATABASE_URL`.

## 2. Rakendus (Vercel)

1. Loo konto: https://vercel.com (logi sisse GitHubiga, vali tasuta **Hobby**).
2. **Add New → Project** → impordi repo `DorianTvk/aegly`. Framework tuvastatakse ise (Next.js).
3. Ava **Environment Variables** ja lisa:

| Nimi | Väärtus |
|---|---|
| `DATABASE_URL` | Neoni *pooled* aadress (samm 1) |
| `CRON_SECRET` | suvaline pikk juhuslik tekst (nt 40 tähemärki) |
| `SUPERADMIN_EMAILS` | sinu e-post, millega sisse logid |
| `RESEND_API_KEY` | Resendi võti (võib ka hiljem lisada) |
| `EMAIL_FROM` | `onboarding@resend.dev` (kuni oma domeen on kinnitatud) |
| `APP_URL` | jäta esialgu tühjaks, lisa pärast esimest juurutust (samm 5) |

4. **Deploy**. Ehitamisel käivitatakse automaatselt andmebaasi migratsioonid (`vercel-build`).

## 3. Demoandmed (valikuline)

Arvutis projekti kaustas (kasutab Neoni aadressi, mitte kohalikku):

```bash
DATABASE_URL="<Neoni aadress>" npm run db:seed
```

Demosalong: `triin@studiolumi.ee` / `aegly-demo`.

## 4. Meeldetuletused iga 15 minuti järel (GitHub Actions)

Verceli tasuta pakett käivitab ajastatud töid ainult kord päevas, seega käivitab neid GitHub (tasuta).

GitHubis: repo → **Settings → Secrets and variables → Actions → New repository secret**:

- `APP_URL` = `https://<projekt>.vercel.app`
- `CRON_SECRET` = sama väärtus mis Vercelis

Kontroll: **Actions → Teavitused → Run workflow**, logis peab olema `{"ok":true,…}`.

## 5. Pärast esimest juurutust

1. Kopeeri Verceli antud aadress (nt `https://aegly.vercel.app`).
2. Lisa Vercelis `APP_URL` = see aadress → **Deployments → Redeploy**.
3. Ava `https://<projekt>.vercel.app/w/studio-lumi/proov` ja tee testbroneering.

## Hiljem: oma domeen

1. Osta domeen (nt `aegly.ee`).
2. Vercel → projekt → **Settings → Domains**: lisa `app.aegly.ee` (ja hiljem müügilehe jaoks `aegly.ee`), lisa registripidaja DNS-i kirjed, mida Vercel näitab.
3. Muuda `APP_URL` = `https://app.aegly.ee` ja GitHubi saladus `APP_URL` samaks.
4. Resend → **Domains → Add domain** → lisa DNS-kirjed → kui „Verified“, siis `EMAIL_FROM` = `broneeringud@aegly.ee`.
5. Loo Resendis uus API võti ja kustuta vana.
