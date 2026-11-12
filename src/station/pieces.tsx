import { createContext, useContext, useRef, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import type * as THREE from "three";
import { PIECES, type PieceKind } from "./catalog.ts";
import { MATERIALS, geo, type MaterialName, type MaterialSet } from "./materials.ts";

/** Size of one grid cell and one deck, in world units. */
export const CELL = 2.4;
export const DECK = 1.25;
const TUBE = 0.42;
const HALF = CELL / 2;

export const MaterialContext = createContext<MaterialSet>(MATERIALS);

type Vec3 = [number, number, number];

/** One mesh with a shared geometry and a palette material. */
function P({ g, m, p = [0, 0, 0], r, s }: { g: THREE.BufferGeometry; m: MaterialName; p?: Vec3; r?: Vec3; s?: Vec3 }) {
  const materials = useContext(MaterialContext);
  return <mesh geometry={g} material={materials[m]} position={p} rotation={r} scale={s} castShadow receiveShadow />;
}

/** A light that blinks on and off. */
function Blinker({ p, phase = 0, m = "accent" }: { p: Vec3; phase?: number; m?: MaterialName }) {
  const mesh = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (mesh.current) {
      mesh.current.visible = (clock.elapsedTime * 0.8 + phase) % 1.6 < 0.35;
    }
  });
  const materials = useContext(MaterialContext);
  return <mesh ref={mesh} geometry={geo.sphere(0.07, 6)} material={materials[m === "accent" ? "spark" : m]} position={p} />;
}

/** Glowing windows around a cylinder of the given radius. */
function WindowRing({ radius, y, count, size = 0.16 }: { radius: number; y: number; count: number; size?: number }) {
  const windows: ReactNode[] = [];
  for (let index = 0; index < count; index += 1) {
    const angle = (index / count) * Math.PI * 2;
    windows.push(
      <P
        key={index}
        g={geo.box(size, size * 0.8, 0.05)}
        m="window"
        p={[Math.cos(angle) * (radius + 0.01), y, Math.sin(angle) * (radius + 0.01)]}
        r={[0, -angle + Math.PI / 2, 0]}
      />
    );
  }
  return <>{windows}</>;
}

/** Ribs around a horizontal tube running along local x. */
function Ribs({ length, radius, count }: { length: number; radius: number; count: number }) {
  const ribs: ReactNode[] = [];
  for (let index = 0; index < count; index += 1) {
    const x = -length / 2 + (length / (count - 1 || 1)) * index;
    ribs.push(<P key={index} g={geo.cyl(radius + 0.05, radius + 0.05, 0.12, 12)} m="hullShade" p={[x, 0, 0]} r={[0, 0, Math.PI / 2]} />);
  }
  return <>{ribs}</>;
}

/**
 * Collars reaching from a module out to the edge of its cell wherever a neighbour is docked,
 * so connected modules always visibly join.
 */
export function Ports({ kind, linked }: { kind: PieceKind; linked: boolean[] }) {
  const def = PIECES[kind];
  const parts: ReactNode[] = [];
  def.connectors.forEach((connector, index) => {
    if (!linked[index]) {
      return;
    }
    const cx = (connector.x - (def.w - 1) / 2) * CELL;
    const cz = (connector.z - (def.d - 1) / 2) * CELL;
    const dx = [1, 0, -1, 0][connector.dir];
    const dz = [0, 1, 0, -1][connector.dir];
    const along = dx !== 0;
    const rotation: Vec3 = along ? [0, 0, Math.PI / 2] : [Math.PI / 2, 0, 0];
    parts.push(
      <group key={index}>
        <P g={geo.cyl(TUBE * 0.8, TUBE * 0.8, HALF, 10)} m="panel" p={[cx + (dx * HALF) / 2, 0, cz + (dz * HALF) / 2]} r={rotation} />
        <P g={geo.cyl(TUBE + 0.08, TUBE + 0.08, 0.16, 10)} m="graphite" p={[cx + dx * (HALF - 0.08), 0, cz + dz * (HALF - 0.08)]} r={rotation} />
      </group>
    );
  });
  return <>{parts}</>;
}

// ---- modules -----------------------------------------------------------------------------

const CORE_BOTTOM = -0.65;

function Core({ levels, variant }: { levels: number; variant: number }) {
  const height = levels * DECK;
  const decks: ReactNode[] = [];
  for (let level = 0; level < levels; level += 1) {
    const y = CORE_BOTTOM + level * DECK;
    decks.push(<P key={`band${level}`} g={geo.cyl(1.63, 1.63, 0.1, 16)} m="hullShade" p={[0, y + 0.05, 0]} />);
    decks.push(<WindowRing key={`w${level}`} radius={1.55} y={y + DECK * 0.55} count={12} />);
  }
  const top = CORE_BOTTOM + height;
  return (
    <group>
      <P g={geo.cyl(1.55, 1.55, height, 16)} m="hull" p={[0, CORE_BOTTOM + height / 2, 0]} />
      {decks}
      <P g={geo.cyl(1.6, 1.6, 0.14, 16)} m="accent" p={[0, CORE_BOTTOM + 0.35, 0]} />
      <P g={geo.dome(1.55)} m="hullShade" p={[0, top, 0]} s={[1, 0.45, 1]} />
      <P g={geo.cyl(0.05, 0.05, 1.6, 6)} m="truss" p={[0.4, top + 1.0, 0.2]} />
      <P g={geo.dish(0.45)} m="hull" p={[0.4, top + 1.7, 0.2]} r={[Math.PI, 0, 0.5]} />
      <Blinker p={[-0.5, top + 0.75, -0.3]} phase={variant} />
      <P g={geo.cyl(0.9, 1.25, 0.55, 14)} m="graphite" p={[0, CORE_BOTTOM - 0.27, 0]} />
      <P g={geo.cone(0.75, 0.7, 14)} m="truss" p={[0, CORE_BOTTOM - 0.85, 0]} r={[Math.PI, 0, 0]} />
    </group>
  );
}

function Node({ levels, variant }: { levels: number; variant: number }) {
  const towers: ReactNode[] = [];
  for (let level = 1; level < levels; level += 1) {
    const y = 0.45 + (level - 1) * DECK;
    towers.push(
      <group key={level}>
        <P g={geo.cyl(0.62, 0.62, DECK - 0.08, 12)} m="hull" p={[0, y + DECK / 2, 0]} />
        <P g={geo.cyl(0.67, 0.67, 0.08, 12)} m="hullShade" p={[0, y + 0.04, 0]} />
        <WindowRing radius={0.62} y={y + DECK * 0.55} count={6} size={0.13} />
      </group>
    );
  }
  const top = levels > 1 ? 0.45 + (levels - 1) * DECK : 0.6;
  return (
    <group>
      <P g={geo.sphere(0.8, 14)} m="hull" />
      <P g={geo.cyl(0.84, 0.84, 0.12, 14)} m={variant % 3 === 0 ? "accent" : "hullShade"} />
      <WindowRing radius={0.8} y={0.22} count={4} size={0.13} />
      {towers}
      {levels > 1 ? <P g={geo.dome(0.62)} m="hullShade" p={[0, top, 0]} s={[1, 0.6, 1]} /> : null}
      <P g={geo.cyl(0.03, 0.03, 0.7, 5)} m="truss" p={[0.2, top + 0.4, 0]} />
      <Blinker p={[0.2, top + 0.78, 0]} phase={variant * 0.37} />
    </group>
  );
}

function Corridor({ variant }: { variant: number }) {
  if (variant % 4 === 3) {
    // An open truss section with a pipe running through it.
    const struts: ReactNode[] = [];
    for (const [y, z] of [[0.32, 0.32], [0.32, -0.32], [-0.32, 0.32], [-0.32, -0.32]]) {
      struts.push(<P key={`${y}${z}`} g={geo.box(CELL, 0.07, 0.07)} m="truss" p={[0, y, z]} />);
    }
    for (const x of [-0.9, 0, 0.9]) {
      struts.push(<P key={`r${x}`} g={geo.box(0.07, 0.7, 0.7)} m="graphite" p={[x, 0, 0]} />);
    }
    return (
      <group>
        {struts}
        <P g={geo.cyl(0.16, 0.16, CELL, 8)} m="accent" r={[0, 0, Math.PI / 2]} />
      </group>
    );
  }
  return (
    <group>
      <P g={geo.cyl(TUBE, TUBE, CELL, 12)} m="hull" r={[0, 0, Math.PI / 2]} />
      <Ribs length={CELL - 0.2} radius={TUBE} count={3} />
      {[-0.45, 0.45].map((x) => (
        <P key={x} g={geo.box(0.2, 0.12, 0.05)} m="window" p={[x, 0.12, TUBE + 0.01]} />
      ))}
    </group>
  );
}

function Shuttle() {
  return (
    <group>
      <P g={geo.cyl(0.32, 0.36, 1.3, 10)} m="hull" r={[0, 0, Math.PI / 2]} />
      <P g={geo.cone(0.32, 0.55, 10)} m="hull" p={[0.92, 0, 0]} r={[0, 0, -Math.PI / 2]} />
      <P g={geo.box(0.9, 0.05, 1.3)} m="hullShade" p={[-0.15, -0.12, 0]} />
      <P g={geo.box(0.18, 0.08, 0.3)} m="window" p={[0.75, 0.16, 0]} />
      <P g={geo.cyl(0.2, 0.28, 0.3, 8)} m="graphite" p={[-0.78, 0, 0]} r={[0, 0, Math.PI / 2]} />
      <P g={geo.box(0.5, 0.05, 0.05)} m="accent" p={[0, 0.34, 0]} />
    </group>
  );
}

function Dock({ variant }: { variant: number }) {
  return (
    <group>
      <P g={geo.cyl(TUBE, TUBE, CELL, 12)} m="hull" r={[0, 0, Math.PI / 2]} />
      <P g={geo.torus(0.62, 0.14)} m="graphite" r={[0, Math.PI / 2, 0]} />
      <P g={geo.cyl(0.3, 0.3, 0.7, 10)} m="hullShade" p={[0, 0, 0.55]} r={[Math.PI / 2, 0, 0]} />
      <group position={[0, 0, 1.35]} rotation={[0, variant % 2 ? 0 : Math.PI, 0]}>
        <Shuttle />
      </group>
      <Blinker p={[0, 0.65, 0]} phase={variant} />
      <Blinker p={[0, -0.65, 0]} phase={variant + 0.8} />
    </group>
  );
}

function Lab({ levels, variant }: { levels: number; variant: number }) {
  const length = CELL * 2 - 0.5;
  const stripe: MaterialName = variant % 2 ? "accent" : "accentBlue";
  const upper =
    levels > 1 ? (
      <group position={[0, DECK * 0.9, 0]}>
        <P g={geo.cyl(0.52, 0.52, length * 0.75, 12)} m="hull" r={[0, 0, Math.PI / 2]} />
        <Ribs length={length * 0.7} radius={0.52} count={3} />
        <P g={geo.box(0.12, DECK * 0.5, 0.12)} m="truss" p={[0, -DECK * 0.45, 0]} />
      </group>
    ) : null;
  const windows: ReactNode[] = [];
  for (let index = 0; index < 5; index += 1) {
    const x = -length / 2 + 0.6 + index * ((length - 1.2) / 4);
    windows.push(<P key={`a${index}`} g={geo.box(0.22, 0.16, 0.05)} m="window" p={[x, 0.18, 0.72]} />);
    windows.push(<P key={`b${index}`} g={geo.box(0.22, 0.16, 0.05)} m="window" p={[x, 0.18, -0.72]} />);
  }
  return (
    <group>
      <P g={geo.cyl(0.72, 0.72, length, 14)} m="hull" r={[0, 0, Math.PI / 2]} />
      {[-1, 1].map((side) => (
        <P key={side} g={geo.sphere(0.72, 14)} m="hull" p={[side * (length / 2), 0, 0]} s={[0.35, 1, 1]} />
      ))}
      <Ribs length={length - 0.3} radius={0.72} count={5} />
      <P g={geo.cyl(0.74, 0.74, 0.2, 14)} m={stripe} p={[length * 0.18, 0, 0]} r={[0, 0, Math.PI / 2]} />
      {windows}
      {levels === 1 ? (
        <>
          <P g={geo.box(1.4, 0.04, 0.5)} m="panel" p={[-0.6, 0.95, 0]} />
          <P g={geo.box(0.06, 0.25, 0.06)} m="truss" p={[-0.6, 0.8, 0]} />
        </>
      ) : null}
      {upper}
    </group>
  );
}

function Observatory({ variant }: { variant: number }) {
  const length = CELL * 2 - 0.6;
  return (
    <group>
      <P g={geo.cyl(0.6, 0.6, length, 12)} m="hull" r={[Math.PI / 2, 0, 0]} />
      <P g={geo.dome(0.55)} m="glass" p={[0, 0.5, -0.4]} />
      <group position={[0, 0.3, length / 2 - 0.2]} rotation={[-0.6 - (variant % 3) * 0.15, 0, 0]}>
        <P g={geo.cyl(0.4, 0.4, 1.7, 14)} m="hull" p={[0, 0, 0.85]} r={[Math.PI / 2, 0, 0]} />
        <P g={geo.cyl(0.44, 0.44, 0.12, 14)} m="accent" p={[0, 0, 1.7]} r={[Math.PI / 2, 0, 0]} />
        <P g={geo.cyl(0.36, 0.36, 0.02, 14)} m="window" p={[0, 0, 1.76]} r={[Math.PI / 2, 0, 0]} />
      </group>
      <P g={geo.sphere(0.5, 12)} m="graphite" p={[0, 0.25, length / 2 - 0.2]} />
    </group>
  );
}

function SolarArray({ variant }: { variant: number }) {
  const panels: ReactNode[] = [];
  const double = variant % 3 === 1;
  const spans = double ? [-0.62, 0.62] : [0];
  for (const [index, offset] of spans.entries()) {
    const width = double ? 1.05 : 2.1;
    panels.push(
      <group key={index} position={[offset, 0, 0.35]} rotation={[0.18, 0, 0]}>
        <P g={geo.box(width, 0.035, 1.55)} m="solar" />
        <P g={geo.box(width + 0.06, 0.05, 0.05)} m="solarFrame" p={[0, 0, -0.8]} />
        <P g={geo.box(width + 0.06, 0.05, 0.05)} m="solarFrame" p={[0, 0, 0.8]} />
        {[-0.4, 0, 0.4].map((z) => (
          <P key={z} g={geo.box(width, 0.04, 0.02)} m="solarFrame" p={[0, 0.002, z]} />
        ))}
      </group>
    );
  }
  return (
    <group>
      <P g={geo.box(0.12, 0.12, HALF + 0.4)} m="truss" p={[0, 0, -HALF / 2 + 0.2]} />
      <P g={geo.cyl(0.18, 0.18, 0.2, 8)} m="graphite" p={[0, 0, -0.1]} r={[Math.PI / 2, 0, 0]} />
      {panels}
    </group>
  );
}

function Greenhouse({ variant }: { variant: number }) {
  const plants: ReactNode[] = [];
  for (let index = 0; index < 5; index += 1) {
    const angle = index * 1.3 + variant;
    plants.push(
      <P key={index} g={geo.ico(0.18 + (index % 2) * 0.08)} m={index % 2 ? "plant" : "plantDark"} p={[Math.cos(angle) * 0.35, 0.2, Math.sin(angle) * 0.35 + 0.15]} />
    );
  }
  return (
    <group>
      <P g={geo.box(0.16, 0.16, HALF)} m="truss" p={[0, 0, -HALF / 2]} />
      <P g={geo.cyl(0.85, 0.85, 0.22, 14)} m="hullShade" p={[0, 0, 0.15]} />
      {plants}
      <P g={geo.dome(0.82)} m="glass" p={[0, 0.11, 0.15]} />
    </group>
  );
}

function Dish({ variant }: { variant: number }) {
  return (
    <group>
      <P g={geo.box(0.12, 0.12, HALF)} m="truss" p={[0, 0, -HALF / 2]} />
      <P g={geo.cyl(0.06, 0.06, 0.9, 6)} m="truss" p={[0, 0.45, 0.1]} />
      <group position={[0, 1.0, 0.1]} rotation={[-0.7, (variant % 4) * 0.6, 0]}>
        <P g={geo.dish(0.75)} m="hull" r={[Math.PI, 0, 0]} />
        <P g={geo.cyl(0.02, 0.02, 0.6, 4)} m="truss" p={[0, 0.25, 0]} />
        <P g={geo.sphere(0.06, 6)} m="accent" p={[0, 0.55, 0]} />
      </group>
      <Blinker p={[0, 0.35, 0.1]} phase={variant * 0.2} m="alienGlow" />
    </group>
  );
}

function RingHabitat({ levels, variant }: { levels: number; variant: number }) {
  const spin = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (spin.current) {
      spin.current.rotation.y += delta * 0.25;
    }
  });
  const rings: ReactNode[] = [];
  for (let level = 0; level < levels; level += 1) {
    const y = level * 0.9;
    const lights: ReactNode[] = [];
    for (let index = 0; index < 16; index += 1) {
      const angle = (index / 16) * Math.PI * 2;
      lights.push(
        <P key={index} g={geo.box(0.14, 0.1, 0.05)} m="window" p={[Math.cos(angle) * 2.2, y + 0.05, Math.sin(angle) * 2.2]} r={[0, -angle + Math.PI / 2, 0]} />
      );
    }
    rings.push(
      <group key={level}>
        <P g={geo.torus(1.95, 0.26)} m="hull" p={[0, y, 0]} r={[Math.PI / 2, 0, 0]} />
        {lights}
        {[0, 1, 2, 3].map((spoke) => (
          <P key={spoke} g={geo.cyl(0.06, 0.06, 1.95, 6)} m="truss" p={[Math.cos((spoke * Math.PI) / 2) * 0.97, y, Math.sin((spoke * Math.PI) / 2) * 0.97]} r={[0, -(spoke * Math.PI) / 2, Math.PI / 2]} />
        ))}
      </group>
    );
  }
  return (
    <group>
      <P g={geo.cyl(0.55, 0.55, 1.1 + (levels - 1) * 0.9, 12)} m="hullShade" p={[0, ((levels - 1) * 0.9) / 2, 0]} />
      <P g={geo.cyl(0.6, 0.6, 0.12, 12)} m={variant % 2 ? "accent" : "accentBlue"} p={[0, 0.6 + (levels - 1) * 0.9, 0]} />
      <group ref={spin}>{rings}</group>
    </group>
  );
}

export function PieceModel({ kind, levels, variant }: { kind: PieceKind; levels: number; variant: number }) {
  switch (kind) {
    case "core":
      return <Core levels={levels} variant={variant} />;
    case "node":
      return <Node levels={levels} variant={variant} />;
    case "ring":
      return <RingHabitat levels={levels} variant={variant} />;
    case "corridor":
      return <Corridor variant={variant} />;
    case "dock":
      return <Dock variant={variant} />;
    case "lab":
      return <Lab levels={levels} variant={variant} />;
    case "observatory":
      return <Observatory variant={variant} />;
    case "solar":
      return <SolarArray variant={variant} />;
    case "greenhouse":
      return <Greenhouse variant={variant} />;
    case "dish":
      return <Dish variant={variant} />;
  }
}

/** Lowest and highest points of a module, for the assembly frame and the build clip plane. */
export function pieceSpan(kind: PieceKind, levels: number): [number, number] {
  switch (kind) {
    case "core":
      return [CORE_BOTTOM - 1.2, CORE_BOTTOM + levels * DECK + 1.9];
    case "node":
      return [-0.8, (levels > 1 ? 0.45 + (levels - 1) * DECK : 0.6) + 0.85];
    case "ring":
      return [-0.4, 0.7 + (levels - 1) * 0.9];
    case "lab":
      return [-0.75, levels > 1 ? DECK * 0.9 + 0.55 : 1.0];
    case "observatory":
      return [-0.6, 1.6];
    case "solar":
      return [-0.25, 0.3];
    case "greenhouse":
      return [-0.15, 0.95];
    case "dish":
      return [-0.1, 1.7];
    default:
      return [-0.75, 0.75];
  }
}

/** Where a newly added deck starts, for animating it into place. */
export function deckBase(kind: PieceKind, level: number): number {
  switch (kind) {
    case "core":
      return CORE_BOTTOM + (level - 1) * DECK;
    case "node":
      return 0.45 + (level - 2) * DECK;
    case "ring":
      return (level - 1) * 0.9 - 0.3;
    case "lab":
      return DECK * 0.9 - 0.55;
    default:
      return 0;
  }
}

/** The glowing yellow frame drones weld a module inside of. */
export function AssemblyFrame({ w, d, bottom, top, progress }: { w: number; d: number; bottom: number; top: number; progress: number }) {
  const spark = useRef<THREE.Mesh>(null);
  const halfW = w / 2 + 0.15;
  const halfD = d / 2 + 0.15;
  const height = top - bottom;
  const y = bottom + height * progress;
  useFrame(({ clock }) => {
    if (spark.current) {
      const t = clock.elapsedTime;
      spark.current.position.set(Math.sin(t * 1.7) * halfW * 0.8, y, Math.cos(t * 1.3) * halfD * 0.8);
      spark.current.scale.setScalar(0.6 + Math.abs(Math.sin(t * 23)) * 0.8);
    }
  });
  const edges: ReactNode[] = [];
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      edges.push(<P key={`v${sx}${sz}`} g={geo.box(0.05, height, 0.05)} m="frame" p={[sx * halfW, bottom + height / 2, sz * halfD]} />);
    }
  }
  for (const level of [bottom, top]) {
    edges.push(<P key={`x${level}a`} g={geo.box(halfW * 2, 0.05, 0.05)} m="frame" p={[0, level, -halfD]} />);
    edges.push(<P key={`x${level}b`} g={geo.box(halfW * 2, 0.05, 0.05)} m="frame" p={[0, level, halfD]} />);
    edges.push(<P key={`z${level}a`} g={geo.box(0.05, 0.05, halfD * 2)} m="frame" p={[-halfW, level, 0]} />);
    edges.push(<P key={`z${level}b`} g={geo.box(0.05, 0.05, halfD * 2)} m="frame" p={[halfW, level, 0]} />);
  }
  const materials = useContext(MaterialContext);
  return (
    <>
      {edges}
      <P g={geo.box(halfW * 2, 0.03, 0.03)} m="spark" p={[0, y, -halfD]} />
      <P g={geo.box(halfW * 2, 0.03, 0.03)} m="spark" p={[0, y, halfD]} />
      <mesh ref={spark} geometry={geo.sphere(0.09, 6)} material={materials.spark} />
    </>
  );
}

/** Scorch marks and sparks where an alien has been chewing on the hull. */
export function Scorch({ seed }: { seed: number }) {
  const sparks = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (sparks.current) {
      sparks.current.visible = Math.sin(clock.elapsedTime * 9 + seed) > 0.2;
    }
  });
  const marks: ReactNode[] = [];
  for (let index = 0; index < 4; index += 1) {
    const angle = seed + index * 1.9;
    marks.push(
      <P key={index} g={geo.ico(0.28 + (index % 2) * 0.12)} m="scorch" p={[Math.cos(angle) * 0.55, 0.15 + (index % 3) * 0.2, Math.sin(angle) * 0.55]} s={[1, 0.35, 1]} />
    );
  }
  return (
    <>
      {marks}
      <group ref={sparks}>
        <P g={geo.sphere(0.05, 5)} m="spark" p={[0.5, 0.5, 0.2]} />
        <P g={geo.sphere(0.04, 5)} m="spark" p={[0.62, 0.62, 0.1]} />
      </group>
    </>
  );
}

/** A purple alien clamped onto the hull, tentacles out, eyes glowing. */
export function Alien({ seed }: { seed: number }) {
  const body = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (body.current) {
      const t = clock.elapsedTime + seed;
      const pulse = 1 + Math.sin(t * 3) * 0.07;
      body.current.scale.set(pulse, 1 / pulse, pulse);
      body.current.rotation.z = Math.sin(t * 1.3) * 0.12;
    }
  });
  const tentacles: ReactNode[] = [];
  for (let index = 0; index < 6; index += 1) {
    const angle = (index / 6) * Math.PI * 2 + 0.3;
    const segments: ReactNode[] = [];
    for (let link = 0; link < 4; link += 1) {
      const reach = 0.3 + link * 0.2;
      segments.push(
        <P
          key={link}
          g={geo.sphere(0.12 - link * 0.022, 8)}
          m={link === 3 ? "alienGlow" : "alien"}
          p={[Math.cos(angle) * reach, Math.sin(angle) * reach, -0.15 - link * 0.12]}
        />
      );
    }
    tentacles.push(<group key={index}>{segments}</group>);
  }
  // Local -z points at the hull; the body sits just outside it.
  return (
    <group ref={body}>
      <P g={geo.sphere(0.42, 12)} m="alienSkin" s={[1, 0.85, 0.8]} />
      <P g={geo.sphere(0.28, 10)} m="alien" p={[0, 0.25, 0.05]} />
      {[-0.15, 0, 0.15].map((x, index) => (
        <P key={x} g={geo.sphere(index === 1 ? 0.085 : 0.065, 8)} m="alienGlow" p={[x, 0.12 + (index === 1 ? 0.06 : 0), 0.33]} />
      ))}
      {tentacles}
    </group>
  );
}
