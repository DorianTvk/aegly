import type { Metadata } from "next";
import Link from "next/link";
import { LEGAL } from "../legal";

export const metadata: Metadata = { title: "Kasutustingimused", description: "Aegly broneerimistarkvara kasutustingimused salongidele." };

export default function TermsPage() {
  return (
    <>
      <h1>Kasutustingimused</h1>
      <p className="text-sm text-muted">Kehtib alates {LEGAL.effective}</p>

      <h2>1. Mõisted</h2>
      <ul>
        <li><b>Aegly</b> või <b>Teenusepakkuja</b> – {LEGAL.company} (registrikood {LEGAL.regCode}), kes pakub Aegly tarkvara.</li>
        <li><b>Teenus</b> – Aegly broneerimistarkvara: halduspaneel, broneerimisvidin, teavitused ja nendega seotud funktsioonid.</li>
        <li><b>Klient</b> – ettevõte või füüsilisest isikust ettevõtja (nt salong), kes loob Aegly konto ja kasutab Teenust oma majandustegevuses.</li>
        <li><b>Kasutaja</b> – Kliendi omanik, administraator või töötaja, kellel on Kliendi kontol ligipääs.</li>
        <li><b>Lõppklient</b> – isik, kes broneerib Kliendi teenuse broneerimisvidina kaudu.</li>
      </ul>

      <h2>2. Lepingu sõlmimine</h2>
      <p>Leping Aegly ja Kliendi vahel sõlmitakse, kui Klient loob konto ja nõustub nende tingimustega. Konto loomisel kinnitab Klient, et tegutseb majandus- või kutsetegevuse raames ning et esitatud andmed on õiged. Teenus on mõeldud ettevõtetele; tarbijakaitse sätteid kohaldatakse ainult ulatuses, milles seadus seda kohustuslikult nõuab.</p>
      <p>Lepingu lahutamatu osa on <Link href="/andmetootlus">andmetöötlusleping</Link>, mis reguleerib Lõppklientide isikuandmete töötlemist.</p>

      <h2>3. Paketid ja tasud</h2>
      <ul>
        <li>Teenuse eest tasutakse valitud paketi järgi kuu või aasta kaupa ettemaksuna. Kehtivad hinnad on avaldatud Aegly veebilehel; hindadele lisandub käibemaks.</li>
        <li>Paketid erinevad ainult aktiivsete töötajate arvu poolest. Paketi saab igal ajal vahetada; suurema paketi tasu arvestatakse vahetuse hetkest.</li>
        <li>SMS-teavitused on tasulised vastavalt kehtivale hinnakirjale. E-posti teavitused sisalduvad paketis.</li>
        <li>Lõppklientide makseid (ettemaksud, kinkekaardid jms) töötleb makseteenuse pakkuja (Stripe) otse Kliendi kontole. Makseteenuse pakkuja tasud määrab makseteenuse pakkuja. Aegly Lõppklientide maksetelt vahendustasu ei võta.</li>
        <li>Makse hilinemisel võib Aegly pärast meeldetuletust peatada broneerimisvidina. Andmeid ei kustutata peatamise tõttu.</li>
      </ul>

      <h2>4. Kliendi kohustused</h2>
      <ul>
        <li>Hoida kasutajakontode paroole salajas ja anda ligipääs ainult oma töötajatele ning vajalikus ulatuses.</li>
        <li>Kasutada Teenust kooskõlas seadustega, sh tarbijakaitse, isikuandmete kaitse ja reklaami nõuetega.</li>
        <li>Omada õiguslikku alust Lõppklientide andmete töötlemiseks ja teavitada Lõppkliente andmete töötlemisest (nt oma privaatsusteates).</li>
        <li>Kehtestada oma teenuste broneerimise, tühistamise ja ettemaksu tingimused ning teha need Lõppklientidele kättesaadavaks.</li>
        <li>Mitte kasutada Teenust rämpsposti saatmiseks, süsteemi koormamiseks, turvameetmetest möödahiilimiseks ega muul viisil, mis kahjustab Aeglyt või teisi kliente.</li>
      </ul>

      <h2>5. Aegly kohustused</h2>
      <ul>
        <li>Pakkuda Teenust mõistliku hoolsusega ja tagada selle kättesaadavus parimal võimalikul viisil. Planeeritud hooldustöödest teavitatakse võimalusel ette.</li>
        <li>Rakendada asjakohaseid tehnilisi ja korralduslikke turvameetmeid (krüpteeritud ühendused, juurdepääsu piiramine, varukoopiad).</li>
        <li>Töödelda Kliendi kontole sisestatud Lõppklientide andmeid ainult Kliendi juhiste järgi vastavalt andmetöötluslepingule.</li>
      </ul>

      <h2>6. Andmed ja intellektuaalomand</h2>
      <p>Kliendi kontole sisestatud andmed (teenused, töötajad, broneeringud, Lõppklientide andmed) kuuluvad Kliendile. Klient saab neid igal ajal eksportida. Aegly tarkvara, kujundus ja kaubamärk kuuluvad Aeglyle; Kliendile antakse lepingu kehtivuse ajaks lihtlitsents Teenuse kasutamiseks.</p>

      <h2>7. Vastutus</h2>
      <ul>
        <li>Teenust pakutakse „nagu on“. Aegly ei vastuta kaudse kahju, saamata jäänud tulu ega kolmandate isikute (nt makse- või sideteenuse pakkujate) teenuste katkestuste eest.</li>
        <li>Aegly vastutus on piiratud summaga, mille Klient on Aeglyle tasunud kahju tekkimisele eelnenud 12 kuu jooksul, välja arvatud tahtluse või raske hooletuse korral.</li>
        <li>Klient vastutab oma teenuste, hindade, tühistamistingimuste ja Lõppklientidega sõlmitud lepingute eest.</li>
      </ul>

      <h2>8. Lepingu lõpetamine</h2>
      <ul>
        <li>Klient võib lepingu igal ajal lõpetada, kustutades konto Seadete all või teavitades Aeglyt. Ette makstud perioodi tasu ei tagastata, kui seadus ei nõua teisiti.</li>
        <li>Aegly võib lepingu lõpetada 30-päevase etteteatamisega. Tingimuste olulise rikkumise korral võib Aegly ligipääsu peatada või lepingu lõpetada viivitamata.</li>
        <li>Pärast konto kustutamist kustutatakse Kliendi andmed andmetöötluslepingus kirjeldatud tähtaegadel.</li>
      </ul>

      <h2>9. Tingimuste muutmine</h2>
      <p>Aegly võib tingimusi muuta, teavitades Kliente e-posti teel vähemalt 30 päeva enne muudatuste jõustumist. Kui Klient muudatustega ei nõustu, võib ta lepingu enne jõustumist lõpetada.</p>

      <h2>10. Kohaldatav õigus ja vaidlused</h2>
      <p>Lepingule kohaldatakse Eesti Vabariigi õigust. Vaidlused lahendatakse läbirääkimiste teel, kokkuleppe puudumisel Harju Maakohtus.</p>

      <h2>11. Kontakt</h2>
      <p>{LEGAL.company}, {LEGAL.address}, e-post <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>.</p>
    </>
  );
}
