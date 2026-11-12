import * as THREE from "three";

// One palette for the whole station: off-white hull panels, graphite trusses, a single
// orange accent, deep-blue solar cells, warm window light, and an acid-green alien glow.
export const PALETTE = {
  hull: "#e9ecef",
  hullShade: "#c9ced6",
  panel: "#aab2bd",
  graphite: "#4b525d",
  truss: "#7d8592",
  accent: "#f08a3c",
  accentBlue: "#3f7fd6",
  gold: "#d9a94a",
  solar: "#1f3570",
  solarFrame: "#8a93a1",
  window: "#2a2f3a",
  windowGlow: "#ffd18a",
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
  spark: 2.5,
  alienGlow: 2.2,
  accentBlue: 0.15,
  solar: 0.12
};

function makeMaterial(name: MaterialName, clippingPlanes: THREE.Plane[] = []) {
  const material = new THREE.MeshStandardMaterial({
    color: PALETTE[name],
    flatShading: true,
    roughness: name === "solar" || name === "glass" ? 0.35 : name === "gold" ? 0.4 : 0.75,
    metalness: name === "gold" || name === "truss" || name === "solarFrame" ? 0.5 : name === "solar" ? 0.3 : 0.05,
    clippingPlanes,
    clipShadows: clippingPlanes.length > 0,
    transparent: name === "glass",
    opacity: name === "glass" ? 0.45 : 1,
    side: name === "solar" || name === "glass" ? THREE.DoubleSide : THREE.FrontSide
  });
  const glow = GLOWING[name];
  if (glow) {
    material.emissive = new THREE.Color(name === "window" ? PALETTE.windowGlow : PALETTE[name]);
    material.emissiveIntensity = glow;
  }
  return material;
}

export function createMaterials(clippingPlanes: THREE.Plane[] = []): MaterialSet {
  const set = {} as MaterialSet;
  for (const name of Object.keys(PALETTE) as MaterialName[]) {
    set[name] = makeMaterial(name, clippingPlanes);
  }
  return set;
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
    cached(`ico:${r(radius)}:${detail}`, () => new THREE.IcosahedronGeometry(radius, detail))
};
