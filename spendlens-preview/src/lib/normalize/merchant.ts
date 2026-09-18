/**
 * Merchant normalization: turn "SQ *BLUE BOTTLE COFFEE 0412 SAN FRANCISCO CA"
 * into "Blue Bottle Coffee". Rule-based and deterministic.
 */

/** Well-known merchants: regex against the cleaned uppercase description -> canonical name. */
const KNOWN_MERCHANTS: Array<[RegExp, string]> = [
  [/UBER\s*EATS|UBEREATS/, "Uber Eats"],
  [/\bUBER\b(?!.*EATS)/, "Uber"],
  [/LYFT/, "Lyft"],
  [/DOORDASH|DD \*DOORDASH/, "DoorDash"],
  [/GRUBHUB/, "Grubhub"],
  [/POSTMATES/, "Postmates"],
  [/INSTACART/, "Instacart"],
  [/AMZN|AMAZON(?!.*PRIME)/, "Amazon"],
  [/AMAZON PRIME|PRIME VIDEO/, "Amazon Prime"],
  [/WHOLE\s*FOODS|WHOLEFDS/, "Whole Foods"],
  [/TRADER\s*JOE/, "Trader Joe's"],
  [/SAFEWAY/, "Safeway"],
  [/COSTCO/, "Costco"],
  [/TARGET(?!.*OPTICAL)/, "Target"],
  [/WAL-?MART|WM SUPERCENTER/, "Walmart"],
  [/NETFLIX/, "Netflix"],
  [/SPOTIFY/, "Spotify"],
  [/APPLE\.COM\/BILL|APPLE COM BILL|ITUNES|APPLE SERVICES/, "Apple"],
  [/GOOGLE \*?(YOUTUBE|STORAGE|ONE|PLAY)|YOUTUBE ?PREMIUM/, "Google"],
  [/HULU/, "Hulu"],
  [/DISNEY\s*PLUS|DISNEYPLUS/, "Disney+"],
  [/HBO|MAX\.COM/, "Max"],
  [/STARBUCKS/, "Starbucks"],
  [/CHIPOTLE/, "Chipotle"],
  [/SWEETGREEN/, "Sweetgreen"],
  [/MCDONALD/, "McDonald's"],
  [/SHELL OIL|SHELL SERVICE/, "Shell"],
  [/CHEVRON/, "Chevron"],
  [/EXXON|MOBIL/, "ExxonMobil"],
  [/DELTA AIR/, "Delta Air Lines"],
  [/UNITED AIR|UNITED\s+\d{3}/, "United Airlines"],
  [/SOUTHWEST/, "Southwest Airlines"],
  [/AIRBNB/, "Airbnb"],
  [/MARRIOTT/, "Marriott"],
  [/HILTON/, "Hilton"],
  [/CVS/, "CVS Pharmacy"],
  [/\bAMC\b/, "AMC Theatres"],
  [/REGAL CINEMAS?/, "Regal Cinemas"],
  [/TICKETMASTER/, "Ticketmaster"],
  [/SWEETGREEN/, "Sweetgreen"],
  [/GEICO/, "Geico"],
  [/APPLE STORE/, "Apple Store"],
  [/WALGREENS/, "Walgreens"],
  [/COMCAST|XFINITY/, "Xfinity"],
  [/VERIZON/, "Verizon"],
  [/AT&T|ATT\*|AT\s*&\s*T/, "AT&T"],
  [/T-MOBILE|TMOBILE/, "T-Mobile"],
  [/PG&E|PGANDE|PACIFIC GAS/, "PG&E"],
  [/EQUINOX/, "Equinox"],
  [/PLANET FITNESS/, "Planet Fitness"],
  [/PELOTON/, "Peloton"],
  [/ADOBE/, "Adobe"],
  [/DROPBOX/, "Dropbox"],
  [/GITHUB/, "GitHub"],
  [/NOTION/, "Notion"],
  [/OPENAI|CHATGPT/, "OpenAI"],
  [/NYTIMES|NY TIMES|NEW YORK TIMES/, "The New York Times"],
  [/PAYPAL \*?(.+)/, ""], // handled specially below
  [/VENMO/, "Venmo"],
  [/ZELLE/, "Zelle"],
];

const NOISE_PREFIXES = [
  /^(SQ|TST|SP|PP|DD|PY|IC|CKE|WL|EB|AMZN MKTP|CA)\s*\*\s*/i,
  /^(POS|PURCHASE|DEBIT CARD PURCHASE|DEBIT PURCHASE|CHECKCARD|CHECK CARD|VISA|MASTERCARD|PENDING|RECURRING|ONLINE|WEB|ACH|ACH DEBIT|ACH CREDIT|DIRECT DEBIT|CARD PURCHASE|ELECTRONIC)\s+/i,
  /^PURCHASE AUTHORIZED ON \d{2}\/\d{2}\s+/i,
  /^(ON|AT)\s+\d{2}\/\d{2}\s+/i,
];

const US_STATES =
  "AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC";

const LOWERCASE_WORDS = new Set(["of", "the", "and", "at", "on", "in", "for", "de", "la", "a"]);

export function normalizeMerchant(description: string, merchantColumn?: string): string {
  const source = (merchantColumn && merchantColumn.trim()) || description;
  if (!source) return "Unknown";

  let s = source.toUpperCase().trim();

  // PayPal / Venmo pass-through: "PAYPAL *SPOTIFY" -> Spotify
  const pp = s.match(/^PAYPAL\s*\*\s*(.+)$/);
  if (pp) s = pp[1];

  for (const [re, name] of KNOWN_MERCHANTS) {
    if (name && re.test(s)) return name;
  }

  for (const re of NOISE_PREFIXES) s = s.replace(re, "");

  s = s
    .replace(/\b\d{2}\/\d{2}(\/\d{2,4})?\b/g, " ") // dates
    .replace(/\b\d{1,2}:\d{2}(:\d{2})?\b/g, " ") // times
    .replace(/#\s*\d+/g, " ") // store numbers
    .replace(/\b(REF|TRACE|AUTH|ID|TRN|CONF)[:#\s]*[A-Z0-9-]{4,}\b/g, " ")
    .replace(/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g, " ") // phone numbers
    .replace(/\b[A-Z]*\d{5,}[A-Z0-9]*\b/g, " ") // long alphanumeric refs
    .replace(/\bX{3,}\d+\b/g, " ") // masked card numbers
    .replace(/\b(WWW\.|HTTPS?:\/\/)\S+/g, " ")
    .replace(/\.(COM|NET|ORG|IO|CO)\b/g, " ")
    .replace(new RegExp(`\\s+[A-Z]{2,}(?: [A-Z]{2,})?\\s+(${US_STATES})\\s*(US|USA)?$`), "") // "SAN FRANCISCO CA"
    .replace(new RegExp(`\\s+(${US_STATES})\\s*(US|USA)?$`), "")
    .replace(/\s+(US|USA|UNITED STATES)$/, "")
    .replace(/[*_|]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();

  // Drop trailing store ids ("R035", "0042") and bank noise tokens ("ACH", "PPD", "WEB")
  s = s
    .replace(/(\s+(\d{1,4}|[A-Z]\d{2,4}))+$/, "")
    .replace(/(\s+(ACH|PPD|CCD|WEB|PMT|PYMT|POS|DEBIT|CREDIT|PURCHASE|ONLINE|PAYMENT|PAYMENTS|ID|AUTHORIZED))+$/, "")
    .trim();

  if (!s) return titleCase(source.trim());
  return titleCase(s);
}

export function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((w, i) => {
      if (i > 0 && LOWERCASE_WORDS.has(w)) return w;
      if (/^[a-z]&[a-z]$/.test(w)) return w.toUpperCase();
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join(" ")
    .replace(/'S\b/g, "'s");
}
