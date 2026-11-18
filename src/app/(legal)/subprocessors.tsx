/** Alamtöötlejad – sama nimekiri privaatsuspoliitikas ja andmetöötluslepingus */
export const SUBPROCESSORS = [
  { name: "Vercel Inc.", purpose: "Rakenduse majutus", location: "Serverid EL-is (Frankfurt); ettevõte USA-s" },
  { name: "Neon Inc.", purpose: "Andmebaas", location: "Serverid EL-is (Frankfurt); ettevõte USA-s" },
  { name: "Resend Inc.", purpose: "E-posti teavituste saatmine", location: "USA" },
  { name: "Messente Communications OÜ", purpose: "SMS-teavituste saatmine (kui kasutusel)", location: "Eesti" },
  { name: "Stripe Payments Europe Ltd.", purpose: "Maksete töötlemine (kui kasutusel)", location: "Iirimaa / USA" },
  { name: "Cloudflare Inc.", purpose: "Robotikaitse sisselogimisel (kui kasutusel)", location: "USA / ülemaailmne" },
];

export function SubprocessorTable() {
  return (
    <table>
      <thead>
        <tr>
          <th scope="col">Töötleja</th>
          <th scope="col">Eesmärk</th>
          <th scope="col">Asukoht</th>
        </tr>
      </thead>
      <tbody>
        {SUBPROCESSORS.map((p) => (
          <tr key={p.name}>
            <td>{p.name}</td>
            <td>{p.purpose}</td>
            <td>{p.location}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
