import { useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { PerspectiveCamera, Vector3 } from 'three';
import { useTranslation } from 'react-i18next';
import { toWorld } from '@astera/rules';
import type { PlanetNode } from '../../galaxy/scene.js';
import { serverNow } from '../../lib/clock.js';
import { schoolFrameRange, schoolTransitPose, schoolCameraFit, type SchoolFrame, type SchoolTransit } from './visualStory.js';
import { schoolCopy } from './copy.js';
import { markHit, wasTap } from '../../galaxy/tap.js';

/** Authored camera moves keep discovery and a short journey readable on a phone.
 * They use the same worlds, sensor state, craft and clock as the normal renderer. */
export function SchoolCamera({ frame, transit, nodes, onSelect }: { frame?: SchoolFrame; transit?: SchoolTransit; nodes: readonly PlanetNode[]; onSelect: (id: string) => void }) {
  const { i18n } = useTranslation();
  const copy = schoolCopy(i18n.resolvedLanguage ?? 'en');
  const camera = useThree(s => s.camera);
  const invalidate = useThree(s => s.invalidate);
  const gl = useThree(s => s.gl);
  useEffect(() => () => { if (camera instanceof PerspectiveCamera) camera.clearViewOffset(); invalidate(); }, [camera, invalidate]);
  useFrame(({ camera: active, controls, size }) => {
    if (!(active instanceof PerspectiveCamera)) return;
    if (transit) {
      const pose = schoolTransitPose(transit, (serverNow() - transit.at) / transit.duration);
      active.position.set(...pose.position);
      if (controls && 'target' in controls && controls.target instanceof Vector3) controls.target.set(...pose.target);
      active.lookAt(...pose.target);
    } else if (frame) {
      const center = toWorld(frame.center), range = schoolFrameRange(frame, serverNow());
      if (frame.magnify) {
        const canvas = gl.domElement.getBoundingClientRect();
        const coach = document.querySelector('[data-school-coach]')?.getBoundingClientRect();
        const top = coach ? Math.max(0, coach.bottom - canvas.top + 10) : 0;
        const fit = schoolCameraFit(range, { ...size, top, bottom: 64, fov: active.fov });
        active.position.set(center[0], center[1] + fit.distance * Math.sqrt(.96), center[2] + fit.distance * .2);
        active.setViewOffset(size.width, size.height, 0, fit.offsetY, size.width, size.height);
      } else active.position.set(center[0], center[1] + range * .854, center[2] + range * .52);
      if (controls && 'target' in controls && controls.target instanceof Vector3) controls.target.set(...center);
      active.lookAt(...center);
    }
    if (!frame?.magnify) active.setViewOffset(size.width, size.height, 0, -size.height * .1, size.width, size.height);
  });
  if (!frame) return null;
  const center = toWorld(frame.center);
  const framed = nodes.filter(node => node.intel !== 'UNKNOWN' || !frame.magnify
    || Math.hypot(node.position[0] - center[0], node.position[2] - center[2]) <= frame.to * .92);
  return <>{framed.map(node => node.intel === 'UNKNOWN' && frame.magnify ?
    <Html key={node.id} center position={node.position} zIndexRange={[12, 10]}>
      <button type="button" data-school-fog={node.id} className="school-fog-world" aria-label={copy.unexplored}
        onPointerUp={event => { if (!wasTap()) return; markHit(); event.stopPropagation(); onSelect(node.id); }}>
        <span aria-hidden="true" className="school-fog-body" /><span className="school-world-label">{copy.unexplored}</span>
      </button>
    </Html> : <Html key={node.id} center position={node.position} zIndexRange={[12, 10]} style={{ pointerEvents: 'none' }}>
    <span data-school-world={node.id} data-known={node.intel !== 'UNKNOWN'} className="school-world-label" style={{ transform: `translateY(-${String(Math.round(14 + node.radius * 4))}px)` }}>
      {node.intel === 'UNKNOWN' ? copy.unexplored : node.name}
    </span>
  </Html>)}</>;
}
