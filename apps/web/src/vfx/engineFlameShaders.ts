/** One back-face proxy integrates a round emissive plume, including rear views.
 * Two packed noise reads per step; no particle uploads or screen-sized pass.
 */
export const engineFlameVertex = `
  attribute vec4 aFlame;
  attribute vec2 aDimensions;
  varying vec3 vOrigin;
  varying vec3 vSurface;
  varying vec4 vFlame;
  varying vec2 vDimensions;
  uniform vec4 uShape[4];
  uniform float uPeak[4];
  void main() {
    int style = int(aFlame.x + .5);
    float power = max(aFlame.y, .001);
    float radius = aDimensions.x * uPeak[style] / .18;
    float reach = aDimensions.y * (.28 + .72 * sqrt(power));
    vec3 dimensions = vec3(radius, radius, reach);
    mat4 viewInstance = modelViewMatrix * instanceMatrix;
    vOrigin = (inverse(viewInstance) * vec4(0., 0., 0., 1.)).xyz / dimensions;
    vSurface = position;
    vFlame = aFlame;
    vDimensions = vec2(radius / aDimensions.x, reach / aDimensions.x);
    gl_Position = projectionMatrix * viewInstance * vec4(position * dimensions, 1.);
  }
`;

export const engineFlameFragment = `
  precision highp float;
  uniform sampler2D uNoise;
  uniform float uTime;
  uniform vec4 uShape[4];
  uniform vec4 uFlow[4];
  uniform float uPeak[4];
  uniform vec3 uHot[4];
  uniform vec3 uBody[4];
  uniform vec3 uTail[4];
  uniform vec3 uSheath[4];
  varying vec3 vOrigin;
  varying vec3 vSurface;
  varying vec4 vFlame;
  varying vec2 vDimensions;

  void main() {
    if (vFlame.y <= .0001) discard;
    int style = int(vFlame.x + .5);
    vec4 shape = uShape[style];
    vec4 flow = uFlow[style];
    float time = uTime * flow.x;
    vec3 direction = normalize(vSurface - vOrigin);
    vec3 safeDirection = mix(vec3(-1.), vec3(1.), step(vec3(0.), direction)) * max(abs(direction), vec3(.00001));
    vec3 first = (vec3(-1., -1., -1.) - vOrigin) / safeDirection;
    vec3 last = (vec3(1., 1., 0.) - vOrigin) / safeDirection;
    vec3 nearPoint = min(first, last), farPoint = max(first, last);
    float enter = max(max(nearPoint.x, nearPoint.y), nearPoint.z);
    float leave = min(min(farPoint.x, farPoint.y), farPoint.z);
    enter = max(enter, 0.);
    if (leave <= enter) discard;
    float stepLength = (leave - enter) / float(FLAME_STEPS);
    float opticalStep = stepLength * length(direction * vec3(vDimensions.x, vDimensions.x, vDimensions.y));
    float phase = vFlame.z;
    float axialView = smoothstep(.72, .97, abs(direction.z));
    vec3 emission = vec3(0.);
    for (int sampleIndex = 0; sampleIndex < FLAME_STEPS; sampleIndex++) {
      vec3 p = vOrigin + direction * (enter + (float(sampleIndex) + .5) * stepLength);
      float t = clamp(-p.z, 0., 1.);
      float radius = (.18 + shape.x * pow(t, flow.z)) * pow(max(.0001, 1. - t), shape.y) / uPeak[style];
      // Noise is Cartesian around the jet: no UV seam or visible rotating texture cylinder.
      vec2 moving = vec2(t * 1.7 - time * .9, p.y * .45 + p.x * .12 + phase);
      vec4 coarse = texture2D(uNoise, moving);
      vec4 detail = texture2D(uNoise, vec2(t * 3.8 - time * 1.7 + coarse.r * .12,
        p.y * .6 + p.x * .07 + phase));
      float turbulence = (coarse.r * .65 + detail.g * .35 - .5) * 3.4 * (1. - axialView * .35);
      vec2 wander = vec2(sin(t * 12. - time * 5. + phase), cos(t * 9. - time * 4. + phase))
        * .06 * shape.w * t * t;
      float radial = length(p.xy - wander) / max(radius, .001);
      float cellPhase = t * flow.y - .15;
      float compression = pow(max(0., cos(cellPhase * 6.2831853)), 8.) * exp(-t * 2.4);
      float pinch = 1. - shape.z * .23 * (1. - compression) * (1. - t);
      float brokenEdge = radial / pinch + turbulence * shape.w * (.08 + .7 * t);
      float envelope = 1. - smoothstep(.48, 1., brokenEdge);
      float filaments = smoothstep(.29, .68, detail.r * .75 + coarse.g * .4);
      filaments = mix(filaments, .6, axialView * .45);
      float breakup = mix(1., smoothstep(.18 + t * .24, .7, coarse.r + detail.b * .22), t * shape.w);
      float decay = pow(1. - t, .45) * (1. - smoothstep(.64 + coarse.g * .17, 1., t));
      float root = smoothstep(0., .004, t);
      float body = envelope * decay * root * (.22 + 1.25 * filaments) * breakup;
      body *= 1. - smoothstep(.48, .94, t) * (style == 0 ? .65 : .12);
      float core = exp(-radial * radial * 14.) * exp(-t * (style == 2 ? 9. : 3.7)) * (.75 + .5 * coarse.r);
      float cell = fract(cellPhase);
      float diamondWidth = .055 + .36 * (1. - abs(cell * 2. - 1.));
      float diamonds = exp(-pow(radial / diamondWidth, 4.)) * sin(cell * 3.14159265)
        * exp(-t * 2.5) * shape.z * 2.2;
      float hot = core * 3.1 + diamonds;
      vec3 colour = mix(uBody[style], uTail[style], smoothstep(.28, 1., t));
      colour = mix(colour, uHot[style], .32 * pow(filaments, 4.) * (1. - t));
      float warmChannel = 1. - smoothstep(.38, .86, radial);
      vec3 throatColour = mix(uHot[style], vec3(1.), exp(-t * 24.) * .65);
      vec3 density = colour * body * (style == 2 ? .22 : 1.25) * mix(1., warmChannel, min(flow.w, .85))
        + throatColour * hot * root;
      // A cooler, fast annular shear layer surrounds the hot core, rather than
      // replacing the entire plume's colour. Side views reveal its cyan-blue rim.
      float sheathRadius = radial + turbulence * shape.w * (.04 + .28 * t);
      float sheath = exp(-pow((sheathRadius - .78) * 12., 2.)) * root
        * pow(1. - t, .34) * (1. - smoothstep(.62 + coarse.r * .25, .98, t)) * (.48 + .72 * filaments);
      density += uSheath[style] * sheath * flow.w * 1.2;
      // The broad, faint envelope supplies glow without bloom or an extra draw.
      float halo = exp(-radial * radial * 2.8) * decay * root * .055;
      density += uBody[style] * halo;
      // Turbulence must fade before the proxy boundary, including straight rear views.
      // Otherwise a wide plume reveals the rectangular exit faces of its box.
      density *= 1. - smoothstep(.82, .995, length(p.xy));
      // Every emissive component shares this envelope. In particular the hot core
      // and compression cells must not survive as a solid rod beyond the fire.
      float tailFade = 1. - smoothstep(.5, 1., t);
      density *= tailFade * tailFade;
      emission += density * opticalStep * .38;
    }
    float flicker = 1. + .035 * sin(time * 31. + phase) + .018 * sin(time * 47. + phase * 3.);
    emission *= vFlame.y * flicker;
    // A local photographic shoulder keeps a white throat and coloured tail at sRGB output.
    vec3 colour = 1. - exp(-emission * 2.1);
    if (max(max(colour.r, colour.g), colour.b) < .00005) discard;
    gl_FragColor = vec4(colour, 1.);
    #include <colorspace_fragment>
  }
`;
