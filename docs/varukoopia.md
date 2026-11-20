# Varukoopiad ja taastamine

Aeglyl on kolm kaitsekihti:

| Mis | Kui kaugele | Kus |
|---|---|---|
| Neoni ajalugu (instant restore) | 6 tundi (tasuta pakett), Launch paketis kuni 7 päeva | Neon → Backup & Restore |
| Neoni snapshot | käsitsi tehtud hetk, ei aegu | Neon → Backup & Restore → snapshot'id |
| Öine krüptitud koopia | 30 päeva, iga öö | GitHub → Actions → „Varukoopia“ → artefaktid |

## Kui midagi läks valesti (viimase 6 tunni jooksul)

1. Neon → **Backup & Restore** → vali kellaaeg *enne* viga.
2. Vajuta **Preview data** ja kontrolli, et andmed on õiged.
3. Alles siis **Restore**. Neon jätab eelmisest seisust automaatselt varuharu.

## Taastamine öisest koopiast

1. GitHub → **Actions** → „Varukoopia“ → vali õige öö käivitus → **Artifacts** → laadi alla `aegly-AAAA-KK-PP.dump.gpg` (zip-failina, paki lahti).
2. Dekrüpti (küsib `BACKUP_PASSPHRASE` väärtust):
   ```sh
   gpg --decrypt aegly-2026-11-20.dump.gpg > aegly.dump
   ```
3. Loo Neonis **uus haru** (Branches → New branch), kopeeri selle ühendus (otseühendus, mitte pooled).
4. Taasta uude harusse – mitte otse production'i:
   ```sh
   pg_restore --no-owner --no-privileges --clean --if-exists -d "postgresql://…uus-haru…" aegly.dump
   ```
5. Kontrolli andmed üle. Kui kõik on õige: Neon → Branches → uus haru → **Set as default**,
   või vaheta Vercelis `DATABASE_URL` uue haru vastu ja tee redeploy.

`BACKUP_PASSPHRASE` hoia paroolihalduris – ilma selleta ei saa koopiat avada.
