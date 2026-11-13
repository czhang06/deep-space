import * as THREE from "three";
import { createRng } from "./rng.ts";

// The ship's journey. It starts by drifting out through the solar system, and as it grows it
// gets faster: past Pluto it leaves for nearby stars, then nebulae and the galactic core, then
// other galaxies, and finally an endless deep field of distant galaxies. Each destination takes
// a leg of finished build steps; legs get shorter as the ship speeds up.

export interface Planet {
  name: string;
  /** relative size on screen */
  size: number;
  colors: string[];
  style: "rocky" | "cloudy" | "earth" | "mars" | "gas" | "ice" | "star" | "cluster" | "nebula" | "galaxy";
  ring?: { inner: number; outer: number; color: string; tilt: number };
  tilt: number;
  /** the light falling on the ship here: the Sun, or the star or glow being passed */
  sun: { intensity: number; color: string; size: number };
  /** background tint of space here */
  space: string;
}

/** A destination beyond the planets: stars, clusters, nebulae and galaxies. */
const star = (name: string, size: number, core: string, corona: string, light: number, space: string): Planet => ({
  name,
  size,
  colors: [core, corona, corona],
  style: "star",
  tilt: 0,
  sun: { intensity: light, color: core, size: 0.12 },
  space
});
const far = (name: string, style: Planet["style"], size: number, colors: string[], tilt: number, light: number, lightColor: string, space: string): Planet => ({
  name,
  size,
  colors,
  style,
  tilt,
  sun: { intensity: light, color: lightColor, size: 0 },
  space
});

export const PLANETS: Planet[] = [
  { name: "Mercury", size: 0.55, colors: ["#9c958c", "#7d776f", "#b5aea4"], style: "rocky", tilt: 0, sun: { intensity: 3.4, color: "#fff1d6", size: 2.6 }, space: "#0b0a12" },
  { name: "Venus", size: 0.85, colors: ["#e8cf96", "#d9b46e", "#f2e2b8"], style: "cloudy", tilt: 0.05, sun: { intensity: 3.0, color: "#fff2da", size: 2.0 }, space: "#0b0a13" },
  { name: "Earth", size: 0.9, colors: ["#2f6fb8", "#3d8a4a", "#e9eef2"], style: "earth", tilt: 0.41, sun: { intensity: 2.6, color: "#fff5e6", size: 1.5 }, space: "#070a14" },
  { name: "Mars", size: 0.6, colors: ["#c4623a", "#9b4529", "#e0a07a"], style: "mars", tilt: 0.44, sun: { intensity: 2.3, color: "#ffeedd", size: 1.2 }, space: "#080913" },
  { name: "Jupiter", size: 2.4, colors: ["#d8b48a", "#b98a5e", "#efe1c8", "#a8673f"], style: "gas", tilt: 0.05, sun: { intensity: 1.9, color: "#f6ecdf", size: 0.7 }, space: "#06081a" },
  {
    name: "Saturn",
    size: 2.0,
    colors: ["#e7d3a1", "#cdb27a", "#f3e6c4"],
    style: "gas",
    tilt: 0.47,
    ring: { inner: 1.3, outer: 2.3, color: "#d9c8a0", tilt: 0 },
    sun: { intensity: 1.6, color: "#efe8e0", size: 0.5 },
    space: "#06081a"
  },
  {
    name: "Uranus",
    size: 1.4,
    colors: ["#9fdde2", "#86cdd4", "#bfeaee"],
    style: "ice",
    tilt: 1.7,
    ring: { inner: 1.5, outer: 1.75, color: "#9fb6c0", tilt: 0 },
    sun: { intensity: 1.35, color: "#e4e6f0", size: 0.35 },
    space: "#050719"
  },
  { name: "Neptune", size: 1.35, colors: ["#3557c9", "#2a47a8", "#6f8fe6"], style: "ice", tilt: 0.49, sun: { intensity: 1.2, color: "#dfe3f5", size: 0.3 }, space: "#04061a" },
  { name: "Pluto", size: 0.4, colors: ["#d8c2a8", "#a88f78", "#efe2d0"], style: "rocky", tilt: 0.3, sun: { intensity: 1.05, color: "#d9def2", size: 0.2 }, space: "#04050f" },
  // Nearby stars
  star("Alpha Centauri", 1.1, "#fff4dc", "#ffd9a0", 2.2, "#05060f"),
  star("Barnard's Star", 0.6, "#ffb48a", "#ff6a3a", 1.3, "#06050c"),
  star("Sirius", 1.3, "#e8f0ff", "#9fc3ff", 2.8, "#04071a"),
  star("Vega", 1.2, "#eef4ff", "#a9c8ff", 2.5, "#04071a"),
  star("Arcturus", 1.8, "#ffd2a0", "#ff9a4a", 1.9, "#090610"),
  // The wider galaxy
  far("the Pleiades", "cluster", 2.4, ["#cfe0ff", "#7fa6ff", "#4a6fd8"], 0, 2.0, "#cfdcff", "#040818"),
  star("Betelgeuse", 3.2, "#ffb07a", "#ff4a22", 1.7, "#0c0508"),
  far("the Orion Nebula", "nebula", 3.0, ["#ff6fa8", "#5fd0e0", "#8a5cff"], 0.3, 1.6, "#ffd0e8", "#0a0614"),
  far("the Crab Nebula", "nebula", 2.6, ["#ff8a4a", "#6fa8ff", "#ffd27a"], 1.1, 1.5, "#ffe0c8", "#08060f"),
  far("the galactic core", "galaxy", 4.0, ["#fff0d0", "#ffbf70", "#c27a3a"], 1.45, 2.4, "#ffe6c0", "#0c0806"),
  // Other galaxies
  far("the Large Magellanic Cloud", "galaxy", 3.0, ["#e8eeff", "#9fb0ff", "#ff9ad0"], 0.6, 1.5, "#e6ecff", "#03040c"),
  far("Andromeda", "galaxy", 4.2, ["#fff2dc", "#c9b8ff", "#8fa6ff"], 1.25, 1.6, "#f2ecff", "#02030a"),
  far("Triangulum", "galaxy", 2.8, ["#e0ecff", "#7f9cff", "#ff8fbf"], 0.9, 1.4, "#e0e8ff", "#03040c"),
  far("the Whirlpool Galaxy", "galaxy", 3.4, ["#fff0e0", "#8fb4ff", "#ff7ab0"], 0.35, 1.5, "#ece8ff", "#02030a"),
  far("the Sombrero Galaxy", "galaxy", 3.2, ["#fff0d0", "#e0c8a0", "#9f8a6a"], 1.5, 1.5, "#fff0dc", "#02030a")
];

/** After the named places: an endless deep field of distant galaxies, generated per leg. */
function deepField(leg: number): Planet {
  const rng = createRng(leg * 2654435761);
  const catalog = ["NGC", "UGC", "IC", "PGC", "ESO"][Math.floor(rng() * 5)];
  const number = 1000 + Math.floor(rng() * 9000);
  const hue = rng();
  const tint = new THREE.Color().setHSL(hue, 0.6, 0.72).getStyle();
  const arms = new THREE.Color().setHSL((hue + 0.5) % 1, 0.65, 0.68).getStyle();
  return far(`galaxy ${catalog} ${number}`, "galaxy", 2.6 + rng() * 1.8, ["#fff4e6", tint, arms], rng() * 1.5, 1.3, "#e8ecff", "#020309");
}

const KM_PER_AU = 1.496e8;
const KM_PER_LY = 9.4607e12;

/** Rough distance from Earth of each named place, in km (planets at a typical separation). */
const DISTANCE_KM: Record<string, number> = {
  Mercury: 0.61 * KM_PER_AU,
  Venus: 0.28 * KM_PER_AU,
  Earth: 384400, // passing the Moon
  Mars: 0.52 * KM_PER_AU,
  Jupiter: 4.2 * KM_PER_AU,
  Saturn: 8.5 * KM_PER_AU,
  Uranus: 18.2 * KM_PER_AU,
  Neptune: 29.1 * KM_PER_AU,
  Pluto: 34 * KM_PER_AU,
  "Alpha Centauri": 4.37 * KM_PER_LY,
  "Barnard's Star": 5.96 * KM_PER_LY,
  Sirius: 8.6 * KM_PER_LY,
  Vega: 25 * KM_PER_LY,
  Arcturus: 36.7 * KM_PER_LY,
  "the Pleiades": 444 * KM_PER_LY,
  Betelgeuse: 548 * KM_PER_LY,
  "the Orion Nebula": 1344 * KM_PER_LY,
  "the Crab Nebula": 6500 * KM_PER_LY,
  "the galactic core": 26000 * KM_PER_LY,
  "the Large Magellanic Cloud": 160000 * KM_PER_LY,
  Andromeda: 2.5e6 * KM_PER_LY,
  Triangulum: 2.73e6 * KM_PER_LY,
  "the Whirlpool Galaxy": 23e6 * KM_PER_LY,
  "the Sombrero Galaxy": 31e6 * KM_PER_LY
};

/** Distance from Earth of destination `index`; the deep field keeps reaching further out. */
export function distanceOf(index: number): number {
  if (index < PLANETS.length) {
    return DISTANCE_KM[PLANETS[index].name] ?? 0;
  }
  return DISTANCE_KM["the Sombrero Galaxy"] * Math.pow(1.12, index - PLANETS.length + 1);
}

/**
 * A distance in km, in the unit that suits it: km, million or billion km, then light years.
 * Four significant figures, so the number keeps ticking over as the ship travels.
 */
export function formatDistance(km: number): string {
  const round = (value: number) =>
    value >= 1000 ? Math.round(value).toLocaleString("en-US") : value.toLocaleString("en-US", { maximumSignificantDigits: 4, minimumSignificantDigits: 4 });
  if (km < 1e6) {
    return `${round(km)} km`;
  }
  if (km < 1e9) {
    return `${round(km / 1e6)} million km`;
  }
  const ly = km / KM_PER_LY;
  if (ly < 0.05) {
    return `${round(km / 1e9)} billion km`;
  }
  if (ly < 1) {
    return `${ly.toFixed(3)} light years`;
  }
  if (ly < 1e6) {
    return `${round(ly)} light years`;
  }
  if (ly < 1e9) {
    return `${round(ly / 1e6)} million light years`;
  }
  return `${round(ly / 1e9)} billion light years`;
}

/** Build steps spent getting to destination `index`: legs shorten as the ship speeds up. */
export function legLength(index: number): number {
  return index < 9 ? 10 : index < 15 ? 8 : index < 19 ? 7 : 6;
}

/** Which part of the universe destination `index` is in. */
export function regionOf(index: number): string {
  return index < 9 ? "the solar system" : index < 15 ? "nearby stars" : index < 19 ? "the Milky Way" : "intergalactic space";
}

export function destination(index: number): Planet {
  return index < PLANETS.length ? PLANETS[index] : deepField(index);
}

/** The ship's cruising speed, in multiples of light speed, after this many build steps. */
export function speedAt(builtSteps: number): number {
  return 0.04 * Math.pow(10, builtSteps / 55);
}

/** Speed in plain words: a share of light speed, then a multiple of it. */
export function formatSpeed(c: number): string {
  if (c < 0.995) {
    return `${Math.max(1, Math.round(c * 100))}% of light speed`;
  }
  if (c < 1.5) {
    return "Light speed";
  }
  if (c < 1e6) {
    return `${Math.round(c).toLocaleString("en-US")}× light speed`;
  }
  return `${(c / 1e6).toFixed(1)} million × light speed`;
}

export interface JourneyState {
  /** the place being passed now and the next one */
  current: Planet;
  next: Planet;
  /** 0..1 along the leg from current to next */
  leg: number;
  /** which destination this is (0 = Mercury) */
  index: number;
  /** where the ship is: the solar system, among the stars, or out between galaxies */
  region: string;
  speed: number;
  /** how far from Earth the ship is, in km */
  distance: number;
  label: string;
}

export function journeyAt(builtSteps: number, progress = 0): JourneyState {
  let travelled = Math.max(0, builtSteps - 1 + progress);
  let index = 0;
  while (travelled >= legLength(index)) {
    travelled -= legLength(index);
    index += 1;
  }
  const current = destination(index);
  const next = destination(index + 1);
  const fraction = travelled / legLength(index);
  const region = regionOf(index);
  const label = fraction < 0.65 ? `Passing ${current.name}` : `Heading for ${next.name}`;
  // Distances span from thousands of km to billions of light years, so the far legs ease
  // across them on a log scale; inside the solar system it's a plain blend.
  // The readout moves steadily across the whole leg.
  const from = distanceOf(index);
  const to = distanceOf(index + 1);
  const distance = index < 8 ? from + (to - from) * fraction : Math.exp(Math.log(from) + (Math.log(to) - Math.log(from)) * fraction);
  return { current, next, leg: fraction, index, region, speed: speedAt(builtSteps), distance, label };
}

// ---- planet surfaces, painted once on a canvas ------------------------------------------------

const textures = new Map<string, THREE.Texture>();

export function planetTexture(planet: Planet): THREE.Texture {
  const cached = textures.get(planet.name);
  if (cached) {
    return cached;
  }
  const width = 512;
  const height = 256;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  const rng = createRng(planet.name.length * 7919 + planet.name.charCodeAt(0));
  const [base, dark, light, extra] = planet.colors;

  ctx.fillStyle = base;
  ctx.fillRect(0, 0, width, height);

  const blob = (x: number, y: number, radius: number, color: string, alpha: number) => {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(x, y, radius * (1.4 + rng()), radius, rng() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
    // Wrap around the seam so the sphere has no visible edge.
    if (x < radius * 2) {
      ctx.beginPath();
      ctx.ellipse(x + width, y, radius * 1.4, radius, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  if (planet.style === "gas" || planet.style === "ice") {
    let y = 0;
    while (y < height) {
      const band = 6 + rng() * (planet.style === "gas" ? 22 : 40);
      const palette = [base, dark, light, extra ?? light];
      ctx.globalAlpha = planet.style === "gas" ? 0.75 : 0.35;
      ctx.fillStyle = palette[Math.floor(rng() * palette.length)];
      ctx.fillRect(0, y, width, band);
      y += band;
    }
    if (planet.name === "Jupiter") {
      blob(width * 0.62, height * 0.64, 22, "#b5543a", 0.85); // the great red spot
    }
    for (let index = 0; index < 40; index += 1) {
      blob(rng() * width, rng() * height, 4 + rng() * 10, rng() > 0.5 ? light : dark, 0.18);
    }
  } else if (planet.style === "earth") {
    // A few continents built from clusters of small patches, mostly ocean, wispy clouds.
    for (let continent = 0; continent < 6; continent += 1) {
      const cx = rng() * width;
      const cy = height * 0.2 + rng() * height * 0.6;
      for (let patch = 0; patch < 9; patch += 1) {
        blob(cx + (rng() - 0.5) * 70, cy + (rng() - 0.5) * 40, 5 + rng() * 13, rng() > 0.3 ? dark : "#b9a46a", 0.95);
      }
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = light;
    ctx.fillRect(0, 0, width, 12);
    ctx.fillRect(0, height - 12, width, 12);
    for (let index = 0; index < 70; index += 1) {
      blob(rng() * width, rng() * height, 3 + rng() * 10, "#ffffff", 0.3);
    }
  } else {
    for (let index = 0; index < 120; index += 1) {
      blob(rng() * width, rng() * height, 3 + rng() * 18, rng() > 0.5 ? dark : light, planet.style === "cloudy" ? 0.25 : 0.4);
    }
    if (planet.style === "mars") {
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = "#f3e9e2";
      ctx.fillRect(0, 0, width, 10);
    }
  }
  ctx.globalAlpha = 1;

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  textures.set(planet.name, texture);
  return texture;
}

export function ringTexture(color: string): THREE.Texture {
  const key = `ring:${color}`;
  const cached = textures.get(key);
  if (cached) {
    return cached;
  }
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 4;
  const ctx = canvas.getContext("2d")!;
  const rng = createRng(1234);
  for (let x = 0; x < 256; x += 1) {
    ctx.globalAlpha = 0.25 + rng() * 0.6 * (x > 120 && x < 140 ? 0.15 : 1);
    ctx.fillStyle = color;
    ctx.fillRect(x, 0, 1, 4);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  textures.set(key, texture);
  return texture;
}

// ---- deep-space objects, painted once on a canvas ----------------------------------------------

function canvasTexture(key: string, size: number, paint: (ctx: CanvasRenderingContext2D, rng: () => number) => void): THREE.Texture {
  const cached = textures.get(key);
  if (cached) {
    return cached;
  }
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  let hash = 0;
  for (const char of key) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  paint(ctx, createRng(hash));
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  textures.set(key, texture);
  return texture;
}

/** A soft round dab of colour, transparent at the edge. */
function dab(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string, alpha: number): void {
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
  const c = new THREE.Color(color);
  const rgb = `${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)}`;
  gradient.addColorStop(0, `rgba(${rgb},${alpha})`);
  gradient.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = gradient;
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}

/** Glowing gas clouds in the destination's colours, with dark dust lanes and embedded stars. */
export function nebulaTexture(place: Planet): THREE.Texture {
  return canvasTexture(`nebula:${place.name}`, 512, (ctx, rng) => {
    ctx.globalCompositeOperation = "lighter";
    for (let index = 0; index < 160; index += 1) {
      // Clouds cluster along a few wandering filaments.
      const strand = index % 4;
      const t = rng();
      const x = 256 + Math.cos(strand * 1.7 + t * 3) * (40 + t * 170) + (rng() - 0.5) * 60;
      const y = 256 + Math.sin(strand * 2.3 + t * 2.4) * (30 + t * 120) + (rng() - 0.5) * 60;
      dab(ctx, x, y, 20 + rng() * 70, place.colors[Math.floor(rng() * place.colors.length)], 0.12 + rng() * 0.12);
    }
    ctx.globalCompositeOperation = "destination-out";
    for (let index = 0; index < 26; index += 1) {
      dab(ctx, 256 + (rng() - 0.5) * 300, 256 + (rng() - 0.5) * 260, 10 + rng() * 34, "#000000", 0.35);
    }
    ctx.globalCompositeOperation = "lighter";
    for (let index = 0; index < 40; index += 1) {
      dab(ctx, 256 + (rng() - 0.5) * 380, 256 + (rng() - 0.5) * 380, 2 + rng() * 5, "#ffffff", 0.9);
    }
    // Fade everything toward the edge so the sprite has no square border.
    ctx.globalCompositeOperation = "destination-in";
    const fade = ctx.createRadialGradient(256, 256, 120, 256, 256, 256);
    fade.addColorStop(0, "rgba(0,0,0,1)");
    fade.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = fade;
    ctx.fillRect(0, 0, 512, 512);
  });
}

/** A spiral galaxy seen at an angle (tilt 0 face-on, about 1.5 edge-on), or the galactic core. */
export function galaxyTexture(place: Planet): THREE.Texture {
  return canvasTexture(`galaxy:${place.name}`, 512, (ctx, rng) => {
    const squash = Math.max(0.12, Math.cos(place.tilt));
    const arms = 2 + Math.floor(rng() * 3);
    const twist = 3.5 + rng() * 2.5;
    const [core, armColor, knots] = place.colors;
    ctx.globalCompositeOperation = "lighter";
    ctx.save();
    ctx.translate(256, 256);
    ctx.rotate(rng() * Math.PI);
    ctx.scale(1, squash);
    for (let index = 0; index < 2600; index += 1) {
      const arm = index % arms;
      const t = Math.pow(rng(), 0.7);
      const angle = (arm / arms) * Math.PI * 2 + t * twist + (rng() - 0.5) * 0.5;
      const radius = 18 + t * 225;
      const spread = (rng() - 0.5) * 26 * (0.4 + t);
      const x = Math.cos(angle) * radius + Math.cos(angle + Math.PI / 2) * spread;
      const y = Math.sin(angle) * radius + Math.sin(angle + Math.PI / 2) * spread;
      const bright = rng() < 0.06;
      dab(ctx, x, y, bright ? 3 + rng() * 4 : 2 + rng() * 6, bright ? knots : armColor, bright ? 0.7 : 0.16);
    }
    // A diffuse disc of unresolved stars, densest toward the middle, so tilted galaxies read
    // as solid discs rather than hollow rings.
    for (let index = 0; index < 420; index += 1) {
      const radius = Math.pow(rng(), 1.6) * 230;
      const angle = rng() * Math.PI * 2;
      dab(ctx, Math.cos(angle) * radius, Math.sin(angle) * radius, 16 + rng() * 22, rng() < 0.7 ? armColor : core, 0.07);
    }
    dab(ctx, 0, 0, 160, armColor, 0.22);
    dab(ctx, 0, 0, 95, core, 0.85);
    dab(ctx, 0, 0, 26, "#ffffff", 0.9);
    ctx.restore();
    // A dark dust lane across steeply tilted galaxies.
    if (squash < 0.4) {
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.fillRect(0, 252, 512, 7);
    }
  });
}

/** A young open cluster: a scatter of hot blue-white stars in a faint reflection haze. */
export function clusterTexture(place: Planet): THREE.Texture {
  return canvasTexture(`cluster:${place.name}`, 512, (ctx, rng) => {
    ctx.globalCompositeOperation = "lighter";
    for (let index = 0; index < 40; index += 1) {
      dab(ctx, 256 + (rng() - 0.5) * 300, 256 + (rng() - 0.5) * 260, 30 + rng() * 60, place.colors[2], 0.06);
    }
    for (let index = 0; index < 90; index += 1) {
      const x = 256 + (rng() - 0.5) * 340;
      const y = 256 + (rng() - 0.5) * 300;
      const size = rng() < 0.12 ? 10 + rng() * 10 : 2 + rng() * 4;
      dab(ctx, x, y, size * 2.5, place.colors[1], 0.35);
      dab(ctx, x, y, size, place.colors[0], 0.95);
    }
  });
}
