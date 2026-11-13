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
function Wing({ variant, aft }: { variant: number; aft: boolean }) {
  const classes = activeDesign().escorts;
  const kind = classes[variant % classes.length];
  const length = 0.85 + hash01(variant, 1) * 0.25;
  const lift = (hash01(variant, 2) - 0.5) * 0.24;
  const yaw = (hash01(variant, 3) - 0.5) * 0.08;
  const struts = useMemo<Array<[Vec3, Vec3]>>(
    () => [
      [[-0.65, 0, -0.3], [-0.65, -lift, -WING_HALF - 0.05]],
      [[0.15, 0, -0.3], [0.15, -lift, -WING_HALF - 0.05]],
      [[-0.65, 0.2, -0.3], [0.15, -0.05 - lift, -WING_HALF - 0.05]]
    ],
    [lift]
  );
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
    </group>
  );
}

/**
 * Forward needle banks carried along an escort: an outboard bank down the flank and a smaller
 * one on the dorsal line, both dense, evenly spaced and parallel to the ship, reaching past the bow.
 */
function FlankNeedles({ variant }: { variant: number }) {
  const rods = useMemo(() => {
    const list: Array<[Vec3, Vec3]> = [];
    const pitch = 0.075;
    const bank = (columns: number, layers: number, z0: number, y0: number, from: number, to: number) => {
      for (let layer = 0; layer < layers; layer += 1) {
        for (let column = 0; column < columns; column += 1) {
          const y = y0 + layer * pitch;
          const z = z0 + column * pitch;
          list.push([[from, y, z], [to, y, z]]);
        }
      }
      // Rectangular frames binding the bank.
      const top = y0 + (layers - 1) * pitch + 0.03;
      const bottom = y0 - 0.03;
      const near = z0 - 0.03;
      const far = z0 + (columns - 1) * pitch + 0.03;
      for (const fraction of [0.12, 0.55]) {
        const x = from + (to - from) * fraction;
        list.push([[x, bottom, near], [x, top, near]], [[x, bottom, far], [x, top, far]], [[x, top, near], [x, top, far]], [[x, bottom, near], [x, bottom, far]]);
      }
    };
    const reach = 1.55 + hash01(variant, 7) * 0.45;
    // Outboard flank bank: 2 deep, 4 high, just outside the hull.
    bank(2, 4, 0.62, -0.12, -0.8, reach);
    // Dorsal bank: 3 wide, 2 high, along the spine.
    bank(3, 2, -0.075, 0.5, -0.5, reach - 0.35);
    return list;
  }, [variant]);
  return <RodSet rods={rods} radius={0.014} m="truss" />;
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
 * A needle array: a dense, regular bank of parallel rods pointing forward along the ship, on an
 * even grid, held by rectangular frames along their length and capped with a brass bar.
 */
function Needles({ variant }: { variant: number }) {
  const rows = 6;
  const layers = 3;
  const pitch = 0.11;
  const start = -0.45;
  const length = 2.1 + (variant % 3) * 0.2;
  const base = DECK_TOP + 0.32;
  const rods = useMemo(() => {
    const list: Array<[Vec3, Vec3]> = [];
    const z0 = -((rows - 1) * pitch) / 2;
    for (let layer = 0; layer < layers; layer += 1) {
      for (let row = 0; row < rows; row += 1) {
        const y = base + layer * pitch;
        const z = z0 + row * pitch;
        list.push([[start, y, z], [start + length, y, z]]);
      }
    }
    // Rectangular frames binding the bank at even intervals.
    const top = base + (layers - 1) * pitch + 0.04;
    const bottom = base - 0.04;
    const side = -z0 + 0.04;
    for (const fraction of [0.15, 0.5, 0.85]) {
      const x = start + length * fraction;
      list.push([[x, bottom, -side], [x, top, -side]], [[x, bottom, side], [x, top, side]], [[x, top, -side], [x, top, side]], [[x, bottom, -side], [x, bottom, side]]);
    }
    return list;
  }, [length]);
  return (
    <group>
      <P g={geo.chamferBox(0.8, 0.3, 0.75, 0.1)} m="gunmetal" p={[-0.1, DECK_TOP + 0.15, 0]} />
      <P g={geo.box(0.06, layers * pitch + 0.08, rows * pitch + 0.08)} m="gold" p={[start + length, base + ((layers - 1) * pitch) / 2, 0]} />
      <RodSet rods={rods} radius={0.017} m="hullShade" />
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

/** Base height of a part: spires sit on top of their superstructure. */
export function baseY(piece: { kind: PieceKind; parent: number }, pieces: Array<{ id: number; levels: number }>): number {
  if (piece.kind === "spire") {
    const parent = pieces.find((candidate) => candidate.id === piece.parent);
    return DECK_TOP + (parent?.levels ?? 1) * SUPER_DECK;
  }
  return 0;
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
  hangar: () => ({ w: 1.6, d: 1.5, bottom: KEEL - 0.75, top: KEEL - 0.05, small: true })
};

export function PieceModel({
  kind,
  levels,
  tier = 1,
  variant,
  wingTier = 0,
  side = 0,
  aft = false
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
}) {
  let model: ReactNode;
  switch (kind) {
    case "wing":
      model = <Wing variant={variant} aft={aft} />;
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
    default:
      model = <Hull variant={variant} />;
  }
  const dressed = (
    <group>
      {model}
      <TierDress tier={tier} dims={DRESS[kind](levels)} seed={variant} />
    </group>
  );
  if (wingTier === 0) {
    return dressed;
  }
  // Escort tiers step down a little per tier; parts on an escort's deck sit on that lower deck
  // and are slimmed to fit its width. Port-side parts are mirrored so "outboard" stays outboard.
  const onDeck = kind !== "wing";
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
