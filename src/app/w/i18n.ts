/**
 * Broneerimisvidina tõlked (eesti, inglise, vene).
 * Salongi enda sisu (teenuste nimed, kirjeldused, kampaaniad) jääb nii, nagu salong selle sisestas.
 */
import { isoWeekday } from "@/lib/time";

export const LANGS = ["et", "en", "ru"] as const;
export type Lang = (typeof LANGS)[number];

export function parseLang(v: unknown): Lang | null {
  const s = String(v ?? "").toLowerCase().slice(0, 2);
  return (LANGS as readonly string[]).includes(s) ? (s as Lang) : null;
}

/** Accept-Language → toetatud keel (vaikimisi eesti) */
export function detectLang(acceptLanguage: string | null): Lang {
  if (!acceptLanguage) return "et";
  const prefs = acceptLanguage
    .split(",")
    .map((p) => {
      const [tag, q] = p.trim().split(";q=");
      return { lang: parseLang(tag), q: q ? Number(q) : 1 };
    })
    .filter((p) => p.lang)
    .sort((a, b) => b.q - a.q);
  return prefs[0]?.lang ?? "et";
}

const et = {
  back: "Tagasi",
  close: "Sulge",
  language: "Keel",
  stepStaff: "Vali spetsialist",
  stepTime: "Vali aeg",
  stepDetails: "Sinu andmed",
  stepConfirm: "Kinnita broneering",
  oneService: (min: number) => `1 teenus · ${min} min`,
  continue: "Jätka",
  anyone: "Ükskõik kes",
  at: (time: string) => `kell ${time}`,
  pickTime: "Vali sobiv kellaaeg",
  total: "Kokku",
  discount: "soodustus",
  errName: "Sisesta oma nimi.",
  errEmail: "Sisesta kehtiv e-posti aadress.",
  errPhone: "Sisesta telefoninumber.",
  errTerms: "Nõustu broneerimistingimustega.",
  freeCancel: (h: number) => `Tasuta tühistamine kuni ${h} h enne algust`,
  payNotOpened: "Makseleht ei avanenud?",
  openPay: "Ava makseleht",
  openingPay: "Avan makselehe…",
  booking: "Broneerin…",
  payDeposit: (x: string) => `Maksa ettemaks ${x}`,
  confirmBooking: "Kinnita broneering",
  seeYou: (name: string) => `Ootame sind${name ? ` – ${name}` : ""}!`,
  done: "Valmis",
  poweredBy: "Toetab Aegly",
  free: "Tasuta",
  from: "alates ",
  openToday: (h: string) => `Avatud täna ${h}`,
  closedToday: "Täna suletud",
  welcome: "Tere tulemast! Vali endale sobiv teenus ja aeg.",
  depositOnBooking: "Ettemaks broneerimisel",
  cancelUntil: (h: number) => `Tühistamine kuni ${h} h enne`,
  other: "Muud",
  categories: "Kategooriad",
  selected: (n: string) => `${n} valitud`,
  choose: (n: string) => `Vali ${n}`,
  noServices: "Selles kategoorias pole veebis broneeritavaid teenuseid.",
  depositPct: (p: number) => `${p}% ettemaks`,
  doneBy: (names: string) => `Teevad: ${names}`,
  chooseService: "Vali see teenus",
  searching: "Otsin vaba aega…",
  firstFree: (x: string) => `Esimene vaba: ${x}`,
  noFreeSoon: "Lähiajal vabu aegu pole",
  specialist: "Spetsialist",
  firstFreeTime: "Esimene vaba aeg",
  fromPrice: (x: string) => ` · alates ${x}`,
  onLeave: (d: string) => `Puhkusel kuni ${d}`,
  today: "täna",
  tomorrow: "homme",
  todayShort: "Täna",
  prevWeek: "Eelmine nädal",
  nextWeek: "Järgmine nädal",
  noFreeTimes: ", vabu aegu pole",
  timeLabel: "Kellaaeg",
  closedDay: "Sel päeval on suletud",
  tooFar: "Nii kaugele ette ei saa broneerida",
  fullyBooked: "See päev on täielikult broneeritud",
  pickOther: "Vali teine päev",
  orWaitlist: " või liitu ootenimekirjaga",
  nextFree: (d: string) => `Järgmine vaba päev: ${d}`,
  joinWaitlist: "Liitu ootenimekirjaga",
  notifyWhen: (d: string) => `Saa teavitus, kui ${d} aeg vabaneb`,
  name: "Nimi",
  email: "E-post",
  onWaitlist: "Oled ootenimekirjas. Anname teada, kui aeg vabaneb.",
  cantFind: "Ei leia sobivat aega? Saa teavitus, kui aeg vabaneb",
  fullName: "Täisnimi",
  phone: "Telefon",
  promo: "Sooduskood",
  remove: "Eemalda",
  apply: "Rakenda",
  applied: (code: string, x: string) => `${code} rakendatud: ${x}`,
  smsReminder: "Saada mulle SMS-meeldetuletus enne aega",
  acceptTerms: "Nõustun broneerimistingimustega",
  depositOnline: (dep: string, rest: string | null, h: number) =>
    `Broneeringu kinnitamiseks tasud kohe ettemaksu ${dep}${rest ? `, ülejäänud ${rest} kohapeal` : ""}. Tühistamisel kuni ${h} h enne algust saad ettemaksu tagasi.`,
  depositOffline: (dep: string, total: string) => `Selle teenuse ettemaks on ${dep}. Praegu tasud kogu summa (${total}) kohapeal.`,
  payOnSite: "Tasud kohapeal pärast teenust.",
  changeLink: (h: number) => `Saad aega muuta või tühistada kinnituskirjas oleva lingi kaudu kuni ${h} h enne algust.`,
  rowService: "Teenus",
  rowTime: "Aeg",
  rowStaff: "Spetsialist",
  rowPrice: "Hind",
  payOnSiteShort: "tasud kohapeal",
  bookingNo: "Broneeringu nr",
  booked: "Aeg on broneeritud!",
  confirmationTo: (e: string) => `Kinnitus saadetakse aadressile ${e}.`,
  addCal: "Lisa kalendrisse",
  change: "Muuda",
  questions: (p: string) => `Küsimused: ${p}`,
  campaign: "Kampaania",
  code: "Sooduskood",
  freeTag: "(tasuta)",
};

export type Dict = typeof et;

const en: Dict = {
  back: "Back",
  close: "Close",
  language: "Language",
  stepStaff: "Choose a specialist",
  stepTime: "Choose a time",
  stepDetails: "Your details",
  stepConfirm: "Confirm booking",
  oneService: (min) => `1 service · ${min} min`,
  continue: "Continue",
  anyone: "Anyone",
  at: (time) => `at ${time}`,
  pickTime: "Pick a time that suits you",
  total: "Total",
  discount: "discount",
  errName: "Enter your name.",
  errEmail: "Enter a valid email address.",
  errPhone: "Enter your phone number.",
  errTerms: "Please accept the booking terms.",
  freeCancel: (h) => `Free cancellation up to ${h} h before the start`,
  payNotOpened: "Payment page didn't open?",
  openPay: "Open payment page",
  openingPay: "Opening payment page…",
  booking: "Booking…",
  payDeposit: (x) => `Pay deposit ${x}`,
  confirmBooking: "Confirm booking",
  seeYou: (name) => `See you soon${name ? ` – ${name}` : ""}!`,
  done: "Done",
  poweredBy: "Powered by Aegly",
  free: "Free",
  from: "from ",
  openToday: (h) => `Open today ${h}`,
  closedToday: "Closed today",
  welcome: "Welcome! Choose a service and a time that suit you.",
  depositOnBooking: "Deposit when booking",
  cancelUntil: (h) => `Cancel up to ${h} h before`,
  other: "Other",
  categories: "Categories",
  selected: (n) => `${n} selected`,
  choose: (n) => `Choose ${n}`,
  noServices: "No services in this category can be booked online.",
  depositPct: (p) => `${p}% deposit`,
  doneBy: (names) => `Done by: ${names}`,
  chooseService: "Choose this service",
  searching: "Looking for free times…",
  firstFree: (x) => `First available: ${x}`,
  noFreeSoon: "No free times soon",
  specialist: "Specialist",
  firstFreeTime: "First available time",
  fromPrice: (x) => ` · from ${x}`,
  onLeave: (d) => `On leave until ${d}`,
  today: "today",
  tomorrow: "tomorrow",
  todayShort: "Today",
  prevWeek: "Previous week",
  nextWeek: "Next week",
  noFreeTimes: ", no free times",
  timeLabel: "Time",
  closedDay: "Closed on this day",
  tooFar: "Can't book this far ahead",
  fullyBooked: "This day is fully booked",
  pickOther: "Choose another day",
  orWaitlist: " or join the waitlist",
  nextFree: (d) => `Next free day: ${d}`,
  joinWaitlist: "Join the waitlist",
  notifyWhen: (d) => `Get notified when a time frees up on ${d}`,
  name: "Name",
  email: "Email",
  onWaitlist: "You're on the waitlist. We'll let you know when a time frees up.",
  cantFind: "Can't find a suitable time? Get notified when one frees up",
  fullName: "Full name",
  phone: "Phone",
  promo: "Promo code",
  remove: "Remove",
  apply: "Apply",
  applied: (code, x) => `${code} applied: ${x}`,
  smsReminder: "Send me an SMS reminder before the appointment",
  acceptTerms: "I accept the booking terms",
  depositOnline: (dep, rest, h) => `To confirm the booking you pay a deposit of ${dep} now${rest ? `, the remaining ${rest} on site` : ""}. Cancel up to ${h} h before the start to get the deposit back.`,
  depositOffline: (dep, total) => `This service has a ${dep} deposit. For now you pay the full amount (${total}) on site.`,
  payOnSite: "You pay on site after the service.",
  changeLink: (h) => `You can change or cancel the time via the link in the confirmation email up to ${h} h before the start.`,
  rowService: "Service",
  rowTime: "Time",
  rowStaff: "Specialist",
  rowPrice: "Price",
  payOnSiteShort: "paid on site",
  bookingNo: "Booking no.",
  booked: "You're booked!",
  confirmationTo: (e) => `A confirmation will be sent to ${e}.`,
  addCal: "Add to calendar",
  change: "Change",
  questions: (p) => `Questions: ${p}`,
  campaign: "Campaign",
  code: "Promo code",
  freeTag: "(free)",
};

const ru: Dict = {
  back: "Назад",
  close: "Закрыть",
  language: "Язык",
  stepStaff: "Выберите специалиста",
  stepTime: "Выберите время",
  stepDetails: "Ваши данные",
  stepConfirm: "Подтвердите запись",
  oneService: (min) => `1 услуга · ${min} мин`,
  continue: "Далее",
  anyone: "Любой специалист",
  at: (time) => `в ${time}`,
  pickTime: "Выберите удобное время",
  total: "Итого",
  discount: "скидка",
  errName: "Введите своё имя.",
  errEmail: "Введите действительный адрес эл. почты.",
  errPhone: "Введите номер телефона.",
  errTerms: "Примите условия записи.",
  freeCancel: (h) => `Бесплатная отмена за ${h} ч до начала`,
  payNotOpened: "Страница оплаты не открылась?",
  openPay: "Открыть страницу оплаты",
  openingPay: "Открываем страницу оплаты…",
  booking: "Записываем…",
  payDeposit: (x) => `Оплатить предоплату ${x}`,
  confirmBooking: "Подтвердить запись",
  seeYou: (name) => `Ждём вас${name ? ` – ${name}` : ""}!`,
  done: "Готово",
  poweredBy: "Работает на Aegly",
  free: "Бесплатно",
  from: "от ",
  openToday: (h) => `Сегодня открыто ${h}`,
  closedToday: "Сегодня закрыто",
  welcome: "Добро пожаловать! Выберите услугу и удобное время.",
  depositOnBooking: "Предоплата при записи",
  cancelUntil: (h) => `Отмена за ${h} ч`,
  other: "Другое",
  categories: "Категории",
  selected: (n) => `${n} выбрано`,
  choose: (n) => `Выбрать ${n}`,
  noServices: "В этой категории нет услуг для онлайн-записи.",
  depositPct: (p) => `Предоплата ${p}%`,
  doneBy: (names) => `Выполняют: ${names}`,
  chooseService: "Выбрать эту услугу",
  searching: "Ищем свободное время…",
  firstFree: (x) => `Ближайшее свободное: ${x}`,
  noFreeSoon: "В ближайшее время нет свободных окон",
  specialist: "Специалист",
  firstFreeTime: "Ближайшее свободное время",
  fromPrice: (x) => ` · от ${x}`,
  onLeave: (d) => `В отпуске до ${d}`,
  today: "сегодня",
  tomorrow: "завтра",
  todayShort: "Сег.",
  prevWeek: "Предыдущая неделя",
  nextWeek: "Следующая неделя",
  noFreeTimes: ", нет свободного времени",
  timeLabel: "Время",
  closedDay: "В этот день закрыто",
  tooFar: "Так далеко вперёд записаться нельзя",
  fullyBooked: "Этот день полностью занят",
  pickOther: "Выберите другой день",
  orWaitlist: " или встаньте в лист ожидания",
  nextFree: (d) => `Ближайший свободный день: ${d}`,
  joinWaitlist: "Встать в лист ожидания",
  notifyWhen: (d) => `Сообщить, когда освободится время ${d}`,
  name: "Имя",
  email: "Эл. почта",
  onWaitlist: "Вы в листе ожидания. Сообщим, когда освободится время.",
  cantFind: "Не нашли подходящее время? Сообщим, когда оно освободится",
  fullName: "Имя и фамилия",
  phone: "Телефон",
  promo: "Промокод",
  remove: "Удалить",
  apply: "Применить",
  applied: (code, x) => `${code} применён: ${x}`,
  smsReminder: "Отправить мне SMS-напоминание перед визитом",
  acceptTerms: "Я принимаю условия записи",
  depositOnline: (dep, rest, h) => `Для подтверждения записи вы сейчас вносите предоплату ${dep}${rest ? `, остаток ${rest} — на месте` : ""}. При отмене не позднее чем за ${h} ч до начала предоплата возвращается.`,
  depositOffline: (dep, total) => `Предоплата за эту услугу — ${dep}. Пока вы оплачиваете всю сумму (${total}) на месте.`,
  payOnSite: "Оплата на месте после услуги.",
  changeLink: (h) => `Изменить или отменить запись можно по ссылке в письме-подтверждении не позднее чем за ${h} ч до начала.`,
  rowService: "Услуга",
  rowTime: "Время",
  rowStaff: "Специалист",
  rowPrice: "Цена",
  payOnSiteShort: "оплата на месте",
  bookingNo: "Номер записи",
  booked: "Вы записаны!",
  confirmationTo: (e) => `Подтверждение будет отправлено на ${e}.`,
  addCal: "В календарь",
  change: "Изменить",
  questions: (p) => `Вопросы: ${p}`,
  campaign: "Акция",
  code: "Промокод",
  freeTag: "(бесплатно)",
};

export const DICT: Record<Lang, Dict> = { et, en, ru };

/** Serveri (eestikeelsed) veateated → valitud keel */
const SERVER: Record<string, { en: string; ru: string }> = {
  "See aeg ei ole enam vaba. Vali teine aeg.": { en: "This time is no longer available. Please choose another time.", ru: "Это время уже занято. Выберите другое время." },
  "See aeg broneeriti just ära. Vali teine aeg.": { en: "This time was just booked. Please choose another time.", ru: "Это время только что заняли. Выберите другое время." },
  "Teenust ei leitud": { en: "Service not found", ru: "Услуга не найдена" },
  "Hinda ei õnnestunud arvutada": { en: "Couldn't calculate the price", ru: "Не удалось рассчитать цену" },
  "Kontrolli andmeid": { en: "Please check your details", ru: "Проверьте данные" },
  "Sisesta nimi": { en: "Enter your name", ru: "Введите имя" },
  "Sisesta kehtiv e-post": { en: "Enter a valid email", ru: "Введите действительный e-mail" },
  "Nõustu broneerimistingimustega": { en: "Please accept the booking terms", ru: "Примите условия записи" },
  "Broneerimine ebaõnnestus. Proovi uuesti.": { en: "Booking failed. Please try again.", ru: "Не удалось записаться. Попробуйте ещё раз." },
  "Liiga palju päringuid. Proovi tunni aja pärast uuesti või helista salongi.": { en: "Too many requests. Try again in an hour or call the salon.", ru: "Слишком много запросов. Попробуйте через час или позвоните в салон." },
  "Makse alustamine ebaõnnestus. Proovi uuesti või helista salongi.": { en: "Couldn't start the payment. Try again or call the salon.", ru: "Не удалось начать оплату. Попробуйте ещё раз или позвоните в салон." },
  "Sellist sooduskoodi ei ole": { en: "This promo code doesn't exist", ru: "Такого промокода нет" },
  "Sisesta kood": { en: "Enter a code", ru: "Введите код" },
  "Kood ei kehti veel": { en: "The code isn't valid yet", ru: "Код ещё не действует" },
  "Kood on aegunud": { en: "The code has expired", ru: "Срок действия кода истёк" },
  "Kood on ära kasutatud": { en: "The code has been used up", ru: "Код уже использован" },
  "Oled seda koodi juba kasutanud": { en: "You have already used this code", ru: "Вы уже использовали этот код" },
  "Kood kehtib ainult uutele klientidele": { en: "The code is for new clients only", ru: "Код только для новых клиентов" },
  "Kood nõuab suuremat summat": { en: "The code requires a higher amount", ru: "Для кода нужна большая сумма" },
  "Koodi ei saa kampaaniaga kombineerida": { en: "The code can't be combined with the campaign", ru: "Код нельзя совместить с акцией" },
  "Kood ei kehti sellele teenusele": { en: "The code isn't valid for this service", ru: "Код не действует для этой услуги" },
};

export function serverText(lang: Lang, s: string): string {
  if (lang === "et") return s;
  return SERVER[s]?.[lang] ?? s;
}

/** Hinnarea silt ("Kampaania X −20%", "Sooduskood ABC −5 €") */
export function priceLabel(t: Dict, label: string): string {
  return label.replace(/^Kampaania /, `${t.campaign} `).replace(/^Sooduskood /, `${t.code} `).replace("(tasuta)", t.freeTag);
}

// ---------- Kuupäevad ----------

const WD: Record<Lang, string[]> = {
  et: ["esmaspäev", "teisipäev", "kolmapäev", "neljapäev", "reede", "laupäev", "pühapäev"],
  en: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
  ru: ["понедельник", "вторник", "среда", "четверг", "пятница", "суббота", "воскресенье"],
};
const WD_SHORT: Record<Lang, string[]> = {
  et: ["E", "T", "K", "N", "R", "L", "P"],
  en: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  ru: ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"],
};
const MONTHS: Record<Lang, string[]> = {
  et: ["jaanuar", "veebruar", "märts", "aprill", "mai", "juuni", "juuli", "august", "september", "oktoober", "november", "detsember"],
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  ru: ["январь", "февраль", "март", "апрель", "май", "июнь", "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"],
};
// vene keeles kuupäeva juures omastav kääne
const MONTHS_GEN_RU = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
const MONTHS_SHORT: Record<Lang, string[]> = {
  et: ["jaan", "veebr", "märts", "apr", "mai", "juuni", "juuli", "aug", "sept", "okt", "nov", "dets"],
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  ru: ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"],
};

const parts = (iso: string) => iso.split("-").map(Number) as [number, number, number];
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

export function dates(lang: Lang) {
  const wd = (iso: string) => WD[lang][isoWeekday(iso) - 1];
  const wds = (iso: string) => WD_SHORT[lang][isoWeekday(iso) - 1];
  return {
    /** "Teisipäev, 3. november" / "Tuesday, 3 November" / "Вторник, 3 ноября" */
    dayLong: (iso: string) => {
      const [, m, d] = parts(iso);
      if (lang === "en") return `${wd(iso)}, ${d} ${MONTHS.en[m - 1]}`;
      if (lang === "ru") return `${cap(wd(iso))}, ${d} ${MONTHS_GEN_RU[m - 1]}`;
      return `${cap(wd(iso))}, ${d}. ${MONTHS.et[m - 1]}`;
    },
    /** "T 3. nov" / "Tue 3 Nov" / "Вт 3 ноя" */
    dayShort: (iso: string) => {
      const [, m, d] = parts(iso);
      return lang === "et" ? `${wds(iso)} ${d}. ${MONTHS_SHORT.et[m - 1]}` : `${wds(iso)} ${d} ${MONTHS_SHORT[lang][m - 1]}`;
    },
    dayShortYear: (iso: string) => {
      const [y, m, d] = parts(iso);
      return lang === "et" ? `${wds(iso)} ${d}. ${MONTHS_SHORT.et[m - 1]} ${y}` : `${wds(iso)} ${d} ${MONTHS_SHORT[lang][m - 1]} ${y}`;
    },
    monthYear: (iso: string) => `${cap(MONTHS[lang][parts(iso)[1] - 1])} ${parts(iso)[0]}`,
    weekdayLetter: wds,
    dayNum: (iso: string) => String(parts(iso)[2]).padStart(2, "0"),
  };
}
