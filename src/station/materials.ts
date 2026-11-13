import * as THREE from "three";

// One palette for the whole ship, gothic battleship style: dark iron hull and towers, a pale
// armoured prow and armour plates, brass trim, deep red banners, hundreds of warm lit windows,
// cyan engine glow, and an acid-green alien glow.
export const PALETTE = {
  hull: "#7b818c",
  hullShade: "#5f656f",
  panel: "#454a52",
  plate: "#cfcabd",
  bone: "#d9d4c6",
  graphite: "#22252b",
  truss: "#5a606a",
  gunmetal: "#4b5059",
  accent: "#9a2c22",
  accentBlue: "#3d6fd1",
  gold: "#b8924f",
  solar: "#1b2747",
  solarFrame: "#6f7887",
  window: "#2a2f3a",
  windowGlow: "#ffb769",
  engine: "#3fb8ff",
  energy: "#57d6ff",
  beacon: "#ff4636",
  glass: "#9fe3ff",
  plant: "#62b85a",
  plantDark: "#3f8a45",
  scorch: "#2b2522",
  spark: "#ffcf6b",
  frame: "#f2b544",
  alien: "#6f2fb8",
  alienSkin: "#8d4fd6",
  alienGlow: "#b6ff5a"
} as const;

export type MaterialName = keyof typeof PALETTE;
export type MaterialSet = Record<MaterialName, THREE.MeshStandardMaterial>;

const GLOWING: Partial<Record<MaterialName, number>> = {
  window: 1.3,
  engine: 1.5,
  energy: 2.4,
  beacon: 3,
  spark: 2.5,
  alienGlow: 2.2,
  accentBlue: 0.15,
  solar: 0.12
};

/** The palette in use: the base colours with the active design's overrides applied. */
const current: Record<MaterialName, string> = { ...PALETTE };

/** The plain structural surfaces a design's finish applies to (not glows or glass). */
const STRUCTURE = new Set<MaterialName>(["hull", "hullShade", "panel", "plate", "bone", "graphite", "truss", "gunmetal", "gold", "accent"]);

export interface Finish {
  metalness: number;
  roughness: number;
  /** how strongly the environment map shows in the structure */
  reflections: number;
}

let finish: Finish | undefined;
let environment: THREE.Texture | null = null;
/** Every material set made so far (the shared one plus each construction set), so changes reach all. */
const sets: MaterialSet[] = [];

function surface(name: MaterialName): { roughness: number; metalness: number } {
  if (finish && STRUCTURE.has(name)) {
    // Trim keeps a little more polish than the plates it edges.
    const trim = name === "gold" || name === "gunmetal";
    return { metalness: Math.min(1, finish.metalness + (trim ? 0.15 : 0)), roughness: Math.max(0.1, finish.roughness - (trim ? 0.1 : 0)) };
  }
  return {
    roughness: name === "solar" || name === "glass" ? 0.35 : name === "gold" || name === "gunmetal" ? 0.4 : 0.62,
    metalness: name === "gold" || name === "gunmetal" ? 0.65 : name === "truss" || name === "solarFrame" || name === "solar" ? 0.4 : 0.18
  };
}

/** Brings one material in line with the current palette, finish and environment. */
function refresh(name: MaterialName, material: THREE.MeshStandardMaterial): void {
  material.color.set(current[name]);
  Object.assign(material, surface(name));
  if (GLOWING[name]) {
    material.emissive.set(name === "window" ? current.windowGlow : current[name]);
  }
  const reflective = Boolean(finish && finish.reflections > 0 && STRUCTURE.has(name));
  const envMap = reflective ? environment : null;
  if (material.envMap !== envMap) {
    material.envMap = envMap;
    material.needsUpdate = true;
  }
  material.envMapIntensity = reflective ? finish!.reflections : 1;
}

// ---- surface plating ------------------------------------------------------------------------
// Big flat faces read as plain boxes, so the structural materials get procedural plating in the
// shader: staggered armour panels of uneven sizes (some split into smaller plates), dark seams
// between them, per-panel shade and roughness changes, a slight per-panel tilt so the light
// catches them differently, and faint streaks. It's projected from the ship's own axes, so it
// stays put while the ship drifts, and fades out where it would shimmer at a distance.

/** Ship space for the plating: the inverse of the ship group's world matrix (set by the view). */
export const SHIP_SPACE = { value: new THREE.Matrix4() };

const PLATED = new Set<MaterialName>(["hull", "hullShade", "panel", "plate", "bone", "gunmetal"]);

const PLATING_VERTEX = /* glsl */ `
  vec4 shipPosition = vec4(transformed, 1.0);
  vec3 shipNormal = objectNormal;
  #ifdef USE_INSTANCING
    shipPosition = instanceMatrix * shipPosition;
    shipNormal = mat3(instanceMatrix) * shipNormal;
  #endif
  mat4 toShip = uShipSpace * modelMatrix;
  vShipPosition = (toShip * shipPosition).xyz;
  vShipNormal = normalize(mat3(toShip) * shipNormal);
`;

const PLATING_FUNCTIONS = /* glsl */ `
  uniform float uPlatingScale;
  varying vec3 vShipPosition;
  varying vec3 vShipNormal;
  float plateHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  // x: panel value, y: seam (1 on a seam), z: second panel value
  vec3 plating(vec2 uv) {
    uv *= vec2(1.5, 4.4) * uPlatingScale;
    float row = floor(uv.y);
    uv.x += plateHash(vec2(row, 7.0)) * 0.7;
    vec2 cell = floor(uv);
    vec2 f = fract(uv);
    float h = plateHash(cell);
    if (h > 0.6) {
      vec2 sub = floor(f * 2.0);
      cell = cell * 2.0 + sub + 31.0;
      f = fract(f * 2.0);
      h = plateHash(cell);
    }
    vec2 e = min(f, 1.0 - f);
    float edge = min(e.x, e.y * 1.6);
    float seam = 1.0 - smoothstep(0.02, 0.06, edge);
    float blur = fwidth(uv.x) + fwidth(uv.y);
    seam *= 1.0 - smoothstep(0.2, 0.6, blur);
    return vec3(h, seam, plateHash(cell + 5.3));
  }
  vec3 shipPlating() {
    vec3 n = abs(vShipNormal);
    vec2 uv = n.x > n.y && n.x > n.z ? vShipPosition.zy : (n.y > n.z ? vShipPosition.xz : vShipPosition.xy);
    return plating(uv);
  }
`;

function addPlating(material: THREE.MeshStandardMaterial, scale: number): void {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uShipSpace = SHIP_SPACE;
    shader.uniforms.uPlatingScale = { value: scale };
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nuniform mat4 uShipSpace;\nvarying vec3 vShipPosition;\nvarying vec3 vShipNormal;")
      .replace("#include <project_vertex>", `#include <project_vertex>\n${PLATING_VERTEX}`);
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\n${PLATING_FUNCTIONS}`)
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        vec3 plate = shipPlating();
        float shade = 1.0 + (plate.x - 0.5) * 0.14;
        shade *= plate.z < 0.07 ? 0.78 : (plate.z > 0.95 ? 1.12 : 1.0);
        float streak = plateHash(floor(vShipPosition.xz * vec2(0.8, 11.0))) - 0.5;
        diffuseColor.rgb *= shade * (1.0 + streak * 0.05) * (1.0 - plate.y * 0.5);`
      )
      .replace(
        "#include <roughnessmap_fragment>",
        `#include <roughnessmap_fragment>
        roughnessFactor = clamp(roughnessFactor + (plate.x - 0.5) * 0.22 + plate.y * 0.2, 0.05, 1.0);`
      )
      .replace(
        "#include <normal_fragment_begin>",
        `#include <normal_fragment_begin>
        normal = normalize(normal + (vec3(plate.z, plate.x, fract(plate.z * 7.0)) - 0.5) * 0.09);`
      );
  };
  material.customProgramCacheKey = () => `plating-${scale}`;
}

function makeMaterial(name: MaterialName, clippingPlanes: THREE.Plane[] = []) {
  const material = new THREE.MeshStandardMaterial({
    color: current[name],
    flatShading: true,
    clippingPlanes,
    clipShadows: clippingPlanes.length > 0,
    transparent: name === "glass",
    opacity: name === "glass" ? 0.45 : 1,
    side: name === "solar" || name === "glass" ? THREE.DoubleSide : THREE.FrontSide
  });
  const glow = GLOWING[name];
  if (glow) {
    material.emissive = new THREE.Color(name === "window" ? current.windowGlow : current[name]);
    material.emissiveIntensity = glow;
  }
  if (PLATED.has(name)) {
    // Trim and fittings get smaller plates than the hull.
    addPlating(material, name === "gunmetal" || name === "panel" ? 1.8 : 1);
  }
  refresh(name, material);
  return material;
}

function refreshAll(): void {
  for (const set of sets) {
    for (const name of Object.keys(PALETTE) as MaterialName[]) {
      refresh(name, set[name]);
    }
  }
}

/**
 * Switches every material to a design's colours (unlisted colours fall back to the base palette)
 * and, optionally, its surface finish.
 */
export function applyPalette(overrides: Record<string, string>, nextFinish?: Finish): void {
  for (const name of Object.keys(PALETTE) as MaterialName[]) {
    current[name] = overrides[name] ?? PALETTE[name];
  }
  finish = nextFinish;
  refreshAll();
}

/**
 * Gives the structure an environment to reflect. Only ship materials use it (the planet and
 * backdrop stay matte), and only when the active design has a reflective finish.
 */
export function setReflections(envMap: THREE.Texture | null): void {
  environment = envMap;
  refreshAll();
}

export function createMaterials(clippingPlanes: THREE.Plane[] = []): MaterialSet {
  const set = {} as MaterialSet;
  for (const name of Object.keys(PALETTE) as MaterialName[]) {
    set[name] = makeMaterial(name, clippingPlanes);
  }
  sets.push(set);
  return set;
}

/** Disposes a set made by createMaterials and stops keeping it in step with the palette. */
export function releaseMaterials(set: MaterialSet): void {
  const index = sets.indexOf(set);
  if (index >= 0) {
    sets.splice(index, 1);
  }
  Object.values(set).forEach((material) => material.dispose());
}

/** The shared set every finished module uses. */
export const MATERIALS = createMaterials();

// ---- shared geometries ---------------------------------------------------------------

const cache = new Map<string, THREE.BufferGeometry>();

function cached(key: string, build: () => THREE.BufferGeometry): THREE.BufferGeometry {
  let geometry = cache.get(key);
  if (!geometry) {
    geometry = build();
    cache.set(key, geometry);
  }
  return geometry;
}

const r = (value: number) => Math.round(value * 1000) / 1000;

export const geo = {
  box: (w: number, h: number, d: number) =>
    cached(`box:${r(w)}:${r(h)}:${r(d)}`, () => new THREE.BoxGeometry(w, h, d)),
  cyl: (top: number, bottom: number, h: number, segments = 12) =>
    cached(`cyl:${r(top)}:${r(bottom)}:${r(h)}:${segments}`, () => new THREE.CylinderGeometry(top, bottom, h, segments)),
  cone: (radius: number, h: number, segments = 12) =>
    cached(`cone:${r(radius)}:${r(h)}:${segments}`, () => new THREE.ConeGeometry(radius, h, segments)),
  sphere: (radius: number, segments = 12) =>
    cached(`sphere:${r(radius)}:${segments}`, () => new THREE.SphereGeometry(radius, segments, Math.max(6, segments * 0.7))),
  dome: (radius: number) =>
    cached(`dome:${r(radius)}`, () => new THREE.SphereGeometry(radius, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2)),
  dish: (radius: number) =>
    cached(`dish:${r(radius)}`, () => new THREE.SphereGeometry(radius, 14, 6, 0, Math.PI * 2, Math.PI * 0.62, Math.PI * 0.38)),
  torus: (radius: number, tube: number) =>
    cached(`torus:${r(radius)}:${r(tube)}`, () => new THREE.TorusGeometry(radius, tube, 8, 28)),
  ico: (radius: number, detail = 0) =>
    cached(`ico:${r(radius)}:${detail}`, () => new THREE.IcosahedronGeometry(radius, detail)),
  /** Angular ring: square cross-section, `sides` straight segments around. */
  hexRing: (radius: number, tube: number, sides = 6) =>
    cached(`hexring:${r(radius)}:${r(tube)}:${sides}`, () => new THREE.TorusGeometry(radius, tube, 4, sides)),
  /** Faceted dome. */
  facetDome: (radius: number) =>
    cached(`facetdome:${r(radius)}`, () => new THREE.SphereGeometry(radius, 6, 3, 0, Math.PI * 2, 0, Math.PI / 2)),
  /**
   * A flat outline (x, z pairs, viewed from above) extruded upward by `height` and centred on
   * y = 0, with a small chamfer on the edges so plates catch the light like machined metal.
   */
  prism: (outline: Array<[number, number]>, height: number, chamfer = 0.04) =>
    cached(`prism:${outline.map(([x, z]) => `${r(x)},${r(z)}`).join(";")}:${r(height)}:${r(chamfer)}`, () => {
      const shape = new THREE.Shape();
      outline.forEach(([x, z], index) => (index === 0 ? shape.moveTo(x, -z) : shape.lineTo(x, -z)));
      shape.closePath();
      const bevel = Math.min(chamfer, height / 3);
      const geometry = new THREE.ExtrudeGeometry(shape, {
        depth: Math.max(0.001, height - bevel * 2),
        bevelEnabled: bevel > 0,
        bevelThickness: bevel,
        bevelSize: bevel,
        bevelSegments: 1
      });
      geometry.rotateX(-Math.PI / 2);
      geometry.translate(0, -height / 2 + bevel, 0);
      return geometry;
    }),
  /**
   * A hull cross-section (z, y pairs, viewed from the bow) extruded along x by `length` and
   * centred on x = 0, with chamfered edges.
   */
  section: (outline: Array<[number, number]>, length: number, chamfer = 0.05) =>
    cached(`section:${outline.map(([z, y]) => `${r(z)},${r(y)}`).join(";")}:${r(length)}:${r(chamfer)}`, () => {
      const shape = new THREE.Shape();
      outline.forEach(([z, y], index) => (index === 0 ? shape.moveTo(z, y) : shape.lineTo(z, y)));
      shape.closePath();
      const bevel = Math.min(chamfer, length / 4);
      const geometry = new THREE.ExtrudeGeometry(shape, {
        depth: Math.max(0.001, length - bevel * 2),
        bevelEnabled: bevel > 0,
        bevelThickness: bevel,
        bevelSize: bevel,
        bevelSegments: 1
      });
      // Shape (z, y) extruded along +z  ->  rotate so the extrusion runs along x.
      geometry.rotateY(-Math.PI / 2);
      geometry.translate(length / 2 - bevel, 0, 0);
      return geometry;
    }),
  /** A box with its vertical corners cut off. */
  chamferBox: (w: number, h: number, d: number, cut = 0.18) => {
    const c = Math.min(cut, w / 3, d / 3);
    return geo.prism(
      [
        [-w / 2 + c, -d / 2],
        [w / 2 - c, -d / 2],
        [w / 2, -d / 2 + c],
        [w / 2, d / 2 - c],
        [w / 2 - c, d / 2],
        [-w / 2 + c, d / 2],
        [-w / 2, d / 2 - c],
        [-w / 2, -d / 2 + c]
      ],
      h
    );
  }
};
