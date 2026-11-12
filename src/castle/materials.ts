import * as THREE from "three";

// One palette for the whole castle keeps it cohesive: warm limestone, slate-blue roofs,
// terracotta for cottages, timber, and a single red-and-gold banner colour.
export const PALETTE = {
  stone: "#ddd3bd",
  stoneDark: "#b8ac93",
  stoneTrim: "#a4987f",
  slate: "#4a6797",
  slateDark: "#3b5480",
  terracotta: "#c0653f",
  thatch: "#c9a45a",
  timber: "#7b5434",
  timberDark: "#5a3c25",
  plaster: "#f1e8d4",
  window: "#2c2a35",
  windowGlow: "#ffbe63",
  banner: "#c8423b",
  gold: "#e6b44c",
  grass: "#8bb865",
  grassDark: "#6f9e52",
  leaf: "#5f9447",
  leafDark: "#4b7c3a",
  pine: "#3f6f45",
  dirt: "#8f6c4a",
  dirtDark: "#6e5137",
  cobble: "#cbbd9c",
  water: "#5aa9cf",
  scaffold: "#a57a4c",
  rubble: "#9a8f7a",
  skin: "#f1c9a1"
} as const;

export type MaterialName = keyof typeof PALETTE;
export type MaterialSet = Record<MaterialName, THREE.MeshStandardMaterial>;

function makeMaterial(name: MaterialName, clippingPlanes: THREE.Plane[] = []) {
  const material = new THREE.MeshStandardMaterial({
    color: PALETTE[name],
    flatShading: true,
    roughness: name === "water" ? 0.3 : 0.88,
    metalness: name === "gold" ? 0.35 : 0,
    clippingPlanes,
    clipShadows: clippingPlanes.length > 0,
    side: name === "banner" ? THREE.DoubleSide : THREE.FrontSide
  });
  if (name === "window") {
    material.emissive = new THREE.Color(PALETTE.windowGlow);
    material.emissiveIntensity = 0;
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

/** The shared set every finished piece uses. */
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
  cyl: (top: number, bottom: number, h: number, segments = 10) =>
    cached(`cyl:${r(top)}:${r(bottom)}:${r(h)}:${segments}`, () => new THREE.CylinderGeometry(top, bottom, h, segments)),
  cone: (radius: number, h: number, segments = 10) =>
    cached(`cone:${r(radius)}:${r(h)}:${segments}`, () => new THREE.ConeGeometry(radius, h, segments)),
  ico: (radius: number, detail = 0) =>
    cached(`ico:${r(radius)}:${detail}`, () => new THREE.IcosahedronGeometry(radius, detail)),
  dodeca: (radius: number) => cached(`dodeca:${r(radius)}`, () => new THREE.DodecahedronGeometry(radius, 0)),
  sphere: (radius: number) => cached(`sphere:${r(radius)}`, () => new THREE.SphereGeometry(radius, 8, 6)),
  /** Gable roof: triangle of `width` x `height`, ridge running `length` along local z. */
  gable: (width: number, height: number, length: number) =>
    cached(`gable:${r(width)}:${r(height)}:${r(length)}`, () => {
      const shape = new THREE.Shape();
      shape.moveTo(-width / 2, 0);
      shape.lineTo(width / 2, 0);
      shape.lineTo(0, height);
      shape.closePath();
      const geometry = new THREE.ExtrudeGeometry(shape, { depth: length, bevelEnabled: false });
      geometry.translate(0, 0, -length / 2);
      return geometry;
    }),
  /** A flag that waves a little: a plane split into strips. */
  flag: (w: number, h: number) =>
    cached(`flag:${r(w)}:${r(h)}`, () => {
      const geometry = new THREE.PlaneGeometry(w, h, 4, 1);
      geometry.translate(w / 2, 0, 0);
      return geometry;
    })
};
