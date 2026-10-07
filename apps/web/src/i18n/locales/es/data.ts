/**
 * THE NAMED THINGS, AND THE SENTENCES THE GAME SAYS ABOUT THEM.
 *
 * `packages/rules` owns the numbers and stays language-free (it is the shared
 * source of truth for the server and the simulator, and a translation table in
 * there would be I/O by another name). So every NAME a player reads lives here,
 * keyed by the same id the rules use.
 */

export const vocabulary = {
  building: {
    CORE: { name: 'Núcleo de comando', tag: 'Desbloquea niveles más altos', role: 'Establece los techos del edificio y la velocidad de construcción; la capital abre espacios para colonias en los niveles 9, 13 y 16.', detail: 'Ningún otro edificio puede elevarse por encima del Centro de Mando. Aumentarlo acorta el tiempo de construcción, abre más órbitas y espacios de vuelo en niveles establecidos y expande la capacidad de defensa terrestre. Solo el Núcleo de la capital establece límites de investigación y velocidad, y otorga la primera, segunda y tercera colonia en los niveles 9, 13 y 16. No produce mineral ni poder de combate por sí solo.' },
    REFINERY: { name: 'Refinería de aleaciones', tag: 'Hace aleación', role: 'Aleación por hora y almacenamiento de aleaciones', detail: 'Cada nivel aumenta los ingresos de aleación pasiva y la cantidad que se puede almacenar. La aleación paga la mayor parte de la construcción y los cascos, por lo que esto acorta muchas esperas futuras.' },
    EXTRACTOR: { name: 'Extractor de cristales', tag: 'Hace cristal', role: 'Cristal por hora y almacenamiento de cristal', detail: 'Cada nivel aumenta los ingresos y el almacenamiento de cristales pasivos. El cristal es la mitad más rara del hardware, los instrumentos y los costos de investigación avanzados.' },
    VAULT: { name: 'Almacenar', tag: 'Profundiza la almacén', role: 'Amplía el almacenamiento de recursos y deja un 10% de margen para las próximas actualizaciones de productores de cristales y aleaciones correspondientes. El 10% inferior, con un límite de 8 horas de producción, está a salvo de redadas.', detail: 'La Almacén crece primero según su escala de horas de producción creada por su autor. En niveles altos, si ese piso es demasiado pequeño, la Almacén L se expande para contener el 110% del costo de aleación de Refinería de aleación L→L+1 y el costo de cristal Extractor de cristal L→L+1; la ventana horaria resultante también se aplica al deuterio. Una incursión no puede alcanzar el 10% inferior de la almacén u 8 horas de producción de ese recurso, lo que sea menor. La Almacén no lucha ni reduce el daño recibido.' },
    SHIPYARD: { name: 'Astillero', tag: 'Desbloquea mejores naves', role: 'Desbloquea cascos · acelera la construcción de naves y defensa terrestre · establece la precisión y el sigilo de la sonda', detail: 'Los niveles más altos abren nuevas clases de cascos y completan naves y defensas terrestres más rápido. También agudizan las lecturas de sus sondas y hacen que sus propias sondas sean más difíciles de detectar. Los niveles de astillero no añaden espacios en la cola.' },
    HANGAR: { name: 'Hangar', tag: 'Establece cuánta flota cabe', role: 'Espacio de flota en este mundo · se mejora con cualquier Núcleo de Mando', detail: 'Cada nave ocupa espacio en el Hangar según su tamaño, incluidas las naves que viajan fuera de casa; las defensas terrestres no. Un Hangar lleno no construye ni recibe más naves, pero no pierde nada de lo que ya tiene. Cada peldaño cuesta un tercio de la flota a la que hace sitio, así que los peldaños superiores cuestan más de lo que un mundo sin Almacenar mejorado puede guardar de una vez.' },
    DEUTERIUM_PLANT: { name: 'Refinería de deuterio', tag: 'Produce deuterio', role: 'Deuterio por hora y almacenamiento de combustible · su techo lo fija Deuterio Síntesis', detail: 'Cada nivel aumenta la producción pasiva de deuterio y la cantidad que se puede almacenar. El deuterio alimenta los lanzamientos de flotas; investiga el siguiente peldaño de síntesis de deuterio cuando la refinería alcance su nivel máximo.' },
  },

  instrument: {
    TELESCOPE: {
      name: 'Telescopio',
      tag: 'Resolver movimiento distante',
      role:
        'Identifica movimiento dentro de su alcance; Los espacios de reloj se convierten en 1, 2, 3 y 4 en L1, L3, L5 y L7. Silencioso.',
      roleNone:
        'Identifica el movimiento distante y te permite observar en silencio un mundo elegido para saber si su flota está en casa. Requiere un enlace ascendente en órbita.',
      roleOwned:
        'Amplía el área donde se identifican las embarcaciones en movimiento y proporciona espacios de vigilancia silenciosa. Da inteligencia, no protección.',
      detail: 'Más niveles amplían la vista de contacto en movimiento y revelan los asteroides que pasan cuando ingresan a esa área; una roca revelada permanece conocida hasta que desaparece. L1, L3, L5 y L7 proporcionan una, dos, tres y cuatro ranuras de vigilancia silenciosa. Un Telescopio nunca avisa que una flota está apuntando hacia ti.',
    },
    RADAR: {
      name: 'Radar',
      tag: 'Distinguir las amenazas hacia usted',
      role:
        'Detecta movimiento dentro de su círculo, mejora la detección de sondas y marca las amenazas dirigidas a este mundo con una hora de llegada.',
      roleNone:
        /*
          IT SAYS "MOST", BECAUSE A BARE WORLD IS NOT BLIND TO SCOUTS.
          `detectChance` has a floor: a world with no Radar still catches about one
          probe in seven and is told. That is deliberate — the scan notification is
          what teaches a new commander the Radar exists at all. The copy said
          "unseen", which was simply false, and a sentence that oversells a purchase
          is the one thing a decision surface may not do.
        */
        'Requiere un enlace ascendente en órbita. Sin radar, las flotas entrantes no avisan de su llegada y la mayoría de las sondas pasan desapercibidas.',
      roleOwned:
        'Detecta movimiento dentro de su círculo sin ETA y marca las amenazas dirigidas a este mundo con una hora de llegada. L2 agrega rodamiento, L4 tamaño aproximado y L5 el mundo de origen y la flota completa.',
      detail: 'Cada nivel amplía el círculo de contacto y alerta temporizada. Los niveles hasta L5 también mejoran las posibilidades de atrapar sondas: L1 marca una flota entrante con su hora de llegada, L2 agrega rumbo, L4 estima su fuerza y ​​L5 revela su origen y naves. L6–L8 compra alcance adicional. Se detecta movimiento no dirigido a este mundo sin ETA. Las cargas interceptoras solo pueden atacar armas estratégicas con Radar 3 o superior.',
    },
    AEGIS: {
      name: 'Égida',
      tag: 'Escudo para tu planeta',
      role: 'Un escudo planetario que recibe daño antes que las unidades y se regenera el 35% de su máximo cada hora.',
      roleNone:
        'Absorbe el daño de las incursiones antes que los naves y los cañones terrestres, luego se regenera sin recursos. No proporciona ninguna inteligencia.',
      roleOwned:
        'Absorbe el daño de las incursiones antes que naves y cañones terrestres y regenera el 35% de su máximo cada hora. No proporciona ninguna inteligencia.',
      detail: 'Cada nivel aumenta la fuerza máxima del escudo. El daño de combate se elimina de Égida antes de que llegue a los naves o a los cañones terrestres, y el escudo se regenera el 35% de su máximo por hora sin recursos. No reúne ninguna inteligencia.',
    },
    VEIL: {
      name: 'Velo',
      tag: 'Esconderse de los telescopios',
      role: "Degrada lo que cualquier telescopio puede leer sobre ti.",
      roleNone:
        'Puede hacer que el estado de tu flota sea ilegible para un telescopio contrario. Oculta información pero no inventa lecturas falsas ni detiene las investigaciones.',
      roleOwned:
        'Puede hacer que el estado de tu flota sea ilegible para un telescopio contrario. Oculta información pero no inventa lecturas falsas ni detiene las investigaciones.',
      detail: 'Un Velo más fuerte anula las lecturas más fuertes del Telescopio y reduce la precisión de la sonda del Astillero. Oculta tu estado; no inventa datos falsos ni bloquea una sonda entrante.',
    },
  },

  satellite: {
    UPLINK: {
      name: 'Enlace ascendente',
      tag: 'Desbloquea telescopio y radar',
      role:
        'Requerido para instalar un telescopio o radar en este mundo. Utiliza una ranura de órbita y no proporciona bonificación de producción ni de defensa.',
      blurb:
        'Un relé de comunicaciones que desbloquea el telescopio y el radar. No amplía la vista por sí solo.',
      detail: 'Instálalo una vez para que la construcción de telescopios y radares esté disponible en este mundo. Utiliza una ranura de órbita y nunca necesita niveles propios.',
    },
    FOUNDRY: {
      name: 'Fundición',
      tag: 'Más mineral cada hora',
      role:
        'Aumenta la producción de aleaciones pasivas, cristales y deuterio de este mundo en un 6 %.',
      blurb:
        'Apoya la producción desde órbita, aumentando los tres flujos de recursos horarios junto con las obras y las capacidades de almacenamiento derivadas de ellos.',
      detail: 'La Fundición aplica un multiplicador de 1,06 a la producción pasiva de aleaciones, cristales y deuterio en este mundo. Los límites de Obras y almacenamiento derivados de dichas tarifas aumentan con ella; la cantidad protegida contra redadas de la Almacén no. No afecta a las bodegas mineras ni a la carga de asalto.',
    },
    DERRICK: {
      name: 'Torre de perforación',
      tag: 'Mejor nave minera',
      role:
        'Le otorga a cada Prospector de este mundo 2 veces la capacidad de carga y 1,5 veces la velocidad de desplazamiento.',
      blurb:
        'Apoya las naves mineras de este mundo desde la órbita. Las bodegas más grandes aumentan cada recorrido, mientras que los viajes más rápidos mejoran sus posibilidades de llegar a tiempo a un asteroide en disputa.',
      detail: 'Multiplica la capacidad de carga del Prospector por 2× y la velocidad por 1,5×. La investigación de Prospector Holds vuelve a multiplicar la retención mejorada. El Derrick cambia únicamente de embarcación minera; la carga de asalto no se ve afectada.',
    },
    BEACON: {
      name: 'Baliza',
      tag: 'Flotas más rápidas',
      role:
        'Hace que las flotas de incursiones, transferencias, comercio y ayuda a clanes lanzadas aquí viajen 1,3 veces más rápido en ambas piernas.',
      blurb:
        'Una marca de navegación para flotas de incursión, transferencia, comercio y ayuda a clanes. Vuelos más cortos significan una ventana más corta con su defensa fuera de casa.',
      detail: 'Su multiplicador de velocidad de 1,3 se aplica a las flotas de incursión, transferencia, comercio y ayuda a clanes de ida y vuelta lanzadas aquí. No afecta a las flotas de asentamientos ni a los Prospectores, y no cambia el costo de ataque, armadura, carga o combustible.',
    },
  },

  /**
   * THE THREE ROLES A FIGHT IS DECIDED BY, plus the one that is prey.
   *
   * Named separately from `hull.*.family` on purpose. Family is a PURCHASING
   * taxonomy — where a hull sits in the shipyard — and it runs at right angles to
   * this one: a Pike is Offensive and a Rampart Defensive, and the Rampart beats
   * the Pike. Teaching the two with one word was how the interface came to imply
   * the opposite of the rule it enforces.
   */
  combatClass: {
    SKIRMISHER: { name: 'Hostigador', tag: 'Fuerte contra Baluarte; débil vs lanza' },
    BULWARK: { name: 'Baluarte', tag: 'Fuerte contra Lanza; débil vs hostigador' },
    LANCE: { name: 'Lanza', tag: 'Fuerte contra Hostigador; débil vs baluarte' },
    SUPPORT: { name: 'Soporte', tag: 'Desarmado; cubierto mientras los buques de guerra viven' },
  },

  hull: {
    DART: {
      name: 'Dardo', tag: 'Asaltante de velocidad frágil', role: 'Casco de combate de entrada más rápido; intercambia durabilidad por tiempo de exposición.',
      pitch: 'Llega y regresa rápidamente, pero se retira bajo fuego concentrado.',
      detail: 'Un hostigador de bajo coste para incursiones cortas y contraataques de casco pesado. Su velocidad preserva el tiempo de actividad de la defensa local; su delgado casco encarece una lectura fallida.',
    },
    PIKE: {
      name: 'Lucio', tag: 'Casco de lanza de entrada', role: 'Al precio de Dart, ataca más fuerte y tiene menos casco, con ventaja de clase contra los hostigadores.',
      pitch: 'El ataque supera la resistencia del casco: una salva de apertura más fuerte compra un nave más frágil.',
      detail: 'Pike es una lanza de entrada que caza hostigadores como Dart y Thorn. Al precio de Dart, compra más ataque y menos casco, y vuela más lento. Los cascos baluarte y los bastiones lo contrarrestan, por lo que una flota exclusivamente de picas tiene una respuesta clara y eficaz.',
    },
    RAMPART: {
      name: 'Muralla', tag: 'Fortaleza de entrada', role: 'Al precio de Warden, compra más durabilidad, pero ataca menos y ralentiza más la flota.',
      pitch: 'Absorbe el fuego de Lanza de manera eficiente; vulnerable a los enjambres de hostigadores.',
      detail: 'Un casco de línea lento clase Baluarte. Compra supervivencia en lugar de ataque y es mejor cuando el tiempo de viaje importa menos que mantener la formación.',
    },
    WARDEN: {
      name: 'Guardián', tag: 'Escolta móvil', role: 'Al precio de Rampart, ataca más fuerte y vuela más rápido, pero tiene menos casco.',
      pitch: 'Intercambia parte de la durabilidad de la fortaleza por ataque y ritmo de flota mixta.',
      detail: 'Warden es una escolta móvil de Baluarte con el mismo precio de recursos que Rampart. Su ataque bruto y su velocidad son mayores y la resistencia de su casco es menor. Rampart se adapta a una pared estática; Warden se adapta a una flota mixta que necesita ritmo.',
    },
    COURIER: {
      name: 'Mensajero', tag: 'Transporte ligero rápido', role: 'Casco de carga de entrada; Rápido, ligeramente protegido y desarmado.',
      pitch: 'Mantiene el ritmo de las flotas de fortalezas y lanzas, pero ralentiza las formaciones de hostigadores más rápidas.',
      detail: 'Un casco de apoyo para botín, transferencias y asentamientos. No causa daño y está protegido sólo mientras sobreviven las escoltas de combate.',
    },
    VIPER: {
      name: 'Víbora', tag: 'Asaltante eficiente', role: 'Velocidad de nivel dos y mejor supervivencia que Dart.',
      pitch: 'Conserva el plan de flota rápida y paga menos impuestos de durabilidad.',
      detail: 'Un hostigador de nivel dos sin investigación. Dart sigue siendo más barato, mientras que ambos cascos comparten la misma velocidad bruta. Viper convierte su mayor compromiso en más ataque, casco, carga y mejor eficiencia de combate con igual costo.',
    },
    TALON: {
      name: 'Garra', tag: 'Delantero pesado', role: 'Al precio de Viper, ataca mucho más fuerte, tiene menos casco, vuela más lento y contrarresta a los hostigadores.',
      pitch: 'El ataque excede la fuerza del casco; un nave más frágil equilibra su mayor daño.',
      detail: 'Un casco de daño clase Lanza para astilleros desarrollados. Los contadores de Baluarte siguen importando más que su ventaja de nivel.',
    },
    STRONGHOLD: {
      name: 'Fortaleza', tag: 'Casco de línea pesada', role: 'Al precio de Sentinel, tiene la mayor durabilidad de nivel dos, pero menos ataque y velocidad.',
      pitch: 'Construye un muro cuando la supervivencia importa más que la hora de llegada.',
      detail: 'Baluarte con perfil de fortaleza. Su casco alto ancla a las flotas, mientras que los hostigadores y la larga exposición siguen siendo costos claros.',
    },
    SENTINEL: {
      name: 'Centinela', tag: 'Escolta de nivel dos', role: 'Al precio de Stronghold, ataca más fuerte y vuela más rápido, pero tiene menos casco.',
      pitch: 'Cambia la durabilidad de la fortaleza por el ritmo de ataque y flota.',
      detail: 'Una escolta de Baluarte móvil que protege los transportes sin forzar el perfil de viaje de Fortaleza.',
    },
    WAYFARER: {
      name: 'Caminante', tag: 'Transporte equilibrado', role: 'Más capacidad que Mensajero; más lento pero aún flexible.',
      pitch: 'La elección intermedia entre Mensajero rápido y Atlas de alta capacidad.',
      detail: 'Un transporte de apoyo de nivel dos para incursiones y transferencias más grandes. Permanece desarmado y depende de escoltas de combate.',
    },
    TEMPEST: {
      name: 'Tempestad', tag: 'Asaltante de velocidad avanzado', role: 'Hostigador de nivel tres controlado por la investigación; comparte la velocidad de combate bruta más rápida con Dart, Viper y Corsair.',
      pitch: 'Velocidad al final del juego con eficiencia mejorada, todavía no es un nave de línea.',
      detail: 'Un asaltante avanzado desbloqueado por Ingeniería y Potencia de nave. Mantiene un perfil frágil para que las defensas y los contraataques de niveles inferiores sigan siendo relevantes.',
    },
    BALLISTA: {
      name: 'Balista', tag: 'Delantero avanzado', role: 'Al precio de Tempest, ataca mucho más fuerte, tiene menos casco y vuela más lento que una lanza de nivel tres.',
      pitch: 'El ataque supera la fuerza del casco, pero un daño elevado no lo salvará de la pared derecha del Baluarte.',
      detail: 'Un casco de ataque de nivel tres que requiere ingeniería y potencia naval. Recompensa a un objetivo informado, no a la producción ciega de una sola flota.',
    },
    LEVIATHAN: {
      name: 'Leviatán', tag: 'Fortaleza avanzada', role: 'Al precio de Praetorian, compra más casco, pero menos ataque y velocidad para un muro de nivel tres.',
      pitch: 'Un muro al final del juego que hace que cada vuelo sea un compromiso prolongado.',
      detail: 'Una fortaleza de nivel tres que se desbloquea a través de Ingeniería y Armadura de naves. Los hostigadores siguen siendo su eficaz contraataque.',
    },
    PRAETORIAN: {
      name: 'Pretoriano', tag: 'Escolta avanzada', role: 'Al precio de Leviatán, ataca más fuerte y vuela más rápido, pero tiene menos casco.',
      pitch: 'Intercambia parte de la durabilidad de la fortaleza por ataque y ritmo de flota mixta.',
      detail: 'Una escolta Baluarte de nivel tres que requiere ingeniería y armadura de nave. Protege la carga sin convertirse en la opción más lenta posible.',
    },
    ATLAS: {
      name: 'Atlas', tag: 'Transporte pesado de tercer nivel', role: 'La bodega de nivel tres más grande; lento, voluminoso y basado en la investigación.',
      pitch: 'El transporte de gran volumen, seguro y más eficiente antes de que se desbloquee Argosy.',
      detail: 'Un transporte de apoyo de nivel tres desbloqueado por Ingeniería y Propulsión. No causa ningún daño y hace que la planificación del acompañamiento sea esencial.',
    },
    NULLIFIER: {
      name: 'Anulador',
      tag: 'Rompe escudos activos',
      role: 'Un especialista en lanzas dirigido por ataques: el ataque supera la fuerza del casco, con cinco veces su efecto normal contra un escudo activo.',
      pitch: 'Aplasta una Égida sin convertir el daño adicional en muertes de unidades. Débil cuando no hay ningún escudo en pie.',
      detail: 'Su carga de especialista causa cinco veces el efecto normal a una Égida activa. Una vez que cae el escudo, esa bonificación no se extiende a los naves ni a los cañones, por lo que los objetivos sin escudo desperdician su prima.',
    },
    /** D200. `{{salvage}}` is `SALVAGE.perCollector`, filled in by `names.ts`. */
    GARBAGE_COLLECTOR: {
      name: 'Recolector de basura',
      tag: 'Levanta {{salvage}} de los restos del naufragio',
      role: 'Casco de apoyo especial: no dispara nada y recoge los restos después de la batalla en la que voló.',
      pitch: 'Vuela detrás de la línea como un transporte y realiza los últimos disparos. Mantenga los buques de guerra a su lado: una vez que caen, es una presa.',
      detail: 'Cuando termina la batalla, cada coleccionista que aún esté vivo levanta hasta {{salvage}} de los restos del naufragio (en la propia mezcla de aleación, cristal y deuterio) antes de que el resto se convierta en un campo público. El botín aterriza almacenado con la flota. No añade nada a la bodega, no puede volar sin un buque de guerra, no puede enviarse a un campo de restos de naufragio o a un asteroide y no recoge nada mientras defiende.',
    },
    CATACLYSM: {
      name: 'Cataclismo', tag: 'Delantero capitalino', role: 'Al precio de Corsair, ataca mucho más fuerte, tiene menos casco y vuela más lento que una lanza de nivel cuatro.',
      pitch: 'El ataque excede la fuerza del casco; un nave más frágil y contadores de clase equilibran su dura salva.',
      detail: 'Un casco de lanza capital detrás de Ingeniería, Poder y Armadura. Su eficiencia es mayor, pero la defensa clase Baluarte sigue siendo una mejor respuesta que reflejarla.',
    },
    CORSAIR: {
      name: 'Corsario',
      tag: 'Asaltante de capital',
      role: 'El único hostigador del nivel superior: lo que rompe un muro de Baluarte.',
      pitch: 'Al precio de Cataclysm, es más rápido y más resistente, pero ataca menos y tiene un agarre menor.',
      detail: 'Corsair es el único hostigador de nivel cuatro y comparte el peldaño más alto de velocidad de combate con Dart, Viper y Tempest. Tiene menos ataque bruto que Cataclysm pero gana la ventaja de Hostigador contra los muros de la Ciudadela; Los objetivos clase Lanza lo contrarrestan.',
    },
    CITADEL: {
      name: 'Ciudadela', tag: 'Fortaleza capital', role: 'Al precio de Paladin, tiene más casco, menos ataque y la velocidad de combate de nivel cuatro más lenta.',
      pitch: 'El muro más resistente, pagado en coste y tiempo de exposición.',
      detail: 'Un casco de Baluarte capital detrás de Ingeniería, Armadura y Poder. Ancla la defensa pero sigue siendo vulnerable a los contraataques del Hostigador.',
    },
    PALADIN: {
      name: 'Paladín',
      tag: 'Escolta capitalina',
      role: 'Al precio de Citadel, ataca más fuerte y vuela más rápido, pero tiene menos casco.',
      pitch: 'Una escolta de nivel cuatro que intercambia parte de la durabilidad de la fortaleza por ataque y ritmo de flota.',
      detail: 'El Paladín es de clase Baluarte, por lo que detiene las Lanzas y cae ante los Hostigadores. En su lugar, gasta la prima que una Ciudadela paga por armaduras en armas, la única opción entre los dos extremos del nivel cuatro.',
    },
    ARGOSY: {
      name: 'Argosy',
      tag: 'Transportista de capital',
      role: 'La bodega más profunda del juego y el más lento de los transportes.',
      pitch: 'Lleva casi hasta tres Atlas y no puede dejar atrás a nada.',
      detail: 'El Argosy es un transporte de nivel cuatro. Clase de apoyo, por lo que está protegido mientras los cascos de combate viven y quedan indefensos una vez que la línea desaparece. El ritmo del comerciante está ligado a este casco: el agarre más lento del catálogo lo marca.',
    },
    BASTION: {
      name: 'Bastión',
      tag: 'Cañones terrestres pesados',
      role: 'Defensa terrestre · nunca puede abandonar el planeta',
      pitch: 'Defensa terrestre pesada con ventaja contra cascos clase Lanza; vulnerable a los hostigadores.',
      detail: 'Los bastiones nunca abandonan el planeta. Su clase Baluarte les da una ventaja contra los cascos de clase Lanza, mientras que los Hostigadores reciben la ventaja contra ellos. Después del combate, el 60% de los cañones terrestres destruidos se restauran, redondeando hacia abajo.',
    },
    HARPOON: {
      name: 'Arpón', tag: 'Cañón terrestre Lanza', role: 'Defensa terrestre · emplazamiento Lanza estacionario',
      pitch: 'Rompe formaciones de Hostigadores; vulnerable a Baluartes.',
      detail: 'Los Arpones nunca abandonan el planeta. Su clase Lanza les da ventaja contra Hostigadores, mientras que los Baluartes los contrarrestan. Usan capacidad terrestre; el 60 % de los cañones destruidos se reconstruye tras el combate, redondeando hacia abajo.',
    },
    THORN: {
      name: 'Espina',
      tag: 'Cañones terrestres ligeros',
      role: 'Defensa terrestre · ligera, barata y nunca se va',
      pitch: 'Defensa terrestre de bajo costo con ventaja contra Baluartes; vulnerable a las lanzas.',
      detail: 'Las espinas nunca abandonan el planeta. Su clase Hostigador les da una ventaja contra los cascos de clase Baluarte, mientras que los cascos de clase Lanza reciben la ventaja contra ellos. Utilizan capacidad terrestre; El 60% de los cañones terrestres destruidos se restauran después del combate, redondeando hacia abajo.',
    },
    PROSPECTOR: {
      name: 'Prospector',
      tag: 'Minas de asteroides',
      role: 'Extrae asteroides con una base de 200 · no puede unirse a una flota de incursión',
      pitch: 'Intercepta un asteroide en movimiento y devuelve lo que puede transportar a Producción. No puede atacar ni transferir.',
      detail: 'Un Prospector solo puede enviarse a asteroides y campos de escombros revelados. Su velocidad base de ida y de regreso vacío es 1238; cargado regresa a 619. Su capacidad base es 200; Derrick y la investigación Bodegas de Prospector pueden mejorar estos valores. Cada mundo comienza con espacio para dos; Bodegas de Prospector III abre una tercera ranura. Nunca se une a incursiones ni a la defensa local.',
    },
  },

  resource: {
    alloy: 'aleación',
    crystal: 'cristal',
    deuterium: 'Deuterio',
  },

  /** The four things a season can hand you, announced the moment they open. */
  unlock: {
    TELESCOPE: {
      title: 'Telescopio desbloqueado',
      body: 'Un enlace ascendente y un telescopio identifican el movimiento más lejos y le permiten observar un planeta.',
    },
    RADAR: {
      title: 'Radar desbloqueado',
      body: 'Sondas de captura de enlace ascendente y radar; desde L1 su círculo también marca las amenazas dirigidas a ti con su hora de llegada.',
    },
    EXPLORER: {
      title: 'Explorador desbloqueado',
      body: 'Envíe una sonda para saberlo con certeza. Su radar puede captarlo.',
    },
    VEIL: { title: 'Velo desbloqueado', body: 'El estado de su flota puede ser DESCONOCIDO para cualquiera que esté mirando.' },
  },
} as const;

/** WHAT YOU GET IF YOU PRESS IT. */
export const gains = {
  rangeUnits: '{{count}} unidades',

  core: {
    label: 'Construir techo',
    level: 'L{{level}}',
    releases_one: 'lanza la actualización bloqueada de {{count}}',
    releases_other: 'Lanza {{count}} actualizaciones bloqueadas',
    raisesCap: 'Eleva el nivel del techo de los edificios',
  },
  hangar: {
    label: 'Sala de flota',
    value: '{{room}} habitación',
    none: 'Sin hangar',
    ceiling: 'Hasta {{room}} en el peldaño superior',
  },
  refinery: {
    label: 'Aleación por hora',
    rate: '{{amount}}/h',
    storage: 'Almacenamiento {{now}} → {{next}}',
  },
  extractor: {
    label: 'Cristal por hora',
    rate: '{{amount}}/h',
    storage: 'Almacenamiento {{now}} → {{next}}',
  },
  vault: {
    label: 'Profundidad de la almacén',
    value: '{{store}}h almacén · {{safe}}h protegido',
  },
  shipyard: {
    accuracyLabel: 'Precisión de la sonda',
    seesLabel: 'Ve a través de un velo hasta',
    seesValue: 'L{{level}}',
    unlocksHull: 'Desbloquea el {{hull}}',
    stealth: 'Y hace que tus propias sondas sean más difíciles de detectar',
  },

  telescope: {
    slotsLabel: 'Planetas que puedes observar',
    rangeLabel: '¿Hasta dónde puedes ver?',
    maxed: 'Nivel superior: {{slots}} ranuras de reloj y {{range}} unidades de mira de contacto móvil; suficiente para abarcar la galaxia',
    reachAndCooldown: 'Alcanza {{range}} · una ranura se realinea en {{hours}}h',
    nextSlot: 'El siguiente nivel agrega una ranura {{ordinal}}',
    ordinalSecond: '2do',
    ordinalThird: '3º',
    ordinalFourth: '4to',
    cooldown: 'Una ranura se realinea en {{hours}}h',
  },
  radar: {
    scansLabel: 'Detecta escaneos',
    scansNo: 'no',
    scansYes: 'sí',
    scansBearing: 'sí, con rodamiento',
    sweepLabel: 'Área de contacto · aviso cronometrado',
    sweepNone: 'ninguno',
    reaches: '{{sense}} contacto (sin ETA) · {{warn}} advertencia temporizada',
    maxed: 'Nivel superior; Las advertencias también revelan el mundo de origen y la flota exacta.',
    l1: 'Comienza a capturar sondas y advierte cuando una flota entrante ingresa al círculo',
    bearing: 'L2 también revela la dirección de aproximación',
    interception: "L3 permite cargar cargas interceptoras en este mundo (requiere enlace ascendente)",
    estimate: 'Muestra el tamaño aproximado de la fuerza que se aproxima temprano',
    origin: 'La advertencia nombra el mundo de origen y la flota exacta.',
  },
  aegis: {
    label: 'Escudo máximo',
    unlocks: 'Absorbe el daño antes que las unidades · regenera {{percent}}% del máximo cada hora',
  },
  veil: {
    label: 'Ciega un telescopio hasta',
    none: 'ninguno',
    level: 'L{{level}}',
    unlocks: "Reduce la precisión de una sonda a {{percent}} en el mismo Astillero",
  },

  foundry: {
    label: 'Producción de recursos por hora',
    now: 'salida actual',
    next: '+{{percent}}%',
    unlocks: 'Se aplica a la producción de aleaciones, cristales y deuterio en este mundo.',
  },
  uplink: {
    label: 'Telescopio y Radar',
    now: 'bloqueado',
    next: 'desbloqueado',
    unlocks: 'Se puede instalar un telescopio y un radar en este mundo.',
  },
  derrick: {
    label: 'Cada prospector lleva',
    now: '1×',
    next: '{{factor}}×',
    unlocks: 'Los buscadores también viajan {{factor}}× más rápido',
  },
  beacon: {
    label: 'Flotas de incursión, transferencia, comercio y ayuda',
    now: 'velocidad normal',
    next: '{{factor}}× más rápido',
    unlocks: 'Ida y vuelta: una ventana más corta con tu defensa fuera de casa',
  },
  /** Every research row names the quantity or permission the player actually buys. */
  research: {
    powerLabel: 'Ataque de buque de guerra',
    powerScope:
      'Todos los buques de guerra de tu flota. El poder y la armadura juntos suman como máximo un 56% de poder de combate con igual presupuesto; Los transportes y la defensa terrestre no se ven afectados.',
    armorLabel: 'Resistencia del casco del nave',
    armorScope:
      'Todos los naves de tu flota, incluidos los transportes. El poder y la armadura juntos suman como máximo un 56% de poder de combate con igual presupuesto; La defensa terrestre no se ve afectada.',
    speedLabel: 'Velocidad de la flota',
    speedScope:
      'Todos los naves de tu flota. Una flota mixta todavía vuela a la velocidad (mejorada) de su miembro más lento; Los buscadores y las sondas no se ven afectados.',
    engineeringLabel: 'Acceso al nivel del casco',
    engineeringTier: 'Nivel {{tier}}',
    engineeringScope:
      'Ingeniería I abre el Nivel 3 e Ingeniería II abre el Nivel 4. Los cascos individuales también pueden requerir potencia, armadura, propulsión o cargas gravíticas.',
    groundLabel: 'Fuerza de defensa terrestre',
    groundScope: '{{bastion}}, {{harpoon}} y {{thorn}} en cada mundo que tengas.',
    yardLabel: 'Tiempo de construcción del nave',
    robotsLabel: 'Tiempo de construcción de la estructura',
    holdsLabel: 'Retención del prospector',
    holdsScope: 'Se multiplica con una Derrick en órbita.',
    cargoLabel: 'Carga de asalto',
    cargoScope: 'Solo botín: las transferencias mundiales y la minería no cambian.',
    industrialLabel: 'Coste y tiempo de reparación',
    industrialScope: "Solo la Estación de Reparación: la construcción de naves no cambia.",
    refineryLabel: 'Techo de refinería',
    stockpileLabel: "Estrellas de la Muerte por mundo",
    gridLabel: "Cargas por mundo",
    /* A permission opens a door; drawing it as a ladder would invent a quantity. */
    opensLabel: 'Desbloqueos',
    open: 'Abierto',
    shut: 'Bloqueado',
    isotopeOpens: 'Los asteroides isotópicos se convierten en objetivos mineros seleccionables.',
    denseOpens: 'La investigación sobre propulsión de naves está disponible.',
    graviticOpens: 'Se cumple el requisito de investigación especializada del Anulador.',
  },
  plant: {
    label: 'Deuterio',
    value: '{{rate}}/h',
    storage: 'Almacenamiento de combustible {{now}} → {{next}}',
  },
} as const;

/** The situation engine: what a competent player would be thinking about now. */
export const directives = {
  inboundTitle: 'Flota entrante · {{duration}}',
  inboundDetail:
    'Gasta las existencias, envía tu flota o resiste y lucha. No se puede tomar si no está aquí.',
  inboundAction: 'Gástalo ahora',

  undefendedTitle: 'Este mundo no tiene defensa terrestre.',
  undefendedShieldedTitle: 'Tu escudo termina en {{duration}}: construye una defensa terrestre.',
  undefendedDetail: '{{amount}} está expuesto a redadas. Construye espinas o bastiones para una defensa permanente.',
  undefendedAction: 'Construir defensa',

  exposedTitle: '{{amount}} te lo pueden quitar',
  exposedDetail: 'Su bóveda protege {{now}}. El siguiente nivel protege {{next}}.',
  exposedAction: 'Levantar la bóveda',

  scannedTitle_one: 'Alguien te escaneó',
  scannedTitle_other: '{{count}} escanea en tu contra',
  scannedDetail: 'Están intentando conocer tus acciones y defensas. Un Velo reduce lo que su sonda puede revelar.',
  scannedAction: 'Ver el registro\nLa flota de',

  windowTitle: "{{name}} está ausente",
  windowDetailUnknownJustNow: 'Visto hace un momento. No sabes cuando vuelve.',
  windowDetailUnknown: 'Visto hace {{age}}. No sabes cuando vuelve.',
  windowDetailEta:
    'De regreso aproximadamente {{duration}}. Su planeta guarda todo lo que dejaron atrás.',
  windowAction: 'Abrir la ventana',

  storageFullTitle: '{{amount}} no se puede recopilar',
  storageFullDetail:
    'Tu almacén está llena, por lo que las obras no tienen dónde vaciar. Gasta algo y reclámalo.',
  storageFullAction: 'Gastarlo',

  noTelescopeTitle: 'Sólo tienes vista a simple vista',
  noTelescopeDetail:
    'Tu vista libre ya puede revelar un asteroide que pasa cerca. Un telescopio amplía esa área de descubrimiento, identifica naves en movimiento a mayor distancia y puede observar silenciosamente un planeta para avisarle cuándo parte su flota.',
  noTelescopeAction: 'Instalar un telescopio',

  noRadarTitle: 'Una flota podría aterrizar aquí sin previo aviso',
  noRadarDetail: 'El radar L1 ya marca una amenaza dirigida a ti con su hora de llegada dentro del círculo. Los niveles más altos amplían el rango y revelan más detalles.',
  noRadarAction: 'Mira el radar',

  coreCeilingTitle: 'Núcleo de Mando está bloqueando las actualizaciones de {{count}}',
  coreCeilingDetail: 'Nada puede exceder el Núcleo. Al levantarlo, se liberan todos a la vez.',
  coreCeilingAction: 'Elevar el núcleo',

  idleTitle: 'No hay nada en vuelo',
  idleDetailHasShips: 'Tus bahías están inactivas. Puedes iniciar una incursión, una transferencia o una carrera minera; Las sondas no utilizan bahías.',
  idleDetailNoShips: 'No tienes naves en casa. Construye algunos o espera a que vuelva el tuyo.',
  idleAction: 'Encuentra un objetivo',

  baysFreeTitle_one: 'Una bahía aún está libre',
  baysFreeTitle_other: '{{count}} las bahías aún están libres',
  baysFreeDetail: 'Las incursiones, transferencias y operaciones de minería requieren uno. Las sondas no utilizan bahías.',
  baysFreeAction: 'Busca algo',

  /** The card that carries the top directive. */
  kindThreat: 'Amenaza',
  kindOpportunity: 'Oportunidad',
  kindGrowth: 'Debilidad',
  kindIdle: 'Nada pendiente',

  /** The fold. One word each way: the card is small enough that a label is the control. */
  hide: 'Ocultar',
  show: 'Mostrar',
} as const;

/** The seven kinds of news, turned into the sentences a player reads. */
export const notifications = {
  incomingFallback: 'Flota entrante.',
  incomingLanded: 'aterrizó',
  incomingEta: 'ETA {{minutes}} min',
  incomingLandsIn: 'aterriza en {{duration}}',
  incomingHead: 'Flota entrante · {{clock}}',
  strategicIncomingHead: 'Arma estratégica entrante · {{clock}}',
  incomingEstimate: 'est. {{count}} naves',
  incomingFrom: 'de {{origin}}',
  /** Which of the reader's own worlds is under the crosshair. Never a radar product. */
  incomingAt: 'dirigido a {{world}}',
  commanderAt: '{{username}} en {{planet}}',
  unknownCommander: 'alguien',
  raidedBy: 'Asaltante: {{origin}} ·',
  composition: '{{count}} {{hull}}',
  join: ' · ',

  raidedFallback: 'Fuiste asaltado.',
  repelledHead: 'Incursión repelida · {{cost}}',
  repelledLost: '{{count}} perdió la tenencia',
  repelledTheirs: '{{count}} suyos destruidos',
  raided: 'Asaltado · {{detail}}',
  raidedWorks: 'producción reducida durante {{time}}',
  raidedTaken: '−{{amount}} tomado',
  raidedLost_one: '{{count}} unidad perdida',
  raidedLost_other: '{{count}} unidades perdidas',
  dockedClause_one: "{{count}} nave a la Estación de Reparación",
  dockedClause_other: "{{count}} naves a la Estación de Reparación",
  patchedClause_one: "{{count}} reparada gratis",
  patchedClause_other: "{{count}} reparadas gratis",
  damagedClause_one: "{{count}} vuelve dañada",
  damagedClause_other: "{{count}} vuelven dañadas",
  radiationLostAll_one: "La radiación destruyó tu nave {{way}}",
  radiationLostAll_other: "La radiación destruyó las {{count}} naves {{way}}",
  radiationLost_one: "La radiación destruyó {{count}} nave {{way}} · {{left}} en vuelo",
  radiationLost_other: "La radiación destruyó {{count}} naves {{way}} · {{left}} en vuelo",
  radiationWay: "en el camino",
  radiationWayTo: "camino de {{name}}",
  raidedNothing: 'Allanado · no consiguieron nada',
  /** Taktik geri çekilme, defensor: las naves despegaron, o el depósito no alcanzó. */
  raidedEscaped_one: '{{count}} nave despegó',
  raidedEscaped_other: '{{count}} naves despegaron',
  raidedStranded_one: 'el depósito no alcanzó para {{count}} nave',
  raidedStranded_other: 'el depósito no alcanzó para {{count}} naves',
  /** Taktik geri çekilme, atacante: la línea se vació — nada sobre lo que tenía. */
  raidTargetFled: 'sus naves despegaron',

  raidResultFallback: 'Tu incursión resuelta.',
  raidWiped: '{{target}} retenido · tu flota fue destruida · {{count}} naves perdidos',
  raidResult: '{{grade}} en {{target}} · {{detail}} · {{count}} naves perdidos',
  raidNothing: 'no se ha tomado nada',
  spoilAlloy: '+{{amount}} aleación',
  spoilCrystal: '+{{amount}} cristal',
  spoilDeuterium: '+{{amount}} Deuterio',
  /** What a raid's Garbage Collectors lifted off the wreck — never counted as loot. D200. */
  spoilSalvage: '+{{amount}} recuperación',

  fleetFallback: 'Tu flota está en casa.',
  fleetHomeLooted: 'Inicio de la flota{{where}} · {{count}} naves · +{{amount}} saqueados',
  fleetHomeEmpty: 'Inicio de la flota{{where}} · {{count}} naves · con las manos vacías',
  fleetHomeRecalled: 'Flota en casa{{where}} · {{count}} naves · retirada antes de atacar',
  /** Nothing looted, but the collectors' salvage follows it — so not "empty-handed". */
  fleetHomeBare: 'Inicio flota{{where}} · {{count}} naves',
  /**
   * THE MERCHANT'S OWN HOMECOMING. D166.
   *
   * A swap is not a raid, so it never borrows the plunder wording — and a
   * convoy that bought nothing is a different fact from a fleet that found
   * nothing, which is why the empty case has its own line.
   */
  tradeHome: 'Convoy a casa · {{count}} naves · comprado {{landed}}',
  tradeHomeEmpty: 'Convoy a casa · {{count}} naves · nada comprado',
  /**
   * THE PIRATE LANE HAS ITS OWN HOMECOMING AND ITS OWN EMPTY TRIP. D177.
   *
   * A pirate is not a commander: there is no world to come back FROM by name
   * and no ledger that moved, so these never borrow the raid's wording. And a
   * flight that arrived at nothing is a different fact from one that fought and
   * lost — it names what was gone and how many craft are turning back, and never
   * who got there first.
   */
  targetGonePirate: 'El pirata {{callsign}} ya fue destruido · Los naves {{count}} regresan',
  targetGoneAsteroid: 'La roca fue arrancada antes de que llegaras · {{count}} perforaciones dando vuelta atrás',
  targetGoneDebris: 'El campo del naufragio ya fue limpiado · {{count}} simulacros regresando',
  pirateHome: 'Regreso de los piratas · {{count}} naves · +{{amount}} saqueado',
  pirateHomeEmpty: 'Regreso de los piratas · {{count}} naves · con las bodegas vacías',
  pirateHomeBare: 'Regreso de los piratas · {{count}} naves',
  pirateHomeTowed_looted: 'Regreso de los piratas · {{count}} naves · +{{amount}} saqueado · {{hull}} capturado',
  pirateHomeTowed_empty: 'Regreso de los piratas · {{count}} naves · {{hull}} capturados',
  fleetFrom: 'de {{origin}}',
  probeLost: 'Su sonda se perdió · ese vuelo no se pudo completar',
  recalled: '{{count}} nave regresada · ese vuelo no pudo completarse',
  miningRecalledHome: '{{count}} Inicio de prospectores · recuperación completa',
  transferReturningCapacity: 'Transferencia regresando de {{target}} · capacidad de destino completada en vuelo',
  transferReturningOwnership: 'Transferencia regresando de {{target}} · el mundo cambió de manos en vuelo',

  salvageWord: 'Salvamento',
  oreWord: 'Mineral',
  haulWasted: '{{what}} inicio · sin capacidad disponible · {{amount}} descartado',
  haulNothing: '{{what}} corre a casa · no queda nada que llevar',
  haulPartly: '{{what}} inicio · {{landed}} · {{amount}} perdido, funciona completo',
  haul: '{{what}} inicio · {{landed}}',

  scanDetected: 'Escaneo detectado. Alguien está recopilando información sobre tu mundo.',

  probeFallback: 'Hay una sonda en casa. Su informe es legible.',
  probeHome: 'Inicio de la sonda · {{target}} es legible{{caught}}',
  probeCaught: '· lo pillaron',

  unlock: '{{title}} — {{body}}',
  deathStarFallback: 'Tu ataque a la Estrella de la Muerte resuelto.',
  deathStar: {
    FIRST_STRIKE: 'Impacto EMP · Égida agotada; defensas terrestres desactivadas durante 1 hora',
    CAPTURED: 'Impacto de la Estrella de la Muerte · colonia capturada',
    INEFFECTIVE: 'Impacto de la Estrella de la Muerte · sin efecto',
  },
  colonyCaptured: 'Colonia asegurada · la protección de ocupación está activa',
  colonyLost: "{{planet}} se separó y quedó neutral",
  colonyLostUnnamed: "Una colonia se separó y quedó neutral",
  deathStarColony: "Impacto EMP · lealtad de la colonia {{before}} % → {{after}} %",
  deathStarSeceded: "Impacto EMP · la colonia se separó y quedó neutral",
  colonyFault: '{{planet}} · {{fault}}',
  colonyLoyalty: '{{planet}} se está deslizando - {{count}} cosas rotas y declara independencia en {{time}}.',
  settlementLost: 'Se perdió la carrera por llegar a un acuerdo · los mensajeros y la carga están regresando',
  interceptedDefended: 'Tu red destruyó una unidad de la Estrella de la Muerte {{range}}.',
  interceptedLost: 'Tu Estrella de la Muerte fue destruida {{range}} unidades antes de su objetivo.',
  interceptedFallback: 'Una Estrella de la Muerte fue destruida en vuelo.',
  asteroidShowerStarted: 'Ha comenzado una lluvia de asteroides en la galaxia.',
  asteroidShowerEnded: 'La lluvia de asteroides ha terminado · la generación de asteroides ha vuelto a la normalidad.',
  tradeShipStarted: 'Una nave comercial está en la galaxia · {{alloy}} aleación = 1 deuterio.',
  tradeShipEnded: 'La nave comercial ha abandonado la galaxia.',
  intergalacticConvoyStarted: 'El Convoy Intergaláctico está cruzando la galaxia.',
  intergalacticConvoyEnded: 'El Convoy Intergaláctico ha partido.',
  intergalacticConvoyResult: 'Ataque de convoy resuelta · {{resources}} · premio: {{ships}} · regresando ahora.',
  intergalacticConvoyHome: 'Convoy ataca a casa · {{resources}} · premio: {{ships}}.',
  intergalacticConvoyNoResources: 'sin recursos',
  intergalacticConvoyNoShip: 'sin nave',
} as const;

/**
 * TIME AND NUMBERS.
 *
 * Format primitives rather than sentences: the unit letters a countdown is built
 * from, and the two words that carry a reading's age. Everything here is read by
 * `lib/time.ts`, which is called from a dozen surfaces and must say the same thing
 * on every one of them.
 */
export const units = {
  now: 'ahora',
  live: 'en vivo',
  ago: 'Hace {{duration}}',
  imminent: 'en cualquier momento',
  todayAt: 'Hoy {{time}}',
  yesterdayAt: 'Ayer {{time}}',
  hoursMinutes: '{{h}}h {{m}}m',
  minutesSeconds: '{{m}}m {{s}}s',
  hoursMinutesSeconds: '{{h}}h {{m}}m {{s}}s',
  seconds: '{{s}}s',
  daysHours: '{{d}}d {{h}}h',
  minutes: '{{m}}m',
  /** Which BCP-47 locale groups thousands and formats decimals. */
  numberLocale: 'es-ES',
  thousands: '{{value}}k',
  millions: '{{value}}M',
  percent: '{{value}}%',
  rangeJoin: '–',
  plus: '+',
  minus: '−',
} as const;
