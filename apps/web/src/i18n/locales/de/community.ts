export const community = {
  announcements: {
    eyebrow: 'Von der Astera-Leitung',
    title: 'Ankündigungen',
    empty: 'Es liegen noch keine Ankündigungen vor. Updates vom Team werden hier angezeigt.',
    new: 'NEU',
  },
  feedback: {
    eyebrow: 'Direkter Kanal',
    title: 'Feedback',
    intro: 'Sag dem Astera-Team, was nicht funktioniert, was das Spiel besser machen würde oder was dir schon jetzt gefällt.',
    kindLabel: 'Feedback-Typ',
    kinds: { bug: 'Fehler', suggestion: 'Idee', praise: 'Lob' },
    messageLabel: 'Deine Nachricht',
    placeholder: 'Beschreibe, was passiert ist oder was du dir wünschst …',
    remaining: '{{count}} Zeichen übrig',
    send: 'Feedback senden',
    sending: 'Senden…',
    sent: 'Deine Nachricht ist angekommen. Danke, dass du Astera mitgestaltest.',
  },
  admin: {
    eyebrow: 'Verwaltung',
    title: 'Admin-Panel',
    menuLabel: 'Admin-Panel',
    menuHint: 'Ankündigungen veröffentlichen und Rückmeldungen lesen',
    tabsLabel: 'Admin-Tools',
    composeTab: 'Ankündigung',
    feedbackTab: 'Feedback',
    perfTab: 'Leistung',
    perfIntro: 'Aufnahme starten, dieses Fenster schließen und spielen. Beim Stoppen geht eine Messung pro Sekunde an den Server.',
    perfStart: 'Aufnahme starten',
    perfStop: 'Stoppen und senden',
    perfRecording: 'Aufnahme läuft',
    perfSending: 'Wird gesendet…',
    perfSent: 'Auf dem Server gespeichert',
    perfFailed: 'Senden fehlgeschlagen. Die Aufnahme bleibt erhalten.',
    perfRetry: 'Erneut senden',
    perfFpsAvg: 'Durchschnittliche fps',
    perfFpsLow: 'Niedrigste 5 % fps',
    perfHitches: 'Ruckler (>50 ms)',
    perfFreezes: 'Hänger (>250 ms)',
    perfJankMax: 'Längster Stillstand',
    perfCalls: 'Draw Calls Ø / Spitze',
    perfTriangles: 'Dreiecke Spitze',
    perfHeap: 'Speicher Start → Ende (Spitze)',
    perfNetwork: 'Anfragen / Daten',
    perfWorst: 'Schlimmster Moment',
    perfRec: 'REC',
    securityNote: 'HTML wird erneut vom Server gefiltert. Skripte, Event-Handler, Inline-Stile, Formulare und Nicht-YouTube-Einbettungen werden abgelehnt.',
    titleLabel: 'Titel',
    titlePlaceholder: 'Titel aktualisieren',
    contentLabel: 'Inhalt',
    toolbarLabel: 'Ankündigungsformatierung',
    tools: {
      bold: 'Fett', italic: 'Kursiv', heading: 'Überschrift', bullets: 'Liste', quote: 'Zitat',
      link: 'Link', image: 'Bild', video: 'YouTube',
    },
    linkPrompt: 'Fügen Sie eine Link-URL ein',
    imagePrompt: 'Fügen Sie eine HTTPS-Bild-URL ein',
    videoPrompt: 'Fügen Sie eine YouTube-Video-URL ein',
    previewLabel: 'Live-Vorschau',
    previewHint: 'Den gleichen sicheren Renderer erhalten Spieler',
    mobilePreview: 'Mobil · 360 px',
    desktopPreview: 'Desktop · 720 px',
    previewUntitled: 'Titel der Ankündigung',
    publish: 'Ankündigung veröffentlichen',
    publishing: 'Veröffentlichung…',
    published: 'Ankündigung veröffentlicht.',
    feedbackEmpty: 'Es ist noch kein Spieler-Feedback eingetroffen.',
  },
  donate: {
    eyebrow: 'Unterstützt die Astera Online-Entwicklung',
    title: 'Unterstützen Sie Astera Online',
    menuLabel: 'Spenden',
    menuHint: 'Unterstützen Sie das Spiel',
    /*
      THE ASK, IN THE DEVELOPER'S OWN VOICE.

      Written first in Turkish by the person who pays these bills, and carried
      into English rather than re-pitched: it is one human saying what the game
      costs him, not a storefront. The four paragraphs answer four questions in
      order — who funds it, what it costs, why it matters now, where the money
      goes — and `noPressure` is the one that keeps the sheet from being a demand.
    */
    intro: 'Ich baue Astera Online komplett alleine auf, ohne Investition und ohne Einkommen.',
    costs: 'Die Server, die KI, die Domain und alle anderen technischen Kosten trage ich Monat für Monat aus eigener Tasche. Da ich gerade nicht arbeite, belasten mich diese Rechnungen zunehmend.',
    appeal: 'Wenn Sie Astera Online lieben und möchten, dass es weiter wächst, bedeutet mir selbst ein kleiner Beitrag wirklich viel. ❤️',
    impact: "Was Sie spenden, fließt direkt in die Server- und Entwicklungskosten des Spiels und erleichtert mir die weitere Entwicklung des Spiels.",
    supportLead: 'Wenn Sie das Spiel unterstützen möchten:',
    noPressure: 'Und wenn Sie das nicht können, ist das völlig in Ordnung. Auch das Spielen, das Erzählen eines Freundes oder das Senden von Feedback ist ein echter Beitrag. 🪐',
    cryptoHeading: 'Krypto',
    cryptoTrc20: 'USDT · TRC-20',
    cryptoSolana: 'SOLANA',
    copy: 'Kopieren',
    copied: 'Kopiert',
    /*
      TWO CONTROLS THAT READ "Copy" ARE ONE CONTROL TO A SCREEN READER.

      The visible word stays short because the plate above it already names the
      network; the accessible name has to carry that name too, and it has to
      CHANGE with the state — otherwise the confirmation is visible only to
      players who can see it.
    */
    copyLabel: '{{label}} Adresse kopieren',
    copiedLabel: '{{label}} Adresse kopiert',
    cardHeading: 'Shopier',
    cardLabel: 'Unterstützung mit {{amount}} TL',
    cardNote: 'Die Zahlungslinks werden gerade eingerichtet. Bald kannst du die Karten öffnen.',
  },
} as const;
