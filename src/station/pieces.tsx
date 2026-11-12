import { createContext, useContext, useRef, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import type * as THREE from "three";
import { PIECES, type PieceKind } from "./catalog.ts";
import { MATERIALS, geo, type MaterialName, type MaterialSet } from "./materials.ts";
import { hash01 } from "./rng.ts";

// An angular warship look: bevelled plates, octagonal and wedge sections instead of round
// ones, dark structure under light hull plating, red-orange accents and cyan engines.
// Every module also has five upgrade tiers that add visible detail (see TierDress).

/** Size of one grid cell, in world units. */
export const CELL = 2.4;
const HALF = CELL / 2;
const TUBE = 0.4;
const CORE_DECK = 0.5;
const NODE_DECK = 0.8;
const RING_GAP = 0.7;

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
    // Local +x points along the port: rotation.y of -90deg turns +x into +z.
    const yaw = dx !== 0 ? 0 : -Math.PI / 2;
    parts.push(
      <group key={index} position={[cx, 0, cz]} rotation={[0, yaw, 0]}>
        <group position={[(dx || dz) * (HALF / 2), 0, 0]}>
          <OctTube length={HALF} radius={TUBE * 0.78} m="panel" />
        </group>
        <P g={geo.chamferBox(0.16, TUBE * 2.3, TUBE * 2.3, 0.12)} m="graphite" p={[(dx || dz) * (HALF - 0.08), 0, 0]} />
      </group>
    );
  });
  return <>{parts}</>;
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
  parts.push(<P key="plate-top" g={geo.chamferBox(w * (small ? 0.4 : 0.55), 0.07, d * (small ? 0.35 : 0.5), 0.1)} m="plate" p={[0, top + 0.03, 0]} />);

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
    for (let index = 0; index < (small ? 2 : 5); index += 1) {
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

// ---- modules -----------------------------------------------------------------------------

/** The command ship: an arrowhead hull with a stepped superstructure, bridge and engines. */
function Core({ levels, tier, variant }: { levels: number; tier: number; variant: number }) {
  const hull: Array<[number, number]> = [
    [2.25, 0],
    [0.7, -1.55],
    [-1.85, -1.7],
    [-2.2, -1.1],
    [-2.2, 1.1],
    [-1.85, 1.7],
    [0.7, 1.55]
  ];
  const keel: Array<[number, number]> = hull.map(([x, z]) => [x * 0.82 - 0.1, z * 0.72]);
  const decks: ReactNode[] = [];
  for (let level = 0; level < levels; level += 1) {
    const width = 2.6 - level * 0.32;
    const depth = 2.2 - level * 0.28;
    const y = 0.35 + level * CORE_DECK + CORE_DECK / 2;
    decks.push(<P key={`deck${level}`} g={geo.chamferBox(width, CORE_DECK - 0.04, depth, 0.3)} m={level % 2 ? "hullShade" : "hull"} p={[-0.45 - level * 0.12, y, 0]} />);
    decks.push(<P key={`win${level}`} g={geo.box(0.04, 0.1, depth * 0.6)} m="window" p={[-0.45 - level * 0.12 + width / 2 + 0.01, y + 0.05, 0]} />);
  }
  const deckTop = 0.35 + levels * CORE_DECK;
  const bridgeX = -0.45 - (levels - 1) * 0.12;
  return (
    <group>
      <P g={geo.prism(hull, 0.7, 0.06)} m="hull" />
      <PanelLines w={3.4} d={2.6} y={0.36} count={5} />
      <P g={geo.prism(keel, 0.4, 0.05)} m="hullShade" p={[0, -0.55, 0]} />
      <P g={geo.box(1.8, 0.05, 0.12)} m="accent" p={[0.75, 0.37, 0]} />
      {decks}
      {/* bridge */}
      <P g={geo.chamferBox(0.7, 0.28, 1.5, 0.2)} m="hullShade" p={[bridgeX + 0.2, deckTop + 0.14, 0]} />
      <P g={geo.box(0.05, 0.08, 1.2)} m="window" p={[bridgeX + 0.56, deckTop + 0.16, 0]} />
      <P g={geo.box(0.04, 0.9, 0.04)} m="truss" p={[bridgeX - 0.1, deckTop + 0.7, 0.35]} />
      <P g={geo.box(0.04, 0.6, 0.04)} m="truss" p={[bridgeX - 0.1, deckTop + 0.55, -0.35]} />
      <Blinker p={[bridgeX - 0.1, deckTop + 1.17, 0.35]} phase={variant} />
      {/* engines */}
      {[-0.95, 0, 0.95].map((z) => (
        <group key={z} position={[-2.35, -0.1, z]}>
          <P g={geo.cyl(0.36, 0.3, 0.55, 6)} m="graphite" r={[0, 0, Math.PI / 2]} />
          <P g={geo.cyl(0.26, 0.26, 0.04, 6)} m="engine" p={[-0.29, 0, 0]} r={[0, 0, Math.PI / 2]} />
        </group>
      ))}
      <TierDress tier={tier} dims={{ w: 3.0, d: 2.9, bottom: -0.35, top: 0.35 }} seed={variant} />
    </group>
  );
}

function Node({ levels, tier, variant }: { levels: number; tier: number; variant: number }) {
  const towers: ReactNode[] = [];
  for (let level = 1; level < levels; level += 1) {
    const y = 0.65 + (level - 1) * NODE_DECK;
    towers.push(
      <group key={level}>
        <P g={geo.cyl(0.52, 0.58, NODE_DECK - 0.06, 8)} m={level % 2 ? "hullShade" : "hull"} p={[0, y + NODE_DECK / 2, 0]} r={[0, Math.PI / 8, 0]} />
        <P g={geo.box(0.9, 0.08, 0.04)} m="window" p={[0, y + NODE_DECK * 0.55, 0.53]} />
        <P g={geo.box(0.04, 0.08, 0.9)} m="window" p={[0.53, y + NODE_DECK * 0.55, 0]} />
      </group>
    );
  }
  const top = 0.65 + (levels - 1) * NODE_DECK;
  return (
    <group>
      <P g={geo.cyl(0.78, 0.78, 0.9, 8)} m="hull" r={[0, Math.PI / 8, 0]} />
      <P g={geo.cyl(0.55, 0.78, 0.2, 8)} m="hullShade" p={[0, 0.55, 0]} r={[0, Math.PI / 8, 0]} />
      <P g={geo.cyl(0.78, 0.5, 0.2, 8)} m="hullShade" p={[0, -0.55, 0]} r={[0, Math.PI / 8, 0]} />
      <P g={geo.cyl(0.8, 0.8, 0.08, 8)} m={variant % 3 === 0 ? "accent" : "graphite"} p={[0, 0.1, 0]} r={[0, Math.PI / 8, 0]} />
      {towers}
      <P g={geo.cone(0.18, 0.6, 4)} m="gunmetal" p={[0, top + 0.3, 0]} />
      <TierDress tier={tier} dims={{ w: 1.5, d: 1.5, bottom: -0.45, top: 0.45 }} seed={variant} />
    </group>
  );
}

function Corridor({ variant, tier }: { variant: number; tier: number }) {
  const body =
    variant % 4 === 3 ? (
      // An open square truss with a conduit running through it.
      <group>
        {[[0.32, 0.32], [0.32, -0.32], [-0.32, 0.32], [-0.32, -0.32]].map(([y, z]) => (
          <P key={`${y}${z}`} g={geo.box(CELL, 0.08, 0.08)} m="truss" p={[0, y, z]} />
        ))}
        {[-0.9, 0, 0.9].map((x) => (
          <P key={x} g={geo.chamferBox(0.08, 0.72, 0.72, 0.15)} m="graphite" p={[x, 0, 0]} />
        ))}
        <OctTube length={CELL} radius={0.15} m="accent" />
      </group>
    ) : (
      <group>
        <OctTube length={CELL} radius={TUBE} />
        <Ribs length={CELL - 0.3} size={TUBE * 2.2} count={3} />
        <P g={geo.box(1.4, 0.04, 0.18)} m="hullShade" p={[0, TUBE + 0.02, 0]} />
        {[-0.45, 0.45].map((x) => (
          <P key={x} g={geo.box(0.22, 0.08, 0.04)} m="window" p={[x, 0.1, TUBE + 0.01]} />
        ))}
      </group>
    );
  return (
    <group>
      {body}
      <TierDress tier={tier} dims={{ w: CELL * 0.8, d: 0.85, bottom: -0.42, top: 0.42 }} seed={variant} />
    </group>
  );
}

/** A small delta-wing shuttle parked at a docking port. */
function Shuttle() {
  return (
    <group>
      <P g={geo.prism([[0.85, 0], [-0.55, -0.28], [-0.7, 0], [-0.55, 0.28]], 0.3, 0.04)} m="hull" />
      <P g={geo.prism([[0.15, 0], [-0.55, -0.75], [-0.65, -0.7], [-0.4, 0]], 0.06, 0.02)} m="hullShade" p={[0, -0.05, 0]} />
      <P g={geo.prism([[0.15, 0], [-0.4, 0], [-0.65, 0.7], [-0.55, 0.75]], 0.06, 0.02)} m="hullShade" p={[0, -0.05, 0]} />
      <P g={geo.prism([[0.45, 0], [0.1, -0.12], [0.1, 0.12]], 0.12, 0.02)} m="window" p={[0, 0.18, 0]} />
      <P g={geo.box(0.04, 0.12, 0.3)} m="engine" p={[-0.72, 0, 0]} />
      <P g={geo.box(0.5, 0.02, 0.06)} m="accent" p={[0, 0.16, 0]} />
    </group>
  );
}

function Dock({ variant, tier }: { variant: number; tier: number }) {
  return (
    <group>
      <OctTube length={CELL} radius={TUBE} />
      <P g={geo.chamferBox(0.5, 1.3, 1.3, 0.3)} m="graphite" />
      <P g={geo.chamferBox(0.36, 0.5, 0.9, 0.1)} m="hullShade" p={[0, 0, 0.75]} />
      <group position={[0, 0, 1.55]} rotation={[0, variant % 2 ? 0 : Math.PI, 0]}>
        <Shuttle />
      </group>
      <Blinker p={[0, 0.7, 0]} phase={variant} />
      <Blinker p={[0, -0.7, 0]} phase={variant + 0.8} m="engine" />
      <TierDress tier={tier} dims={{ w: CELL * 0.6, d: 1.3, bottom: -0.65, top: 0.65 }} seed={variant} />
    </group>
  );
}

/** A long frigate-like hull section with pointed ends, a dorsal spine and fins. */
function Lab({ levels, tier, variant }: { levels: number; tier: number; variant: number }) {
  const length = CELL * 2 - 1.0;
  const stripe: MaterialName = variant % 2 ? "accent" : "accentBlue";
  const windows: ReactNode[] = [];
  for (let index = 0; index < 5; index += 1) {
    const x = -length / 2 + 0.45 + index * ((length - 0.9) / 4);
    windows.push(<P key={`a${index}`} g={geo.box(0.24, 0.07, 0.04)} m="window" p={[x, 0.15, 0.6]} />);
    windows.push(<P key={`b${index}`} g={geo.box(0.24, 0.07, 0.04)} m="window" p={[x, 0.15, -0.6]} />);
  }
  return (
    <group>
      <OctTube length={length} radius={0.62} />
      {[-1, 1].map((side) => (
        <P key={side} g={geo.cone(0.62, 0.5, 8)} m="hullShade" p={[side * (length / 2 + 0.25), 0, 0]} r={[Math.PI / 8, 0, -side * (Math.PI / 2)]} />
      ))}
      <Ribs length={length - 0.4} size={1.3} count={4} />
      <P g={geo.chamferBox(length * 0.7, 0.18, 0.35, 0.1)} m="hullShade" p={[0, 0.66, 0]} />
      <P g={geo.box(length * 0.4, 0.05, 0.14)} m={stripe} p={[0.2, 0.77, 0]} />
      {windows}
      {[-1, 1].map((side) => (
        <P key={`fin${side}`} g={geo.prism([[0.4, 0], [-0.5, -0.05], [-0.6, 0.6], [-0.2, 0.6]].map(([x, z]) => [x, z * side]) as Array<[number, number]>, 0.05, 0.02)} m="graphite" p={[-length * 0.32, 0, side * 0.6]} />
      ))}
      {levels > 1 ? (
        <group position={[0, 0.95, 0]}>
          <OctTube length={length * 0.6} radius={0.4} m="hullShade" />
          <P g={geo.box(0.16, 0.4, 0.16)} m="truss" p={[0, -0.3, 0]} />
        </group>
      ) : null}
      <TierDress tier={tier} dims={{ w: length, d: 1.25, bottom: -0.62, top: 0.62 }} seed={variant} />
    </group>
  );
}

function Observatory({ variant, tier }: { variant: number; tier: number }) {
  const length = CELL * 2 - 0.8;
  return (
    <group>
      <group rotation={[0, Math.PI / 2, 0]}>
        <OctTube length={length} radius={0.55} />
        <Ribs length={length - 0.4} size={1.15} count={3} />
      </group>
      <P g={geo.chamferBox(0.8, 0.9, 0.8, 0.2)} m="hullShade" p={[0, 0.85, length / 2 - 0.5]} />
      <group position={[0, 1.2, length / 2 - 0.5]} rotation={[-0.55 - (variant % 3) * 0.12, 0, 0]}>
        <P g={geo.cyl(0.32, 0.38, 1.6, 8)} m="hull" p={[0, 0, 0.8]} r={[Math.PI / 2, 0, Math.PI / 8]} />
        <P g={geo.cyl(0.4, 0.4, 0.12, 8)} m="accent" p={[0, 0, 1.6]} r={[Math.PI / 2, 0, Math.PI / 8]} />
        <P g={geo.cyl(0.3, 0.3, 0.02, 8)} m="window" p={[0, 0, 1.67]} r={[Math.PI / 2, 0, Math.PI / 8]} />
      </group>
      <P g={geo.facetDome(0.45)} m="glass" p={[0, 0.5, -length / 2 + 0.7]} />
      <TierDress tier={tier} dims={{ w: 1.1, d: length, bottom: -0.55, top: 0.55 }} seed={variant} />
    </group>
  );
}

/** Angular solar wings either side of a mount at the end of an arm. */
function SolarArray({ variant, tier }: { variant: number; tier: number }) {
  // Wing outline at +x, widening outward; mirrored for -x.
  const outline: Array<[number, number]> = [
    [0.22, -0.4],
    [1.15, -0.62],
    [1.15, 0.62],
    [0.22, 0.4]
  ];
  const tilt = variant % 3 === 1 ? 0.35 : 0.08;
  const wing = (side: number) => (
    <group key={side} rotation={[0, side > 0 ? 0 : Math.PI, tilt]}>
      <P g={geo.prism(outline, 0.04, 0.01)} m="solar" />
      {[0.5, 0.82].map((x) => (
        <P key={x} g={geo.box(0.03, 0.05, 0.86 + x * 0.3)} m="solarFrame" p={[x, 0.01, 0]} />
      ))}
      <P g={geo.box(0.95, 0.05, 0.03)} m="solarFrame" p={[0.68, 0.01, 0]} />
    </group>
  );
  return (
    <group>
      <P g={geo.box(0.14, 0.14, HALF + 0.25)} m="truss" p={[0, 0, -HALF / 2 + 0.12]} />
      <group position={[0, 0, 0.25]}>
        <P g={geo.chamferBox(0.42, 0.3, 0.42, 0.1)} m="graphite" />
        {wing(1)}
        {wing(-1)}
      </group>
      <TierDress tier={tier} dims={{ w: 0.5, d: 0.5, bottom: -0.15, top: 0.15, small: true }} seed={variant} />
    </group>
  );
}

function Greenhouse({ variant, tier }: { variant: number; tier: number }) {
  const plants: ReactNode[] = [];
  for (let index = 0; index < 5; index += 1) {
    const angle = index * 1.3 + variant;
    plants.push(
      <P key={index} g={geo.ico(0.16 + (index % 2) * 0.07)} m={index % 2 ? "plant" : "plantDark"} p={[Math.cos(angle) * 0.32, 0.18, Math.sin(angle) * 0.32 + 0.15]} />
    );
  }
  return (
    <group>
      <P g={geo.box(0.16, 0.16, HALF)} m="truss" p={[0, 0, -HALF / 2]} />
      <P g={geo.cyl(0.85, 0.75, 0.22, 6)} m="hullShade" p={[0, 0, 0.15]} />
      {plants}
      <P g={geo.facetDome(0.8)} m="glass" p={[0, 0.11, 0.15]} />
      <TierDress tier={tier} dims={{ w: 1.2, d: 1.2, bottom: -0.11, top: 0.11, small: true }} seed={variant} />
    </group>
  );
}

function Dish({ variant, tier }: { variant: number; tier: number }) {
  return (
    <group>
      <P g={geo.box(0.12, 0.12, HALF)} m="truss" p={[0, 0, -HALF / 2]} />
      <P g={geo.box(0.08, 0.9, 0.08)} m="truss" p={[0, 0.45, 0.1]} />
      <group position={[0, 1.0, 0.1]} rotation={[-0.7, (variant % 4) * 0.6, 0]}>
        <P g={geo.cone(0.75, 0.28, 8)} m="hull" r={[Math.PI, 0, 0]} />
        <P g={geo.box(0.03, 0.6, 0.03)} m="truss" p={[0, 0.2, 0]} />
        <P g={geo.cone(0.07, 0.18, 4)} m="accent" p={[0, 0.55, 0]} />
      </group>
      <Blinker p={[0, 0.35, 0.1]} phase={variant * 0.2} m="energy" />
      <TierDress tier={tier} dims={{ w: 0.5, d: 0.5, bottom: -0.1, top: 0.1, small: true }} seed={variant} />
    </group>
  );
}

/** An angular hexagonal ring habitat that turns slowly around its hub. */
function RingHabitat({ levels, tier, variant }: { levels: number; tier: number; variant: number }) {
  const spin = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (spin.current) {
      spin.current.rotation.y += delta * 0.2;
    }
  });
  const rings: ReactNode[] = [];
  for (let level = 0; level < levels; level += 1) {
    const y = level * RING_GAP;
    const lights: ReactNode[] = [];
    for (let index = 0; index < 6; index += 1) {
      const angle = (index / 6) * Math.PI * 2 + Math.PI / 6;
      lights.push(
        <P key={index} g={geo.box(0.5, 0.08, 0.04)} m="window" p={[Math.cos(angle) * 1.72, y + 0.04, Math.sin(angle) * 1.72]} r={[0, -angle + Math.PI / 2, 0]} />
      );
    }
    rings.push(
      <group key={level}>
        <P g={geo.hexRing(1.95, 0.26)} m="hull" p={[0, y, 0]} r={[Math.PI / 2, 0, 0]} />
        {lights}
        {[0, 1, 2].map((spoke) => (
          <P key={spoke} g={geo.box(3.8, 0.1, 0.12)} m="truss" p={[0, y, 0]} r={[0, (spoke * Math.PI) / 3 + Math.PI / 6, 0]} />
        ))}
      </group>
    );
  }
  return (
    <group>
      <P g={geo.cyl(0.5, 0.5, 1.0 + (levels - 1) * RING_GAP, 8)} m="hullShade" p={[0, ((levels - 1) * RING_GAP) / 2, 0]} r={[0, Math.PI / 8, 0]} />
      <P g={geo.cyl(0.56, 0.56, 0.1, 8)} m={variant % 2 ? "accent" : "accentBlue"} p={[0, 0.55 + (levels - 1) * RING_GAP, 0]} r={[0, Math.PI / 8, 0]} />
      <group ref={spin}>{rings}</group>
      <TierDress tier={tier} dims={{ w: 1.0, d: 1.0, bottom: -0.5, top: 0.5 + (levels - 1) * RING_GAP }} seed={variant} />
    </group>
  );
}

export function PieceModel({ kind, levels, tier = 1, variant }: { kind: PieceKind; levels: number; tier?: number; variant: number }) {
  switch (kind) {
    case "core":
      return <Core levels={levels} tier={tier} variant={variant} />;
    case "node":
      return <Node levels={levels} tier={tier} variant={variant} />;
    case "ring":
      return <RingHabitat levels={levels} tier={tier} variant={variant} />;
    case "corridor":
      return <Corridor variant={variant} tier={tier} />;
    case "dock":
      return <Dock variant={variant} tier={tier} />;
    case "lab":
      return <Lab levels={levels} tier={tier} variant={variant} />;
    case "observatory":
      return <Observatory variant={variant} tier={tier} />;
    case "solar":
      return <SolarArray variant={variant} tier={tier} />;
    case "greenhouse":
      return <Greenhouse variant={variant} tier={tier} />;
    case "dish":
      return <Dish variant={variant} tier={tier} />;
  }
}

/** Lowest and highest points of a module, for the assembly frame and the build clip plane. */
export function pieceSpan(kind: PieceKind, levels: number): [number, number] {
  switch (kind) {
    case "core":
      return [-0.8, 0.35 + levels * CORE_DECK + 1.2];
    case "node":
      return [-0.65, 0.65 + (levels - 1) * NODE_DECK + 0.6];
    case "ring":
      return [-0.5, 0.6 + (levels - 1) * RING_GAP];
    case "lab":
      return [-0.7, levels > 1 ? 1.4 : 0.85];
    case "observatory":
      return [-0.6, 2.1];
    case "solar":
      return [-0.2, 0.3];
    case "greenhouse":
      return [-0.15, 0.95];
    case "dish":
      return [-0.1, 1.6];
    default:
      return [-0.7, 0.7];
  }
}

/** Where a newly added deck starts, for animating it into place. */
export function deckBase(kind: PieceKind, level: number): number {
  switch (kind) {
    case "core":
      return 0.35 + (level - 1) * CORE_DECK;
    case "node":
      return 0.65 + (level - 2) * NODE_DECK;
    case "ring":
      return (level - 1) * RING_GAP - 0.3;
    case "lab":
      return 0.5;
    default:
      return 0;
  }
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
