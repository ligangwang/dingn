// The kingdom in 3D: a floating island above a sea of clouds, lit by a low
// golden sun. Plain three.js with no React, so the page (kingdom.tsx) only
// tells it what stands where and hears which tile was tapped.
//
// Everything is modelled in code from simple low-poly shapes, so the page
// loads no model files. Tile x,y of the kingdom sits at world (x·T, 0, y·T).
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { landBounds, type StageId } from "@/data/kingdom.mjs";

export const T = 2; // a tile's width in world units
const SUN = new THREE.Vector3(-0.55, 0.42, 0.72).normalize();

export type SceneState = {
  size: number;
  hall: StageId;
  tiles: Record<string, string>;
};
type Options = {
  onTile: (x: number, y: number) => void;
  reducedMotion: boolean;
};

// ---- materials ------------------------------------------------------------

const mats = new Map<string, THREE.MeshStandardMaterial>();
function mat(
  color: string | number,
  extra: THREE.MeshStandardMaterialParameters = {},
) {
  const key = `${color}|${JSON.stringify(extra)}`;
  let m = mats.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.85,
      metalness: 0,
      flatShading: true,
      ...extra,
    });
    mats.set(key, m);
  }
  return m;
}
const C = {
  grass: "#7fb35a",
  grassDark: "#679a47",
  meadow: "#8cbf63",
  soil: "#8a6340",
  rock: "#7d746b",
  rockDark: "#5d5650",
  wall: "#efe3cc",
  wallWarm: "#e3cfa8",
  stone: "#c9c2b6",
  stoneDark: "#a39b8f",
  wood: "#8a5a35",
  woodDark: "#5e3b22",
  roof: "#b4533a",
  roofBlue: "#3f6a9e",
  roofSlate: "#4f5866",
  gold: "#e8b84a",
  leaf: "#4f8f3f",
  leafLight: "#6fae4c",
  water: "#5fb4e0",
  flag: "#d9483b",
};

function mesh(
  geo: THREE.BufferGeometry,
  material: THREE.Material,
  x = 0,
  y = 0,
  z = 0,
) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}
const box = (
  w: number,
  h: number,
  d: number,
  color: string,
  x = 0,
  y = 0,
  z = 0,
) => mesh(new THREE.BoxGeometry(w, h, d), mat(color), x, y + h / 2, z);
const cyl = (
  rt: number,
  rb: number,
  h: number,
  color: string,
  x = 0,
  y = 0,
  z = 0,
  seg = 8,
) =>
  mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat(color), x, y + h / 2, z);
const cone = (
  r: number,
  h: number,
  color: string,
  x = 0,
  y = 0,
  z = 0,
  seg = 4,
) => {
  const m = mesh(
    new THREE.ConeGeometry(r, h, seg),
    mat(color),
    x,
    y + h / 2,
    z,
  );
  if (seg === 4) m.rotation.y = Math.PI / 4;
  return m;
};
/** A gabled roof over a w × d box, ridge along x. */
function gable(w: number, d: number, h: number, color: string, y: number) {
  const shape = new THREE.Shape();
  shape.moveTo(-d / 2 - 0.08, 0);
  shape.lineTo(d / 2 + 0.08, 0);
  shape.lineTo(0, h);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: w + 0.16,
    bevelEnabled: false,
  });
  geo.translate(0, 0, -(w + 0.16) / 2);
  geo.rotateY(Math.PI / 2);
  return mesh(geo, mat(color), 0, y, 0);
}
function windowGlow(x: number, y: number, z: number, ry = 0) {
  const m = mesh(
    new THREE.PlaneGeometry(0.16, 0.2),
    mat("#ffd27a", { emissive: "#ffb347", emissiveIntensity: 0.6 }),
    x,
    y,
    z,
  );
  m.rotation.y = ry;
  m.castShadow = false;
  return m;
}
function group(...children: THREE.Object3D[]) {
  const g = new THREE.Group();
  g.add(...children);
  return g;
}
function flag(x: number, y: number, z: number, h = 0.9) {
  const pole = cyl(0.025, 0.025, h, C.woodDark, x, y, z, 5);
  const cloth = mesh(
    new THREE.PlaneGeometry(0.42, 0.26, 4, 1),
    new THREE.MeshStandardMaterial({
      color: C.flag,
      side: THREE.DoubleSide,
      roughness: 0.9,
    }),
    x + 0.22,
    y + h - 0.15,
    z,
  );
  cloth.userData.flag = true;
  return group(pole, cloth);
}
function tower(r: number, h: number, wall: string, roof: string, x = 0, z = 0) {
  return group(
    cyl(r, r * 1.05, h, wall, x, 0, z, 8),
    cone(r * 1.35, r * 1.9, roof, x, h, z, 8),
  );
}
function treeAt(x: number, z: number, s = 1, kind = 0) {
  const trunk = cyl(0.06 * s, 0.09 * s, 0.35 * s, C.woodDark, x, 0, z, 5);
  if (kind === 1) {
    return group(
      trunk,
      cone(0.38 * s, 0.7 * s, C.leaf, x, 0.25 * s, z, 6),
      cone(0.3 * s, 0.55 * s, C.leafLight, x, 0.6 * s, z, 6),
    );
  }
  const crown = mesh(
    new THREE.IcosahedronGeometry(0.36 * s, 0),
    mat(kind === 2 ? C.leafLight : C.leaf),
    x,
    0.62 * s,
    z,
  );
  return group(trunk, crown);
}

// ---- buildings ------------------------------------------------------------

function cottage() {
  const g = group(
    box(0.9, 0.62, 0.7, C.wall),
    gable(0.9, 0.7, 0.45, C.roof, 0.62),
    box(0.14, 0.4, 0.14, C.stoneDark, 0.25, 0.75, -0.12),
    box(0.16, 0.3, 0.02, C.woodDark, 0, 0, 0.36),
    windowGlow(-0.28, 0.36, 0.352),
    windowGlow(0.28, 0.36, 0.352),
  );
  g.userData.smoke = new THREE.Vector3(0.25, 1.2, -0.12);
  return g;
}
function farm() {
  const g = group(box(1.6, 0.06, 1.6, C.soil));
  for (let i = 0; i < 5; i++) {
    const row = box(
      1.4,
      0.12,
      0.14,
      i % 2 ? "#d8b44a" : "#9bc04f",
      0,
      0.06,
      -0.6 + i * 0.3,
    );
    g.add(row);
  }
  g.add(
    box(0.5, 0.35, 0.4, C.wood, 0.55, 0.06, 0.55),
    cone(0.4, 0.3, C.roof, 0.55, 0.41, 0.55),
  );
  return g;
}
function well() {
  return group(
    cyl(0.32, 0.36, 0.35, C.stone, 0, 0, 0, 10),
    mesh(
      new THREE.CircleGeometry(0.27, 10).rotateX(-Math.PI / 2),
      mat(C.water, { roughness: 0.2 }),
      0,
      0.3,
      0,
    ),
    box(0.05, 0.6, 0.05, C.wood, -0.28, 0.3, 0),
    box(0.05, 0.6, 0.05, C.wood, 0.28, 0.3, 0),
    cone(0.5, 0.35, C.roof, 0, 0.88, 0),
  );
}
function market() {
  const g = new THREE.Group();
  const colors = ["#d9483b", "#3f6a9e", "#e8b84a", "#4f8f3f"];
  [
    [-0.42, -0.42],
    [0.42, -0.42],
    [-0.42, 0.42],
    [0.42, 0.42],
  ].forEach(([x, z], i) => {
    g.add(
      box(0.6, 0.3, 0.45, C.wood, x, 0, z),
      box(0.04, 0.65, 0.04, C.woodDark, x - 0.27, 0, z + 0.2),
      box(0.04, 0.65, 0.04, C.woodDark, x + 0.27, 0, z + 0.2),
      cone(0.5, 0.25, colors[i], x, 0.62, z),
      box(0.16, 0.12, 0.16, colors[(i + 2) % 4], x - 0.12, 0.3, z),
    );
  });
  return g;
}
function workshop() {
  const g = group(
    box(1.2, 0.75, 0.9, C.wallWarm),
    gable(1.2, 0.9, 0.5, C.roofSlate, 0.75),
    box(0.25, 0.9, 0.25, C.stoneDark, -0.4, 0.6, 0.2),
    box(0.4, 0.4, 0.02, C.woodDark, 0.15, 0, 0.46),
    windowGlow(-0.3, 0.42, 0.452),
  );
  g.add(cyl(0.18, 0.18, 0.3, C.wood, 0.75, 0, 0.3, 8));
  g.userData.smoke = new THREE.Vector3(-0.4, 1.6, 0.2);
  return g;
}
function watchtower() {
  const g = group(
    box(0.6, 1.6, 0.6, C.stone),
    box(0.8, 0.1, 0.8, C.stoneDark, 0, 1.6, 0),
    cone(0.62, 0.6, C.roof, 0, 1.7, 0),
    windowGlow(0, 1.2, 0.302),
  );
  g.add(flag(0, 2.25, 0, 0.6));
  return g;
}
function library() {
  const g = group(
    box(1.4, 0.9, 1.0, C.stone),
    box(1.5, 0.08, 1.1, C.stoneDark, 0, 0.9, 0),
    mesh(
      new THREE.SphereGeometry(0.42, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2),
      mat(C.roofBlue),
      0,
      0.98,
      0,
    ),
  );
  for (const x of [-0.5, -0.17, 0.17, 0.5])
    g.add(cyl(0.06, 0.06, 0.8, C.wall, x, 0, 0.55, 6));
  g.add(windowGlow(-0.33, 0.5, 0.502), windowGlow(0.33, 0.5, 0.502));
  return g;
}
function statue() {
  return group(
    box(0.7, 0.3, 0.7, C.stone),
    box(0.5, 0.2, 0.5, C.stoneDark, 0, 0.3, 0),
    cyl(0.12, 0.16, 0.6, C.gold, 0, 0.5, 0, 6),
    mesh(
      new THREE.IcosahedronGeometry(0.13, 0),
      mat(C.gold, { metalness: 0.6, roughness: 0.35 }),
      0,
      1.22,
      0,
    ),
    mesh(
      new THREE.OctahedronGeometry(0.16, 0),
      mat(C.gold, {
        metalness: 0.6,
        roughness: 0.35,
        emissive: "#a8741a",
        emissiveIntensity: 0.3,
      }),
      0,
      1.55,
      0,
    ),
  );
}
function path() {
  const g = new THREE.Group();
  const s = [
    [-0.45, -0.4, 0.5],
    [0.3, -0.5, 0.45],
    [-0.1, 0.05, 0.55],
    [0.5, 0.2, 0.4],
    [-0.5, 0.45, 0.45],
    [0.15, 0.6, 0.4],
  ];
  for (const [x, z, r] of s) {
    const stone = mesh(
      new THREE.CylinderGeometry(r * 0.6, r * 0.62, 0.05, 6),
      mat(C.stone),
      x,
      0.025,
      z,
    );
    stone.rotation.y = x * 3;
    stone.castShadow = false;
    g.add(stone);
  }
  return g;
}
function flowers() {
  const g = group(box(1.2, 0.08, 1.2, C.soil));
  const colors = ["#f3d34a", "#e86a92", "#ffffff", "#b28be0"];
  for (let i = 0; i < 18; i++) {
    const x = ((i * 37) % 10) / 10 - 0.45;
    const z = ((i * 53) % 10) / 10 - 0.45;
    g.add(
      mesh(
        new THREE.IcosahedronGeometry(0.09, 0),
        mat(colors[i % 4]),
        x,
        0.14,
        z,
      ),
    );
  }
  return g;
}
function trees() {
  return group(
    treeAt(-0.3, -0.25, 1.1, 0),
    treeAt(0.35, 0.1, 0.9, 1),
    treeAt(-0.1, 0.4, 0.8, 2),
  );
}

// The hall at each stage.
function campfire() {
  const g = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const log = mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 0.6, 5),
      mat(C.woodDark),
      0,
      0.08,
      0,
    );
    log.rotation.z = Math.PI / 2;
    log.rotation.y = (i * Math.PI) / 4;
    g.add(log);
  }
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    g.add(
      mesh(
        new THREE.DodecahedronGeometry(0.1, 0),
        mat(C.stoneDark),
        Math.cos(a) * 0.42,
        0.06,
        Math.sin(a) * 0.42,
      ),
    );
  }
  const flame = mesh(
    new THREE.ConeGeometry(0.18, 0.5, 6),
    new THREE.MeshStandardMaterial({
      color: "#ffb347",
      emissive: "#ff7a1a",
      emissiveIntensity: 2.2,
      flatShading: true,
    }),
    0,
    0.35,
    0,
  );
  flame.castShadow = false;
  flame.userData.flame = true;
  g.add(flame);
  // Tents around the fire.
  for (const [x, z, r] of [
    [-0.75, -0.55, 0.6],
    [0.7, -0.6, -0.5],
  ]) {
    const tent = cone(0.42, 0.6, "#d8c39a", x, 0, z, 4);
    tent.rotation.y = r;
    g.add(tent);
  }
  g.userData.light = new THREE.Vector3(0, 0.6, 0);
  return g;
}
function longhouse() {
  const g = group(
    box(1.5, 0.7, 0.9, C.wood),
    gable(1.5, 0.9, 0.7, "#c9a24a", 0.7),
    box(0.3, 0.45, 0.02, C.woodDark, 0, 0, 0.46),
    windowGlow(-0.45, 0.4, 0.452),
    windowGlow(0.45, 0.4, 0.452),
  );
  g.add(flag(0.85, 0, 0.5, 1.2));
  g.userData.smoke = new THREE.Vector3(0, 1.5, 0);
  return g;
}
function townHall() {
  const g = group(
    box(1.6, 1.0, 1.1, C.wall),
    gable(1.6, 1.1, 0.6, C.roofBlue, 1.0),
    box(0.45, 0.9, 0.45, C.wall, 0, 1.2, 0.1),
    cone(0.42, 0.7, C.roofBlue, 0, 2.1, 0.1),
    box(0.36, 0.55, 0.02, C.woodDark, 0, 0, 0.56),
  );
  for (const x of [-0.55, -0.3, 0.3, 0.55]) g.add(windowGlow(x, 0.55, 0.552));
  g.add(flag(0, 2.75, 0.1, 0.6));
  return g;
}
function keep() {
  const g = group(
    box(1.3, 1.6, 1.3, C.stone),
    box(1.45, 0.12, 1.45, C.stoneDark, 0, 1.6, 0),
  );
  for (const [x, z] of [
    [-0.6, -0.6],
    [0.6, -0.6],
    [-0.6, 0.6],
    [0.6, 0.6],
  ])
    g.add(tower(0.24, 2.0, C.stone, C.roofSlate, x, z));
  for (const x of [-0.3, 0.3]) g.add(windowGlow(x, 1.0, 0.652));
  g.add(flag(0, 1.72, 0, 0.9));
  return g;
}
function castle() {
  const g = new THREE.Group();
  // Walls around a courtyard.
  for (const [w, d, x, z] of [
    [2.4, 0.22, 0, -1.1],
    [2.4, 0.22, 0, 1.1],
    [0.22, 2.4, -1.1, 0],
    [0.22, 2.4, 1.1, 0],
  ])
    g.add(box(w, 0.8, d, C.stone, x, 0, z));
  for (const [x, z] of [
    [-1.1, -1.1],
    [1.1, -1.1],
    [-1.1, 1.1],
    [1.1, 1.1],
  ])
    g.add(tower(0.3, 1.5, C.stone, C.roofBlue, x, z));
  g.add(
    box(1.1, 2.0, 1.0, C.wall, 0, 0, -0.2),
    cone(0.85, 0.9, C.roofBlue, 0, 2.0, -0.2),
  );
  g.add(tower(0.28, 2.8, C.wall, C.roofBlue, 0.5, -0.5));
  g.add(box(0.4, 0.5, 0.05, C.woodDark, 0, 0, 1.22));
  for (const x of [-0.3, 0.3]) g.add(windowGlow(x, 1.2, 0.302));
  g.add(flag(0.5, 3.35, -0.5, 0.7));
  return g;
}
function palace() {
  const g = castle();
  g.add(
    mesh(
      new THREE.SphereGeometry(0.5, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
      mat(C.gold, { metalness: 0.5, roughness: 0.35 }),
      0,
      2.9,
      -0.2,
    ),
    cone(0.12, 0.5, C.gold, 0, 3.35, -0.2, 6),
    tower(0.22, 2.4, C.wall, C.gold, -0.6, -0.6),
  );
  return g;
}

const MAKERS: Record<string, () => THREE.Group> = {
  path,
  tree: trees,
  flowers,
  cottage,
  farm,
  well,
  market,
  workshop,
  tower: watchtower,
  library,
  statue,
};
const HALLS: Record<StageId, () => THREE.Group> = {
  camp: campfire,
  village: longhouse,
  town: townHall,
  city: keep,
  kingdom: castle,
  capital: palace,
};
/** The castle and palace are built wide, so they shrink to fit the hall's tile. */
const HALL_FIT: Partial<Record<StageId, number>> = {
  kingdom: 0.82,
  capital: 0.82,
};

export function makeBuilding(id: string): THREE.Group {
  const g = (MAKERS[id] ?? cottage)();
  g.scale.setScalar(T / 1.8);
  return g;
}
export function makeHall(stage: StageId): THREE.Group {
  const g = HALLS[stage]();
  g.scale.setScalar((T / 1.8) * (HALL_FIT[stage] ?? 1));
  return g;
}

// ---- the world ------------------------------------------------------------

function skyDome() {
  const geo = new THREE.SphereGeometry(400, 32, 16);
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      top: { value: new THREE.Color("#3d6fb6") },
      middle: { value: new THREE.Color("#9cc3e6") },
      horizon: { value: new THREE.Color("#ffd9a8") },
      below: { value: new THREE.Color("#b8c6e4") },
      sun: { value: SUN.clone() },
    },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 top; uniform vec3 middle; uniform vec3 horizon; uniform vec3 below; uniform vec3 sun; varying vec3 vDir;
      void main(){
        float h = vDir.y;
        vec3 c = mix(below, horizon, smoothstep(-0.45, 0.0, h));
        c = mix(c, middle, smoothstep(0.02, 0.3, h));
        c = mix(c, top, smoothstep(0.25, 0.9, h));
        float s = max(dot(normalize(vDir), sun), 0.0);
        c += vec3(1.0, 0.82, 0.55) * pow(s, 18.0) * 0.55 + vec3(1.0, 0.95, 0.85) * pow(s, 900.0) * 3.0;
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  return new THREE.Mesh(geo, material);
}

/** A soft white puff made of a few flattened icospheres. */
function cloudPuff(rand: () => number, scale: number) {
  const g = new THREE.Group();
  const m = new THREE.MeshLambertMaterial({
    color: "#ffffff",
    emissive: "#fff1e0",
    emissiveIntensity: 0.42,
  });
  const n = 4 + Math.floor(rand() * 4);
  for (let i = 0; i < n; i++) {
    const r = (0.6 + rand() * 0.8) * scale;
    const p = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 2), m);
    p.position.set(
      (rand() - 0.5) * 2.6 * scale,
      (rand() - 0.3) * 0.5 * scale,
      (rand() - 0.5) * 1.6 * scale,
    );
    p.scale.y = 0.55;
    g.add(p);
  }
  return g;
}

let puffTexture: THREE.Texture | null = null;
/** A soft round puff for smoke and dust. */
function puff() {
  if (puffTexture) return puffTexture;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.5, "rgba(255,255,255,0.55)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  puffTexture = new THREE.CanvasTexture(canvas);
  return puffTexture;
}

function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** A striped, scrolling texture for falling water. */
function waterTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  const grad = ctx.createLinearGradient(0, 0, 32, 0);
  grad.addColorStop(0, "#8fd0f0");
  grad.addColorStop(0.5, "#e8f7ff");
  grad.addColorStop(1, "#8fd0f0");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 32, 128);
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  for (let i = 0; i < 18; i++)
    ctx.fillRect((i * 11) % 30, (i * 23) % 128, 2, 14 + (i % 4) * 6);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class KingdomScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private composer: EffectComposer | null = null;
  private bloom: UnrealBloomPass | null = null;
  private clock = new THREE.Clock();
  private realDt = 0;
  private frame = 0;
  private island = new THREE.Group();
  private buildings = new THREE.Group();
  private tileMeshes: THREE.Mesh[] = [];
  private cursor: THREE.Mesh;
  private ghost: THREE.Group | null = null;
  private clouds: THREE.Group[] = [];
  private birds: THREE.Group[] = [];
  private smoke: { sprite: THREE.Sprite; origin: THREE.Vector3; t: number }[] =
    [];
  private flames: THREE.Mesh[] = [];
  private flags: THREE.Mesh[] = [];
  private fire: THREE.PointLight | null = null;
  private waters: THREE.Texture[] = [];
  private rising: {
    obj: THREE.Object3D;
    t: number;
    scaffold: THREE.LineSegments;
  }[] = [];
  private state: SceneState | null = null;
  private placed = new Map<string, string>();
  private hallShown: StageId | null = null;
  private flight: {
    t: number;
    from: THREE.Vector3;
    to: THREE.Vector3;
    target: THREE.Vector3;
  } | null = null;
  private slowFrames = 0;
  private sampled = 0;
  private down: { x: number; y: number } | null = null;
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private disposed = false;

  constructor(
    private host: HTMLElement,
    private options: Options,
  ) {
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(host.clientWidth, host.clientHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    host.appendChild(renderer.domElement);
    this.renderer = renderer;

    this.camera = new THREE.PerspectiveCamera(
      38,
      host.clientWidth / host.clientHeight,
      0.5,
      900,
    );
    this.scene.fog = new THREE.Fog("#d9d3df", 70, 300);
    this.scene.add(skyDome());

    const hemi = new THREE.HemisphereLight("#cfe4ff", "#7a6a52", 1.1);
    const sun = new THREE.DirectionalLight("#ffe2b8", 3.2);
    sun.position.copy(SUN).multiplyScalar(40);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = sc.bottom = -16;
    sc.right = sc.top = 16;
    sc.near = 1;
    sc.far = 120;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.03;
    this.scene.add(hemi, sun, sun.target);

    this.scene.add(this.island, this.buildings);
    this.cursor = new THREE.Mesh(
      new THREE.RingGeometry(T * 0.36, T * 0.46, 4, 1, Math.PI / 4).rotateX(
        -Math.PI / 2,
      ),
      new THREE.MeshBasicMaterial({
        color: "#fff6d8",
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
      }),
    );
    this.cursor.visible = false;
    this.scene.add(this.cursor);
    this.addClouds();
    this.addBirds();

    this.controls = new OrbitControls(this.camera, renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.07;
    this.controls.minDistance = 9;
    this.controls.maxDistance = 46;
    this.controls.minPolarAngle = 0.35;
    this.controls.maxPolarAngle = 1.25;
    this.controls.enablePan = false;
    this.controls.autoRotate = !options.reducedMotion;
    this.controls.autoRotateSpeed = 0.25;
    this.controls.addEventListener(
      "start",
      () => (this.controls.autoRotate = false),
    );

    if (window.innerWidth >= 700 && !options.reducedMotion) {
      this.composer = new EffectComposer(renderer);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      this.bloom = new UnrealBloomPass(
        new THREE.Vector2(host.clientWidth, host.clientHeight),
        0.35,
        0.6,
        0.9,
      );
      this.composer.addPass(this.bloom);
      this.composer.addPass(new OutputPass());
    }

    const el = renderer.domElement;
    el.addEventListener("pointerdown", this.onDown);
    el.addEventListener("pointerup", this.onUp);
    el.addEventListener("pointermove", this.onMove);
    el.addEventListener(
      "pointerleave",
      () => this.ghost && (this.ghost.visible = false),
    );
    window.addEventListener("resize", this.onResize);
    this.loop();
  }

  /** Shows a kingdom; new buildings rise, and a new size reshapes the island. */
  set(state: SceneState, { animate = true } = {}) {
    const first = !this.state;
    if (!this.state || this.state.size !== state.size)
      this.buildIsland(state.size);
    this.state = state;
    if (this.hallShown !== state.hall) {
      this.placeHall(state.hall, animate && !first);
      this.hallShown = state.hall;
    }
    for (const [key, id] of this.placed)
      if (state.tiles[key] !== id) {
        const old = this.buildings.getObjectByName(key);
        if (old) this.removeObject(old);
        this.placed.delete(key);
      }
    for (const [key, id] of Object.entries(state.tiles)) {
      if (this.placed.get(key) === id) continue;
      const [x, y] = key.split(",").map(Number);
      const obj = makeBuilding(id);
      obj.name = key;
      obj.position.set(x * T, 0, y * T);
      obj.rotation.y =
        ((x * 7 + y * 13) % 4) *
        (Math.PI / 2) *
        (id === "path" || id === "farm" ? 1 : 0);
      this.adopt(obj);
      this.buildings.add(obj);
      this.placed.set(key, id);
      if (animate && !first) this.rise(obj);
    }
    if (first) this.flyIn();
  }

  /** The building shown under the cursor while the player picks a tile. */
  preview(id: string | null) {
    if (this.ghost) this.scene.remove(this.ghost);
    this.ghost = null;
    if (!id) return;
    const g = makeBuilding(id);
    g.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.material = new THREE.MeshStandardMaterial({
          color: "#fff6d8",
          transparent: true,
          opacity: 0.55,
          depthWrite: false,
        });
        o.castShadow = false;
      }
    });
    g.visible = false;
    this.ghost = g;
    this.scene.add(g);
  }

  /** Marks a tile (the building picked to move), or none. */
  mark(tile: [number, number] | null) {
    this.cursor.visible = !!tile;
    if (tile) this.cursor.position.set(tile[0] * T, 0.08, tile[1] * T);
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    window.removeEventListener("resize", this.onResize);
    this.controls.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  // ---- building the world ----

  private buildIsland(size: number) {
    this.island.clear();
    this.tileMeshes = [];
    const { lo, hi } = landBounds(size);
    const c = ((lo + hi) / 2) * T;
    const radius = (size / 2 + 1.6) * T;
    const rand = seeded(7);

    // The grass top: a rounded slab, then the tiles of the land on it.
    const top = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius * 0.97, 0.7, 28),
      mat(C.meadow),
    );
    top.position.set(c, -0.35, c);
    top.receiveShadow = true;
    this.island.add(top);
    const soil = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.97, radius * 0.9, 0.8, 28),
      mat(C.soil),
    );
    soil.position.set(c, -1.1, c);
    this.island.add(soil);

    // The rock underneath, a jagged cone.
    const rockGeo = new THREE.ConeGeometry(
      radius * 0.92,
      radius * 2.1,
      14,
      5,
      true,
    );
    const pos = rockGeo.attributes.position;
    // Jitter by position, so the vertices a cone repeats (its seam and
    // apex) move together and the rock stays closed.
    const jitter = (x: number, y: number, z: number, n: number) => {
      const h =
        Math.sin(
          Math.round(x * 10) * 12.9898 +
            Math.round(y * 10) * 78.233 +
            Math.round(z * 10) * 37.719 +
            n,
        ) * 43758.5453;
      return h - Math.floor(h) - 0.5;
    };
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      if (y > radius * 1.04 || y < -radius * 1.04) continue;
      const k = 1 + jitter(x, y, z, 1) * 0.35;
      pos.setXYZ(i, x * k, y + jitter(x, y, z, 2) * 0.6, z * k);
    }
    rockGeo.computeVertexNormals();
    rockGeo.rotateX(Math.PI);
    const rock = new THREE.Mesh(rockGeo, mat(C.rock));
    rock.position.set(c, -1.5 - radius * 1.05, c);
    this.island.add(rock);
    for (let i = 0; i < 9; i++) {
      const a = rand() * Math.PI * 2;
      const r = radius * (0.5 + rand() * 0.4);
      const b = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.6 + rand() * 0.9, 0),
        mat(i % 2 ? C.rock : C.rockDark),
      );
      b.position.set(
        c + Math.cos(a) * r,
        -2 - rand() * radius * 0.6,
        c + Math.sin(a) * r,
      );
      this.island.add(b);
    }

    // Buildable tiles.
    const tileGeo = new THREE.BoxGeometry(T * 0.96, 0.12, T * 0.96);
    for (let x = lo; x <= hi; x++)
      for (let y = lo; y <= hi; y++) {
        const t = new THREE.Mesh(
          tileGeo,
          mat((x + y) % 2 ? C.grass : C.grassDark),
        );
        t.position.set(x * T, 0.0, y * T);
        t.receiveShadow = true;
        t.userData.tile = [x, y];
        this.island.add(t);
        this.tileMeshes.push(t);
      }

    // Trees and rocks on the meadow around the land.
    for (let i = 0; i < 26; i++) {
      const a = rand() * Math.PI * 2;
      const r = (size / 2 + 0.6 + rand() * 0.8) * T;
      const x = c + Math.cos(a) * r;
      const z = c + Math.sin(a) * r;
      if (Math.hypot(x - c, z - c) > radius - 0.6) continue;
      const tree = treeAt(x, z, 1.3 + rand() * 0.8, i % 3);
      tree.rotation.y = rand() * 6;
      this.island.add(tree);
    }

    // Waterfalls off the edge, from little springs.
    this.waters = [];
    for (const a of [2.3, 4.1]) {
      const tex = waterTexture();
      tex.repeat.set(1, 3);
      this.waters.push(tex);
      const x = c + Math.cos(a) * radius * 0.99;
      const z = c + Math.sin(a) * radius * 0.99;
      const fall = new THREE.Mesh(
        new THREE.PlaneGeometry(1.4, 14),
        new THREE.MeshStandardMaterial({
          map: tex,
          transparent: true,
          opacity: 0.9,
          emissive: "#9fdcff",
          emissiveIntensity: 0.25,
          side: THREE.DoubleSide,
        }),
      );
      fall.position.set(x, -7, z);
      fall.lookAt(c, -7, c);
      // A second sheet across the first, so the fall never shows edge-on.
      const across = fall.clone();
      across.rotateY(Math.PI / 2);
      across.scale.x = 0.6;
      this.island.add(fall, across);
      const pool = new THREE.Mesh(
        new THREE.CircleGeometry(0.8, 10).rotateX(-Math.PI / 2),
        mat(C.water, { roughness: 0.15, metalness: 0.1 }),
      );
      pool.position.set(
        c + Math.cos(a) * (radius - 0.9),
        0.02,
        c + Math.sin(a) * (radius - 0.9),
      );
      this.island.add(pool);
    }

    this.controls.target.set(c, 0.8, c);
  }

  private placeHall(stage: StageId, animate: boolean) {
    const old = this.buildings.getObjectByName("hall");
    if (old) this.removeObject(old);
    const hall = makeHall(stage);
    hall.name = "hall";
    this.adopt(hall);
    this.buildings.add(hall);
    if (this.fire) this.scene.remove(this.fire);
    this.fire = null;
    if (hall.userData.light) {
      this.fire = new THREE.PointLight("#ff9a40", 6, 9, 1.6);
      this.fire.position.copy(hall.userData.light).multiplyScalar(T / 1.8);
      this.scene.add(this.fire);
    }
    if (animate) this.rise(hall);
  }

  /** Registers a model's animated parts: flames, flags and chimney smoke. */
  private adopt(obj: THREE.Object3D) {
    obj.traverse((o) => {
      if (o.userData.flame) this.flames.push(o as THREE.Mesh);
      if (o.userData.flag) this.flags.push(o as THREE.Mesh);
    });
    const smoke = obj.userData.smoke as THREE.Vector3 | undefined;
    if (smoke && !this.options.reducedMotion) {
      const origin = smoke
        .clone()
        .multiplyScalar(obj.scale.x)
        .add(obj.position);
      for (let i = 0; i < 4; i++) {
        const sprite = new THREE.Sprite(
          new THREE.SpriteMaterial({
            map: puff(),
            color: "#f4efe8",
            transparent: true,
            opacity: 0,
            depthWrite: false,
          }),
        );
        sprite.userData.owner = obj;
        this.scene.add(sprite);
        this.smoke.push({ sprite, origin, t: i / 4 });
      }
    }
  }

  private removeObject(obj: THREE.Object3D) {
    this.buildings.remove(obj);
    this.flames = this.flames.filter((f) => !isChild(obj, f));
    this.flags = this.flags.filter((f) => !isChild(obj, f));
    this.smoke = this.smoke.filter((s) => {
      if (s.sprite.userData.owner !== obj) return true;
      this.scene.remove(s.sprite);
      return false;
    });
  }

  private rise(obj: THREE.Object3D) {
    const bounds = new THREE.Box3().setFromObject(obj);
    const size = bounds.getSize(new THREE.Vector3());
    const scaffold = new THREE.LineSegments(
      new THREE.EdgesGeometry(
        new THREE.BoxGeometry(size.x * 1.08, size.y * 1.05, size.z * 1.08),
      ),
      new THREE.LineBasicMaterial({ color: "#8a5a35", transparent: true }),
    );
    scaffold.position.set(obj.position.x, size.y * 0.525, obj.position.z);
    this.scene.add(scaffold);
    obj.scale.y = 0.001;
    this.rising.push({ obj, t: 0, scaffold });
    this.dust(obj.position);
  }

  private dust(at: THREE.Vector3) {
    if (this.options.reducedMotion) return;
    for (let i = 0; i < 10; i++) {
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: puff(),
          color: "#e8dcc4",
          transparent: true,
          opacity: 0.8,
          depthWrite: false,
        }),
      );
      sprite.position.copy(at);
      sprite.scale.setScalar(0.5);
      sprite.userData.v = new THREE.Vector3(
        Math.cos(i) * 1.6,
        0.6 + (i % 3) * 0.3,
        Math.sin(i) * 1.6,
      );
      sprite.userData.life = 0;
      this.scene.add(sprite);
      this.puffs.push(sprite);
    }
  }
  private puffs: THREE.Sprite[] = [];

  private addClouds() {
    const rand = seeded(42);
    for (let i = 0; i < 52; i++) {
      const a = rand() * Math.PI * 2;
      const below = i < 40;
      // The sea of clouds lies well under the island; the few clouds at the
      // island's height stay far off, so none drifts between it and the camera.
      const r = below ? 14 + rand() * 120 : 70 + rand() * 80;
      const puff = cloudPuff(rand, below ? 2.5 + rand() * 3.5 : 2 + rand() * 3);
      puff.position.set(
        Math.cos(a) * r,
        below ? -26 - rand() * 18 : -4 + rand() * 22,
        Math.sin(a) * r,
      );
      puff.userData.speed = 0.15 + rand() * 0.35;
      this.scene.add(puff);
      this.clouds.push(puff);
    }
  }

  private addBirds() {
    if (this.options.reducedMotion) return;
    const m = new THREE.MeshBasicMaterial({
      color: "#3a3a44",
      side: THREE.DoubleSide,
    });
    for (let i = 0; i < 5; i++) {
      const wing = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-0.35, 0.08, 0),
        new THREE.Vector3(0, 0, 0.12),
        new THREE.Vector3(0, 0, -0.06),
        new THREE.Vector3(0.35, 0.08, 0),
        new THREE.Vector3(0, 0, 0.12),
        new THREE.Vector3(0, 0, -0.06),
      ]);
      const bird = new THREE.Group();
      const left = new THREE.Mesh(wing, m);
      bird.add(left);
      bird.userData = {
        r: 22 + i * 3,
        h: 6 + i * 1.5,
        s: 0.1 + i * 0.015,
        p: i * 1.3,
      };
      bird.scale.setScalar(0.7);
      this.scene.add(bird);
      this.birds.push(bird);
    }
  }

  // ---- camera ----

  private flyIn() {
    const target = this.controls.target.clone();
    // A tall phone screen needs the camera further back to fit the island.
    const k = this.camera.aspect < 1 ? 1.75 : 1;
    const to = new THREE.Vector3(
      target.x + 15 * k,
      target.y + 13 * k,
      target.z + 22 * k,
    );
    if (this.options.reducedMotion) {
      this.camera.position.copy(to);
      this.camera.lookAt(target);
      return;
    }
    const from = new THREE.Vector3(target.x - 30, target.y + 55, target.z + 70);
    this.camera.position.copy(from);
    this.camera.lookAt(target);
    this.controls.enabled = false;
    this.flight = { t: 0, from, to, target };
  }

  // ---- input ----

  private onDown = (e: PointerEvent) => {
    this.down = { x: e.clientX, y: e.clientY };
  };
  private onUp = (e: PointerEvent) => {
    if (!this.down || this.flight) return;
    const moved = Math.hypot(e.clientX - this.down.x, e.clientY - this.down.y);
    this.down = null;
    if (moved > 8) return;
    const tile = this.tileAt(e);
    if (tile) this.options.onTile(tile[0], tile[1]);
  };
  private onMove = (e: PointerEvent) => {
    if (!this.ghost) return;
    const tile = this.tileAt(e);
    this.ghost.visible = !!tile;
    if (tile) this.ghost.position.set(tile[0] * T, 0.02, tile[1] * T);
  };
  private tileAt(e: PointerEvent): [number, number] | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(this.pointer, this.camera);
    // Hits on buildings count for the tile they stand on.
    const hits = this.raycaster.intersectObjects(
      [...this.tileMeshes, ...this.buildings.children],
      true,
    );
    for (const hit of hits) {
      let o: THREE.Object3D | null = hit.object;
      while (o && !o.userData.tile && o.parent !== this.buildings) o = o.parent;
      if (o?.userData.tile) return o.userData.tile;
      if (o && o.name === "hall") return [0, 0];
      if (o && /^-?\d+,-?\d+$/.test(o.name))
        return o.name.split(",").map(Number) as [number, number];
    }
    return null;
  }
  private onResize = () => {
    const w = this.host.clientWidth;
    const h = this.host.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer?.setSize(w, h);
  };

  // ---- the frame ----

  private loop = () => {
    if (this.disposed) return;
    this.frame = requestAnimationFrame(this.loop);
    this.realDt = this.clock.getDelta();
    const dt = Math.min(this.realDt, 0.05);
    const time = this.clock.elapsedTime;

    if (this.flight) {
      const f = this.flight;
      f.t = Math.min(1, f.t + this.realDt / 4.2);
      const e = 1 - (1 - f.t) ** 3;
      // Swing in on a curve, dropping out of the clouds.
      const p = f.from.clone().lerp(f.to, e);
      p.y += Math.sin(e * Math.PI) * 6;
      this.camera.position.copy(p);
      this.camera.lookAt(f.target);
      if (f.t >= 1) {
        this.flight = null;
        this.controls.enabled = true;
      }
    } else this.controls.update();

    for (const cloud of this.clouds) {
      cloud.position.x += cloud.userData.speed * dt;
      if (cloud.position.x > 150) cloud.position.x -= 300;
    }
    for (const b of this.birds) {
      const { r, h, s, p } = b.userData;
      const a = time * s + p;
      const c = this.controls.target;
      b.position.set(
        c.x + Math.cos(a) * r,
        h + Math.sin(time * 0.7 + p) * 0.6,
        c.z + Math.sin(a) * r,
      );
      b.rotation.y = -a;
      b.children[0].scale.y = 1 + Math.sin(time * 9 + p) * 0.9;
    }
    for (const tex of this.waters) tex.offset.y += dt * 1.4;
    for (const f of this.flames) {
      f.scale.set(
        1 + Math.sin(time * 13) * 0.08,
        1 + Math.sin(time * 9 + 1) * 0.18,
        1 + Math.cos(time * 11) * 0.08,
      );
    }
    if (this.fire)
      this.fire.intensity =
        6 + Math.sin(time * 10) * 0.8 + Math.sin(time * 23) * 0.5;
    for (const f of this.flags)
      f.rotation.y = Math.sin(time * 2.6 + f.position.x) * 0.35;
    for (const s of this.smoke) {
      s.t = (s.t + dt * 0.22) % 1;
      s.sprite.position
        .copy(s.origin)
        .add(new THREE.Vector3(s.t * 0.9, s.t * 2.4, s.t * 0.3));
      s.sprite.scale.setScalar(0.25 + s.t * 0.9);
      s.sprite.material.opacity = Math.sin(s.t * Math.PI) * 0.55;
    }
    for (const r of this.rising) {
      r.t = Math.min(1, r.t + dt / 1.3);
      const e = 1 - (1 - r.t) ** 3;
      r.obj.scale.y = Math.max(0.001, e) * r.obj.scale.x;
      (r.scaffold.material as THREE.LineBasicMaterial).opacity = 1 - r.t;
      if (r.t >= 1) this.scene.remove(r.scaffold);
    }
    this.rising = this.rising.filter((r) => r.t < 1);
    for (const p of this.puffs) {
      p.userData.life += dt;
      p.position.addScaledVector(p.userData.v, dt);
      p.scale.setScalar(0.5 + p.userData.life * 1.4);
      p.material.opacity = Math.max(0, 0.8 - p.userData.life);
      if (p.userData.life > 0.8) this.scene.remove(p);
    }
    this.puffs = this.puffs.filter((p) => p.userData.life <= 0.8);
    if (this.cursor.visible)
      (this.cursor.material as THREE.MeshBasicMaterial).opacity =
        0.6 + Math.sin(time * 5) * 0.3;

    if (this.composer) this.composer.render(dt);
    else this.renderer.render(this.scene, this.camera);
    this.adapt(dt);
  };

  /** Turns effects down on a device that can't keep up. */
  private adapt(dt: number) {
    if (this.flight || this.sampled > 240) return;
    this.sampled += 1;
    if (dt > 1 / 40) this.slowFrames += 1;
    if (this.sampled === 240 && this.slowFrames > 90) {
      this.composer = null;
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
      this.renderer.shadowMap.type = THREE.PCFShadowMap;
    }
  }
}

function isChild(parent: THREE.Object3D, child: THREE.Object3D) {
  let o: THREE.Object3D | null = child;
  while (o) {
    if (o === parent) return true;
    o = o.parent;
  }
  return false;
}

export function webglAvailable() {
  try {
    const canvas = document.createElement("canvas");
    return !!(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}
