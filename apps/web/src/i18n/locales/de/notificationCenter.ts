export const notificationCenter = {
  "title": "Benachrichtigungszentrale",
  "eyebrow": "Handy-Warnungen",
  "menuHint": "Eine Warnung aufs Handy, bevor ein Angriff einschlägt.",
  "menuEmpty": "Kasse leer",
  "lead": "Sieht dein Radar einen Angriff kommen, schickt die Zentrale eine Warnung auf dein Handy, auch wenn das Spiel geschlossen ist. Jede Warnung verbraucht Deuterium aus der Kasse der Zentrale.",
  "loading": "Benachrichtigungszentrale wird geladen…",
  "loadError": "Die Benachrichtigungszentrale konnte nicht geladen werden.",
  "retry": "Erneut versuchen",
  "from": "ab",
  "kind": {
    "incoming_attack": "Anfliegender Angriff",
    "incoming_strategic": "Strategische Waffe",
    "probe_detected": "Sonde entdeckt"
  },
  "kindRule": {
    "incoming_attack": "Eine Flotte oder eine gemeinsame Clanflotte auf dem Weg zu einer deiner Welten.",
    "incoming_strategic": "Ein Todesstern im Anflug. Verbraucht das 1,5-Fache an Deuterium einer Angriffswarnung.",
    "probe_detected": "Eine Sonde über einer deiner Welten entdeckt. Wird sofort gesendet."
  },
  "buildCost": "Baukosten",
  "buildFrom": "Bezahlt von {{world}}, deiner ausgewählten Welt. Einmal gebaut, deckt sie alle deine Welten ab.",
  "buildShort": "Die ausgewählte Welt hat nicht genug Ressourcen. Wähle eine andere Welt oder warte.",
  "build": "Zentrale bauen",
  "wallet": "Kasse",
  "covers_one": "Reicht für {{count}} Angriffswarnung bei diesem Zeitpunkt",
  "covers_other": "Reicht für {{count}} Angriffswarnungen bei diesem Zeitpunkt",
  "empty": "Die Kasse kann die nächste Angriffswarnung nicht bezahlen. Sie wird erst gesendet, wenn du Deuterium einzahlst.",
  "unfunded_one": "{{count}} Warnung wurde in den letzten 24 Stunden nicht gesendet: Die Kasse reichte nicht.",
  "unfunded_other": "{{count}} Warnungen wurden in den letzten 24 Stunden nicht gesendet: Die Kasse reichte nicht.",
  "transferTitle": "Deuterium einzahlen",
  "transferFrom": "Von {{world}}. Im Lager:",
  "amount": "Zu überweisendes Deuterium",
  "transfer": "Überweisen",
  "alerts_one": "{{count}} Warnung",
  "alerts_other": "{{count}} Warnungen",
  "all": "Alles",
  "confirmTitle": "{{amount}} Deuterium überweisen?",
  "confirmBody": "Deuterium in der Kasse kann nicht zurück auf eine Welt gebracht werden. Es wird nur für Warnungen ausgegeben.",
  "confirm": "{{amount}} überweisen",
  "back": "Zurück",
  "walletAfter": "Kasse danach",
  "timingTitle": "Wann warnen",
  "timing": {
    "T3": "3 Min.",
    "T5": "5 Min.",
    "T15": "15 Min.",
    "RADAR": "Bei Radar"
  },
  "timingRule": "Minuten vor dem Einschlag. Eine frühere Warnung verbraucht mehr Deuterium. Sieht dein Radar die Flotte später, geht die Warnung dann raus.",
  "kindsTitle": "Radarwarnungen",
  "recentTitle": "Letzte Warnungen",
  "status": {
    "PENDING": "Wartet",
    "SENT": "Gesendet",
    "UNFUNDED": "Kasse leer",
    "CANCELLED": "Nichts abgebucht",
    "NO_DEVICE": "Kein Handy"
  },
  "rulesTitle": "So funktionieren Warnungen",
  "ruleRadar": "Eine Warnung gibt es nur für eine Flotte, die dein Radar sieht. Ohne Radarsichtung keine Warnung.",
  "ruleRecall": "Wird der Angriff zurückgerufen, bevor die Warnung rausgeht, verlässt kein Deuterium die Kasse.",
  "ruleShort": "Kann die Kasse nicht zahlen, wird die Warnung nicht gesendet. Sie steht hier als „Kasse leer“.",
  "ruleInGame": "Die Warnung im Spiel erscheint immer und verbraucht kein Deuterium.",
  "priceRule": "Eine Angriffswarnung verbraucht einige Stunden deiner Deuterium-Produktion auf allen Welten, mindestens aber ihr Minimum. Deine Produktion: {{rate}} pro Stunde.",
  "reading": {
    "NONE": "Nicht gebaut",
    "EMPTY": "Kasse leer",
    "FEW": "Wenige Warnungen",
    "PLENTY": "Gut gefüllt",
    "UNKNOWN": "Nicht gelesen"
  },
  "readingMeaning": {
    "NONE": "Vor einem Angriff bekommt der Kommandant keine Handy-Warnung.",
    "EMPTY": "Gebaut, aber eine Handy-Warnung ginge nicht raus: Die Kasse kann nicht zahlen.",
    "FEW": "Reicht für wenige Warnungen. Das Handy könnte warnen.",
    "PLENTY": "Reicht für viele Warnungen. Rechne damit, dass das Handy warnt.",
    "UNKNOWN": "Die Sonde konnte die Benachrichtigungszentrale nicht lesen."
  },
  "readingRule": "Sondenlesungen können falsch sein. Eine schärfere Sonde irrt sich seltener.",
  "local": {
    "title": {
      "build": "Bau fertig",
      "research": "Forschung fertig",
      "ships": "Schiffe bereit",
      "fleet": "Flotte zurück"
    },
    "body": {
      "build": "{{name}} auf {{world}} ist fertig.",
      "research": "{{name}} ist abgeschlossen.",
      "ships": "{{count}} × {{name}} auf {{world}} bereit.",
      "fleet": "Eine Flotte ist zurück auf ihrer Heimatwelt.",
      "unnamed": "Ein Auftrag auf {{world}} ist fertig."
    },
    "section": "Auftragserinnerungen auf diesem Handy",
    "sectionBody": "Dieses Handy meldet sich, wenn ein Auftrag fertig ist. Verbraucht kein Deuterium aus der Kasse und wird nur auf diesem Handy eingestellt.",
    "switch": "Melden, wenn Aufträge fertig sind",
    "denied": "Das Handy hat Benachrichtigungen nicht erlaubt. Erlaube sie für Astera Online in den Einstellungen des Handys.",
    "blocked": "Warnungen für Astera Online sind in den Einstellungen des Handys ausgeschaltet. Sie pausieren, bis du sie dort einschaltest.",
    "late": "Ohne pünktliche Warnungen kann Android eine Warnung bis zu einer Stunde zurückhalten.",
    "allowExact": "Pünktliche Warnungen erlauben",
    "category": {
      "build": "Bau",
      "research": "Forschung",
      "ships": "Schiffe",
      "fleet": "Heimkehrende Flotten"
    }
  },
  "hours_one": "{{count}} Stunde",
  "hours_other": "{{count}} Stunden",
  "floor": "mind. {{amount}}"
};
