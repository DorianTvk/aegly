/**
 * Paroolireeglid (NIST SP 800-63B vaimus): pikkus loeb, keerulised koostisreeglid mitte.
 * Keelatud on levinud ja kergesti äraarvatavad paroolid ning e-posti/nime/ettevõtte nimega paroolid.
 * Lekkinud paroolide kontroll (Have I Been Pwned) on eraldi serveris – vt server/pwned.ts.
 */

export const MIN_PASSWORD_LENGTH = 10;
export const MAX_PASSWORD_LENGTH = 128;
export const PASSWORD_HINT = `Vähemalt ${MIN_PASSWORD_LENGTH} märki. Hea parool on näiteks 3–4 juhuslikku sõna.`;

// levinumad paroolid ja nende tüvid (eesti + inglise); kontrollitakse pärast numbrite/sümbolite eemaldamist
const COMMON = new Set([
  "password", "passw0rd", "parool", "salasona", "salasõna", "qwerty", "qwertyuiop", "asdfgh", "asdfghjkl", "zxcvbnm", "letmein",
  "welcome", "tere", "teretulemast", "admin", "administrator", "login", "iloveyou", "armastan", "dragon", "monkey", "football",
  "jalgpall", "sunshine", "princess", "master", "superman", "batman", "trustno", "starwars", "whatever", "freedom", "hello",
  "secret", "changeme", "default", "abc", "abcdef", "abcdefgh", "aegly", "broneering", "booking", "salong", "salon", "tallinn",
  "tartu", "eesti", "estonia", "kalev", "kevad", "suvi", "sugis", "sügis", "talv", "jaanuar", "veebruar", "aprill", "september",
  "oktoober", "november", "detsember", "summer", "winter", "spring", "autumn", "google", "facebook", "instagram", "test", "testing",
]);

const norm = (s: string) => s.toLowerCase().normalize("NFKC");

/** Kas parool koosneb ainult kordusest ("aaaaaaaa", "abcabcabc") või järjestusest ("12345678", "abcdefgh") */
function isTrivialPattern(pw: string): boolean {
  const p = norm(pw);
  if (new Set(p).size <= 2) return true;
  for (let len = 1; len <= 4; len++) {
    const unit = p.slice(0, len);
    if (unit.repeat(Math.ceil(p.length / len)).slice(0, p.length) === p) return true;
  }
  // tõusev/laskuv jada (sammu 1 või −1 märgikoodides), nt 0123456789, abcdefghij, 9876543210
  let up = true, down = true;
  for (let i = 1; i < p.length; i++) {
    const d = p.charCodeAt(i) - p.charCodeAt(i - 1);
    if (d !== 1) up = false;
    if (d !== -1) down = false;
  }
  if (up || down) return true;
  // klaviatuurirea jada
  const rows = ["1234567890", "qwertyuiopü", "asdfghjklöä", "zxcvbnm"];
  return rows.some((r) => p.length >= 6 && (r.includes(p) || r.split("").reverse().join("").includes(p)));
}

/** Parool ilma numbrite ja sümboliteta lõpus/alguses ("Parool2024!" → "parool") */
const stem = (pw: string) => norm(pw).replace(/^[^a-zõäöüšž]+|[^a-zõäöüšž]+$/g, "").replace(/[@4]/g, "a").replace(/0/g, "o").replace(/[1!|]/g, "i").replace(/3/g, "e").replace(/[5$]/g, "s");

/**
 * Kontrolli uut parooli. Tagastab vea teksti (eesti keeles) või null, kui parool sobib.
 * `context`: kasutaja e-post, nimi ja ettevõtte nimi – neid ei tohi parool sisaldada.
 */
export function checkPasswordPolicy(pw: string, context: { email?: string | null; name?: string | null; business?: string | null } = {}): string | null {
  if (pw.length < MIN_PASSWORD_LENGTH) return `Parool peab olema vähemalt ${MIN_PASSWORD_LENGTH} märki`;
  if (pw.length > MAX_PASSWORD_LENGTH) return `Parool võib olla kuni ${MAX_PASSWORD_LENGTH} märki`;
  if (isTrivialPattern(pw)) return "Parool on liiga lihtne (kordus või jada). Vali midagi, mida on raske ära arvata.";
  const st = stem(pw);
  if (COMMON.has(norm(pw)) || COMMON.has(st) || (st.length >= 3 && [...COMMON].some((c) => c.length >= 5 && st === c))) {
    return "See on väga levinud parool. Vali midagi, mida on raske ära arvata.";
  }
  const p = norm(pw);
  const parts = [
    context.email?.split("@")[0],
    ...(context.name?.split(/\s+/) ?? []),
    ...(context.business?.split(/\s+/) ?? []),
  ]
    .map((x) => (x ? norm(x).replace(/[^a-z0-9õäöüšž]/g, "") : ""))
    .filter((x) => x.length >= 4);
  // kui nime/e-posti/ettevõtte osad välja võtta, peab alles jääma vähemalt 6 märki
  let rest = p;
  for (const x of parts) rest = rest.split(x).join("");
  if (rest.length < p.length && rest.replace(/[^a-z0-9õäöüšž]/g, "").length < 6) {
    return "Parool ei tohi põhineda sinu nimel, e-postil ega ettevõtte nimel.";
  }
  return null;
}

/** Ligikaudne tugevus kasutajaliidese riba jaoks: 0 (nõrk) … 4 (väga tugev) */
export function passwordScore(pw: string): 0 | 1 | 2 | 3 | 4 {
  if (!pw || pw.length < MIN_PASSWORD_LENGTH || isTrivialPattern(pw) || COMMON.has(stem(pw))) return 0;
  const classes = [/[a-zõäöüšž]/, /[A-ZÕÄÖÜŠŽ]/, /\d/, /[^\wõäöüšžÕÄÖÜŠŽ]/].filter((r) => r.test(pw)).length;
  const words = pw.trim().split(/[\s\-_.]+/).filter((w) => w.length >= 3).length;
  let s = pw.length >= 16 ? 3 : pw.length >= 12 ? 2 : 1;
  if (classes >= 3 || words >= 3) s++;
  return Math.min(4, s) as 0 | 1 | 2 | 3 | 4;
}
