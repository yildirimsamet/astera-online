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
    "Esta cola pertenece a tu comandante y la investigación iniciada no se puede cancelar. La construcción y el patio en cada mundo siguen funcionando por separado.",
  runningLabel: "En marcha",
  runningFinishes: "finaliza {{time}}",
  idleLabel: "No hay nada en marcha",
  idleHint: "Inicie un proyecto a continuación. Hasta tres pueden esperar aquí; una vez iniciados no se pueden cancelar.",

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
  strategicNote:
    "Desbloquea el arma más destructiva de la galaxia, su respuesta defensiva y capacidad de almacenamiento adicional.",

  act: "Investigación",
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
  warAt: "El acto de guerra se abre en {{duration}}",
  isotopeFirst: "Primero investiga la espectrometría de isótopos",
  prerequisiteFirst: "Investiga {{name}} primero",
  graviticFirst: "Investiga primero las cargas gravíticas",
  cargoInsight: "Llena tu carga en una incursión mientras quede el botín",
  shieldInsight: "Haz que una Égida absorba al menos {{share}} del daño de tu banda.",

  sheetEyebrow: "Proyecto de investigación",
  sheetComplete: "Investigación completa",
  sheetCost: "Costo de investigación",
  sheetOnce: "Colocado en la cola de investigación de todo tu comandante. No utiliza un espacio de Construcción o Patio.",
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
  deathStarName: "Protocolo de la Estrella de la Muerte",
  deathStarTag: "Desbloquea la Estrella de la Muerte",
  deathStarRole:
    "Permite que un mundo con Núcleo de Mando 12 y Astillero 5 construya la Estrella de la Muerte de un solo uso. Una capital nunca puede ser capturada.",
  deathStarDetail:
    "Cada golpe consume una Estrella de la Muerte. Elimina la mitad de los recursos almacenados y las Obras, reduce el Núcleo de Comando en un nivel y la Égida en dos, sujeta los edificios al nuevo techo del Núcleo y cancela los trabajos de construcción sin reembolso. Todas las flotas permanecen en pie y el mundo nunca cambia de manos. Durante dos horas el mundo no puede producir, recoger, realizar pedidos ni lanzar.",

  synthesisName: "Síntesis de deuterio",
  synthesisTag: "Eleva el techo de la Refinería",
  synthesisRole:
    "Cada peldaño abre tres niveles más de Refinería de Deuterio en cada mundo que tengas",
  synthesisDetail:
    "Cada peldaño de investigación eleva el techo de la Refinería de Deuterio en tres niveles en cada mundo. Aún construyes esos niveles de Refinería por separado donde necesitas producción de combustible.",
  yardName: "Automatización de patios",
  yardTag: "Construye naves más rápido",
  yardRole:
    "Acorta el tiempo de construcción de naves móviles sin afectar los cañones terrestres ni la capacidad del patio.",
  yardDetail:
    "Cada peldaño reduce el tiempo de cada pedido futuro de naves móviles en tus mundos, incluidos los Prospectores. No acelera las defensas terrestres, no reduce los precios de los recursos ni agrega espacios en la cola de Yard.",
  robotsName: "Robots con IA",
  robotsTag: "Construye estructuras más rápido",
  robotsRole:
    "Acorta todo lo que hay en la cola de construcción sin afectar a los naves ni a los cañones terrestres.",
  robotsDetail:
    "Cada peldaño finaliza antes todos los pedidos de construcción futuros en tus mundos: edificios, instrumentos y satélites por igual. No acelera los naves (eso es Yard Automation) y no reduce los precios de los recursos ni agrega espacios en la cola.",
  holdsName: "Retenciones del prospector",
  holdsTag: "Las naves mineras llevan más",
  holdsRole: "Aumenta todas las reservas del Prospector; La bonificación por capacidad de la torre de perforación se aplica en la parte superior.",
  holdsDetail:
    "Cada peldaño aumenta la cantidad con la que cada prospector puede regresar. La bonificación se multiplica con el satélite Derrick y el tercer peldaño abre una tercera ranura de Prospector en cada mundo.",
  cargoName: "Bodegas de carga",
  cargoTag: "Cada bodega lleva más",
  cargoRole: "Aumenta el botín de incursiones, las transferencias mundiales y los convoyes comerciales por igual · La minería de asteroides es su propia escalera",
  cargoDetail:
    "Cada peldaño aumenta lo que transportan tus naves: botín de incursión en toda la flota móvil y el control de cada Mensajero, Caminante, Atlas y Argosy que mueve mineral entre tus mundos o comercia con un comerciante. Los prospectores tienen su propia escalera en Prospector Holds.",

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
  gridTag: "Derriba una Estrella de la Muerte",
  gridRole:
    "Un interceptor cargado destruye un arma estratégica en el anillo de intercepción del radar o en la mira del telescopio.",
  gridDetail:
    "Otorga acceso a la carga interceptora. Construir uno requiere un enlace ascendente y un radar 3 en el mundo objetivo. Una carga cargada destruye automáticamente la primera arma estratégica que ingresa a su anillo de interceptación de radar cronometrado o que se identifica en la mira del telescopio desde cualquier mundo que tengas y luego se gasta.",
  stockpileName: "Reserva estratégica",
  stockpileTag: "Mantén una segunda arma en la plataforma.",
  stockpileRole:
    "Cada mundo puede contener dos Estrellas de la Muerte; el segundo comienza después de que termina el primero",
  stockpileDetail:
    "Aumenta el límite de la Estrella de la Muerte de uno a dos en cada mundo, no en todo el comandante. El segundo se puede poner en cola, pero comienza solo después de que finaliza el primero y aún cuesta el precio y el tiempo completos. Un golpe todavía consume su arma.",
} as const;
