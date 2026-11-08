/** The colony ship's screens. `docs/ux-writing.md` applies. */
export const starter = {
  "advice": {"open": "Otras opciones", "title": "¿Y ahora, comandante?", "recommended": "Recomendado", "close": "Cerrar", "fuel": "Cargar combustible", "huntProbe": "Sondear los puestos", "huntDecide": "Comparar las guardias"},
  "visual": {"probe": "Sonda", "mine": "Extraer", "crate": "Rescate", "collect": "Recoger", "waiting": "En vuelo", "galaxy": "Galaxia principal"},
  "dossier": {"surfaceGapLabel": "Todo sobre esta nave", "surfaceGapMissing": "Nunca has visto esta nave", "surfaceGapWhy": "No ves quién la pilota, cómo van sus reparaciones ni qué lleva. Una sonda lo trae todo de una vez.", "probeGapAged": "Tu lectura de esta nave ha caducado", "probeGapWhy": "Vas a apostar una flota a lo que hay a bordo. Una sonda convierte esa conjetura en un rango.", "fleetGapWhy": "El dato más valioso del juego: una flota ausente no puede defender su nave.", "fleetGapRange": "Alcance {{reach}}; esta nave está a {{distance}}"},
  "reports": {"guardDown": "La guardia ha caído. El puesto avanzado queda abierto {{time}} más: otra flota puede llevarse lo que queda.", "outpost": "un puesto abandonado", "pirates": "piratas", "attackedShip": "Nave atacada: {{planet}}", "walkover": "No había unidades defensoras en tu nave, así que el botín disponible quedó abierto a los atacantes.", "cargoLimited": "Tus bodegas se llenaron. Había más de lo que podías llevar. Trae transportes Courier.", "landing": "Las supervivientes vuelven al hangar con sus daños. Envíalas tú a la Estación de Reparación.", "walkoverBody": "No había unidades defensoras en tu nave. La flota atacante pudo llevarse el botín disponible sin combatir.", "noGroundNote": "Esta nave no tenía ninguna defensa en pie cuando llegaste.", "piratesName": "Piratas", "aegisNote": "El Aegis recibe daño antes que cualquier unidad defensora.", "whyStrong": "Tus {{ships}} superaban a la guardia {{guard}} ({{mult}}).", "whyWeak": "Tus {{ships}} estaban en desventaja ante la guardia {{guard}} ({{mult}}). Contra ella, envía {{answer}}.", "whyEven": "Tus {{ships}} y la guardia {{guard}} estaban igualados ({{mult}}): decidieron el número y la fuerza. Contra ella, {{answer}} tiene ventaja.", "rebuild": "Perdidas: {{ships}}. Reconstruirlas cuesta {{alloy}} de aleación, {{crystal}} de cristal y {{time}}. Tu progreso sigue en pie.", "beatenBy": "{{name}} llegó antes: la guardia ya había caído cuando tu flota aterrizó, así que no cuenta como victoria. Te llevaste lo que quedaba.", "firstVictory": "Tu primera victoria: la caja de victoria te espera en el Astillero.", "whyWon": "Por qué ganaste"},
  "fleetPage": {"roomRule": "Espacio para cada nave que lleva esta nave: en casa, fuera y en el astillero. Un Hangar lleno detiene el astillero; una flota recuperada siempre cabe.", "bays": "Bahías de ataque", "openStation": "Abrir la estación de reparación", "emptyAir": "Nada en vuelo. Toca una nave, una roca o un puesto en la galaxia para enviar naves."},
  "handbook": {"title": "Manual", "replay": "Ver de nuevo los primeros minutos", "repairs": {"title": "Las reparaciones lo abren todo", "body": "Cada reparación abre el siguiente sistema. Va una a la vez y sigue mientras no estás."}, "holds": {"title": "Las máquinas guardan lo que producen", "body": "La producción espera en el Depósito de producción hasta que la recojas en el almacén. La carga de un Prospector también llega allí; lo que no cabe se pierde. Los recursos de la bodega pueden saquearse."}, "sight": {"title": "Mira antes de volar", "body": "El informe de una sonda muestra un momento fijo. Cuanto más viejo, menos dice de ahora."}, "fleets": {"title": "Una flota fuera está a salvo, la nave no", "body": "Las naves en vuelo no se pueden saquear. Tu nave colonia y lo que queda en casa, sí."}, "jump": {"title": "El salto es la meta", "body": "Termina el motor, carga el combustible y lleva las piezas, y aterrizarás en la galaxia principal con tu carga. No hay vuelta atrás."}, "crates": {"title": "Cajas de salvamento", "body": "Algunas reparaciones, y tu primera victoria decisiva sobre un puesto avanzado, liberan cajas. En la pantalla de la nave, mantén pulsada una tapa para abrir todas las cajas listas. Cada una entrega aleación y cristal al almacén una vez. Estos recursos pueden saquearse y respetan el límite del salto: 2.000 de aleación y 1.000 de cristal."}},
  "prologue": {"progress": "Paso {{step}} de {{total}}", "skip": "Saltar", "signIn": "Iniciar sesión", "close": "Cerrar", "alloy": "Aleación {{value}}", "crystal": "Cristal {{value}}", "refinery": "Refinería", "feed": "Línea de sensores", "action": {"power": "Conectar energía de reserva", "burn": "Arrancar la refinería", "collect": "Recoger", "patch": "Parchear la línea de sensores"}, "dark": {"title": "Tu nave está a oscuras.", "body": "El arrecife deshizo la flota y te lanzó aquí. Esa luz de delante es la galaxia a la que ibas."}, "powered": {"title": "La energía de reserva aguanta.", "body": "Los cinco sistemas están dañados. En la cámara fría quedan {{crystal}} de cristal. Toda reparación cuesta aleación, así que primero la refinería."}, "burning": {"title": "El horno prende.", "body": "La primera tanda funciona con las últimas líneas de combustible."}, "batch": {"title": "Primera tanda: {{alloy}} de aleación.", "body": "Una refinería guarda lo que produce hasta que la vacías."}, "collected": {"title": "Los sensores están ciegos.", "body": "No ves quién más ha llegado. Un parche en la línea les devuelve un oído."}, "patching": {"title": "Parcheando la línea…", "body": "Tu primera reparación. Las de verdad siguen mientras duermes."}, "signal": {"mark": "Señal desconocida", "title": "Algo ha respondido.", "body": "Muy lejos, y la antena está demasiado rota para leerlo. Al motor le queda un salto corto.", "replayBody": "Muy lejos, y la antena estaba demasiado rota para leerlo. Lo demás ya lo sabes.", "replayAction": "Volver al juego", "go": "Ir a la señal"}, "hint": {"hold": "Mantén hasta que prenda", "weld": "Mantén para soldar", "claim": "Mantén para empezar"}, "warping": {"title": "Saltando…"}, "found": {"title": "Esta nave puede ser tuya.", "body": "A la deriva tras los bajíos, horno encendido, un oído parcheado. Hazla tuya y empieza la aventura.", "action": "Tomar el timón"}, "claim": {"title": "Esta nave puede ser tuya.", "ship": "esta nave", "intro": "Tu nave empieza con {{alloy}} de aleación, {{crystal}} de cristal y una refinería en marcha. Las reparaciones siguen mientras no estás."}},
  "chatRoom": "Canal de la galaxia",
  "away": {"fell": "{{name}} ha caído", "crateReady": "Tu caja de victoria te espera en el Astillero.", "beaten": "{{by}} llegó a {{name}} antes que tú", "details_one": "Detalles ({{count}})", "details_other": "Detalles ({{count}})", "online": "Volvió a funcionar mientras no estabas: {{systems}}", "lost": "{{value}} sin sitio", "fleetHome": "Flota de vuelta", "fleetHomeDetail_one": "+{{resources}} recursos · {{count}} nave", "fleetHomeDetail_other": "+{{resources}} recursos · {{count}} naves", "haulAlloy": "+{{value}} de aleación", "haulCrystal": "+{{value}} de cristal", "haulDeuterium": "+{{value}} de deuterio", "ships_one": "{{count}} nave", "ships_other": "{{count}} naves", "toShip": "Ir a la nave"},
  "launchFleetsave": "Las naves en vuelo no pueden ser saqueadas. Tu nave colonia sí.",
  "contact": {"scout": "Explorador pirata", "scoutDetail": "Viene a mirar, no a luchar. La próxima vez quizá no venga solo.", "raid": "Incursión pirata"},
  "outpostGuide": "Ir al puesto {{name}}",
  "outpostReading": {"guard": "Guardia", "none": "Sin guardia", "unread": "Clases sin leer", "even": "Clases iguales", "most": "mayoritaria", "beats": "› vence a la siguiente · ↺ {{last}} › {{first}}", "carry": "Puedes llevar", "stock": "{{band}} en reserva", "crate": "Tu primera victoria decisiva abre una caja"},
  "outpost": {"title": "Puesto abandonado", "rule": "Vence a su guardia y llévate hasta {{amount}} recursos; tus naves cargan {{carry}}. Se rellena en 6 horas.", "label": "Puesto · nivel {{level}}"},
  "readout": {"ships": "{{count}} naves", "outposts": "{{count}} puestos", "level": "Guardia nivel {{level}}", "firstHunt": "Primera caza · {{level}}"},
  "lab": {"premise": "Esta investigación se queda con la nave. No viaja contigo a la galaxia principal.", "holdsRole": "Aumenta la capacidad de carga de los Prospectores.", "queue": "Investigación de la nave", "queueHint": "La nave trabaja en un proyecto a la vez. Las reparaciones y el astillero siguen por separado.", "idleHint": "Elige una estrella en el mapa.", "queueFull": "La nave trabaja en un proyecto a la vez. Espera a que termine este."},
  "deck": {"label": "Cubiertas de la nave", "repairs": "Reparación", "yard": "Astillero", "research": "Investigación"},
  "yard": {"against": "Contra", "queue": "Cola del astillero", "dockRule": "La Estación cobra el {{percent}} % del precio principal.", "dockHurt": "{{count}} naves necesitan la Estación", "dockGo": "Reparar {{count}} naves"},
  "board": {"title": "Salidas", "empty": "Nadie ha saltado todavía. Podrías ser el primero.", "ago": "hace {{time}}"},
  "mainRow": {"facts": "{{worlds}} mundos. La temporada termina en {{days}} días.", "waiting": "Viene una nueva temporada.", "repair": "Repara el motor para saltar allí. Nada más cruza el vacío.", "ready": "Tu nave está lista. Abre el Motor para saltar.", "eyebrow": "Tu destino", "story": "Adonde iba la flota antes de que el arrecife la dispersara. El verdadero viaje empieza aquí: mundos que defender, rivales, clanes, una temporada que ganar.", "legRepair": "Listo para partir", "legFuel": "Combustible del salto", "go": "Ir a la nave"},
  "plan": {"title": "Plan de salida", "done": "Reparado", "queued": "En cola · listo en {{time}}", "open": "Se puede reparar · tarda {{time}}", "waiting": "Espera: {{what}}", "fuelAt": "{{have}}/{{needed}} a bordo · lleno en {{time}}", "fuelNow": "{{have}}/{{needed}} a bordo · basta para el salto", "fuelNoPlant": "{{have}}/{{needed}} a bordo · {{name}} inicia la producción", "lever": "Con {{name}} 2: lleno en {{time}}", "flights": "Los tiempos valen si no gastas Deuterio en vuelos.", "waitsFuel": "Lo que retiene el salto es el combustible.", "waitsEngines": "Lo que retiene el salto son los motores: el combustible llega antes.", "optional": "Quedan {{count}} reparaciones opcionales. Solo sirven a bordo: tu capital empieza con sus propios edificios."},
  "outlook": {"noFrontier": "Ahora ninguna galaxia tiene sitio. Tu nave sigue jugando aquí, y el salto se abre cuando quede un sitio.", "seasonClosed": "Esta temporada ya no admite naves: termina en {{days}} días. Tu nave aterrizará en la siguiente, y una nave lista recibe aviso cuando empieza. Hasta entonces, los puestos y las reparaciones aún rinden aquí.", "seasonLate": "Esta temporada deja de admitir naves en {{time}}, antes de que acabe tu plan: la nave aterrizará en la siguiente. Si terminas antes, aterriza en esta."},
  "arrival": {"carried": "Bajó contigo", "package": "Inicio de primera temporada", "total": "Disponible", "ships": "{{count}} naves", "decide": "Tu primera jugada", "outward": "Planear una primera salida", "outwardLine": "Tu flota y {{deuterium}} de Deuterio están listos. Sondea antes un objetivo.", "grow": "Abrir la producción de Deuterio", "growLine": "Aquí tu producción de Deuterio es cero. Investiga {{research}} y luego construye la {{plant}}: alimenta tus vuelos."},
  "readyLabel": "Listo para partir",
  "wholeShip": "Todos los sistemas {{done}}/{{total}}",
  "jump": {"panel": "El salto", "parts": "Piezas de empuje", "partsHint": "Están en restos y puestos vigilados. Quien llega primero se lleva la pieza.", "tank": "Depósito", "tankLocked": "El depósito se conecta con el montaje de empuje y la planta de Deuterio 2.", "tankHint": "El salto quema {{needed}} de Deuterio. Los vuelos gastan del mismo stock.", "load": "Cargar {{amount}}", "loadAll": "Cargar todo", "go": "Preparar el salto", "title": "Salto a {{name}}", "addresses": "Dónde aterrizar", "neighbours": "Mundos cerca: {{count}}", "tone": {"quiet": "Tranquilo", "mixed": "Intermedio", "busy": "Concurrido"}, "toneNote": {"quiet": "Más seguro. Objetivos lejos.", "mixed": "Un poco de ambos.", "busy": "Objetivos cerca, y tú eres uno."}, "cargo": "La bodega baja con", "package": "También recibes el paquete de primera temporada y un escudo de 72 horas.", "carryMost": "Un salto lleva como máximo {{alloy}} de aleación, {{crystal}} de cristal, {{deuterium}} de Deuterio y {{ships}} naves.", "left": "Se queda y se pierde: {{alloy}} de aleación, {{crystal}} de cristal, {{deuterium}} de Deuterio, {{ships}} naves.", "warn": "La nave se consume en este salto. Los recursos y naves fuera de la bodega se pierden.", "hold": "Saltar", "leaving": "Partiendo…", "replay": "Ver de nuevo", "skip": "Saltar", "scene": {"lit": "Motor encendido", "leaving": "Saliendo de los bajíos", "gap": "Cruzando el vacío", "fall": "{{name}}", "world": "Tu mundo"}, "partsSeen": "Tus escáneres muestran {{count}} lugares. Están marcados en el mapa.", "partsLater": "Aparecen en el mapa cuando el casco del motor se puede reparar.", "partsNone": "Ninguna a la vista: envía una sonda a un pecio o un puesto.", "partHere": "Aquí hay una pieza de empuje. Se la lleva quien llegue primero."},
  "landing": {"dismiss": "Cerrar", "title": "Has aterrizado en {{name}}", "go": "A mi mundo", "line": {"battle": "Las batallas son el doble de duras, y el Aegis está a plena potencia.", "shield": "Tu escudo dura 72 horas.", "absence": "Si faltas 3 días, tu planeta se borra.", "core": "El Núcleo fija el nivel de tu mundo.", "opened": "El clan y las clasificaciones están abiertos.", "alerts": "Los avisos al móvil ahora llegan del Centro de Notificaciones."}, "tip": {"core": "El Núcleo fija tu nivel. Solo atacas cerca de él, y te atacan igual.", "colony": "Puedes tener hasta tres colonias. Los mundos neutrales se abren un rato para reclamarlos.", "clan": "Un clan comparte información y defiende unido. Mira la pestaña Clan.", "dominion": "Dominion clasifica a quien más tiene. Paga al final de la temporada.", "honor": "Honor clasifica a quien lucha limpio. Atacar a una flota débil da poco."}},
  "shieldNote": "Los escudos de las naves empiezan cada batalla llenos. Los daños del casco siguen hasta que la Estación de Reparación los arregla.",
  "tempoNote": "Aquí el daño y el Aegis son la mitad. En la galaxia principal la misma batalla va el doble de rápido.",
  "intel": {"blind": "No puedes ver el interior de ninguna nave", "openShip": "Abrir nave", "telescopeGives": "Muestra si la flota de la nave observada ha salido. Antes de atacar, valora la antigüedad de la lectura y lo que quedó allí.", "telescopeCost": "Repara el Telescopio de tu nave.", "idleHint": "Ranuras libres: {{count}}. Elige una nave en el mapa y apunta una hacia ella.", "scarcity": "Naves ahí fuera: {{neighbours}}. Tus ranuras: {{count}}. Cambiar de objetivo tiene espera, así que elige bien.", "radarGives": "Muestra el movimiento en alcance y cuándo llega una amenaza dirigida a tu nave. Puede detectar sondas, aunque no siempre.", "radarCost": "Repara el Radar de tu nave.", "nextSlot": "Reparación {{level}}", "oneMore": "La reparación {{level}} del telescopio vigila una nave más.", "radarLevel": "Radar · reparación {{level}}", "radarFleets": "La reparación {{level}} del radar distingue una amenaza contra ti a {{sense}} unidades, sin reloj. A {{warn}} unidades añade la hora de llegada.", "radarFleetsOne": "La reparación {{level}} del radar muestra naves en movimiento hasta {{sense}} unidades y marca con su hora de llegada una amenaza contra tu nave.", "radarBearing": " La reparación 2 añade de qué dirección vinieron.", "radarQuiet": "No se detectaron escaneos. Tu radar está activo.", "scaleNote": "Cada barra empieza en cero: la banda es su estimación y la línea turquesa, tu nave.", "home": "Volar a tu nave"},
  "news": {"victoryCrateOpened": "Caja de victoria abierta: +{{alloy}} aleación, +{{crystal}} cristal.", "crateOpened_one": "Caja de rescate abierta: +{{alloy}} aleación, +{{crystal}} cristal.", "crateOpened_other": "{{count}} cajas de rescate abiertas: +{{alloy}} aleación, +{{crystal}} cristal.", "mineHome_one": "Tu Prospector ha vuelto con {{brought}}: todo está en el depósito de producción.", "mineHome_other": "Tus {{count}} Prospectors han vuelto con {{brought}}: todo está en el depósito de producción.", "mineLost_one": "Tu Prospector ha vuelto con {{brought}}: {{landed}} entraron en el depósito de producción, {{lost}} no encontraron sitio y se perdieron.", "mineLost_other": "Tus {{count}} Prospectors han vuelto con {{brought}}: {{landed}} entraron en el depósito de producción, {{lost}} no encontraron sitio y se perdieron.", "mineEmpty_one": "Tu Prospector ha vuelto vacío: no quedaba nada que llevarse.", "mineEmpty_other": "Tus {{count}} Prospectors han vuelto vacíos: no quedaba nada que llevarse.", "minePart": "También encontró una pieza de empuje.", "repairDone": "{{name}} reparado.", "probeReport": "Informe de sonda de {{name}}.", "probeDetected": "Una sonda ha escaneado tu nave.", "radarPast": "Radar: llegó una flota.", "shieldPast": "Tu escudo cayó.", "radar": "Radar: una flota llega en {{time}}.", "raidOver": "Tu ataque a {{name}} ha terminado. Lee el informe.", "firstVictory": "¡{{name}} ha caído! Tu caja de victoria te espera en el Astillero.", "beatenBy": "{{by}} llegó a {{name}} antes que tú: la guardia ya había caído. Lee el informe.", "attacked": "{{name}} atacó tu nave. Lee el informe.", "fleetHome": "Tu flota ha vuelto.", "fleetHomePart": "Tu flota ha vuelto con una pieza de empuje.", "turnedBack": "El objetivo estaba fuera de alcance. Tu flota da la vuelta.", "yardDone": "Astillero: {{count}} {{name}} listas.", "researchDone": "{{name}} alcanzó el nivel {{level}}.", "dockDone": "La Estación de Reparación ha terminado. Tus naves están sanas.", "shieldWarning": "Tu escudo cae en {{time}}.", "seasonOpen": "Hay una nueva temporada abierta en {{name}}. Tu nave puede saltar."},
  "reading": {"repairLabel": "Reparaciones", "repairNote": "Cuánto de esta nave está reparado. Cuanto más avance, más ha acumulado y más cerca está de irse.", "unknownShip": "Nave desconocida"},
  "systemShort": {"REFINERY": "Refinería", "SURVEY": "Sondeo", "DEFENCE": "Defensa", "CARGO": "Carga", "DRIVE": "Motor"},
  "systemsLabel": "Sistemas de la nave",
  "locked": "bloqueado",
  "perHour": "/h",
  "moreRepairs": "Más reparaciones", "nextRepairs": "Reparaciones",
  "slots": "Puestos",
  "stepState": {"done": "reparado", "queued": "en cola", "closed": "bloqueado", "open": "listo"},
  "quiet": {"warn": "Repara en {{time}} o tu nave dejará su lugar en esta galaxia.", "asleep": "Tu nave dejó su lugar tras {{hours}} horas sin reparaciones. Inicia una reparación para volver a tener uno."},
  "queue": {"title": "Cola de reparación"},
  "eyebrow": "Nave colonia",
  "goal": "Repara todos los sistemas, llena el tanque de combustible y salta a la galaxia principal.",
  "next": "Siguiente",
  "tutorial": {"skip": {"link": "No necesito la guía", "title": "¿Cerrar la guía?", "body": "¿Seguro que quieres cerrar la guía? El oficial dejará de guiarte. Puedes volver a activar la guía desde Academia en el menú. Tu partida continúa donde la dejaste.", "keep": "Continuar con la guía", "close": "Cerrar la guía", "again": "Volver a activar la guía", "againHint": "El oficial explorador vuelve a acompañarte"}, "inspect": "Examinar el vuelo", "chapter": {"1": "Despertar", "2": "Primeras reparaciones", "4": "La primera sonda", "6": "La primera carga", "7": "Telescopio", "8": "Radar"}, "next": "Siguiente", "reveal": "Mostrar el mensaje completo", "away": "Te llamaré cuando termine, hacia las {{clock}}. Mientras tanto, explora tu nave y la galaxia.", "ok": "OK", "back": "Vuelvo en {{time}}", "reopen": "Mostrar la guía", "nav": {"openShip": "Abre la nave: toca {{base}}.", "closePage": "Cierra esta página. Lo siguiente está en la galaxia.", "dismissUnlock": "Un sistema acaba de activarse. Lee su tarjeta y ciérrala para continuar."}, "line": {"online": "¡Comandante, la radio funciona! Soy el oficial explorador de la flota. El arrecife dispersó la flota, pero esta nave ahora es tuya. Arrastra la pantalla para verla desde todos los ángulos. La refinería vuelve a funcionar, y eso es aleación para las reparaciones: toca {{try}} en la tarjeta.", "collect": "Lo que produjo la refinería espera en el Depósito de producción. Para gastarlo, pásalo al almacén: toca la línea del Depósito de producción en la barra superior.", "orderRefinery": "Cada reparación se paga con aleación y cristal. Primero {{name}}: cuanto más fuerte sea, más rápido va todo. Toca {{repair}}.", "waitFirst": "Las reparaciones avanzan solas, hasta {{count}} a la vez. Esta tarda diez segundos; las grandes tardan horas y siguen mientras no estás.", "firstCrate": "La reparación abrió una bodega sellada: dentro hay una caja de rescate llena de aleación y cristal. Todo es tuyo. Mantén pulsada la caja para abrirla.", "openIntel": "Llegó el informe. Toca la pestaña {{intel}} de abajo.", "openReport": "Aquí está todo lo que sabemos. Toca la nave que sondeamos para abrir su informe.", "report": "Este es el informe de la sonda. La parte iluminada es lo que una victoria podría llevarse; debajo, sus naves. Nunca enviamos una flota sin leer esto.", "farewell": "Tu primera carga está a bordo. {{underway}} Podrás pagar la siguiente reparación en unos {{time}}. Te dejo los mandos. La línea del siguiente paso te guiará.", "mine": "Nuestro primer Prospector está listo. Toca el siguiente paso para encontrar el asteroide más cercano y envíalo a minar.", "mineFlying": "Observa al Prospector cruzar la galaxia. Minará y volverá a casa. Regreso previsto: {{clock}}.", "collectMine": "¡El Prospector ha vuelto! Su carga espera en el Depósito de producción. Recógela desde la barra superior.", "telescopeRing": "Hay un vuelo dentro del anillo de tu telescopio. El anillo es lo que ves: cada nave y flota dentro queda identificada.", "telescopeTraffic": "Toca el vuelo: lee de quién es y adónde va.", "telescopeTrack": "Mira: el vuelo salió del anillo y aún ves su rumbo. Un vuelo identificado una vez se sigue hasta el final.", "radarRing": "¡Tu radar ha captado algo! El anillo verde es su alcance: detecta vuelos que tu telescopio no ve.", "radarContact": "Un ? indica un movimiento desconocido. Una flota que viene hacia ti aparece aquí antes de llegar a tu nave.", "sightTrio": "El telescopio identificó el vuelo que entró en su anillo. La sonda lee el interior de un objetivo, el telescopio identifica el movimiento, el radar avisa."}, "push": "¿Te aviso cuando termine una reparación y alguien se acerque a tu nave?", "allow": "Avísame", "later": "Más tarde", "hint": "¿Necesitas un rumbo? {{task}} Toca el siguiente paso para avanzar.", "dismiss": "Entendido", "noneFlying": "Ahora no hay vuelos en marcha.", "flight": "Un vuelo sigue en camino. Regreso previsto: {{clock}}."},
  "outcome": {"DECISIVE": "Puesto tomado", "PARTIAL": "Resultado parcial", "REPELLED": "Rechazado", "BEATEN": "Alguien llegó antes", "beaten": "{{by}} llegó antes; la guardia ya había caído. Te llevaste lo que quedaba.", "crate": "¡Tu primera victoria! Tu caja de victoria te espera en el Astillero.", "line": {"DECISIVE": "La guardia está rota. Por qué ganaste, en el informe.", "PARTIAL": "Cayó parte de la guardia. Lo que faltó, en el informe.", "REPELLED": "La guardia resistió. El porqué, en el informe."}, "lost_one": "{{count}} nave perdida", "lost_other": "{{count}} naves perdidas", "lootHome": "El botín llega al almacén cuando vuelve la flota.", "ok": "OK", "report": "Leer el informe", "openCrate": "Abrir la caja"},
  "objective": {"probe": "Envía una sonda a la nave más cercana. Toca para encontrarla.", "mine": "Envía un Prospector al asteroide más cercano. Toca para encontrarlo.", "underwayProbe": "Tu sonda va en camino. Su informe llegará a Inteligencia.", "underwayMine": "El Prospector está minando. Vuelve solo.", "restSave": "Eso es todo por ahora. Vuelve hacia las {{clock}} para: {{name}}.", "restWait": "Eso es todo por ahora. La reparación termina hacia las {{clock}}.", "repair": "Repara: {{name}}. Abre la nave.", "collect": "Recoge lo que han producido los talleres, desde la barra superior.", "save": "{{name}}: podrás pagarlo en unos {{time}}.", "saveNever": "{{name}}: repara lo que produce el recurso que falta.", "wait": "Hay una reparación en curso. Lista en {{time}}.", "parts": "Encuentra {{count}} piezas de empuje. Las tienen los restos y los puestos vigilados.", "fuel": "Llena el tanque de combustible en el motor.", "huntProbeMining": "El Prospector va en camino. Mientras tanto hay dos puestos piratas; no atacamos sin conocer su guardia. Envía una sonda.", "huntProbe": "Hay dos puestos piratas; no atacamos sin conocer su guardia. Envía una sonda.", "huntProbing": "Las sondas van en camino. Cuando vuelvan, leeremos las guardias.", "huntDecide": "Llegaron los informes: compara las dos guardias y elige tus naves.", "huntRaid": "Tu flota vuela al puesto. El combate será a la llegada."},
  "log": {"title": "Cuaderno de bitácora", "now": "Ahora", "go": "Ir", "chapter": {"POWER": {"title": "Energía", "line": "La reserva aguanta. La nave está despierta."}, "REFINERY": {"title": "Refinería", "line": "Produce aleación y cristal. Cada reparación se paga con ellos."}, "SURVEY": {"title": "Exploración", "line": "La antena: sondas, informes y la pestaña de Inteligencia."}, "DEFENCE": {"title": "Defensa", "line": "Aegis, telescopio y radar: ver venir los asaltos y resistirlos."}, "CARGO": {"title": "Carga", "line": "Astillero y hangar: tus primeras naves y la pestaña Flota."}, "DRIVE": {"title": "Motor", "line": "Piezas de empuje, casco del motor y combustible: el salto a la galaxia principal."}}},
  "repair": "Reparar",
  "stepCount": "Etapa {{stage}} de {{total}}",
  "optional": "Opcional · no cuenta en el % de reparación",
  "inQueue": "En cola",
  "systemAria": "{{name}}: {{done}} de {{total}} reparaciones, {{state}}",
  "needs": "Necesita: {{what}}",
  "queueFull": "La cola de reparación admite {{count}}. Espera a que termine una.",
  "affordIn": "Podrás pagarlo en unos {{time}}.",
  "collectFirst": "Recoge desde la barra superior para pagar esto.",
  "noIncome": "Aún nada produce este recurso. Repara lo que lo produce.",
  "allQueued": "Todas las reparaciones obligatorias están hechas o en cola.",
  "allRepaired": "Todas las reparaciones obligatorias están hechas.",
  "ordered": "{{name}}: reparación encargada",
  "state": {
    "broken": "Averiado",
    "damaged": "Dañado",
    "done": "Reparado"
  },
  "system": {
    "REFINERY": "Módulo de refinería",
    "SURVEY": "Antena de exploración",
    "DEFENCE": "Sistemas de defensa",
    "CARGO": "Carga y hangar",
    "DRIVE": "Motor interestelar"
  },
  "module": {
    "SURVEY": "Antena de exploración",
    "DRIVE_HULL": "Casco del motor",
    "DRIVE_THRUST": "Montaje de empuje"
  },
  "fact": {
    "FIRST_PROBE_REPORT": "tu primer informe de sonda",
    "FIRST_MINING_RETURN": "tu primer regreso de minería",
    "FIRST_BATTLE_REPORT": "tu primer informe de batalla",
    "FIRST_OUTPOST_VICTORY": "tu primera victoria sobre un puesto avanzado"
  },
  "factHow": {"FIRST_PROBE_REPORT": "Envía una sonda a una nave vecina.", "FIRST_MINING_RETURN": "Envía un Prospector a un asteroide y espera a que vuelva.", "FIRST_BATTLE_REPORT": "Asalta un puesto avanzado o enfréntate a los piratas cuando la Aegis esté activa. El informe de esa batalla cuenta.", "FIRST_OUTPOST_VICTORY": "Vence a la guardia de un puesto avanzado con una victoria decisiva."},
  "attackLocked": "Para atacar naves necesitas tu Aegis reparada y una batalla a tus espaldas. Con la Aegis activa, tu nave también puede ser atacada.",
  "aegisChoice": {"title": "Tú eliges", "hold": "Reparar la Aegis", "with": "Con la Aegis", "withShield": "El escudo recibe el daño primero.", "withPirates": "Los piratas empiezan a venir.", "withNeighbours": "Tras {{hours}} h, tus vecinos pueden atacarte.", "withAttack": "Tras una batalla, tú también puedes atacar naves.", "without": "Sin ella", "withoutSafe": "Ni piratas ni vecinos pueden atacarte.", "withoutOutposts": "Solo asaltas puestos avanzados.", "withoutJump": "No hace falta para partir."},
  "outpostLocked": "Los asaltos a puestos avanzados se abren con el Astillero. Repáralo y las naves que construya podrán atacar aquí.",
  "partsNeeded": "{{count}} piezas de empuje",
  "effect": {
    "rate": {
      "alloy": "+{{amount}} de aleación por hora",
      "crystal": "+{{amount}} de cristal por hora",
      "deuterium": "+{{amount}} de deuterio por hora"
    },
    "ships": "Incluye {{ships}}",
    "deuterium": "Incluye {{amount}} de deuterio",
    "room": "Espacio de hangar {{room}}",
    "storeCeiling": "Límite de aleación {{from}} → {{to}}",
    "telescope": "Alcance del telescopio {{distance}}",
    "radar": "Alcance del radar {{distance}}",
    "aegis": "Aegis {{hp}}",
    "surveyBand": "Las sondas leen un rango más estrecho",
    "driveHull": "Sostiene el montaje de empuje",
    "driveThrust": "Añade el tanque de combustible"
  },
  "feature": {
    "production": {
      "gain": "Abre la producción",
      "line": "La refinería produce aleación. Recógela desde la barra superior."
    },
    "intel": {
      "gain": "Abre las sondas",
      "line": "Las naves vecinas aparecen como puntos oscuros. Una sonda muestra lo que tiene una de ellas."
    },
    "fleet": {
      "gain": "Abre la flota",
      "line": "Puedes construir naves, enviar un Prospector a minar asteroides, asaltar puestos avanzados y reparar naves dañadas en la Estación de reparación."
    },
    "chat": {
      "gain": "Abre el chat",
      "line": "Puedes hablar con las demás naves de esta galaxia."
    },
    "salvage": {
      "gain": "Abre los campos de restos",
      "line": "Los campos de restos ya aparecen en el mapa. Un Prospector puede recogerlos."
    },
    "research": {
      "gain": "Abre la investigación",
      "line": "La investigación mejora tus naves y las bodegas del Prospector. Termina con esta nave."
    },
    "telescope": {
      "gain": "Abre el telescopio",
      "line": "Dentro de su anillo ves otras naves y sus vuelos."
    },
    "radar": {
      "gain": "Abre el radar",
      "line": "Dentro de su anillo, un vuelo aparece como contacto desconocido y te avisa."
    },
    "defence": {
      "gain": "Abre la defensa",
      "line": "La Aegis absorbe el daño primero. Los piratas y otras naves ya pueden atacar esta nave; tras una batalla, tú también puedes atacar naves."
    },
    "attack": {
      "gain": "Abre los ataques",
      "line": "Puedes atacar naves con la Aegis activa. Ellas también pueden atacarte."
    },
    "deuterium": {
      "gain": "Abre el deuterio",
      "line": "Los vuelos queman deuterio, y esta refinería lo produce."
    },
    "drive": {
      "gain": "Abre el panel del motor",
      "line": "Las piezas de empuje ya aparecen en el mapa. El motor necesita {{count}}."
    },
    "migration": {
      "gain": "Abre el salto",
      "line": "El tanque está lleno. Esta nave puede saltar a la galaxia principal."
    }
  },
  "funnel": {"title": "Recorrido inicial", "sessions": "{{accounts}} cuentas · {{sessions}} sesiones · {{returned}} regresaron para una segunda sesión", "push": "Push: {{asked}} solicitudes · {{granted}} permisos · {{denied}} rechazos", "crates": "Cajas: {{opened}} abiertas por {{accounts}} cuentas", "chain": "Cadena de órdenes: {{accepted}} cuentas dieron una orden → {{resolved}} recibieron el resultado → {{viewed}} lo vieron → {{decided}} volvieron a ordenar", "haul": "Primer regreso minero: {{returned}} cuentas · {{gained}} con ganancia neta · {{wasted}} perdieron parte por instalaciones llenas", "steps": "Pasos y abandono", "dropoff": "{{accounts}} llegaron · {{dropoff}} menos que antes"},
  "crate": {"victory": "Caja de la primera victoria", "title_one": "Caja de rescate", "title_other": "{{count}} cajas de rescate", "hold": "Mantén pulsado para abrir y tomar", "open": "Abrir: {{purse}}"},
  "unlock": {
    "online": "{{system}} en línea",
    "try": "Probar",
    "later": "Luego"
  },
  "tab": {
    "repair": "Repara {{module}} para abrir esto.",
    "mainGalaxy": "Esto se abre en la galaxia principal."
  }
};
