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
  eyebrow: "Comandante",
  title: "Investigación",
  /** What the whole screen is for, in the one clause a player reads before scrolling. */
  premise: "Comprado una vez, en tu poder y en cada mundo que tienes lo tiene.",

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
  frontierNote:
    "Revelado por eventos específicos en la galaxia, luego completado al gastar recursos y tiempo de investigación.",
  industryBand: "Industria",
  industryNote:
    "Abierto desde el primer minuto con cinco peldaños cada uno. Mejora la producción, el tiempo de construcción y la capacidad de carga.",
  doctrineBand: "Doctrina",
  doctrineNote:
    "Abre niveles avanzados de casco y mejora el ataque, el blindaje o la propulsión en escaleras delimitadas separadas. Los niveles de combate son visibles mediante sonda.",
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
  sheetRung: "Rung {{level}} de {{max}}. Cada peldaño se compra por separado.",

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
    "Acorta el tiempo de construcción de naves móviles sin afectar los cañones terrestres ni la capacidad del astillero.",
  yardDetail:
    "Cada peldaño reduce el tiempo de cada pedido futuro de naves móviles en tus mundos, incluidos los Prospectores. No acelera las defensas terrestres, no reduce los precios de los recursos ni agrega espacios en la cola de Yard.",
  robotsName: "Robots con IA",
  robotsTag: "Construye estructuras más rápido",
  robotsRole:
    "Acorta todo lo que hay en la cola de construcción sin afectar a los naves ni a los cañones terrestres.",
  robotsDetail:
    "Cada peldaño finaliza antes todos los pedidos de construcción futuros en tus mundos: edificios, instrumentos y satélites por igual. No acelera los naves (eso es Yard Automation) y no reduce los precios de los recursos ni agrega espacios en la cola.",
  industrialName: "Industrial",
  industrialTag: "Repara naves más barato y más rápido",
  industrialRole:
    "Reduce el coste y el tiempo de cada trabajo de la Estación de Reparación",
  industrialDetail:
    "Cada peldaño reduce en un cuarto lo que cuesta y lo que tarda reparar una nave dañada en todos tus mundos: 75 % en el nivel 1 y 50 % en el nivel 2. No construye naves más rápido \u2014 eso es Yard Automation \u2014 y una nave con un 20 % de daño o menos tras una batalla se repara gratis de todos modos.",
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
    "La ingeniería otorga permiso de construcción en lugar de un multiplicador de combate. Su primer peldaño abre las puertas del casco del Nivel 3 y el segundo abre las puertas del casco del Nivel 4; un casco específico aún puede requerir energía, armadura, propulsión o cargas gravíticas y el nivel de astillero indicado.",
  powerName: "Potencia del nave",
  powerTag: "Genera ataque de buque de guerra",
  powerRole:
    "Aumenta el ataque de todos los buques de guerra de tu flota y satisface las puertas de construcción ofensivas avanzadas. Los cascos de carga y la defensa terrestre no se ven afectados.",
  powerDetail:
    "Cada peldaño aumenta el ataque ordinario en cada buque de guerra, incluido el Anulador, y se aplica a los naves que ya posees. No añade ataque a los transportes ni afecta a Bastion, Thorn, Prospector o sondas. Un atacante lleva su nivel de tiempo de lanzamiento; un defensor lee el nivel del tiempo de batalla.",
  armorName: "Armadura de nave",
  armorTag: "Aumenta la resistencia del casco del nave.",
  armorRole:
    "Aumenta la resistencia del casco de cada nave de tu flota, incluidos los transportes, y satisface las puertas de construcción defensiva avanzada.",
  armorDetail:
    "Cada peldaño aumenta la resistencia del casco de cada nave de tu flota, incluidos Mensajero, Caminante, Atlas y Argosy. No afecta a Bastion, Thorn, Prospector ni a las sondas. Un atacante lleva su nivel de tiempo de lanzamiento; un defensor lee el nivel del tiempo de batalla.",
  propulsionName: "Propulsión de naves",
  propulsionTag: "Aumenta la velocidad de la flota",
  propulsionRole:
    "Aumenta la velocidad de cada nave de tu flota y contribuye a la puerta Atlas. Se abre después de Dense Fuel Cells.",
  propulsionDetail:
    "Cada uno de los cuatro peldaños añade una cuarta parte a la velocidad nominal de cada nave de tu flota, por lo que el último la duplica y reduce a la mitad cada vuelo. Una flota mixta todavía viaja a la velocidad de su miembro más lento, por lo que la propulsión mejora la composición elegida sin borrar su perfil. No afecta a los prospectores ni a las sondas, y solo las misiones citadas una vez completadas reciben la ganancia.",
  groundDoctrineName: "Doctrina de Emplazamiento",
  doctrineTag: "Mejora la defensa terrestre.",
  doctrineRole:
    "Aumenta el ataque de Bastión y Espina y la fuerza del casco juntos sin cambiar su capacidad, recuperación o enfrentamientos de clases.",
  groundDoctrineDetail:
    "Mejora el ataque y el casco de Bastions and Thorns en todos los mundos. Cambia la fuerza de combate, no la capacidad terrestre o el salvamento; Los defensores usan el peldaño que se sostiene cuando comienza la batalla.",

  gridName: "Cuadrícula de intercepción",
  gridTag: "Cuatro cargas interceptoras por mundo",
  gridRole: "Aumenta de 2 a 4 las cargas interceptoras que puede tener cada uno de tus mundos.",
  gridDetail: "Sin investigación, cada mundo puede cargar 2 cargas interceptoras; esta investigación eleva el límite a 4 en cada mundo. Una carga necesita un enlace ascendente y Radar 3 en su mundo. Una carga lista destruye la primera Estrella de la Muerte que cruza su anillo de intercepción del radar o que es identificada en la mira del telescopio de cualquiera de tus mundos, y luego se gasta. Una carga detiene un arma: un mundo cargado solo cae si llegan a la vez más armas que cargas tiene.",
  stockpileName: "Reserva estratégica",
  stockpileTag: "Dos Estrellas de la Muerte por mundo",
  stockpileRole: "Aumenta de 1 a 2 las Estrellas de la Muerte que puede tener cada uno de tus mundos. La segunda empieza cuando termina la primera.",
  stockpileDetail: "Sin investigación, cada mundo tiene 1 Estrella de la Muerte; esta investigación la eleva a 2 en cada mundo, no en todo tu imperio. La segunda cuesta el precio completo y el tiempo de construcción completo, y se construye después de la primera. Atacar desde varios mundos a la vez es la forma de superar las cargas de un defensor.",
} as const;
