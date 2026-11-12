import { useEffect, useLayoutEffect, useMemo, useRef, type ComponentRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { PIECES } from "./catalog.ts";
import { DX, DZ, resolveStation, rotateCell, type PlacedPiece } from "./generator.ts";
import { journeyAt, planetTexture, ringTexture, type Planet } from "./journey.ts";
import { createMaterials } from "./materials.ts";
import { Alien, AssemblyFrame, CELL, MaterialContext, PieceModel, Ports, Scorch, deckBase, pieceSpan } from "./pieces.tsx";
import { createRng, hash01 } from "./rng.ts";
import { MAX_LEVEL, resolveUpgrades, type UpgradeSegment } from "./upgrades.ts";

export interface StationViewProps {
  seed: number;
  buildPoints: number;
  mode: "build" | "upgrade";
  upgradePoints: number;
  upgradeLog: UpgradeSegment[];
  damage: number;
  aliens: number;
  /** the tray popup: fixed zoom, lower resolution */
  compact?: boolean;
}

// The sun sits over the camera's starting shoulder, so the side you first see is lit and the
// planet ahead (towards -x, -z) shows a mostly lit face.
const SUN_DIRECTION = new THREE.Vector3(0.3, 0.55, 0.78).normalize();

function pieceCenter(piece: PlacedPiece): [number, number] {
  return [(piece.x + (piece.w - 1) / 2) * CELL, (piece.z + (piece.d - 1) / 2) * CELL];
}

function PlacedModel({ piece, levels, tier, linked }: { piece: PlacedPiece; levels: number; tier: number; linked: boolean[] }) {
  const [x, z] = pieceCenter(piece);
  // Maxed-out modules grow a touch, so a fully upgraded ship looks heavier.
  const scale = tier >= MAX_LEVEL ? 1.06 : 1;
  return (
    <group position={[x, 0, z]} rotation={[0, (-piece.rot * Math.PI) / 2, 0]}>
      <group scale={scale}>
        <PieceModel kind={piece.kind} levels={levels} tier={tier} variant={piece.variant} />
      </group>
      <Ports kind={piece.kind} linked={linked} />
    </group>
  );
}

/** The welding frame around a module while it's being upgraded. */
function UpgradeFrame({ piece, levels, progress }: { piece: PlacedPiece; levels: number; progress: number }) {
  const [x, z] = pieceCenter(piece);
  const [bottom, top] = pieceSpan(piece.kind, levels);
  return (
    <group position={[x, 0, z]}>
      <AssemblyFrame w={piece.w * CELL - 0.2} d={piece.d * CELL - 0.2} bottom={bottom - 0.1} top={top + 0.2} progress={progress} />
    </group>
  );
}

/** The module being built: printed up to the current progress inside a glowing frame. */
function Construction({
  piece,
  levels,
  linked,
  from,
  to,
  progress,
  tier,
  showFrame
}: {
  piece: PlacedPiece;
  levels: number;
  linked: boolean[];
  from: number;
  to: number;
  progress: number;
  tier: number;
  /** hidden while upgrading, when building is on hold */
  showFrame: boolean;
}) {
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, -1, 0), 0), []);
  const materials = useMemo(() => createMaterials([plane]), [plane]);
  useEffect(() => () => Object.values(materials).forEach((material) => material.dispose()), [materials]);
  const group = useRef<THREE.Group>(null);

  const shown = useRef(progress);
  useFrame((_, delta) => {
    // Ease toward the real progress so growth is visible but smooth.
    shown.current += (progress - shown.current) * Math.min(1, delta * 2);
    const worldY = group.current ? group.current.getWorldPosition(new THREE.Vector3()).y : 0;
    plane.constant = worldY + from + (to - from) * shown.current;
  });

  const [x, z] = pieceCenter(piece);
  const [bottom, top] = pieceSpan(piece.kind, levels);
  return (
    <group ref={group}>
      <MaterialContext.Provider value={materials}>
        <group position={[x, 0, z]} rotation={[0, (-piece.rot * Math.PI) / 2, 0]}>
          <PieceModel kind={piece.kind} levels={levels} tier={tier} variant={piece.variant} />
          <Ports kind={piece.kind} linked={linked} />
        </group>
      </MaterialContext.Provider>
      <group position={[x, 0, z]} visible={showFrame}>
        <AssemblyFrame
          w={piece.w * CELL - 0.3}
          d={piece.d * CELL - 0.3}
          bottom={Math.min(bottom, from)}
          top={Math.max(top, to)}
          progress={(from + (to - from) * progress - Math.min(bottom, from)) / (Math.max(top, to) - Math.min(bottom, from))}
        />
      </group>
    </group>
  );
}

// ---- space -------------------------------------------------------------------------------------

function Stars({ count }: { count: number }) {
  const points = useRef<THREE.Points>(null);
  const geometry = useMemo(() => {
    const rng = createRng(77);
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const tint = [new THREE.Color("#ffffff"), new THREE.Color("#cfe0ff"), new THREE.Color("#ffe7c4"), new THREE.Color("#ffd0d0")];
    for (let index = 0; index < count; index += 1) {
      const u = rng() * 2 - 1;
      const angle = rng() * Math.PI * 2;
      const radius = Math.sqrt(1 - u * u);
      positions.set([Math.cos(angle) * radius * 700, u * 700, Math.sin(angle) * radius * 700], index * 3);
      const color = tint[Math.floor(rng() * tint.length)].clone().multiplyScalar(0.45 + rng() * 0.55);
      colors.set([color.r, color.g, color.b], index * 3);
    }
    const result = new THREE.BufferGeometry();
    result.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    result.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return result;
  }, [count]);
  useFrame((_, delta) => {
    if (points.current) {
      points.current.rotation.y += delta * 0.004; // a slow drift, like travelling
    }
  });
  return (
    <points ref={points} geometry={geometry}>
      <pointsMaterial size={1.6} sizeAttenuation={false} vertexColors depthWrite={false} />
    </points>
  );
}

const glowCache = new Map<string, THREE.Texture>();

/** Radial glow: warm and solid for the sun, neutral (tinted by the material) for planet halos. */
function glowTexture(kind: "sun" | "halo" = "halo"): THREE.Texture {
  const cached = glowCache.get(kind);
  if (cached) {
    return cached;
  }
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  if (kind === "sun") {
    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(0.2, "rgba(255,240,210,0.85)");
    gradient.addColorStop(0.5, "rgba(255,200,140,0.25)");
    gradient.addColorStop(1, "rgba(255,180,120,0)");
  } else {
    gradient.addColorStop(0, "rgba(255,255,255,0.9)");
    gradient.addColorStop(0.62, "rgba(255,255,255,0.55)");
    gradient.addColorStop(0.72, "rgba(255,255,255,0.18)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
  }
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  const texture = new THREE.CanvasTexture(canvas);
  glowCache.set(kind, texture);
  return texture;
}

function Sun({ size }: { size: number }) {
  const texture = useMemo(() => glowTexture("sun"), []);
  const position = SUN_DIRECTION.clone().multiplyScalar(600);
  return (
    <sprite position={position} scale={[size * 90, size * 90, 1]}>
      <spriteMaterial map={texture} blending={THREE.AdditiveBlending} depthWrite={false} transparent />
    </sprite>
  );
}

function PlanetBody({ planet, angle, distance }: { planet: Planet; angle: number; distance: number }) {
  const body = useRef<THREE.Mesh>(null);
  const radius = planet.size * 34;
  const material = useMemo(() => new THREE.MeshStandardMaterial({ map: planetTexture(planet), roughness: 0.95, metalness: 0 }), [planet]);
  // A soft halo behind the planet instead of a hard-edged shell.
  const halo = useMemo(
    () =>
      new THREE.SpriteMaterial({
        map: glowTexture(),
        color: planet.colors[2],
        transparent: true,
        opacity: planet.style === "rocky" ? 0.12 : 0.3,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      }),
    [planet]
  );
  const ring = useMemo(() => {
    if (!planet.ring) {
      return null;
    }
    const geometry = new THREE.RingGeometry(radius * planet.ring.inner, radius * planet.ring.outer, 96, 1);
    // Map the texture across the ring's width instead of across the plane.
    const position = geometry.attributes.position;
    const uv = geometry.attributes.uv;
    for (let index = 0; index < position.count; index += 1) {
      const r = Math.hypot(position.getX(index), position.getY(index));
      uv.setXY(index, (r / radius - planet.ring.inner) / (planet.ring.outer - planet.ring.inner), 0.5);
    }
    const material = new THREE.MeshStandardMaterial({
      map: ringTexture(planet.ring.color),
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      roughness: 1
    });
    return { geometry, material };
  }, [planet, radius]);

  useFrame((_, delta) => {
    if (body.current) {
      body.current.rotation.y += delta * 0.02;
    }
  });

  const position: [number, number, number] = [Math.cos(angle) * distance, -distance * 0.28, Math.sin(angle) * distance];
  return (
    <group position={position} rotation={[0, 0, planet.tilt]}>
      <mesh ref={body} material={material}>
        <sphereGeometry args={[radius, 48, 32]} />
      </mesh>
      <sprite material={halo} scale={[radius * 2.9, radius * 2.9, 1]} renderOrder={-1} />
      {ring ? <mesh geometry={ring.geometry} material={ring.material} rotation={[Math.PI / 2 - 0.12, 0, 0]} /> : null}
      {planet.name === "Earth" ? (
        <mesh position={[radius * 1.9, radius * 0.3, radius * 0.6]}>
          <sphereGeometry args={[radius * 0.27, 24, 16]} />
          <meshStandardMaterial color="#b9b6b0" roughness={1} />
        </mesh>
      ) : null}
    </group>
  );
}

/** Space around the station: stars, the sun, and the planets the station is passing. */
function Backdrop({ builtSteps, progress, compact }: { builtSteps: number; progress: number; compact: boolean }) {
  const journey = journeyAt(builtSteps, progress);
  const { scene } = useThree();
  useEffect(() => {
    scene.background = new THREE.Color(journey.current.space).lerp(new THREE.Color(journey.next.space), journey.leg);
    scene.fog = null;
  }, [scene, journey.current, journey.next, journey.leg]);

  // The current planet slides past and away; the next one drifts in to take its place, ending
  // the leg where the current one started, so the hand-over is seamless.
  const distance = 420;
  const currentAngle = -2.0 - journey.leg * 1.4;
  const nextAngle = currentAngle + 1.4;
  return (
    <>
      <Stars count={compact ? 1200 : 2600} />
      <Sun size={journey.current.sun.size + (journey.next.sun.size - journey.current.sun.size) * journey.leg} />
      <PlanetBody planet={journey.current} angle={currentAngle} distance={distance} />
      {journey.leg > 0.35 ? <PlanetBody planet={journey.next} angle={nextAngle} distance={distance * 1.15} /> : null}
    </>
  );
}

function Lights({ builtSteps, progress, radius }: { builtSteps: number; progress: number; radius: number }) {
  const sun = useRef<THREE.DirectionalLight>(null);
  const journey = journeyAt(builtSteps, progress);
  const intensity = journey.current.sun.intensity + (journey.next.sun.intensity - journey.current.sun.intensity) * journey.leg;
  const color = new THREE.Color(journey.current.sun.color).lerp(new THREE.Color(journey.next.sun.color), journey.leg);
  const bounce = new THREE.Color(journey.current.colors[0]).lerp(new THREE.Color(journey.next.colors[0]), journey.leg);

  useLayoutEffect(() => {
    const light = sun.current;
    if (!light) {
      return;
    }
    const distance = radius * 3 + 30;
    light.position.copy(SUN_DIRECTION).multiplyScalar(distance);
    light.target.position.set(0, 0, 0);
    light.target.updateMatrixWorld();
    const extent = radius + 4;
    light.shadow.camera.left = -extent;
    light.shadow.camera.right = extent;
    light.shadow.camera.top = extent;
    light.shadow.camera.bottom = -extent;
    light.shadow.camera.far = distance * 3;
    light.shadow.camera.updateProjectionMatrix();
  }, [radius]);

  return (
    <>
      <hemisphereLight args={["#6a7db8", "#1a1d2b", 1.1]} />
      <directionalLight
        ref={sun}
        color={color}
        intensity={intensity}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
      />
      {/* light bouncing off the planet below */}
      <directionalLight color={bounce} intensity={0.45} position={[0.4, -1, 0.3]} />
    </>
  );
}

/** Keeps the whole station in frame as it grows. */
function CameraRig({ radius, compact }: { radius: number; compact: boolean }) {
  const { camera } = useThree();
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const wanted = radius * (compact ? 2.7 : 3.1) + 7;
  const lastWanted = useRef(0);

  useLayoutEffect(() => {
    if (lastWanted.current === 0) {
      camera.position.set(wanted * 0.6, wanted * 0.5, wanted * 0.62);
    }
  }, [camera, wanted]);

  useFrame((_, delta) => {
    const orbit = controls.current;
    if (!orbit) {
      return;
    }
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
      target={[0, 0, 0]}
      enablePan={false}
      enableZoom={!compact}
      enableDamping
      autoRotate
      autoRotateSpeed={compact ? 0.45 : 0.22}
      minPolarAngle={0.2}
      maxPolarAngle={2.2}
      minDistance={6}
      maxDistance={wanted * 2.2}
    />
  );
}

/** Finds a side of a module facing open space, for aliens and scorch marks. */
function openSide(piece: PlacedPiece, isTaken: (x: number, z: number) => boolean, pick: number) {
  const options: Array<{ cell: [number, number]; dir: number }> = [];
  for (const cell of piece.cells) {
    for (let dir = 0; dir < 4; dir += 1) {
      if (!isTaken(cell[0] + DX[dir], cell[1] + DZ[dir])) {
        options.push({ cell, dir });
      }
    }
  }
  return options.length ? options[Math.floor(pick * options.length) % options.length] : null;
}

function Scene({ seed, buildPoints, mode, upgradePoints, upgradeLog, damage, aliens, compact = false }: StationViewProps) {
  const station = resolveStation(seed, buildPoints);
  const { builtSteps, current, planner, progress } = station;
  const upgrades = useMemo(() => resolveUpgrades(seed, upgradeLog, upgradePoints), [seed, upgradeLog, upgradePoints]);
  const tierOf = (id: number) => upgrades.levels.get(id) ?? 1;
  const upgrading = mode === "upgrade" && upgrades.current ? upgrades.current : null;

  // Everything below only changes when a step completes, not on every progress tick.
  const layout = useMemo(() => {
    const resolved = resolveStation(seed, planner.steps[builtSteps - 1]?.total ?? 0);
    const pieces = resolved.pieces;
    const raisingTarget = current?.type === "raise" ? current.target : -1;
    const sitePiece = current?.type === "place" ? current.piece : null;

    const owner = new Map<string, number>();
    for (const piece of [...pieces, ...(sitePiece ? [sitePiece] : [])]) {
      for (const [x, z] of piece.cells) {
        owner.set(`${x},${z}`, piece.id);
      }
    }
    const isTaken = (x: number, z: number) => owner.has(`${x},${z}`);

    const linkedFor = (piece: PlacedPiece) => {
      const def = PIECES[piece.kind];
      return def.connectors.map((connector) => {
        const [lx, lz] = rotateCell(connector.x, connector.z, def.w, def.d, piece.rot);
        const dir = (connector.dir + piece.rot) % 4;
        const neighbour = owner.get(`${piece.x + lx + DX[dir]},${piece.z + lz + DZ[dir]}`);
        return neighbour !== undefined && neighbour !== piece.id;
      });
    };

    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (const key of owner.keys()) {
      const [x, z] = key.split(",").map(Number);
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minZ = Math.min(minZ, z);
      maxZ = Math.max(maxZ, z);
    }
    const center: [number, number] = [((minX + maxX) / 2) * CELL, ((minZ + maxZ) / 2) * CELL];
    const radius = Math.max(4, (Math.hypot(maxX - minX + 1, maxZ - minZ + 1) / 2) * CELL);

    // Aliens and scorch marks go on recently finished modules, on a side facing open space.
    const candidates = pieces.filter((piece) => piece.id !== 0 && piece.id !== raisingTarget).slice(-12);
    const spots = Array.from({ length: Math.max(aliens, damage) }, (_, index) => {
      const piece = candidates[Math.floor(hash01(seed, index * 13 + 5) * candidates.length)] ?? pieces[0];
      const side = openSide(piece, isTaken, hash01(seed, index * 29 + 11));
      if (!side) {
        return null;
      }
      const [cx, cz] = side.cell;
      return {
        key: `${piece.id}-${index}`,
        position: [(cx + DX[side.dir] * 0.42) * CELL, 0.25, (cz + DZ[side.dir] * 0.42) * CELL] as [number, number, number],
        facing: Math.atan2(DX[side.dir], DZ[side.dir])
      };
    }).filter((spot) => spot !== null);

    return {
      pieces: pieces.filter((piece) => piece.id !== raisingTarget).map((piece) => ({ piece, linked: linkedFor(piece) })),
      raising: raisingTarget >= 0 ? pieces.find((piece) => piece.id === raisingTarget) ?? null : null,
      siteLinked: sitePiece ? linkedFor(sitePiece) : [],
      raisingLinked: raisingTarget >= 0 ? linkedFor(planner.pieces[raisingTarget]) : [],
      center,
      radius,
      spots
    };
  }, [seed, builtSteps, planner, current, damage, aliens]);

  const float = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (float.current) {
      const t = clock.elapsedTime;
      float.current.position.y = Math.sin(t * 0.4) * 0.25;
      float.current.rotation.x = Math.sin(t * 0.21) * 0.025;
      float.current.rotation.z = Math.cos(t * 0.17) * 0.025;
    }
  });

  let construction = null;
  if (current?.type === "place") {
    const piece = current.piece;
    const [bottom, top] = pieceSpan(piece.kind, piece.baseLevels);
    construction = (
      <Construction piece={piece} levels={piece.baseLevels} linked={layout.siteLinked} from={bottom} to={top} progress={progress} tier={1} showFrame={!upgrading} />
    );
  } else if (current?.type === "raise") {
    const piece = planner.pieces[current.target];
    const [, top] = pieceSpan(piece.kind, current.level);
    construction = (
      <Construction
        piece={piece}
        levels={current.level}
        linked={layout.raisingLinked}
        from={deckBase(piece.kind, current.level)}
        to={top}
        progress={progress}
        tier={tierOf(piece.id)}
        showFrame={!upgrading}
      />
    );
  }

  const upgradeTarget = upgrading ? layout.pieces.find(({ piece }) => piece.id === upgrading.pieceId)?.piece : undefined;

  return (
    <>
      <Backdrop builtSteps={builtSteps} progress={progress} compact={compact} />
      <Lights builtSteps={builtSteps} progress={progress} radius={layout.radius} />
      <CameraRig radius={layout.radius} compact={compact} />
      <group ref={float}>
        <group position={[-layout.center[0], 0, -layout.center[1]]}>
          {layout.pieces.map(({ piece, linked }) => (
            <PlacedModel key={piece.id} piece={piece} levels={piece.levels} tier={tierOf(piece.id)} linked={linked} />
          ))}
          {construction}
          {upgrading && upgradeTarget ? (
            <UpgradeFrame piece={upgradeTarget} levels={(upgradeTarget as PlacedPiece & { levels: number }).levels} progress={upgrading.progress} />
          ) : null}
          {layout.spots.map((spot, index) => (
            <group key={spot.key} position={spot.position} rotation={[0, spot.facing, 0]}>
              {index < damage ? <Scorch seed={index * 3 + 1} /> : null}
              {index < aliens ? (
                <group position={[0, 0.15, 0.7]} scale={1.5}>
                  <Alien seed={index * 7} />
                </group>
              ) : null}
            </group>
          ))}
        </group>
      </group>
    </>
  );
}

export default function StationView(props: StationViewProps) {
  return (
    <Canvas
      shadows
      dpr={props.compact ? 1 : [1, 2]}
      gl={{ antialias: true, localClippingEnabled: true }}
      camera={{ fov: 32, near: 0.5, far: 3000, position: [20, 16, 20] }}
      onCreated={({ gl }) => {
        gl.localClippingEnabled = true;
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.3;
      }}
    >
      <Scene {...props} />
    </Canvas>
  );
}

