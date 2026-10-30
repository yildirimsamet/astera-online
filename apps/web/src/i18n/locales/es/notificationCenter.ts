export const notificationCenter = {
  "title": "Centro de Avisos",
  "eyebrow": "Avisos al móvil",
  "menuHint": "Un aviso en tu móvil antes de que llegue un ataque.",
  "menuEmpty": "Caja vacía",
  "lead": "Cuando tu radar ve llegar un ataque, el centro envía un aviso a tu móvil, aunque el juego esté cerrado. Cada aviso gasta deuterio de la caja del centro.",
  "loading": "Cargando el Centro de Avisos…",
  "loadError": "No se pudo cargar el Centro de Avisos.",
  "retry": "Reintentar",
  "from": "desde",
  "kind": {
    "incoming_attack": "Ataque entrante",
    "incoming_strategic": "Arma estratégica",
    "probe_detected": "Sonda detectada"
  },
  "kindRule": {
    "incoming_attack": "Una flota o una flota conjunta de clan rumbo a uno de tus mundos.",
    "incoming_strategic": "Una Estrella de la Muerte en camino. Gasta 1,5 veces el deuterio de un aviso de ataque.",
    "probe_detected": "Una sonda detectada sobre uno de tus mundos. Se envía al momento."
  },
  "buildCost": "Coste de construcción",
  "buildFrom": "Lo paga {{world}}, tu mundo seleccionado. Se construye una vez y cubre todos tus mundos.",
  "buildShort": "El mundo seleccionado no tiene recursos suficientes. Elige otro mundo o espera.",
  "build": "Construir el centro",
  "wallet": "Caja",
  "covers_one": "Paga {{count}} aviso de ataque con este momento",
  "covers_other": "Paga {{count}} avisos de ataque con este momento",
  "empty": "La caja no puede pagar el próximo aviso de ataque. No se enviará hasta que añadas deuterio.",
  "unfunded_one": "{{count}} aviso no se envió en las últimas 24 horas: la caja no alcanzaba.",
  "unfunded_other": "{{count}} avisos no se enviaron en las últimas 24 horas: la caja no alcanzaba.",
  "transferTitle": "Añadir deuterio",
  "transferFrom": "Desde {{world}}. En almacén:",
  "amount": "Deuterio a transferir",
  "transfer": "Transferir",
  "alerts_one": "{{count}} aviso",
  "alerts_other": "{{count}} avisos",
  "all": "Todo",
  "confirmTitle": "¿Transferir {{amount}} de deuterio?",
  "confirmBody": "El deuterio de la caja no puede volver a un mundo. Solo se gasta en avisos.",
  "confirm": "Transferir {{amount}}",
  "back": "Volver",
  "walletAfter": "Caja después",
  "timingTitle": "Cuándo avisar",
  "timing": {
    "T3": "3 min",
    "T5": "5 min",
    "T15": "15 min",
    "RADAR": "En radar"
  },
  "timingRule": "Minutos antes de que llegue el ataque. Un aviso más temprano gasta más deuterio. Si tu radar ve la flota más tarde, el aviso sale en ese momento.",
  "kindsTitle": "Avisos de radar",
  "recentTitle": "Avisos recientes",
  "status": {
    "PENDING": "En espera",
    "SENT": "Enviado",
    "UNFUNDED": "Caja vacía",
    "CANCELLED": "Nada descontado",
    "NO_DEVICE": "Sin móvil"
  },
  "rulesTitle": "Cómo funcionan los avisos",
  "ruleRadar": "Solo hay aviso para una flota que tu radar ve. Sin detección de radar, no hay aviso.",
  "ruleRecall": "Si el ataque se retira antes de enviar el aviso, no sale deuterio de la caja.",
  "ruleShort": "Si la caja no puede pagar, el aviso no se envía. Aparece aquí como «Caja vacía».",
  "ruleInGame": "El aviso dentro del juego siempre aparece y no gasta deuterio.",
  "priceRule": "Un aviso de ataque gasta unas horas de tu producción de deuterio en todos tus mundos, o su mínimo si es mayor. Tu producción: {{rate}} por hora.",
  "reading": {
    "NONE": "Sin construir",
    "EMPTY": "Caja vacía",
    "FEW": "Pocos avisos",
    "PLENTY": "Bien surtida",
    "UNKNOWN": "Sin leer"
  },
  "readingMeaning": {
    "NONE": "No reciben aviso en el móvil antes de un ataque.",
    "EMPTY": "Construido, pero el aviso al móvil no saldría: la caja no puede pagar.",
    "FEW": "Paga unos pocos avisos. El móvil puede avisar.",
    "PLENTY": "Paga muchos avisos. Cuenta con que el móvil avise.",
    "UNKNOWN": "La sonda no pudo leer el Centro de Avisos."
  },
  "readingRule": "Las lecturas de sonda pueden fallar. Una sonda más precisa falla menos.",
  "local": {
    "title": {
      "build": "Construcción terminada",
      "research": "Investigación terminada",
      "ships": "Naves listas",
      "fleet": "Flota de vuelta"
    },
    "body": {
      "build": "{{name}} en {{world}} está listo.",
      "research": "{{name}} está completada.",
      "ships": "{{count}} × {{name}} listas en {{world}}.",
      "fleet": "Una flota ha vuelto a su mundo de origen.",
      "unnamed": "Un pedido en {{world}} ha terminado."
    },
    "section": "Recordatorios de pedidos en este móvil",
    "sectionBody": "Este móvil te avisa cuando termina un pedido. No gasta deuterio de la caja y se ajusta solo en este móvil.",
    "switch": "Avisarme cuando terminen los pedidos",
    "denied": "El móvil no permitió las notificaciones. Permítelas para Astera Online en los ajustes del móvil.",
    "blocked": "Los avisos de Astera Online están desactivados en los ajustes del móvil. Quedan en pausa hasta que los actives allí.",
    "lateTitle": "Los avisos pueden llegar tarde",
    "late": "Sin este permiso, Android puede retrasar un aviso hasta una hora. Permítelo para saber al momento cuándo termina un pedido.",
    "allowExact": "Permitir avisos puntuales",
    "category": {
      "build": "Construcción",
      "research": "Investigación",
      "ships": "Naves",
      "fleet": "Flotas que vuelven"
    }
  },
  "hours_one": "{{count}} hora",
  "hours_other": "{{count}} horas",
  "floor": "mín. {{amount}}"
};
