import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { createRng } from "./rng.ts";

// Things that make the ship read as travelling rather than hanging in space: dust streaming
// past it toward the stern (streaks that lengthen with speed) and a sparser, slower layer of
// nearer stars for parallax against the distant star shell. Both are one draw call each and
// move entirely in the vertex shader, so the CPU does nothing per particle per frame.

/** How fast the dust should look, from the journey speed (multiples of light speed). */
export function dustPace(speedC: number): number {
  // 0.04c reads as a gentle drift; every factor of ten adds a step, up to a blur.
  return Math.min(9, Math.max(0, Math.log10(Math.max(1e-6, speedC)) + 1.5));
}

const DUST_VERTEX = /* glsl */ `
  attribute float aTail;
  attribute float aSeed;
  uniform float uTravel;
  uniform float uStreak;
  uniform vec3 uBox;
  varying float vFade;
  void main() {
    vec3 p = position * uBox;
    float pace = 0.6 + 0.8 * aSeed;
    float span = 2.0 * uBox.x;
    // Stream toward -x (the ship flies toward +x) and wrap around the box.
    float x = mod(p.x + uBox.x - uTravel * pace, span) - uBox.x;
    // The tail trails behind the head, back toward the bow side it came from.
    x += aTail * uStreak * pace;
    float edge = 1.0 - smoothstep(0.7, 1.0, abs(x) / uBox.x);
    vFade = edge * (1.0 - aTail) * (0.45 + 0.55 * aSeed);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(x, p.y, p.z, 1.0);
  }
`;

const DUST_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vFade;
  void main() {
    gl_FragColor = vec4(uColor, uOpacity * vFade);
  }
`;

const MOTE_VERTEX = /* glsl */ `
  attribute float aSeed;
  uniform float uTravel;
  uniform vec3 uBox;
  uniform float uSize;
  varying float vFade;
  void main() {
    vec3 p = position * uBox;
    float span = 2.0 * uBox.x;
    float x = mod(p.x + uBox.x - uTravel * (0.7 + 0.6 * aSeed), span) - uBox.x;
    vFade = (1.0 - smoothstep(0.75, 1.0, abs(x) / uBox.x)) * (0.5 + 0.5 * aSeed);
    vec4 view = modelViewMatrix * vec4(x, p.y, p.z, 1.0);
    gl_PointSize = clamp(uSize * (0.6 + aSeed) * 260.0 / -view.z, 1.0, 3.5);
    gl_Position = projectionMatrix * view;
  }
`;

const MOTE_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  varying float vFade;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float disc = 1.0 - smoothstep(0.25, 0.5, length(c));
    gl_FragColor = vec4(uColor, vFade * disc);
  }
`;

/**
 * Dust and near stars streaming past the ship. `radius` is the ship's framing radius (the
 * cloud scales with the ship), `speedC` the journey speed, `compact` the tray popup.
 */
export function SpaceDust({ radius, speedC, compact }: { radius: number; speedC: number; compact: boolean }) {
  const pace = dustPace(speedC);
  const box = useMemo(() => new THREE.Vector3(radius * 2.4 + 12, radius * 1.0 + 6, radius * 1.6 + 9), [radius]);
  const dustCount = compact ? 220 : 900;
  const moteCount = compact ? 120 : 420;

  const dust = useMemo(() => {
    const rng = createRng(4021);
    const positions = new Float32Array(dustCount * 2 * 3);
    const tails = new Float32Array(dustCount * 2);
    const seeds = new Float32Array(dustCount * 2);
    for (let index = 0; index < dustCount; index += 1) {
      const point = [rng() * 2 - 1, rng() * 2 - 1, rng() * 2 - 1];
      const seed = rng();
      for (let end = 0; end < 2; end += 1) {
        positions.set(point, (index * 2 + end) * 3);
        tails[index * 2 + end] = end;
        seeds[index * 2 + end] = seed;
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("aTail", new THREE.BufferAttribute(tails, 1));
    geometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
    const material = new THREE.ShaderMaterial({
      vertexShader: DUST_VERTEX,
      fragmentShader: DUST_FRAGMENT,
      uniforms: {
        uTravel: { value: 0 },
        uStreak: { value: 1 },
        uBox: { value: box },
        uColor: { value: new THREE.Color("#bcd2ff") },
        uOpacity: { value: 0.55 }
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    return { geometry, material };
  }, [dustCount, box]);

  const motes = useMemo(() => {
    const rng = createRng(911);
    const positions = new Float32Array(moteCount * 3);
    const seeds = new Float32Array(moteCount);
    for (let index = 0; index < moteCount; index += 1) {
      positions.set([rng() * 2 - 1, rng() * 2 - 1, rng() * 2 - 1], index * 3);
      seeds[index] = rng();
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
    const material = new THREE.ShaderMaterial({
      vertexShader: MOTE_VERTEX,
      fragmentShader: MOTE_FRAGMENT,
      uniforms: {
        uTravel: { value: 0 },
        // A bigger, deeper box than the dust, so these sit further out and move slower on screen.
        uBox: { value: box.clone().multiply(new THREE.Vector3(2.2, 2.6, 2.6)) },
        uSize: { value: 1.6 },
        uColor: { value: new THREE.Color("#e6eeff") }
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    return { geometry, material };
  }, [moteCount, box]);

  // Base drift speed scales with the ship so the effect looks the same at every size.
  const unit = radius * 0.06 + 1.5;
  const speed = unit * (0.7 + pace * 0.55);
  const streak = Math.max(unit * 0.25, speed * (0.12 + pace * 0.045));

  // Distance travelled, accumulated each frame from a speed that eases toward the target, so
  // a speed-up (a new leg of the journey) ramps in instead of jumping every particle.
  const travel = useRef(0);
  const current = useRef({ speed, streak });
  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.1); // a hidden popup resumes without a lurch
    current.current.speed = THREE.MathUtils.damp(current.current.speed, speed, 1.2, delta);
    current.current.streak = THREE.MathUtils.damp(current.current.streak, streak, 1.2, delta);
    travel.current += current.current.speed * delta;
    dust.material.uniforms.uTravel.value = travel.current;
    dust.material.uniforms.uStreak.value = current.current.streak;
    motes.material.uniforms.uTravel.value = travel.current * 0.45;
  });

  return (
    <>
      {/* The shader moves every vertex, so the bounding sphere can't be trusted for culling. */}
      <lineSegments geometry={dust.geometry} material={dust.material} frustumCulled={false} renderOrder={1} />
      <points geometry={motes.geometry} material={motes.material} frustumCulled={false} />
    </>
  );
}

const plumeMaterials = {
  outer: new THREE.MeshBasicMaterial({ color: "#3fb8ff", transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false }),
  inner: new THREE.MeshBasicMaterial({ color: "#c9f0ff", transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false })
};
const plumeOuter = new THREE.ConeGeometry(0.34, 1.8, 10, 1, true);
const plumeInner = new THREE.ConeGeometry(0.18, 1.1, 8, 1, true);

/**
 * An exhaust plume streaming aft (-x) from an engine nozzle at the origin, flickering. The
 * plume's base sits at the nozzle and it tapers away behind the ship.
 */
export function Plume({ phase = 0, scale = 1 }: { phase?: number; scale?: number }) {
  const group = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!group.current) {
      return;
    }
    const t = clock.elapsedTime + phase;
    const flicker = 1 + Math.sin(t * 23) * 0.06 + Math.sin(t * 7.3) * 0.08;
    group.current.scale.set(scale * flicker, scale * (0.96 + Math.sin(t * 31) * 0.04), scale * (0.96 + Math.sin(t * 29) * 0.04));
  });
  // ConeGeometry points its tip along +y; turned a quarter about z, the tip points along -x.
  return (
    <group ref={group}>
      <mesh geometry={plumeOuter} material={plumeMaterials.outer} position={[-0.9, 0, 0]} rotation={[0, 0, Math.PI / 2]} renderOrder={2} />
      <mesh geometry={plumeInner} material={plumeMaterials.inner} position={[-0.55, 0, 0]} rotation={[0, 0, Math.PI / 2]} renderOrder={2} />
    </group>
  );
}
