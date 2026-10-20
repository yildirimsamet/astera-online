/**
 * THE RESEARCH SURFACE. T12.
 *
 * Its own namespace because it is its own screen. These strings lived under
 * `planet.reach` while research was four cards on the planet sheet's fleet tab —
 * and while there were four of them, that was the truth. There are fifteen now,
 * they belong to the COMMANDER rather than to a world (T7), and they moved to a
 * surface of their own.
 *
 * `planet.reach` KEPT ITS OWN COPIES of the two sentences that gate a hull
 * ("Research Dense Fuel Cells first" on the Wayfarer, the same for the Nullifier).
 * They read the same in English today and they are still two different strings on
 * two different screens — one is a door on a research card, one is a requirement
 * on a ship. The day either is reworded the other must not move with it.
 */
export const research = {
  shipShieldStage: "2 · Los escudos de las naves absorben los disparos",
  shipShieldHullDamage: "Tras los escudos, {{amount}} de daño alcanzó los cascos defensores.",
  shipShieldsName: "Escudos de nave",
  shipShieldsTag: "Absorbe fuego de combate cada ronda",
  shipShieldsRole: "Cada nave comienza con un escudo igual a su casco máximo. Cuatro niveles de investigación aumentan este escudo base un 25%, 50%, 70% y 100% en total.",
  shipShieldsDetail: "Los escudos se recargan al inicio de cada ronda. El daño del casco permanece. La radiación atraviesa los escudos y daña directamente el casco. Las defensas terrestres no tienen escudo personal. El blindaje aumenta el casco máximo y el escudo. Las flotas enviadas conservan su investigación de salida.",
  shipShieldGain: "Aumento del escudo",
  shipShieldScope: "Se aplica a todas las naves móviles. Las bonificaciones son aumentos totales sobre el escudo base; no se multiplican entre niveles.",
  shipShieldStat: "Escudo de nave (HP)",
  shipShieldRound: "Esta ronda tus escudos absorbieron {{your}}; los escudos enemigos absorbieron {{their}} de daño.",
  shipShieldHint: "Los escudos se recargan cada ronda. La radiación daña directamente el casco.",
  shieldingCeiling: "Nivel {{level}}: {{rate}} HP/min",
  shieldingName: "Blindaje antirradiación",
  shieldingTag: "Reduce el daño por radiación a las naves",
  shieldingRole: "Protege tus naves de la radiación en planetas y monumentos. Hay cuatro niveles de investigación.",
  shieldingDetail: "Esta investigación solo protege naves; no reduce el daño de combate. En un planeta, Aegis aporta protección adicional. En monumentos solo se aplica la protección de la nave. Las naves en tus propios planetas usan el nivel actual de su comandante. Las flotas enviadas conservan la protección de su salida; las investigaciones posteriores no las mejoran. La investigación requiere Núcleo 3 en tu capital.",
  shieldingRateLabel: "Radiación nivel 2 · HP/min",
  shieldingScope: "La protección de la flota se guarda al enviar. Funciona contra todos los niveles de radiación.",
  eyebrow: "Comandante",
  title: "Investigación",
  /** What the whole screen is for, in the one clause a player reads before scrolling. */
  premise: "La investigación completada se aplica a todos tus mundos. Cada nivel se compra por separado.",

  /** THE QUEUE. It belongs to the commander, not to the funding world. */
  queueTitle: "Cola de investigación",
  queueCapacity: "{{count}} ranuras",
  queueLane: "Investigación del comandante",
  queueGlobalHint:
    "Esta cola pertenece a tu comandante y la investigación iniciada no se puede cancelar. La construcción y el astillero de cada mundo siguen funcionando por separado.",
  runningLabel: "En marcha",
  runningFinishes: "finaliza {{time}}",
  idleLabel: "No hay nada en marcha",
  idleHint:
    "Elige una estrella en el mapa. Hasta tres proyectos pueden esperar aquí.",

  frontierBand: "Frontera",
  frontierNote: "Permisos y protección contra la radiación. Cada proyecto indica sus condiciones de descubrimiento y requisitos.",
  industryBand: "Industria",
  industryNote:
    "Mejora la producción, los tiempos de construcción y reparación, y la capacidad de carga. Cada proyecto muestra su límite de niveles y requisitos.",
  doctrineBand: "Doctrina",
  doctrineNote: "Desbloquea naves avanzadas y mejora ataque, blindaje, escudos de combate o propulsión. Las sondas pueden revelar investigación de combate.",
  strategicBand: "Estratégico",
  strategicNote: "Aumenta cuántas Estrellas de la Muerte y cargas interceptoras puede tener cada uno de tus mundos.",

  act: "Investigación",
  details: "Detalles",
  cannotAfford: "Recursos insuficientes",
  complete: "investigado",
  /**
   * WHAT IS HAPPENING TO A PROJECT ALREADY BOUGHT. D183.
   *
   * Two words, two states: the clock is paying for one of them and the other is
   * waiting in a line of three. A row that said "1 order queued" for both hid the
   * only fact a commander choosing what to buy next needs.
   */
  rowRunning: "Investigando",
  rowQueued: "En cola",

  needCore: "Aumenta el núcleo de mando de tu capital a L{{level}}",
  queueFull: "3 proyectos de investigación ya están en cola. Espere a que termine uno antes de agregar otro.",
  at: "Investigable en {{duration}}",
  isotopeFirst: "Primero investiga la espectrometría de isótopos",
  prerequisiteFirst: "Investiga {{name}} primero",
  prerequisiteLevelFirst: "Sube {{name}} al nivel {{level}} primero",
  nameAtLevel: "{{name}} N{{level}}",
  cargoInsight: "Llena tu carga en una incursión mientras quede el botín",
  shieldInsight: "Haz que una Égida absorba al menos {{share}} del daño de tu banda.",

  sheetEyebrow: "Proyecto de investigación",
  sheetComplete: "Investigación completa",
  sheetCost: "Costo de investigación",
  sheetOnce: "Colocado en la cola de investigación de todo tu comandante. No utiliza un espacio de Construcción ni de Astillero.",
  sheetRung: "Nivel {{level}} de {{max}}. Cada nivel se compra por separado.",

  isotopeName: "Espectrometría de isótopos",
  isotopeTag: "Desbloquea la minería de deuterio",
  isotopeRole:
    "Muestra el deuterio en rocas isotópicas y te permite enviarles buscadores. El botín de regreso ingresa a Obras.",
  isotopeDetail:
    "Investiga una vez para convertir asteroides isotópicos en objetivos mineros seleccionables. Desbloquea el acceso al Deuterio en disputa; no crea combustible pasivo en un planeta.",
  denseName: "Pilas de combustible densas",
  denseTag: "desbloquea la propulsión del nave",
  denseRole:
    "Para revelarlo, llena tu carga en una incursión mientras el botín permanece en el objetivo. La finalización abre la escala de investigación de propulsión de naves.",
  denseDetail:
    "Completarlo abre permanentemente la investigación de Propulsión de naves para tu comandante. La propulsión mejora todos los naves de tu flota y también forma parte del proceso de construcción de Atlas; no cambia Prospectores ni sondas.",
  graviticName: "Cargas Gravíticas",
  graviticTag: "Desbloquea el anulador",
  graviticRole:
    "Para desbloquearlo, ataca un mundo defendido con una Égida activa; el escudo debe absorber al menos {{share}} de tu daño. Un solo Dardo puede calificar; no necesitas ganar. El Anulador golpea los escudos activos cinco veces más fuerte.",
  graviticDetail:
    "Completarlo permanentemente satisface la parte de investigación especializada de la puerta Nulificadora. El Anulador es una respuesta a una Égida activa, no una mejora de daño general; su daño adicional de escudo nunca se extiende a naves o cañones terrestres.",

  synthesisName: "Síntesis de deuterio",
  synthesisTag: "Eleva el techo de la Refinería",
  synthesisRole:
    "Cada peldaño abre tres niveles más de Refinería de Deuterio en cada mundo que tengas",
  synthesisDetail:
    "Cada peldaño de investigación eleva el techo de la Refinería de Deuterio en tres niveles en cada mundo. Aún construyes esos niveles de Refinería por separado donde necesitas producción de combustible.",
  yardName: "Automatización de astilleros",
  yardTag: "Construye naves más rápido",
  yardRole:
    "Acorta las nuevas órdenes de producción de naves y defensas terrestres en todos tus planetas.",
  yardDetail:
    "Cada nivel reduce la duración de las nuevas órdenes del astillero, incluidos los Prospectores y las defensas terrestres. La tabla muestra qué parte del tiempo base queda. Los costes y la capacidad de la cola no cambian. La construcción y las reparaciones usan investigaciones distintas.",
  robotsName: "Robots con IA",
  robotsTag: "Construye estructuras más rápido",
  robotsRole:
    "Acorta todo lo que hay en la cola de construcción sin afectar a los naves ni a los cañones terrestres.",
  robotsDetail:
    "Reduce las futuras construcciones en todos tus planetas: edificios, instrumentos y satélites. No acelera naves ni defensas terrestres. Precios y capacidad de cola no cambian.",
  industrialName: "Industrial",
  industrialTag: "Repara naves más barato y más rápido",
  industrialRole:
    "Reduce el coste y el tiempo de cada trabajo de la Estación de Reparación",
  industrialDetail:
    "Reduce el coste y tiempo de reparación en todos tus planetas. El nivel 1 aplica el 75 % de lo normal; el nivel 2 aplica el 50 %. No acelera la construcción de naves.",
  holdsName: "Retenciones del prospector",
  holdsTag: "Las naves mineras llevan más",
  holdsRole: "Aumenta todas las reservas del Prospector; La bonificación por capacidad de la torre de perforación se aplica en la parte superior.",
  holdsDetail:
    "Cada peldaño aumenta la cantidad con la que cada prospector puede regresar. La bonificación se multiplica con el satélite Derrick y el tercer peldaño abre una tercera ranura de Prospector en cada mundo.",
  cargoName: "Bodegas de carga",
  cargoTag: "Cada bodega lleva más",
  cargoRole: "Aumenta el botín de incursiones, las transferencias mundiales y los convoyes comerciales por igual · La minería de asteroides es su propia escalera",
  cargoDetail:
    "Cada nivel amplía la bodega de todas las naves móviles para incursiones y transferencias entre tus mundos. Mensajero, Caminante, Atlas y Argosy también llevan más en convoyes comerciales. Los prospectores usan su propia investigación.",

  engineeringName: "Ingeniería de naves estelares",
  engineeringTag: "Abre niveles avanzados de casco.",
  engineeringRole:
    "Ingeniería I abre permisos de casco de nivel 3; Ingeniería II abre el Nivel 4. Los cascos individuales conservan sus requisitos de investigación de sistemas y de astillero.",
  engineeringDetail:
    "El nivel 1 cumple el requisito de ingeniería de naves de categoría 3. El nivel 2 hace lo mismo para la categoría 4. Cada nave puede exigir Potencia, Blindaje, Propulsión o Cargas Gravíticas. Sigue siendo necesario el nivel de Astillero indicado.",
  powerName: "Potencia del nave",
  powerTag: "Genera ataque de buque de guerra",
  powerRole:
    "Aumenta el ataque de todos los buques de guerra de tu flota y satisface las puertas de construcción ofensivas avanzadas. Los cascos de carga y la defensa terrestre no se ven afectados.",
  powerDetail:
    "Cada nivel aumenta el ataque normal de todas las naves de guerra, incluido el Anulador. También beneficia a las naves que ya tienes. Los transportes no ganan ataque; defensas terrestres, Prospectores y sondas no cambian. El atacante usa su nivel al despegar; el defensor usa el nivel al comenzar el combate.",
  armorName: "Armadura de nave",
  armorTag: "Aumenta la resistencia del casco del nave.",
  armorRole:
    "Aumenta la resistencia del casco de cada nave de tu flota, incluidos los transportes, y satisface las puertas de construcción defensiva avanzada.",
  armorDetail:
    "Cada nivel aumenta la resistencia de todas las naves de la flota, incluidos los transportes. Defensas terrestres, Prospectores y sondas no cambian. El atacante usa su nivel al despegar; el defensor usa el nivel al comenzar el combate.",
  propulsionName: "Propulsión de naves",
  propulsionTag: "Aumenta la velocidad de la flota",
  propulsionRole:
    "Aumenta la velocidad de cada nave de tu flota y contribuye a la puerta Atlas. Se abre después de Dense Fuel Cells.",
  propulsionDetail:
    "Cada uno de los cuatro niveles añade un 25 % de la velocidad base. El último la duplica. Una flota mixta usa su nave más lenta. Prospectores y sondas no cambian. El efecto se aplica a misiones iniciadas después de completar la investigación.",
  groundDoctrineName: "Doctrina de Emplazamiento",
  doctrineTag: "Mejora la defensa terrestre.",
  doctrineRole:
    "Aumenta el ataque y la resistencia del Bastión, el Arpón y la Espina. No cambia la capacidad terrestre, la recuperación ni las ventajas de clase.",
  groundDoctrineDetail:
    "Aumenta el ataque y la resistencia del Bastión, el Arpón y la Espina en todos tus planetas. Capacidad terrestre y recuperación no cambian. La defensa usa el nivel de investigación al comenzar el combate.",

  gridName: "Cuadrícula de intercepción",
  gridTag: "Hasta seis cargas interceptoras por planeta",
  gridRole: "Dos niveles de investigación aumentan la capacidad de cada planeta: 2 → 4 → 6.",
  gridDetail: "Cada nivel añade 2 espacios, sin dar cargas gratis. Construye cada carga en un planeta con Enlace ascendente activo y Radar 3. Una intercepción consume una carga y detiene una Estrella de la Muerte o una bomba de radiación. Solo dispara la batería del planeta objetivo.",
  stockpileName: "Reserva estratégica",
  stockpileTag: "Dos Estrellas de la Muerte por mundo",
  stockpileRole: "Aumenta de 1 a 2 las Estrellas de la Muerte que puede tener cada uno de tus mundos. La segunda empieza cuando termina la primera.",
  stockpileDetail: "Sin investigación, cada mundo tiene 1 Estrella de la Muerte; esta investigación la eleva a 2 en cada mundo, no en todo tu imperio. La segunda cuesta el precio completo y el tiempo de construcción completo, y se construye después de la primera. Atacar desde varios mundos a la vez es la forma de superar las cargas de un defensor.",
} as const;
