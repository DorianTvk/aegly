import type { Metadata } from "next";
import Link from "next/link";
import { LEGAL } from "../legal";
import { SubprocessorTable } from "../subprocessors";

export const metadata: Metadata = { title: "Andmetöötlusleping", description: "Aegly ja salongi vaheline isikuandmete töötlemise leping (GDPR art 28)." };

export default function DpaPage() {
  return (
    <>
      <h1>Andmetöötlusleping</h1>
      <p className="text-sm text-muted">Isikuandmete kaitse üldmääruse (GDPR) artikli 28 kohane leping · kehtib alates {LEGAL.effective}</p>

      <p>See leping on Aegly <Link href="/tingimused">kasutustingimuste</Link> lahutamatu osa ja sõlmitakse Aegly konto loomisega salongi (edaspidi <b>Vastutav töötleja</b>) ja {LEGAL.company} (edaspidi <b>Volitatud töötleja</b>) vahel.</p>

      <h2>1. Töötlemise ese ja kestus</h2>
      <p>Volitatud töötleja töötleb Vastutava töötleja nimel isikuandmeid Aegly broneerimistarkvara osutamiseks lepingu kehtivuse ajal.</p>

      <h2>2. Töötlemise iseloom ja eesmärk</h2>
      <p>Andmete salvestamine, korrastamine, kuvamine, edastamine (teavitused) ja kustutamine eesmärgiga võimaldada Vastutava töötleja klientidel aegu broneerida ning Vastutaval töötlejal broneeringuid, kliente ja makseid hallata.</p>

      <h2>3. Andmesubjektid ja andmete liigid</h2>
      <ul>
        <li><b>Andmesubjektid:</b> Vastutava töötleja kliendid (broneerijad) ja töötajad.</li>
        <li><b>Andmed:</b> nimi, e-post, telefon, broneeringute ajalugu, teenused, makse olek, nõusolekud, Vastutava töötleja lisatud märkmed; töötajate nimi, kontaktid ja tööajad.</li>
        <li><b>Eriliigilised andmed:</b> Teenus ei ole mõeldud eriliigiliste andmete (nt terviseandmete) töötlemiseks. Vastutav töötleja ei sisesta neid märkmetesse, välja arvatud juhul, kui tal on selleks seaduslik alus, ja vastutab sellisel juhul nende töötlemise õiguspärasuse eest.</li>
      </ul>

      <h2>4. Volitatud töötleja kohustused</h2>
      <ol>
        <li>Töötleb isikuandmeid ainult Vastutava töötleja dokumenteeritud juhiste alusel; juhisteks loetakse ka Teenuse seadistamist ja kasutamist.</li>
        <li>Tagab, et andmeid töötlevad isikud on kohustatud hoidma konfidentsiaalsust.</li>
        <li>Rakendab asjakohaseid tehnilisi ja korralduslikke meetmeid: krüpteeritud ühendused, räsitud paroolid, rollipõhine ligipääs, sisselogimiskatsete piiramine, varukoopiad ja andmete hoidmine EL-i andmekeskustes.</li>
        <li>Aitab Vastutaval töötlejal vastata andmesubjektide taotlustele. Teenuses on selleks kliendiandmete eksport ja kustutamine.</li>
        <li>Teavitab Vastutavat töötlejat isikuandmetega seotud rikkumisest põhjendamatu viivituseta, võimaluse korral 48 tunni jooksul pärast sellest teada saamist.</li>
        <li>Teeb Vastutavale töötlejale kättesaadavaks teabe, mis on vajalik käesoleva lepingu täitmise tõendamiseks, ja võimaldab mõistliku etteteatamisega auditeid.</li>
      </ol>

      <h2>5. Alamtöötlejad</h2>
      <p>Vastutav töötleja annab üldise loa kasutada allpool loetletud alamtöötlejaid. Volitatud töötleja teavitab Vastutavat töötlejat alamtöötlejate lisamisest või vahetamisest vähemalt 30 päeva ette; Vastutav töötleja võib põhjendatud juhul esitada vastuväite või lepingu lõpetada. Volitatud töötleja sõlmib alamtöötlejatega samaväärsed andmekaitsekohustused.</p>
      <SubprocessorTable />

      <h2>6. Andmete edastamine väljapoole EMP-d</h2>
      <p>Kui alamtöötleja asub väljaspool Euroopa Majanduspiirkonda, toimub edastamine Euroopa Komisjoni kaitse piisavuse otsuse või standardsete lepinguklauslite alusel.</p>

      <h2>7. Vastutava töötleja kohustused</h2>
      <ul>
        <li>Tagab, et tal on õiguslik alus andmete töötlemiseks ja et andmesubjekte on töötlemisest teavitatud.</li>
        <li>Annab Teenuses ligipääsu ainult neile isikutele, kes seda vajavad, ja hoiab paroolid salajas.</li>
      </ul>

      <h2>8. Lepingu lõppemine ja andmete kustutamine</h2>
      <p>Lepingu lõppemisel saab Vastutav töötleja andmed enne konto kustutamist eksportida. Volitatud töötleja kustutab andmed 30 päeva jooksul pärast konto kustutamist ning varukoopiatest nende tavapärase tsükli jooksul (kuni 30 päeva), välja arvatud juhul, kui seadus nõuab säilitamist.</p>

      <h2>9. Vastutus</h2>
      <p>Poolte vastutus käesoleva lepingu alusel on reguleeritud kasutustingimustega, arvestades isikuandmete kaitse üldmääruse artiklit 82.</p>

      <h2>10. Kontakt</h2>
      <p>Andmekaitse küsimused: <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>.</p>
    </>
  );
}
