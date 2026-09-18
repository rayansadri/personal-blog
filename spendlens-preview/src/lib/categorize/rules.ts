import type { Category } from "../types";

/** Ordered keyword rules. First match wins; more specific rules go first. */
export const CATEGORY_RULES: Array<{ category: Category; patterns: RegExp[] }> = [
  {
    category: "Delivery",
    patterns: [/uber ?eats/i, /doordash/i, /grubhub/i, /postmates/i, /deliveroo/i, /seamless/i, /caviar/i, /gopuff/i],
  },
  {
    category: "Subscriptions",
    patterns: [
      /netflix/i, /spotify/i, /hulu/i, /disney\+?/i, /\bmax\b/i, /hbo/i, /apple(?!.*store)/i, /icloud/i,
      /youtube/i, /google (one|storage)/i, /amazon prime/i, /audible/i, /kindle unlimited/i,
      /adobe/i, /dropbox/i, /github/i, /notion/i, /openai|chatgpt/i, /microsoft 365|office 365/i,
      /new york times|nytimes|wsj|washington post|the atlantic|economist|substack|medium\b/i,
      /peloton/i, /strava/i, /headspace/i, /calm\b/i, /duolingo/i, /patreon/i, /twitch/i, /paramount/i,
      /crunchyroll/i, /1password|lastpass|nordvpn|expressvpn/i, /playstation|xbox live|nintendo online/i,
    ],
  },
  {
    category: "Housing",
    patterns: [/rent\b/i, /mortgage/i, /landlord/i, /property management/i, /apartments?/i, /hoa\b/i, /home ?owners? insurance/i, /renters? insurance/i, /lemonade/i],
  },
  {
    category: "Utilities",
    patterns: [
      /pg&e|pge\b|pacific gas/i, /con ?edison|coned/i, /duke energy/i, /national grid/i, /electric/i, /gas company|socal gas/i,
      /water (dept|district|utility)/i, /xfinity|comcast/i, /spectrum/i, /verizon/i, /at&t|\batt\b/i, /t-mobile|tmobile/i,
      /sprint/i, /mint mobile/i, /google fi/i, /internet/i, /utility|utilities/i, /waste management|recology/i,
    ],
  },
  {
    category: "Groceries",
    patterns: [
      /whole ?foods/i, /trader joe/i, /safeway/i, /kroger/i, /costco/i, /aldi/i, /publix/i, /wegmans/i, /h-e-b|heb\b/i,
      /sprouts/i, /albertsons/i, /ralphs/i, /vons/i, /food ?lion/i, /giant/i, /stop ?& ?shop/i, /market ?basket/i,
      /grocer/i, /supermarket/i, /instacart/i, /fresh ?direct/i, /lidl/i, /meijer/i, /winco/i, /market\b/i,
    ],
  },
  {
    category: "Dining",
    patterns: [
      /starbucks/i, /coffee/i, /cafe|café/i, /restaurant/i, /pizza/i, /sushi/i, /taco/i, /burger/i, /grill/i,
      /kitchen/i, /bistro/i, /diner/i, /bakery/i, /chipotle/i, /sweetgreen/i, /mcdonald/i, /chick-fil-a/i,
      /panera/i, /shake shack/i, /in-n-out/i, /wendy/i, /subway/i, /dunkin/i, /peet's/i, /blue bottle/i, /philz/i,
      /ramen/i, /thai/i, /pho\b/i, /deli\b/i, /bar\b/i, /brew/i, /tavern/i, /eatery/i, /noodle/i, /boba|tea house/i,
      /wine bar/i, /pub\b/i, /steak/i, /^tst\*|\btoast\b|toasttab/i, /bbq/i, /taqueria/i, /trattoria/i, /osteria/i, /cantina/i, /doughnut|donut/i,
    ],
  },
  {
    category: "Transportation",
    patterns: [
      /\buber\b/i, /lyft/i, /shell/i, /chevron/i, /exxon|mobil/i, /\bbp\b/i, /76\b/i, /arco/i, /gas station|fuel/i,
      /parking/i, /toll/i, /fastrak|e-?zpass/i, /metro|mta|bart|caltrain|amtrak|transit|clipper/i, /car ?wash/i,
      /jiffy lube|auto ?zone|pep boys|firestone|goodyear|mechanic|auto repair/i, /dmv/i, /geico|progressive|state farm|allstate|auto insurance/i,
      /bird|lime|scooter|citi ?bike/i, /waymo/i, /tesla supercharg|chargepoint|evgo|electrify america/i,
    ],
  },
  {
    category: "Travel",
    patterns: [
      /airline|airways|air lines/i, /delta/i, /united/i, /southwest/i, /american air/i, /jetblue/i, /alaska air/i,
      /spirit/i, /frontier/i, /airbnb/i, /vrbo/i, /marriott/i, /hilton/i, /hyatt/i, /hotel/i, /motel/i, /resort/i,
      /expedia|booking\.com|kayak|priceline|hotels\.com/i, /hertz|avis|enterprise rent|national car|turo/i,
      /tsa|global entry/i, /travel/i, /cruise/i, /lounge/i,
    ],
  },
  {
    category: "Health",
    patterns: [
      /cvs/i, /walgreens/i, /rite aid/i, /pharmacy/i, /dental|dentist/i, /medical|clinic|hospital|health/i, /doctor|md\b/i,
      /optometr|vision|lenscrafters|warby parker/i, /therap/i, /kaiser|blue cross|blue shield|aetna|cigna|united ?health|anthem|oscar/i,
      /equinox|planet fitness|24 hour fitness|crunch|orangetheory|barry's|soulcycle|gym|fitness|yoga|pilates|climbing/i,
      /one medical|zocdoc|hims|ro\b|nurx/i, /massage/i, /chiropract/i, /lab ?corp|quest diag/i,
    ],
  },
  {
    category: "Entertainment",
    patterns: [
      /amc|regal|cinemark|cinema|movie|theatre|theater/i, /ticketmaster|stubhub|axs|eventbrite|live nation/i,
      /concert|museum|zoo|aquarium/i, /steam ?games|epic games|playstation|xbox|nintendo/i, /bowling|arcade|golf|topgolf/i,
      /kindle|books?\b|barnes/i, /spotify|apple music/i, /dave ?& ?buster/i, /escape room|karaoke/i, /sports?\b/i,
    ],
  },
  {
    category: "Shopping",
    patterns: [
      /amazon/i, /target/i, /walmart/i, /best buy/i, /apple store/i, /ikea/i, /home depot|lowe's|lowes/i, /etsy/i,
      /ebay/i, /nike/i, /adidas/i, /lululemon/i, /zara/i, /h&m/i, /uniqlo/i, /nordstrom/i, /macy's|macys/i,
      /sephora|ulta/i, /gap\b|old navy|banana republic/i, /j\.?crew/i, /everlane/i, /shein|temu/i, /wayfair/i,
      /west elm|crate ?& ?barrel|pottery barn|cb2|williams sonoma/i, /rei\b|patagonia|north face/i, /shop/i, /store/i,
      /clothing|apparel|boutique/i, /dollar/i, /office depot|staples/i, /container store/i, /bed bath/i, /petco|petsmart|chewy/i,
    ],
  },
];

export const INCOME_PATTERNS = [
  /payroll/i, /direct dep/i, /\bsalary\b/i, /\bpaycheck\b/i, /\bwages\b/i, /gusto|adp|paychex|rippling|justworks|workday/i,
  /interest (paid|payment|earned)/i, /dividend/i, /tax refund|irs treas/i, /\bdeposit\b/i, /cash ?back reward|rewards? credit|statement credit/i,
];

export const TRANSFER_PATTERNS = [
  /\btransfer\b/i, /\bxfer\b/i, /zelle/i, /venmo/i, /cash ?app/i, /apple cash/i, /wire (in|out|transfer)/i,
  /online banking transfer/i, /to savings|from savings|to checking|from checking/i, /robinhood|coinbase|vanguard|fidelity|schwab|wealthfront|betterment|acorns/i,
  /atm (withdrawal|w\/d)|cash withdrawal/i,
];

export const CARD_PAYMENT_PATTERNS = [
  /payment[- ]*thank you/i, /autopay/i, /automatic payment/i, /online payment/i, /card ?payment/i, /\bpymt\b/i,
  /\be-?payment\b/i, /payment received/i, /mobile payment/i, /internet payment/i, /credit card pmt|crcardpmt/i,
  /chase card|amex|american express|capital one|citi card|discover|barclay|bank of america card|synchrony|apple card/i,
  /\bpayment\b.*\b(card|acct|account)\b/i,
];

export const REFUND_PATTERNS = [/refund/i, /\breturn\b/i, /reversal/i, /credit adj/i, /chargeback/i, /rebate/i];
