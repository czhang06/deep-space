import * as THREE from "three";
import { createRng } from "./rng.ts";

// The station drifts outward through the solar system as it grows: one leg per
// MODULES_PER_LEG finished build steps. After Pluto it loops back to Mercury for another lap.

export const MODULES_PER_LEG = 10;

export interface Planet {
  name: string;
  /** relative size on screen */
  size: number;
  colors: string[];
  style: "rocky" | "cloudy" | "earth" | "mars" | "gas" | "ice";
  ring?: { inner: number; outer: number; color: string; tilt: number };
  tilt: number;
  /** sunlight at this distance */
  sun: { intensity: number; color: string; size: number };
  /** background tint of space here */
  space: string;
}

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
  { name: "Pluto", size: 0.4, colors: ["#d8c2a8", "#a88f78", "#efe2d0"], style: "rocky", tilt: 0.3, sun: { intensity: 1.05, color: "#d9def2", size: 0.2 }, space: "#04050f" }
];

export interface JourneyState {
  /** the planet being passed now and the next one */
  current: Planet;
  next: Planet;
  /** 0..1 along the leg from current to next */
  leg: number;
  lap: number;
  label: string;
}

export function journeyAt(builtSteps: number, progress = 0): JourneyState {
  const travelled = Math.max(0, builtSteps - 1 + progress) / MODULES_PER_LEG;
  const leg = Math.floor(travelled);
  const index = leg % PLANETS.length;
  const current = PLANETS[index];
  const next = PLANETS[(index + 1) % PLANETS.length];
  const fraction = travelled - leg;
  const lap = Math.floor(leg / PLANETS.length) + 1;
  const label = fraction < 0.65 ? `Passing ${current.name}` : `Heading for ${next.name}`;
  return { current, next, leg: fraction, lap, label };
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
