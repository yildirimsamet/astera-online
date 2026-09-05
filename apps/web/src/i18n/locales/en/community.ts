export const community = {
  announcements: {
    eyebrow: 'From Astera command',
    title: 'Announcements',
    empty: 'There are no announcements yet. Updates from the team will appear here.',
    new: 'NEW',
  },
  feedback: {
    eyebrow: 'Direct channel',
    title: 'Feedback',
    intro: 'Tell the Astera team what broke, what would make the game better, or what already feels right.',
    kindLabel: 'Feedback type',
    kinds: { bug: 'Bug', suggestion: 'Idea', praise: 'Praise' },
    messageLabel: 'Your message',
    placeholder: 'Describe what happened or what you would like to see…',
    remaining: '{{count}} characters left',
    send: 'Send feedback',
    sending: 'Sending…',
    sent: 'Received. Thank you for helping shape Astera.',
  },
  admin: {
    eyebrow: 'Operations',
    title: 'Admin panel',
    menuLabel: 'Admin panel',
    menuHint: 'Publish announcements and read player feedback',
    tabsLabel: 'Admin tools',
    composeTab: 'Announcement',
    feedbackTab: 'Feedback',
    securityNote: 'HTML is filtered again by the server. Scripts, event handlers, inline styles, forms and non-YouTube embeds are rejected.',
    titleLabel: 'Title',
    titlePlaceholder: 'Update title',
    contentLabel: 'Content',
    toolbarLabel: 'Announcement formatting',
    tools: {
      bold: 'Bold', italic: 'Italic', heading: 'Heading', bullets: 'List', quote: 'Quote',
      link: 'Link', image: 'Image', video: 'YouTube',
    },
    linkPrompt: 'Paste a link URL',
    imagePrompt: 'Paste an HTTPS image URL',
    videoPrompt: 'Paste a YouTube video URL',
    previewLabel: 'Live preview',
    previewHint: 'The same safe renderer players receive',
    mobilePreview: 'Mobile · 360 px',
    desktopPreview: 'Desktop · 720 px',
    previewUntitled: 'Announcement title',
    publish: 'Publish announcement',
    publishing: 'Publishing…',
    published: 'Announcement published.',
    feedbackEmpty: 'No player feedback has arrived yet.',
  },
  donate: {
    eyebrow: 'Support Astera Online development',
    title: 'Support Astera Online',
    menuLabel: 'Donate',
    menuHint: 'Support the game',
    /*
      THE ASK, IN THE DEVELOPER'S OWN VOICE.

      Written first in Turkish by the person who pays these bills, and carried
      into English rather than re-pitched: it is one human saying what the game
      costs him, not a storefront. The four paragraphs answer four questions in
      order — who funds it, what it costs, why it matters now, where the money
      goes — and `noPressure` is the one that keeps the sheet from being a demand.
    */
    intro: 'I build Astera Online entirely on my own, with no investment and no income behind it.',
    costs: 'The servers, the AI, the domain and every other technical cost come out of my own pocket, month after month. I am not working right now, so those bills have started to weigh on me.',
    appeal: 'If you love Astera Online and want it to keep growing, even a small contribution genuinely means a great deal to me. ❤️',
    impact: "What you give goes straight into the game's server and development costs, and makes it easier for me to keep building it.",
    supportLead: 'If you would like to support the game:',
    noPressure: 'And if you cannot, that is completely fine. Playing, telling a friend about it or sending feedback is a real contribution too. 🪐',
    cryptoHeading: 'Crypto',
    cryptoTrc20: 'USDT · TRC-20',
    cryptoSolana: 'SOLANA',
    copy: 'Copy',
    copied: 'Copied',
    /*
      TWO CONTROLS THAT READ "Copy" ARE ONE CONTROL TO A SCREEN READER.

      The visible word stays short because the plate above it already names the
      network; the accessible name has to carry that name too, and it has to
      CHANGE with the state — otherwise the confirmation is visible only to
      players who can see it.
    */
    copyLabel: 'Copy {{label}} address',
    copiedLabel: '{{label}} address copied',
    cardHeading: 'İyzico',
    cardNote: 'Prices and the payment link are temporary and not final yet.',
  },
} as const;
