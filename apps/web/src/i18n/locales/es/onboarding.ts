/**
 * THE REHEARSAL — ninety seconds of the real game, before there is an account.
 *
 * Every line is a beat, and every beat is a thing the player is about to DO. None
 * of them explains a system: the copy names what to look for and gets out of the
 * way, because the beat only advances when the thing actually happens.
 *
 * The house style holds here as hard as anywhere — consequence first, never a
 * system name, and never a paragraph where a clause will do.
 */
export const onboarding = {
  /** The one-line caption over the disc while the galaxy is being looked at. */
  beats: {
    wide: {
      title: '{{shard}}',
      line: 'En esta galaxia juega gente real. Cada planeta es el hogar de un jugador. Los naves que ves son sus flotas reales.',
      action: 'Muéstrame mi mundo',
    },
    yours: {
      title: 'Este planeta es tuyo',
      line: '{{name}} es tu planeta de origen seguro. Aquí creas recursos, estudias rivales, construyes defensas y construyes naves. Toca tu planeta.',
    },
    briefing: {
      title: 'El juego tiene cuatro pasos.',
      line: 'Primero, crea recursos. Luego estudia a tus rivales. Protege tu planeta. Cuando estés listo, envía tus naves. Cada actualización fortalece uno de estos trabajos.',
      action: 'Da el primer paso',
      mapGrow: 'Marca',
      mapIntel: 'Ver',
      mapDefend: 'Proteger',
      mapReach: 'Enviar',
      mapOutcome: 'Aprender · decidir · enviar',
    },
    fog: {
      title: 'Aprender primero, arriesgar después',
      line: 'Toca otro planeta. Puedes ver su nivel, pero no sus recursos, naves o defensas. Reúna información primero. Luego decide si debes atacar.',
    },
    fogAlone: {
      title: 'Nadie más está aquí todavía',
      line: '{{shard}} todavía se está llenando. Cuando lo haga, no podrá ver lo que sostienen ninguno de ellos.',
      action: 'Entendido',
    },
    core: {
      title: 'Primero aumenta el límite de nivel.',
      line: 'El Núcleo de Mando establece qué tan alto pueden llegar tus otros edificios. Toca su fila. Vea lo que ofrece y cuesta el nivel 2, luego agréguelo a la cola.',
    },
    refinery: {
      title: 'Hacer más aleación',
      line: 'La Refinería fabrica aleación cada hora. Utiliza aleación para la mayoría de los edificios y naves. Toque su fila y el nivel de cola 2.',
    },
    extractor: {
      title: 'Ahora haz cristal.',
      line: 'El Extractor produce cristales cada hora. Los naves fuertes y las herramientas de inteligencia necesitan cristal. Toque su fila y el nivel de cola 2.',
    },
    fleet: {
      title: 'Ahora haz dos naves.',
      line: 'Abra la fila {{ship}} en Flota. Elige Max y pon en cola ambos naves. Usarás estas rápidas naves para explorar a tus rivales o atacarlos.',
    },
  },

  /** Always reachable: skip to claim, or leave for an existing account. */
  skip: 'Saltar',
  haveAccount: 'ya tengo un comandante',

  /** The wall, at the one moment the player wants something. */
  claim: {
    eyebrowName: 'Último paso',
    headingName: 'Firma el mundo con tu nombre',
    lineName: 'Tus cuatro pedidos están preparados. Reclama {{name}} y sus relojes reales comenzarán juntos.',
    nameLabel: 'Nombre del comandante',
    next: 'Continuar',

    eyebrowPassword: 'Uno más',
    headingPassword: 'Bloquear {{name}}',
    linePassword: 'Elija una contraseña y su comandante estará esperando en cualquier navegador desde el que inicie sesión.',
    passwordLabel: 'Contraseña',
    submit: 'Reclama el planeta',
    working: 'Tomando el mundo',
    back: 'Atrás',
  },

  /** What the beats could not deliver, said plainly rather than swallowed. */
  trouble: {
    noFrontier: 'Todas las galaxias están llenas en este momento. Nada que ensayar hasta que termine una temporada.',
    unreachable: 'No se pudo llegar a la galaxia.',
    retry: 'Inténtalo de nuevo',
    /** One or more replayed decisions were refused once the server ran them. */
    partial: 'Tu mundo es tuyo. Un pedido preparado fue rechazado cuando comenzaron las colas reales.',
  },
} as const;
