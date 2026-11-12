// The kingdom's buildings, made from the Polyfork Medieval Village kit
// (public/models/kingdom, CC BY 4.0, credited in CREDITS.md there). Each
// building is a small arrangement of kit models laid out in meters; one world
// unit is 3 m, so a 2-unit tile is 6 m across and the hall's 3 x 3 grounds
// are 18 m. The kit has no castle, so the keep, castle and palace add stone
// walls and towers drawn here, textured and coloured to match the kit.
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { StageId } from "@/data/kingdom.mjs";

export const METER = 1 / 3; // world units per meter

const FILES = {
  cottage: "thatched-cottage-0e63f5",
  house: "two-story-house-40f6dc",
  tavern: "village-tavern-4e94e3",
  chapel: "stone-chapel-03e774",
  watchtower: "watchtower-140f78",
  windmill: "windmill-3aad49",
  forge: "blacksmith-forge-09fa85",
  gatehouse: "village-gatehouse-181a9e",
  barn: "timber-barn-90b3ce",
  granary: "stilted-granary-3e7d7d",
  well: "village-well-f8e361",
  stall: "market-stall-94937d",
  fountain: "plaza-fountain-5a5f6e",
  statue: "standing-knight-statue-8bdcc9",
  crown: "crown-a294ce",
  lamp: "lamp-post-c9e409",
  signpost: "signpost-8287c3",
  planter: "flower-planter-500ed2",
  flowerBed: "flower-bed-708e73",
  sunflower: "sunflower-80ce15",
  wildflower: "wildflower-68d3a1",
  wheat: "wheat-plant-7f29a1",
  haystack: "haystack-77b0dd",
  barrel: "barrel-aadc94",
  crate: "wooden-crate-b9c96a",
  sack: "grain-sack-401d96",
  anvil: "anvil-1286cb",
  quench: "quench-barrel-0c78fd",
  trough: "water-trough-318ee1",
  cart: "wooden-cart-bf83d8",
  wagon: "four-wheel-wagon-adb946",
  wheelbarrow: "wheelbarrow-13f422",
  fence: "wooden-fence-3d8ee7",
  firePit: "stone-fire-pit-4136b0",
  tripod: "campfire-cook-tripod-d95a1e",
  tent: "camp-tent-3c5c89",
  stump: "tree-stump-8c0513",
  pathA: "path-stone-a-aead48",
  pathB: "path-stone-b-6ed75c",
  oak: "oak-tree-50ee7c",
  broadleaf: "broadleaf-oak-997c22",
  apple: "orchard-apple-tree-b21f85",
  birch: "birch-tree-181b33",
  pine: "tall-pine-tree-ab4108",
  bush: "round-bush-cd2ac0",
  shrub: "bush-8bb596",
  tuft: "grass-tuft-5ccff0",
  boulder: "large-boulder-a29b99",
  rock: "small-rock-d43710",
  spire: "rock-spire-13819c",
  villager: "villager-40255c",
  tradesman: "tradesman-1707b9",
  merchant: "merchant-6f606b",
  guard: "village-guard-5f0f6f",
} as const;
export type ModelName = keyof typeof FILES;
export const PEOPLE: ModelName[] = [
  "villager",
  "tradesman",
  "merchant",
  "guard",
];

type Loaded = { scene: THREE.Object3D; clips: THREE.AnimationClip[] };
const cache = new Map<ModelName, Loaded>();
const loads = new Map<string, Promise<void>>();
const BASE = "/models/kingdom/";

function load(names: ModelName[], key: string) {
  let p = loads.get(key);
  if (p) return p;
  const loader = new GLTFLoader();
  p = Promise.all(
    names.map(async (name) => {
      const gltf = await loader.loadAsync(`${BASE}${FILES[name]}.glb`);
      const root = gltf.scene;
      // Stand every model on y = 0, centred on its footprint.
      const box = new THREE.Box3().setFromObject(root);
      const centre = box.getCenter(new THREE.Vector3());
      const wrap = new THREE.Group();
      root.position.set(-centre.x, -box.min.y, -centre.z);
      wrap.add(root);
      wrap.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.castShadow = true;
          o.receiveShadow = true;
          o.frustumCulled = !(o instanceof THREE.SkinnedMesh);
        }
      });
      cache.set(name, { scene: wrap, clips: gltf.animations });
    }),
  ).then(() => undefined);
  loads.set(key, p);
  return p;
}
/** Loads the buildings and scenery once; later calls share the promise. */
export const loadModels = () =>
  load(
    (Object.keys(FILES) as ModelName[]).filter((n) => !PEOPLE.includes(n)),
    "world",
  );
/** The walking villagers, loaded after the kingdom is on screen. */
export const loadPeople = () => load(PEOPLE, "people");

/** A copy of a model, in meters. */
export function model(name: ModelName): THREE.Object3D {
  const m = cache.get(name);
  if (!m) return new THREE.Group();
  if (m.clips.length) {
    const c = cloneSkinned(m.scene);
    c.userData.clips = m.clips;
    return c;
  }
  const c = m.scene.clone();
  // Mark the kit's moving parts for the scene to animate.
  c.traverse((o) => {
    if (o.name === "sails") o.userData.spin = "z";
    if (/^flame(-\d)?$/.test(o.name)) o.userData.flame = true;
  });
  return c;
}

type Place = { x?: number; z?: number; y?: number; ry?: number; s?: number };
/** Adds a model to a group at x,z meters, turned by ry radians. */
function put(g: THREE.Group, name: ModelName, p: Place = {}) {
  const o = model(name);
  o.position.set(p.x ?? 0, p.y ?? 0, p.z ?? 0);
  o.rotation.y = p.ry ?? 0;
  o.scale.setScalar(p.s ?? 1);
  g.add(o);
  return o;
}
/** A finished building: laid out in meters, shown in world units. */
function finish(inner: THREE.Group, extra: Record<string, unknown> = {}) {
  inner.scale.setScalar(METER);
  const g = new THREE.Group();
  g.add(inner);
  for (const [k, v] of Object.entries(extra))
    g.userData[k] =
      v instanceof THREE.Vector3 ? v.clone().multiplyScalar(METER) : v;
  return g;
}
function seeded(seed: number) {
  let s = (Math.abs(Math.floor(seed)) % 2147483646) + 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

// ---- stone, roofs and banners for the castle -----------------------------

let stoneTex: THREE.CanvasTexture | null = null;
/** Pale ashlar blocks with soft mortar, like the kit's chapel. */
function stoneTexture() {
  if (stoneTex) return stoneTex;
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  g.fillStyle = "#b7ab98";
  g.fillRect(0, 0, 256, 256);
  const rand = seeded(11);
  const rows = 8;
  const h = 256 / rows;
  for (let r = 0; r < rows; r++) {
    let x = r % 2 ? -24 : 0;
    while (x < 256) {
      const w = 40 + rand() * 34;
      const l = 82 + rand() * 10;
      g.fillStyle = `hsl(${36 + rand() * 8}, ${18 + rand() * 10}%, ${l}%)`;
      g.fillRect(x + 2, r * h + 2, w - 4, h - 4);
      if (x + w > 256) g.fillRect(x + 2 - 256, r * h + 2, w - 4, h - 4);
      x += w;
    }
  }
  stoneTex = new THREE.CanvasTexture(c);
  stoneTex.wrapS = stoneTex.wrapT = THREE.RepeatWrapping;
  stoneTex.colorSpace = THREE.SRGBColorSpace;
  stoneTex.anisotropy = 4;
  return stoneTex;
}
const matCache = new Map<string, THREE.Material>();
function stone(rx: number, ry: number) {
  const key = `stone:${rx.toFixed(1)}:${ry.toFixed(1)}`;
  let m = matCache.get(key);
  if (!m) {
    const t = stoneTexture().clone();
    t.repeat.set(rx, ry);
    t.needsUpdate = true;
    m = new THREE.MeshStandardMaterial({ map: t, roughness: 0.92 });
    matCache.set(key, m);
  }
  return m;
}
function plain(
  color: string,
  extra: THREE.MeshStandardMaterialParameters = {},
) {
  const key = `${color}:${JSON.stringify(extra)}`;
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...extra });
    matCache.set(key, m);
  }
  return m;
}
const ROOF = "#b8463a"; // the kit's red tiles
const ROOF_DARK = "#8f3129";
const GOLD = "#e8b84a";
const WINDOW = "#2c3346";

function mesh(
  geo: THREE.BufferGeometry,
  m: THREE.Material,
  x = 0,
  y = 0,
  z = 0,
) {
  const o = new THREE.Mesh(geo, m);
  o.position.set(x, y, z);
  o.castShadow = true;
  o.receiveShadow = true;
  return o;
}

/** A straight crenellated wall, w long along x, centred on x,z. */
function wall(
  g: THREE.Group,
  w: number,
  h: number,
  x: number,
  z: number,
  ry = 0,
) {
  const d = 1.4;
  const part = new THREE.Group();
  part.add(mesh(new THREE.BoxGeometry(w, h, d), stone(w / 3, h / 3), 0, h / 2));
  // A walkway lip and the merlons on top.
  part.add(
    mesh(new THREE.BoxGeometry(w + 0.2, 0.3, d + 0.4), stone(w / 3, 0.1), 0, h),
  );
  const n = Math.max(2, Math.round(w / 1.3));
  const step = w / n;
  const merlon = new THREE.BoxGeometry(step * 0.55, 0.9, 0.5);
  for (let i = 0; i < n; i++)
    for (const side of [-1, 1])
      part.add(
        mesh(
          merlon,
          stone(0.3, 0.3),
          -w / 2 + step * (i + 0.5),
          h + 0.6,
          side * (d / 2 - 0.05),
        ),
      );
  part.position.set(x, 0, z);
  part.rotation.y = ry;
  g.add(part);
  return part;
}

/** A pennant on a pole, its cloth marked to wave. */
function banner(
  g: THREE.Group,
  x: number,
  y: number,
  z: number,
  h = 3,
  color = ROOF,
) {
  g.add(
    mesh(
      new THREE.CylinderGeometry(0.06, 0.06, h, 6),
      plain("#5b4632"),
      x,
      y + h / 2,
      z,
    ),
  );
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(1.6, -0.45);
  shape.lineTo(0, -0.9);
  const cloth = mesh(
    new THREE.ShapeGeometry(shape),
    plain(color, { side: THREE.DoubleSide }),
    x,
    y + h - 0.05,
    z,
  );
  cloth.userData.flag = true;
  g.add(cloth);
}

/** Dark arched window insets on a facade. */
function windows(
  g: THREE.Group,
  count: number,
  w: number,
  y: number,
  z: number,
  x0 = 0,
  ry = 0,
  size = 1,
) {
  const geo = new THREE.BoxGeometry(0.7 * size, 1.4 * size, 0.2);
  const top = new THREE.CylinderGeometry(
    0.35 * size,
    0.35 * size,
    0.2,
    10,
    1,
    false,
    0,
    Math.PI,
  );
  top.rotateX(Math.PI / 2).rotateZ(Math.PI / 2);
  const holder = new THREE.Group();
  for (let i = 0; i < count; i++) {
    const x = -w / 2 + (w / count) * (i + 0.5);
    holder.add(mesh(geo, plain(WINDOW, { roughness: 0.4 }), x, y, 0));
    holder.add(
      mesh(top, plain(WINDOW, { roughness: 0.4 }), x, y + 0.7 * size, 0),
    );
  }
  holder.position.set(x0, 0, z);
  holder.rotation.y = ry;
  g.add(holder);
}

/** A round stone tower with a red cone roof and a banner. */
function roundTower(
  g: THREE.Group,
  x: number,
  z: number,
  r: number,
  h: number,
  opts: { spire?: number; gold?: boolean; flag?: string; roof?: string } = {},
) {
  const circ = 2 * Math.PI * r;
  g.add(
    mesh(
      new THREE.CylinderGeometry(r, r * 1.08, h, 20),
      stone(circ / 3, h / 3),
      x,
      h / 2,
      z,
    ),
  );
  // A corbelled ring and crenellations, then the roof above.
  g.add(
    mesh(
      new THREE.CylinderGeometry(r + 0.35, r, 0.6, 20),
      stone(circ / 3, 0.2),
      x,
      h + 0.3,
      z,
    ),
  );
  const n = 10;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    g.add(
      mesh(
        new THREE.BoxGeometry(0.55, 0.8, 0.4),
        stone(0.3, 0.3),
        x + Math.cos(a) * (r + 0.15),
        h + 1,
        z + Math.sin(a) * (r + 0.15),
      ),
    );
  }
  const spire = opts.spire ?? r * 2.4;
  const roof = mesh(
    new THREE.ConeGeometry(r + 0.25, spire, 20),
    plain(opts.roof ?? ROOF),
    x,
    h + 0.7 + spire / 2,
    z,
  );
  g.add(roof);
  const top = h + 0.7 + spire;
  if (opts.gold)
    g.add(
      mesh(
        new THREE.SphereGeometry(0.3, 10, 8),
        plain(GOLD, { metalness: 0.7, roughness: 0.3 }),
        x,
        top + 0.1,
        z,
      ),
    );
  banner(g, x, top, z, 2.2, opts.flag ?? ROOF);
  // Arrow slits.
  for (let i = 0; i < 3; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    const slit = mesh(
      new THREE.BoxGeometry(0.25, 1.2, 0.3),
      plain(WINDOW),
      x + Math.cos(a) * r,
      h * 0.62,
      z + Math.sin(a) * r,
    );
    slit.rotation.y = -a;
    g.add(slit);
  }
}

/** A square keep: tall stone block, crenellated, with corner turrets. */
function keep(
  g: THREE.Group,
  x: number,
  z: number,
  w: number,
  h: number,
  opts: {
    turrets?: boolean;
    roof?: number;
    gold?: boolean;
    color?: string;
  } = {},
) {
  const tile = opts.color ?? ROOF;
  g.add(mesh(new THREE.BoxGeometry(w, h, w), stone(w / 3, h / 3), x, h / 2, z));
  // A plinth and a string course give the block some weight.
  g.add(
    mesh(
      new THREE.BoxGeometry(w + 0.6, 1.2, w + 0.6),
      stone(w / 3, 0.4),
      x,
      0.6,
      z,
    ),
  );
  g.add(
    mesh(
      new THREE.BoxGeometry(w + 0.3, 0.35, w + 0.3),
      stone(w / 3, 0.1),
      x,
      h * 0.55,
      z,
    ),
  );
  for (const ry of [0, Math.PI / 2, Math.PI, -Math.PI / 2])
    wallTop(g, w, x, h, z, ry);
  for (const ry of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    windows(g, Math.max(2, Math.round(w / 2.6)), w * 0.8, h * 0.4, 0, 0, ry, 1);
    windows(
      g,
      Math.max(2, Math.round(w / 2.6)),
      w * 0.8,
      h * 0.74,
      0,
      0,
      ry,
      0.9,
    );
  }
  // Move the window holders out to the facades.
  for (const child of g.children.slice(-8)) {
    const ry = child.rotation.y;
    child.position.set(
      x + Math.sin(ry) * (w / 2 + 0.05),
      0,
      z + Math.cos(ry) * (w / 2 + 0.05),
    );
  }
  if (opts.roof) {
    const roof = mesh(
      new THREE.ConeGeometry(w * 0.62, opts.roof, 4),
      plain(tile),
      x,
      h + 0.4 + opts.roof / 2,
      z,
    );
    roof.rotation.y = Math.PI / 4;
    g.add(roof);
    if (opts.gold)
      g.add(
        mesh(
          new THREE.SphereGeometry(0.35, 10, 8),
          plain(GOLD, { metalness: 0.7, roughness: 0.3 }),
          x,
          h + 0.5 + opts.roof,
          z,
        ),
      );
  }
  if (opts.turrets)
    for (const [sx, sz] of [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ]) {
      const tx = x + sx * (w / 2);
      const tz = z + sz * (w / 2);
      g.add(
        mesh(
          new THREE.CylinderGeometry(0.9, 0.5, 1.6, 12),
          stone(1, 0.5),
          tx,
          h - 0.4,
          tz,
        ),
      );
      g.add(
        mesh(
          new THREE.CylinderGeometry(0.9, 0.9, 2.2, 12),
          stone(1.8, 0.7),
          tx,
          h + 1.1,
          tz,
        ),
      );
      g.add(
        mesh(new THREE.ConeGeometry(1.15, 3, 12), plain(tile), tx, h + 3.7, tz),
      );
    }
}
function wallTop(
  g: THREE.Group,
  w: number,
  x: number,
  h: number,
  z: number,
  ry: number,
) {
  const n = Math.max(3, Math.round(w / 1.3));
  const step = w / n;
  const merlon = new THREE.BoxGeometry(step * 0.55, 0.9, 0.5);
  const holder = new THREE.Group();
  for (let i = 0; i < n; i++)
    holder.add(
      mesh(
        merlon,
        stone(0.3, 0.3),
        -w / 2 + step * (i + 0.5),
        h + 0.45,
        w / 2 - 0.2,
      ),
    );
  holder.position.set(x, 0, z);
  holder.rotation.y = ry;
  g.add(holder);
}

/** Four walls with round corner towers and the kit's gatehouse in front. */
function curtain(
  g: THREE.Group,
  half: number,
  h: number,
  tower: {
    r: number;
    h: number;
    spire?: number;
    gold?: boolean;
    flag?: string;
    roof?: string;
  },
) {
  const side = half * 2;
  wall(g, side, h, 0, -half);
  wall(g, side, h, -half, 0, Math.PI / 2);
  wall(g, side, h, half, 0, Math.PI / 2);
  // The front wall leaves room for the gatehouse (6 m wide).
  const seg = half - 3;
  wall(g, seg, h, -3 - seg / 2, half);
  wall(g, seg, h, 3 + seg / 2, half);
  for (const [sx, sz] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ])
    roundTower(g, sx * half, sz * half, tower.r, tower.h, tower);
  put(g, "gatehouse", { z: half, s: Math.max(1, h / 5) });
}

// ---- tile buildings --------------------------------------------------------

type Maker = (rand: () => number) => THREE.Group;
const M: Record<string, Maker> = {
  path: (rand) => {
    const g = new THREE.Group();
    g.add(
      mesh(
        new THREE.BoxGeometry(5.8, 0.08, 5.8),
        plain("#b49a74", { roughness: 1 }),
        0,
        0.04,
        0,
      ),
    );
    for (let i = 0; i < 16; i++)
      put(g, i % 2 ? "pathA" : "pathB", {
        x: -2.3 + (i % 4) * 1.5 + rand() * 0.4,
        z: -2.3 + Math.floor(i / 4) * 1.5 + rand() * 0.4,
        y: 0.05,
        ry: rand() * 6,
        s: 1.25,
      });
    return finish(g);
  },
  tree: (rand) => {
    const g = new THREE.Group();
    const kinds: ModelName[] = ["oak", "broadleaf", "apple", "birch", "pine"];
    put(g, kinds[Math.floor(rand() * kinds.length)], {
      ry: rand() * 6,
      s: 0.95 + rand() * 0.3,
    });
    put(g, "bush", { x: 1.9, z: 1.6, ry: rand() * 6, s: 1.1 });
    put(g, "tuft", { x: -1.8, z: 1.8, s: 1.4 });
    return finish(g);
  },
  flowers: (rand) => {
    const g = new THREE.Group();
    put(g, "flowerBed", { x: -1.2, z: -1, s: 1.8 });
    put(g, "flowerBed", { x: 1.3, z: 1.1, s: 1.8, ry: 0.4 });
    for (let i = 0; i < 6; i++)
      put(g, i % 2 ? "sunflower" : "wildflower", {
        x: -2.4 + rand() * 4.8,
        z: -2.4 + rand() * 4.8,
        ry: rand() * 6,
        s: i % 2 ? 1.1 : 2.2,
      });
    put(g, "planter", { x: 1.6, z: -1.8, ry: 0.3, s: 1.5 });
    return finish(g);
  },
  cottage: (rand) => {
    const g = new THREE.Group();
    put(g, "cottage", { z: -0.3, s: 0.88 });
    put(g, "barrel", { x: 2.4, z: 2.2 });
    put(g, "crate", { x: 1.6, z: 2.5, ry: 0.4 });
    put(g, "planter", { x: -1.2, z: 2.1 });
    if (rand() > 0.5) put(g, "wheelbarrow", { x: -2.4, z: 1.8, ry: 1.2 });
    return finish(g, { smoke: new THREE.Vector3(1.5, 5.4, -1.2) });
  },
  farm: (rand) => {
    const g = new THREE.Group();
    g.add(
      mesh(
        new THREE.BoxGeometry(5.6, 0.12, 5.6),
        plain("#8a6a45", { roughness: 1 }),
        0,
        0.06,
        0,
      ),
    );
    for (let i = 0; i < 9; i++)
      for (let j = 0; j < 7; j++)
        put(g, "wheat", {
          x: -2.4 + i * 0.6 + rand() * 0.15,
          z: -1.2 + j * 0.6 + rand() * 0.15,
          ry: rand() * 6,
          s: 1.5 + rand() * 0.3,
        });
    put(g, "haystack", { x: -1.4, z: -2, s: 0.9 });
    put(g, "fence", { x: 1.4, z: -2.7, s: 1 });
    put(g, "sack", { x: 0.2, z: -2.2 });
    return finish(g);
  },
  house: () => {
    const g = new THREE.Group();
    put(g, "house", { s: 0.74 });
    put(g, "planter", { x: -1.8, z: 2.6 });
    put(g, "barrel", { x: 2.4, z: 2.3 });
    return finish(g, { smoke: new THREE.Vector3(1.5, 7, -1.5) });
  },
  well: () => {
    const g = new THREE.Group();
    put(g, "well", { s: 1.3 });
    put(g, "trough", { x: 1.4, z: 2.2, ry: 0.2 });
    put(g, "lamp", { x: -2.2, z: 1.8, ry: 0.8 });
    put(g, "flowerBed", { x: -1.9, z: -1.9, ry: 0.5, s: 1.2 });
    return finish(g);
  },
  market: (rand) => {
    const g = new THREE.Group();
    put(g, "stall", { x: -1.1, z: -0.6, s: 1.3, ry: 0.15 });
    put(g, "stall", { x: 1.4, z: 0.7, s: 1.2, ry: -0.5 });
    put(g, "crate", { x: -2.3, z: 1.6, ry: rand() });
    put(g, "crate", { x: -1.5, z: 2.1, ry: rand() });
    put(g, "barrel", { x: 2.4, z: -1.6 });
    put(g, "sack", { x: 0, z: 2.2 });
    return finish(g);
  },
  windmill: () => {
    const g = new THREE.Group();
    put(g, "windmill", { s: 1.0, ry: -0.5 });
    put(g, "sack", { x: 2.2, z: 2.2 });
    put(g, "sack", { x: 2.7, z: 1.7, ry: 1 });
    put(g, "cart", { x: -2, z: 2.1, ry: 0.9, s: 0.9 });
    return finish(g);
  },
  forge: () => {
    const g = new THREE.Group();
    put(g, "forge", { z: -0.3, s: 1.0 });
    put(g, "anvil", { x: 1.8, z: 2.2 });
    put(g, "quench", { x: -1.9, z: 2.2 });
    put(g, "crate", { x: 2.6, z: -2, ry: 0.4 });
    return finish(g, { smoke: new THREE.Vector3(0.5, 4.2, -1.6) });
  },
  tower: () => {
    const g = new THREE.Group();
    put(g, "watchtower", { s: 1.1 });
    put(g, "barrel", { x: 1.9, z: 2 });
    put(g, "crate", { x: -2, z: 2, ry: 0.5 });
    return finish(g);
  },
  chapel: () => {
    const g = new THREE.Group();
    put(g, "chapel", { s: 0.9, z: -0.2 });
    put(g, "lamp", { x: 2.4, z: 2.6 });
    put(g, "planter", { x: -2, z: 2.6 });
    return finish(g);
  },
  fountain: () => {
    const g = new THREE.Group();
    put(g, "fountain", { s: 1.9 });
    for (const [x, z] of [
      [-2.6, -2.6],
      [2.6, -2.6],
      [-2.6, 2.6],
      [2.6, 2.6],
    ])
      put(g, "lamp", { x, z, ry: Math.atan2(x, z) + Math.PI });
    return finish(g);
  },
  statue: () => {
    const g = new THREE.Group();
    g.add(
      mesh(
        new THREE.CylinderGeometry(2.2, 2.4, 0.3, 24),
        stone(3, 0.2),
        0,
        0.15,
        0,
      ),
    );
    put(g, "statue", { y: 0.3, s: 1.9 });
    put(g, "flowerBed", { x: -1.8, z: 1.8, ry: 0.8, s: 1.1 });
    put(g, "flowerBed", { x: 1.8, z: 1.8, ry: -0.8, s: 1.1 });
    return finish(g);
  },
};

/** A tile building; `seed` varies the details from tile to tile. */
export function makeBuilding(id: string, seed = 1): THREE.Group {
  return (M[id] ?? M.cottage)(seeded(seed * 9301 + 49297));
}

// ---- the hall, from campfire to palace -------------------------------------

const HALLS: Record<StageId, () => THREE.Group> = {
  camp: () => {
    const g = new THREE.Group();
    put(g, "firePit", { s: 1.5 });
    put(g, "tripod", { s: 1.4 });
    put(g, "tent", { x: -4.6, z: -3.2, ry: 0.7, s: 1.5 });
    put(g, "tent", { x: 4.4, z: -3.6, ry: -0.6, s: 1.5 });
    put(g, "tent", { x: 0.2, z: -6, s: 1.5 });
    put(g, "stump", { x: -2.4, z: 1.4 });
    put(g, "stump", { x: 2.3, z: 1.6, ry: 2 });
    put(g, "stump", { x: 0.2, z: 2.8, ry: 4 });
    put(g, "crate", { x: -6.5, z: -0.5, ry: 0.4 });
    put(g, "barrel", { x: -6.2, z: 0.6 });
    put(g, "sack", { x: 6.2, z: -0.8 });
    put(g, "cart", { x: 5.5, z: 3.5, ry: -1, s: 1 });
    return finish(g, {
      light: new THREE.Vector3(0, 1.2, 0),
      smoke: new THREE.Vector3(0, 1.5, 0),
    });
  },
  village: () => {
    const g = new THREE.Group();
    put(g, "house", { z: -2.5, s: 1.05 });
    put(g, "planter", { x: -2.3, z: 2.2 });
    put(g, "planter", { x: 2.3, z: 2.2 });
    put(g, "lamp", { x: -4, z: 4.5 });
    put(g, "lamp", { x: 4, z: 4.5 });
    put(g, "signpost", { x: 6.3, z: 5.5, ry: -0.6 });
    put(g, "wagon", { x: -6, z: 3, ry: 0.6 });
    put(g, "barrel", { x: 5.2, z: -1.5 });
    put(g, "barrel", { x: 5.8, z: -0.7 });
    put(g, "granary", { x: -6, z: -5, ry: 0.4 });
    for (let i = 0; i < 6; i++)
      put(g, "fence", { x: -5 + i * 2, z: 8.2, s: 1 });
    banner(g, 0, 8.6, -2.5, 2.4);
    return finish(g, { smoke: new THREE.Vector3(2, 9.6, -4) });
  },
  town: () => {
    const g = new THREE.Group();
    plaza(g, 8.6);
    put(g, "tavern", { z: -2.6, s: 1.0 });
    put(g, "lamp", { x: -5.5, z: 4 });
    put(g, "lamp", { x: 5.5, z: 4 });
    put(g, "flowerBed", { x: -3, z: 5.5, s: 1.3 });
    put(g, "flowerBed", { x: 3, z: 5.5, s: 1.3 });
    put(g, "cart", { x: 6.5, z: 6, ry: -0.8 });
    put(g, "barrel", { x: -7, z: 2 });
    put(g, "barrel", { x: -7.6, z: 2.8 });
    put(g, "crate", { x: -6.8, z: 3.6, ry: 0.3 });
    put(g, "signpost", { x: 0, z: 7.4, ry: 0.2 });
    banner(g, -6.4, 0, -2.6, 9);
    banner(g, 6.4, 0, -2.6, 9);
    return finish(g, { smoke: new THREE.Vector3(-4.6, 11.5, -5.5) });
  },
  city: () => {
    const g = new THREE.Group();
    plaza(g, 7.2);
    keep(g, 0, -1.5, 7, 13, { turrets: true });
    curtain(g, 7.6, 3.6, { r: 1.5, h: 6.5 });
    put(g, "lamp", { x: -2.6, z: 4.6 });
    put(g, "lamp", { x: 2.6, z: 4.6 });
    put(g, "barrel", { x: 5, z: 3 });
    put(g, "crate", { x: -5, z: 3, ry: 0.4 });
    banner(g, 0, 14.5, -1.5, 3.4);
    return finish(g);
  },
  kingdom: () => {
    const g = new THREE.Group();
    plaza(g, 7.4);
    keep(g, 0, -2, 7.6, 15, { turrets: true, roof: 6 });
    // A great hall leaning on the keep.
    g.add(mesh(new THREE.BoxGeometry(4, 6, 6), stone(1.4, 2), -5, 3, -1));
    const hallRoof = mesh(
      new THREE.CylinderGeometry(0.01, 3.3, 4.2, 4, 1),
      plain(ROOF_DARK),
      -5,
      7.6,
      -1,
    );
    hallRoof.rotation.y = Math.PI / 4;
    hallRoof.scale.set(0.75, 1, 1.1);
    g.add(hallRoof);
    curtain(g, 7.8, 5, { r: 1.7, h: 8.5, flag: "#2f5aa8" });
    put(g, "statue", { x: -2.4, z: 5.4, s: 1.2 });
    put(g, "statue", { x: 2.4, z: 5.4, s: 1.2 });
    put(g, "lamp", { x: -4.5, z: 4.5 });
    put(g, "lamp", { x: 4.5, z: 4.5 });
    banner(g, -3.8, 0, 2, 6, "#2f5aa8");
    banner(g, 3.8, 0, 2, 6, "#2f5aa8");
    return finish(g);
  },
  capital: () => {
    // The palace: royal blue slate and gold over pale stone, a long
    // two-storey front with a great tower behind, inside a grand wall.
    const g = new THREE.Group();
    plaza(g, 8);
    const BLUE = "#35558f";
    const gold = plain(GOLD, { metalness: 0.7, roughness: 0.3 });
    keep(g, 0, -4.2, 5.6, 19, { roof: 9, gold: true, color: BLUE });
    put(g, "crown", { y: 19 + 0.4 + 9 + 0.6, z: -4.2, s: 4.2 });
    // The front range, with a tall entrance bay in the middle.
    g.add(
      mesh(
        new THREE.BoxGeometry(12.4, 8.5, 4.6),
        stone(4.2, 2.8),
        0,
        4.25,
        -0.6,
      ),
    );
    g.add(
      mesh(new THREE.BoxGeometry(12.8, 0.4, 5), stone(4.2, 0.2), 0, 8.6, -0.6),
    );
    const roof = mesh(
      new THREE.CylinderGeometry(0.01, 4.4, 3.6, 4, 1),
      plain(BLUE),
      0,
      10.6,
      -0.6,
    );
    roof.rotation.y = Math.PI / 4;
    roof.scale.set(2.05, 1, 0.78);
    g.add(roof);
    windows(g, 6, 11, 2.6, 1.72, 0, 0, 1);
    windows(g, 6, 11, 6.2, 1.72, 0, 0, 0.9);
    g.add(
      mesh(
        new THREE.BoxGeometry(3.6, 11.5, 1.2),
        stone(1.2, 3.8),
        0,
        5.75,
        1.9,
      ),
    );
    const gable = mesh(
      new THREE.ConeGeometry(2.6, 3.4, 4),
      plain(BLUE),
      0,
      13.2,
      1.9,
    );
    gable.rotation.y = Math.PI / 4;
    gable.scale.set(1, 1, 0.5);
    g.add(gable);
    g.add(mesh(new THREE.SphereGeometry(0.3, 10, 8), gold, 0, 15, 1.9));
    g.add(
      mesh(new THREE.BoxGeometry(1.8, 3, 0.3), plain("#5a3a22"), 0, 1.5, 2.45),
    );
    g.add(
      mesh(
        new THREE.CylinderGeometry(0.9, 0.9, 0.3, 16, 1, false, 0, Math.PI)
          .rotateX(Math.PI / 2)
          .rotateZ(Math.PI / 2),
        plain("#5a3a22"),
        0,
        3,
        2.45,
      ),
    );
    windows(g, 1, 2, 7.2, 2.55, 0, 0, 1.3);
    for (const sx of [-1, 1])
      roundTower(g, sx * 6.6, -0.6, 1.2, 10, {
        spire: 4.5,
        gold: true,
        flag: GOLD,
        roof: BLUE,
      });
    curtain(g, 8.4, 3.6, {
      r: 1.4,
      h: 7,
      spire: 4,
      gold: true,
      flag: "#6a3fa0",
      roof: BLUE,
    });
    put(g, "fountain", { z: 5, s: 1.25 });
    put(g, "statue", { x: -4.2, z: 5.2, s: 1.1 });
    put(g, "statue", { x: 4.2, z: 5.2, s: 1.1 });
    put(g, "flowerBed", { x: -5.6, z: 3, s: 1.3 });
    put(g, "flowerBed", { x: 5.6, z: 3, s: 1.3 });
    put(g, "lamp", { x: -2.2, z: 3.4 });
    put(g, "lamp", { x: 2.2, z: 3.4 });
    return finish(g);
  },
};

/** A paved square of pale stone under the hall. */
function plaza(g: THREE.Group, half: number) {
  const side = half * 2;
  g.add(
    mesh(
      new THREE.BoxGeometry(side, 0.12, side),
      stone(side / 2.5, side / 2.5),
      0,
      0.06,
      0,
    ),
  );
}

export function makeHall(stage: StageId): THREE.Group {
  return HALLS[stage]();
}

// ---- the island's own trees, bushes and rocks ------------------------------

const SCENERY: [ModelName, number][] = [
  ["oak", 1.1],
  ["broadleaf", 1.1],
  ["pine", 1.15],
  ["birch", 1.1],
  ["apple", 1],
  ["bush", 1.4],
  ["shrub", 1.6],
  ["bush", 1.2],
  ["boulder", 1.2],
  ["tuft", 1.6],
  ["wildflower", 2.5],
  ["rock", 2],
];
/** One piece of scenery for the meadow round the land, in world units. */
export function scenery(rand: () => number): THREE.Object3D {
  const [name, s] = SCENERY[Math.floor(rand() * SCENERY.length)];
  const g = new THREE.Group();
  put(g, name, { ry: rand() * 6, s: s * (0.85 + rand() * 0.4) });
  return finish(g);
}
export function spire(rand: () => number): THREE.Object3D {
  const g = new THREE.Group();
  put(g, "spire", { ry: rand() * 6, s: 1.5 + rand() * 1.5 });
  return finish(g);
}

/** A villager who can walk: the model in world units and its walk clip. */
export function person(name: ModelName) {
  const inner = model(name);
  inner.scale.setScalar(METER);
  const g = new THREE.Group();
  g.add(inner);
  const clips = (inner.userData.clips ?? []) as THREE.AnimationClip[];
  return {
    obj: g,
    walk: clips.find((c) => c.name === "Walk") ?? null,
    root: inner,
  };
}
