/**
 * Valdkonnad registreerimisel. Valik määrab uue konto esialgsed teenusekategooriad
 * (neid saab hiljem vabalt muuta) – muud vahet funktsioonides pole.
 */
/** mcc = kaarditööstuse tegevusala kood (Stripe'i konto loomisel) */
export type Industry = { id: string; label: string; example: string; mcc?: string; categories: { name: string; color: string }[] };

export const INDUSTRIES: Industry[] = [
  { id: "ilu", mcc: "7230", label: "Ilu ja juuksur", example: "nt Studio Lumi", categories: [{ name: "Juuksur", color: "#7a5af8" }, { name: "Küüned", color: "#ee46bc" }, { name: "Ripsmed ja kulmud", color: "#f79009" }, { name: "Näohooldus", color: "#12b76a" }] },
  { id: "massaaz", mcc: "7298", label: "Massaaž ja spaa", example: "nt Rahu Massaažistuudio", categories: [{ name: "Massaaž", color: "#12b76a" }, { name: "Kehahooldus", color: "#7a5af8" }, { name: "Spaa", color: "#2e90fa" }] },
  { id: "tervis", mcc: "8099", label: "Tervis ja teraapia", example: "nt Liikumise Füsioteraapia", categories: [{ name: "Konsultatsioon", color: "#2e90fa" }, { name: "Teraapia", color: "#12b76a" }, { name: "Järelkontroll", color: "#7a5af8" }] },
  { id: "sport", mcc: "7997", label: "Sport ja treening", example: "nt Jõud Personaaltreening", categories: [{ name: "Personaaltreening", color: "#f04438" }, { name: "Grupitreening", color: "#f79009" }, { name: "Konsultatsioon", color: "#2e90fa" }] },
  { id: "auto", mcc: "7538", label: "Autoteenindus", example: "nt Kiire Rehv OÜ", categories: [{ name: "Rehvivahetus", color: "#475467" }, { name: "Hooldus", color: "#2e90fa" }, { name: "Pesu", color: "#12b76a" }] },
  { id: "koolitus", mcc: "8299", label: "Koolitus ja õpe", example: "nt Keeleklubi", categories: [{ name: "Individuaaltund", color: "#7a5af8" }, { name: "Grupitund", color: "#f79009" }, { name: "Konsultatsioon", color: "#2e90fa" }] },
  { id: "foto", mcc: "7221", label: "Fotograafia ja loovtöö", example: "nt Valguse Fotostuudio", categories: [{ name: "Pildistamine", color: "#ee46bc" }, { name: "Stuudio rent", color: "#475467" }] },
  { id: "loomad", mcc: "0742", label: "Lemmikloomad", example: "nt Käpp Trimmistuudio", categories: [{ name: "Trimmimine", color: "#f79009" }, { name: "Pesu ja hooldus", color: "#12b76a" }] },
  { id: "muu", label: "Muu teenus", example: "nt Minu Ettevõte OÜ", categories: [{ name: "Teenused", color: "#7a5af8" }] },
];

export const findIndustry = (id: unknown) => INDUSTRIES.find((i) => i.id === id) ?? INDUSTRIES[INDUSTRIES.length - 1];

export const industryByLabel = (label: string | null | undefined) => INDUSTRIES.find((i) => i.label === label);
