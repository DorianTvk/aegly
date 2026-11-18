/** Ettevõtte andmed õiguslikes dokumentides – täida enne avaldamist (või keskkonnamuutujatega). */
export const LEGAL = {
  company: process.env.LEGAL_COMPANY || "[ETTEVÕTTE NIMI] OÜ",
  regCode: process.env.LEGAL_REG_CODE || "[REGISTRIKOOD]",
  address: process.env.LEGAL_ADDRESS || "[AADRESS], Eesti",
  email: process.env.LEGAL_EMAIL || "info@aegly.ee",
  effective: process.env.LEGAL_EFFECTIVE || "[KEHTIB ALATES]",
};
