import { useEffect, useLayoutEffect, useMemo, useRef, type ComponentRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { Citizens, type Cell, type WalkGrid } from "./Citizens.tsx";
import { resolveCastle, type PlacedPiece } from "./generator.ts";
import { MATERIALS, createMaterials, geo } from "./materials.ts";
import { CELL, MaterialContext, PieceModel, Rubble, STOREY, Scaffold, pieceHeight, storeyBase } from "./pieces.tsx";
import { hash01 } from "./rng.ts";
import { skyAt, useHour, type Sky } from "./timeOfDay.ts";

export interface CastleViewProps {
  seed: number;
  buildPoints: number;
  damage: number;
  rogues: number;
  builders: number;
  /** the tray popup: fixed camera, lower resolution */
  compact?: boolean;
}

function pieceCenter(piece: PlacedPiece): [number, number] {
  return [(piece.x + (piece.w - 1) / 2) * CELL, (piece.z + (piece.d - 1) / 2) * CELL];
}

function PlacedModel({ piece, levels }: { piece: PlacedPiece; levels: number }) {
  const [x, z] = pieceCenter(piece);
  return (
    <group position={[x, 0, z]} rotation={[0, (-piece.rot * Math.PI) / 2, 0]}>
      <PieceModel kind={piece.kind} levels={levels} variant={piece.variant} />
    </group>
  );
}

/** The piece being built: drawn up to the current progress, inside scaffolding. */
function Construction({ piece, levels, from, height, progress }: { piece: PlacedPiece; levels: number; from: number; height: number; progress: number }) {
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, -1, 0), 0), []);
  const materials = useMemo(() => createMaterials([plane]), [plane]);
  useEffect(() => () => Object.values(materials).forEach((material) => material.dispose()), [materials]);

  const shown = useRef(progress);
  useFrame((_, delta) => {
    // Ease toward the real progress so growth is visible but smooth.
    shown.current += (progress - shown.current) * Math.min(1, delta * 2);
    plane.constant = from + (height - from) * shown.current;
    materials.window.emissiveIntensity = MATERIALS.window.emissiveIntensity;
  });

  const [x, z] = pieceCenter(piece);
  const scaffoldProgress = (from + (height - from) * progress) / height;
  return (
    <group>
      <MaterialContext.Provider value={materials}>
        <group position={[x, 0, z]} rotation={[0, (-piece.rot * Math.PI) / 2, 0]}>
          <PieceModel kind={piece.kind} levels={levels} variant={piece.variant} />
        </group>
      </MaterialContext.Provider>
      <group position={[x, 0, z]}>
        <Scaffold w={piece.w * CELL - 0.2} d={piece.d * CELL - 0.2} height={Math.min(height, 9)} progress={scaffoldProgress} />
      </group>
    </group>
  );
}

function Tiles({ cells }: { cells: Cell[] }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    if (!mesh.current) {
      return;
    }
    const matrix = new THREE.Matrix4();
    cells.forEach(([x, z], index) => {
      matrix.makeTranslation(x * CELL, 0.012, z * CELL);
      mesh.current!.setMatrixAt(index, matrix);
    });
    mesh.current.count = cells.length;
    mesh.current.instanceMatrix.needsUpdate = true;
  }, [cells]);
  return (
    <instancedMesh
      key={Math.ceil(cells.length / 64)}
      ref={mesh}
      args={[geo.box(CELL, 0.03, CELL), MATERIALS.cobble, Math.ceil(cells.length / 64) * 64 + 64]}
      receiveShadow
    />
  );
}

function Tree({ x, z, kind, scale }: { x: number; z: number; kind: number; scale: number }) {
  if (kind === 0) {
    return (
      <group position={[x, 0, z]} scale={scale}>
        <mesh geometry={geo.cyl(0.1, 0.14, 0.5, 5)} material={MATERIALS.timber} position={[0, 0.25, 0]} castShadow />
        <mesh geometry={geo.cone(0.62, 1.1, 7)} material={MATERIALS.pine} position={[0, 0.95, 0]} castShadow />
        <mesh geometry={geo.cone(0.46, 0.9, 7)} material={MATERIALS.pine} position={[0, 1.5, 0]} castShadow />
      </group>
    );
  }
  if (kind === 1) {
    return (
      <group position={[x, 0, z]} scale={scale}>
        <mesh geometry={geo.cyl(0.1, 0.13, 0.7, 5)} material={MATERIALS.timber} position={[0, 0.35, 0]} castShadow />
        <mesh geometry={geo.ico(0.62)} material={MATERIALS.leaf} position={[0, 1.05, 0]} castShadow />
      </group>
    );
  }
  return (
    <group position={[x, 0, z]} scale={scale}>
      <mesh geometry={geo.dodeca(0.35)} material={MATERIALS.stoneTrim} position={[0, 0.15, 0]} rotation={[0.3, x, 0.2]} castShadow />
    </group>
  );
}

function Island({ radius, center }: { radius: number; center: [number, number] }) {
  const group = useRef<THREE.Group>(null);
  const shown = useRef(radius);
  useFrame((_, delta) => {
    shown.current += (radius - shown.current) * Math.min(1, delta * 1.5);
    if (group.current) {
      group.current.scale.set(shown.current, 1, shown.current);
    }
  });
  return (
    <group position={[center[0], 0, center[1]]}>
      <group ref={group}>
        <mesh geometry={geo.cyl(1, 1, 0.5, 28)} material={MATERIALS.grass} position={[0, -0.25, 0]} receiveShadow />
        <mesh geometry={geo.cyl(1.01, 0.97, 0.35, 28)} material={MATERIALS.dirt} position={[0, -0.67, 0]} />
        <mesh geometry={geo.cyl(0.97, 0.25, 2.6, 12)} material={MATERIALS.dirtDark} position={[0, -2.15, 0]} />
      </group>
    </group>
  );
}

function Clouds({ radius }: { radius: number }) {
  const group = useRef<THREE.Group>(null);
  const puffs = useMemo(
    () =>
      Array.from({ length: 7 }, (_, index) => {
        const angle = (index / 7) * Math.PI * 2;
        const distance = 1.35 + (index % 3) * 0.18;
        // Below the island's rim, so they frame it without covering anything.
        return { angle, distance, y: -3.5 - (index % 3) * 1.4, size: 0.7 + (index % 4) * 0.2 };
      }),
    []
  );
  useFrame((_, delta) => {
    if (group.current) {
      group.current.rotation.y += delta * 0.01;
    }
  });
  const cloud = useMemo(() => new THREE.MeshStandardMaterial({ color: "#ffffff", flatShading: true, roughness: 1, transparent: true, opacity: 0.85 }), []);
  return (
    <group ref={group}>
      {puffs.map((puff, index) => (
        <group
          key={index}
          position={[Math.cos(puff.angle) * radius * puff.distance, puff.y, Math.sin(puff.angle) * radius * puff.distance]}
          scale={puff.size * Math.max(1, radius / 10)}
        >
          <mesh geometry={geo.ico(1)} material={cloud} />
          <mesh geometry={geo.ico(0.75)} material={cloud} position={[1.1, -0.2, 0.2]} />
          <mesh geometry={geo.ico(0.7)} material={cloud} position={[-1.0, -0.25, -0.1]} />
        </group>
      ))}
    </group>
  );
}

function Lights({ sky, radius, center }: { sky: Sky; radius: number; center: [number, number] }) {
  const light = useRef<THREE.DirectionalLight>(null);
  const { scene } = useThree();
  useEffect(() => {
    scene.background = sky.sky;
    scene.fog = new THREE.Fog(sky.horizon, radius * 4, radius * 9);
    MATERIALS.window.emissiveIntensity = sky.windowGlow;
  }, [scene, sky, radius]);

  useLayoutEffect(() => {
    const sun = light.current;
    if (!sun) {
      return;
    }
    const distance = radius * 3 + 20;
    sun.position.set(
      center[0] + Math.cos(sky.sunAngle) * distance * 0.8,
      distance * (0.55 + Math.sin(sky.sunAngle) * 0.4),
      center[1] + distance * 0.5
    );
    sun.target.position.set(center[0], 0, center[1]);
    sun.target.updateMatrixWorld();
    const extent = radius + 4;
    sun.shadow.camera.left = -extent;
    sun.shadow.camera.right = extent;
    sun.shadow.camera.top = extent;
    sun.shadow.camera.bottom = -extent;
    sun.shadow.camera.far = distance * 3;
    sun.shadow.camera.updateProjectionMatrix();
  }, [sky, radius, center]);

  return (
    <>
      <hemisphereLight args={[sky.horizon, "#6b5a45", sky.ambient]} />
      <directionalLight
        ref={light}
        color={sky.sun}
        intensity={sky.sunIntensity}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
      />
    </>
  );
}

/** Keeps the whole castle in frame as it grows. */
function CameraRig({ radius, center, compact }: { radius: number; center: [number, number]; compact: boolean }) {
  const { camera } = useThree();
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const wanted = radius * (compact ? 3.0 : 3.3) + 6;
  const lastWanted = useRef(0);

  useLayoutEffect(() => {
    if (lastWanted.current === 0) {
      camera.position.set(center[0] + wanted * 0.62, wanted * 0.55, center[1] + wanted * 0.62);
    }
  }, [camera, center, wanted]);

  useFrame((_, delta) => {
    const orbit = controls.current;
    if (!orbit) {
      return;
    }
    const target = new THREE.Vector3(center[0], Math.min(radius * 0.12, 2.5), center[1]);
    orbit.target.lerp(target, Math.min(1, delta * 2));
    // Pull back as the castle grows, but leave the user's own zoom alone otherwise.
    if (Math.abs(wanted - lastWanted.current) > 0.5) {
      const offset = camera.position.clone().sub(orbit.target);
      const length = offset.length();
      const next = length + (wanted - length) * Math.min(1, delta * 2);
      camera.position.copy(orbit.target).add(offset.setLength(next));
      if (Math.abs(next - wanted) < 0.3) {
        lastWanted.current = wanted;
      }
    }
    orbit.update();
  });

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enablePan={false}
      enableZoom={!compact}
      enableDamping
      autoRotate
      autoRotateSpeed={compact ? 0.5 : 0.25}
      minPolarAngle={0.35}
      maxPolarAngle={1.25}
      minDistance={8}
      maxDistance={wanted * 2}
    />
  );
}

function Scene({ seed, buildPoints, damage, rogues, builders, compact = false }: CastleViewProps) {
  const castle = resolveCastle(seed, buildPoints);
  const builtSteps = castle.builtSteps;
  const current = castle.current;
  const planner = castle.planner;

  // Everything below only changes when a step completes, not on every progress tick.
  const layout = useMemo(() => {
    const resolved = resolveCastle(seed, planner.steps[builtSteps - 1]?.total ?? 0);
    const pieces = resolved.pieces;
    const raisingTarget = current?.type === "raise" ? current.target : -1;
    const sitePiece = current?.type === "place" ? current.piece : current?.type === "raise" ? planner.pieces[current.target] : null;

    const blocked = new Set<string>();
    const tiles: Cell[] = [];
    let farthest = 3;
    let sumX = 0;
    let sumZ = 0;
    let cellCount = 0;
    const allCells = [...pieces.flatMap((piece) => piece.cells), ...(current?.type === "place" ? current.piece.cells : [])];
    for (const piece of pieces) {
      for (const [x, z] of piece.cells) {
        if (piece.kind !== "garden") {
          tiles.push([x, z]);
        }
      }
    }
    for (const [x, z] of allCells) {
      blocked.add(`${x},${z}`);
      sumX += x;
      sumZ += z;
      cellCount += 1;
    }
    const centerCell: [number, number] = [sumX / cellCount, sumZ / cellCount];
    for (const [x, z] of allCells) {
      farthest = Math.max(farthest, Math.hypot(x - centerCell[0], z - centerCell[1]));
    }
    const radiusCells = farthest + 2.6;
    const center: [number, number] = [centerCell[0] * CELL, centerCell[1] * CELL];

    const inside = (x: number, z: number) => Math.hypot(x - centerCell[0], z - centerCell[1]) <= radiusCells - 0.8;
    const isFree = (x: number, z: number) => inside(x, z) && !blocked.has(`${x},${z}`);
    const neighbours = (cells: Array<[number, number]>) => {
      const result: Cell[] = [];
      for (const [x, z] of cells) {
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          if (isFree(x + dx, z + dz)) {
            result.push([x + dx, z + dz]);
          }
        }
      }
      return result;
    };

    const free: Cell[] = [];
    const trees: Array<{ x: number; z: number; kind: number; scale: number }> = [];
    const span = Math.ceil(radiusCells) + 1;
    for (let x = Math.floor(centerCell[0]) - span; x <= Math.ceil(centerCell[0]) + span; x += 1) {
      for (let z = Math.floor(centerCell[1]) - span; z <= Math.ceil(centerCell[1]) + span; z += 1) {
        if (!isFree(x, z)) {
          continue;
        }
        free.push([x, z]);
        const nearCastle = neighbours([[x, z]]).length < 4 || [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => blocked.has(`${x + dx},${z + dz}`));
        const roll = hash01(seed, x * 7919 + z * 104729);
        if (!nearCastle && roll < 0.22) {
          trees.push({
            x: x * CELL + (hash01(seed, x * 31 + z) - 0.5) * 1.2,
            z: z * CELL + (hash01(seed, z * 37 + x) - 0.5) * 1.2,
            kind: roll < 0.1 ? 0 : roll < 0.19 ? 1 : 2,
            scale: 0.8 + hash01(seed, x + z * 13) * 0.6
          });
        }
      }
    }

    const keep = pieces[0];
    const grid: WalkGrid = {
      isFree,
      keepSide: neighbours(keep.cells),
      siteSide: sitePiece ? neighbours(sitePiece.cells) : [],
      free
    };

    // Damage lands on the most recently finished pieces (never the keep or the site).
    const damaged = pieces.filter((piece) => piece.id !== 0 && piece.id !== raisingTarget).slice(damage > 0 ? -damage : Infinity);

    return {
      pieces: pieces.filter((piece) => piece.id !== raisingTarget),
      tiles,
      trees,
      grid,
      center,
      radius: radiusCells * CELL,
      damaged,
      villagers: Math.min(8, pieces.filter((piece) => piece.kind === "house").length),
      raisingTarget
    };
  }, [seed, builtSteps, planner, current, damage]);

  const hour = useHour();
  const sky = useMemo(() => skyAt(hour), [hour]);

  let construction = null;
  if (current?.type === "place") {
    const piece = current.piece;
    construction = (
      <Construction piece={piece} levels={piece.baseLevels} from={0} height={pieceHeight(piece.kind, piece.baseLevels)} progress={castle.progress} />
    );
  } else if (current?.type === "raise") {
    const piece = planner.pieces[current.target];
    const from = storeyBase(piece.kind, current.level);
    construction = (
      <Construction piece={piece} levels={current.level} from={from} height={from + STOREY + 0.2} progress={castle.progress} />
    );
  }

  return (
    <>
      <Lights sky={sky} radius={layout.radius} center={layout.center} />
      <CameraRig radius={layout.radius} center={layout.center} compact={compact} />
      <Island radius={layout.radius} center={layout.center} />
      {!compact && <Clouds radius={layout.radius} />}
      <Tiles cells={layout.tiles} />
      {layout.trees.map((tree, index) => (
        <Tree key={index} {...tree} />
      ))}
      {layout.pieces.map((piece) => (
        <PlacedModel key={piece.id} piece={piece} levels={piece.levels} />
      ))}
      {construction}
      {layout.damaged.map((piece) => {
        const [x, z] = pieceCenter(piece);
        return (
          <group key={`rubble-${piece.id}`} position={[x, 0, z]}>
            <Rubble w={piece.w * CELL} d={piece.d * CELL} seed={piece.variant} />
          </group>
        );
      })}
      <Citizens grid={layout.grid} builders={builders} rogues={rogues} villagers={layout.villagers} seed={seed} />
    </>
  );
}

export default function CastleView(props: CastleViewProps) {
  return (
    <Canvas
      shadows
      dpr={props.compact ? 1 : [1, 2]}
      gl={{ antialias: true, localClippingEnabled: true }}
      camera={{ fov: 30, near: 0.5, far: 1000, position: [20, 16, 20] }}
      onCreated={({ gl }) => {
        gl.localClippingEnabled = true;
      }}
    >
      <Scene {...props} />
    </Canvas>
  );
}
