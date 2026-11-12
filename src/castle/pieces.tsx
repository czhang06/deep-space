import { createContext, useContext, useRef, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import type * as THREE from "three";
import type { PieceKind } from "./catalog.ts";
import { MATERIALS, geo, type MaterialName, type MaterialSet } from "./materials.ts";

/** Size of one grid cell and one storey, in world units. */
export const CELL = 2.2;
export const STOREY = 1.4;
const WALL_HEIGHT = 1.5;
const PLINTH = 0.3;

export const MaterialContext = createContext<MaterialSet>(MATERIALS);

type Vec3 = [number, number, number];

/** One mesh with a shared geometry and a palette material. */
function P({ g, m, p = [0, 0, 0], r, s }: { g: THREE.BufferGeometry; m: MaterialName; p?: Vec3; r?: Vec3; s?: Vec3 }) {
  const materials = useContext(MaterialContext);
  return <mesh geometry={g} material={materials[m]} position={p} rotation={r} scale={s} castShadow receiveShadow />;
}

function Banner({ p, height = 0.9, phase = 0 }: { p: Vec3; height?: number; phase?: number }) {
  const flag = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (flag.current) {
      flag.current.rotation.y = Math.sin(clock.elapsedTime * 2.2 + phase) * 0.35;
    }
  });
  const materials = useContext(MaterialContext);
  return (
    <group position={p}>
      <P g={geo.cyl(0.03, 0.03, height, 5)} m="timberDark" p={[0, height / 2, 0]} />
      <mesh ref={flag} geometry={geo.flag(0.55, 0.32)} material={materials.banner} position={[0.02, height - 0.2, 0]} castShadow />
      <P g={geo.sphere(0.05)} m="gold" p={[0, height + 0.03, 0]} />
    </group>
  );
}

/** Merlons around a circle. */
function CrenelRing({ radius, y, count, size = 0.26 }: { radius: number; y: number; count: number; size?: number }) {
  const merlons: ReactNode[] = [];
  for (let index = 0; index < count; index += 1) {
    const angle = (index / count) * Math.PI * 2;
    merlons.push(
      <P
        key={index}
        g={geo.box(size, size * 1.1, size * 0.7)}
        m="stone"
        p={[Math.cos(angle) * radius, y + size * 0.55, Math.sin(angle) * radius]}
        r={[0, -angle, 0]}
      />
    );
  }
  return <>{merlons}</>;
}

/** Merlons along the edge of a rectangle. */
function CrenelRect({ w, d, y, size = 0.28 }: { w: number; d: number; y: number; size?: number }) {
  const merlons: ReactNode[] = [];
  const along = (length: number) => Math.max(2, Math.round(length / (size * 2.2)));
  const nx = along(w);
  const nz = along(d);
  for (let index = 0; index < nx; index += 1) {
    const x = -w / 2 + (index + 0.5) * (w / nx);
    merlons.push(<P key={`n${index}`} g={geo.box(size, size, size * 0.7)} m="stone" p={[x, y + size / 2, -d / 2]} />);
    merlons.push(<P key={`s${index}`} g={geo.box(size, size, size * 0.7)} m="stone" p={[x, y + size / 2, d / 2]} />);
  }
  for (let index = 0; index < nz; index += 1) {
    const z = -d / 2 + (index + 0.5) * (d / nz);
    merlons.push(<P key={`w${index}`} g={geo.box(size * 0.7, size, size)} m="stone" p={[-w / 2, y + size / 2, z]} />);
    merlons.push(<P key={`e${index}`} g={geo.box(size * 0.7, size, size)} m="stone" p={[w / 2, y + size / 2, z]} />);
  }
  return <>{merlons}</>;
}

/** Windows on the four faces of a box. */
function BoxWindows({ w, d, y, perFace = 2, tall = 0.5 }: { w: number; d: number; y: number; perFace?: number; tall?: number }) {
  const windows: ReactNode[] = [];
  for (let index = 0; index < perFace; index += 1) {
    const t = (index + 1) / (perFace + 1) - 0.5;
    windows.push(<P key={`n${index}`} g={geo.box(0.24, tall, 0.06)} m="window" p={[t * w, y, -d / 2 - 0.01]} />);
    windows.push(<P key={`s${index}`} g={geo.box(0.24, tall, 0.06)} m="window" p={[t * w, y, d / 2 + 0.01]} />);
    windows.push(<P key={`w${index}`} g={geo.box(0.06, tall, 0.24)} m="window" p={[-w / 2 - 0.01, y, t * d]} />);
    windows.push(<P key={`e${index}`} g={geo.box(0.06, tall, 0.24)} m="window" p={[w / 2 + 0.01, y, t * d]} />);
  }
  return <>{windows}</>;
}

// ---- pieces ------------------------------------------------------------------------------

function Keep({ levels, variant }: { levels: number; variant: number }) {
  const parts: ReactNode[] = [];
  let top = PLINTH;
  let width = 4;
  for (let level = 0; level < levels; level += 1) {
    width = 4 - level * 0.14;
    parts.push(<P key={`b${level}`} g={geo.box(width, STOREY, width)} m="stone" p={[0, top + STOREY / 2, 0]} />);
    parts.push(<P key={`t${level}`} g={geo.box(width + 0.12, 0.1, width + 0.12)} m="stoneTrim" p={[0, top + STOREY, 0]} />);
    parts.push(<BoxWindows key={`w${level}`} w={width} d={width} y={top + STOREY * 0.55} perFace={level === 0 ? 1 : 2} />);
    top += STOREY;
  }
  const corner = width / 2;
  const turretHeight = top + 0.5;
  return (
    <group>
      <P g={geo.box(4.4, PLINTH, 4.4)} m="stoneDark" p={[0, PLINTH / 2, 0]} />
      {parts}
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => (
          <group key={`${sx}${sz}`} position={[sx * corner, 0, sz * corner]}>
            <P g={geo.cyl(0.36, 0.4, turretHeight, 8)} m="stone" p={[0, turretHeight / 2, 0]} />
            <P g={geo.cyl(0.46, 0.38, 0.2, 8)} m="stoneTrim" p={[0, turretHeight, 0]} />
            <P g={geo.cone(0.5, 1.0, 8)} m="slate" p={[0, turretHeight + 0.6, 0]} />
          </group>
        ))
      )}
      <P g={geo.box(0.85, 1.05, 0.12)} m="timberDark" p={[0, PLINTH + 0.52, 2.0]} />
      {variant % 3 === 2 ? (
        <>
          <CrenelRect w={width} d={width} y={top + 0.05} />
          <Banner p={[0, top, 0]} height={1.4} phase={variant} />
        </>
      ) : (
        <>
          <P g={geo.cone(width * 0.74, 2.3, 4)} m="slate" p={[0, top + 1.15 + 0.05, 0]} r={[0, Math.PI / 4, 0]} />
          <Banner p={[0, top + 2.25, 0]} height={0.9} phase={variant} />
        </>
      )}
    </group>
  );
}

function RoundTower({ levels, variant, radius, segments }: { levels: number; variant: number; radius: number; segments: number }) {
  const height = levels * STOREY;
  const parts: ReactNode[] = [];
  for (let level = 0; level < levels; level += 1) {
    const y = PLINTH + level * STOREY;
    if (level > 0) {
      parts.push(<P key={`band${level}`} g={geo.cyl(radius + 0.05, radius + 0.05, 0.08, segments)} m="stoneTrim" p={[0, y, 0]} />);
    }
    for (let slit = 0; slit < 2; slit += 1) {
      const angle = (variant % 7) * 0.4 + level * 1.1 + slit * Math.PI;
      parts.push(
        <P
          key={`slit${level}-${slit}`}
          g={geo.box(0.13, 0.42, 0.08)}
          m="window"
          p={[Math.cos(angle) * (radius + 0.01), y + STOREY * 0.55, Math.sin(angle) * (radius + 0.01)]}
          r={[0, -angle + Math.PI / 2, 0]}
        />
      );
    }
  }
  const top = PLINTH + height;
  const coneRoof = variant % 3 !== 2;
  return (
    <group>
      <P g={geo.cyl(radius + 0.14, radius + 0.2, PLINTH, segments)} m="stoneDark" p={[0, PLINTH / 2, 0]} />
      <P g={geo.cyl(radius, radius + 0.04, height, segments)} m="stone" p={[0, PLINTH + height / 2, 0]} />
      {parts}
      <P g={geo.cyl(radius + 0.16, radius, 0.26, segments)} m="stoneTrim" p={[0, top + 0.13, 0]} />
      {coneRoof ? (
        <>
          <P g={geo.cone(radius + 0.26, radius * 2.1, segments)} m="slate" p={[0, top + 0.26 + radius * 1.05, 0]} />
          <P g={geo.cone(0.07, 0.4, 5)} m="gold" p={[0, top + 0.26 + radius * 2.1 + 0.15, 0]} />
        </>
      ) : (
        <>
          <CrenelRing radius={radius + 0.06} y={top + 0.26} count={Math.round(radius * 9)} />
          <Banner p={[0, top + 0.26, 0]} height={1.1} phase={variant} />
        </>
      )}
    </group>
  );
}

function Wall() {
  return (
    <group>
      <P g={geo.box(CELL, PLINTH, 1.0)} m="stoneDark" p={[0, PLINTH / 2, 0]} />
      <P g={geo.box(CELL, WALL_HEIGHT, 0.78)} m="stone" p={[0, PLINTH + WALL_HEIGHT / 2, 0]} />
      <P g={geo.box(CELL, 0.1, 0.96)} m="stoneTrim" p={[0, PLINTH + WALL_HEIGHT, 0]} />
      {[-0.75, 0, 0.75].flatMap((x) => [
        <P key={`a${x}`} g={geo.box(0.36, 0.32, 0.16)} m="stone" p={[x, PLINTH + WALL_HEIGHT + 0.2, 0.4]} />,
        <P key={`b${x}`} g={geo.box(0.36, 0.32, 0.16)} m="stone" p={[x, PLINTH + WALL_HEIGHT + 0.2, -0.4]} />
      ])}
    </group>
  );
}

function Gate({ variant }: { variant: number }) {
  const height = 2.7;
  return (
    <group>
      <P g={geo.box(CELL, PLINTH, 1.5)} m="stoneDark" p={[0, PLINTH / 2, 0]} />
      <P g={geo.box(CELL, height, 1.3)} m="stone" p={[0, PLINTH + height / 2, 0]} />
      <P g={geo.box(0.95, 1.35, 1.34)} m="window" p={[0, PLINTH + 0.67, 0]} />
      <P g={geo.box(0.95, 0.08, 1.36)} m="timberDark" p={[0, PLINTH + 1.15, 0]} />
      <CrenelRect w={CELL} d={1.3} y={PLINTH + height} />
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => (
          <group key={`${sx}${sz}`} position={[sx * 0.85, 0, sz * 0.62]}>
            <P g={geo.cyl(0.32, 0.36, height + 0.9, 8)} m="stone" p={[0, PLINTH + (height + 0.9) / 2, 0]} />
            <P g={geo.cone(0.42, 0.9, 8)} m="slate" p={[0, PLINTH + height + 0.9 + 0.45, 0]} />
          </group>
        ))
      )}
      <Banner p={[0, PLINTH + height, 0]} height={1.1} phase={variant} />
    </group>
  );
}

function Hall({ levels, variant }: { levels: number; variant: number }) {
  const height = STOREY * levels + 0.2;
  const length = 4.1;
  const depth = 1.85;
  const buttresses: ReactNode[] = [];
  for (let index = 0; index < 4; index += 1) {
    const x = -length / 2 + 0.35 + index * ((length - 0.7) / 3);
    buttresses.push(<P key={`n${index}`} g={geo.box(0.22, height * 0.8, 0.22)} m="stoneTrim" p={[x, PLINTH + height * 0.4, -depth / 2 - 0.08]} />);
    buttresses.push(<P key={`s${index}`} g={geo.box(0.22, height * 0.8, 0.22)} m="stoneTrim" p={[x, PLINTH + height * 0.4, depth / 2 + 0.08]} />);
  }
  const windows: ReactNode[] = [];
  for (let level = 0; level < levels; level += 1) {
    for (let index = 0; index < 3; index += 1) {
      const x = -length / 2 + 0.85 + index * ((length - 1.7) / 2);
      const y = PLINTH + level * STOREY + STOREY * 0.55;
      windows.push(<P key={`n${level}-${index}`} g={geo.box(0.28, 0.62, 0.06)} m="window" p={[x, y, -depth / 2 - 0.01]} />);
      windows.push(<P key={`s${level}-${index}`} g={geo.box(0.28, 0.62, 0.06)} m="window" p={[x, y, depth / 2 + 0.01]} />);
    }
  }
  return (
    <group>
      <P g={geo.box(length + 0.25, PLINTH, depth + 0.3)} m="stoneDark" p={[0, PLINTH / 2, 0]} />
      <P g={geo.box(length, height, depth)} m="stone" p={[0, PLINTH + height / 2, 0]} />
      {buttresses}
      {windows}
      <P g={geo.gable(depth + 0.45, 1.25, length + 0.25)} m={variant % 2 ? "slate" : "slateDark"} p={[0, PLINTH + height, 0]} r={[0, Math.PI / 2, 0]} />
      <P g={geo.box(0.3, 0.8, 0.3)} m="stoneTrim" p={[length * 0.28, PLINTH + height + 0.8, 0.35]} />
    </group>
  );
}

function Chapel({ variant }: { variant: number }) {
  const height = STOREY * 1.2;
  const length = 3.9;
  const width = 1.7;
  return (
    <group>
      <P g={geo.box(width + 0.25, PLINTH, length + 0.25)} m="stoneDark" p={[0, PLINTH / 2, 0]} />
      <P g={geo.box(width, height, length)} m="plaster" p={[0, PLINTH + height / 2, 0]} />
      {[-1.1, 0, 1.1].flatMap((z) => [
        <P key={`w${z}`} g={geo.box(0.06, 0.7, 0.26)} m="window" p={[-width / 2 - 0.01, PLINTH + height * 0.55, z - 0.3]} />,
        <P key={`e${z}`} g={geo.box(0.06, 0.7, 0.26)} m="window" p={[width / 2 + 0.01, PLINTH + height * 0.55, z - 0.3]} />
      ])}
      <P g={geo.gable(width + 0.4, 1.3, length - 0.6)} m={variant % 2 ? "terracotta" : "slate"} p={[0, PLINTH + height, -0.3]} />
      <group position={[0, 0, length / 2 - 0.55]}>
        <P g={geo.box(1.05, height + 1.6, 1.05)} m="plaster" p={[0, PLINTH + (height + 1.6) / 2, 0]} />
        <P g={geo.box(0.36, 0.5, 0.06)} m="window" p={[0, PLINTH + height + 1.0, 0.54]} />
        <P g={geo.cone(0.8, 2.4, 4)} m="slate" p={[0, PLINTH + height + 1.6 + 1.2, 0]} r={[0, Math.PI / 4, 0]} />
        <P g={geo.cone(0.06, 0.5, 4)} m="gold" p={[0, PLINTH + height + 1.6 + 2.6, 0]} />
      </group>
      <P g={geo.cyl(0.3, 0.3, 0.06, 10)} m="window" p={[0, PLINTH + height * 0.75, -length / 2 - 0.01]} r={[Math.PI / 2, 0, 0]} />
    </group>
  );
}

function Cottage({ variant }: { variant: number }) {
  const roof: MaterialName = (["terracotta", "thatch", "slateDark"] as const)[variant % 3];
  const w = 1.35;
  const d = 1.1;
  const h = 0.95;
  const beams: ReactNode[] = [];
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      beams.push(<P key={`${sx}${sz}`} g={geo.box(0.09, h, 0.09)} m="timber" p={[(sx * w) / 2, 0.15 + h / 2, (sz * d) / 2]} />);
    }
  }
  return (
    <group rotation={[0, (variant % 4) * 0.08 - 0.12, 0]}>
      <P g={geo.box(w + 0.15, 0.15, d + 0.15)} m="stoneDark" p={[0, 0.075, 0]} />
      <P g={geo.box(w, h, d)} m="plaster" p={[0, 0.15 + h / 2, 0]} />
      {beams}
      <P g={geo.box(w + 0.02, 0.08, d + 0.02)} m="timber" p={[0, 0.15 + h * 0.55, 0]} />
      <P g={geo.box(0.32, 0.55, 0.06)} m="timberDark" p={[0.25, 0.15 + 0.27, d / 2 + 0.01]} />
      <P g={geo.box(0.24, 0.24, 0.06)} m="window" p={[-0.32, 0.15 + h * 0.6, d / 2 + 0.01]} />
      <P g={geo.gable(d + 0.35, 0.8, w + 0.25)} m={roof} p={[0, 0.15 + h, 0]} r={[0, Math.PI / 2, 0]} />
      <P g={geo.box(0.2, 0.55, 0.2)} m="stoneTrim" p={[-w * 0.3, 0.15 + h + 0.5, -0.2]} />
    </group>
  );
}

function Garden({ variant }: { variant: number }) {
  const flowers: ReactNode[] = [];
  const colours: MaterialName[] = ["banner", "gold", "plaster"];
  for (let index = 0; index < 7; index += 1) {
    const angle = index * 2.4 + variant;
    const radius = 0.45 + (index % 3) * 0.18;
    flowers.push(
      <P key={index} g={geo.sphere(0.07)} m={colours[(index + variant) % 3]} p={[Math.cos(angle) * radius, 0.16, Math.sin(angle) * radius]} />
    );
  }
  const hedge = 0.92;
  return (
    <group>
      <P g={geo.box(CELL - 0.15, 0.08, CELL - 0.15)} m="grassDark" p={[0, 0.04, 0]} />
      {[-1, 1].map((side) => (
        <P key={`x${side}`} g={geo.box(CELL - 0.3, 0.26, 0.2)} m="leafDark" p={[0, 0.13, side * hedge]} />
      ))}
      <P g={geo.box(0.2, 0.26, CELL - 0.3)} m="leafDark" p={[-hedge, 0.13, 0]} />
      {flowers}
      <P g={geo.cyl(0.07, 0.1, 0.7, 5)} m="timber" p={[0.35, 0.35, -0.25]} />
      <P g={geo.ico(0.48)} m="leaf" p={[0.35, 0.95, -0.25]} />
    </group>
  );
}

function Well() {
  return (
    <group>
      <P g={geo.box(1.7, 0.06, 1.7)} m="cobble" p={[0, 0.03, 0]} />
      <P g={geo.cyl(0.48, 0.5, 0.5, 8)} m="stone" p={[0, 0.25, 0]} />
      <P g={geo.cyl(0.38, 0.38, 0.04, 8)} m="water" p={[0, 0.48, 0]} />
      <P g={geo.box(0.08, 0.9, 0.08)} m="timber" p={[-0.42, 0.75, 0]} />
      <P g={geo.box(0.08, 0.9, 0.08)} m="timber" p={[0.42, 0.75, 0]} />
      <P g={geo.gable(0.8, 0.4, 1.1)} m="terracotta" p={[0, 1.18, 0]} r={[0, Math.PI / 2, 0]} />
    </group>
  );
}

export function PieceModel({ kind, levels, variant }: { kind: PieceKind; levels: number; variant: number }) {
  switch (kind) {
    case "keep":
      return <Keep levels={levels} variant={variant} />;
    case "tower":
      return <RoundTower levels={levels} variant={variant} radius={0.82} segments={10} />;
    case "greatTower":
      return <RoundTower levels={levels} variant={variant} radius={1.75} segments={14} />;
    case "wall":
      return <Wall />;
    case "gate":
      return <Gate variant={variant} />;
    case "hall":
      return <Hall levels={levels} variant={variant} />;
    case "chapel":
      return <Chapel variant={variant} />;
    case "house":
      return <Cottage variant={variant} />;
    case "garden":
      return <Garden variant={variant} />;
    case "well":
      return <Well />;
  }
}

/** Rough height of a piece, for scaffolding and the construction clip plane. */
export function pieceHeight(kind: PieceKind, levels: number): number {
  switch (kind) {
    case "keep":
      return PLINTH + levels * STOREY + 2.4;
    case "tower":
      return PLINTH + levels * STOREY + 2;
    case "greatTower":
      return PLINTH + levels * STOREY + 4;
    case "wall":
      return PLINTH + WALL_HEIGHT + 0.4;
    case "gate":
      return PLINTH + 4.6;
    case "hall":
      return PLINTH + levels * STOREY + 1.5;
    case "chapel":
      return PLINTH + STOREY * 1.2 + 4.2;
    case "house":
      return 2.2;
    case "garden":
      return 1.4;
    case "well":
      return 1.4;
  }
}

/** Height where a raised storey begins (just above the existing ones). */
export function storeyBase(kind: PieceKind, levels: number): number {
  return PLINTH + (levels - 1) * STOREY;
}

export function Scaffold({ w, d, height, progress }: { w: number; d: number; height: number; progress: number }) {
  const parts: ReactNode[] = [];
  const reach = Math.min(height, height * progress + 0.6);
  const halfW = w / 2 + 0.2;
  const halfD = d / 2 + 0.2;
  const poles: Array<[number, number]> = [];
  const stepsX = Math.max(1, Math.round(w / 1.1));
  const stepsZ = Math.max(1, Math.round(d / 1.1));
  for (let index = 0; index <= stepsX; index += 1) {
    const x = -halfW + (index / stepsX) * halfW * 2;
    poles.push([x, -halfD], [x, halfD]);
  }
  for (let index = 1; index < stepsZ; index += 1) {
    const z = -halfD + (index / stepsZ) * halfD * 2;
    poles.push([-halfW, z], [halfW, z]);
  }
  poles.forEach(([x, z], index) => {
    parts.push(<P key={`p${index}`} g={geo.box(0.07, reach, 0.07)} m="scaffold" p={[x, reach / 2, z]} />);
  });
  for (let y = 0.8; y < reach; y += 0.9) {
    parts.push(<P key={`n${y}`} g={geo.box(halfW * 2, 0.05, 0.16)} m="scaffold" p={[0, y, -halfD]} />);
    parts.push(<P key={`s${y}`} g={geo.box(halfW * 2, 0.05, 0.16)} m="scaffold" p={[0, y, halfD]} />);
    parts.push(<P key={`w${y}`} g={geo.box(0.16, 0.05, halfD * 2)} m="scaffold" p={[-halfW, y, 0]} />);
    parts.push(<P key={`e${y}`} g={geo.box(0.16, 0.05, halfD * 2)} m="scaffold" p={[halfW, y, 0]} />);
  }
  // A pile of stone and a crate waiting at the site.
  parts.push(<P key="pile1" g={geo.box(0.4, 0.3, 0.35)} m="stoneDark" p={[halfW + 0.35, 0.15, halfD - 0.2]} r={[0, 0.4, 0]} />);
  parts.push(<P key="pile2" g={geo.box(0.32, 0.26, 0.3)} m="stone" p={[halfW + 0.3, 0.43, halfD - 0.25]} r={[0, 1.1, 0]} />);
  parts.push(<P key="crate" g={geo.box(0.34, 0.34, 0.34)} m="timber" p={[halfW + 0.35, 0.17, halfD - 0.75]} />);
  return <>{parts}</>;
}

export function Rubble({ w, d, seed }: { w: number; d: number; seed: number }) {
  const stones: ReactNode[] = [];
  for (let index = 0; index < 6; index += 1) {
    const angle = seed + index * 1.7;
    const x = Math.cos(angle) * (w / 2 + 0.25);
    const z = Math.sin(angle) * (d / 2 + 0.25);
    stones.push(
      <P key={index} g={geo.dodeca(0.14 + (index % 3) * 0.05)} m="rubble" p={[x, 0.1, z]} r={[angle, angle * 2, 0]} />
    );
  }
  stones.push(
    <P key="plank" g={geo.box(1.3, 0.06, 0.18)} m="scaffold" p={[w / 2 + 0.2, 0.45, 0]} r={[0, 0.3, 0.6]} />
  );
  return <>{stones}</>;
}
