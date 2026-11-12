import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { CELL } from "./pieces.tsx";
import { MATERIALS, geo } from "./materials.ts";
import { createRng } from "./rng.ts";

export type Cell = [number, number];

export interface WalkGrid {
  isFree: (x: number, z: number) => boolean;
  /** free cells next to the keep, the construction site, and anywhere walkable */
  keepSide: Cell[];
  siteSide: Cell[];
  free: Cell[];
}

type Role = "builder" | "rogue" | "villager";

interface Walker {
  role: Role;
  path: Cell[];
  pathIndex: number;
  position: THREE.Vector3;
  wait: number;
  carrying: boolean;
  goingToSite: boolean;
  speed: number;
  offset: [number, number];
}

const DIRS: Cell[] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/** Breadth-first path over free cells. Returns [] when there is no way through. */
function findPath(grid: WalkGrid, from: Cell, to: Cell, limit = 900): Cell[] {
  const key = (cell: Cell) => `${cell[0]},${cell[1]}`;
  const previous = new Map<string, Cell | null>([[key(from), null]]);
  const queue: Cell[] = [from];
  while (queue.length > 0 && previous.size < limit) {
    const cell = queue.shift()!;
    if (cell[0] === to[0] && cell[1] === to[1]) {
      const path: Cell[] = [];
      let step: Cell | null = cell;
      while (step) {
        path.unshift(step);
        step = previous.get(key(step)) ?? null;
      }
      return path;
    }
    for (const [dx, dz] of DIRS) {
      const next: Cell = [cell[0] + dx, cell[1] + dz];
      if (!previous.has(key(next)) && grid.isFree(next[0], next[1])) {
        previous.set(key(next), cell);
        queue.push(next);
      }
    }
  }
  return [];
}

const TUNICS = {
  builder: ["#3f6fb0", "#4b7fc0", "#36609c"],
  rogue: ["#4a3a5c", "#3b2f4a"],
  villager: ["#b5763f", "#7f9a52", "#c9a24a", "#9a5c7a", "#5f8f9a"]
};

const tunicMaterials = new Map<string, THREE.MeshStandardMaterial>();
function tunic(colour: string) {
  let material = tunicMaterials.get(colour);
  if (!material) {
    material = new THREE.MeshStandardMaterial({ color: colour, flatShading: true, roughness: 0.9 });
    tunicMaterials.set(colour, material);
  }
  return material;
}

function Person({ walker, colour }: { walker: Walker; colour: string }) {
  const group = useRef<THREE.Group>(null);
  const crate = useRef<THREE.Mesh>(null);
  const hood = walker.role === "rogue";
  useFrame(({ clock }) => {
    if (!group.current) {
      return;
    }
    const moving = walker.wait <= 0;
    group.current.position.copy(walker.position);
    group.current.position.y = moving ? Math.abs(Math.sin(clock.elapsedTime * 11 + walker.offset[0] * 10)) * 0.05 : 0;
    if (crate.current) {
      crate.current.visible = walker.carrying;
    }
  });
  return (
    <group ref={group}>
      <mesh geometry={geo.cyl(0.09, 0.13, 0.3, 6)} material={tunic(colour)} position={[0, 0.15, 0]} castShadow />
      <mesh geometry={geo.sphere(0.085)} material={MATERIALS.skin} position={[0, 0.38, 0]} castShadow />
      {hood ? (
        <mesh geometry={geo.cone(0.11, 0.2, 6)} material={tunic("#2a2233")} position={[0, 0.47, 0]} castShadow />
      ) : (
        <mesh geometry={geo.cyl(0.095, 0.095, 0.05, 6)} material={MATERIALS.timberDark} position={[0, 0.45, 0]} />
      )}
      <mesh ref={crate} geometry={geo.box(0.16, 0.14, 0.16)} material={MATERIALS.stoneDark} position={[0, 0.58, 0]} castShadow />
    </group>
  );
}

function toWorld(cell: Cell, offset: [number, number]) {
  return new THREE.Vector3(cell[0] * CELL + offset[0], 0, cell[1] * CELL + offset[1]);
}

export function Citizens({
  grid,
  builders,
  rogues,
  villagers,
  seed
}: {
  grid: WalkGrid;
  builders: number;
  rogues: number;
  villagers: number;
  seed: number;
}) {
  const walkers = useMemo(() => {
    const rng = createRng(seed + builders * 31 + rogues * 7 + villagers);
    const list: Array<{ walker: Walker; colour: string }> = [];
    const spawn = (role: Role, count: number, from: Cell[]) => {
      for (let index = 0; index < count; index += 1) {
        const start = from[Math.floor(rng() * from.length)] ?? grid.free[0] ?? [0, 3];
        const offset: [number, number] = [(rng() - 0.5) * 0.9, (rng() - 0.5) * 0.9];
        const palette = TUNICS[role];
        list.push({
          colour: palette[index % palette.length],
          walker: {
            role,
            path: [start],
            pathIndex: 0,
            position: toWorld(start, offset),
            wait: rng() * 2,
            carrying: role === "builder" && index % 2 === 0,
            goingToSite: index % 2 === 0,
            speed: role === "rogue" ? 1.5 : role === "builder" ? 1.0 : 0.6,
            offset
          }
        });
      }
    };
    spawn("builder", builders, grid.keepSide.length ? grid.keepSide : grid.free);
    spawn("rogue", rogues, grid.free);
    spawn("villager", villagers, grid.free);
    return list;
  }, [grid, builders, rogues, villagers, seed]);

  const rng = useMemo(() => createRng(seed ^ 0x5eed), [seed]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1);
    for (const { walker } of walkers) {
      if (walker.wait > 0) {
        walker.wait -= dt;
        continue;
      }
      const target = walker.path[walker.pathIndex];
      if (!target) {
        planNext(walker);
        continue;
      }
      const goal = toWorld(target, walker.offset);
      const toGoal = goal.sub(walker.position);
      const distance = toGoal.length();
      const stepLength = walker.speed * dt;
      if (distance <= stepLength) {
        walker.position.add(toGoal);
        walker.pathIndex += 1;
        if (walker.pathIndex >= walker.path.length) {
          arrive(walker);
        }
      } else {
        walker.position.add(toGoal.multiplyScalar(stepLength / distance));
      }
    }
  });

  function pickFrom(cells: Cell[]): Cell | null {
    return cells.length ? cells[Math.floor(rng() * cells.length)] : null;
  }

  function arrive(walker: Walker) {
    if (walker.role === "builder") {
      // Drop the stone at the site (and hammer a bit), or pick up a new load at the keep.
      walker.carrying = !walker.goingToSite;
      walker.wait = walker.goingToSite ? 2.5 + rng() * 2 : 0.8;
      walker.goingToSite = !walker.goingToSite;
    } else {
      walker.wait = walker.role === "rogue" ? 0.5 + rng() * 1.5 : 1.5 + rng() * 4;
    }
    walker.path = [];
    walker.pathIndex = 0;
  }

  function planNext(walker: Walker) {
    const here: Cell = [Math.round(walker.position.x / CELL), Math.round(walker.position.z / CELL)];
    let destination: Cell | null;
    if (walker.role === "builder") {
      destination = pickFrom(walker.goingToSite ? grid.siteSide : grid.keepSide) ?? pickFrom(grid.free);
    } else {
      // Wander somewhere not too far away.
      const nearby = grid.free.filter((cell) => Math.abs(cell[0] - here[0]) + Math.abs(cell[1] - here[1]) <= 6);
      destination = pickFrom(nearby.length ? nearby : grid.free);
    }
    const path = destination && grid.isFree(here[0], here[1]) ? findPath(grid, here, destination) : [];
    if (path.length > 0) {
      walker.path = path;
      walker.pathIndex = 0;
    } else {
      // Stuck (e.g. a new building appeared on top of them): hop to a free cell.
      const fallback = pickFrom(grid.free);
      if (fallback) {
        walker.position.copy(toWorld(fallback, walker.offset));
      }
      walker.wait = 1;
    }
  }

  return (
    <>
      {walkers.map(({ walker, colour }, index) => (
        <Person key={`${walker.role}-${index}`} walker={walker} colour={colour} />
      ))}
    </>
  );
}
