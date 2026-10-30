export const notificationCenter = {
  "title": "Notification Center",
  "eyebrow": "Phone alerts",
  "menuHint": "Get a phone alert before an attack lands.",
  "menuEmpty": "Empty",
  "lead": "When your radar sees an attack coming, the center sends an alert to your phone, even with the game closed. Each alert is paid from the center's deuterium wallet.",
  "loading": "Loading the Notification Center…",
  "loadError": "The Notification Center could not be loaded.",
  "retry": "Try again",
  "from": "from",
  "kind": {
    "incoming_attack": "Incoming attack",
    "incoming_strategic": "Strategic weapon",
    "probe_detected": "Probe detected"
  },
  "kindRule": {
    "incoming_attack": "A fleet or a joint clan fleet on the way to one of your worlds.",
    "incoming_strategic": "A Death Star on the way. Costs 1.5× an attack alert.",
    "probe_detected": "A probe caught over one of your worlds. Sent at once."
  },
  "buildCost": "Build cost",
  "buildFrom": "Paid from {{world}}, your selected world. Built once, it covers all your worlds.",
  "buildShort": "The selected world does not have enough resources. Select another world or wait.",
  "build": "Build the center",
  "wallet": "Wallet",
  "covers_one": "Pays for {{count}} attack alert at this timing",
  "covers_other": "Pays for {{count}} attack alerts at this timing",
  "empty": "The wallet cannot pay for the next attack alert. It will not be sent until you add deuterium.",
  "unfunded_one": "{{count}} alert was not sent in the last 24 hours: the wallet was short.",
  "unfunded_other": "{{count}} alerts were not sent in the last 24 hours: the wallet was short.",
  "transferTitle": "Add deuterium",
  "transferFrom": "From {{world}}. In store:",
  "amount": "Deuterium to transfer",
  "transfer": "Transfer",
  "alerts_one": "{{count}} alert",
  "alerts_other": "{{count}} alerts",
  "all": "All",
  "confirmTitle": "Transfer {{amount}} deuterium?",
  "confirmBody": "Deuterium in the wallet cannot be moved back to a world. It is spent only on alerts.",
  "confirm": "Transfer {{amount}}",
  "back": "Back",
  "walletAfter": "Wallet after",
  "timingTitle": "When to alert",
  "timing": {
    "T3": "3 min",
    "T5": "5 min",
    "T15": "15 min",
    "RADAR": "On radar"
  },
  "timingRule": "Minutes before the attack lands. An earlier alert costs more. If your radar sees the fleet later, the alert goes out when it does.",
  "kindsTitle": "Paid alerts",
  "recentTitle": "Recent alerts",
  "status": {
    "PENDING": "Waiting",
    "SENT": "Sent",
    "UNFUNDED": "Wallet short",
    "CANCELLED": "Not charged",
    "NO_DEVICE": "No phone"
  },
  "rulesTitle": "How alerts work",
  "ruleRadar": "An alert goes out only for a fleet your radar sees. No radar sighting, no alert.",
  "ruleRecall": "If the attack is called back before the alert goes out, nothing is charged.",
  "ruleShort": "If the wallet cannot pay, the alert is not sent. It is listed here as wallet short.",
  "ruleInGame": "The warning inside the game stays free.",
  "priceRule": "An attack alert costs a number of hours of your deuterium output on all worlds, or its minimum if that is higher. Your output: {{rate}} per hour.",
  "reading": {
    "NONE": "Not built",
    "EMPTY": "Wallet empty",
    "FEW": "A few alerts",
    "PLENTY": "Well funded",
    "UNKNOWN": "Not read"
  },
  "readingMeaning": {
    "NONE": "They get no phone alert before an attack.",
    "EMPTY": "Built, but a phone alert would not go out: the wallet cannot pay.",
    "FEW": "Pays for a few alerts. Their phone may warn them.",
    "PLENTY": "Pays for many alerts. Expect their phone to warn them.",
    "UNKNOWN": "The probe could not read their Notification Center."
  },
  "readingRule": "Probe readings can be wrong. A sharper probe misreads less often.",
  "local": {
    "title": {
      "build": "Construction finished",
      "research": "Research finished",
      "ships": "Ships ready",
      "fleet": "Fleet back home"
    },
    "body": {
      "build": "{{name}} on {{world}} is ready.",
      "research": "{{name}} is complete.",
      "ships": "{{count}} × {{name}} ready on {{world}}.",
      "fleet": "A fleet is back at its home world.",
      "unnamed": "An order on {{world}} is finished."
    },
    "section": "Free alerts on this phone",
    "sectionBody": "This phone tells you when an order finishes. Free, and set on this phone only.",
    "switch": "Alert me when orders finish",
    "denied": "The phone did not allow notifications. Allow them for Astera Online in the phone's settings.",
    "blocked": "Alerts for Astera Online are turned off in the phone settings. They stay paused until you turn them on there.",
    "late": "Without on-time alerts, Android can hold an alert back up to an hour.",
    "allowExact": "Allow on-time alerts",
    "category": {
      "build": "Construction",
      "research": "Research",
      "ships": "Ships",
      "fleet": "Fleets back home"
    }
  },
  "hours_one": "{{count}} hour",
  "hours_other": "{{count}} hours",
  "floor": "min {{amount}}"
};
