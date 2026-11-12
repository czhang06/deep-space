import * as THREE from "three";
import { useEffect, useState } from "react";

export interface Sky {
  sky: THREE.Color;
  horizon: THREE.Color;
  sun: THREE.Color;
  sunIntensity: number;
  ambient: number;
  sunAngle: number;
  windowGlow: number;
}

// Keyframes through a day (hour -> look). Colours are interpolated between them.
const KEYS: Array<{ hour: number; sky: string; horizon: string; sun: string; intensity: number; ambient: number; glow: number }> = [
  { hour: 0, sky: "#27345e", horizon: "#3d4c7c", sun: "#b4c4f0", intensity: 1.1, ambient: 1.0, glow: 1.6 },
  { hour: 5, sky: "#2f3a63", horizon: "#56588a", sun: "#bcc6ef", intensity: 1.15, ambient: 1.0, glow: 1.4 },
  { hour: 6.5, sky: "#f0b58e", horizon: "#f7d7b0", sun: "#ffcf9e", intensity: 1.6, ambient: 0.75, glow: 0.4 },
  { hour: 9, sky: "#a8d3ee", horizon: "#e2f0f6", sun: "#fff4e0", intensity: 2.3, ambient: 0.95, glow: 0 },
  { hour: 16, sky: "#a3cdea", horizon: "#e6eff0", sun: "#fff1d8", intensity: 2.2, ambient: 0.9, glow: 0 },
  { hour: 19, sky: "#ee9e72", horizon: "#f8cf9c", sun: "#ffb27a", intensity: 1.5, ambient: 0.7, glow: 0.6 },
  { hour: 21, sky: "#353c6b", horizon: "#615a86", sun: "#bdc3f0", intensity: 1.15, ambient: 1.0, glow: 1.5 },
  { hour: 24, sky: "#27345e", horizon: "#3d4c7c", sun: "#b4c4f0", intensity: 1.1, ambient: 1.0, glow: 1.6 }
];

export function skyAt(hour: number): Sky {
  let index = 0;
  while (index < KEYS.length - 2 && KEYS[index + 1].hour <= hour) {
    index += 1;
  }
  const a = KEYS[index];
  const b = KEYS[index + 1];
  const t = Math.min(1, Math.max(0, (hour - a.hour) / (b.hour - a.hour)));
  const mix = (x: string, y: string) => new THREE.Color(x).lerp(new THREE.Color(y), t);
  return {
    sky: mix(a.sky, b.sky),
    horizon: mix(a.horizon, b.horizon),
    sun: mix(a.sun, b.sun),
    sunIntensity: a.intensity + (b.intensity - a.intensity) * t,
    ambient: a.ambient + (b.ambient - a.ambient) * t,
    windowGlow: a.glow + (b.glow - a.glow) * t,
    // Sun swings from east (morning) to west (evening); the moon takes the same path at night.
    sunAngle: (((hour + 18) % 12) / 12) * Math.PI
  };
}

function currentHour(): number {
  const now = new Date();
  return now.getHours() + now.getMinutes() / 60;
}

/** Real local time, refreshed every minute. `?hour=21` in the URL overrides it for previews. */
export function useHour(): number {
  const override = Number(new URLSearchParams(window.location.search).get("hour"));
  const [hour, setHour] = useState(currentHour);
  useEffect(() => {
    const timer = window.setInterval(() => setHour(currentHour()), 60000);
    return () => window.clearInterval(timer);
  }, []);
  return Number.isFinite(override) && new URLSearchParams(window.location.search).has("hour") ? override : hour;
}
