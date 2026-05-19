import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows } from "@react-three/drei";
import { useEffect, useRef, useState } from "react";
import { DoubleSide } from "three";
import type { Group, Mesh } from "three";
import type { CastleSnapshot, Citizen, WorldFocus } from "../../types/models";

interface CastleSceneProps {
  snapshot: CastleSnapshot | null;
  stageLabel: string;
  keepScale: number;
  islandDistrictCount: number;
  villageHouseCount: number;
  wallTowerCount: number;
  forestTreeCount: number;
}

type ViewMode = "rampart" | "plan";

interface WorldSceneProps extends CastleSceneProps {
  viewMode: ViewMode;
}

interface SceneLayoutCallout {
  label: string;
  left: string;
  top: string;
  tone: "structure" | "water" | "village" | "project";
}

function getBannerColor(category: CastleSnapshot["currentCategory"] | undefined) {
  if (category === "work") {
    return "#e4ca73";
  }

  if (category === "play") {
    return "#b15c4d";
  }

  if (category === "idle") {
    return "#8db3a7";
  }

  return "#cfd5da";
}

function getSceneMood(category: CastleSnapshot["currentCategory"] | undefined) {
  if (category === "work") {
    return {
      background: "#214b76",
      fog: "#2d6483",
      outerLand: "#5f9b61",
      innerLand: "#d4c8aa",
      water: "#2f7894",
      waterEmissive: "#174f66",
      sunlight: "#ffd99a",
      sunColor: "#ffc66a",
      cloudColor: "#d6e5df",
      path: "#b3986f"
    };
  }

  if (category === "play") {
    return {
      background: "#28436f",
      fog: "#5b6c7a",
      outerLand: "#6f8751",
      innerLand: "#cdb69a",
      water: "#5f526f",
      waterEmissive: "#342f4b",
      sunlight: "#ffbf88",
      sunColor: "#ff9b66",
      cloudColor: "#ead9c7",
      path: "#a17855"
    };
  }

  if (category === "idle") {
    return {
      background: "#233f63",
      fog: "#557483",
      outerLand: "#66855d",
      innerLand: "#c4bba7",
      water: "#4c7486",
      waterEmissive: "#2c5465",
      sunlight: "#e1eacb",
      sunColor: "#e5e7c8",
      cloudColor: "#d6dfdc",
      path: "#927c61"
    };
  }

  return {
    background: "#24496f",
    fog: "#4e7890",
    outerLand: "#65945f",
    innerLand: "#cfc2a6",
    water: "#2d7590",
    waterEmissive: "#1d5066",
    sunlight: "#f4d9a6",
    sunColor: "#f7ce78",
    cloudColor: "#dae7de",
    path: "#a78a63"
  };
}

function hasWebGlSupport() {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(
      window.WebGLRenderingContext &&
      (canvas.getContext("webgl") || canvas.getContext("experimental-webgl"))
    );
  } catch {
    return false;
  }
}

function House({
  position,
  scale = 1
}: {
  position: [number, number, number];
  scale?: number;
}) {
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.18, 0]}>
        <boxGeometry args={[0.42, 0.36, 0.32]} />
        <meshStandardMaterial color="#b78d64" roughness={0.86} />
      </mesh>
      <mesh position={[0, 0.46, 0]} rotation={[0, 0.785, 0]}>
        <coneGeometry args={[0.36, 0.34, 4]} />
        <meshStandardMaterial color="#b89459" roughness={0.82} />
      </mesh>
      <mesh position={[0.01, 0.22, 0.17]}>
        <boxGeometry args={[0.12, 0.18, 0.035]} />
        <meshStandardMaterial color="#263039" emissive="#111820" emissiveIntensity={0.12} />
      </mesh>
    </group>
  );
}

function Workshop({
  position,
  stone = false
}: {
  position: [number, number, number];
  stone?: boolean;
}) {
  const wallColor = stone ? "#b8b0a2" : "#8d6442";
  const roofColor = stone ? "#7f858a" : "#d2a85f";
  const beamColor = stone ? "#6f7078" : "#6f5439";

  return (
    <group position={position}>
      <mesh position={[0, 0.2, 0]}>
        <boxGeometry args={[0.62, 0.4, 0.42]} />
        <meshStandardMaterial color={wallColor} />
      </mesh>
      <mesh position={[0, 0.5, 0]} rotation={[0, 0.785, 0]}>
        <coneGeometry args={[0.44, 0.24, 4]} />
        <meshStandardMaterial color={roofColor} />
      </mesh>
      <mesh position={[0.36, 0.3, 0]} rotation={[0, 0, -0.55]}>
        <boxGeometry args={[0.08, 0.5, 0.08]} />
        <meshStandardMaterial color={beamColor} />
      </mesh>
      <mesh position={[0.48, 0.48, 0]}>
        <boxGeometry args={[0.2, 0.08, 0.08]} />
        <meshStandardMaterial color={beamColor} />
      </mesh>
    </group>
  );
}

function WatchTower({
  position,
  stone = false
}: {
  position: [number, number, number];
  stone?: boolean;
}) {
  return (
    <group position={position}>
      <mesh position={[0, 0.52, 0]}>
        <cylinderGeometry args={[0.18, 0.22, 1.04, 8]} />
        <meshStandardMaterial color={stone ? "#bcbab5" : "#bfae92"} />
      </mesh>
      <mesh position={[0, 1.12, 0]}>
        <coneGeometry args={[0.24, 0.3, 6]} />
        <meshStandardMaterial color={stone ? "#6f747d" : "#735437"} />
      </mesh>
    </group>
  );
}

function Shrine({
  position,
  bannerColor
}: {
  position: [number, number, number];
  bannerColor: string;
}) {
  return (
    <group position={position}>
      <mesh position={[0, 0.16, 0]}>
        <boxGeometry args={[0.84, 0.14, 0.84]} />
        <meshStandardMaterial color="#a89273" />
      </mesh>
      <mesh position={[0, 0.46, 0]}>
        <boxGeometry args={[0.38, 0.46, 0.38]} />
        <meshStandardMaterial color="#d2c4a7" />
      </mesh>
      <mesh position={[0, 0.82, 0]} rotation={[0, 0.785, 0]}>
        <coneGeometry args={[0.34, 0.28, 4]} />
        <meshStandardMaterial color="#836443" />
      </mesh>
      <mesh position={[0, 0.66, 0.22]}>
        <boxGeometry args={[0.14, 0.18, 0.04]} />
        <meshStandardMaterial color={bannerColor} emissive={bannerColor} emissiveIntensity={0.26} />
      </mesh>
    </group>
  );
}

function Windmill({
  position
}: {
  position: [number, number, number];
}) {
  const bladeRef = useRef<Group>(null);

  useFrame((state) => {
    if (!bladeRef.current) {
      return;
    }

    bladeRef.current.rotation.z = state.clock.elapsedTime * 0.9;
  });

  return (
    <group position={position}>
      <mesh position={[0, 0.68, 0]}>
        <boxGeometry args={[0.42, 1.1, 0.42]} />
        <meshStandardMaterial color="#cdbd9f" />
      </mesh>
      <mesh position={[0, 1.44, 0]} rotation={[0, 0.785, 0]}>
        <coneGeometry args={[0.34, 0.3, 4]} />
        <meshStandardMaterial color="#916a42" />
      </mesh>
      <group ref={bladeRef} position={[0, 1.02, 0.24]}>
        <mesh>
          <boxGeometry args={[0.08, 1.08, 0.04]} />
          <meshStandardMaterial color="#74563a" />
        </mesh>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <boxGeometry args={[0.08, 1.08, 0.04]} />
          <meshStandardMaterial color="#74563a" />
        </mesh>
      </group>
    </group>
  );
}

function Gatehouse({
  position,
  bannerColor,
  stone = false,
  rotation = 0
}: {
  position: [number, number, number];
  bannerColor: string;
  stone?: boolean;
  rotation?: number;
}) {
  const mainColor = stone ? "#bdb8b2" : "#bcae94";
  const trimColor = stone ? "#80858e" : "#8d6b46";
  const beamColor = stone ? "#666973" : "#6c5640";

  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh position={[0, 0.38, 0]}>
        <boxGeometry args={[0.92, 0.76, 0.56]} />
        <meshStandardMaterial color={mainColor} />
      </mesh>
      <mesh position={[0, 0.9, 0]}>
        <boxGeometry args={[1.08, 0.18, 0.72]} />
        <meshStandardMaterial color={trimColor} />
      </mesh>
      <mesh position={[-0.32, 0.55, 0]}>
        <boxGeometry args={[0.14, 0.4, 0.08]} />
        <meshStandardMaterial color={beamColor} />
      </mesh>
      <mesh position={[0.32, 0.55, 0]}>
        <boxGeometry args={[0.14, 0.4, 0.08]} />
        <meshStandardMaterial color={beamColor} />
      </mesh>
      <mesh position={[0, 0.22, 0.2]}>
        <boxGeometry args={[0.26, 0.34, 0.08]} />
        <meshStandardMaterial color="#5d4630" />
      </mesh>
      <mesh position={[0, 1.18, 0]}>
        <boxGeometry args={[0.08, 0.44, 0.08]} />
        <meshStandardMaterial color="#735437" />
      </mesh>
      <mesh position={[0.16, 1.04, 0]}>
        <boxGeometry args={[0.28, 0.18, 0.02]} />
        <meshStandardMaterial color={bannerColor} emissive={bannerColor} emissiveIntensity={0.15} />
      </mesh>
      {[-0.34, 0.34].map((x, index) => (
        <mesh key={`gatehouse-turret-${index}`} position={[x, 1.14, 0]}>
          <cylinderGeometry args={[0.12, 0.14, 0.42, 8]} />
          <meshStandardMaterial color={mainColor} />
        </mesh>
      ))}
      {[-0.34, 0.34].map((x, index) => (
        <mesh key={`gatehouse-turret-roof-${index}`} position={[x, 1.44, 0]}>
          <coneGeometry args={[0.16, 0.24, 6]} />
          <meshStandardMaterial color={trimColor} />
        </mesh>
      ))}
      {[-0.34, 0, 0.34].map((x, index) => (
        <mesh key={`gatehouse-merlon-${index}`} position={[x, 1.08, 0.22]}>
          <boxGeometry args={[0.12, 0.14, 0.08]} />
          <meshStandardMaterial color={trimColor} />
        </mesh>
      ))}
      <Lantern color={bannerColor} position={[-0.22, 0.92, 0.34]} />
      <Lantern color={bannerColor} position={[0.22, 0.92, 0.34]} />
    </group>
  );
}

function RampartCorner({
  bannerColor,
  stone = false
}: {
  bannerColor: string;
  stone?: boolean;
}) {
  const wallColor = stone ? "#9da0a8" : "#6f5b42";
  const trimColor = stone ? "#7f838d" : "#8e7654";
  const floorColor = stone ? "#b6b9c0" : "#9f8561";
  const crateColor = stone ? "#7d7467" : "#7e6141";
  const seamColor = stone ? "#8e929a" : "#7f6a4c";

  return (
    <group position={[-5.7, 0.06, 5.7]}>
      <mesh position={[0, 0.08, 0]}>
        <boxGeometry args={[1.8, 0.16, 1.8]} />
        <meshStandardMaterial color={floorColor} />
      </mesh>
      <mesh position={[0.98, 0.08, -0.58]}>
        <boxGeometry args={[2.2, 0.16, 0.82]} />
        <meshStandardMaterial color={floorColor} />
      </mesh>
      <mesh position={[-0.58, 0.08, -0.98]}>
        <boxGeometry args={[0.82, 0.16, 2.2]} />
        <meshStandardMaterial color={floorColor} />
      </mesh>
      {[-0.66, -0.12, 0.42].map((x, index) => (
        <mesh key={`rampart-floor-long-seam-${index}`} position={[x, 0.18, 0.04]}>
          <boxGeometry args={[0.035, 0.025, 1.64]} />
          <meshStandardMaterial color={seamColor} roughness={0.9} />
        </mesh>
      ))}
      {[-0.58, 0.02, 0.62].map((z, index) => (
        <mesh key={`rampart-floor-cross-seam-${index}`} position={[0.02, 0.18, z]}>
          <boxGeometry args={[1.64, 0.025, 0.035]} />
          <meshStandardMaterial color={seamColor} roughness={0.9} />
        </mesh>
      ))}
      {[-0.64, -0.08, 0.48, 1.04].map((x, index) => (
        <mesh key={`rampart-walkway-seam-east-${index}`} position={[x, 0.18, -0.58]}>
          <boxGeometry args={[0.035, 0.025, 0.68]} />
          <meshStandardMaterial color={seamColor} roughness={0.9} />
        </mesh>
      ))}
      {[-0.98, -0.46, 0.06, 0.58].map((z, index) => (
        <mesh key={`rampart-walkway-seam-north-${index}`} position={[-0.58, 0.18, z]}>
          <boxGeometry args={[0.68, 0.025, 0.035]} />
          <meshStandardMaterial color={seamColor} roughness={0.9} />
        </mesh>
      ))}
      <mesh position={[0.72, 0.42, -0.08]}>
        <boxGeometry args={[0.34, 0.72, 1.82]} />
        <meshStandardMaterial color={wallColor} />
      </mesh>
      <mesh position={[-0.08, 0.42, -0.72]}>
        <boxGeometry args={[1.82, 0.72, 0.34]} />
        <meshStandardMaterial color={wallColor} />
      </mesh>
      <mesh position={[1.52, 0.42, -0.58]}>
        <boxGeometry args={[0.26, 0.62, 0.82]} />
        <meshStandardMaterial color={wallColor} />
      </mesh>
      <mesh position={[-0.58, 0.42, -1.52]}>
        <boxGeometry args={[0.82, 0.62, 0.26]} />
        <meshStandardMaterial color={wallColor} />
      </mesh>
      {[-0.46, 0.02, 0.5].map((x, index) => (
        <mesh key={`rampart-step-x-${index}`} position={[x, 0.17 + index * 0.13, 0.44 - index * 0.16]}>
          <boxGeometry args={[0.34, 0.12, 0.46]} />
          <meshStandardMaterial color={trimColor} />
        </mesh>
      ))}
      {[0.12, 0.58, 1.04].map((offset, index) => (
        <mesh key={`rampart-merlon-east-${index}`} position={[1.52, 0.8, -0.84 + offset]}>
          <boxGeometry args={[0.22, 0.22, 0.2]} />
          <meshStandardMaterial color={trimColor} />
        </mesh>
      ))}
      {[0.12, 0.58, 1.04].map((offset, index) => (
        <mesh key={`rampart-merlon-north-${index}`} position={[-0.84 + offset, 0.8, -1.52]}>
          <boxGeometry args={[0.2, 0.22, 0.22]} />
          <meshStandardMaterial color={trimColor} />
        </mesh>
      ))}
      <mesh position={[0.36, 0.84, -0.62]}>
        <boxGeometry args={[0.16, 0.42, 0.16]} />
        <meshStandardMaterial color="#735437" />
      </mesh>
      <mesh position={[0.52, 0.72, -0.62]}>
        <boxGeometry args={[0.26, 0.18, 0.02]} />
        <meshStandardMaterial color={bannerColor} emissive={bannerColor} emissiveIntensity={0.14} />
      </mesh>
      <mesh position={[-0.64, 0.34, 0.64]}>
        <boxGeometry args={[0.18, 0.22, 0.18]} />
        <meshStandardMaterial color={crateColor} />
      </mesh>
      <mesh position={[-0.38, 0.34, 0.72]}>
        <cylinderGeometry args={[0.11, 0.11, 0.24, 12]} />
        <meshStandardMaterial color={crateColor} />
      </mesh>
      <group position={[0.02, 0.32, 0.44]} rotation={[0, -0.72, 0]}>
        <mesh position={[0, 0.14, 0]}>
          <boxGeometry args={[0.58, 0.08, 0.36]} />
          <meshStandardMaterial color={stone ? "#817970" : "#76583a"} roughness={0.88} />
        </mesh>
        {[-0.22, 0.22].map((x, index) => (
          <mesh key={`survey-table-leg-${index}`} position={[x, 0.02, -0.12]}>
            <boxGeometry args={[0.05, 0.22, 0.05]} />
            <meshStandardMaterial color={stone ? "#67625d" : "#63482f"} />
          </mesh>
        ))}
        <mesh position={[0.08, 0.22, 0]} rotation={[0.2, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.045, 0.06, 0.54, 12]} />
          <meshStandardMaterial color="#2f3a3c" metalness={0.22} roughness={0.48} />
        </mesh>
        <mesh position={[-0.18, 0.23, 0]}>
          <sphereGeometry args={[0.055, 12, 12]} />
          <meshStandardMaterial color="#9fb9bf" emissive="#5c7f86" emissiveIntensity={0.22} />
        </mesh>
      </group>
      <mesh position={[0.96, 0.84, -1.05]}>
        <boxGeometry args={[0.08, 0.44, 0.08]} />
        <meshStandardMaterial color={trimColor} />
      </mesh>
      <mesh position={[1.05, 1.04, -1.05]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.035, 0.035, 0.52, 10]} />
        <meshStandardMaterial color="#2e3839" metalness={0.16} roughness={0.5} />
      </mesh>
      <Lantern color={bannerColor} position={[1.22, 0.16, -0.98]} />
      <Lantern color={bannerColor} position={[-0.98, 0.16, -1.18]} />
    </group>
  );
}

function MarketStall({
  position,
  color
}: {
  position: [number, number, number];
  color: string;
}) {
  return (
    <group position={position}>
      <mesh position={[0, 0.14, 0]}>
        <boxGeometry args={[0.48, 0.18, 0.36]} />
        <meshStandardMaterial color="#8a623f" />
      </mesh>
      <mesh position={[0, 0.4, 0]}>
        <boxGeometry args={[0.62, 0.12, 0.44]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.12} />
      </mesh>
      <mesh position={[-0.18, 0.26, -0.12]}>
        <boxGeometry args={[0.05, 0.24, 0.05]} />
        <meshStandardMaterial color="#6f5438" />
      </mesh>
      <mesh position={[0.18, 0.26, -0.12]}>
        <boxGeometry args={[0.05, 0.24, 0.05]} />
        <meshStandardMaterial color="#6f5438" />
      </mesh>
    </group>
  );
}

function Path({
  position,
  size,
  rotation = 0,
  color
}: {
  position: [number, number, number];
  size: [number, number, number];
  rotation?: number;
  color: string;
}) {
  return (
    <mesh position={position} rotation={[0, rotation, 0]}>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
}

function RoadGuidePosts({
  positions,
  color = "#74573c",
  lanternColor
}: {
  positions: [number, number, number][];
  color?: string;
  lanternColor?: string;
}) {
  return (
    <>
      {positions.map((position, index) => (
        <group key={`guide-post-${index}`} position={position}>
          <mesh position={[0, 0.18, 0]}>
            <boxGeometry args={[0.07, 0.36, 0.07]} />
            <meshStandardMaterial color={color} />
          </mesh>
          <mesh position={[0, 0.38, 0]}>
            <boxGeometry args={[0.18, 0.06, 0.06]} />
            <meshStandardMaterial color={color} />
          </mesh>
          {lanternColor ? <Lantern color={lanternColor} position={[0.1, 0.34, 0]} /> : null}
        </group>
      ))}
    </>
  );
}

function VillageFence({
  position,
  rotation = 0,
  width,
  depth,
  color = "#7a5c3f"
}: {
  position: [number, number, number];
  rotation?: number;
  width: number;
  depth: number;
  color?: string;
}) {
  const halfWidth = width / 2;
  const halfDepth = depth / 2;

  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh position={[0, 0.16, -halfDepth]}>
        <boxGeometry args={[width, 0.06, 0.06]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[0, 0.16, halfDepth]}>
        <boxGeometry args={[width, 0.06, 0.06]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[-halfWidth, 0.16, 0]}>
        <boxGeometry args={[0.06, 0.06, depth]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[halfWidth, 0.16, 0]}>
        <boxGeometry args={[0.06, 0.06, depth]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {[
        [-halfWidth, 0.09, -halfDepth],
        [halfWidth, 0.09, -halfDepth],
        [-halfWidth, 0.09, halfDepth],
        [halfWidth, 0.09, halfDepth]
      ].map((post, index) => (
        <mesh key={`fence-post-${index}`} position={post as [number, number, number]}>
          <boxGeometry args={[0.08, 0.18, 0.08]} />
          <meshStandardMaterial color={color} />
        </mesh>
      ))}
    </group>
  );
}

function GateForecourt({
  bannerColor,
  stone = false
}: {
  bannerColor: string;
  stone?: boolean;
}) {
  const surfaceColor = stone ? "#aeadab" : "#9a7b57";
  const trimColor = stone ? "#8f949d" : "#7f6344";

  return (
    <group position={[4.78, 0.12, 0]}>
      <mesh position={[0, 0.02, 0]}>
        <boxGeometry args={[2.2, 0.04, 1.42]} />
        <meshStandardMaterial color={surfaceColor} />
      </mesh>
      <mesh position={[0.94, 0.08, 0]}>
        <boxGeometry args={[0.14, 0.12, 1.54]} />
        <meshStandardMaterial color={trimColor} />
      </mesh>
      <mesh position={[-0.94, 0.08, 0]}>
        <boxGeometry args={[0.14, 0.12, 1.54]} />
        <meshStandardMaterial color={trimColor} />
      </mesh>
      <Lantern color={bannerColor} position={[0.88, 0.06, -0.48]} />
      <Lantern color={bannerColor} position={[0.88, 0.06, 0.48]} />
    </group>
  );
}

function VillageCommons({
  bannerColor,
  stone = false,
  active = false
}: {
  bannerColor: string;
  stone?: boolean;
  active?: boolean;
}) {
  const pavingColor = stone ? "#a8a79f" : "#9c7b56";
  const trimColor = stone ? "#8c9198" : "#7a5d3f";
  const benchColor = stone ? "#776b5f" : "#735639";
  const waterColor = active ? "#7eb6d5" : "#6e93ab";

  return (
    <group position={[3.56, 0.1, 0.58]}>
      <mesh position={[0, 0.02, 0]}>
        <boxGeometry args={[1.92, 0.04, 1.68]} />
        <meshStandardMaterial color={pavingColor} />
      </mesh>
      <mesh position={[0, 0.08, -0.78]}>
        <boxGeometry args={[2.04, 0.08, 0.1]} />
        <meshStandardMaterial color={trimColor} />
      </mesh>
      <mesh position={[0, 0.08, 0.78]}>
        <boxGeometry args={[2.04, 0.08, 0.1]} />
        <meshStandardMaterial color={trimColor} />
      </mesh>
      <mesh position={[-0.82, 0.08, 0]}>
        <boxGeometry args={[0.1, 0.08, 1.68]} />
        <meshStandardMaterial color={trimColor} />
      </mesh>
      <mesh position={[0.82, 0.08, 0]}>
        <boxGeometry args={[0.1, 0.08, 1.68]} />
        <meshStandardMaterial color={trimColor} />
      </mesh>
      <mesh position={[0.12, 0.12, 0.02]}>
        <cylinderGeometry args={[0.22, 0.26, 0.16, 18]} />
        <meshStandardMaterial color={trimColor} />
      </mesh>
      <mesh position={[0.12, 0.22, 0.02]}>
        <cylinderGeometry args={[0.14, 0.16, 0.08, 18]} />
        <meshStandardMaterial color={waterColor} emissive={waterColor} emissiveIntensity={0.12} />
      </mesh>
      <mesh position={[-0.4, 0.15, 0.48]}>
        <boxGeometry args={[0.38, 0.08, 0.12]} />
        <meshStandardMaterial color={benchColor} />
      </mesh>
      <mesh position={[-0.4, 0.09, 0.48]}>
        <boxGeometry args={[0.06, 0.12, 0.06]} />
        <meshStandardMaterial color={benchColor} />
      </mesh>
      <mesh position={[-0.2, 0.09, 0.48]}>
        <boxGeometry args={[0.06, 0.12, 0.06]} />
        <meshStandardMaterial color={benchColor} />
      </mesh>
      <mesh position={[0.56, 0.15, -0.44]} rotation={[0, 0.72, 0]}>
        <boxGeometry args={[0.34, 0.08, 0.12]} />
        <meshStandardMaterial color={benchColor} />
      </mesh>
      <mesh position={[0.56, 0.09, -0.44]} rotation={[0, 0.72, 0]}>
        <boxGeometry args={[0.06, 0.12, 0.06]} />
        <meshStandardMaterial color={benchColor} />
      </mesh>
      <mesh position={[0.72, 0.09, -0.3]} rotation={[0, 0.72, 0]}>
        <boxGeometry args={[0.06, 0.12, 0.06]} />
        <meshStandardMaterial color={benchColor} />
      </mesh>
      <Lantern color={bannerColor} position={[-0.76, 0.12, -0.58]} />
      <Lantern color={bannerColor} position={[0.78, 0.12, 0.62]} />
    </group>
  );
}

function EntryDistrictBlock({
  pathColor,
  bannerColor,
  stone = false
}: {
  pathColor: string;
  bannerColor: string;
  stone?: boolean;
}) {
  const terraceColor = stone ? "#b5b3ad" : "#aa8760";
  const curbColor = stone ? "#8e949d" : "#806245";
  const fenceColor = stone ? "#7d817f" : "#73583c";

  return (
    <group position={[4.84, 0.08, -0.12]}>
      <mesh position={[0, 0.03, 0]}>
        <boxGeometry args={[2.86, 0.08, 5.86]} />
        <meshStandardMaterial color={terraceColor} />
      </mesh>
      <mesh position={[0, 0.1, -2.9]}>
        <boxGeometry args={[2.96, 0.06, 0.18]} />
        <meshStandardMaterial color={curbColor} />
      </mesh>
      <mesh position={[0, 0.1, 2.9]}>
        <boxGeometry args={[2.96, 0.06, 0.18]} />
        <meshStandardMaterial color={curbColor} />
      </mesh>
      <mesh position={[-1.4, 0.1, 0]}>
        <boxGeometry args={[0.18, 0.06, 5.68]} />
        <meshStandardMaterial color={curbColor} />
      </mesh>
      <mesh position={[1.4, 0.1, 0]}>
        <boxGeometry args={[0.18, 0.06, 5.68]} />
        <meshStandardMaterial color={curbColor} />
      </mesh>
      <mesh position={[-0.14, 0.08, 0]}>
        <boxGeometry args={[0.82, 0.03, 5.38]} />
        <meshStandardMaterial color={pathColor} />
      </mesh>
      <mesh position={[-0.52, 0.08, -2.12]} rotation={[0, 0.32, 0]}>
        <boxGeometry args={[0.86, 0.03, 1.28]} />
        <meshStandardMaterial color={pathColor} />
      </mesh>
      <VillageFence color={fenceColor} depth={1.42} position={[1.02, 0.08, -2.12]} width={0.74} />
      <VillageFence color={fenceColor} depth={1.54} position={[1.02, 0.08, 1.96]} width={0.74} />
      <VillageFence color={fenceColor} depth={4.92} position={[-1.06, 0.08, -0.04]} width={0.42} />
      <Lantern color={bannerColor} position={[-1.18, 0.16, -2.42]} />
      <Lantern color={bannerColor} position={[-1.18, 0.16, 2.34]} />
    </group>
  );
}

function EntryDistrictBacklot({
  bannerColor,
  stone = false
}: {
  bannerColor: string;
  stone?: boolean;
}) {
  const wallColor = stone ? "#9da2aa" : "#8f6f4b";
  const yardColor = stone ? "#b8b3ac" : "#9d7b56";
  const shedWallColor = stone ? "#b6b1a8" : "#a67f56";
  const shedRoofColor = stone ? "#7f858e" : "#7c5b3c";
  const crateColor = stone ? "#7c756d" : "#7a5d3f";

  return (
    <group position={[5.3, 0.08, -1.96]}>
      <mesh position={[0, 0.06, 0]}>
        <boxGeometry args={[1.58, 0.06, 1.46]} />
        <meshStandardMaterial color={yardColor} />
      </mesh>
      <mesh position={[0.84, 0.18, 0]}>
        <boxGeometry args={[0.12, 0.24, 1.58]} />
        <meshStandardMaterial color={wallColor} />
      </mesh>
      {[-0.36, 0, 0.36].map((z, index) => (
        <mesh key={`backlot-step-${index}`} position={[0.62 - index * 0.12, 0.02 + index * 0.05, z * 0.9]}>
          <boxGeometry args={[0.24, 0.05, 0.26]} />
          <meshStandardMaterial color={stone ? "#b9bec5" : "#b1936c"} />
        </mesh>
      ))}
      <group position={[-0.28, 0.08, 0.04]}>
        <mesh position={[0, 0.22, 0]}>
          <boxGeometry args={[0.64, 0.44, 0.58]} />
          <meshStandardMaterial color={shedWallColor} />
        </mesh>
        <mesh position={[0, 0.54, 0]} rotation={[0, 0.785, 0]}>
          <coneGeometry args={[0.42, 0.24, 4]} />
          <meshStandardMaterial color={shedRoofColor} />
        </mesh>
        <mesh position={[0.16, 0.18, 0.3]}>
          <boxGeometry args={[0.14, 0.24, 0.05]} />
          <meshStandardMaterial color="#5d4630" />
        </mesh>
      </group>
      <mesh position={[0.14, 0.16, -0.34]}>
        <boxGeometry args={[0.22, 0.22, 0.22]} />
        <meshStandardMaterial color={crateColor} />
      </mesh>
      <mesh position={[0.22, 0.12, 0.06]}>
        <cylinderGeometry args={[0.11, 0.11, 0.18, 12]} />
        <meshStandardMaterial color={crateColor} />
      </mesh>
      <Lantern color={bannerColor} position={[-0.46, 0.2, -0.42]} />
    </group>
  );
}

function ServiceYard({
  bannerColor,
  stone = false,
  active = false
}: {
  bannerColor: string;
  stone?: boolean;
  active?: boolean;
}) {
  const yardColor = stone ? "#aca79f" : "#987551";
  const borderColor = stone ? "#8a8f97" : "#765a3d";
  const shedWallColor = stone ? "#b8b3ab" : "#9b734d";
  const shedRoofColor = stone ? "#747a83" : "#78573a";
  const stackColor = stone ? "#8d877f" : "#73563a";
  const canopyColor = active ? bannerColor : stone ? "#a7b8c6" : "#cfb36d";

  return (
    <group position={[-4.32, 0.08, 1.98]}>
      <mesh position={[0, 0.03, 0]}>
        <boxGeometry args={[1.94, 0.08, 1.78]} />
        <meshStandardMaterial color={yardColor} />
      </mesh>
      <mesh position={[0, 0.1, -0.86]}>
        <boxGeometry args={[2.02, 0.06, 0.14]} />
        <meshStandardMaterial color={borderColor} />
      </mesh>
      <mesh position={[0, 0.1, 0.86]}>
        <boxGeometry args={[2.02, 0.06, 0.14]} />
        <meshStandardMaterial color={borderColor} />
      </mesh>
      <mesh position={[-0.92, 0.1, 0]}>
        <boxGeometry args={[0.14, 0.06, 1.66]} />
        <meshStandardMaterial color={borderColor} />
      </mesh>
      <group position={[-0.34, 0.08, -0.08]}>
        <mesh position={[0, 0.22, 0]}>
          <boxGeometry args={[0.64, 0.44, 0.56]} />
          <meshStandardMaterial color={shedWallColor} />
        </mesh>
        <mesh position={[0, 0.54, 0]} rotation={[0, 0.785, 0]}>
          <coneGeometry args={[0.4, 0.22, 4]} />
          <meshStandardMaterial color={shedRoofColor} />
        </mesh>
      </group>
      <mesh position={[0.44, 0.18, -0.28]}>
        <boxGeometry args={[0.52, 0.2, 0.24]} />
        <meshStandardMaterial color={stackColor} />
      </mesh>
      <mesh position={[0.48, 0.3, -0.28]}>
        <boxGeometry args={[0.44, 0.08, 0.18]} />
        <meshStandardMaterial color={stone ? "#a6a19a" : "#8a623f"} />
      </mesh>
      <mesh position={[0.54, 0.16, 0.34]}>
        <cylinderGeometry args={[0.1, 0.1, 0.22, 12]} />
        <meshStandardMaterial color={stackColor} />
      </mesh>
      <mesh position={[0.12, 0.4, 0.22]}>
        <boxGeometry args={[0.72, 0.12, 0.48]} />
        <meshStandardMaterial color={canopyColor} emissive={canopyColor} emissiveIntensity={active ? 0.12 : 0.04} />
      </mesh>
      <mesh position={[-0.08, 0.26, 0.1]}>
        <boxGeometry args={[0.05, 0.24, 0.05]} />
        <meshStandardMaterial color="#6f5438" />
      </mesh>
      <mesh position={[0.32, 0.26, 0.1]}>
        <boxGeometry args={[0.05, 0.24, 0.05]} />
        <meshStandardMaterial color="#6f5438" />
      </mesh>
      <Lantern color={bannerColor} position={[-0.72, 0.16, 0.54]} />
    </group>
  );
}

function EmbankmentMounds({
  positions,
  color
}: {
  positions: [number, number, number][];
  color: string;
}) {
  return (
    <>
      {positions.map((position, index) => (
        <mesh key={`embankment-${index}`} position={position}>
          <sphereGeometry args={[0.42 + (index % 3) * 0.08, 12, 12]} />
          <meshStandardMaterial color={color} />
        </mesh>
      ))}
    </>
  );
}

function DioramaTerrainPatches({
  active = false
}: {
  active?: boolean;
}) {
  const grassPatch = active ? "#75b36a" : "#4f804e";
  const shadowPatch = active ? "#497044" : "#365b3a";
  const stonePatch = "#bda77c";

  return (
    <group>
      {[
        [-5.35, 0.04, 4.2, 0.86, 0.05, 0.42, -0.28, grassPatch],
        [-4.35, 0.045, 4.78, 0.48, 0.05, 0.34, 0.18, shadowPatch],
        [4.82, 0.04, -4.35, 0.72, 0.05, 0.34, 0.28, grassPatch],
        [5.42, 0.045, 3.18, 0.54, 0.05, 0.42, -0.34, shadowPatch],
        [-5.8, 0.05, -3.16, 0.58, 0.05, 0.32, 0.42, stonePatch],
        [2.72, 0.05, 5.28, 0.72, 0.05, 0.3, -0.16, stonePatch]
      ].map((patch, index) => (
        <mesh
          key={`diorama-ground-patch-${index}`}
          position={[patch[0] as number, patch[1] as number, patch[2] as number]}
          rotation={[0, patch[6] as number, 0]}
          receiveShadow
        >
          <boxGeometry args={[patch[3] as number, patch[4] as number, patch[5] as number]} />
          <meshStandardMaterial color={patch[7] as string} roughness={0.92} />
        </mesh>
      ))}
    </group>
  );
}

function FloatingDioramaCliffs({
  active = false
}: {
  active?: boolean;
}) {
  const cliffColor = active ? "#4d7c46" : "#42673f";
  const shadowColor = active ? "#355d3b" : "#2f4f35";
  const grassEdgeColor = active ? "#73af63" : "#5a8f53";
  const stoneFacetColor = "#8e7c57";

  const sideFacets = [
    [-6.2, -0.1, 7.26, 0.74, 0.46, 0.08, shadowColor],
    [-4.6, -0.28, 7.27, 0.58, 0.34, 0.08, cliffColor],
    [-2.7, -0.18, 7.28, 0.88, 0.5, 0.08, grassEdgeColor],
    [-0.7, -0.36, 7.29, 0.66, 0.34, 0.08, shadowColor],
    [1.2, -0.16, 7.28, 0.86, 0.44, 0.08, cliffColor],
    [3.7, -0.32, 7.27, 0.68, 0.38, 0.08, shadowColor],
    [5.8, -0.12, 7.26, 0.74, 0.48, 0.08, stoneFacetColor],
    [-7.26, -0.12, -5.6, 0.08, 0.46, 0.82, shadowColor],
    [-7.27, -0.32, -3.7, 0.08, 0.34, 0.66, cliffColor],
    [-7.28, -0.14, -1.6, 0.08, 0.52, 0.9, grassEdgeColor],
    [-7.29, -0.36, 0.6, 0.08, 0.34, 0.7, shadowColor],
    [-7.28, -0.18, 2.7, 0.08, 0.44, 0.82, cliffColor],
    [-7.27, -0.3, 5.3, 0.08, 0.36, 0.72, stoneFacetColor],
    [7.26, -0.14, -4.9, 0.08, 0.44, 0.72, cliffColor],
    [7.27, -0.3, -2.6, 0.08, 0.34, 0.66, shadowColor],
    [7.28, -0.16, 0.1, 0.08, 0.5, 0.92, grassEdgeColor],
    [7.27, -0.34, 3.3, 0.08, 0.34, 0.72, shadowColor],
    [7.26, -0.12, 5.7, 0.08, 0.48, 0.78, cliffColor]
  ] as const;

  return (
    <group>
      <mesh position={[0, -0.46, 0]} receiveShadow>
        <boxGeometry args={[14.34, 0.82, 14.34]} />
        <meshStandardMaterial color={shadowColor} roughness={0.96} />
      </mesh>
      <mesh position={[0, -0.03, 7.2]} receiveShadow>
        <boxGeometry args={[14.42, 0.18, 0.18]} />
        <meshStandardMaterial color={grassEdgeColor} roughness={0.92} />
      </mesh>
      <mesh position={[-7.2, -0.03, 0]} receiveShadow>
        <boxGeometry args={[0.18, 0.18, 14.42]} />
        <meshStandardMaterial color={grassEdgeColor} roughness={0.92} />
      </mesh>
      <mesh position={[7.2, -0.03, 0]} receiveShadow>
        <boxGeometry args={[0.18, 0.18, 14.42]} />
        <meshStandardMaterial color={grassEdgeColor} roughness={0.92} />
      </mesh>
      {sideFacets.map((facet, index) => (
        <mesh
          key={`floating-diorama-cliff-facet-${index}`}
          position={[facet[0], facet[1], facet[2]]}
          receiveShadow
        >
          <boxGeometry args={[facet[3], facet[4], facet[5]]} />
          <meshStandardMaterial color={facet[6]} roughness={0.94} />
        </mesh>
      ))}
    </group>
  );
}

function RockCluster({
  position,
  scale = 1
}: {
  position: [number, number, number];
  scale?: number;
}) {
  return (
    <group position={position} scale={scale}>
      {[
        [-0.18, 0.12, 0.02, 0.24],
        [0.08, 0.16, -0.06, 0.3],
        [0.28, 0.1, 0.1, 0.18]
      ].map((rock, index) => (
        <mesh key={`storybook-rock-${index}`} position={[rock[0], rock[1], rock[2]]} rotation={[0.18, index * 0.74, 0.08]}>
          <dodecahedronGeometry args={[rock[3], 0]} />
          <meshStandardMaterial color={index === 1 ? "#9b8c6d" : "#7f755d"} roughness={0.94} />
        </mesh>
      ))}
    </group>
  );
}

function HayStack({
  position,
  scale = 1
}: {
  position: [number, number, number];
  scale?: number;
}) {
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.18, 0]}>
        <cylinderGeometry args={[0.18, 0.24, 0.28, 10]} />
        <meshStandardMaterial color="#c9ad62" />
      </mesh>
      <mesh position={[0, 0.4, 0]}>
        <coneGeometry args={[0.2, 0.18, 10]} />
        <meshStandardMaterial color="#d8bf79" />
      </mesh>
    </group>
  );
}

function Hedgerow({
  position,
  rotation = 0,
  length,
  color = "#5f7d49"
}: {
  position: [number, number, number];
  rotation?: number;
  length: number;
  color?: string;
}) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh position={[0, 0.12, 0]}>
        <boxGeometry args={[length, 0.22, 0.18]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {[-0.36, 0, 0.36].map((offset, index) => (
        <mesh key={`hedge-bulge-${index}`} position={[offset * (length / 1.2), 0.2, 0]}>
          <sphereGeometry args={[0.12, 10, 10]} />
          <meshStandardMaterial color={color} />
        </mesh>
      ))}
    </group>
  );
}

function OrchardTree({
  position,
  scale = 1
}: {
  position: [number, number, number];
  scale?: number;
}) {
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.2, 0]}>
        <boxGeometry args={[0.08, 0.4, 0.08]} />
        <meshStandardMaterial color="#73563a" />
      </mesh>
      <mesh position={[0, 0.48, 0]}>
        <sphereGeometry args={[0.24, 12, 12]} />
        <meshStandardMaterial color="#6f9753" />
      </mesh>
    </group>
  );
}

function WardGateway({
  position,
  rotation = 0,
  stone = false,
  bannerColor
}: {
  position: [number, number, number];
  rotation?: number;
  stone?: boolean;
  bannerColor: string;
}) {
  const postColor = stone ? "#aab0b8" : "#9b805d";
  const lintelColor = stone ? "#8e949d" : "#84684a";
  const trimColor = stone ? "#737983" : "#71563c";

  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {[-0.28, 0.28].map((x, index) => (
        <mesh key={`ward-gateway-post-${index}`} position={[x, 0.26, 0]}>
          <boxGeometry args={[0.12, 0.52, 0.12]} />
          <meshStandardMaterial color={postColor} />
        </mesh>
      ))}
      <mesh position={[0, 0.56, 0]}>
        <boxGeometry args={[0.74, 0.12, 0.18]} />
        <meshStandardMaterial color={lintelColor} />
      </mesh>
      <mesh position={[0, 0.66, 0]}>
        <boxGeometry args={[0.52, 0.08, 0.16]} />
        <meshStandardMaterial color={trimColor} />
      </mesh>
      <mesh position={[0, 0.38, 0.08]}>
        <boxGeometry args={[0.18, 0.14, 0.03]} />
        <meshStandardMaterial color={bannerColor} emissive={bannerColor} emissiveIntensity={0.18} />
      </mesh>
      <Lantern color={bannerColor} position={[-0.28, 0.48, 0.1]} />
      <Lantern color={bannerColor} position={[0.28, 0.48, 0.1]} />
    </group>
  );
}

function TerraceRing({
  stone = false
}: {
  stone?: boolean;
}) {
  const wallColor = stone ? "#9da3ab" : "#8f7654";
  const capColor = stone ? "#c6c8cc" : "#b59c74";
  const stairColor = stone ? "#b7babf" : "#ab906a";

  return (
    <group>
      <mesh position={[0, 0.24, -3.06]}>
        <boxGeometry args={[6.48, 0.34, 0.3]} />
        <meshStandardMaterial color={wallColor} />
      </mesh>
      <mesh position={[0, 0.24, 3.06]}>
        <boxGeometry args={[6.48, 0.34, 0.3]} />
        <meshStandardMaterial color={wallColor} />
      </mesh>
      <mesh position={[-3.06, 0.24, 0]}>
        <boxGeometry args={[0.3, 0.34, 6.48]} />
        <meshStandardMaterial color={wallColor} />
      </mesh>
      <mesh position={[3.06, 0.24, 0]}>
        <boxGeometry args={[0.3, 0.34, 6.48]} />
        <meshStandardMaterial color={wallColor} />
      </mesh>

      <mesh position={[0, 0.42, -3.06]}>
        <boxGeometry args={[6.56, 0.06, 0.36]} />
        <meshStandardMaterial color={capColor} />
      </mesh>
      <mesh position={[0, 0.42, 3.06]}>
        <boxGeometry args={[6.56, 0.06, 0.36]} />
        <meshStandardMaterial color={capColor} />
      </mesh>
      <mesh position={[-3.06, 0.42, 0]}>
        <boxGeometry args={[0.36, 0.06, 6.56]} />
        <meshStandardMaterial color={capColor} />
      </mesh>
      <mesh position={[3.06, 0.42, 0]}>
        <boxGeometry args={[0.36, 0.06, 6.56]} />
        <meshStandardMaterial color={capColor} />
      </mesh>

      {[
        [0, 0.02, -3.02, 1.22, 0.08, 0.42],
        [0, 0.1, -2.82, 0.98, 0.08, 0.34],
        [0, 0.18, -2.64, 0.76, 0.08, 0.28],
        [0, 0.02, 3.02, 1.22, 0.08, 0.42],
        [0, 0.1, 2.82, 0.98, 0.08, 0.34],
        [0, 0.18, 2.64, 0.76, 0.08, 0.28]
      ].map((step, index) => (
        <mesh key={`terrace-step-${index}`} position={[step[0], step[1], step[2]]}>
          <boxGeometry args={[step[3], step[4], step[5]]} />
          <meshStandardMaterial color={stairColor} />
        </mesh>
      ))}
    </group>
  );
}

function IslandCliffRing({
  stone = false
}: {
  stone?: boolean;
}) {
  const cliffColor = stone ? "#7d756e" : "#7b6144";
  const highlightColor = stone ? "#938b84" : "#95775a";

  return (
    <group>
      <mesh position={[0, -0.16, -3.02]}>
        <boxGeometry args={[6.7, 0.46, 0.44]} />
        <meshStandardMaterial color={cliffColor} />
      </mesh>
      <mesh position={[0, -0.16, 3.02]}>
        <boxGeometry args={[6.7, 0.46, 0.44]} />
        <meshStandardMaterial color={cliffColor} />
      </mesh>
      <mesh position={[-3.02, -0.16, 0]}>
        <boxGeometry args={[0.44, 0.46, 6.7]} />
        <meshStandardMaterial color={cliffColor} />
      </mesh>
      <mesh position={[3.02, -0.16, 0]}>
        <boxGeometry args={[0.44, 0.46, 6.7]} />
        <meshStandardMaterial color={cliffColor} />
      </mesh>
      {[
        [-2.1, -0.02, -3.18, 0.72, 0.14, 0.18],
        [0, -0.04, -3.18, 0.9, 0.16, 0.18],
        [2.15, -0.01, -3.18, 0.62, 0.12, 0.18],
        [-2.25, -0.02, 3.18, 0.68, 0.14, 0.18],
        [0.15, -0.04, 3.18, 0.86, 0.16, 0.18],
        [2.2, -0.01, 3.18, 0.64, 0.12, 0.18],
        [-3.18, -0.03, -1.9, 0.18, 0.14, 0.68],
        [-3.18, -0.01, 0.2, 0.18, 0.16, 0.92],
        [-3.18, -0.03, 2.15, 0.18, 0.14, 0.62],
        [3.18, -0.03, -1.9, 0.18, 0.14, 0.68],
        [3.18, -0.01, 0.2, 0.18, 0.16, 0.92],
        [3.18, -0.03, 2.15, 0.18, 0.14, 0.62]
      ].map((ledge, index) => (
        <mesh key={`cliff-ledge-${index}`} position={[ledge[0], ledge[1], ledge[2]]}>
          <boxGeometry args={[ledge[3], ledge[4], ledge[5]]} />
          <meshStandardMaterial color={highlightColor} />
        </mesh>
      ))}
    </group>
  );
}

function CourtyardPavers({
  stone = false
}: {
  stone?: boolean;
}) {
  const paverColor = stone ? "#c7c1b7" : "#bca88a";
  const seamColor = stone ? "#a59f95" : "#9c8360";

  return (
    <group>
      <mesh position={[0, 0.1, 0]}>
        <boxGeometry args={[4.2, 0.04, 4.2]} />
        <meshStandardMaterial color={paverColor} />
      </mesh>
      {[-1.2, 0, 1.2].map((offset) => (
        <mesh key={`paver-row-x-${offset}`} position={[offset, 0.12, 0]}>
          <boxGeometry args={[0.08, 0.02, 4.18]} />
          <meshStandardMaterial color={seamColor} />
        </mesh>
      ))}
      {[-1.2, 0, 1.2].map((offset) => (
        <mesh key={`paver-row-z-${offset}`} position={[0, 0.12, offset]}>
          <boxGeometry args={[4.18, 0.02, 0.08]} />
          <meshStandardMaterial color={seamColor} />
        </mesh>
      ))}
      <mesh position={[0, 0.14, 0]}>
        <boxGeometry args={[1.7, 0.06, 1.7]} />
        <meshStandardMaterial color={stone ? "#d5d0c8" : "#c9b695"} />
      </mesh>
    </group>
  );
}

function InnerWardPaths({
  stone = false,
  bannerColor
}: {
  stone?: boolean;
  bannerColor: string;
}) {
  const pathColor = stone ? "#d0cbc3" : "#c6b08d";
  const seamColor = stone ? "#a8a29a" : "#9c8360";

  return (
    <group>
      <mesh position={[0, 0.11, -1.98]}>
        <boxGeometry args={[1.18, 0.03, 1.5]} />
        <meshStandardMaterial color={pathColor} />
      </mesh>
      <mesh position={[0, 0.11, 1.98]}>
        <boxGeometry args={[1.18, 0.03, 1.5]} />
        <meshStandardMaterial color={pathColor} />
      </mesh>
      <mesh position={[-1.98, 0.11, 0]}>
        <boxGeometry args={[1.5, 0.03, 1.18]} />
        <meshStandardMaterial color={pathColor} />
      </mesh>
      <mesh position={[1.98, 0.11, 0]}>
        <boxGeometry args={[1.5, 0.03, 1.18]} />
        <meshStandardMaterial color={pathColor} />
      </mesh>
      <mesh position={[0, 0.115, 0]}>
        <boxGeometry args={[3.96, 0.02, 0.1]} />
        <meshStandardMaterial color={seamColor} />
      </mesh>
      <mesh position={[0, 0.115, 0]}>
        <boxGeometry args={[0.1, 0.02, 3.96]} />
        <meshStandardMaterial color={seamColor} />
      </mesh>
      {[
        [0, 0.14, -1.34],
        [0, 0.14, 1.34],
        [-1.34, 0.14, 0],
        [1.34, 0.14, 0]
      ].map((position, index) => (
        <Lantern
          key={`inner-ward-lantern-${index}`}
          color={bannerColor}
          position={position as [number, number, number]}
        />
      ))}
    </group>
  );
}

function WatchRidgePlatform({
  bannerColor,
  stone = false
}: {
  bannerColor: string;
  stone?: boolean;
}) {
  const baseColor = stone ? "#aeb3bb" : "#a18360";
  const trimColor = stone ? "#8b9098" : "#7a5f42";
  const crateColor = stone ? "#736c64" : "#73563a";

  return (
    <group position={[1.62, 0.12, -1.26]}>
      <mesh position={[0, 0.08, 0]}>
        <boxGeometry args={[1.16, 0.16, 1.02]} />
        <meshStandardMaterial color={baseColor} />
      </mesh>
      <mesh position={[0, 0.18, -0.42]}>
        <boxGeometry args={[1.22, 0.06, 0.14]} />
        <meshStandardMaterial color={trimColor} />
      </mesh>
      <mesh position={[0.44, 0.22, 0.1]}>
        <boxGeometry args={[0.22, 0.22, 0.22]} />
        <meshStandardMaterial color={crateColor} />
      </mesh>
      <mesh position={[0.24, 0.16, 0.28]}>
        <cylinderGeometry args={[0.09, 0.09, 0.18, 12]} />
        <meshStandardMaterial color={crateColor} />
      </mesh>
      <Lantern color={bannerColor} position={[-0.34, 0.18, 0.26]} />
    </group>
  );
}

function ShrineGarden({
  stone = false,
  bannerColor
}: {
  stone?: boolean;
  bannerColor: string;
}) {
  const bedColor = stone ? "#8aa06f" : "#83a15e";
  const pathColor = stone ? "#c8c2b8" : "#bea783";
  const borderColor = stone ? "#8f939a" : "#7a5d3f";

  return (
    <group position={[1.48, 0.1, 1.22]}>
      <mesh position={[0, 0.02, 0]}>
        <boxGeometry args={[1.42, 0.04, 1.38]} />
        <meshStandardMaterial color={pathColor} />
      </mesh>
      <mesh position={[0, 0.08, -0.5]}>
        <boxGeometry args={[1.48, 0.06, 0.1]} />
        <meshStandardMaterial color={borderColor} />
      </mesh>
      <mesh position={[0, 0.08, 0.5]}>
        <boxGeometry args={[1.48, 0.06, 0.1]} />
        <meshStandardMaterial color={borderColor} />
      </mesh>
      <mesh position={[-0.38, 0.08, 0]}>
        <boxGeometry args={[0.34, 0.1, 0.56]} />
        <meshStandardMaterial color={bedColor} />
      </mesh>
      <mesh position={[0.38, 0.08, 0]}>
        <boxGeometry args={[0.34, 0.1, 0.56]} />
        <meshStandardMaterial color={bedColor} />
      </mesh>
      <mesh position={[0, 0.08, 0]}>
        <boxGeometry args={[0.18, 0.05, 0.9]} />
        <meshStandardMaterial color={pathColor} />
      </mesh>
      <Lantern color={bannerColor} position={[-0.58, 0.1, 0.34]} />
      <Lantern color={bannerColor} position={[0.58, 0.1, 0.34]} />
    </group>
  );
}

function KeepBaseDetail({
  keepWidth,
  stone = false,
  bannerColor
}: {
  keepWidth: number;
  stone?: boolean;
  bannerColor: string;
}) {
  const baseColor = stone ? "#aaa39a" : "#a78f71";
  const trimColor = stone ? "#cbc5bc" : "#cab38e";

  return (
    <group>
      <mesh position={[0, 0.34, 0]}>
        <boxGeometry args={[keepWidth + 0.64, 0.18, keepWidth * 0.9 + 0.64]} />
        <meshStandardMaterial color={baseColor} />
      </mesh>
      <mesh position={[0, 0.46, 0]}>
        <boxGeometry args={[keepWidth + 0.78, 0.06, keepWidth * 0.9 + 0.78]} />
        <meshStandardMaterial color={trimColor} />
      </mesh>
      {[
        [-(keepWidth / 2 + 0.16), 0.56, -(keepWidth / 2.45 + 0.12)],
        [keepWidth / 2 + 0.16, 0.56, -(keepWidth / 2.45 + 0.12)],
        [-(keepWidth / 2 + 0.16), 0.56, keepWidth / 2.45 + 0.12],
        [keepWidth / 2 + 0.16, 0.56, keepWidth / 2.45 + 0.12]
      ].map((buttress, index) => (
        <mesh key={`keep-buttress-${index}`} position={buttress as [number, number, number]}>
          <boxGeometry args={[0.24, 0.42, 0.24]} />
          <meshStandardMaterial color={baseColor} />
        </mesh>
      ))}
      <Lantern color={bannerColor} position={[-0.74, 0.46, 1.28]} />
      <Lantern color={bannerColor} position={[0.74, 0.46, 1.28]} />
    </group>
  );
}

function BridgeDetails({
  bridgeColor,
  stone = false
}: {
  bridgeColor: string;
  stone?: boolean;
}) {
  const railColor = stone ? "#b0b3b8" : "#71563c";

  return (
    <group>
      {[
        [0, 0.16, -2.92, 7.4, 0.08, 0.06],
        [0, 0.16, -2.68, 7.4, 0.08, 0.06],
        [0, 0.16, 2.92, 7.4, 0.08, 0.06],
        [0, 0.16, 2.68, 7.4, 0.08, 0.06],
        [-2.92, 0.16, 0, 0.06, 0.08, 6.4],
        [-2.68, 0.16, 0, 0.06, 0.08, 6.4],
        [2.92, 0.16, 0, 0.06, 0.08, 6.4],
        [2.68, 0.16, 0, 0.06, 0.08, 6.4]
      ].map((rail, index) => (
        <mesh key={`bridge-rail-${index}`} position={[rail[0], rail[1], rail[2]]}>
          <boxGeometry args={[rail[3], rail[4], rail[5]]} />
          <meshStandardMaterial color={railColor} />
        </mesh>
      ))}
      {[
        [-3.2, 0.08, -2.92], [-1.1, 0.08, -2.92], [1.1, 0.08, -2.92], [3.2, 0.08, -2.92],
        [-3.2, 0.08, 2.92], [-1.1, 0.08, 2.92], [1.1, 0.08, 2.92], [3.2, 0.08, 2.92],
        [-2.92, 0.08, -2.5], [-2.92, 0.08, -0.75], [-2.92, 0.08, 1.05], [-2.92, 0.08, 2.45],
        [2.92, 0.08, -2.5], [2.92, 0.08, -0.75], [2.92, 0.08, 1.05], [2.92, 0.08, 2.45]
      ].map((post, index) => (
        <mesh key={`bridge-post-${index}`} position={post as [number, number, number]}>
          <boxGeometry args={[0.08, 0.24, 0.08]} />
          <meshStandardMaterial color={bridgeColor} />
        </mesh>
      ))}
    </group>
  );
}

function BridgeAbutments({
  stone = false
}: {
  stone?: boolean;
}) {
  const capColor = stone ? "#9ea3ab" : "#9b805d";
  const baseColor = stone ? "#817d77" : "#7f6344";

  return (
    <group>
      {[
        [0, -0.08, -2.92, 7.52, 0.16, 0.52],
        [0, -0.08, 2.92, 7.52, 0.16, 0.52],
        [-2.92, -0.08, 0, 0.52, 0.16, 6.52],
        [2.92, -0.08, 0, 0.52, 0.16, 6.52]
      ].map((abutment, index) => (
        <mesh key={`bridge-abutment-cap-${index}`} position={[abutment[0], abutment[1], abutment[2]]}>
          <boxGeometry args={[abutment[3], abutment[4], abutment[5]]} />
          <meshStandardMaterial color={capColor} />
        </mesh>
      ))}
      {[
        [-3.34, -0.22, -2.92],
        [3.34, -0.22, -2.92],
        [-3.34, -0.22, 2.92],
        [3.34, -0.22, 2.92],
        [-2.92, -0.22, -2.84],
        [-2.92, -0.22, 2.84],
        [2.92, -0.22, -2.84],
        [2.92, -0.22, 2.84]
      ].map((buttress, index) => (
        <mesh key={`bridge-abutment-buttress-${index}`} position={buttress as [number, number, number]}>
          <boxGeometry args={[0.44, 0.26, 0.44]} />
          <meshStandardMaterial color={baseColor} />
        </mesh>
      ))}
    </group>
  );
}

function BridgeDeckDetails({
  bannerColor,
  stone = false
}: {
  bannerColor: string;
  stone?: boolean;
}) {
  const plankColor = stone ? "#b7bbc1" : "#9b744d";
  const seamColor = stone ? "#858b94" : "#684b30";
  const chainColor = stone ? "#545d66" : "#4f3826";

  return (
    <group>
      {[-3.12, -2.48, -1.84, -1.2, -0.56, 0.08, 0.72, 1.36, 2, 2.64, 3.28].map((x, index) => (
        <group key={`north-south-bridge-planks-${index}`}>
          <mesh position={[x, 0.07, -2.92]}>
            <boxGeometry args={[0.09, 0.045, 0.44]} />
            <meshStandardMaterial color={index % 2 === 0 ? plankColor : seamColor} roughness={0.92} />
          </mesh>
          <mesh position={[x, 0.07, 2.92]}>
            <boxGeometry args={[0.09, 0.045, 0.44]} />
            <meshStandardMaterial color={index % 2 === 0 ? plankColor : seamColor} roughness={0.92} />
          </mesh>
        </group>
      ))}
      {[-2.48, -1.84, -1.2, -0.56, 0.08, 0.72, 1.36, 2, 2.64].map((z, index) => (
        <group key={`east-west-bridge-planks-${index}`}>
          <mesh position={[-2.92, 0.07, z]}>
            <boxGeometry args={[0.44, 0.045, 0.09]} />
            <meshStandardMaterial color={index % 2 === 0 ? plankColor : seamColor} roughness={0.92} />
          </mesh>
          <mesh position={[2.92, 0.07, z]}>
            <boxGeometry args={[0.44, 0.045, 0.09]} />
            <meshStandardMaterial color={index % 2 === 0 ? plankColor : seamColor} roughness={0.92} />
          </mesh>
        </group>
      ))}
      {[
        [0, 0.25, -2.8, 7.1, 0.035, 0.035],
        [0, 0.25, 2.8, 7.1, 0.035, 0.035],
        [-2.8, 0.25, 0, 0.035, 0.035, 6.1],
        [2.8, 0.25, 0, 0.035, 0.035, 6.1]
      ].map((chain, index) => (
        <mesh key={`bridge-chain-${index}`} position={[chain[0], chain[1], chain[2]] as [number, number, number]}>
          <boxGeometry args={[chain[3], chain[4], chain[5]] as [number, number, number]} />
          <meshStandardMaterial color={chainColor} roughness={0.72} metalness={stone ? 0.14 : 0.04} />
        </mesh>
      ))}
      {[
        [-2.52, 0.1, -2.52],
        [2.52, 0.1, -2.52],
        [-2.52, 0.1, 2.52],
        [2.52, 0.1, 2.52]
      ].map((position, index) => (
        <Lantern key={`bridge-lantern-${index}`} color={bannerColor} position={position as [number, number, number]} />
      ))}
    </group>
  );
}

function QuaySteps({
  position,
  rotation = 0,
  stone = false
}: {
  position: [number, number, number];
  rotation?: number;
  stone?: boolean;
}) {
  const stepColor = stone ? "#a3a7af" : "#9c7a58";

  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {[0, 1, 2].map((index) => (
        <mesh key={`quay-step-${index}`} position={[0, -0.03 - index * 0.06, index * 0.18]}>
          <boxGeometry args={[0.64 - index * 0.1, 0.06, 0.18]} />
          <meshStandardMaterial color={stepColor} />
        </mesh>
      ))}
    </group>
  );
}

function HarborJetty({
  position,
  rotation = 0,
  stone = false
}: {
  position: [number, number, number];
  rotation?: number;
  stone?: boolean;
}) {
  const plankColor = stone ? "#9e9487" : "#8e6d46";
  const postColor = stone ? "#82776a" : "#6d5338";

  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh position={[0, 0.04, 0]}>
        <boxGeometry args={[0.84, 0.08, 0.28]} />
        <meshStandardMaterial color={plankColor} />
      </mesh>
      {[-0.26, 0.26].map((x, index) => (
        <mesh key={`jetty-post-${index}`} position={[x, -0.08, 0]}>
          <boxGeometry args={[0.08, 0.24, 0.08]} />
          <meshStandardMaterial color={postColor} />
        </mesh>
      ))}
    </group>
  );
}

function CourtyardProps({
  bannerColor,
  stone = false
}: {
  bannerColor: string;
  stone?: boolean;
}) {
  const crateColor = stone ? "#8b7963" : "#8c6842";
  const barrelColor = stone ? "#786652" : "#7a5638";

  return (
    <group>
      <mesh position={[-0.92, 0.22, 0.84]}>
        <boxGeometry args={[0.24, 0.24, 0.24]} />
        <meshStandardMaterial color={crateColor} />
      </mesh>
      <mesh position={[-0.62, 0.18, 0.92]}>
        <cylinderGeometry args={[0.11, 0.11, 0.24, 12]} />
        <meshStandardMaterial color={barrelColor} />
      </mesh>
      <mesh position={[0.98, 0.18, -0.92]}>
        <cylinderGeometry args={[0.11, 0.11, 0.24, 12]} />
        <meshStandardMaterial color={barrelColor} />
      </mesh>
      <mesh position={[0.72, 0.22, -0.84]}>
        <boxGeometry args={[0.22, 0.22, 0.22]} />
        <meshStandardMaterial color={crateColor} />
      </mesh>
      <Lantern color={bannerColor} position={[-1.42, 0.22, 0.28]} />
      <Lantern color={bannerColor} position={[1.36, 0.22, -0.24]} />
    </group>
  );
}

function CourtyardWorker({
  position,
  color,
  delay = 0
}: {
  position: [number, number, number];
  color: string;
  delay?: number;
}) {
  const ref = useRef<Group>(null);

  useFrame((state) => {
    if (!ref.current) {
      return;
    }

    ref.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 2.4 + delay) * 0.025;
    ref.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.8 + delay) * 0.36;
  });

  return (
    <group ref={ref} position={position}>
      <mesh position={[0, 0.16, 0]} castShadow>
        <cylinderGeometry args={[0.055, 0.065, 0.25, 8]} />
        <meshStandardMaterial color="#4b3b2f" roughness={0.82} />
      </mesh>
      <mesh position={[0, 0.34, 0]} castShadow>
        <sphereGeometry args={[0.07, 10, 10]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.12} />
      </mesh>
      <mesh position={[0.12, 0.22, 0]} rotation={[0, 0, -0.7]}>
        <boxGeometry args={[0.04, 0.22, 0.035]} />
        <meshStandardMaterial color="#7b5a3a" />
      </mesh>
    </group>
  );
}

function CourtyardLife({
  bannerColor,
  builderCount,
  active = false,
  stone = false
}: {
  bannerColor: string;
  builderCount: number;
  active?: boolean;
  stone?: boolean;
}) {
  const workerPositions = [
    [-0.82, 0.2, -0.62],
    [0.92, 0.2, 0.48],
    [-0.18, 0.2, 1.02],
    [0.52, 0.2, -1.06],
    [-1.16, 0.2, 0.16]
  ] as const;
  const clothColor = active ? bannerColor : "#d7c37b";
  const buntingPostColor = stone ? "#747a83" : "#71563c";

  return (
    <group>
      {workerPositions.slice(0, Math.max(2, Math.min(5, builderCount + 1))).map((position, index) => (
        <CourtyardWorker
          color={index === 0 ? bannerColor : clothColor}
          delay={index * 0.8}
          key={`courtyard-worker-${index}`}
          position={position as [number, number, number]}
        />
      ))}
      <mesh position={[-1.34, 0.4, -1.08]}>
        <boxGeometry args={[0.06, 0.62, 0.06]} />
        <meshStandardMaterial color={buntingPostColor} />
      </mesh>
      <mesh position={[1.34, 0.4, -1.08]}>
        <boxGeometry args={[0.06, 0.62, 0.06]} />
        <meshStandardMaterial color={buntingPostColor} />
      </mesh>
      <mesh position={[0, 0.66, -1.08]}>
        <boxGeometry args={[2.7, 0.035, 0.035]} />
        <meshStandardMaterial color={buntingPostColor} />
      </mesh>
      {[-0.96, -0.48, 0, 0.48, 0.96].map((x, index) => (
        <mesh key={`courtyard-bunting-${index}`} position={[x, 0.58, -1.08]}>
          <coneGeometry args={[0.11, 0.18, 3]} />
          <meshStandardMaterial
            color={index % 2 === 0 ? bannerColor : clothColor}
            emissive={index % 2 === 0 ? bannerColor : clothColor}
            emissiveIntensity={active ? 0.18 : 0.08}
          />
        </mesh>
      ))}
      <Lantern color={bannerColor} position={[-1.32, 0.18, -1.12]} />
      <Lantern color={bannerColor} position={[1.32, 0.18, -1.12]} />
    </group>
  );
}

function KeepRoofCrown({
  keepWidth,
  bannerColor,
  stone = false
}: {
  keepWidth: number;
  bannerColor: string;
  stone?: boolean;
}) {
  const parapetColor = stone ? "#b8bbc1" : "#c8b79b";
  const capColor = stone ? "#969aa3" : "#9a7b57";

  return (
    <group>
      <mesh position={[0, 1.62, -keepWidth * 0.3]}>
        <boxGeometry args={[keepWidth * 0.72, 0.14, 0.14]} />
        <meshStandardMaterial color={parapetColor} />
      </mesh>
      <mesh position={[0, 1.62, keepWidth * 0.3]}>
        <boxGeometry args={[keepWidth * 0.72, 0.14, 0.14]} />
        <meshStandardMaterial color={parapetColor} />
      </mesh>
      <mesh position={[-keepWidth * 0.36, 1.62, 0]}>
        <boxGeometry args={[0.14, 0.14, keepWidth * 0.58]} />
        <meshStandardMaterial color={parapetColor} />
      </mesh>
      <mesh position={[keepWidth * 0.36, 1.62, 0]}>
        <boxGeometry args={[0.14, 0.14, keepWidth * 0.58]} />
        <meshStandardMaterial color={parapetColor} />
      </mesh>
      {[-0.36, -0.12, 0.12, 0.36].map((offset, index) => (
        <mesh key={`keep-merlon-north-${index}`} position={[keepWidth * offset, 1.74, -keepWidth * 0.3]}>
          <boxGeometry args={[0.12, 0.18, 0.12]} />
          <meshStandardMaterial color={capColor} />
        </mesh>
      ))}
      {[-0.36, -0.12, 0.12, 0.36].map((offset, index) => (
        <mesh key={`keep-merlon-south-${index}`} position={[keepWidth * offset, 1.74, keepWidth * 0.3]}>
          <boxGeometry args={[0.12, 0.18, 0.12]} />
          <meshStandardMaterial color={capColor} />
        </mesh>
      ))}
      {[
        [-0.42, -0.34],
        [0.42, -0.34],
        [-0.42, 0.34],
        [0.42, 0.34]
      ].map(([x, z], index) => (
        <group key={`keep-corner-turret-${index}`} position={[keepWidth * x, 1.9, keepWidth * z]}>
          <mesh position={[0, 0, 0]}>
            <cylinderGeometry args={[0.11, 0.13, 0.4, 8]} />
            <meshStandardMaterial color={parapetColor} />
          </mesh>
          <mesh position={[0, 0.28, 0]}>
            <coneGeometry args={[0.15, 0.24, 6]} />
            <meshStandardMaterial color={capColor} />
          </mesh>
        </group>
      ))}
      <Lantern color={bannerColor} position={[-keepWidth * 0.26, 1.56, -keepWidth * 0.18]} />
      <Lantern color={bannerColor} position={[keepWidth * 0.26, 1.56, 0]} />
    </group>
  );
}

function WallLookout({
  position,
  rotation = 0,
  stone = false,
  bannerColor
}: {
  position: [number, number, number];
  rotation?: number;
  stone?: boolean;
  bannerColor: string;
}) {
  const wallColor = stone ? "#bcc0c7" : "#b59f81";
  const roofColor = stone ? "#818791" : "#8d6b46";
  const beamColor = stone ? "#6d727c" : "#6f5439";

  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh position={[0, 0.2, 0]}>
        <boxGeometry args={[0.38, 0.08, 0.54]} />
        <meshStandardMaterial color={wallColor} />
      </mesh>
      {[-0.12, 0.12].map((x, index) => (
        <mesh key={`lookout-post-${index}`} position={[x, 0.38, 0]}>
          <boxGeometry args={[0.06, 0.36, 0.06]} />
          <meshStandardMaterial color={beamColor} />
        </mesh>
      ))}
      <mesh position={[0, 0.62, 0]} rotation={[0, 0.785, 0]}>
        <coneGeometry args={[0.24, 0.2, 4]} />
        <meshStandardMaterial color={roofColor} />
      </mesh>
      <Lantern color={bannerColor} position={[0, 0.3, 0.22]} />
    </group>
  );
}

function WallCrenellations({
  stone = false,
  bannerColor
}: {
  stone?: boolean;
  bannerColor: string;
}) {
  const wallCap = stone ? "#afb3bb" : "#8d7451";

  return (
    <group>
      {[-5, -3, -1, 1, 3, 5].map((x, index) => (
        <mesh key={`north-crenel-${index}`} position={[x, 1.14, -6.35]}>
          <boxGeometry args={[0.56, 0.22, 0.24]} />
          <meshStandardMaterial color={wallCap} />
        </mesh>
      ))}
      {[-5, -3, -1, 1, 3, 5].map((z, index) => (
        <mesh key={`east-crenel-${index}`} position={[6.35, 1.14, z]}>
          <boxGeometry args={[0.24, 0.22, 0.56]} />
          <meshStandardMaterial color={wallCap} />
        </mesh>
      ))}
      <WallLookout bannerColor={bannerColor} position={[1.8, 1.02, -6.06]} stone={stone} />
      <WallLookout bannerColor={bannerColor} position={[6.06, 1.02, -1.9]} rotation={Math.PI / 2} stone={stone} />
      <Banner color={bannerColor} position={[-2.6, 1.16, -6.1]} />
      <Banner color={bannerColor} position={[2.4, 1.16, -6.1]} />
      <Banner color={bannerColor} position={[6.08, 1.16, -2.6]} />
      <Banner color={bannerColor} position={[6.08, 1.16, 2.3]} />
    </group>
  );
}

function CurtainWallTower({
  position,
  rotation = 0,
  stone = false,
  bannerColor
}: {
  position: [number, number, number];
  rotation?: number;
  stone?: boolean;
  bannerColor: string;
}) {
  const bodyColor = stone ? "#b8bdbd" : "#b9a17a";
  const trimColor = stone ? "#7a8288" : "#7d6041";
  const roofColor = stone ? "#516e68" : "#8f6b45";

  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.36, 0.46, 1, 10]} />
        <meshStandardMaterial color={bodyColor} roughness={0.86} />
      </mesh>
      <mesh position={[0, 1.06, 0]} castShadow>
        <cylinderGeometry args={[0.48, 0.42, 0.22, 10]} />
        <meshStandardMaterial color={trimColor} roughness={0.82} />
      </mesh>
      {[-0.2, 0, 0.2].map((x, index) => (
        <mesh key={`curtain-tower-merlon-${index}`} position={[x, 1.28, 0.34]}>
          <boxGeometry args={[0.11, 0.22, 0.12]} />
          <meshStandardMaterial color={trimColor} roughness={0.82} />
        </mesh>
      ))}
      <mesh position={[0, 1.52, 0]} castShadow>
        <coneGeometry args={[0.48, 0.54, 10]} />
        <meshStandardMaterial color={roofColor} roughness={0.76} />
      </mesh>
      <ArrowSlit position={[0, 0.58, 0.37]} />
      <Lantern color={bannerColor} position={[0.28, 0.74, 0.38]} />
      <Banner color={bannerColor} position={[0.1, 1.52, 0.12]} />
    </group>
  );
}

function PatrolGuard({
  start,
  end,
  color,
  speed = 0.18
}: {
  start: [number, number, number];
  end: [number, number, number];
  color: string;
  speed?: number;
}) {
  const guardRef = useRef<Group>(null);

  useFrame((state) => {
    if (!guardRef.current) {
      return;
    }

    const progress = (Math.sin(state.clock.elapsedTime * speed * Math.PI * 2) + 1) / 2;
    guardRef.current.position.set(
      start[0] + (end[0] - start[0]) * progress,
      start[1] + (end[1] - start[1]) * progress,
      start[2] + (end[2] - start[2]) * progress
    );
  });

  return (
    <group ref={guardRef} position={start}>
      <mesh position={[0, 0.1, 0]} castShadow>
        <sphereGeometry args={[0.09, 12, 12]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.18} />
      </mesh>
      <mesh position={[0, -0.04, 0]}>
        <cylinderGeometry args={[0.045, 0.055, 0.22, 8]} />
        <meshStandardMaterial color="#37312a" />
      </mesh>
    </group>
  );
}

function DistantCurtainWalls({
  stone = false,
  bannerColor,
  towerCount
}: {
  stone?: boolean;
  bannerColor: string;
  towerCount: number;
}) {
  const wallColor = stone ? "#aeb6b7" : "#8e7654";
  const lowerColor = stone ? "#7d8789" : "#5f4932";
  const capColor = stone ? "#c2c7c5" : "#b79b6d";
  const towerPositions = [
    [6.35, 0.08, -6.35],
    [-3.1, 0.08, -6.35],
    [6.35, 0.08, 2.7],
    [2.15, 0.08, -6.35]
  ] as const;

  return (
    <group>
      <mesh position={[0, 0.44, -6.35]} castShadow receiveShadow>
        <boxGeometry args={[13, 0.88, 0.5]} />
        <meshStandardMaterial color={wallColor} roughness={0.9} />
      </mesh>
      <mesh position={[6.35, 0.44, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.5, 0.88, 13]} />
        <meshStandardMaterial color={wallColor} roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.18, -6.02]} receiveShadow>
        <boxGeometry args={[13.18, 0.24, 0.12]} />
        <meshStandardMaterial color={lowerColor} roughness={0.9} />
      </mesh>
      <mesh position={[6.02, 0.18, 0]} receiveShadow>
        <boxGeometry args={[0.12, 0.24, 13.18]} />
        <meshStandardMaterial color={lowerColor} roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.94, -6.35]} castShadow>
        <boxGeometry args={[13.18, 0.18, 0.72]} />
        <meshStandardMaterial color={capColor} roughness={0.86} />
      </mesh>
      <mesh position={[6.35, 0.94, 0]} castShadow>
        <boxGeometry args={[0.72, 0.18, 13.18]} />
        <meshStandardMaterial color={capColor} roughness={0.86} />
      </mesh>
      {[-5.8, -4.7, -3.6, -2.5, -1.4, -0.3, 0.8, 1.9, 3, 4.1, 5.2].map((x, index) => (
        <mesh key={`distant-wall-north-merlon-${index}`} position={[x, 1.16, -6.02]} castShadow>
          <boxGeometry args={[0.34, 0.28, 0.18]} />
          <meshStandardMaterial color={capColor} roughness={0.82} />
        </mesh>
      ))}
      {[-5.8, -4.7, -3.6, -2.5, -1.4, -0.3, 0.8, 1.9, 3, 4.1, 5.2].map((z, index) => (
        <mesh key={`distant-wall-east-merlon-${index}`} position={[6.02, 1.16, z]} castShadow>
          <boxGeometry args={[0.18, 0.28, 0.34]} />
          <meshStandardMaterial color={capColor} roughness={0.82} />
        </mesh>
      ))}
      {[-4.6, -2.6, -0.6, 1.4, 3.4].map((x, index) => (
        <ArrowSlit key={`north-wall-slit-${index}`} position={[x, 0.58, -6.08]} />
      ))}
      {[-4.4, -2.4, -0.4, 1.6, 3.6].map((z, index) => (
        <ArrowSlit key={`east-wall-slit-${index}`} position={[6.08, 0.58, z]} rotation={Math.PI / 2} />
      ))}
      {towerPositions.slice(0, Math.max(1, Math.min(4, towerCount))).map((position, index) => (
        <CurtainWallTower
          bannerColor={bannerColor}
          key={`curtain-wall-tower-${index}`}
          position={position as [number, number, number]}
          rotation={index === 2 ? Math.PI / 2 : 0}
          stone={stone}
        />
      ))}
      <WallLookout bannerColor={bannerColor} position={[1.8, 1.02, -6.06]} stone={stone} />
      <WallLookout bannerColor={bannerColor} position={[6.06, 1.02, -1.9]} rotation={Math.PI / 2} stone={stone} />
      <PatrolGuard color={bannerColor} start={[-4.7, 1.14, -6.02]} end={[4.4, 1.14, -6.02]} />
      <PatrolGuard color={bannerColor} start={[6.02, 1.14, -4.6]} end={[6.02, 1.14, 4.2]} speed={0.14} />
      <Banner color={bannerColor} position={[-2.6, 1.22, -6.02]} />
      <Banner color={bannerColor} position={[2.4, 1.22, -6.02]} />
      <Banner color={bannerColor} position={[6.02, 1.22, -2.6]} />
      <Banner color={bannerColor} position={[6.02, 1.22, 2.3]} />
    </group>
  );
}

function Banner({
  position,
  color
}: {
  position: [number, number, number];
  color: string;
}) {
  const bannerRef = useRef<Mesh>(null);

  useFrame((state) => {
    if (!bannerRef.current) {
      return;
    }

    bannerRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 1.8 + position[0]) * 0.08;
    bannerRef.current.scale.x = 1 + Math.sin(state.clock.elapsedTime * 2.2 + position[2]) * 0.08;
  });

  return (
    <group position={position}>
      <mesh position={[0, 0.18, 0]}>
        <boxGeometry args={[0.04, 0.4, 0.04]} />
        <meshStandardMaterial color="#6e5a42" />
      </mesh>
      <mesh ref={bannerRef} position={[0.12, 0.28, 0]}>
        <boxGeometry args={[0.2, 0.14, 0.02]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.18} />
      </mesh>
    </group>
  );
}

function ArrowSlit({
  position,
  rotation = 0
}: {
  position: [number, number, number];
  rotation?: number;
}) {
  return (
    <mesh position={position} rotation={[0, rotation, 0]}>
      <boxGeometry args={[0.07, 0.34, 0.035]} />
      <meshStandardMaterial color="#2f2b28" emissive="#171514" emissiveIntensity={0.14} />
    </mesh>
  );
}

function StoneCourse({
  width,
  depth,
  y,
  color
}: {
  width: number;
  depth: number;
  y: number;
  color: string;
}) {
  return (
    <>
      <mesh position={[0, y, -depth / 2 - 0.018]}>
        <boxGeometry args={[width + 0.08, 0.045, 0.036]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[0, y, depth / 2 + 0.018]}>
        <boxGeometry args={[width + 0.08, 0.045, 0.036]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[-width / 2 - 0.018, y, 0]}>
        <boxGeometry args={[0.036, 0.045, depth + 0.08]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[width / 2 + 0.018, y, 0]}>
        <boxGeometry args={[0.036, 0.045, depth + 0.08]} />
        <meshStandardMaterial color={color} />
      </mesh>
    </>
  );
}

function GothicWindow({
  position,
  rotation = 0,
  scale = 1,
  glow = false
}: {
  position: [number, number, number];
  rotation?: number;
  scale?: number;
  glow?: boolean;
}) {
  const glassColor = glow ? "#f4c978" : "#1f2931";

  return (
    <group position={position} rotation={[0, rotation, 0]} scale={scale}>
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.09, 0.24, 0.032]} />
        <meshStandardMaterial color={glassColor} emissive={glassColor} emissiveIntensity={glow ? 0.38 : 0.1} />
      </mesh>
      <mesh position={[0, 0.13, 0]}>
        <sphereGeometry args={[0.046, 10, 8]} />
        <meshStandardMaterial color={glassColor} emissive={glassColor} emissiveIntensity={glow ? 0.38 : 0.1} />
      </mesh>
      <mesh position={[-0.065, -0.005, 0]}>
        <boxGeometry args={[0.018, 0.28, 0.036]} />
        <meshStandardMaterial color="#6e6251" />
      </mesh>
      <mesh position={[0.065, -0.005, 0]}>
        <boxGeometry args={[0.018, 0.28, 0.036]} />
        <meshStandardMaterial color="#6e6251" />
      </mesh>
    </group>
  );
}

function RoseWindow({
  position,
  rotation = 0,
  scale = 1,
  glow = false
}: {
  position: [number, number, number];
  rotation?: number;
  scale?: number;
  glow?: boolean;
}) {
  const glassColor = glow ? "#f5cf82" : "#263740";
  const leadingColor = "#6e6251";

  return (
    <group position={position} rotation={[0, rotation, 0]} scale={scale}>
      <mesh position={[0, 0, 0.004]}>
        <ringGeometry args={[0.1, 0.18, 24]} />
        <meshStandardMaterial color={glassColor} emissive={glassColor} emissiveIntensity={glow ? 0.48 : 0.1} />
      </mesh>
      <mesh position={[0, 0, 0.008]}>
        <circleGeometry args={[0.07, 18]} />
        <meshStandardMaterial color={glassColor} emissive={glassColor} emissiveIntensity={glow ? 0.5 : 0.12} />
      </mesh>
      {Array.from({ length: 6 }).map((_, index) => (
        <mesh key={`rose-window-leading-${index}`} position={[0, 0, 0.012]} rotation={[0, 0, index * (Math.PI / 3)]}>
          <boxGeometry args={[0.024, 0.34, 0.018]} />
          <meshStandardMaterial color={leadingColor} roughness={0.82} />
        </mesh>
      ))}
      <mesh position={[0, 0, 0.016]}>
        <ringGeometry args={[0.18, 0.205, 24]} />
        <meshStandardMaterial color={leadingColor} roughness={0.82} />
      </mesh>
    </group>
  );
}

function RoofDormer({
  position,
  rotation = 0,
  stone = false,
  glow = false
}: {
  position: [number, number, number];
  rotation?: number;
  stone?: boolean;
  glow?: boolean;
}) {
  const wallColor = stone ? "#c3c5c4" : "#cdbf9e";
  const roofColor = stone ? "#536d68" : "#94724a";

  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh position={[0, 0.12, 0]} castShadow>
        <boxGeometry args={[0.22, 0.24, 0.16]} />
        <meshStandardMaterial color={wallColor} roughness={0.86} />
      </mesh>
      <mesh position={[0, 0.3, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
        <coneGeometry args={[0.2, 0.24, 4]} />
        <meshStandardMaterial color={roofColor} roughness={0.8} />
      </mesh>
      <GothicWindow glow={glow} position={[0, 0.12, 0.086]} scale={0.45} />
    </group>
  );
}

function RoofTileRows({
  width,
  z,
  y,
  color,
  rows = 4
}: {
  width: number;
  z: number;
  y: number;
  color: string;
  rows?: number;
}) {
  return (
    <>
      {Array.from({ length: rows }).map((_, row) => (
        <mesh key={`roof-tile-row-${z}-${row}`} position={[0, y + row * 0.08, z - row * 0.035]}>
          <boxGeometry args={[width - row * 0.14, 0.035, 0.05]} />
          <meshStandardMaterial color={row % 2 === 0 ? color : "#7f6b4d"} roughness={0.9} />
        </mesh>
      ))}
    </>
  );
}

function StorybookWing({
  position,
  rotation = 0,
  width,
  depth,
  height,
  stone = false,
  bannerColor
}: {
  position: [number, number, number];
  rotation?: number;
  width: number;
  depth: number;
  height: number;
  stone?: boolean;
  bannerColor: string;
}) {
  const wallColor = stone ? "#c1c4c4" : "#cdbf9e";
  const trimColor = stone ? "#7e858d" : "#8f7354";
  const roofColor = stone ? "#5d756f" : "#9d7a4d";

  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh position={[0, height / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial color={wallColor} roughness={0.86} />
      </mesh>
      <mesh position={[0, height + 0.28, 0]} rotation={[0, Math.PI / 4, 0]} scale={[width * 0.74, 0.82, depth * 0.95]} castShadow>
        <coneGeometry args={[0.72, 0.78, 4]} />
        <meshStandardMaterial color={roofColor} roughness={0.82} />
      </mesh>
      <RoofTileRows color="#b19563" rows={5} width={width * 0.82} y={height + 0.12} z={depth * 0.32} />
      <RoofTileRows color="#b19563" rows={5} width={width * 0.82} y={height + 0.12} z={-depth * 0.32} />
      {[-0.32, 0, 0.32].map((x, index) => (
        <GothicWindow
          glow={index === 1}
          key={`storybook-wing-front-window-${index}`}
          position={[x * width, height * 0.52, depth / 2 + 0.018]}
          scale={0.92}
        />
      ))}
      {[-0.3, 0.3].map((x, index) => (
        <GothicWindow
          key={`storybook-wing-upper-window-${index}`}
          position={[x * width, height * 0.84, depth / 2 + 0.018]}
          scale={0.78}
        />
      ))}
      <mesh position={[0, height + 0.03, depth / 2 + 0.03]}>
        <boxGeometry args={[width * 0.86, 0.08, 0.06]} />
        <meshStandardMaterial color={trimColor} roughness={0.84} />
      </mesh>
      <Lantern color={bannerColor} position={[-width * 0.42, 0.1, depth / 2 + 0.08]} />
      <Lantern color={bannerColor} position={[width * 0.42, 0.1, depth / 2 + 0.08]} />
    </group>
  );
}

function CastleCornerTower({
  position,
  bannerColor,
  height,
  stone = false
}: {
  position: [number, number, number];
  bannerColor: string;
  height: number;
  stone?: boolean;
}) {
  const bodyColor = stone ? "#bbc0c1" : "#cabd9d";
  const trimColor = stone ? "#7f878d" : "#8d7050";
  const roofColor = stone ? "#536d68" : "#94724a";

  return (
    <group position={position}>
      <mesh position={[0, height / 2, 0]} castShadow>
        <cylinderGeometry args={[0.25, 0.31, height, 10]} />
        <meshStandardMaterial color={bodyColor} roughness={0.82} />
      </mesh>
      <mesh position={[0, height * 0.62, 0]}>
        <cylinderGeometry args={[0.28, 0.29, 0.08, 10]} />
        <meshStandardMaterial color={trimColor} roughness={0.86} />
      </mesh>
      <mesh position={[0, height + 0.08, 0]} castShadow>
        <cylinderGeometry args={[0.34, 0.32, 0.16, 10]} />
        <meshStandardMaterial color={trimColor} roughness={0.84} />
      </mesh>
      {[0, Math.PI / 2, Math.PI, Math.PI * 1.5].map((rotation, index) => (
        <ArrowSlit
          key={`corner-tower-slit-${index}`}
          position={[
            Math.sin(rotation) * 0.255,
            height * 0.62,
            Math.cos(rotation) * 0.255
          ]}
          rotation={rotation}
        />
      ))}
      <GothicWindow position={[0, height * 0.82, 0.255]} scale={0.72} />
      <mesh position={[0, height + 0.36, 0]} castShadow>
        <coneGeometry args={[0.39, 0.68, 10]} />
        <meshStandardMaterial color={roofColor} roughness={0.78} />
      </mesh>
      <Banner color={bannerColor} position={[0.12, height + 0.54, 0.02]} />
    </group>
  );
}

function NeedleSpireTower({
  position,
  bannerColor,
  stone = false,
  height = 3.4
}: {
  position: [number, number, number];
  bannerColor: string;
  stone?: boolean;
  height?: number;
}) {
  const bodyColor = stone ? "#c6c8c5" : "#cdbf9e";
  const shadowColor = stone ? "#848a8b" : "#8f7354";
  const roofColor = stone ? "#4c6864" : "#9a764d";

  return (
    <group position={position}>
      <mesh position={[0, height / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.22, 0.31, height, 12]} />
        <meshStandardMaterial color={bodyColor} roughness={0.84} />
      </mesh>
      {[0.38, 0.64, 0.82].map((factor, index) => (
        <mesh key={`needle-spire-belt-${index}`} position={[0, height * factor, 0]}>
          <cylinderGeometry args={[0.26, 0.27, 0.07, 12]} />
          <meshStandardMaterial color={shadowColor} roughness={0.84} />
        </mesh>
      ))}
      {[0, Math.PI / 2, Math.PI, Math.PI * 1.5].map((rotation, index) => (
        <GothicWindow
          key={`needle-window-${index}`}
          position={[Math.sin(rotation) * 0.225, height * 0.58, Math.cos(rotation) * 0.225]}
          rotation={rotation}
          scale={0.72}
        />
      ))}
      <mesh position={[0, height + 0.16, 0]} castShadow>
        <cylinderGeometry args={[0.34, 0.3, 0.26, 12]} />
        <meshStandardMaterial color={shadowColor} roughness={0.82} />
      </mesh>
      <mesh position={[0, height + 0.42, 0]}>
        <cylinderGeometry args={[0.38, 0.38, 0.12, 12]} />
        <meshStandardMaterial color={shadowColor} roughness={0.82} />
      </mesh>
      {[-0.22, 0, 0.22].map((x, index) => (
        <mesh key={`needle-crown-${index}`} position={[x, height + 0.58, 0.26]}>
          <boxGeometry args={[0.1, 0.2, 0.1]} />
          <meshStandardMaterial color={bodyColor} roughness={0.82} />
        </mesh>
      ))}
      <mesh position={[0, height + 1.05, 0]} castShadow>
        <coneGeometry args={[0.36, 1.12, 12]} />
        <meshStandardMaterial color={roofColor} roughness={0.78} />
      </mesh>
      <Banner color={bannerColor} position={[0.12, height + 1.42, 0]} />
    </group>
  );
}

function GrandKeepModel({
  keepWidth,
  keepHeight,
  bannerColor,
  stone = false,
  showSmoke = false,
  showNorthBanner = false,
  showSouthBanner = false
}: {
  keepWidth: number;
  keepHeight: number;
  bannerColor: string;
  stone?: boolean;
  showSmoke?: boolean;
  showNorthBanner?: boolean;
  showSouthBanner?: boolean;
}) {
  const wallColor = stone ? "#c4c8c7" : "#d0c2a2";
  const lowerWallColor = stone ? "#b3b8b8" : "#b9a98a";
  const trimColor = stone ? "#7c848a" : "#8f7354";
  const roofColor = stone ? "#516e68" : "#98744d";
  const keepDepth = keepWidth * 0.92;
  const towerHeight = keepHeight + 0.54;
  const towerInsetX = keepWidth / 2 + 0.08;
  const towerInsetZ = keepDepth / 2 + 0.06;
  const entryStoneColor = stone ? "#b8bcb9" : "#c2b08d";
  const entryTrimColor = stone ? "#7d858d" : "#84684a";
  const doorColor = stone ? "#3a3430" : "#4f3525";

  return (
    <group>
      <KeepBaseDetail bannerColor={bannerColor} keepWidth={keepWidth} stone={stone} />
      <CourtyardProps bannerColor={bannerColor} stone={stone} />
      <StorybookWing
        bannerColor={bannerColor}
        depth={0.66}
        height={0.92}
        position={[-0.72, 0.36, -0.74]}
        rotation={0.08}
        stone={stone}
        width={1.36}
      />
      <StorybookWing
        bannerColor={bannerColor}
        depth={0.58}
        height={0.72}
        position={[0.84, 0.32, 0.72]}
        rotation={-0.2}
        stone={stone}
        width={1.12}
      />
      <NeedleSpireTower
        bannerColor={bannerColor}
        height={keepHeight + 1.28}
        position={[-0.62, 0.42, -0.48]}
        stone={stone}
      />

      <mesh position={[0, 0.78, 0]} castShadow receiveShadow>
        <boxGeometry args={[keepWidth, keepHeight, keepDepth]} />
        <meshStandardMaterial color={wallColor} roughness={0.86} metalness={0.02} />
      </mesh>
      <mesh position={[0, 0.34, 0]} receiveShadow>
        <boxGeometry args={[keepWidth + 0.28, 0.32, keepDepth + 0.22]} />
        <meshStandardMaterial color={lowerWallColor} roughness={0.9} />
      </mesh>

      <group position={[0, 0.38, keepDepth / 2 + 0.2]}>
        <mesh position={[0, 0.54, 0]} castShadow receiveShadow>
          <boxGeometry args={[1.08, 1.08, 0.34]} />
          <meshStandardMaterial color={entryStoneColor} roughness={0.86} />
        </mesh>
        <mesh position={[0, 1.22, 0.02]} rotation={[0, Math.PI / 4, 0]} castShadow>
          <coneGeometry args={[0.72, 0.52, 4]} />
          <meshStandardMaterial color={roofColor} roughness={0.78} />
        </mesh>
        <mesh position={[0, 0.22, 0.19]}>
          <boxGeometry args={[0.36, 0.44, 0.05]} />
          <meshStandardMaterial color={doorColor} roughness={0.82} />
        </mesh>
        <mesh position={[0, 0.44, 0.205]}>
          <sphereGeometry args={[0.18, 14, 8]} />
          <meshStandardMaterial color={doorColor} roughness={0.82} />
        </mesh>
        <mesh position={[0, 0.72, 0.2]}>
          <boxGeometry args={[0.62, 0.08, 0.07]} />
          <meshStandardMaterial color={entryTrimColor} roughness={0.84} />
        </mesh>
        <RoseWindow glow position={[0, 0.92, 0.215]} scale={0.88} />
        {[-0.44, 0.44].map((x, index) => (
          <mesh key={`grand-entry-column-${index}`} position={[x, 0.48, 0.2]} castShadow>
            <cylinderGeometry args={[0.07, 0.08, 0.82, 8]} />
            <meshStandardMaterial color={entryTrimColor} roughness={0.84} />
          </mesh>
        ))}
        {[0, 1, 2].map((index) => (
          <mesh key={`grand-entry-step-${index}`} position={[0, 0.02 + index * 0.05, 0.36 + index * 0.14]}>
            <boxGeometry args={[1.18 - index * 0.16, 0.05, 0.18]} />
            <meshStandardMaterial color={stone ? "#b4b7ba" : "#b89a6e"} roughness={0.88} />
          </mesh>
        ))}
        <Lantern color={bannerColor} position={[-0.56, 0.5, 0.24]} />
        <Lantern color={bannerColor} position={[0.56, 0.5, 0.24]} />
      </group>

      {[0.58, 0.94, 1.28].map((y, index) => (
        <StoneCourse color={index % 2 === 0 ? trimColor : lowerWallColor} depth={keepDepth} key={`keep-course-${index}`} width={keepWidth} y={y} />
      ))}

      <mesh position={[0, keepHeight + 0.78, 0]} castShadow>
        <boxGeometry args={[keepWidth * 0.78, 0.32, keepDepth * 0.66]} />
        <meshStandardMaterial color={lowerWallColor} roughness={0.86} />
      </mesh>
      <mesh position={[0, keepHeight + 1.04, 0]} castShadow>
        <boxGeometry args={[keepWidth * 0.56, 0.28, keepDepth * 0.46]} />
        <meshStandardMaterial color={wallColor} roughness={0.84} />
      </mesh>

      {[-0.32, 0, 0.32].map((offset, index) => (
        <ArrowSlit key={`keep-front-slit-${index}`} position={[keepWidth * offset, 0.84, keepDepth / 2 + 0.02]} />
      ))}
      {[-0.24, 0.24].map((offset, index) => (
        <GothicWindow
          glow={index === 0}
          key={`keep-grand-window-${index}`}
          position={[keepWidth * offset, 1.22, keepDepth / 2 + 0.028]}
          scale={0.92}
        />
      ))}
      <RoseWindow glow={showSmoke} position={[0, 1.48, keepDepth / 2 + 0.032]} scale={0.82} />
      {[-0.28, 0.28].map((offset, index) => (
        <ArrowSlit key={`keep-back-slit-${index}`} position={[keepWidth * offset, 1.18, -keepDepth / 2 - 0.02]} rotation={Math.PI} />
      ))}
      {[-0.24, 0.24].map((offset, index) => (
        <ArrowSlit key={`keep-east-slit-${index}`} position={[keepWidth / 2 + 0.02, 0.98, keepDepth * offset]} rotation={Math.PI / 2} />
      ))}

      {[
        [-towerInsetX, 0.24, -towerInsetZ],
        [towerInsetX, 0.24, -towerInsetZ],
        [-towerInsetX, 0.24, towerInsetZ],
        [towerInsetX, 0.24, towerInsetZ]
      ].map((position, index) => (
        <CastleCornerTower
          bannerColor={bannerColor}
          height={towerHeight}
          key={`grand-keep-tower-${index}`}
          position={position as [number, number, number]}
          stone={stone}
        />
      ))}

      <mesh position={[0.36, keepHeight + 1.62, -0.05]} castShadow>
        <cylinderGeometry args={[0.24, 0.3, 1.78, 10]} />
        <meshStandardMaterial color={trimColor} roughness={0.82} />
      </mesh>
      <mesh position={[0.36, keepHeight + 2.66, -0.05]} castShadow>
        <coneGeometry args={[0.36, 0.88, 10]} />
        <meshStandardMaterial color={roofColor} roughness={0.76} />
      </mesh>
      <GothicWindow position={[0.36, keepHeight + 1.58, 0.21]} scale={0.74} />
      <RoofDormer glow position={[-0.34, keepHeight + 1.16, keepDepth * 0.18]} stone={stone} />
      <RoofDormer position={[0.28, keepHeight + 1.18, -keepDepth * 0.18]} rotation={Math.PI} stone={stone} />
      {showSmoke ? <SmokePlume position={[0.56, keepHeight + 2.86, -0.12]} /> : null}

      <KeepRoofCrown
        bannerColor={bannerColor}
        keepWidth={keepWidth}
        stone={stone}
      />
      <Banner color={bannerColor} position={[0.36, keepHeight + 3.06, -0.05]} />
      {showNorthBanner ? <Banner color={bannerColor} position={[-keepWidth / 2, 1.5, -keepDepth / 2]} /> : null}
      {showSouthBanner ? <Banner color={bannerColor} position={[keepWidth / 2, 1.5, keepDepth / 2]} /> : null}
    </group>
  );
}

function Lantern({
  position,
  color
}: {
  position: [number, number, number];
  color: string;
}) {
  return (
    <group position={position}>
      <mesh position={[0, 0.12, 0]}>
        <boxGeometry args={[0.05, 0.24, 0.05]} />
        <meshStandardMaterial color="#6d5840" />
      </mesh>
      <mesh position={[0, 0.28, 0]}>
        <sphereGeometry args={[0.08, 12, 12]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.75} />
      </mesh>
    </group>
  );
}

function WaterChannel({
  position,
  size,
  color,
  emissive
}: {
  position: [number, number, number];
  size: [number, number, number];
  color: string;
  emissive: string;
}) {
  const channelRef = useRef<Mesh>(null);

  useFrame((state) => {
    if (!channelRef.current) {
      return;
    }

    channelRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 2 + position[0]) * 0.02;
  });

  return (
    <mesh ref={channelRef} position={position}>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={0.35} />
    </mesh>
  );
}

function MoatRetainingWalls({
  stone = false
}: {
  stone?: boolean;
}) {
  const edgeColor = stone ? "#9ca3ad" : "#806346";
  const capColor = stone ? "#c0c5cc" : "#a4865c";

  return (
    <group>
      {[
        [0, 0.01, -2.98, 6.9, 0.18, 0.16],
        [0, 0.01, -4.1, 7.8, 0.18, 0.14],
        [0, 0.01, 2.98, 6.9, 0.18, 0.16],
        [0, 0.01, 4.1, 7.8, 0.18, 0.14],
        [-2.98, 0.01, 0, 0.16, 0.18, 5.9],
        [-4.1, 0.01, 0, 0.14, 0.18, 6.9],
        [2.98, 0.01, 0, 0.16, 0.18, 5.9],
        [4.1, 0.01, 0, 0.14, 0.18, 6.9]
      ].map((edge, index) => (
        <mesh key={`moat-retaining-edge-${index}`} position={[edge[0], edge[1], edge[2]] as [number, number, number]} receiveShadow>
          <boxGeometry args={[edge[3], edge[4], edge[5]] as [number, number, number]} />
          <meshStandardMaterial color={edgeColor} roughness={0.88} />
        </mesh>
      ))}
      {[
        [-2.98, 0.14, -2.98],
        [2.98, 0.14, -2.98],
        [-2.98, 0.14, 2.98],
        [2.98, 0.14, 2.98],
        [-4.1, 0.12, -4.1],
        [4.1, 0.12, -4.1],
        [-4.1, 0.12, 4.1],
        [4.1, 0.12, 4.1]
      ].map((position, index) => (
        <mesh key={`moat-corner-cap-${index}`} position={position as [number, number, number]} castShadow>
          <boxGeometry args={[0.38, 0.18, 0.38]} />
          <meshStandardMaterial color={capColor} roughness={0.84} />
        </mesh>
      ))}
    </group>
  );
}

function ReedCluster({
  position,
  color = "#6f8f54"
}: {
  position: [number, number, number];
  color?: string;
}) {
  return (
    <group position={position}>
      {[
        [-0.08, 0.12, -0.02, -0.12],
        [0, 0.14, 0.04, 0.06],
        [0.09, 0.11, -0.05, 0.16],
        [0.03, 0.16, 0.08, -0.04]
      ].map((reed, index) => (
        <mesh
          key={`reed-${index}`}
          position={[reed[0], reed[1], reed[2]]}
          rotation={[0, 0, reed[3]]}
        >
          <boxGeometry args={[0.03, 0.26, 0.03]} />
          <meshStandardMaterial color={color} />
        </mesh>
      ))}
    </group>
  );
}

function WaterLily({
  position
}: {
  position: [number, number, number];
}) {
  const ref = useRef<Group>(null);

  useFrame((state) => {
    if (!ref.current) {
      return;
    }

    ref.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 1.2 + position[0]) * 0.015;
    ref.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.35 + position[2]) * 0.14;
  });

  return (
    <group ref={ref} position={position}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <cylinderGeometry args={[0.16, 0.16, 0.03, 18]} />
        <meshStandardMaterial color="#5d8f53" />
      </mesh>
      <mesh position={[0.04, 0.06, 0]}>
        <sphereGeometry args={[0.04, 10, 10]} />
        <meshStandardMaterial color="#e8d8b7" emissive="#e8d8b7" emissiveIntensity={0.18} />
      </mesh>
    </group>
  );
}

function ShoreRipple({
  position,
  color
}: {
  position: [number, number, number];
  color: string;
}) {
  const ref = useRef<Mesh>(null);

  useFrame((state) => {
    if (!ref.current) {
      return;
    }

    const pulse = 1 + Math.sin(state.clock.elapsedTime * 1.8 + position[0] + position[2]) * 0.08;
    ref.current.scale.set(pulse, 1, pulse);
  });

  return (
    <mesh ref={ref} position={position} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.18, 0.28, 20]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.22} transparent opacity={0.28} />
    </mesh>
  );
}

function Cloud({
  position,
  scale = 1,
  speed = 0.08,
  color
}: {
  position: [number, number, number];
  scale?: number;
  speed?: number;
  color?: string;
}) {
  const ref = useRef<Group>(null);
  const initialX = position[0];

  useFrame((state) => {
    if (!ref.current) {
      return;
    }

    ref.current.position.x = initialX + Math.sin(state.clock.elapsedTime * speed) * 0.8;
  });

  return (
    <group ref={ref} position={position} scale={scale}>
      <mesh position={[-0.45, 0, 0]}>
        <sphereGeometry args={[0.34, 14, 14]} />
        <meshStandardMaterial color={color ?? "#f3f6fb"} />
      </mesh>
      <mesh position={[0, 0.06, 0.08]}>
        <sphereGeometry args={[0.44, 14, 14]} />
        <meshStandardMaterial color={color ?? "#f8fbff"} />
      </mesh>
      <mesh position={[0.42, 0, -0.02]}>
        <sphereGeometry args={[0.28, 14, 14]} />
        <meshStandardMaterial color={color ?? "#eef4fa"} />
      </mesh>
    </group>
  );
}

function BirdFlock({
  position,
  scale = 1,
  color
}: {
  position: [number, number, number];
  scale?: number;
  color: string;
}) {
  const ref = useRef<Group>(null);

  useFrame((state) => {
    if (!ref.current) {
      return;
    }

    ref.current.position.x = position[0] + Math.sin(state.clock.elapsedTime * 0.22) * 2.1;
    ref.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 0.45) * 0.18;
    ref.current.rotation.z = Math.sin(state.clock.elapsedTime * 1.4) * 0.08;
  });

  return (
    <group ref={ref} position={position} scale={scale}>
      {[
        [-0.4, 0.08, 0],
        [0, 0, 0.16],
        [0.38, 0.1, -0.04]
      ].map((bird, index) => (
        <group
          key={`bird-${index}`}
          position={bird as [number, number, number]}
          rotation={[0, 0, index === 1 ? 0.08 : -0.1]}
        >
          <mesh>
            <boxGeometry args={[0.22, 0.03, 0.04]} />
            <meshStandardMaterial color={color} />
          </mesh>
          <mesh position={[0.09, 0, 0]} rotation={[0, 0, 0.46]}>
            <boxGeometry args={[0.12, 0.02, 0.04]} />
            <meshStandardMaterial color={color} />
          </mesh>
          <mesh position={[-0.09, 0, 0]} rotation={[0, 0, -0.46]}>
            <boxGeometry args={[0.12, 0.02, 0.04]} />
            <meshStandardMaterial color={color} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function GoldenHourSky({
  sunColor,
  cloudColor
}: {
  sunColor: string;
  cloudColor: string;
}) {
  const haloRef = useRef<Group>(null);

  useFrame((state) => {
    if (!haloRef.current) {
      return;
    }

    haloRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.18) * 0.045;
  });

  return (
    <group ref={haloRef}>
      <mesh position={[5.8, 7.8, -7.2]}>
        <sphereGeometry args={[0.7, 20, 20]} />
        <meshStandardMaterial color={sunColor} emissive={sunColor} emissiveIntensity={0.36} />
      </mesh>
      <mesh position={[5.8, 7.8, -7.24]}>
        <ringGeometry args={[0.9, 1.55, 40]} />
        <meshBasicMaterial color={sunColor} depthWrite={false} opacity={0.22} side={DoubleSide} transparent />
      </mesh>
      {[
        [3.9, 5.75, -5.75, 5.8, 0.82, -0.3],
        [2.4, 4.8, -4.65, 4.6, 0.58, -0.14],
        [5.7, 5.05, -5.2, 4.2, 0.48, -0.5]
      ].map((shaft, index) => (
        <mesh
          key={`sun-shaft-${index}`}
          position={[shaft[0], shaft[1], shaft[2]] as [number, number, number]}
          rotation={[0.18, -0.42, shaft[5]]}
        >
          <planeGeometry args={[shaft[3], shaft[4]] as [number, number]} />
          <meshBasicMaterial color={sunColor} depthWrite={false} opacity={0.1 + index * 0.035} side={DoubleSide} transparent />
        </mesh>
      ))}
      {[
        [-2.2, 2.02, -5.9, 7.4, 0.34, 0.1],
        [2.1, 2.42, -5.3, 6.2, 0.28, -0.08],
        [0.3, 1.42, -3.9, 8.8, 0.4, 0.02]
      ].map((band, index) => (
        <mesh
          key={`vista-haze-band-${index}`}
          position={[band[0], band[1], band[2]] as [number, number, number]}
          rotation={[0.06, 0, band[5]]}
        >
          <planeGeometry args={[band[3], band[4]] as [number, number]} />
          <meshBasicMaterial color={cloudColor} depthWrite={false} opacity={0.12 - index * 0.015} side={DoubleSide} transparent />
        </mesh>
      ))}
    </group>
  );
}

function SmokePlume({
  position
}: {
  position: [number, number, number];
}) {
  const plumeRef = useRef<Group>(null);

  useFrame((state) => {
    if (!plumeRef.current) {
      return;
    }

    plumeRef.current.children.forEach((child, index) => {
      child.position.y = 0.12 + index * 0.2 + Math.sin(state.clock.elapsedTime * 1.1 + index) * 0.03;
      child.position.x = Math.sin(state.clock.elapsedTime * 0.9 + index * 1.8) * 0.08;
      child.position.z = Math.cos(state.clock.elapsedTime * 0.7 + index) * 0.04;
      child.scale.setScalar(0.9 + index * 0.16 + Math.sin(state.clock.elapsedTime * 0.6 + index) * 0.05);
    });
  });

  return (
    <group ref={plumeRef} position={position}>
      {[0, 1, 2].map((index) => (
        <mesh key={`smoke-${index}`} position={[0, index * 0.2, 0]}>
          <sphereGeometry args={[0.11 + index * 0.02, 10, 10]} />
          <meshStandardMaterial
            color="#d9d8d3"
            transparent
            opacity={0.5 - index * 0.1}
          />
        </mesh>
      ))}
    </group>
  );
}

function MountainRange({
  position,
  color,
  scale = 1
}: {
  position: [number, number, number];
  color: string;
  scale?: number;
}) {
  return (
    <group position={position} scale={scale}>
      {[
        [-3.2, 0, 0.2, 1.8, 3.2],
        [-1.3, 0.2, -0.1, 1.2, 2.4],
        [0.4, -0.08, 0.1, 1.6, 2.9],
        [2.5, 0.1, -0.2, 1.3, 2.2]
      ].map((ridge, index) => (
        <mesh
          key={`ridge-${index}`}
          position={[ridge[0], ridge[1], ridge[2]]}
          rotation={[0, 0, 0]}
        >
          <coneGeometry args={[ridge[3], ridge[4], 4]} />
          <meshStandardMaterial color={color} />
        </mesh>
      ))}
    </group>
  );
}

function Boat({
  position,
  color
}: {
  position: [number, number, number];
  color: string;
}) {
  const ref = useRef<Group>(null);

  useFrame((state) => {
    if (!ref.current) {
      return;
    }

    ref.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 1.3 + position[0]) * 0.04;
    ref.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.8 + position[2]) * 0.08;
  });

  return (
    <group ref={ref} position={position}>
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.62, 0.08, 0.22]} />
        <meshStandardMaterial color="#78553a" />
      </mesh>
      <mesh position={[0, 0.1, 0]}>
        <boxGeometry args={[0.24, 0.1, 0.14]} />
        <meshStandardMaterial color={color} />
      </mesh>
    </group>
  );
}

function SupplyCart({
  start,
  end
}: {
  start: [number, number, number];
  end: [number, number, number];
}) {
  const ref = useRef<Group>(null);

  useFrame((state) => {
    if (!ref.current) {
      return;
    }

    const t = (Math.sin(state.clock.elapsedTime * 0.45) + 1) / 2;
    ref.current.position.x = start[0] + (end[0] - start[0]) * t;
    ref.current.position.y = start[1] + Math.sin(state.clock.elapsedTime * 1.8) * 0.03;
    ref.current.position.z = start[2] + (end[2] - start[2]) * t;
    ref.current.rotation.y = Math.atan2(end[0] - start[0], end[2] - start[2]);
  });

  return (
    <group ref={ref} position={start}>
      <mesh position={[0, 0.16, 0]}>
        <boxGeometry args={[0.42, 0.16, 0.28]} />
        <meshStandardMaterial color="#8b6541" />
      </mesh>
      <mesh position={[0, 0.32, 0]}>
        <boxGeometry args={[0.2, 0.12, 0.14]} />
        <meshStandardMaterial color="#c8b08a" />
      </mesh>
      {[
        [-0.14, 0.06, -0.12],
        [0.14, 0.06, -0.12],
        [-0.14, 0.06, 0.12],
        [0.14, 0.06, 0.12]
      ].map((wheel, index) => (
        <mesh key={`wheel-${index}`} position={wheel as [number, number, number]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.06, 0.06, 0.04, 12]} />
          <meshStandardMaterial color="#5c4330" />
        </mesh>
      ))}
    </group>
  );
}

function Farmstead({
  position,
  rotation = 0,
  cropColor
}: {
  position: [number, number, number];
  rotation?: number;
  cropColor: string;
}) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh position={[0, 0.02, 0]}>
        <boxGeometry args={[1.4, 0.04, 0.92]} />
        <meshStandardMaterial color="#7d623f" />
      </mesh>
      {[-0.36, -0.12, 0.12, 0.36].map((row, index) => (
        <mesh key={`crop-row-${index}`} position={[row, 0.08, 0]}>
          <boxGeometry args={[0.12, 0.08, 0.82]} />
          <meshStandardMaterial color={cropColor} />
        </mesh>
      ))}
      <mesh position={[0.56, 0.18, -0.24]}>
        <boxGeometry args={[0.24, 0.22, 0.18]} />
        <meshStandardMaterial color="#a7774c" />
      </mesh>
      <mesh position={[0.56, 0.34, -0.24]} rotation={[0, 0.785, 0]}>
        <coneGeometry args={[0.18, 0.14, 4]} />
        <meshStandardMaterial color="#caa85c" />
      </mesh>
    </group>
  );
}

function BlueprintMarker({
  position,
  size,
  color = "#89b8d9"
}: {
  position: [number, number, number];
  size: [number, number, number];
  color?: string;
}) {
  return (
    <group position={position}>
      <mesh position={[0, size[1] / 2, 0]}>
        <boxGeometry args={size} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.22}
          transparent
          opacity={0.22}
        />
      </mesh>
      <mesh position={[0, 0.02, 0]}>
        <boxGeometry args={[size[0] + 0.08, 0.04, size[2] + 0.08]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.3}
          transparent
          opacity={0.35}
        />
      </mesh>
    </group>
  );
}

function ConstructionScaffold({
  position,
  size,
  color = "#c9ae72",
  tier = "settling",
  rotation = 0
}: {
  position: [number, number, number];
  size: [number, number, number];
  color?: string;
  tier?: "settling" | "building" | "surging";
  rotation?: number;
}) {
  const poleColor = "#74583b";
  const plankColor = "#9a7750";
  const lanternGlow = tier === "surging" ? 0.92 : tier === "building" ? 0.74 : 0.6;
  const halfX = size[0] / 2 + 0.1;
  const halfZ = size[2] / 2 + 0.1;
  const topY = Math.max(0.56, size[1] + 0.28);
  const midY = Math.max(0.3, size[1] * 0.55);

  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {[
        [-halfX, topY / 2, -halfZ],
        [halfX, topY / 2, -halfZ],
        [-halfX, topY / 2, halfZ],
        [halfX, topY / 2, halfZ]
      ].map((pole, index) => (
        <mesh key={`scaffold-pole-${index}`} position={pole as [number, number, number]}>
          <boxGeometry args={[0.06, topY, 0.06]} />
          <meshStandardMaterial color={poleColor} />
        </mesh>
      ))}
      <mesh position={[0, midY, -halfZ]}>
        <boxGeometry args={[size[0] + 0.24, 0.05, 0.12]} />
        <meshStandardMaterial color={plankColor} />
      </mesh>
      <mesh position={[0, midY, halfZ]}>
        <boxGeometry args={[size[0] + 0.24, 0.05, 0.12]} />
        <meshStandardMaterial color={plankColor} />
      </mesh>
      <mesh position={[-halfX, midY, 0]}>
        <boxGeometry args={[0.12, 0.05, size[2] + 0.24]} />
        <meshStandardMaterial color={plankColor} />
      </mesh>
      <mesh position={[halfX, midY, 0]}>
        <boxGeometry args={[0.12, 0.05, size[2] + 0.24]} />
        <meshStandardMaterial color={plankColor} />
      </mesh>
      <mesh position={[0, topY, 0]}>
        <boxGeometry args={[size[0] + 0.28, 0.05, 0.14]} />
        <meshStandardMaterial color={plankColor} />
      </mesh>
      <mesh position={[-halfX - 0.16, 0.18, halfZ + 0.12]}>
        <boxGeometry args={[0.22, 0.22, 0.22]} />
        <meshStandardMaterial color="#866443" />
      </mesh>
      <mesh position={[-halfX + 0.04, 0.16, halfZ + 0.32]}>
        <cylinderGeometry args={[0.09, 0.09, 0.2, 12]} />
        <meshStandardMaterial color="#745339" />
      </mesh>
      <mesh position={[halfX + 0.18, 0.16, -halfZ - 0.14]} rotation={[0, 0.54, 0]}>
        <boxGeometry args={[0.34, 0.08, 0.08]} />
        <meshStandardMaterial color="#8f6a44" />
      </mesh>
      <mesh position={[halfX + 0.04, 0.36, -halfZ - 0.14]} rotation={[0, 0.54, 0]}>
        <boxGeometry args={[0.08, 0.36, 0.08]} />
        <meshStandardMaterial color="#7b5b3c" />
      </mesh>
      <mesh position={[halfX + 0.2, 0.36, -halfZ - 0.14]} rotation={[0, 0.54, 0]}>
        <boxGeometry args={[0.08, 0.36, 0.08]} />
        <meshStandardMaterial color="#7b5b3c" />
      </mesh>
      <mesh position={[0, topY + 0.18, 0]}>
        <boxGeometry args={[0.08, 0.32, 0.08]} />
        <meshStandardMaterial color="#6d5840" />
      </mesh>
      <mesh position={[0.16, topY + 0.08, 0]}>
        <boxGeometry args={[0.24, 0.14, 0.02]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.2} />
      </mesh>
      <mesh position={[-halfX, topY - 0.12, halfZ]}>
        <sphereGeometry args={[0.06, 10, 10]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={lanternGlow} />
      </mesh>
    </group>
  );
}

function ProjectBeacon({
  position,
  color = "#e1cf8b",
  tier = "settling"
}: {
  position: [number, number, number];
  color?: string;
  tier?: "settling" | "building" | "surging";
}) {
  const ref = useRef<Group>(null);
  const tierScale = tier === "surging" ? 1.32 : tier === "building" ? 1.14 : 1;

  useFrame((state) => {
    if (!ref.current) {
      return;
    }

    const pulse = 1 + Math.sin(state.clock.elapsedTime * 2.6) * (tier === "surging" ? 0.24 : tier === "building" ? 0.18 : 0.14);
    ref.current.children.forEach((child, index) => {
      if (index === 0) {
        child.scale.setScalar(pulse * tierScale);
        child.position.y = 0.02;
        return;
      }

      child.scale.setScalar((0.92 + pulse * 0.12 + index * 0.02) * tierScale);
      child.position.y = 0.28 + index * 0.22 + Math.sin(state.clock.elapsedTime * 1.5 + index) * 0.05;
    });
  });

  return (
    <group ref={ref} position={position}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[0.22, 0.34, 24]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={tier === "surging" ? 1.05 : tier === "building" ? 0.84 : 0.68} transparent opacity={0.84} />
      </mesh>
      {[0, 1, ...(tier === "surging" ? [2] : [])].map((index) => (
        <mesh key={`project-beacon-${index}`} position={[0, 0.28 + index * 0.22, 0]}>
          <sphereGeometry args={[0.12 - index * 0.02, 12, 12]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={tier === "surging" ? 1.2 : 1} transparent opacity={0.72 - index * 0.14} />
        </mesh>
      ))}
      {tier !== "settling" ? (
        <mesh position={[0, 0.38, 0]}>
          <cylinderGeometry args={[0.03, 0.06, tier === "surging" ? 1.6 : 1.1, 12]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.58} transparent opacity={tier === "surging" ? 0.32 : 0.22} />
        </mesh>
      ) : null}
    </group>
  );
}

function SignalFire({
  position,
  color = "#d96d42"
}: {
  position: [number, number, number];
  color?: string;
}) {
  const ref = useRef<Group>(null);

  useFrame((state) => {
    if (!ref.current) {
      return;
    }

    ref.current.children.forEach((child, index) => {
      child.scale.setScalar(0.88 + Math.sin(state.clock.elapsedTime * 3.2 + index) * 0.12);
      child.position.y = 0.1 + index * 0.08 + Math.sin(state.clock.elapsedTime * 1.8 + index) * 0.02;
    });
  });

  return (
    <group ref={ref} position={position}>
      <mesh position={[0, 0.02, 0]}>
        <cylinderGeometry args={[0.12, 0.16, 0.08, 8]} />
        <meshStandardMaterial color="#5c4330" />
      </mesh>
      {[0, 1].map((index) => (
        <mesh key={`flame-${index}`} position={[0, 0.12 + index * 0.08, 0]}>
          <sphereGeometry args={[0.09 - index * 0.02, 10, 10]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.95} />
        </mesh>
      ))}
    </group>
  );
}

function MistBank({
  position,
  scale = 1
}: {
  position: [number, number, number];
  scale?: number;
}) {
  const ref = useRef<Group>(null);

  useFrame((state) => {
    if (!ref.current) {
      return;
    }

    ref.current.position.x = position[0] + Math.sin(state.clock.elapsedTime * 0.38 + position[2]) * 0.22;
    ref.current.position.z = position[2] + Math.cos(state.clock.elapsedTime * 0.26 + position[0]) * 0.18;
  });

  return (
    <group ref={ref} position={position} scale={scale}>
      <mesh position={[-0.24, 0.08, 0]}>
        <sphereGeometry args={[0.22, 10, 10]} />
        <meshStandardMaterial color="#d8e4ea" transparent opacity={0.16} />
      </mesh>
      <mesh position={[0.1, 0.1, 0.04]}>
        <sphereGeometry args={[0.28, 10, 10]} />
        <meshStandardMaterial color="#e2ebef" transparent opacity={0.14} />
      </mesh>
    </group>
  );
}

function getDistrictTone(status: "active" | "planned" | "strained" | "quiet") {
  if (status === "active") {
    return {
      color: "#d8bf73",
      glow: "#e9d792"
    };
  }

  if (status === "strained") {
    return {
      color: "#aa6752",
      glow: "#c97a65"
    };
  }

  if (status === "quiet") {
    return {
      color: "#7da59b",
      glow: "#9bc0b7"
    };
  }

  return {
    color: "#7fa8c7",
    glow: "#93c2e6"
  };
}

function DistrictBeacon({
  position,
  status
}: {
  position: [number, number, number];
  status: "active" | "planned" | "strained" | "quiet";
}) {
  const tone = getDistrictTone(status);

  return (
    <group position={position}>
      <mesh position={[0, 0.08, 0]}>
        <cylinderGeometry args={[0.06, 0.08, 0.16, 8]} />
        <meshStandardMaterial color="#6b5940" />
      </mesh>
      <mesh position={[0, 0.26, 0]}>
        <sphereGeometry args={[0.11, 10, 10]} />
        <meshStandardMaterial
          color={tone.color}
          emissive={tone.glow}
          emissiveIntensity={status === "planned" ? 0.25 : 0.75}
          transparent
          opacity={status === "planned" ? 0.45 : 0.88}
        />
      </mesh>
    </group>
  );
}

function Tree({
  position,
  scale = 1
}: {
  position: [number, number, number];
  scale?: number;
}) {
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.18, 0]}>
        <cylinderGeometry args={[0.045, 0.06, 0.38, 6]} />
        <meshStandardMaterial color="#5f432b" roughness={0.88} />
      </mesh>
      {[
        [0.33, 0.42, "#14513f"],
        [0.26, 0.72, "#176347"],
        [0.18, 0.96, "#1f7650"]
      ].map((tier, index) => (
        <mesh key={`storybook-tree-tier-${index}`} position={[0, tier[1] as number, 0]} castShadow>
          <coneGeometry args={[tier[0] as number, 0.52 - index * 0.08, 7]} />
          <meshStandardMaterial color={tier[2] as string} roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

function CitizenMarker({
  citizen,
  districtStatus = "planned"
}: {
  citizen: Citizen;
  districtStatus?: "active" | "planned" | "strained" | "quiet";
}) {
  const ref = useRef<Mesh>(null);
  const color =
    citizen.type === "builder"
      ? "#e4ca73"
      : citizen.type === "rogue"
        ? "#b15c4d"
        : "#95b6aa";
  const tone = getDistrictTone(districtStatus);
  const basePosition: [number, number, number] = [citizen.x * 0.42, 0.28, citizen.z * 0.42];

  useFrame((state) => {
    if (!ref.current) {
      return;
    }

    ref.current.position.y = basePosition[1] + Math.sin(state.clock.elapsedTime * 2.4 + citizen.x) * 0.04;
  });

  return (
    <group position={basePosition}>
      <mesh position={[0, -0.08, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.09, 0.14, 18]} />
        <meshStandardMaterial
          color={tone.color}
          emissive={tone.glow}
          emissiveIntensity={districtStatus === "planned" ? 0.18 : 0.42}
          transparent
          opacity={0.72}
        />
      </mesh>
      <mesh ref={ref} position={[0, 0, 0]}>
        <sphereGeometry args={[0.12, 14, 14]} />
        <meshStandardMaterial color={color} />
      </mesh>
    </group>
  );
}

function WorldScene({
  snapshot,
  keepScale,
  islandDistrictCount,
  villageHouseCount,
  wallTowerCount,
  forestTreeCount,
  viewMode
}: WorldSceneProps) {
  const citizens = snapshot?.citizens ?? [];
  const isPlanView = viewMode === "plan";
  const mood = getSceneMood(snapshot?.currentCategory);
  const bannerColor = getBannerColor(snapshot?.currentCategory);
  const keepWidth = 1.6 + keepScale / 44;
  const keepHeight = 0.88 + keepScale / 62;
  const mountainColor = snapshot?.currentCategory === "play" ? "#875e58" : "#7b8fa0";
  const birdColor = snapshot?.currentCategory === "play" ? "#5d3630" : "#4e5a62";
  const cropColor = snapshot?.currentCategory === "play" ? "#b49a56" : "#8faa53";
  const awningColor = snapshot?.currentCategory === "play" ? "#a66759" : "#a9c7d8";
  const unlockedStructures = new Set(snapshot?.unlockedStructures ?? []);
  const hasMarketStall = unlockedStructures.has("Market stall");
  const hasWorkshop = unlockedStructures.has("Workshop frame");
  const hasHarborSkiff = unlockedStructures.has("Harbor skiff");
  const hasFarmPlots = unlockedStructures.has("Farm plots");
  const hasWatchPost = unlockedStructures.has("Watch post");
  const hasStoneWorkshop = unlockedStructures.has("Stone workshop");
  const hasGatehouse = unlockedStructures.has("Gatehouse");
  const hasStoneWalls = unlockedStructures.has("Stone walls");
  const alerts = snapshot?.alerts ?? [];
  const hasRoguePressure = alerts.some((alert) => alert.code === "rogue-pressure");
  const hasQuietRing = alerts.some((alert) => alert.code === "quiet-ring");
  const hasProjectSurge = alerts.some((alert) => alert.code === "project-nearly-ready");
  const sceneProjectFocus: WorldFocus | null = snapshot?.worldFocus ?? null;
  const streakTier = snapshot?.currentStreakTier ?? "settling";
  const streakMinutes = snapshot?.currentStreakMinutes ?? 0;
  const nextUnlockName = snapshot?.nextUnlock ?? "";
  const nextUnlockProgress = snapshot?.nextUnlockProgress ?? 0;
  const focusIsUnderConstruction =
    Boolean(sceneProjectFocus) &&
    nextUnlockProgress < 100 &&
    (snapshot?.currentCategory === "work" || nextUnlockProgress >= 70);
  const activeBlueprints = new Set(
    (snapshot?.unlockRoadmap ?? [])
      .filter((item) => item.status !== "unlocked")
      .map((item) => item.name)
  );
  const districtsById = new Map((snapshot?.districts ?? []).map((district) => [district.id, district]));
  const bridgeColor = hasStoneWalls ? "#87817b" : "#8a7354";
  const fenceColor = hasStoneWalls ? "#847a70" : "#7a5d3f";
  const builderCount = citizens.filter((citizen) => citizen.type === "builder").length;
  const drifterCount = citizens.filter((citizen) => citizen.type === "drifter").length;
  const rogueCount = citizens.filter((citizen) => citizen.type === "rogue").length;
  const visibleCitizens =
    isPlanView
      ? citizens
      : citizens.filter((citizen) => citizen.type !== "drifter").slice(0, 4);
  const citizenMarkers =
    visibleCitizens.length > 0 ? visibleCitizens : citizens.slice(0, Math.min(3, citizens.length));
  const districtPads = [
    { id: "commons-green", position: [-1.55, 0.12, -1.15] as [number, number, number] },
    { id: "watch-ridge", position: [1.5, 0.12, -1.2] as [number, number, number] },
    { id: "artisans-ward", position: [-1.35, 0.12, 1.2] as [number, number, number] },
    { id: "chapel-rise", position: [1.55, 0.12, 1.15] as [number, number, number] }
  ] as const;
  const villageHouses = [
    [5.1, 0.08, -2.9],
    [5.45, 0.08, -1.5],
    [5.7, 0.08, 0.1],
    [5.15, 0.08, 1.5],
    [4.25, 0.08, -2.15],
    [4.05, 0.08, 2.35]
  ] as const;
  const visibleVillageHouses = isPlanView
    ? villageHouses.slice(0, villageHouseCount)
    : villageHouses.slice(0, Math.min(villageHouseCount, 4));
  const forestTrees = [
    [-5.8, 0.04, -4],
    [-4.8, 0.04, -2.7],
    [-3.6, 0.04, -4.8],
    [0.4, 0.04, -5.4],
    [2.4, 0.04, -4.9],
    [5.2, 0.04, -4],
    [-5.9, 0.04, 1.9],
    [-5.1, 0.04, 3.8],
    [5.9, 0.04, 2.9],
    [4.6, 0.04, 4.5],
    [0.5, 0.04, 5.3],
    [-2.1, 0.04, 5.4]
  ] as const;
  return (
    <>
      <color attach="background" args={[mood.background]} />
      <fog attach="fog" args={[mood.fog, 16, 26]} />
      <ambientLight intensity={0.46} />
      <hemisphereLight color={mood.cloudColor} groundColor="#2f3a27" intensity={0.62} />
      <directionalLight
        castShadow
        color={mood.sunlight}
        intensity={2.6}
        position={[8, 12, 6]}
        shadow-bias={-0.0005}
        shadow-mapSize-height={2048}
        shadow-mapSize-width={2048}
      />
      <directionalLight intensity={0.64} position={[-6, 8, -4]} color="#c5e4ff" />
      <pointLight color={bannerColor} distance={7.5} intensity={0.82} position={[-0.7, 2.2, 0.9]} />
      {viewMode === "rampart" ? (
        <>
          <MountainRange color={mountainColor} position={[-5.8, 1.2, -15]} scale={1.14} />
          <MountainRange color={mountainColor} position={[4.8, 1.5, -13.8]} scale={0.92} />
          <Cloud color={mood.cloudColor} position={[-4.4, 7.2, -6]} scale={1.25} speed={0.2} />
          <Cloud color={mood.cloudColor} position={[2.6, 6.4, -4]} scale={0.92} speed={0.14} />
          <BirdFlock color={birdColor} position={[-1.8, 6.1, -5.2]} scale={1.05} />
          <GoldenHourSky cloudColor={mood.cloudColor} sunColor={mood.sunColor} />
        </>
      ) : null}

      <group position={[0, -0.35, 0]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
          <planeGeometry args={[20, 20]} />
          <meshStandardMaterial color={mood.outerLand} />
        </mesh>

        <FloatingDioramaCliffs active={snapshot?.currentCategory === "work"} />
        <mesh position={[0, 0.08, 0]}>
          <boxGeometry args={[14.2, 0.18, 14.2]} />
          <meshStandardMaterial color={mood.outerLand} />
        </mesh>
        <DioramaTerrainPatches active={snapshot?.currentCategory === "work"} />
        <RockCluster position={[-5.42, 0.07, -3.28]} scale={0.86} />
        <RockCluster position={[4.84, 0.07, 3.74]} scale={0.72} />
        <RockCluster position={[5.48, 0.07, -5.28]} scale={0.82} />
        {viewMode === "rampart" ? <RampartCorner bannerColor={bannerColor} stone={hasStoneWalls} /> : null}

        <Path color={mood.path} position={[-2.55, 0.12, 2.65]} rotation={0.82} size={[0.58, 0.08, 5.9]} />
        <Path color={mood.path} position={[3.1, 0.12, 0]} size={[5.2, 0.08, 0.56]} />
        <Path color={mood.path} position={[0.2, 0.12, 0]} size={[2.1, 0.08, 0.54]} />
        <Path color={mood.path} position={[4.18, 0.11, -2.62]} rotation={0.38} size={[2.46, 0.06, 0.3]} />
        {isPlanView ? <Path color={mood.path} position={[3.76, 0.11, 2.76]} rotation={-0.42} size={[1.92, 0.06, 0.28]} /> : null}
        <Path color={mood.path} position={[-3.82, 0.11, 2.18]} rotation={-0.38} size={[1.84, 0.06, 0.28]} />
        <ServiceYard
          active={nextUnlockName === "Workshop frame" || nextUnlockName === "Stone workshop"}
          bannerColor={bannerColor}
          stone={hasStoneWorkshop}
        />
        <EntryDistrictBlock bannerColor={bannerColor} pathColor={mood.path} stone={hasStoneWalls} />
        <EntryDistrictBacklot bannerColor={bannerColor} stone={hasStoneWalls} />
        <GateForecourt bannerColor={bannerColor} stone={hasStoneWalls} />
        <RoadGuidePosts
          color={fenceColor}
          lanternColor={viewMode === "rampart" ? bannerColor : undefined}
          positions={[
            [1.84, 0.06, -0.52],
            [1.84, 0.06, 0.52],
            [3.72, 0.06, -0.52],
            [3.72, 0.06, 0.52],
            [5.28, 0.06, -0.52],
            [5.28, 0.06, 0.52]
          ]}
        />
        <RoadGuidePosts
          color={fenceColor}
          positions={[
            [-1.84, 0.06, 1.92],
            [-2.38, 0.06, 2.56],
            [-2.94, 0.06, 3.18]
          ]}
        />

        <DistantCurtainWalls bannerColor={bannerColor} stone={hasStoneWalls} towerCount={wallTowerCount} />
        {hasRoguePressure ? <SignalFire position={[-5.55, 0.18, -2.1]} /> : null}
        {hasRoguePressure ? <SignalFire position={[-5.65, 0.18, 2.4]} color="#b95a43" /> : null}

        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[5.05, 0.02, -3.95]}>
          <cylinderGeometry args={[0.72, 0.72, 0.05, 32]} />
          <meshStandardMaterial color="#4e88ab" />
        </mesh>
        {isPlanView ? (
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[5.2, 0.02, 3.95]}>
            <cylinderGeometry args={[0.92, 0.92, 0.05, 32]} />
            <meshStandardMaterial color="#4e88ab" />
          </mesh>
        ) : null}
        {hasHarborSkiff ? <Boat color={awningColor} position={[5.05, 0.08, -3.92]} /> : null}
        {isPlanView && hasHarborSkiff && villageHouseCount >= 3 ? (
          <Boat color={awningColor} position={[5.16, 0.08, 3.88]} />
        ) : null}

        <mesh position={[0, -0.42, 0]}>
          <boxGeometry args={[9.2, 0.8, 9.2]} />
          <meshStandardMaterial color="#6c553b" />
        </mesh>

        <mesh position={[0, 0.08, 0]}>
          <boxGeometry args={[6.4, 0.18, 6.4]} />
          <meshStandardMaterial color={mood.innerLand} />
        </mesh>
        <IslandCliffRing stone={hasStoneWalls || hasStoneWorkshop} />
        <TerraceRing stone={hasStoneWalls} />
        <WardGateway bannerColor={bannerColor} position={[0, 0.44, -2.76]} stone={hasStoneWalls || hasStoneWorkshop} />
        <WardGateway bannerColor={bannerColor} position={[0, 0.44, 2.76]} rotation={Math.PI} stone={hasStoneWalls || hasStoneWorkshop} />
        <WardGateway bannerColor={bannerColor} position={[-2.76, 0.44, 0]} rotation={-Math.PI / 2} stone={hasStoneWalls || hasStoneWorkshop} />
        <WardGateway bannerColor={bannerColor} position={[2.76, 0.44, 0]} rotation={Math.PI / 2} stone={hasStoneWalls || hasStoneWorkshop} />
        <CourtyardPavers stone={hasStoneWalls || hasStoneWorkshop} />
        <InnerWardPaths bannerColor={bannerColor} stone={hasStoneWalls || hasStoneWorkshop} />

        <WaterChannel color={mood.water} emissive={mood.waterEmissive} position={[0, -0.18, -3.55]} size={[7.4, 0.26, 1.1]} />
        <WaterChannel color={mood.water} emissive={mood.waterEmissive} position={[0, -0.18, 3.55]} size={[7.4, 0.26, 1.1]} />
        <WaterChannel color={mood.water} emissive={mood.waterEmissive} position={[-3.55, -0.18, 0]} size={[1.1, 0.26, 6.4]} />
        <WaterChannel color={mood.water} emissive={mood.waterEmissive} position={[3.55, -0.18, 0]} size={[1.1, 0.26, 6.4]} />
        <MoatRetainingWalls stone={hasStoneWalls || hasStoneWorkshop} />
        {[
          [-1.85, -0.04, -3.62],
          [0.25, -0.04, -3.62],
          [1.96, -0.04, -3.62],
          [-1.72, -0.04, 3.62],
          [0.52, -0.04, 3.62],
          [2.1, -0.04, 3.62],
          [-3.62, -0.04, -1.45],
          [-3.62, -0.04, 0.68],
          [3.62, -0.04, -0.9],
          [3.62, -0.04, 1.38]
        ].map((position, index) => (
          <ShoreRipple
            color={mood.cloudColor}
            key={`shore-ripple-${index}`}
            position={position as [number, number, number]}
          />
        ))}
        {[
          [-2.62, 0.02, -3.18],
          [1.8, 0.02, -3.22],
          [-2.48, 0.02, 3.16],
          [1.96, 0.02, 3.18],
          [-3.2, 0.02, -1.54],
          [3.18, 0.02, 1.42]
        ].map((position, index) => (
          <ReedCluster key={`reed-cluster-${index}`} position={position as [number, number, number]} />
        ))}
        <WaterLily position={[1.12, -0.03, -3.68]} />
        <WaterLily position={[-1.26, -0.03, 3.66]} />
        {hasQuietRing ? <MistBank position={[0.4, -0.04, 3.55]} scale={1.1} /> : null}
        {hasQuietRing ? <MistBank position={[-3.35, -0.04, -0.25]} scale={0.92} /> : null}
        <EmbankmentMounds
          color={mood.outerLand}
          positions={[
            [4.34, -0.02, -3.1],
            [4.68, -0.01, -2.34],
            [4.2, -0.02, 2.48],
            [4.64, -0.01, 3.18],
            [-3.28, -0.02, 4.14],
            [-2.1, -0.01, 4.58]
          ]}
        />
        <Hedgerow color="#61824b" length={1.46} position={[4.18, 0.08, -3.88]} rotation={0.12} />
        <Hedgerow color="#64854d" length={1.02} position={[3.64, 0.08, -4.54]} rotation={0.54} />
        {isPlanView ? <Hedgerow color="#64854d" length={1.14} position={[3.42, 0.08, 4.26]} rotation={-0.34} /> : null}
        <OrchardTree position={[3.32, 0.08, -3.18]} scale={0.9} />
        <OrchardTree position={[3.86, 0.08, -2.58]} scale={0.82} />
        {isPlanView ? <OrchardTree position={[3.08, 0.08, 3.62]} scale={0.84} /> : null}

        <mesh position={[0, -0.02, -2.92]}>
          <boxGeometry args={[7.4, 0.16, 0.26]} />
          <meshStandardMaterial color={bridgeColor} />
        </mesh>
        <mesh position={[0, -0.02, 2.92]}>
          <boxGeometry args={[7.4, 0.16, 0.26]} />
          <meshStandardMaterial color={bridgeColor} />
        </mesh>
        <mesh position={[-2.92, -0.02, 0]}>
          <boxGeometry args={[0.26, 0.16, 6.4]} />
          <meshStandardMaterial color={bridgeColor} />
        </mesh>
        <mesh position={[2.92, -0.02, 0]}>
          <boxGeometry args={[0.26, 0.16, 6.4]} />
          <meshStandardMaterial color={bridgeColor} />
        </mesh>
        <BridgeDetails bridgeColor={bridgeColor} stone={hasStoneWalls} />
        <BridgeDeckDetails bannerColor={bannerColor} stone={hasStoneWalls} />
        <BridgeAbutments stone={hasStoneWalls} />
        <HarborJetty position={[5.72, 0.06, -3.94]} rotation={Math.PI / 2} stone={hasStoneWalls} />
        {isPlanView ? <HarborJetty position={[5.86, 0.06, 3.9]} rotation={Math.PI / 2} stone={hasStoneWalls} /> : null}
        <QuaySteps position={[4.82, 0.02, -3.34]} rotation={Math.PI / 2} stone={hasStoneWalls} />
        {isPlanView ? <QuaySteps position={[4.96, 0.02, 3.34]} rotation={-Math.PI / 2} stone={hasStoneWalls} /> : null}

        <mesh position={[-3.6, 0.12, 0]}>
          <boxGeometry args={[1.38, 0.18, 0.68]} />
          <meshStandardMaterial color="#936c45" />
        </mesh>
        <mesh position={[3.6, 0.12, 0]}>
          <boxGeometry args={[1.38, 0.18, 0.68]} />
          <meshStandardMaterial color="#936c45" />
        </mesh>

        {hasGatehouse && wallTowerCount >= 2 ? (
          <Gatehouse
            bannerColor={bannerColor}
            position={[5.88, 0.15, 0]}
            rotation={Math.PI / 2}
            stone={hasStoneWalls}
          />
        ) : null}
        {!hasGatehouse && activeBlueprints.has("Gatehouse") ? (
          <BlueprintMarker position={[5.88, 0.14, 0]} size={[0.66, 1.3, 1.06]} color={hasProjectSurge ? "#e1cf8b" : "#89b8d9"} />
        ) : null}
        {focusIsUnderConstruction && nextUnlockName === "Gatehouse" ? (
          <ConstructionScaffold
            color={sceneProjectFocus?.color}
            position={[5.88, 0.14, 0]}
            rotation={Math.PI / 2}
            size={[0.88, 1.34, 1.18]}
            tier={streakTier}
          />
        ) : null}
        {villageHouseCount >= 2 ? (
          <VillageCommons
            active={hasMarketStall || nextUnlockName === "Market stall"}
            bannerColor={bannerColor}
            stone={hasStoneWalls}
          />
        ) : null}
        <Lantern color={bannerColor} position={[5.42, 0.18, -0.42]} />
        <Lantern color={bannerColor} position={[5.42, 0.18, 0.42]} />

        {districtPads.slice(0, islandDistrictCount).map((district, index) => {
          const districtState = districtsById.get(district.id);
          const tone = getDistrictTone(districtState?.status ?? "planned");

          return (
            <group key={`district-${index}`} position={district.position}>
              <mesh>
                <boxGeometry args={[1.72, 0.12, 1.34]} />
                <meshStandardMaterial
                  color={districtState ? tone.color : "#9e9179"}
                  emissive={districtState ? tone.glow : "#000000"}
                  emissiveIntensity={districtState && districtState.status !== "planned" ? 0.12 : 0.04}
                />
              </mesh>
              {districtState ? (
                <DistrictBeacon position={[0, 0.08, 0]} status={districtState.status} />
              ) : null}
            </group>
          );
        })}

        {hasWorkshop ? <Workshop position={[-1.48, 0.22, 1.16]} stone={hasStoneWorkshop} /> : null}
        {!hasWorkshop && activeBlueprints.has("Workshop frame") ? (
          <BlueprintMarker position={[-1.48, 0.18, 1.16]} size={[0.72, 0.82, 0.5]} color={hasProjectSurge ? "#e1cf8b" : "#89b8d9"} />
        ) : null}
        {focusIsUnderConstruction &&
        (nextUnlockName === "Workshop frame" || nextUnlockName === "Stone workshop") ? (
          <ConstructionScaffold
            color={sceneProjectFocus?.color}
            position={[-1.48, 0.18, 1.16]}
            size={nextUnlockName === "Stone workshop" ? [0.84, 0.94, 0.64] : [0.82, 0.86, 0.58]}
            tier={streakTier}
          />
        ) : null}
        {hasWorkshop ? <SmokePlume position={[-1.18, 0.72, 1.16]} /> : null}
        {islandDistrictCount >= 2 ? <ShrineGarden bannerColor={bannerColor} stone={hasStoneWalls || hasStoneWorkshop} /> : null}
        {islandDistrictCount >= 2 ? <Shrine bannerColor={bannerColor} position={[1.46, 0.18, 1.2]} /> : null}
        {islandDistrictCount >= 3 ? <WatchRidgePlatform bannerColor={bannerColor} stone={hasStoneWalls} /> : null}
        {hasWatchPost && islandDistrictCount >= 3 ? <WatchTower position={[1.62, 0.22, -1.28]} stone={hasStoneWalls} /> : null}
        {!hasWatchPost && activeBlueprints.has("Watch post") && islandDistrictCount >= 3 ? (
          <BlueprintMarker position={[1.62, 0.2, -1.28]} size={[0.42, 1.18, 0.42]} color={hasProjectSurge ? "#e1cf8b" : "#89b8d9"} />
        ) : null}
        {focusIsUnderConstruction && nextUnlockName === "Watch post" ? (
          <ConstructionScaffold
            color={sceneProjectFocus?.color}
            position={[1.62, 0.2, -1.28]}
            size={[0.54, 1.18, 0.54]}
            tier={streakTier}
          />
        ) : null}
        {islandDistrictCount >= 3 ? (
          <>
            <mesh position={[0, 0.34, -1.88]}>
              <boxGeometry args={[3.8, 0.34, 0.18]} />
              <meshStandardMaterial color="#8b7658" />
            </mesh>
            <mesh position={[0, 0.34, 1.88]}>
              <boxGeometry args={[3.8, 0.34, 0.18]} />
              <meshStandardMaterial color="#8b7658" />
            </mesh>
            <mesh position={[-1.88, 0.34, 0]}>
              <boxGeometry args={[0.18, 0.34, 3.8]} />
              <meshStandardMaterial color="#8b7658" />
            </mesh>
            <mesh position={[1.88, 0.34, 0]}>
              <boxGeometry args={[0.18, 0.34, 3.8]} />
              <meshStandardMaterial color="#8b7658" />
            </mesh>
          </>
        ) : null}
        {hasMarketStall && villageHouseCount >= 2 ? <MarketStall color={bannerColor} position={[3.65, 0.2, 0.52]} /> : null}
        {hasMarketStall && villageHouseCount >= 4 ? <MarketStall color={awningColor} position={[3.08, 0.2, 0.06]} /> : null}
        {!hasMarketStall && activeBlueprints.has("Market stall") && villageHouseCount >= 2 ? (
          <BlueprintMarker position={[3.65, 0.16, 0.52]} size={[0.72, 0.46, 0.48]} color={hasProjectSurge ? "#e1cf8b" : "#89b8d9"} />
        ) : null}
        {focusIsUnderConstruction && nextUnlockName === "Market stall" ? (
          <ConstructionScaffold
            color={sceneProjectFocus?.color}
            position={[3.65, 0.16, 0.52]}
            size={[0.88, 0.52, 0.62]}
            tier={streakTier}
          />
        ) : null}
        {villageHouseCount >= 2 ? <VillageFence color={fenceColor} depth={1.22} position={[3.72, 0.06, 0.46]} width={1.58} /> : null}
        {villageHouseCount >= 2 ? <Lantern color={bannerColor} position={[3.2, 0.18, 0.9]} /> : null}
        {villageHouseCount >= 3 ? <House position={[4.5, 0.08, 0.86]} scale={0.74} /> : null}
        {isPlanView && villageHouseCount >= 4 ? <Windmill position={[5.3, 0.08, -2.15]} /> : null}
        {isPlanView && villageHouseCount >= 3 ? <SmokePlume position={[4.24, 0.52, 2.78]} /> : null}
        {hasFarmPlots && villageHouseCount >= 3 ? <Farmstead cropColor={cropColor} position={[4.75, 0.06, -4.9]} rotation={0.08} /> : null}
        {isPlanView && hasFarmPlots && villageHouseCount >= 5 ? (
          <Farmstead cropColor={cropColor} position={[4.15, 0.06, 4.95]} rotation={-0.08} />
        ) : null}
        {hasFarmPlots && villageHouseCount >= 3 ? <HayStack position={[3.96, 0.08, -4.32]} scale={0.92} /> : null}
        {isPlanView && hasFarmPlots && villageHouseCount >= 5 ? <HayStack position={[3.46, 0.08, 4.28]} scale={0.86} /> : null}
        {hasFarmPlots && villageHouseCount >= 3 ? (
          <VillageFence color={fenceColor} depth={1.18} position={[4.75, 0.06, -4.9]} rotation={0.08} width={1.72} />
        ) : null}
        {isPlanView && hasFarmPlots && villageHouseCount >= 5 ? (
          <VillageFence color={fenceColor} depth={1.18} position={[4.15, 0.06, 4.95]} rotation={-0.08} width={1.72} />
        ) : null}
        {!hasFarmPlots && activeBlueprints.has("Farm plots") && villageHouseCount >= 3 ? (
          <BlueprintMarker position={[4.75, 0.04, -4.9]} size={[1.5, 0.16, 1]} color={hasProjectSurge ? "#e1cf8b" : "#89b8d9"} />
        ) : null}
        {focusIsUnderConstruction && nextUnlockName === "Farm plots" ? (
          <ConstructionScaffold
            color={sceneProjectFocus?.color}
            position={[4.75, 0.04, -4.9]}
            size={[1.56, 0.36, 1.08]}
            tier={streakTier}
          />
        ) : null}
        {hasFarmPlots && builderCount >= 2 ? <SupplyCart start={[-2.3, 0.18, 2.25]} end={[4.9, 0.18, 0.35]} /> : null}
        {focusIsUnderConstruction && nextUnlockName === "Harbor skiff" ? (
          <ConstructionScaffold
            color={sceneProjectFocus?.color}
            position={[5.22, 0.08, -3.94]}
            rotation={Math.PI / 2}
            size={[0.72, 0.42, 0.42]}
            tier={streakTier}
          />
        ) : null}
        {focusIsUnderConstruction && nextUnlockName === "Stone walls" ? (
          <>
            <ConstructionScaffold
              color={sceneProjectFocus?.color}
              position={[6.08, 0.22, -1.28]}
              rotation={Math.PI / 2}
              size={[0.72, 1.12, 0.58]}
              tier={streakTier}
            />
            <ConstructionScaffold
              color={sceneProjectFocus?.color}
              position={[1.3, 0.22, -6.08]}
              size={[0.72, 1.12, 0.58]}
              tier={streakTier}
            />
          </>
        ) : null}
        {sceneProjectFocus ? (
          <ProjectBeacon
            color={sceneProjectFocus.color}
            position={sceneProjectFocus.worldPosition}
            tier={snapshot?.currentCategory === "work" ? streakTier : "settling"}
          />
        ) : null}
        {isPlanView && rogueCount > 0 ? (
          <mesh position={[1.45, 0.24, 1.72]} rotation={[0, rogueCount * 0.24, 0]}>
            <coneGeometry args={[0.22, 0.42, 4]} />
            <meshStandardMaterial color="#93483d" />
          </mesh>
        ) : null}
        {isPlanView && drifterCount > 0 ? (
          <mesh position={[2.2, 0.2, 2.55]}>
            <boxGeometry args={[0.34, 0.18, 0.34]} />
            <meshStandardMaterial color="#88998f" />
          </mesh>
        ) : null}

        <GrandKeepModel
          bannerColor={bannerColor}
          keepHeight={keepHeight}
          keepWidth={keepWidth}
          showNorthBanner={islandDistrictCount >= 2}
          showSmoke={builderCount >= 3}
          showSouthBanner={islandDistrictCount >= 4}
          stone={hasStoneWalls || hasStoneWorkshop}
        />
        <CourtyardLife
          active={focusIsUnderConstruction || streakMinutes >= 8}
          bannerColor={bannerColor}
          builderCount={builderCount}
          stone={hasStoneWalls || hasStoneWorkshop}
        />

        {visibleVillageHouses.map((position, index) => (
          <House
            key={`house-${index}`}
            position={position as [number, number, number]}
            scale={index === 0 ? 1.05 : 0.84 + index * 0.04}
          />
        ))}

        {forestTrees.slice(0, forestTreeCount).map((position, index) => (
          <Tree
            key={`tree-${index}`}
            position={position as [number, number, number]}
            scale={0.78 + (index % 4) * 0.1}
          />
        ))}

        {isPlanView
          ? Array.from({ length: Math.min(6, forestTreeCount) }).map((_, index) => (
              <mesh
                key={`shrub-${index}`}
                position={[-5.2 + index * 1.6, 0.12, 5.9 - (index % 2) * 0.7]}
              >
                <sphereGeometry args={[0.18 + (index % 3) * 0.03, 10, 10]} />
                <meshStandardMaterial color="#5d8f53" />
              </mesh>
            ))
          : null}

        {citizenMarkers.map((citizen) => (
          <CitizenMarker
            citizen={citizen}
            districtStatus={districtsById.get(citizen.districtId)?.status ?? "planned"}
            key={citizen.id}
          />
        ))}
      </group>

      <mesh position={[0, -0.4, 0]} visible={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial />
      </mesh>
      <ContactShadows
        blur={2.4}
        far={8}
        opacity={0.32}
        position={[0, -0.31, 0]}
        resolution={512}
        scale={18}
      />
    </>
  );
}

function StylizedIslandBase({
  mood,
  active = false
}: {
  mood: ReturnType<typeof getSceneMood>;
  active?: boolean;
}) {
  const rimColor = active ? "#6fa45f" : "#5e8e57";
  const cliffColor = active ? "#537645" : "#405f3c";

  return (
    <group position={[0, -0.28, 0]}>
      <mesh position={[0, -0.42, 0]} receiveShadow>
        <cylinderGeometry args={[6.7, 7.4, 0.92, 12]} />
        <meshStandardMaterial color={cliffColor} roughness={0.96} />
      </mesh>
      <mesh position={[0, 0.06, 0]} receiveShadow>
        <cylinderGeometry args={[6.55, 6.9, 0.3, 12]} />
        <meshStandardMaterial color={mood.outerLand} roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.24, 0]} receiveShadow>
        <cylinderGeometry args={[4.24, 4.42, 0.22, 12]} />
        <meshStandardMaterial color={mood.innerLand} roughness={0.88} />
      </mesh>
      <mesh position={[0, 0.31, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[2.85, 3.48, 48]} />
        <meshStandardMaterial color={mood.water} emissive={mood.waterEmissive} emissiveIntensity={0.28} roughness={0.52} />
      </mesh>
      {[0, Math.PI / 2, Math.PI, Math.PI * 1.5].map((rotation, index) => (
        <mesh key={`stylized-bridge-${index}`} position={[Math.sin(rotation) * 3.16, 0.38, Math.cos(rotation) * 3.16]} rotation={[0, rotation, 0]} receiveShadow>
          <boxGeometry args={[0.58, 0.12, 1.2]} />
          <meshStandardMaterial color={index % 2 === 0 ? "#b18b5b" : "#9f7750"} roughness={0.86} />
        </mesh>
      ))}
      {[0.4, 1.9, 3.3, 4.65, 5.7].map((angle, index) => (
        <mesh key={`stylized-island-facet-${index}`} position={[Math.sin(angle) * 6.45, -0.12, Math.cos(angle) * 6.45]} rotation={[0.16, angle, 0.04]}>
          <dodecahedronGeometry args={[0.32 + (index % 2) * 0.1, 0]} />
          <meshStandardMaterial color={index % 2 === 0 ? rimColor : "#8c7c57"} roughness={0.96} />
        </mesh>
      ))}
    </group>
  );
}

function StylizedTower({
  position,
  height,
  radius = 0.34,
  roofColor,
  stoneColor,
  bannerColor,
  crown = false
}: {
  position: [number, number, number];
  height: number;
  radius?: number;
  roofColor: string;
  stoneColor: string;
  bannerColor: string;
  crown?: boolean;
}) {
  return (
    <group position={position}>
      <mesh position={[0, height / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[radius * 0.92, radius, height, 14]} />
        <meshStandardMaterial color={stoneColor} roughness={0.86} />
      </mesh>
      <mesh position={[0, height + 0.05, 0]} castShadow>
        <cylinderGeometry args={[radius * 1.08, radius * 0.98, 0.16, 14]} />
        <meshStandardMaterial color="#8a7357" roughness={0.86} />
      </mesh>
      <mesh position={[0, height + 0.48, 0]} castShadow>
        <coneGeometry args={[radius * 1.18, crown ? 0.96 : 0.72, 14]} />
        <meshStandardMaterial color={roofColor} roughness={0.78} />
      </mesh>
      {[0, Math.PI * 0.5, Math.PI, Math.PI * 1.5].map((rotation, index) => (
        <GothicWindow
          glow={index === 0}
          key={`stylized-tower-window-${index}`}
          position={[Math.sin(rotation) * radius * 0.94, height * 0.54, Math.cos(rotation) * radius * 0.94]}
          rotation={rotation}
          scale={0.58}
        />
      ))}
      <Banner color={bannerColor} position={[radius * 0.42, height + (crown ? 1.0 : 0.78), 0]} />
    </group>
  );
}

function StylizedCastle({
  keepScale,
  bannerColor,
  hasStoneWalls,
  builderCount
}: {
  keepScale: number;
  bannerColor: string;
  hasStoneWalls: boolean;
  builderCount: number;
}) {
  const scale = 0.9 + keepScale / 220;
  const stoneColor = hasStoneWalls ? "#c7cbc7" : "#d2c09b";
  const stoneShadow = hasStoneWalls ? "#a7afad" : "#b39d7b";
  const roofColor = hasStoneWalls ? "#50706a" : "#9b754c";

  return (
    <group position={[0, 0.12, 0]} scale={scale}>
      <mesh position={[0, 0.28, 0]} receiveShadow>
        <cylinderGeometry args={[1.88, 2.05, 0.34, 16]} />
        <meshStandardMaterial color="#bba886" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.76, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[1.1, 1.28, 1.2, 12]} />
        <meshStandardMaterial color={stoneColor} roughness={0.84} />
      </mesh>
      <mesh position={[0, 1.62, 0]} castShadow>
        <coneGeometry args={[1.34, 1.0, 12]} />
        <meshStandardMaterial color={roofColor} roughness={0.76} />
      </mesh>
      <mesh position={[0, 0.54, 1.24]} castShadow>
        <boxGeometry args={[0.42, 0.5, 0.05]} />
        <meshStandardMaterial color="#4d3528" roughness={0.86} />
      </mesh>
      <RoseWindow glow={builderCount >= 2} position={[0, 1.06, 1.29]} scale={0.95} />
      {[-1.22, 1.22].map((x, index) => (
        <StylizedTower
          bannerColor={bannerColor}
          height={1.46 + index * 0.16}
          key={`stylized-front-tower-${index}`}
          position={[x, 0.22, 0.92]}
          roofColor={roofColor}
          stoneColor={stoneColor}
        />
      ))}
      <StylizedTower
        bannerColor={bannerColor}
        crown
        height={2.2}
        position={[-0.62, 0.3, -0.72]}
        radius={0.28}
        roofColor={roofColor}
        stoneColor={stoneColor}
      />
      <StylizedTower
        bannerColor={bannerColor}
        height={1.68}
        position={[1.12, 0.26, -0.82]}
        radius={0.3}
        roofColor={roofColor}
        stoneColor={stoneShadow}
      />
      {[0, Math.PI * 0.5, Math.PI, Math.PI * 1.5].map((rotation, index) => (
        <mesh key={`stylized-castle-wall-${index}`} position={[Math.sin(rotation) * 1.58, 0.62, Math.cos(rotation) * 1.58]} rotation={[0, rotation, 0]} castShadow receiveShadow>
          <boxGeometry args={[1.64, 0.58, 0.18]} />
          <meshStandardMaterial color={stoneShadow} roughness={0.88} />
        </mesh>
      ))}
      <Lantern color={bannerColor} position={[-0.44, 0.36, 1.38]} />
      <Lantern color={bannerColor} position={[0.44, 0.36, 1.38]} />
      {builderCount >= 3 ? <SmokePlume position={[0.42, 2.42, -0.24]} /> : null}
    </group>
  );
}

function StylizedVillage({
  count,
  bannerColor,
  active = false
}: {
  count: number;
  bannerColor: string;
  active?: boolean;
}) {
  const positions = [
    [3.75, 0.1, 1.12],
    [4.52, 0.1, 0.2],
    [3.95, 0.1, -1.02],
    [-3.82, 0.1, 1.24],
    [-4.42, 0.1, 0.1],
    [4.84, 0.1, 1.34]
  ] as const;

  return (
    <group>
      {positions.slice(0, count).map((position, index) => (
        <group key={`stylized-village-house-${index}`} position={position as [number, number, number]} rotation={[0, index * 0.4 - 0.2, 0]}>
          <mesh position={[0, 0.24, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.26, 0.32, 0.48, 6]} />
            <meshStandardMaterial color={index % 2 === 0 ? "#c3a174" : "#ba8f64"} roughness={0.86} />
          </mesh>
          <mesh position={[0, 0.65, 0]} castShadow>
            <coneGeometry args={[0.38, 0.42, 6]} />
            <meshStandardMaterial color={index % 2 === 0 ? "#b9864b" : "#916849"} roughness={0.78} />
          </mesh>
          <mesh position={[0, 0.26, 0.31]}>
            <boxGeometry args={[0.11, 0.2, 0.035]} />
            <meshStandardMaterial color="#46342b" emissive={active ? bannerColor : "#000000"} emissiveIntensity={active ? 0.2 : 0} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function StylizedForest({
  count
}: {
  count: number;
}) {
  const positions = [
    [-5.3, 0.04, -2.8],
    [-4.4, 0.04, -4.1],
    [-2.6, 0.04, -5.0],
    [0.9, 0.04, -5.35],
    [3.0, 0.04, -4.75],
    [5.1, 0.04, -2.9],
    [-5.35, 0.04, 2.6],
    [-4.25, 0.04, 4.18],
    [2.8, 0.04, 4.75],
    [4.9, 0.04, 3.0],
    [0.35, 0.04, 5.32],
    [-2.0, 0.04, 5.0]
  ] as const;

  return (
    <group>
      {positions.slice(0, count).map((position, index) => (
        <Tree key={`stylized-forest-tree-${index}`} position={position as [number, number, number]} scale={0.8 + (index % 3) * 0.12} />
      ))}
    </group>
  );
}

function StylizedProgressMarker({
  focus,
  color,
  tier
}: {
  focus: WorldFocus | null;
  color: string;
  tier: "settling" | "building" | "surging";
}) {
  if (!focus) {
    return null;
  }

  return (
    <group position={focus.worldPosition}>
      <ProjectBeacon color={color} tier={tier} position={[0, 0, 0]} />
      <mesh position={[0, 0.56, 0]} castShadow>
        <coneGeometry args={[0.18, 0.42, 5]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.28} />
      </mesh>
    </group>
  );
}

function StylizedWorldScene({
  snapshot,
  keepScale,
  villageHouseCount,
  wallTowerCount,
  forestTreeCount,
  viewMode
}: WorldSceneProps) {
  const citizens = snapshot?.citizens ?? [];
  const mood = getSceneMood(snapshot?.currentCategory);
  const bannerColor = getBannerColor(snapshot?.currentCategory);
  const unlockedStructures = new Set(snapshot?.unlockedStructures ?? []);
  const builderCount = citizens.filter((citizen) => citizen.type === "builder").length;
  const hasStoneWalls = unlockedStructures.has("Stone walls") || unlockedStructures.has("Stone workshop");
  const isWork = snapshot?.currentCategory === "work";
  const focus = snapshot?.worldFocus ?? null;
  const streakTier = snapshot?.currentStreakTier ?? "settling";

  return (
    <>
      <color attach="background" args={[mood.background]} />
      <fog attach="fog" args={[mood.fog, 12, viewMode === "plan" ? 28 : 22]} />
      <ambientLight intensity={0.58} />
      <hemisphereLight color={mood.cloudColor} groundColor="#2c432c" intensity={0.72} />
      <directionalLight
        castShadow
        color={mood.sunlight}
        intensity={2.25}
        position={[7, 10, 6]}
        shadow-bias={-0.0006}
        shadow-mapSize-height={2048}
        shadow-mapSize-width={2048}
      />
      <pointLight color={bannerColor} distance={8} intensity={0.72} position={[0, 3.4, 1.8]} />
      {viewMode === "rampart" ? (
        <>
          <GoldenHourSky cloudColor={mood.cloudColor} sunColor={mood.sunColor} />
          <Cloud color={mood.cloudColor} position={[-4.4, 6.6, -5.8]} scale={1.05} speed={0.14} />
          <BirdFlock color={snapshot?.currentCategory === "play" ? "#5d3630" : "#4e5a62"} position={[-2.1, 5.9, -4.8]} scale={0.88} />
        </>
      ) : null}
      <group position={[0, -0.2, 0]}>
        <StylizedIslandBase active={isWork} mood={mood} />
        <StylizedCastle
          bannerColor={bannerColor}
          builderCount={builderCount}
          hasStoneWalls={hasStoneWalls}
          keepScale={keepScale}
        />
        {wallTowerCount >= 2 ? (
          <>
            <StylizedTower bannerColor={bannerColor} height={1.08} position={[-2.64, 0.0, -2.18]} radius={0.22} roofColor={hasStoneWalls ? "#50706a" : "#9b754c"} stoneColor={hasStoneWalls ? "#c1c6c2" : "#c7b38e"} />
            <StylizedTower bannerColor={bannerColor} height={1.08} position={[2.64, 0.0, -2.18]} radius={0.22} roofColor={hasStoneWalls ? "#50706a" : "#9b754c"} stoneColor={hasStoneWalls ? "#c1c6c2" : "#c7b38e"} />
          </>
        ) : null}
        <StylizedVillage active={isWork} bannerColor={bannerColor} count={villageHouseCount} />
        <StylizedForest count={forestTreeCount} />
        <StylizedProgressMarker color={focus?.color ?? bannerColor} focus={focus} tier={streakTier} />
        {citizens.slice(0, 5).map((citizen) => (
          <CitizenMarker citizen={citizen} districtStatus="active" key={citizen.id} />
        ))}
      </group>
      <ContactShadows
        blur={2.8}
        far={9}
        opacity={0.34}
        position={[0, -0.44, 0]}
        resolution={512}
        scale={15}
      />
    </>
  );
}

function CastleFallback({
  stageLabel,
  keepScale,
  villageHouseCount,
  forestTreeCount
}: {
  stageLabel: string;
  keepScale: number;
  villageHouseCount: number;
  forestTreeCount: number;
}) {
  return (
    <div className="castle-fallback">
      <div className="castle-fallback__keep" style={{ width: `${keepScale}%` }} />
      <div className="castle-fallback__text">
        <strong>{stageLabel}</strong>
        <span>{villageHouseCount} homes in the forest ring</span>
        <span>{forestTreeCount} trees still standing</span>
      </div>
    </div>
  );
}

function CastleScene(props: CastleSceneProps) {
  const [canRender3d, setCanRender3d] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("rampart");
  const [directorMode, setDirectorMode] = useState(false);
  const unlockedStructures = new Set(props.snapshot?.unlockedStructures ?? []);
  const activeBlueprints = new Set(
    (props.snapshot?.unlockRoadmap ?? [])
      .filter((item) => item.status !== "unlocked")
      .map((item) => item.name)
  );
  const sceneProjectFocus: WorldFocus | null = props.snapshot?.worldFocus ?? null;
  const planStreakMinutes = props.snapshot?.currentStreakMinutes ?? 0;
  const planStreakTier = props.snapshot?.currentStreakTier ?? "settling";
  const recommendedView = sceneProjectFocus?.recommendedView ?? "plan";
  const layoutCallouts: SceneLayoutCallout[] = [
    { label: "Keep", left: "50%", top: "59%", tone: "structure" },
    { label: "Moat ring", left: "34%", top: "69%", tone: "water" },
    { label: "Village edge", left: "80%", top: "48%", tone: "village" },
    { label: unlockedStructures.has("Workshop frame") ? "Workshop" : "Workshop site", left: "38%", top: "63%", tone: "project" },
    { label: unlockedStructures.has("Gatehouse") || activeBlueprints.has("Gatehouse") ? "East gate" : "Wall road", left: "77%", top: "50%", tone: "structure" }
  ];

  useEffect(() => {
    setCanRender3d(hasWebGlSupport());
  }, []);

  useEffect(() => {
    if (!directorMode) {
      return;
    }

    setViewMode(recommendedView);
  }, [directorMode, recommendedView]);

  const handleManualViewChange = (nextView: ViewMode) => {
    setDirectorMode(false);
    setViewMode(nextView);
  };

  const handleFollowDirector = () => {
    setDirectorMode(true);
    setViewMode(recommendedView);
  };

  return (
    <div className="castle-canvas-frame castle-canvas-frame--three">
      {canRender3d ? (
        viewMode === "rampart" ? (
          <Canvas
            camera={{ position: [-9.55, 6.0, 9.55], fov: 32 }}
            dpr={[1, 1.5]}
            key="rampart-view"
            onCreated={({ camera }) => {
              camera.lookAt(0.5, 1.55, -0.55);
            }}
            shadows
          >
            <StylizedWorldScene {...props} viewMode={viewMode} />
          </Canvas>
        ) : (
          <Canvas
            dpr={[1, 1.5]}
            key="plan-view"
            onCreated={({ camera }) => {
              camera.position.set(0, 11.5, 0.01);
              camera.up.set(0, 0, -1);
              camera.lookAt(0, 0, 0);
            }}
            orthographic
            shadows
          >
            <StylizedWorldScene {...props} viewMode={viewMode} />
          </Canvas>
        )
      ) : (
        <CastleFallback
          forestTreeCount={props.forestTreeCount}
          keepScale={props.keepScale}
          stageLabel={props.stageLabel}
          villageHouseCount={props.villageHouseCount}
        />
      )}

      <div className={`castle-scene-overlay castle-scene-overlay--${viewMode}`}>
        <div>
          <p className="eyebrow">3D Kingdom View</p>
          <h3>{props.stageLabel}</h3>
          <p className="scene-overlay-note">
            {viewMode === "rampart"
              ? `Rampart view from the southwest wall corner toward the two far walls.${sceneProjectFocus ? ` Focus: ${sceneProjectFocus.label}.` : ""}`
              : "Plan view adds labels so the island, moat, gate, and village read at a glance."}
          </p>
          {sceneProjectFocus ? (
            <p className="scene-overlay-note">
              {sceneProjectFocus.storyline}
            </p>
          ) : null}
          {sceneProjectFocus ? (
            <p className="scene-overlay-note">
              {sceneProjectFocus.confirmationDetail}
            </p>
          ) : null}
          <p className="scene-overlay-note">
            Scene director is {directorMode ? "following the recommended view." : "ready; Rampart view stays pinned for castle viewing."}
          </p>
          {props.snapshot?.worldAtmosphere ? (
            <p className="scene-overlay-note">{props.snapshot.worldAtmosphere}</p>
          ) : null}
        </div>
        <div className="scene-overlay-controls">
          <div className="scene-view-toggle">
            <button
              className={`scene-view-button ${viewMode === "rampart" ? "is-active" : ""} ${recommendedView === "rampart" ? "is-recommended" : ""}`}
              onClick={() => handleManualViewChange("rampart")}
              type="button"
            >
              Rampart View
            </button>
            <button
              className={`scene-view-button ${viewMode === "plan" ? "is-active" : ""} ${recommendedView === "plan" ? "is-recommended" : ""}`}
              onClick={() => handleManualViewChange("plan")}
              type="button"
            >
              Plan View
            </button>
          </div>
          <div className="scene-art-direction" aria-label="Current 3D art direction">
            <span>Reference Style</span>
            <strong>Storybook diorama castle</strong>
          </div>
          <button
            className={`scene-director-button ${directorMode ? "is-active" : ""}`}
            onClick={handleFollowDirector}
            type="button"
          >
            {directorMode
              ? `Following ${recommendedView === "rampart" ? "Rampart" : "Plan"}`
              : `Follow ${recommendedView === "rampart" ? "Rampart" : "Plan"}`}
          </button>
          <div className="scene-overlay-pills">
            <span>{props.snapshot?.currentCategory ?? "unknown"}</span>
            {sceneProjectFocus ? <span>Focus: {sceneProjectFocus.label}</span> : null}
            {sceneProjectFocus ? <span>{sceneProjectFocus.statusLabel}</span> : null}
            {sceneProjectFocus ? <span>Then {sceneProjectFocus.secondaryViewLabel.replace(" View", "")}</span> : null}
            <span>{directorMode ? "Director on" : "Rampart pinned"}</span>
            <span>{props.islandDistrictCount} districts</span>
            <span>{props.villageHouseCount} homes</span>
            <span>{props.wallTowerCount} towers</span>
          </div>
        </div>
      </div>
      {viewMode === "plan" ? (
        <>
          <div className="scene-layout-callouts" aria-hidden="true">
            {layoutCallouts.map((callout) => (
              <span
                className={`scene-layout-callout scene-layout-callout--${callout.tone}`}
                key={`${callout.label}-${callout.left}-${callout.top}`}
                style={{ left: callout.left, top: callout.top }}
              >
                {callout.label}
              </span>
            ))}
            {sceneProjectFocus ? (
              <span
                className="scene-layout-callout scene-layout-callout--anchor"
                style={{ left: sceneProjectFocus.anchorLeft, top: sceneProjectFocus.anchorTop }}
              >
                1. {sceneProjectFocus.anchorLabel}
              </span>
            ) : null}
            {sceneProjectFocus ? (
              <span
                className="scene-layout-callout scene-layout-callout--route"
                style={{ left: sceneProjectFocus.routeLeft, top: sceneProjectFocus.routeTop }}
              >
                2. {sceneProjectFocus.routeLabel}
              </span>
            ) : null}
            {sceneProjectFocus ? (
              <span
                className="scene-layout-callout scene-layout-callout--focus"
                style={{ left: sceneProjectFocus.left, top: sceneProjectFocus.top }}
              >
                3. {sceneProjectFocus.label}
              </span>
            ) : null}
            {sceneProjectFocus && props.snapshot?.currentCategory === "work" && planStreakMinutes >= 8 ? (
              <span
                className="scene-layout-callout scene-layout-callout--momentum"
                style={{ left: sceneProjectFocus.left, top: `calc(${sceneProjectFocus.top} + 7%)` }}
              >
                {planStreakTier === "surging" ? "Work surge" : "Work building"}
              </span>
            ) : null}
          </div>
          <div className="scene-layout-legend">
            <span>Plan view is the clean read of the kingdom footprint.</span>
            <span>Rampart view keeps the moodier perspective shot.</span>
            {sceneProjectFocus ? <span>{sceneProjectFocus.note}</span> : null}
            {props.snapshot?.worldAtmosphere ? <span>{props.snapshot.worldAtmosphere}</span> : null}
          </div>
        </>
      ) : null}
    </div>
  );
}

export default CastleScene;
