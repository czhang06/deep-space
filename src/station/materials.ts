import * as THREE from "three";

// One palette for the whole ship: light-grey hull plates over darker structure, a single
// red-orange warship accent, gunmetal trim, cool white windows, cyan engines and energy lines,
// and an acid-green alien glow.
export const PALETTE = {
  hull: "#c7ccd4",
  hullShade: "#9ba2ae",
  panel: "#7c8492",
  plate: "#adb3bd",
  graphite: "#3a3f48",
  truss: "#5c636f",
  gunmetal: "#596170",
  accent: "#d9482b",
  accentBlue: "#3d6fd1",
  gold: "#c9a253",
  solar: "#1b2747",
  solarFrame: "#6f7887",
  window: "#2a2f3a",
  windowGlow: "#d6efff",
  engine: "#6fdcff",
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
  engine: 3.2,
  energy: 2.4,
  beacon: 3,
  spark: 2.5,
  alienGlow: 2.2,
  accentBlue: 0.15,
  solar: 0.12
};

function makeMaterial(name: MaterialName, clippingPlanes: THREE.Plane[] = []) {
  const material = new THREE.MeshStandardMaterial({
    color: PALETTE[name],
    flatShading: true,
    roughness: name === "solar" || name === "glass" ? 0.35 : name === "gold" || name === "gunmetal" ? 0.4 : 0.62,
    metalness: name === "gold" || name === "gunmetal" ? 0.65 : name === "truss" || name === "solarFrame" || name === "solar" ? 0.4 : 0.18,
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
