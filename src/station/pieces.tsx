import { createContext, useContext, useLayoutEffect, useMemo, useRef, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { PieceKind } from "./catalog.ts";
import { activeDesign } from "./designs.ts";
import { WING_WIDTH, tierCenter } from "./generator.ts";
import { MATERIALS, geo, type MaterialName, type MaterialSet } from "./materials.ts";
import { hash01 } from "./rng.ts";

// A gothic battleship: a dark iron hull with rows of warm windows, a pale armoured prow,
// stacked superstructure and spires, broadside gun decks and brass trim. Every part also has
// five upgrade tiers that add visible detail (see TierDress).

/** Length of one hull segment along the spine, in world units. */
export const CELL = 2.4;

export const MaterialContext = createContext<MaterialSet>(MATERIALS);

type Vec3 = [number, number, number];

/** One mesh with a shared geometry and a palette material. */
function P({ g, m, p = [0, 0, 0], r, s }: { g: THREE.BufferGeometry; m: MaterialName; p?: Vec3; r?: Vec3; s?: Vec3 }) {
  const materials = useContext(MaterialContext);
  return <mesh geometry={g} material={materials[m]} position={p} rotation={r} scale={s} castShadow receiveShadow />;
}

/** A light that blinks on and off. */
function Blinker({ p, phase = 0, m = "beacon" }: { p: Vec3; phase?: number; m?: MaterialName }) {
  const mesh = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (mesh.current) {
      mesh.current.visible = (clock.elapsedTime * 0.8 + phase) % 1.6 < 0.35;
    }
  });
  const materials = useContext(MaterialContext);
  return <mesh ref={mesh} geometry={geo.box(0.09, 0.09, 0.09)} material={materials[m]} position={p} />;
}

/** An octagonal tube along local x, flat faces up and to the sides. */
function OctTube({ length, radius, m = "hull", p = [0, 0, 0] }: { length: number; radius: number; m?: MaterialName; p?: Vec3 }) {
  return <P g={geo.cyl(radius, radius, length, 8)} m={m} p={p} r={[Math.PI / 8, 0, Math.PI / 2]} />;
}

/** Square ribs around a tube along local x. */
function Ribs({ length, size, count }: { length: number; size: number; count: number }) {
  const ribs: ReactNode[] = [];
  for (let index = 0; index < count; index += 1) {
    const x = -length / 2 + (length / (count - 1 || 1)) * index;
    ribs.push(<P key={index} g={geo.chamferBox(0.14, size, size, size * 0.25)} m="graphite" p={[x, 0, 0]} />);
  }
  return <>{ribs}</>;
}

/** Thin dark grooves across a plate, so large surfaces read as panelled metal. */
function PanelLines({ w, d, y, count }: { w: number; d: number; y: number; count: number }) {
  const lines: ReactNode[] = [];
  for (let index = 1; index < count; index += 1) {
    lines.push(<P key={index} g={geo.box(0.025, 0.02, d)} m="graphite" p={[-w / 2 + (w / count) * index, y, 0]} />);
  }
  return <>{lines}</>;
}

// ---- detail kit ----------------------------------------------------------------------------
// Small parts that make hulls read as complex machinery. Greebles are instanced, so a field of
// dozens of boxes costs one draw call.

const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);

/**
 * A field of small boxes (vents, conduits, equipment) scattered over a flat area centred on
 * (0, y, 0), seeded so each module looks different but never changes between renders.
 */
function Greebles({ w, d, y, count, seed, m = "gunmetal", maxSize = 0.22 }: { w: number; d: number; y: number; count: number; seed: number; m?: MaterialName; maxSize?: number }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const materials = useContext(MaterialContext);
  useLayoutEffect(() => {
    if (!mesh.current) {
      return;
    }
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const scale = new THREE.Vector3();
    const rotation = new THREE.Quaternion();
    for (let index = 0; index < count; index += 1) {
      const sx = 0.05 + hash01(seed, index * 5 + 1) * maxSize;
      const sz = 0.05 + hash01(seed, index * 5 + 2) * maxSize;
      const sy = 0.03 + hash01(seed, index * 5 + 3) * maxSize * 0.6;
      position.set((hash01(seed, index * 5 + 4) - 0.5) * (w - sx), y + sy / 2, (hash01(seed, index * 5 + 5) - 0.5) * (d - sz));
      scale.set(sx, sy, sz);
      matrix.compose(position, rotation, scale);
      mesh.current.setMatrixAt(index, matrix);
    }
    mesh.current.instanceMatrix.needsUpdate = true;
    mesh.current.computeBoundingSphere();
  }, [w, d, y, count, seed, maxSize]);
  return <instancedMesh ref={mesh} args={[UNIT_BOX, materials[m], count]} castShadow receiveShadow />;
}

const UNIT_ROD = new THREE.CylinderGeometry(1, 1, 1, 5);
const UP = new THREE.Vector3(0, 1, 0);

/**
 * Thin rods between pairs of points, all in one instanced draw call: struts, lattice
 * bracing, needles and antennas.
 */
function RodSet({ rods, radius, m }: { rods: Array<[Vec3, Vec3]>; radius: number; m: MaterialName }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const materials = useContext(MaterialContext);
  useLayoutEffect(() => {
    if (!mesh.current) {
      return;
    }
    const matrix = new THREE.Matrix4();
    const from = new THREE.Vector3();
    const to = new THREE.Vector3();
    const direction = new THREE.Vector3();
    const rotation = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    rods.forEach(([a, b], index) => {
      from.set(...a);
      to.set(...b);
      direction.subVectors(to, from);
      const length = direction.length();
      rotation.setFromUnitVectors(UP, direction.normalize());
      scale.set(radius, length, radius);
      matrix.compose(from.clone().add(to).multiplyScalar(0.5), rotation, scale);
      mesh.current!.setMatrixAt(index, matrix);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
    mesh.current.computeBoundingSphere();
  }, [rods, radius]);
  return <instancedMesh ref={mesh} args={[UNIT_ROD, materials[m], rods.length]} castShadow />;
}

/** Hex-lattice offsets sorted by distance from the centre, shared by every clump. */
const HEX: Array<[number, number, number]> = (() => {
  const points: Array<[number, number, number]> = [];
  for (let q = -4; q <= 4; q += 1) {
    for (let r = -4; r <= 4; r += 1) {
      const a = q + r / 2;
      const b = (r * Math.sqrt(3)) / 2;
      points.push([a, b, Math.hypot(a, b)]);
    }
  }
  return points.sort((p1, p2) => p1[2] - p2[2] || p1[0] - p2[0] || p1[1] - p2[1]);
})();

/**
 * A dense bundle of parallel rods: hex-packed into a rough round clump, with staggered
 * lengths (the middle ones reach furthest) and starts, so it reads as a sheaf of needles
 * rather than a row. Points along +x (forward), +y (up) or -y (down) from `p`.
 */
function clumpRods(p: Vec3, length: number, count: number, pitch: number, seed: number, axis: "x" | "y" | "-y" = "x"): Array<[Vec3, Vec3]> {
  const rods: Array<[Vec3, Vec3]> = [];
  const used = HEX.slice(0, count);
  const outer = used[used.length - 1]?.[2] || 1;
  used.forEach(([a, b, distance], index) => {
    const reach = length * (0.55 + 0.45 * (1 - distance / (outer + 0.5))) * (0.82 + hash01(seed, index * 3 + 1) * 0.36);
    const back = hash01(seed, index * 3 + 2) * length * 0.12;
    const u = a * pitch;
    const v = b * pitch;
    if (axis === "x") {
      rods.push([[p[0] - back, p[1] + v, p[2] + u], [p[0] + reach, p[1] + v, p[2] + u]]);
    } else {
      const sign = axis === "y" ? 1 : -1;
      rods.push([[p[0] + u, p[1] - sign * back, p[2] + v], [p[0] + u, p[1] + sign * reach, p[2] + v]]);
    }
  });
  return rods;
}

/** A rod clump with collars binding it near the root. */
function RodClump({
  p,
  length,
  count = 10,
  pitch = 0.065,
  radius = 0.02,
  seed,
  axis = "x",
  m = "truss"
}: {
  p: Vec3;
  length: number;
  count?: number;
  pitch?: number;
  radius?: number;
  seed: number;
  axis?: "x" | "y" | "-y";
  m?: MaterialName;
}) {
  const rods = useMemo(() => clumpRods(p, length, count, pitch, seed, axis), [p[0], p[1], p[2], length, count, pitch, seed, axis]);
  const outer = (HEX[Math.max(0, count - 1)]?.[2] ?? 1) * pitch + radius + 0.02;
  const rotation: Vec3 = axis === "x" ? [0, 0, Math.PI / 2] : [0, 0, 0];
  const along = (t: number): Vec3 => (axis === "x" ? [p[0] + t, p[1], p[2]] : [p[0], p[1] + (axis === "y" ? t : -t), p[2]]);
  return (
    <group>
      <RodSet rods={rods} radius={radius} m={m} />
      {[length * 0.08, length * 0.35].map((t) => (
        <P key={t} g={geo.cyl(outer, outer, 0.05, 6)} m="gunmetal" p={along(t)} r={rotation} />
      ))}
    </group>
  );
}

/** Parallel pipe runs along local x with clamp brackets. */
function Pipes({ length, y, z, count = 2, seed }: { length: number; y: number; z: number; count?: number; seed: number }) {
  const parts: ReactNode[] = [];
  for (let index = 0; index < count; index += 1) {
    const radius = 0.035 + hash01(seed, index) * 0.03;
    const offset = index * 0.11;
    parts.push(<P key={`pipe${index}`} g={geo.cyl(radius, radius, length, 6)} m={index === 0 ? "gunmetal" : "truss"} p={[0, y - offset, z]} r={[0, 0, Math.PI / 2]} />);
  }
  for (const x of [-length * 0.35, 0, length * 0.35]) {
    parts.push(<P key={`clamp${x}`} g={geo.box(0.05, count * 0.11 + 0.08, 0.12)} m="graphite" p={[x, y - ((count - 1) * 0.11) / 2, z]} />);
  }
  return <>{parts}</>;
}

/** A dark grille of slats, for vents and radiators. */
function Vent({ w, d, p, r }: { w: number; d: number; p: Vec3; r?: Vec3 }) {
  const slats: ReactNode[] = [];
  const count = Math.max(2, Math.round(w / 0.09));
  for (let index = 0; index < count; index += 1) {
    slats.push(<P key={index} g={geo.box(0.035, 0.03, d)} m="graphite" p={[-w / 2 + (w / (count - 1)) * index, 0, 0]} />);
  }
  return (
    <group position={p} rotation={r}>
      <P g={geo.box(w + 0.06, 0.015, d + 0.06)} m="panel" p={[0, -0.01, 0]} />
      {slats}
    </group>
  );
}

/** Slightly raised, darker plates on a flat surface, so it reads as panelled armour. */
function InsetPanels({ w, d, y, seed, count = 4 }: { w: number; d: number; y: number; seed: number; count?: number }) {
  const panels: ReactNode[] = [];
  for (let index = 0; index < count; index += 1) {
    const pw = w * (0.18 + hash01(seed, index * 3 + 1) * 0.2);
    const pd = d * (0.2 + hash01(seed, index * 3 + 2) * 0.25);
    const px = (hash01(seed, index * 3 + 3) - 0.5) * (w - pw);
    const pz = ((index % 2 ? 1 : -1) * (d - pd)) / 4;
    panels.push(<P key={index} g={geo.chamferBox(pw, 0.03, pd, 0.05)} m={index % 3 === 0 ? "panel" : "hullShade"} p={[px, y + 0.015, pz]} />);
  }
  return <>{panels}</>;
}

// ---- upgrade tiers ---------------------------------------------------------------------------

interface Dims {
  w: number;
  d: number;
  bottom: number;
  top: number;
  /** add-ons like solar blades get lighter dressing */
  small?: boolean;
}

/**
 * Detail added at each upgrade tier, fitted to a module's bounding box:
 *   2 armour plating, 3 red stripes and beacons, 4 gunmetal trim and surface detail,
 *   5 glowing energy lines (and the module grows slightly, see PlacedModel).
 */
function TierDress({ tier, dims, seed }: { tier: number; dims: Dims; seed: number }) {
  if (tier < 2) {
    return null;
  }
  const { w, d, bottom, top, small } = dims;
  const mid = (top + bottom) / 2;
  const height = top - bottom;
  const parts: ReactNode[] = [];

  if (!small) {
    parts.push(<P key="plate-n" g={geo.chamferBox(w * 0.62, height * 0.5, 0.08, 0.06)} m="plate" p={[0, mid, -d / 2 - 0.02]} />);
    parts.push(<P key="plate-s" g={geo.chamferBox(w * 0.62, height * 0.5, 0.08, 0.06)} m="plate" p={[0, mid, d / 2 + 0.02]} />);
  }
  parts.push(<P key="plate-top" g={geo.chamferBox(w * (small ? 0.4 : 0.55), 0.07, d * (small ? 0.35 : 0.5), 0.1)} m="panel" p={[0, top + 0.03, 0]} />);

  if (tier >= 3) {
    if (!small) {
      parts.push(<P key="stripe-n" g={geo.box(w * 0.64, 0.07, 0.1)} m="accent" p={[0, mid + height * 0.12, -d / 2 - 0.06]} />);
      parts.push(<P key="stripe-s" g={geo.box(w * 0.64, 0.07, 0.1)} m="accent" p={[0, mid + height * 0.12, d / 2 + 0.06]} />);
    }
    parts.push(<P key="stripe-top" g={geo.box(w * (small ? 0.3 : 0.5), 0.04, 0.08)} m="accent" p={[0, top + 0.08, 0]} />);
    parts.push(<Blinker key="b1" p={[w / 2, top, -d / 2]} phase={seed * 0.13} />);
    parts.push(<Blinker key="b2" p={[-w / 2, top, d / 2]} phase={seed * 0.13 + 0.8} />);
  }

  if (tier >= 4) {
    parts.push(<P key="trim-n" g={geo.box(w * 0.9, 0.06, 0.06)} m="gunmetal" p={[0, top + 0.03, -d * 0.45]} />);
    parts.push(<P key="trim-s" g={geo.box(w * 0.9, 0.06, 0.06)} m="gunmetal" p={[0, top + 0.03, d * 0.45]} />);
    for (let index = 0; index < (small ? 1 : 3); index += 1) {
      const gx = (hash01(seed, index * 7 + 1) - 0.5) * w * 0.6;
      const gz = (hash01(seed, index * 7 + 2) - 0.5) * d * 0.4;
      const size = 0.08 + hash01(seed, index * 7 + 3) * 0.14;
      parts.push(<P key={`greeble${index}`} g={geo.box(size, size * 0.7, size * 1.3)} m="gunmetal" p={[gx, top + 0.07 + size * 0.35, gz]} />);
    }
    parts.push(<P key="mast" g={geo.box(0.03, 0.6, 0.03)} m="truss" p={[w * 0.3, top + 0.35, 0]} />);
  }

  if (tier >= 5) {
    if (!small) {
      parts.push(<P key="energy-n" g={geo.box(w * 0.7, 0.03, 0.03)} m="energy" p={[0, mid - height * 0.15, -d / 2 - 0.08]} />);
      parts.push(<P key="energy-s" g={geo.box(w * 0.7, 0.03, 0.03)} m="energy" p={[0, mid - height * 0.15, d / 2 + 0.08]} />);
    }
    parts.push(<P key="energy-top" g={geo.box(0.03, 0.03, d * 0.55)} m="energy" p={[0, top + 0.09, 0]} />);
    parts.push(<P key="crown" g={geo.cone(0.06, 0.25, 4)} m="energy" p={[w * 0.3, top + 0.78, 0]} />);
  }

  return <>{parts}</>;
}

// ---- ship parts --------------------------------------------------------------------------
// Everything is modelled in ship coordinates: bow at +x, deck top at y = DECK_TOP, keel below.

const DECK_TOP = 0.7;
const KEEL = -1.0;
const HULL_HALF = 1.5;
const TOWER_DECK = 0.8;
const SUPER_DECK = 0.75;

/** The hull's cross-section seen from the bow: flat deck, straight flanks, tapering keel. */
const HULL_SECTION: Array<[number, number]> = [
  [-HULL_HALF, DECK_TOP],
  [HULL_HALF, DECK_TOP],
  [HULL_HALF, -0.25],
  [0.95, KEEL],
  [-0.95, KEEL],
  [-HULL_HALF, -0.25]
];

/** An instanced row of identical small boxes: lit windows, crenellations, rivets. */
function BoxRow({ from, to, count, size, m, gapEvery = 0 }: { from: Vec3; to: Vec3; count: number; size: Vec3; m: MaterialName; gapEvery?: number }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const materials = useContext(MaterialContext);
  const placed = gapEvery ? count - Math.floor(count / gapEvery) : count;
  useLayoutEffect(() => {
    if (!mesh.current) {
      return;
    }
    const matrix = new THREE.Matrix4();
    let slot = 0;
    for (let index = 0; index < count; index += 1) {
      if (gapEvery && index % gapEvery === gapEvery - 1) {
        continue;
      }
      const t = count === 1 ? 0.5 : index / (count - 1);
      matrix.makeScale(size[0], size[1], size[2]);
      matrix.setPosition(from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t, from[2] + (to[2] - from[2]) * t);
      mesh.current.setMatrixAt(slot, matrix);
      slot += 1;
    }
    mesh.current.instanceMatrix.needsUpdate = true;
    mesh.current.computeBoundingSphere();
  }, [from, to, count, size, gapEvery]);
  return <instancedMesh ref={mesh} args={[UNIT_BOX, materials[m], placed]} castShadow={m !== "window"} receiveShadow />;
}

/** Rows of warm windows along both flanks of a hull length. */
function FlankWindows({ length, rows, top = 0.38, z = HULL_HALF + 0.01 }: { length: number; rows: number; top?: number; z?: number }) {
  const count = Math.max(3, Math.round(length / 0.2));
  const parts: ReactNode[] = [];
  for (let row = 0; row < rows; row += 1) {
    const y = top - row * 0.3;
    for (const side of [-1, 1]) {
      parts.push(
        <BoxRow key={`${row}${side}`} from={[-length / 2 + 0.15, y, side * z]} to={[length / 2 - 0.15, y, side * z]} count={count} size={[0.07, 0.12, 0.03]} m="window" gapEvery={5} />
      );
    }
  }
  return <>{parts}</>;
}

/** Crenellated railings along both deck edges. */
function DeckRails({ length, z = HULL_HALF - 0.08, y = DECK_TOP }: { length: number; z?: number; y?: number }) {
  const count = Math.max(3, Math.round(length / 0.28));
  return (
    <>
      {[-1, 1].map((side) => (
        <BoxRow key={side} from={[-length / 2 + 0.1, y + 0.09, side * z]} to={[length / 2 - 0.1, y + 0.09, side * z]} count={count} size={[0.12, 0.18, 0.1]} m="hullShade" />
      ))}
    </>
  );
}

/** Vertical ribs on both flanks, trimmed in brass. */
function Buttresses({ xs }: { xs: number[] }) {
  return (
    <>
      {xs.flatMap((x) =>
        [-1, 1].map((side) => (
          <group key={`${x}${side}`} position={[x, -0.1, side * (HULL_HALF + 0.12)]}>
            <P g={geo.chamferBox(0.18, 1.45, 0.26, 0.06)} m="hullShade" />
            <P g={geo.box(0.05, 1.4, 0.04)} m="gold" p={[0, 0, side * 0.14]} />
            <P g={geo.cone(0.1, 0.35, 4)} m="hullShade" p={[0, 0.88, 0]} />
          </group>
        ))
      )}
    </>
  );
}

/** A plain hull length: the spine of the ship. */
function HullBody({ length, variant, windows = 2 }: { length: number; variant: number; windows?: number }) {
  return (
    <group>
      <P g={geo.section(HULL_SECTION, length, 0.05)} m="hull" />
      <P g={geo.box(length, 0.04, HULL_HALF * 2 - 0.3)} m="hullShade" p={[0, DECK_TOP + 0.02, 0]} />
      <PanelLines w={length} d={HULL_HALF * 2 - 0.4} y={DECK_TOP + 0.045} count={Math.max(2, Math.round(length / 0.8))} />
      <DeckRails length={length} />
      <FlankWindows length={length} rows={windows} />
      {[-1, 1].map((side) => (
        <P key={side} g={geo.box(length, 0.05, 0.03)} m="gold" p={[0, DECK_TOP - 0.04, side * (HULL_HALF + 0.01)]} />
      ))}
      <P g={geo.box(length * 0.92, 0.32, 0.14)} m="graphite" p={[0, KEEL - 0.14, 0]} />
      <Greebles w={length * 0.8} d={HULL_HALF * 2 - 0.6} y={DECK_TOP + 0.04} count={Math.round(length * 4)} seed={variant + 1} maxSize={0.16} />
    </group>
  );
}

/** The bridge section: a long hull carrying the stepped command tower. */
function Core({ levels, variant }: { levels: number; variant: number }) {
  const length = CELL * 2;
  const tiers: ReactNode[] = [];
  for (let level = 0; level < levels; level += 1) {
    const w = 3.1 - level * 0.38;
    const d = 2.5 - level * 0.3;
    const y = DECK_TOP + level * TOWER_DECK;
    const x = -0.5 - level * 0.12;
    tiers.push(
      <group key={level} position={[x, y, 0]}>
        <P g={geo.chamferBox(w, TOWER_DECK - 0.04, d, 0.28)} m={level % 2 ? "hullShade" : "hull"} p={[0, TOWER_DECK / 2, 0]} />
        <BoxRow from={[-w / 2 + 0.25, TOWER_DECK * 0.55, d / 2 + 0.01]} to={[w / 2 - 0.25, TOWER_DECK * 0.55, d / 2 + 0.01]} count={Math.round(w / 0.18)} size={[0.06, 0.22, 0.03]} m="window" gapEvery={4} />
        <BoxRow from={[-w / 2 + 0.25, TOWER_DECK * 0.55, -d / 2 - 0.01]} to={[w / 2 - 0.25, TOWER_DECK * 0.55, -d / 2 - 0.01]} count={Math.round(w / 0.18)} size={[0.06, 0.22, 0.03]} m="window" gapEvery={4} />
        <BoxRow from={[-w / 2 + 0.12, TOWER_DECK + 0.07, d / 2 - 0.05]} to={[w / 2 - 0.12, TOWER_DECK + 0.07, d / 2 - 0.05]} count={Math.round(w / 0.25)} size={[0.1, 0.14, 0.08]} m="hullShade" />
        <BoxRow from={[-w / 2 + 0.12, TOWER_DECK + 0.07, -d / 2 + 0.05]} to={[w / 2 - 0.12, TOWER_DECK + 0.07, -d / 2 + 0.05]} count={Math.round(w / 0.25)} size={[0.1, 0.14, 0.08]} m="hullShade" />
        {/* corner spirelets on every tier */}
        {[-1, 1].flatMap((sx) =>
          [-1, 1].map((sz) => (
            <group key={`${sx}${sz}`} position={[sx * (w / 2 - 0.1), TOWER_DECK, sz * (d / 2 - 0.1)]}>
              <P g={geo.cyl(0.08, 0.1, 0.3, 6)} m="hullShade" p={[0, 0.15, 0]} />
              <P g={geo.cone(0.1, 0.45, 4)} m="hull" p={[0, 0.52, 0]} />
            </group>
          ))
        )}
      </group>
    );
  }
  const top = DECK_TOP + levels * TOWER_DECK;
  const crownX = -0.5 - levels * 0.12;
  return (
    <group>
      <HullBody length={length} variant={variant} />
      <Buttresses xs={[-length / 2 + 0.2, length / 2 - 0.2]} />
      {tiers}
      {/* bridge crown and command spire */}
      <group position={[crownX, top, 0]}>
        <P g={geo.chamferBox(1.1, 0.5, 1.3, 0.2)} m="hull" p={[0, 0.25, 0]} />
        <P g={geo.box(0.04, 0.1, 1.0)} m="window" p={[0.56, 0.3, 0]} />
        <P g={geo.box(1.15, 0.05, 1.35)} m="gold" p={[0, 0.52, 0]} />
        <P g={geo.cyl(0.22, 0.32, 0.8, 6)} m="hullShade" p={[0, 0.95, 0]} />
        <P g={geo.cone(0.24, 1.7, 4)} m="hull" p={[0, 2.2, 0]} />
        <P g={geo.box(0.03, 0.4, 0.03)} m="gold" p={[0, 3.2, 0]} />
        {[-1, 1].map((side) => (
          <group key={side} position={[-0.3, 0.5, side * 0.5]}>
            <P g={geo.cyl(0.1, 0.14, 0.6, 6)} m="hullShade" p={[0, 0.3, 0]} />
            <P g={geo.cone(0.12, 0.9, 4)} m="hull" p={[0, 1.05, 0]} />
          </group>
        ))}
        <Blinker p={[0, 3.45, 0]} phase={variant} />
      </group>
      {/* flying buttresses from the deck up to the first tier */}
      {[-1, 1].map((side) => (
        <P key={side} g={geo.box(1.6, 0.12, 0.12)} m="hullShade" p={[-0.5, DECK_TOP + 0.45, side * 1.25]} r={[side * 0.5, 0, 0]} />
      ))}
    </group>
  );
}

function Hull({ variant }: { variant: number }) {
  return (
    <group>
      <HullBody length={CELL} variant={variant} />
      <Buttresses xs={[CELL / 2 - 0.15]} />
    </group>
  );
}

/** The stern: engine housings with glowing nozzles and tall fins. */
function Engines({ variant }: { variant: number }) {
  const length = CELL;
  const nozzles: Array<[number, number]> = [
    [-0.75, 0.15],
    [0.75, 0.15],
    [-0.75, -0.55],
    [0.75, -0.55],
    [0, -0.2]
  ];
  return (
    <group>
      <P g={geo.section(HULL_SECTION.map(([z, y]) => [z * 1.08, y * 1.05]), length, 0.05)} m="hull" />
      <DeckRails length={length} z={HULL_HALF * 1.08 - 0.08} />
      <FlankWindows length={length} rows={1} z={HULL_HALF * 1.08 + 0.01} />
      <Greebles w={length * 0.7} d={2.4} y={DECK_TOP + 0.04} count={10} seed={variant + 2} maxSize={0.2} />
      {nozzles.map(([z, y]) => (
        <group key={`${z}${y}`} position={[-length / 2 - 0.25, y, z]}>
          <P g={geo.cyl(0.42, 0.34, 0.6, 8)} m="gunmetal" r={[Math.PI / 8, 0, Math.PI / 2]} />
          <P g={geo.cyl(0.46, 0.46, 0.08, 8)} m="gold" p={[0.22, 0, 0]} r={[Math.PI / 8, 0, Math.PI / 2]} />
          <P g={geo.cyl(0.3, 0.3, 0.04, 8)} m="engine" p={[-0.31, 0, 0]} r={[Math.PI / 8, 0, Math.PI / 2]} />
        </group>
      ))}
      {[-1, 1].map((side) => (
        <P key={side} g={geo.prism([[0.9, 0], [-1.3, 0], [-1.6, 0.06], [-0.6, 0.06]].map(([x, z]) => [x, z * side - side * 0.03]) as Array<[number, number]>, 1.6, 0.03)} m="hullShade" p={[0, DECK_TOP + 0.8, side * 0.9]} r={[0, 0, 0]} />
      ))}
      <P g={geo.prism([[0.6, -0.04], [-1.2, -0.04], [-1.2, 0.04], [0.6, 0.04]], 2.0, 0.03)} m="hull" p={[-0.2, DECK_TOP + 1.0, 0]} />
      <Blinker p={[-1.2, DECK_TOP + 2.05, 0]} phase={variant + 0.5} />
    </group>
  );
}

/** The armoured prow: a long pale blade with an iron ridge and a ram keel. */
function Prow({ variant }: { variant: number }) {
  const blade: Array<[number, number]> = [
    [-2.4, -HULL_HALF],
    [0.3, -1.42],
    [2.6, -0.5],
    [3.3, 0],
    [2.6, 0.5],
    [0.3, 1.42],
    [-2.4, HULL_HALF]
  ];
  const ridge: Array<[number, number]> = [
    [-2.4, -0.55],
    [1.4, -0.3],
    [2.9, 0],
    [1.4, 0.3],
    [-2.4, 0.55]
  ];
  const keel: Array<[number, number]> = [
    [-2.4, -0.95],
    [0.6, -0.8],
    [3.6, 0],
    [0.6, 0.8],
    [-2.4, 0.95]
  ];
  return (
    <group>
      <P g={geo.prism(blade, 1.0, 0.06)} m="bone" p={[0, 0.2, 0]} />
      {/* stepped armour strakes, so the blade reads as layered plate rather than one wedge */}
      {[0.88, 0.74, 0.58].map((k, index) => (
        <P
          key={k}
          g={geo.prism(blade.map(([x, z]): [number, number] => [x * k + (1 - k) * 0.6, z * k]), 0.06, 0.02)}
          m={index % 2 ? "hullShade" : "hull"}
          p={[0, 0.73 + index * 0.045, 0]}
        />
      ))}
      <P g={geo.prism(ridge, 0.3, 0.05)} m="hull" p={[0, 0.82, 0]} />
      <P g={geo.prism(keel, 0.75, 0.05)} m="hull" p={[0, -0.62, 0]} />
      {/* brass seams and panel joints across the blade */}
      {[-1.4, -0.3, 0.8, 1.8].map((x) => (
        <P key={x} g={geo.box(0.04, 0.03, 2.6 - Math.max(0, x) * 0.75)} m="gold" p={[x, 0.71, 0]} />
      ))}
      {[-1, 1].map((side) => (
        <P key={side} g={geo.box(3.2, 0.04, 0.04)} m="gold" p={[0.3, 0.3, side * 1.2]} r={[0, side * 0.2, 0]} />
      ))}
      <P g={geo.prism([[1.2, -0.04], [3.0, -0.02], [3.0, 0.02], [1.2, 0.04]], 0.7, 0.02)} m="hull" p={[0, 1.2, 0]} />
      <FlankWindows length={1.6} rows={1} top={0.15} z={1.45} />
      <Blinker p={[3.25, 0.3, 0]} phase={variant} />
    </group>
  );
}

// Wing parts are modelled for one side, centred on their tier with +z pointing outward;
// PieceModel mirrors them onto both flanks.
const WING_HALF = WING_WIDTH / 2 + 0.02;
/** Deck height of an escort ship, for parts mounted on top of one. */
const ESCORT_TOP = 0.42;
const ESCORT_SECTION: Array<[number, number]> = [
  [-0.45, 0.12],
  [-0.3, 0.4],
  [0.3, 0.4],
  [0.45, 0.12],
  [0.45, -0.15],
  [0.28, -0.38],
  [-0.28, -0.38],
  [-0.45, -0.15]
];

/**
 * An escort ship docked along the flank. The design picks which classes appear; each escort
 * also gets a small seeded nudge in length, height and heading so rows never look stamped out.
 * Modelled with +x forward and +z outboard; struts clamp it to the ship inboard (toward -z).
 */
function Wing({ variant, aft, rise }: { variant: number; aft: boolean; rise: number }) {
  const classes = activeDesign().escorts;
  const kind = classes[variant % classes.length];
  const length = 0.85 + hash01(variant, 1) * 0.25;
  const lift = (hash01(variant, 2) - 0.5) * 0.24;
  const yaw = (hash01(variant, 3) - 0.5) * 0.08;
  const struts = useMemo<Array<[Vec3, Vec3]>>(
    () => [
      [[-0.65, 0, -0.3], [-0.65, -lift - rise, -WING_HALF - 0.05]],
      [[0.15, 0, -0.3], [0.15, -lift - rise, -WING_HALF - 0.05]],
      [[-0.65, 0.2, -0.3], [0.15, -0.05 - lift - rise, -WING_HALF - 0.05]]
    ],
    [lift, rise]
  );
  // A raised or lowered escort hangs from a pylon down (or up) to the deck inboard of it.
  const pylon =
    Math.abs(rise) > 0.1 ? <P g={geo.box(0.5, Math.abs(rise) + 0.3, 0.16)} m="hullShade" p={[-0.25, -rise / 2, -WING_HALF + 0.05]} /> : null;
  let ship: ReactNode;
  switch (kind) {
    case "hauler":
      ship = <Hauler variant={variant} />;
      break;
    case "lancer":
      ship = <Lancer variant={variant} />;
      break;
    case "cruiser":
      ship = <Cruiser variant={variant} />;
      break;
    default:
      ship = <Frigate variant={variant} aft={aft} />;
  }
  return (
    <group>
      <group position={[0, lift, 0]} rotation={[0, yaw, 0]} scale={[length, 1, 1]}>
        {ship}
        {activeDesign().escortNeedles ? <FlankNeedles variant={variant} /> : null}
      </group>
      <RodSet rods={struts} radius={0.035} m="truss" />
      {pylon}
    </group>
  );
}

/**
 * Forward needle clumps carried along an escort: one down the outboard flank and a smaller one
 * on the dorsal line, both reaching past the bow.
 */
function FlankNeedles({ variant }: { variant: number }) {
  const reach = 2.1 + hash01(variant, 7) * 0.5;
  return (
    <group>
      <RodClump p={[-0.8, 0.0, 0.66]} length={reach} count={12} seed={variant} />
      <RodClump p={[-0.5, 0.56, 0]} length={reach - 0.4} count={10} seed={variant + 9} />
    </group>
  );
}

/** A box-hulled hauler with stacked cargo containers and a forward cab. */
function Hauler({ variant }: { variant: number }) {
  const colours: MaterialName[] = ["accent", "accentBlue", "hullShade", "bone", "gold"];
  const containers: ReactNode[] = [];
  for (let column = 0; column < 3; column += 1) {
    for (let row = 0; row < 2; row += 1) {
      const stacked = hash01(variant, column * 2 + row) > 0.45 ? 2 : 1;
      for (let level = 0; level < stacked; level += 1) {
        containers.push(
          <P
            key={`${column}${row}${level}`}
            g={geo.box(0.42, 0.22, 0.32)}
            m={colours[Math.floor(hash01(variant, column * 5 + row * 3 + level) * colours.length)]}
            p={[-0.75 + column * 0.45, 0.42 + level * 0.23, -0.17 + row * 0.34]}
          />
        );
      }
    }
  }
  return (
    <group>
      <P g={geo.chamferBox(1.7, 0.6, 0.8, 0.12)} m="hull" p={[-0.2, 0, 0]} />
      <P g={geo.chamferBox(0.45, 0.5, 0.7, 0.12)} m="hullShade" p={[0.75, 0.05, 0]} />
      <P g={geo.box(0.04, 0.08, 0.5)} m="window" p={[0.98, 0.15, 0]} />
      {containers}
      <BoxRow from={[-1.0, -0.1, 0.41]} to={[0.4, -0.1, 0.41]} count={8} size={[0.05, 0.07, 0.02]} m="window" />
      {[-0.2, 0.2].map((z) => (
        <group key={z} position={[-1.12, 0, z]}>
          <P g={geo.cyl(0.16, 0.13, 0.2, 8)} m="gunmetal" r={[Math.PI / 8, 0, Math.PI / 2]} />
          <P g={geo.cyl(0.11, 0.11, 0.03, 8)} m="engine" p={[-0.11, 0, 0]} r={[Math.PI / 8, 0, Math.PI / 2]} />
        </group>
      ))}
    </group>
  );
}

/** A long, thin lancer with twin engines. */
function Lancer({ variant }: { variant: number }) {
  return (
    <group>
      <OctTube length={2.0} radius={0.2} />
      <P g={geo.cone(0.2, 0.5, 8)} m="bone" p={[1.25, 0, 0]} r={[Math.PI / 8, 0, -Math.PI / 2]} />
      {[-1, 1].map((side) => (
        <group key={side}>
          <OctTube length={1.2} radius={0.12} m="hullShade" p={[-0.4, 0, side * 0.27]} />
          <P g={geo.cyl(0.08, 0.08, 0.03, 8)} m="engine" p={[-1.02, 0, side * 0.27]} r={[Math.PI / 8, 0, Math.PI / 2]} />
          <P g={geo.prism([[-0.9, side * 0.05], [-0.2, side * 0.05], [-0.7, side * 0.55], [-0.95, side * 0.55]], 0.03, 0.01)} m="graphite" />
        </group>
      ))}
      <BoxRow from={[-0.6, 0.1, 0.205]} to={[0.6, 0.1, 0.205]} count={8} size={[0.05, 0.06, 0.02]} m="window" />
      <P g={geo.box(0.6, 0.03, 0.03)} m="gold" p={[0.6, 0.2, 0]} />
      <Greebles w={1.0} d={0.2} y={0.18} count={4} seed={variant} maxSize={0.08} />
    </group>
  );
}

/** A broader cruiser with a small command tower and antenna rods. */
function Cruiser({ variant }: { variant: number }) {
  return (
    <group>
      <group position={[-0.25, 0, 0]} scale={[1, 1.15, 1.25]}>
        <P g={geo.section(ESCORT_SECTION, 1.5, 0.04)} m="hull" />
      </group>
      <P g={geo.prism([[0.5, -0.5], [1.1, 0], [0.5, 0.5]], 0.55, 0.03)} m="bone" p={[0, 0.02, 0]} />
      <P g={geo.chamferBox(0.6, 0.45, 0.5, 0.12)} m="hullShade" p={[-0.35, 0.68, 0]} />
      <P g={geo.box(0.04, 0.07, 0.4)} m="window" p={[-0.04, 0.75, 0]} />
      <P g={geo.cone(0.07, 0.7, 4)} m="hull" p={[-0.45, 1.25, 0]} />
      <RodSet
        rods={[
          [[-0.6, 0.9, 0.15], [-0.6, 1.6, 0.15]],
          [[-0.25, 0.9, -0.15], [-0.25, 1.45, -0.15]],
          [[0.2, 0.47, 0], [0.9, 0.5, 0]]
        ]}
        radius={0.02}
        m="truss"
      />
      <BoxRow from={[-0.9, 0.15, 0.565]} to={[0.4, 0.15, 0.565]} count={10} size={[0.06, 0.09, 0.03]} m="window" gapEvery={5} />
      <P g={geo.cyl(0.58, 0.58, 0.07, 8)} m="gold" p={[0.45, 0, 0]} r={[Math.PI / 8, 0, Math.PI / 2]} />
      {[-0.22, 0.22].map((z) => (
        <group key={z} position={[-1.2, 0, z]}>
          <P g={geo.cyl(0.2, 0.16, 0.22, 8)} m="gunmetal" r={[Math.PI / 8, 0, Math.PI / 2]} />
          <P g={geo.cyl(0.14, 0.14, 0.03, 8)} m="engine" p={[-0.12, 0, 0]} r={[Math.PI / 8, 0, Math.PI / 2]} />
        </group>
      ))}
      <Greebles w={0.8} d={0.5} y={0.45} count={5} seed={variant + 2} maxSize={0.1} />
    </group>
  );
}

/** The classic escort: a slim hull with a pale pointed bow, a glowing engine and a needle antenna. */
function Frigate({ variant, aft }: { variant: number; aft: boolean }) {
  const rods = useMemo<Array<[Vec3, Vec3]>>(
    () => [
      [[0.95, 0.03, 0], [1.3, 0.06, 0]],
      [[-0.2, 0.42, 0.1], [-0.35, 1.0 + (variant % 3) * 0.2, 0.12]]
    ],
    [variant]
  );
  return (
    <group>
      <RodSet rods={rods} radius={0.03} m="truss" />
      <group position={[-0.3, 0, 0]}>
        <P g={geo.section(ESCORT_SECTION, 1.4, 0.04)} m="hull" />
        <BoxRow from={[-0.55, 0.12, 0.455]} to={[0.55, 0.12, 0.455]} count={9} size={[0.06, 0.09, 0.03]} m="window" gapEvery={4} />
        <P g={geo.cyl(0.47, 0.47, 0.07, 8)} m="gold" p={[0.45, 0, 0]} r={[Math.PI / 8, 0, Math.PI / 2]} />
        <P g={geo.chamferBox(0.65, 0.3, 0.06, 0.04)} m="hullShade" p={[-0.25, 0.52, 0]} />
        <Greebles w={0.9} d={0.4} y={0.4} count={5} seed={variant + 4} maxSize={0.1} />
      </group>
      <P g={geo.prism([[0.4, -0.42], [0.95, 0], [0.4, 0.42]], 0.5, 0.03)} m="bone" p={[0, 0.02, 0]} />
      <group position={[-1.05, 0, 0]}>
        <P g={geo.cyl(0.28, 0.22, 0.25, 8)} m="gunmetal" r={[Math.PI / 8, 0, Math.PI / 2]} />
        <P g={geo.cyl(0.19, 0.19, 0.03, 8)} m="engine" p={[-0.13, 0, 0]} r={[Math.PI / 8, 0, Math.PI / 2]} />
      </group>
      {aft ? <P g={geo.cyl(0.2, 0.2, 0.03, 8)} m="engine" p={[-1.2, 0, 0]} r={[Math.PI / 8, 0, Math.PI / 2]} /> : null}
    </group>
  );
}

/** A lattice mast: an open, tapering truss tower with cross-bracing, yards and an antenna. */
function Mast({ variant }: { variant: number }) {
  const height = 2.6 + (variant % 3) * 0.7;
  const rods = useMemo(() => {
    const list: Array<[Vec3, Vec3]> = [];
    const corner = (y: number, sx: number, sz: number): Vec3 => {
      const half = 0.2 - (y / height) * 0.11;
      return [sx * half, DECK_TOP + y, sz * half];
    };
    const corners: Array<[number, number]> = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    for (const [sx, sz] of corners) {
      list.push([corner(0, sx, sz), corner(height, sx, sz)]);
    }
    const step = 0.45;
    for (let y = 0; y + step <= height; y += step) {
      corners.forEach(([sx, sz], index) => {
        const [nx, nz] = corners[(index + 1) % 4];
        list.push([corner(y, sx, sz), corner(y + step, nx, nz)]);
      });
    }
    // Yards: horizontal rods across the mast at a few heights.
    for (const fraction of [0.45, 0.7, 0.9]) {
      const y = DECK_TOP + height * fraction;
      const reach = 0.55 - fraction * 0.25;
      list.push([[-reach, y, 0], [reach, y, 0]]);
    }
    list.push([[0, DECK_TOP + height, 0], [0, DECK_TOP + height + 1.1, 0]]);
    return list;
  }, [height]);
  return (
    <group>
      <P g={geo.chamferBox(0.6, 0.15, 0.6, 0.12)} m="gunmetal" p={[0, DECK_TOP + 0.07, 0]} />
      <RodSet rods={rods} radius={0.025} m="truss" />
      <P g={geo.box(0.36, 0.05, 0.36)} m="hullShade" p={[0, DECK_TOP + height * 0.62, 0]} />
      <P g={geo.box(0.05, 0.05, 0.05)} m="gold" p={[0, DECK_TOP + height + 1.12, 0]} />
      <Blinker p={[0, DECK_TOP + height + 0.3, 0]} phase={variant * 0.31} />
    </group>
  );
}

/**
 * A needle array: three dense clumps of parallel rods pointing forward along the ship, bound by
 * collars near the root, the middle clump the largest.
 */
function Needles({ variant }: { variant: number }) {
  const length = 2.4 + (variant % 3) * 0.25;
  const base = DECK_TOP + 0.42;
  return (
    <group>
      <P g={geo.chamferBox(0.8, 0.3, 0.75, 0.1)} m="gunmetal" p={[-0.1, DECK_TOP + 0.15, 0]} />
      <P g={geo.box(0.5, 0.12, 0.62)} m="hullShade" p={[-0.25, DECK_TOP + 0.36, 0]} />
      <RodClump p={[-0.45, base + 0.08, 0]} length={length} count={14} seed={variant} />
      <RodClump p={[-0.4, base - 0.02, -0.24]} length={length * 0.8} count={10} seed={variant + 3} />
      <RodClump p={[-0.4, base - 0.02, 0.24]} length={length * 0.8} count={10} seed={variant + 5} />
    </group>
  );
}

/** A broadside gun casemate mounted on an escort's deck, guns facing outboard. */
function Battery({ variant }: { variant: number }) {
  const depth = WING_WIDTH - 0.1;
  return (
    <group position={[0, DECK_TOP + 0.3, 0]} scale={[0.85, 0.65, 1]}>
      <P g={geo.chamferBox(2.1, 1.0, depth, 0.18)} m="hull" p={[0, 0.05, 0]} />
      <P g={geo.prism([[-1.05, -depth / 2], [1.05, -depth / 2], [0.95, depth / 2], [-0.95, depth / 2]], 0.08, 0.02)} m="hullShade" p={[0, 0.58, 0]} />
      <BoxRow from={[-0.9, 0.42, depth / 2 + 0.01]} to={[0.9, 0.42, depth / 2 + 0.01]} count={9} size={[0.06, 0.1, 0.03]} m="window" />
      {[-0.65, 0, 0.65].map((x) => (
        <group key={x} position={[x, 0.0, depth / 2]}>
          <P g={geo.chamferBox(0.34, 0.34, 0.12, 0.06)} m="graphite" />
          <P g={geo.cyl(0.06, 0.08, 0.95, 8)} m="gunmetal" p={[0, 0, 0.47]} r={[Math.PI / 2, 0, 0]} />
          <P g={geo.cyl(0.09, 0.09, 0.12, 8)} m="gold" p={[0, 0, 0.93]} r={[Math.PI / 2, 0, 0]} />
        </group>
      ))}
      <P g={geo.box(2.1, 0.05, 0.04)} m="gold" p={[0, -0.42, depth / 2 + 0.01]} />
      <Greebles w={1.7} d={depth - 0.4} y={0.62} count={6} seed={variant} maxSize={0.14} />
    </group>
  );
}

/** Stacked decks rising from the hull: the ship's skyline. */
function Superstructure({ levels, variant }: { levels: number; variant: number }) {
  const tiers: ReactNode[] = [];
  for (let level = 0; level < levels; level += 1) {
    const w = 2.0 - level * 0.3;
    const d = 2.1 - level * 0.32;
    const y = DECK_TOP + level * SUPER_DECK;
    tiers.push(
      <group key={level} position={[level * 0.08, y, 0]}>
        <P g={geo.chamferBox(w, SUPER_DECK - 0.04, d, 0.22)} m={level % 2 ? "hullShade" : "hull"} p={[0, SUPER_DECK / 2, 0]} />
        {[-1, 1].map((side) => (
          <BoxRow key={side} from={[-w / 2 + 0.2, SUPER_DECK * 0.55, side * (d / 2 + 0.01)]} to={[w / 2 - 0.2, SUPER_DECK * 0.55, side * (d / 2 + 0.01)]} count={Math.round(w / 0.16)} size={[0.05, 0.24, 0.03]} m="window" gapEvery={3} />
        ))}
        {[-1, 1].map((side) => (
          <BoxRow key={`c${side}`} from={[-w / 2 + 0.1, SUPER_DECK + 0.06, side * (d / 2 - 0.05)]} to={[w / 2 - 0.1, SUPER_DECK + 0.06, side * (d / 2 - 0.05)]} count={Math.round(w / 0.24)} size={[0.09, 0.12, 0.07]} m="hullShade" />
        ))}
        {[-1, 1].flatMap((sx) =>
          [-1, 1].map((sz) => (
            <P key={`${sx}${sz}`} g={geo.cone(0.09, 0.42, 4)} m="hull" p={[sx * (w / 2 - 0.08), SUPER_DECK + 0.21, sz * (d / 2 - 0.08)]} />
          ))
        )}
      </group>
    );
  }
  const top = DECK_TOP + levels * SUPER_DECK;
  return (
    <group>
      {tiers}
      <Greebles w={1.6 - levels * 0.3} d={1.6 - levels * 0.3} y={top} count={6} seed={variant + 3} maxSize={0.18} />
      {[-1, 1].map((side) => (
        <P key={side} g={geo.box(1.4, 0.1, 0.1)} m="hullShade" p={[0, DECK_TOP + 0.35, side * 1.25]} r={[side * 0.55, 0, 0]} />
      ))}
    </group>
  );
}

/** A cluster of spires crowning a superstructure. */
function Spire({ variant }: { variant: number }) {
  return (
    <group>
      <P g={geo.cyl(0.42, 0.5, 0.35, 8)} m="hullShade" p={[0, 0.17, 0]} r={[0, Math.PI / 8, 0]} />
      <P g={geo.cyl(0.46, 0.46, 0.05, 8)} m="gold" p={[0, 0.36, 0]} r={[0, Math.PI / 8, 0]} />
      <P g={geo.cyl(0.14, 0.22, 0.9, 6)} m="hull" p={[0, 0.8, 0]} />
      <BoxRow from={[0.22, 0.6, 0]} to={[0.22, 1.0, 0]} count={3} size={[0.03, 0.08, 0.06]} m="window" />
      <P g={geo.cone(0.13, 2.0 + (variant % 3) * 0.4, 4)} m="hull" p={[0, 2.25 + (variant % 3) * 0.2, 0]} />
      <RodSet
        rods={[
          [[0, 3.2 + (variant % 3) * 0.4, 0], [0, 4.2 + (variant % 3) * 0.4, 0]],
          ...[0, 1, 2, 3, 4, 5, 6, 7].map((index): [Vec3, Vec3] => {
            const angle = (index * Math.PI) / 4 + Math.PI / 8;
            return [
              [Math.cos(angle) * 0.36, 0.36, Math.sin(angle) * 0.36],
              [Math.cos(angle) * 0.36, 2.0, Math.sin(angle) * 0.36]
            ];
          })
        ]}
        radius={0.03}
        m="hull"
      />
    </group>
  );
}

/** A dorsal gun turret with twin barrels facing the bow. */
function Turret({ variant }: { variant: number }) {
  const yaw = ((variant % 5) - 2) * 0.12;
  return (
    <group position={[0, DECK_TOP, 0]}>
      <P g={geo.cyl(0.6, 0.66, 0.22, 8)} m="hullShade" p={[0, 0.11, 0]} r={[0, Math.PI / 8, 0]} />
      <P g={geo.cyl(0.64, 0.64, 0.04, 8)} m="gold" p={[0, 0.23, 0]} r={[0, Math.PI / 8, 0]} />
      <group position={[0, 0.48, 0]} rotation={[0, yaw, 0]}>
        <P g={geo.prism([[-0.55, -0.45], [0.35, -0.42], [0.6, -0.2], [0.6, 0.2], [0.35, 0.42], [-0.55, 0.45]], 0.46, 0.05)} m="hull" />
        <P g={geo.box(0.04, 0.06, 0.5)} m="window" p={[0.6, 0.06, 0]} />
        {[-0.18, 0.18].map((z) => (
          <group key={z} position={[0.6, 0, z]}>
            <P g={geo.cyl(0.06, 0.08, 1.4, 8)} m="gunmetal" p={[0.7, 0, 0]} r={[0, 0, Math.PI / 2]} />
            <P g={geo.box(0.16, 0.12, 0.12)} m="graphite" p={[1.4, 0, 0]} />
          </group>
        ))}
        <Greebles w={0.6} d={0.6} y={0.23} count={4} seed={variant} maxSize={0.12} />
      </group>
    </group>
  );
}

/** A hangar bay slung under the keel, lit inside. */
function Hangar({ variant }: { variant: number }) {
  return (
    <group position={[0, KEEL, 0]}>
      <P g={geo.chamferBox(1.9, 0.75, 1.5, 0.22)} m="hullShade" p={[0, -0.4, 0]} />
      {[-1, 1].map((side) => (
        <group key={side}>
          <P g={geo.box(1.3, 0.42, 0.04)} m="graphite" p={[0, -0.42, side * 0.76]} />
          <BoxRow from={[-0.55, -0.62, side * 0.78]} to={[0.55, -0.62, side * 0.78]} count={6} size={[0.06, 0.04, 0.02]} m="window" />
        </group>
      ))}
      <P g={geo.box(1.95, 0.05, 1.55)} m="gold" p={[0, -0.78, 0]} />
      <Blinker p={[0.9, -0.6, 0]} phase={variant} m="engine" />
    </group>
  );
}

/**
 * A city block: a tight cluster of buildings of uneven heights on one deck lane, with lit
 * window bands, rooftop spikes and forward rod bundles, and a skybridge between the two
 * tallest. Each extra level makes the whole block taller.
 */
function District({ levels, variant, tier }: { levels: number; variant: number; tier: number }) {
  const buildings = useMemo(() => {
    const list: Array<{ x: number; z: number; w: number; d: number; h: number; roof: number; shade: boolean }> = [];
    for (let column = 0; column < 3; column += 1) {
      for (let row = 0; row < 2; row += 1) {
        const seed = column * 2 + row;
        if (hash01(variant, seed + 40) < 0.12) {
          continue; // a gap: a small plaza
        }
        list.push({
          x: -0.66 + column * 0.66 + (hash01(variant, seed + 20) - 0.5) * 0.08,
          z: -0.27 + row * 0.54,
          w: 0.42 + hash01(variant, seed + 30) * 0.18,
          d: 0.36 + hash01(variant, seed + 50) * 0.12,
          h: 0.35 + hash01(variant, seed + 10) * (0.5 + levels * 0.55) + (column === 1 ? 0.3 : 0),
          roof: Math.floor(hash01(variant, seed + 60) * 4),
          shade: hash01(variant, seed + 70) < 0.5
        });
      }
    }
    return list;
  }, [levels, variant]);
  const tallest = [...buildings].sort((a, b) => b.h - a.h);
  const bridge = tallest.length > 1 ? [tallest[0], tallest[1]] : null;
  return (
    <group position={[0, DECK_TOP, 0]}>
      <P g={geo.chamferBox(2.1, 0.14, 1.15, 0.06)} m="gunmetal" p={[0, 0.07, 0]} />
      {buildings.map((b, index) => (
        <group key={index} position={[b.x, 0.14, b.z]}>
          <P g={geo.chamferBox(b.w, b.h, b.d, 0.06)} m={b.shade ? "hullShade" : "hull"} p={[0, b.h / 2, 0]} />
          <P g={geo.chamferBox(b.w * 0.7, 0.16, b.d * 0.7, 0.04)} m="panel" p={[0, b.h + 0.08, 0]} />
          {[-1, 1].map((side) =>
            Array.from({ length: Math.max(1, Math.floor(b.h / 0.28)) }, (_, band) => (
              <BoxRow
                key={`${side}${band}`}
                from={[-b.w / 2 + 0.07, 0.16 + band * 0.28, side * (b.d / 2 + 0.01)]}
                to={[b.w / 2 - 0.07, 0.16 + band * 0.28, side * (b.d / 2 + 0.01)]}
                count={Math.max(2, Math.round(b.w / 0.1))}
                size={[0.04, 0.08, 0.02]}
                m="window"
                gapEvery={3}
              />
            ))
          )}
          {b.roof === 0 ? <P g={geo.cone(0.07, 0.6, 4)} m="hull" p={[0, b.h + 0.46, 0]} /> : null}
          {b.roof === 1 ? <RodClump p={[-b.w / 2, b.h + 0.26, 0]} length={b.w + 0.6} count={10} pitch={0.05} radius={0.015} seed={variant + index} /> : null}
          {b.roof === 2 ? <RodClump p={[0, b.h + 0.16, 0]} length={0.8} count={9} pitch={0.045} radius={0.014} seed={variant + index} axis="y" /> : null}
        </group>
      ))}
      {bridge ? <Skybridge a={bridge[0]} b={bridge[1]} at={0.7} /> : null}
      {/* Upgrades: 2 plated ledges, 3 red bands and a beacon, 4 more skybridges and an antenna
          sheaf on the tallest tower, 5 glowing light strips up the corners. */}
      {tier >= 2
        ? buildings.map((b, index) => <P key={`ledge${index}`} g={geo.chamferBox(b.w + 0.07, 0.05, b.d + 0.07, 0.03)} m="plate" p={[b.x, 0.14 + b.h * 0.55, b.z]} />)
        : null}
      {tier >= 3
        ? buildings.map((b, index) => <P key={`band${index}`} g={geo.box(b.w + 0.02, 0.04, b.d + 0.02)} m="accent" p={[b.x, 0.14 + b.h * 0.82, b.z]} />)
        : null}
      {tier >= 3 && tallest[0] ? <Blinker p={[tallest[0].x, 0.14 + tallest[0].h + 0.32, tallest[0].z]} phase={variant * 0.21} /> : null}
      {tier >= 4 && tallest.length > 2 ? (
        <>
          <Skybridge a={tallest[1]} b={tallest[2]} at={0.45} />
          <Skybridge a={tallest[0]} b={tallest[2]} at={0.3} />
          <RodClump p={[tallest[0].x, 0.14 + tallest[0].h + 0.16, tallest[0].z]} length={1.1} count={7} pitch={0.04} radius={0.012} seed={variant + 50} axis="y" />
        </>
      ) : null}
      {tier >= 5
        ? buildings.flatMap((b, index) =>
            [-1, 1].map((side) => (
              <P key={`glow${index}${side}`} g={geo.box(0.025, b.h * 0.85, 0.025)} m="energy" p={[b.x + side * (b.w / 2), 0.14 + b.h * 0.47, b.z + b.d / 2 + 0.012]} />
            ))
          )
        : null}
    </group>
  );
}

/** A covered walkway between two buildings of a city block, at a fraction of the shorter one's height. */
function Skybridge({ a, b, at }: { a: { x: number; z: number; h: number }; b: { x: number; z: number; h: number }; at: number }) {
  return (
    <P
      g={geo.box(Math.max(0.1, Math.abs(a.x - b.x)), 0.08, Math.max(0.1, Math.abs(a.z - b.z)) + 0.1)}
      m="panel"
      p={[(a.x + b.x) / 2, 0.14 + Math.min(a.h, b.h) * at, (a.z + b.z) / 2]}
    />
  );
}

/** A sky hull: a small ship hull raised on two pylons, with a deckhouse and a forward needle bank. */
function Pod({ variant, tier }: { variant: number; tier: number }) {
  const height = 1.5 + (variant % 3) * 0.75;
  const top = DECK_TOP + height;
  return (
    <group>
      {[-0.45, 0.35].map((x) => (
        <group key={x}>
          <P g={geo.box(0.16, height, 0.22)} m="hullShade" p={[x, DECK_TOP + height / 2, 0]} />
          <P g={geo.box(0.3, 0.08, 0.36)} m="gunmetal" p={[x, DECK_TOP + 0.04, 0]} />
        </group>
      ))}
      <RodSet
        rods={[
          [[-0.45, DECK_TOP + 0.1, 0.1], [0.35, top - 0.2, 0.1]],
          [[0.35, DECK_TOP + 0.1, -0.1], [-0.45, top - 0.2, -0.1]]
        ]}
        radius={0.02}
        m="truss"
      />
      <group position={[-0.05, top, 0]} scale={[1, 0.75, 0.85]}>
        <P g={geo.section(ESCORT_SECTION, 1.6, 0.04)} m="hull" />
      </group>
      <P g={geo.prism([[0.75, -0.36], [1.25, 0], [0.75, 0.36]], 0.36, 0.03)} m="bone" p={[0, top + 0.02, 0]} />
      <P g={geo.chamferBox(0.6, 0.3, 0.42, 0.06)} m="hullShade" p={[-0.25, top + 0.42, 0]} />
      {[-1, 1].map((side) => (
        <BoxRow key={side} from={[-0.7, top + 0.08, side * 0.39]} to={[0.6, top + 0.08, side * 0.39]} count={9} size={[0.05, 0.07, 0.02]} m="window" gapEvery={4} />
      ))}
      <P g={geo.cyl(0.16, 0.16, 0.03, 8)} m="engine" p={[-0.87, top, 0]} r={[Math.PI / 8, 0, Math.PI / 2]} />
      <RodClump p={[0.0, top + 0.46, 0]} length={1.9} count={11} seed={variant} />
      <Blinker p={[-0.25, top + 0.62, 0]} phase={variant * 0.17} />
      {/* Upgrades: 2 side armour, 3 red trim and a bow light, 4 extra bracing and a dorsal gun,
          5 glowing keel lines and a bigger drive. */}
      {tier >= 2
        ? [-1, 1].map((side) => <P key={`armour${side}`} g={geo.chamferBox(1.15, 0.2, 0.05, 0.03)} m="plate" p={[-0.05, top - 0.02, side * 0.38]} />)
        : null}
      {tier >= 3 ? (
        <>
          <P g={geo.box(0.62, 0.05, 0.44)} m="accent" p={[-0.25, top + 0.5, 0]} />
          <Blinker p={[1.2, top + 0.05, 0]} phase={variant * 0.17 + 0.8} />
        </>
      ) : null}
      {tier >= 4 ? (
        <>
          <RodSet
            rods={[
              [[-0.45, DECK_TOP + 0.1, -0.1], [0.35, top - 0.2, -0.1]],
              [[0.35, DECK_TOP + 0.1, 0.1], [-0.45, top - 0.2, 0.1]],
              [[-0.45, DECK_TOP + height * 0.5, 0], [0.35, DECK_TOP + height * 0.5, 0]]
            ]}
            radius={0.018}
            m="truss"
          />
          <group position={[0.35, top + 0.33, 0]}>
            <P g={geo.cyl(0.13, 0.15, 0.08, 8)} m="gunmetal" />
            <P g={geo.cyl(0.025, 0.025, 0.45, 6)} m="gunmetal" p={[0.24, 0.04, 0]} r={[0, 0, Math.PI / 2]} />
          </group>
        </>
      ) : null}
      {tier >= 5 ? (
        <>
          {[-1, 1].map((side) => (
            <P key={`energy${side}`} g={geo.box(1.3, 0.025, 0.025)} m="energy" p={[-0.05, top - 0.2, side * 0.33]} />
          ))}
          <P g={geo.cyl(0.24, 0.24, 0.03, 8)} m="engine" p={[-0.89, top, 0]} r={[Math.PI / 8, 0, Math.PI / 2]} />
        </>
      ) : null}
    </group>
  );
}

/**
 * A keel spire: an inverted stepped tower hanging under the hull or an escort, lit by window
 * bands, ending in a downward spike, with a forward rod bundle along its lowest deck.
 */
function Keel({ variant, top, tier }: { variant: number; top: number; tier: number }) {
  const decks = 2 + (variant % 3);
  const parts: ReactNode[] = [];
  let y = top;
  for (let deck = 0; deck < decks; deck += 1) {
    const w = 1.7 - deck * 0.32;
    const d = 1.2 - deck * 0.22;
    const h = 0.42;
    parts.push(
      <group key={deck} position={[deck * 0.1, y - h / 2, 0]}>
        <P g={geo.chamferBox(w, h - 0.03, d, 0.14)} m={deck % 2 ? "hullShade" : "hull"} />
        {[-1, 1].map((side) => (
          <BoxRow
            key={side}
            from={[-w / 2 + 0.15, -0.02, side * (d / 2 + 0.01)]}
            to={[w / 2 - 0.15, -0.02, side * (d / 2 + 0.01)]}
            count={Math.round(w / 0.14)}
            size={[0.05, 0.12, 0.02]}
            m="window"
            gapEvery={3}
          />
        ))}
        {/* Upgrades: 2 armour bands, 3 red rings, 5 glowing rims. */}
        {tier >= 2 ? <P g={geo.chamferBox(w * 0.7, 0.09, d + 0.06, 0.04)} m="plate" p={[0, 0.07, 0]} /> : null}
        {tier >= 3 ? <P g={geo.box(w + 0.03, 0.045, d + 0.03)} m="accent" p={[0, h / 2 - 0.05, 0]} /> : null}
        {tier >= 5 ? <P g={geo.box(w + 0.05, 0.025, d + 0.05)} m="energy" p={[0, -h / 2 + 0.03, 0]} /> : null}
      </group>
    );
    y -= h;
  }
  const lowest = y + 0.2;
  return (
    <group>
      {parts}
      <P g={geo.cone(0.18, 1.3, 4)} m="hull" p={[decks * 0.1, y - 0.62, 0]} r={[Math.PI, 0, 0]} />
      <RodClump p={[0, lowest, 0]} length={1.8 + (variant % 2) * 0.4} count={10} seed={variant} />
      <Blinker p={[decks * 0.1, y - 1.3, 0]} phase={variant * 0.29} />
      {/* 4: a second sheaf and ribbed fins; 5: a glowing tip. */}
      {tier >= 4 ? (
        <>
          <RodClump p={[-0.2, top - 0.3, 0]} length={1.4} count={8} seed={variant + 7} />
          {[-1, 1].map((side) => (
            <P key={side} g={geo.prism([[-0.5, 0], [0.4, 0], [-0.3, side * 0.35]], 0.05, 0.01)} m="gunmetal" p={[decks * 0.05, y + 0.1, side * 0.3]} r={[Math.PI / 2, 0, 0]} />
          ))}
        </>
      ) : null}
      {tier >= 5 ? <P g={geo.cone(0.07, 0.35, 4)} m="energy" p={[decks * 0.1, y - 1.2, 0]} r={[Math.PI, 0, 0]} /> : null}
    </group>
  );
}

/** Base height of a part: spires sit on top of their superstructure; escort parts follow their escort's elevation. */
export function baseY(piece: { kind: PieceKind; parent: number; elev?: number }, pieces: Array<{ id: number; levels: number }>): number {
  const elev = piece.elev ?? 0;
  if (piece.kind === "spire") {
    const parent = pieces.find((candidate) => candidate.id === piece.parent);
    return elev + DECK_TOP + (parent?.levels ?? 1) * SUPER_DECK;
  }
  return elev;
}

/**
 * Footprint of a part in world units: [length along x, width along z]. A mirrored escort pair
 * covers both flanks; a one-sided escort part covers just its own tier.
 */
export function pieceSize(kind: PieceKind, wingTier = 0, side = 0): [number, number] {
  if (wingTier > 0) {
    const length = kind === "turret" ? 2.6 : kind === "spire" ? 1.1 : kind === "needles" ? 2.8 : CELL - 0.2;
    const own = WING_WIDTH + (kind === "battery" ? 1.0 : 0.2);
    return [length, side === 0 ? (tierCenter(wingTier) + WING_WIDTH / 2) * 2 + (kind === "battery" ? 1.9 : 0.2) : own];
  }
  switch (kind) {
    case "core":
      return [CELL * 2, 3.4];
    case "prow":
      return [CELL * 2.4, 3.0];
    case "engines":
      return [CELL + 0.6, 3.4];
    case "battery":
      return [2.1, HULL_HALF * 2 + 2.3];
    case "superstructure":
      return [2.1, 2.3];
    case "spire":
      return [1.1, 1.1];
    case "turret":
      return [2.6, 1.4];
    case "mast":
      return [1.2, 1.2];
    case "needles":
      return [2.8, 1.0];
    case "hangar":
      return [2.0, 1.7];
    case "district":
      return [2.2, 1.2];
    case "pod":
      return [2.6, 1.0];
    case "keel":
      return [1.9, 1.4];
    default:
      return [CELL, HULL_HALF * 2 + 0.3];
  }
}

const DRESS: Record<PieceKind, (levels: number) => Dims> = {
  core: () => ({ w: 3.6, d: HULL_HALF * 2 + 0.04, bottom: -0.6, top: DECK_TOP }),
  hull: () => ({ w: 1.8, d: HULL_HALF * 2 + 0.04, bottom: -0.6, top: DECK_TOP }),
  engines: () => ({ w: 1.8, d: HULL_HALF * 2.16 + 0.04, bottom: -0.6, top: DECK_TOP }),
  prow: () => ({ w: 2.4, d: 2.6, bottom: -0.3, top: 0.7 }),
  wing: () => ({ w: 1.1, d: 0.92, bottom: -0.32, top: 0.4 }),
  mast: () => ({ w: 0.5, d: 0.5, bottom: DECK_TOP, top: DECK_TOP + 0.15, small: true }),
  needles: () => ({ w: 0.5, d: 0.5, bottom: DECK_TOP, top: DECK_TOP + 0.25, small: true }),
  battery: () => ({ w: 1.5, d: WING_WIDTH - 0.06, bottom: DECK_TOP, top: DECK_TOP + 0.62, small: true }),
  superstructure: (levels) => ({ w: 1.6, d: 2.12, bottom: DECK_TOP, top: DECK_TOP + levels * SUPER_DECK }),
  spire: () => ({ w: 0.7, d: 0.7, bottom: 0, top: 0.38, small: true }),
  turret: () => ({ w: 0.9, d: 0.9, bottom: DECK_TOP + 0.25, top: DECK_TOP + 0.71, small: true }),
  hangar: () => ({ w: 1.6, d: 1.5, bottom: KEEL - 0.75, top: KEEL - 0.05, small: true }),
  district: () => ({ w: 2.0, d: 1.1, bottom: DECK_TOP, top: DECK_TOP + 0.14, small: true }),
  pod: () => ({ w: 0.6, d: 0.4, bottom: DECK_TOP, top: DECK_TOP + 0.1, small: true }),
  keel: () => ({ w: 1.5, d: 1.0, bottom: KEEL - 0.4, top: KEEL - 0.05, small: true })
};

/** Parts that model their own upgrade looks instead of the generic dressing. */
const OWN_TIERS = new Set<PieceKind>(["district", "pod", "keel"]);

export function PieceModel({
  kind,
  levels,
  tier = 1,
  variant,
  wingTier = 0,
  side = 0,
  aft = false,
  rise = 0
}: {
  kind: PieceKind;
  levels: number;
  /** upgrade level */
  tier?: number;
  variant: number;
  /** 0 on the spine; t for an escort tier */
  wingTier?: number;
  /** escort side: -1 port, 1 starboard, 0 a mirrored pair (the caller has already moved to the side) */
  side?: number;
  /** a wing section at the stern gets its own engine */
  aft?: boolean;
  /** escorts: height above the part inboard of it */
  rise?: number;
}) {
  let model: ReactNode;
  switch (kind) {
    case "wing":
      model = <Wing variant={variant} aft={aft} rise={rise} />;
      break;
    case "mast":
      model = <Mast variant={variant} />;
      break;
    case "needles":
      model = <Needles variant={variant} />;
      break;
    case "core":
      model = <Core levels={levels} variant={variant} />;
      break;
    case "engines":
      model = <Engines variant={variant} />;
      break;
    case "prow":
      model = <Prow variant={variant} />;
      break;
    case "battery":
      model = <Battery variant={variant} />;
      break;
    case "superstructure":
      model = <Superstructure levels={levels} variant={variant} />;
      break;
    case "spire":
      model = <Spire variant={variant} />;
      break;
    case "turret":
      model = <Turret variant={variant} />;
      break;
    case "hangar":
      model = <Hangar variant={variant} />;
      break;
    case "district":
      model = <District levels={levels} variant={variant} tier={tier} />;
      break;
    case "pod":
      model = <Pod variant={variant} tier={tier} />;
      break;
    case "keel":
      // Under an escort it hangs from the escort's belly; under the spine, from the keel.
      model = <Keel variant={variant} top={wingTier > 0 ? -0.36 : KEEL + 0.05} tier={tier} />;
      break;
    default:
      model = <Hull variant={variant} />;
  }
  const dressed = (
    <group>
      {model}
      {OWN_TIERS.has(kind) ? null : <TierDress tier={tier} dims={DRESS[kind](levels)} seed={variant} />}
    </group>
  );
  if (wingTier === 0) {
    return dressed;
  }
  // Escort tiers step down a little per tier; parts on an escort's deck sit on that lower deck
  // and are slimmed to fit its width. Port-side parts are mirrored so "outboard" stays outboard.
  const onDeck = kind !== "wing" && kind !== "keel";
  const drop = (onDeck ? ESCORT_TOP - DECK_TOP : 0) - 0.15 * (wingTier - 1);
  const slim: Vec3 = onDeck ? [1, 1, 0.62] : [1, 1, 1];
  if (side !== 0) {
    return (
      <group position={[0, drop, 0]} scale={[slim[0], slim[1], side * slim[2]]}>
        {dressed}
      </group>
    );
  }
  const z = tierCenter(wingTier);
  return (
    <group position={[0, drop, 0]}>
      <group position={[0, 0, z]} scale={slim}>
        {dressed}
      </group>
      <group position={[0, 0, -z]} scale={[slim[0], slim[1], -slim[2]]}>
        {dressed}
      </group>
    </group>
  );
}

/** Lowest and highest points of a part (above its base height), for frames and the build clip. */
export function pieceSpan(kind: PieceKind, levels: number): [number, number] {
  switch (kind) {
    case "core":
      return [KEEL - 0.3, DECK_TOP + levels * TOWER_DECK + 3.5];
    case "engines":
      return [KEEL - 0.3, DECK_TOP + 2.1];
    case "prow":
      return [KEEL, 1.6];
    case "battery":
      return [DECK_TOP, DECK_TOP + 0.75];
    case "superstructure":
      return [DECK_TOP, DECK_TOP + levels * SUPER_DECK + 0.45];
    case "spire":
      return [0, 2.8];
    case "turret":
      return [DECK_TOP, DECK_TOP + 0.75];
    case "mast":
      return [DECK_TOP, DECK_TOP + 5.2];
    case "needles":
      return [DECK_TOP, DECK_TOP + 0.75];
    case "wing":
      return [-0.4, 0.6];
    case "hangar":
      return [KEEL - 0.85, KEEL];
    case "district":
      return [DECK_TOP, DECK_TOP + 1.2 + levels * 0.55];
    case "pod":
      return [DECK_TOP, DECK_TOP + 3.5];
    case "keel":
      return [KEEL - 3.4, KEEL];
    default:
      return [KEEL - 0.3, DECK_TOP + 0.3];
  }
}

/** Where a newly added deck starts, for animating it into place. */
export function deckBase(kind: PieceKind, level: number): number {
  if (kind === "core") {
    return DECK_TOP + (level - 1) * TOWER_DECK;
  }
  if (kind === "superstructure") {
    return DECK_TOP + (level - 1) * SUPER_DECK;
  }
  if (kind === "district") {
    return DECK_TOP;
  }
  return 0;
}

/** The glowing frame drones weld a module inside of. */
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
