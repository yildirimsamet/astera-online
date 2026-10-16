import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, useGLTF } from '@react-three/drei';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import * as THREE from 'three';
import { I18nextProvider } from 'react-i18next';
import i18n from '../i18n/index.js';
import { RadiationBombForge, RadiationBombLaunchPanel } from '../screens/RadiationBombControls.js';
import { RadiationIndicator } from '../ui/RadiationIndicator.js';
import { PlanetRadiationProtection } from '../ui/PlanetRadiationProtection.js';
import { HullStats } from '../screens/PlanetScreen.js';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RadiationBombEffects } from '../galaxy/RadiationBombEffects.js';
import { Hull } from '../galaxy/Fleets.js';
import { radiationAtTarget } from '../lib/targetRadiation.js';
import { useNow } from '../lib/time.js';
import { hpRadiationSourceSchema, galaxySchema } from '../api/schemas.js';
import { planetNodes } from '../galaxy/scene.js';
import { RadiationBombExhaust } from '../galaxy/StrategicExhaust.js';
import { RADIATION_BOMB_VISUAL, toWorld, visualLeg, toGame } from '@astera/rules';
import { planetView } from '../../test/fixtures.js';
import '../styles.css';

// Dev-only review surface, served like v2-gallery.html and omitted from the production entry.
const language = new URLSearchParams(location.search).get('lng') ?? 'tr';
const aegisExample = new URLSearchParams(location.search).has('aegis');
const previewLevels = aegisExample ? [1, 1] as const : [1, 2, 3] as const;
void i18n.changeLanguage(language);
const target = { kind: 'PLANET' as const, id: 'preview-planet' };
const nodes = planetNodes([galaxySchema.shape.planets.element.parse({ id: target.id, isSelf: false,
  position: { x: 0, y: 0, z: 0 }, coreTier: 4, coreLevel: 12, name: 'Asterion', owner: 'Preview',
  satellites: [], shielded: false, intel: 'RESOLVED', state: { kind: 'NORMAL' } })]);
const world = planetView({ radiationBombsAvailable: true, radiationBombs: [], buildings: { CORE: 13, SHIPYARD: 5 } });
const protectedWorld = planetView({ instruments: { AEGIS: 10 } }, { shield: 500,
  radiationProtectionHpPerMinute: 10, radiationProtectionLevel: 10 });
const previewClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const launchWorld = planetView({ radiationBombsAvailable: true, buildings: { CORE: 13, SHIPYARD: 5 },
  radiationBombs: ([1, 2, 3] as const).map(level => ({ id: `preview-stock-${String(level)}`, level,
    status: 'READY', readyAt: null, remainingSeconds: 0 })) });

function StudioLight() {
  const { gl, scene } = useThree();
  useEffect(() => {
    const room = new RoomEnvironment();
    const generator = new THREE.PMREMGenerator(gl);
    const environment = generator.fromScene(room, .04);
    const previous = scene.environment;
    scene.environment = environment.texture;
    room.dispose(); generator.dispose();
    return () => { scene.environment = previous; environment.dispose(); };
  }, [gl, scene]);
  return null;
}

function Body() {
  const { scene } = useGLTF('/assets/models/planets/country/planet_turkey.glb');
  const body = useMemo(() => {
    const clone = scene.clone(true);
    const box = new THREE.Box3().setFromObject(clone);
    const centre = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const group = new THREE.Group(); group.add(clone); clone.position.sub(centre);
    group.scale.setScalar(nodes[0]!.radius * 2 / Math.max(size.x,size.y,size.z));
    return group;
  },[scene]);
  return <primitive object={body} />;
}
function Missile({ level, start, hit }: { level: 1|2|3; start: number; hit: number }) {
  const ref = useRef<THREE.Group>(null);
  const style = RADIATION_BOMB_VISUAL[level];
  const route = useMemo(() => {
    const drawn = visualLeg(toGame([-5,.15,0]), toGame([0,0,0]), 0, nodes[0]!.radius + style.length / 2);
    return { from: toWorld(drawn.from), to: toWorld(drawn.to) };
  },[style.length]);
  useFrame(() => {
    const age = (Date.now()-start)/1000;
    const t = age/(hit/1000);
    if (!ref.current) return;
    ref.current.visible = t>=0 && t<1;
    ref.current.position.set(route.from[0]+(route.to[0]-route.from[0])*t,
      route.from[1]+(route.to[1]-route.from[1])*t,0);
    ref.current.lookAt(...route.to);
  });
  return <group ref={ref} name={`bomb-preview-flight-${String(level)}`} userData={{level, length:style.length, hitAt:start+hit}}>
    <Hull url={`/assets/models/missiles/radiation-bomb-l${String(level)}.glb`} scale={style.length} glow={style.glow} focused={false} fog={false}/>
    <RadiationBombExhaust level={level}/>
  </group>;
}
function Preview() {
  const [start,setStart] = useState(() => Date.now());
  const now = useNow(100);
  const sources = useMemo(() => previewLevels.map((level,index) => hpRadiationSourceSchema.parse({
    id:`preview-hit-${String(index)}`, origin:'BOMB', mode:'EMIT', target, level,
    center:{x:0,y:0,z:0},radius:1,intensityHpPerMinute:({ 1: 9, 2: 12.5, 3: 18 })[level],
    activeFrom:new Date(start+2500+index*2000),activeUntil:new Date(start+1802500+index*2000),totalCapFrom:new Date(start),
  })),[start]);
  const state = radiationAtTarget(target,sources,now,aegisExample ? {} : {RADIATION_SHIELDING:2},aegisExample ? 10 : 0);
  return <main className="bomb-preview">
    <header><span>ASTERA ONLINE · ÖNİZLEME</span><h1>Radyasyon Bombası</h1><p>M1 gövde · Yüzeyde plazma darbesi · Radyasyon sisi</p></header>
    <div className="bomb-preview__scene"><Canvas camera={{position:[-1.2,1.6,7],fov:42}} gl={{antialias:true}}
      onCreated={({scene})=>{Object.assign(window,{__bombPreviewScene:scene,__bombPreviewRadius:nodes[0]!.radius});}}>
      <color attach="background" args={['#060b12']}/><ambientLight intensity={.45}/>
      <directionalLight position={[-3,4,5]} intensity={3}/><directionalLight position={[4,0,-1]} color="#9bb6d4" intensity={1.5}/>
      <StudioLight/><Suspense fallback={null}><Body/>
        {previewLevels.map((level,i) => <Missile key={`${String(start)}:${String(i)}`} level={level} start={start+i*2000} hit={2500}/>)}
        <RadiationBombEffects sources={sources} nodes={nodes} monuments={[]}/>
      </Suspense><OrbitControls enablePan={false} minDistance={3} maxDistance={12}/>
    </Canvas>
      <div className="bomb-preview__bar">{state&&<RadiationIndicator state={state} variant="bar" now={now}/>}</div>
      <div className="bomb-preview__dial">{state&&<RadiationIndicator state={state} variant="dial" now={now}/>}</div>
      <button type="button" className="bomb-preview__replay" onClick={()=>{setStart(Date.now());}}>↻ Yeniden oynat</button>
    </div>
    <aside className="flex flex-col gap-3"><RadiationBombForge planet={world} held={{alloy:100000,crystal:100000,deuterium:100000}} now={now} pending={false} onBuild={()=>undefined}/>
      <RadiationBombLaunchPanel origin={launchWorld} target={target} targetName="Asterion" flightMs={60000}
        pending={false} onLaunch={()=>undefined}/>
      <div data-radiation-protection-preview className="rounded-control border border-v2-line bg-v2-panel p-3">
        <HullStats hull="DART" tech={{ RADIATION_SHIELDING: 2 }} />
        <PlanetRadiationProtection planet={protectedWorld} />
      </div>
    </aside>
  </main>;
}
createRoot(document.getElementById('root')!).render(<I18nextProvider i18n={i18n}><QueryClientProvider client={previewClient}><Preview/></QueryClientProvider></I18nextProvider>);
