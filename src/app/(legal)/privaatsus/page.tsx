import type { Metadata } from "next";
import Link from "next/link";
import { LEGAL } from "../legal";
import { SubprocessorTable } from "../subprocessors";

export const metadata: Metadata = { title: "Privaatsuspoliitika", description: "Kuidas Aegly isikuandmeid töötleb." };

export default function PrivacyPage() {
  return (
    <>
      <h1>Privaatsuspoliitika</h1>
      <p className="text-sm text-muted">Kehtib alates {LEGAL.effective}</p>

      <p>See poliitika selgitab, kuidas {LEGAL.company} („Aegly“) töötleb isikuandmeid. Aeglyl on kaks rolli:</p>
      <ul>
        <li><b>Vastutav töötleja</b> – teenusepakkujate (meie klientide) ja nende kasutajate andmete puhul, mida vajame konto, arvelduse ja kliendisuhtluse jaoks.</li>
        <li><b>Volitatud töötleja</b> – teenusepakkujate klientide (broneerijate) andmete puhul. Nende andmete vastutav töötleja on teenusepakkuja, kelle juurde aeg broneeritakse. Selle töötlemise tingimused on kirjas <Link href="/andmetootlus">andmetöötluslepingus</Link>. Küsimuste korral oma broneeringu andmete kohta pöördu esmalt salongi poole.</li>
      </ul>

      <h2>1. Milliseid andmeid töötleme</h2>
      <h3>Teenusepakkujad ja kasutajad</h3>
      <ul>
        <li>Konto andmed: nimi, e-post, roll, krüpteeritud parool.</li>
        <li>Ettevõtte andmed: nimi, registrikood, aadress, kontaktid, pakett ja arveldusandmed.</li>
        <li>Turvalisuse ja tehnilised andmed: sisselogimiste aeg, IP-aadress (robotikaitse ja kuritarvituste tõkestamine), sessiooniküpsis.</li>
      </ul>
      <h3>Broneerijad (teenusepakkuja nimel)</h3>
      <ul>
        <li>Nimi, e-post, telefon, broneeritud teenus, aeg ja töötaja, makse olek, nõusolekud (nt SMS-meeldetuletused), teenusepakkuja lisatud märkmed.</li>
      </ul>

      <h2>2. Eesmärgid ja õiguslikud alused</h2>
      <table>
        <thead>
          <tr>
            <th scope="col">Eesmärk</th>
            <th scope="col">Õiguslik alus</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>Konto loomine ja Teenuse osutamine</td><td>Lepingu täitmine</td></tr>
          <tr><td>Arveldus ja raamatupidamine</td><td>Juriidiline kohustus</td></tr>
          <tr><td>Turvalisus, robotikaitse, kuritarvituste tõkestamine</td><td>Õigustatud huvi</td></tr>
          <tr><td>Teenusega seotud teated (nt parooli taastamine, muudatused)</td><td>Lepingu täitmine</td></tr>
          <tr><td>Broneeringute haldamine ja teavitused broneerijatele</td><td>Teenusepakkuja juhised (volitatud töötlejana)</td></tr>
        </tbody>
      </table>

      <h2>3. Kellele andmeid edastame</h2>
      <p>Kasutame usaldusväärseid teenusepakkujaid (alamtöötlejaid). Andmeid ei müüda ega kasutata reklaamiks.</p>
      <SubprocessorTable />
      <p>Kui andmed liiguvad väljapoole Euroopa Majanduspiirkonda (nt USA), tagame isikuandmete kaitse üldmääruse kohase kaitse, näiteks Euroopa Komisjoni standardsete lepinguklauslite või kaitse piisavuse otsuse alusel.</p>

      <h2>4. Säilitamine</h2>
      <ul>
        <li>Konto andmeid säilitame lepingu kehtivuse ajal ja kustutame 30 päeva jooksul pärast konto kustutamist, välja arvatud andmed, mida peame seaduse järgi kauem säilitama (nt raamatupidamisdokumendid 7 aastat).</li>
        <li>Sisselogimiskatsete ja turvalogide andmeid säilitame kuni 7 päeva.</li>
        <li>Broneerijate andmeid säilitame teenusepakkuja juhiste järgi; teenusepakkuja saab andmeid igal ajal eksportida või kustutada.</li>
      </ul>

      <h2>5. Küpsised</h2>
      <p>Halduspaneel kasutab ainult hädavajalikku sessiooniküpsist sisselogimise hoidmiseks. Broneerimisvidin ei kasuta jälgimis- ega reklaamiküpsiseid. Robotikaitse (Cloudflare Turnstile) võib kasutada tehnilisi andmeid inimese ja roboti eristamiseks.</p>

      <h2>6. Sinu õigused</h2>
      <p>Sul on õigus tutvuda oma andmetega, neid parandada, kustutada, piirata nende töötlemist, esitada vastuväiteid ja saada oma andmed masinloetaval kujul. Õiguste kasutamiseks kirjuta <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>. Vastame hiljemalt ühe kuu jooksul.</p>
      <p>Kui leiad, et sinu õigusi on rikutud, võid pöörduda Andmekaitse Inspektsiooni poole (www.aki.ee).</p>

      <h2>7. Turvalisus</h2>
      <p>Ühendused on krüpteeritud (HTTPS), paroolid salvestatakse räsituna, ligipääs on rollipõhine ja sisselogimiskatseid piiratakse. Andmed asuvad Euroopa Liidus asuvates andmekeskustes.</p>

      <h2>8. Muudatused</h2>
      <p>Poliitika olulistest muudatustest teavitame kliente e-posti teel. Kehtiv versioon on alati sellel lehel.</p>
    </>
  );
}
