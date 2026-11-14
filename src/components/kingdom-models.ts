// The kingdom's buildings. The houses, church, mill, well, stall and gate are
// realistic textured models by Sketchfab authors, and the barrels, crates,
// lamps, statues, boulders and ships are Poly Haven scans (all in
// public/models/kingdom/real); the smaller props, villagers and animals come
// from the Polyfork Medieval Village kit (public/models/kingdom). Every model
// is credited in CREDITS.md there. Each building is a small arrangement of
// models laid out in meters; one world unit is 3 m, so a 2-unit tile is 6 m
// across and the hall's 3 x 3 grounds are 18 m. The castle, the clock tower,
// the watchtower, the fountain and the balloons are drawn here, in
// photographed stone and tiles.
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { StageId } from "@/data/kingdom.mjs";

export const METER = 1 / 3; // world units per meter

const FILES = {
  cottage: "real/house-2",
  house: "real/house-3",
  towerHouse: "real/house-1",
  longHouse: "real/house-4",
  chapel: "real/church",
  windmill: "real/windmill",
  forge: "blacksmith-forge-09fa85",
  gatehouse: "real/gate",
  barn: "timber-barn-90b3ce",
  well: "real/well",
  stall: "real/stall",
  statue: "real/statue",
  crown: "crown-a294ce",
  lamp: "real/lamp",
  signpost: "signpost-8287c3",
  planter: "flower-planter-500ed2",
  flowerBed: "flower-bed-708e73",
  sunflower: "sunflower-80ce15",
  wildflower: "wildflower-68d3a1",
  wheat: "wheat-plant-7f29a1",
  haystack: "haystack-77b0dd",
  barrel: "real/barrel",
  crate: "real/crate",
  sack: "grain-sack-401d96",
  anvil: "anvil-1286cb",
  quench: "quench-barrel-0c78fd",
  trough: "water-trough-318ee1",
  cart: "wooden-cart-bf83d8",
  wagon: "four-wheel-wagon-adb946",
  wheelbarrow: "wheelbarrow-13f422",
  fence: "wooden-fence-3d8ee7",
  firePit: "real/fire-pit",
  tripod: "campfire-cook-tripod-d95a1e",
  tent: "camp-tent-3c5c89",
  stump: "real/stump",
  tuft: "grass-tuft-5ccff0",
  boulder: "real/boulder",
  ship: "real/ship",
  villager: "villager-40255c",
  tradesman: "tradesman-1707b9",
  merchant: "merchant-6f606b",
  guard: "village-guard-5f0f6f",
  greatHall: "real/manor",
  brazier: "flame-brazier-bbf74a",
  cypress: "columnar-evergreen-shrub-35a00b",
  dragon: "red-fire-dragon-base",
  sheep: "sheep-base",
} as const;
export type ModelName = keyof typeof FILES;
export const PEOPLE: ModelName[] = [
  "villager",
  "tradesman",
  "merchant",
  "guard",
];

// The kit's shrubs and grass come from Polyfork kits whose greens differ
// (muted olive, bright emerald), so their leaves are pulled toward one
// palette when they load. Trunks, blossom and fruit keep their colours.
const FOLIAGE: ModelName[] = ["cypress", "tuft"];
function unifyGreens(o: THREE.Object3D) {
  if (!(o instanceof THREE.Mesh)) return;
  const colors = o.geometry.getAttribute("color");
  if (!colors) return;
  const c = new THREE.Color();
  const hsl = { h: 0, s: 0, l: 0 };
  for (let i = 0; i < colors.count; i++) {
    c.setRGB(colors.getX(i), colors.getY(i), colors.getZ(i));
    c.getHSL(hsl);
    // Greens only: between yellow-green and teal, and not grey.
    if (hsl.h < 0.17 || hsl.h > 0.5 || hsl.s < 0.12) continue;
    c.setHSL(
      0.262 + (hsl.h - 0.262) * 0.25,
      Math.min(0.5, Math.max(0.3, hsl.s * 0.8)),
      0.12 + hsl.l * 0.78,
    );
    colors.setXYZ(i, c.r, c.g, c.b);
  }
  colors.needsUpdate = true;
}

// The realistic models (the `real/` files) are textured buildings by several
// Sketchfab authors and scanned props from Poly Haven, each in its own size
// and facing. This scales and turns each one to stand where the kit model of
// the same name stood: sizes in meters, the front toward +z.
const FIT: Partial<
  Record<ModelName, { s: number; ry?: number; chimney?: number[] }>
> = {
  cottage: { s: 0.63, ry: -Math.PI / 2 },
  house: { s: 0.66 },
  towerHouse: { s: 1 },
  // Its tower stands higher than its chimney, so the chimney is given.
  longHouse: { s: 1, chimney: [0.71, 10.1, -2.73] },
  greatHall: { s: 1.3, ry: Math.PI },
  chapel: { s: 7.7, ry: -Math.PI / 2 },
  windmill: { s: 19 },
  gatehouse: { s: 0.55 },
  well: { s: 1 },
  stall: { s: 0.5, ry: -Math.PI / 2 },
  barrel: { s: 1.1 },
  crate: { s: 0.85, ry: Math.PI / 2 },
  lamp: { s: 0.62 },
  statue: { s: 1.3 },
  firePit: { s: 0.83 },
  stump: { s: 0.85 },
  boulder: { s: 1.1 },
  // 18 m from stem to stern, its bow toward +z.
  ship: { s: 0.75, ry: -Math.PI / 2 },
};

type Loaded = {
  scene: THREE.Object3D;
  clips: THREE.AnimationClip[];
  top: THREE.Vector3;
};
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
      const fit = FIT[name];
      if (fit) {
        root.scale.setScalar(fit.s);
        root.rotation.y = fit.ry ?? 0;
      }
      // Stand every model on y = 0, centred on its footprint. The realistic
      // models hold turned parts, so their box is measured point by point.
      const box = new THREE.Box3().setFromObject(root, !!fit);
      const centre = box.getCenter(new THREE.Vector3());
      const wrap = new THREE.Group();
      root.position.set(-centre.x, -box.min.y, -centre.z);
      wrap.add(root);
      if (FOLIAGE.includes(name)) wrap.traverse(unifyGreens);
      wrap.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.castShadow = true;
          o.receiveShadow = true;
          o.frustumCulled = !(o instanceof THREE.SkinnedMesh);
        }
      });
      // The highest point of a realistic house is its chimney top.
      const top = new THREE.Vector3(0, box.max.y - box.min.y, 0);
      if (fit?.chimney) top.fromArray(fit.chimney);
      else if (fit) {
        wrap.updateMatrixWorld(true);
        const v = new THREE.Vector3();
        top.y = -Infinity;
        wrap.traverse((o) => {
          if (!(o instanceof THREE.Mesh)) return;
          const at = o.geometry.getAttribute("position");
          for (let i = 0; i < at.count; i++) {
            v.fromBufferAttribute(at, i).applyMatrix4(o.matrixWorld);
            if (v.y > top.y) top.copy(v);
          }
        });
      }
      cache.set(name, { scene: wrap, clips: gltf.animations, top });
    }),
  ).then(() => undefined);
  loads.set(key, p);
  return p;
}
// The living things are the heaviest files, so they load second.
const LIFE: ModelName[] = [...PEOPLE, "dragon", "sheep"];
/** Loads the buildings and scenery once; later calls share the promise. */
export const loadModels = () =>
  Promise.all([
    load(
      (Object.keys(FILES) as ModelName[]).filter((n) => !LIFE.includes(n)),
      "world",
    ),
    (photoLoad ??= loadPhotos()),
  ]).then(() => undefined);
let photoLoad: Promise<void> | null = null;
/** Villagers, sheep and the dragon, loaded after the kingdom is on screen. */
export const loadPeople = () => load(LIFE, "people");

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
/** Where a placed house smokes: just under its chimney top, in meters. */
function chimney(name: ModelName, p: Place = {}) {
  const top = cache.get(name)?.top ?? new THREE.Vector3();
  return top
    .clone()
    .applyAxisAngle(new THREE.Vector3(0, 1, 0), p.ry ?? 0)
    .multiplyScalar(p.s ?? 1)
    .add(new THREE.Vector3(p.x ?? 0, (p.y ?? 0) - 0.2, p.z ?? 0));
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

// Photographs of castle blocks, clay roof tiles and slate (Poly Haven, CC0;
// see CREDITS.md). They load with the models, before anything is built.
type Photo = { map: THREE.Texture; normal: THREE.Texture | null };
const photos: Record<string, Photo> = {};
async function loadPhotos() {
  const loader = new THREE.TextureLoader();
  const get = async (file: string, colour: boolean) => {
    const t = await loader.loadAsync(`${BASE}land/${file}.jpg`);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    if (colour) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  };
  const [wall, wallN, tiles, tilesN, slate, cobbles, cobblesN] =
    await Promise.all([
      get("wall", true),
      get("wall-n", false),
      get("tiles", true),
      get("tiles-n", false),
      get("slate", true),
      get("cobbles", true),
      get("cobbles-n", false),
    ]);
  photos.wall = { map: wall, normal: wallN };
  photos.tiles = { map: tiles, normal: tilesN };
  photos.slate = { map: slate, normal: null };
  photos.cobbles = { map: cobbles, normal: cobblesN };
}
/** A material from one of the photographs, repeated rx by ry times. */
function photo(
  name: string,
  rx: number,
  ry: number,
  extra: THREE.MeshStandardMaterialParameters = {},
) {
  const src = photos[name];
  const copy = (t: THREE.Texture) => {
    const c = t.clone();
    c.repeat.set(rx, ry);
    c.needsUpdate = true;
    return c;
  };
  return new THREE.MeshStandardMaterial({
    map: copy(src.map),
    normalMap: src.normal ? copy(src.normal) : null,
    roughness: 0.9,
    ...extra,
  });
}

let stoneTex: THREE.CanvasTexture | null = null;
/** Pale ashlar blocks with soft mortar: the stand-in until the photo loads. */
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
    if (photos.wall) m = photo("wall", rx * 0.8, ry * 0.8);
    else {
      const t = stoneTexture().clone();
      t.repeat.set(rx, ry);
      t.needsUpdate = true;
      m = new THREE.MeshStandardMaterial({ map: t, roughness: 0.92 });
    }
    matCache.set(key, m);
  }
  return m;
}
/**
 * Roof tiles for a cone or pyramid roof `round` meters about its base and
 * `slant` meters up its side: clay tiles for the reds, slate for other
 * colours.
 */
function roofing(color: string, round: number, slant: number) {
  const rx = Math.max(2, Math.round(round / 2.4));
  const ry = Math.max(1, Math.round((slant / 2.4) * 2) / 2);
  const key = `roof:${color}:${rx}:${ry}`;
  let m = matCache.get(key);
  if (!m) {
    if (!photos.tiles) m = plain(color);
    else if (color === ROOF || color === ROOF_DARK)
      m = photo("tiles", rx, ry, {
        color: color === ROOF ? "#f2d0c8" : "#a88f8a",
        roughness: 0.82,
      });
    else
      m = photo("slate", rx, ry, {
        color: new THREE.Color(color).lerp(new THREE.Color("#ffffff"), 0.25),
        roughness: 0.7,
      });
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
/** A window with the lamps lit inside, bright enough to bloom. */
const lit = () =>
  plain("#ffd9a0", {
    emissive: "#ffb24a",
    emissiveIntensity: 1.6,
    roughness: 0.4,
  });

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
    // Most windows have their lamps lit; a few stay dark.
    const glass =
      (i * 7 + Math.round(y * 3)) % 4 === 0
        ? plain(WINDOW, { roughness: 0.4 })
        : lit();
    holder.add(mesh(geo, glass, x, y, 0));
    holder.add(mesh(top, glass, x, y + 0.7 * size, 0));
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
    roofing(opts.roof ?? ROOF, (r + 0.25) * 6.28, Math.hypot(r, spire)),
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
      roofing(tile, w * 3.5, Math.hypot(w * 0.45, opts.roof)),
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
        mesh(
          new THREE.ConeGeometry(1.15, 3, 12),
          roofing(tile, 7.2, 3.2),
          tx,
          h + 3.7,
          tz,
        ),
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

// ---- the town's own stonework: clock tower, watchtower, fountain ------------

/** A clock dial: a cream face, twelve marks and two hands at ten past ten. */
const dial = () =>
  made("dial", () => {
    const map = canvasTexture(256, 256, (g) => {
      g.fillStyle = "#2b2622";
      g.fillRect(0, 0, 256, 256);
      g.translate(128, 128);
      g.fillStyle = "#ece2c8";
      g.beginPath();
      g.arc(0, 0, 112, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = "#2b2622";
      g.lineCap = "butt";
      for (let i = 0; i < 60; i++) {
        const a = (i / 60) * Math.PI * 2;
        const hour = i % 5 === 0;
        g.lineWidth = hour ? 7 : 2;
        g.beginPath();
        g.moveTo(
          Math.sin(a) * (hour ? 84 : 98),
          -Math.cos(a) * (hour ? 84 : 98),
        );
        g.lineTo(Math.sin(a) * 106, -Math.cos(a) * 106);
        g.stroke();
      }
      g.lineCap = "round";
      const hand = (turn: number, len: number, w: number) => {
        const a = turn * Math.PI * 2;
        g.lineWidth = w;
        g.beginPath();
        g.moveTo(-Math.sin(a) * 14, Math.cos(a) * 14);
        g.lineTo(Math.sin(a) * len, -Math.cos(a) * len);
        g.stroke();
      };
      hand(10.17 / 12, 58, 11);
      hand(10 / 60, 88, 7);
      g.fillStyle = "#2b2622";
      g.beginPath();
      g.arc(0, 0, 9, 0, Math.PI * 2);
      g.fill();
    });
    return new THREE.MeshStandardMaterial({ map, roughness: 0.6 });
  });

/** A door or slit set into a wall that faces `ry`, its foot at y. */
function opening(
  g: THREE.Group,
  w: number,
  h: number,
  y: number,
  out: number,
  ry: number,
  m: THREE.Material,
) {
  const o = mesh(new THREE.BoxGeometry(w, h, 0.24), m, 0, y + h / 2, out);
  const holder = new THREE.Group();
  holder.add(o);
  // A round head, as wide as the opening.
  const head = mesh(
    new THREE.CylinderGeometry(w / 2, w / 2, 0.24, 14, 1, false, 0, Math.PI),
    m,
    0,
    y + h,
    out,
  );
  head.rotation.set(Math.PI / 2, 0, 0);
  head.rotation.y = Math.PI / 2;
  holder.add(head);
  holder.rotation.y = ry;
  g.add(holder);
}

/** The town clock: a square stone tower, 16 m to the tip of its slate roof. */
function clockTower(g: THREE.Group) {
  const W = 3.5;
  const SHAFT = 8.6;
  const oak = plain("#4a3524", { roughness: 0.8 });
  g.add(
    mesh(
      new THREE.BoxGeometry(W + 0.7, 0.7, W + 0.7),
      stone(1.4, 0.25),
      0,
      0.35,
      0,
    ),
  );
  g.add(
    mesh(
      new THREE.BoxGeometry(W, SHAFT, W),
      stone(W / 3, SHAFT / 3),
      0,
      0.7 + SHAFT / 2,
      0,
    ),
  );
  let y = 0.7 + SHAFT;
  g.add(
    mesh(
      new THREE.BoxGeometry(W + 0.5, 0.3, W + 0.5),
      stone(1.3, 0.1),
      0,
      y + 0.15,
      0,
    ),
  );
  y += 0.3;
  // The clock room, a dial on each face.
  const ROOM = 3.1;
  g.add(
    mesh(
      new THREE.BoxGeometry(W + 0.1, ROOM, W + 0.1),
      stone(W / 3, ROOM / 3),
      0,
      y + ROOM / 2,
      0,
    ),
  );
  const iron = plain("#2b2622", { metalness: 0.6, roughness: 0.5 });
  for (let i = 0; i < 4; i++) {
    const face = new THREE.Group();
    face.add(
      mesh(
        new THREE.CircleGeometry(1.2, 40),
        dial(),
        0,
        y + ROOM / 2,
        W / 2 + 0.09,
      ),
    );
    const rim = mesh(
      new THREE.TorusGeometry(1.22, 0.07, 8, 40),
      iron,
      0,
      y + ROOM / 2,
      W / 2 + 0.09,
    );
    face.add(rim);
    face.rotation.y = (i * Math.PI) / 2;
    g.add(face);
    // A lit slit low on each side, and a dark one above it.
    opening(
      g,
      0.4,
      1.0,
      3.4,
      W / 2 - 0.08,
      (i * Math.PI) / 2,
      i % 2 ? plain(WINDOW) : lit(),
    );
    opening(g, 0.4, 1.0, 6.6, W / 2 - 0.08, (i * Math.PI) / 2, plain(WINDOW));
  }
  opening(g, 1.2, 1.7, 0.7, W / 2 - 0.06, 0, oak);
  y += ROOM;
  g.add(
    mesh(
      new THREE.BoxGeometry(W + 0.7, 0.3, W + 0.7),
      stone(1.4, 0.1),
      0,
      y + 0.15,
      0,
    ),
  );
  y += 0.3;
  const half = (W + 0.9) / 2;
  const RISE = 3.4;
  const roof = mesh(
    new THREE.ConeGeometry(half * Math.SQRT2, RISE, 4),
    roofing("#4a5568", half * 8, Math.hypot(half, RISE)),
    0,
    y + RISE / 2,
    0,
  );
  roof.rotation.y = Math.PI / 4;
  g.add(roof);
  y += RISE;
  const gold = plain(GOLD, { metalness: 0.7, roughness: 0.3 });
  g.add(
    mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.9, 6), gold, 0, y + 0.4, 0),
  );
  g.add(mesh(new THREE.SphereGeometry(0.2, 12, 8), gold, 0, y + 0.1, 0));
}

/** Still water in a basin: it mirrors the sky, with a little of its own blue. */
const pool = () => plain("#4f8fa8", { roughness: 0.06, metalness: 0.35 });
/** Falling water: white streaks the scene keeps running downward. */
const falling = () =>
  made("falling", () => {
    const map = canvasTexture(128, 128, (g) => {
      const rand = seeded(5);
      g.clearRect(0, 0, 128, 128);
      for (let i = 0; i < 90; i++) {
        g.fillStyle = `rgba(255,255,255,${0.25 + rand() * 0.6})`;
        const h = 20 + rand() * 70;
        const y = rand() * 128;
        const x = rand() * 128;
        g.fillRect(x, y, 1 + rand() * 2, h);
        g.fillRect(x, y - 128, 1 + rand() * 2, h);
      }
    });
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.repeat.set(3, 1);
    return new THREE.MeshStandardMaterial({
      map,
      color: "#eaf6ff",
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
      side: THREE.DoubleSide,
      roughness: 0.3,
    });
  });
/** A sheet of water falling from one ring to a wider one below. */
function fall(
  g: THREE.Group,
  top: number,
  bottom: number,
  r0: number,
  r1: number,
) {
  const o = new THREE.Mesh(
    new THREE.CylinderGeometry(r0, r1, top - bottom, 28, 1, true),
    falling(),
  );
  o.position.y = (top + bottom) / 2;
  o.userData.flow = true;
  g.add(o);
}
/** The plaza fountain: a round stone basin 5 m across and two bowls above. */
function fountain(g: THREE.Group) {
  const lathe = (pts: number[][], m: THREE.Material) =>
    mesh(
      new THREE.LatheGeometry(
        pts.map(([r, y]) => new THREE.Vector2(r, y)),
        36,
      ),
      m,
    );
  const pale = stone(4, 0.6);
  g.add(
    mesh(
      new THREE.CylinderGeometry(2.9, 2.9, 0.16, 36),
      stone(4, 4),
      0,
      0.08,
      0,
    ),
  );
  g.add(
    lathe(
      [
        [2.45, 0.16],
        [2.5, 0.75],
        [2.6, 0.78],
        [2.6, 0.92],
        [2.18, 0.92],
        [2.14, 0.5],
        [0, 0.5],
      ],
      pale,
    ),
  );
  const water = mesh(new THREE.CircleGeometry(2.16, 36), pool(), 0, 0.78, 0);
  water.rotation.x = -Math.PI / 2;
  water.castShadow = false;
  g.add(water);
  // The stem and the lower bowl.
  g.add(
    lathe(
      [
        [0.55, 0.5],
        [0.5, 0.95],
        [0.3, 1.1],
        [0.26, 1.75],
        [0.42, 1.9],
        [1.12, 2.12],
        [1.2, 2.24],
        [1.06, 2.24],
        [0.95, 2.14],
        [0, 2.1],
      ],
      pale,
    ),
  );
  const upper = mesh(new THREE.CircleGeometry(1.08, 28), pool(), 0, 2.2, 0);
  upper.rotation.x = -Math.PI / 2;
  upper.castShadow = false;
  g.add(upper);
  // The upper stem, its small bowl and the spout.
  g.add(
    lathe(
      [
        [0.24, 2.1],
        [0.16, 2.75],
        [0.5, 2.9],
        [0.55, 2.98],
        [0.44, 2.98],
        [0, 2.94],
      ],
      pale,
    ),
  );
  g.add(mesh(new THREE.SphereGeometry(0.14, 12, 8), pale, 0, 3.08, 0));
  fall(g, 2.98, 2.2, 0.52, 0.66);
  fall(g, 2.22, 0.78, 1.16, 1.34);
}

type Maker = (rand: () => number) => THREE.Group;
const M: Record<string, Maker> = {
  // A street: one 6 m square of cobbles, so neighbouring squares join up.
  path: () => {
    const g = new THREE.Group();
    g.add(
      mesh(
        new THREE.BoxGeometry(6, 0.08, 6),
        made("cobbles", () =>
          photos.cobbles
            ? photo("cobbles", 2, 2, { roughness: 0.95 })
            : plain("#8f8676", { roughness: 1 }),
        ),
        0,
        0.04,
        0,
      ),
    );
    return finish(g);
  },
  tree: (rand) => {
    const g = new THREE.Group();
    // The tree itself is one of the forest's real trees, which the scene
    // plants here; the tile only says which kind and how big.
    put(g, "tuft", { x: -1.8, z: 1.8, s: 1.4 });
    put(g, "tuft", { x: 1.7, z: 1.5, s: 1.2 });
    return finish(g, {
      tree: { s: 0.5 + rand() * 0.14, kind: 0 },
      turn: rand(),
    });
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
    // Most cottages are the long jettied house; some are a tower house.
    const tall = rand() > 0.7;
    const kind: ModelName = tall ? "towerHouse" : "cottage";
    const at: Place = tall ? { z: -0.6, s: 0.72 } : { z: -0.5, s: 0.88 };
    put(g, kind, at);
    put(g, "barrel", { x: 2.4, z: 2.2 });
    put(g, "crate", { x: 1.6, z: 2.5, ry: 0.4 });
    put(g, "planter", { x: -1.2, z: 2.1 });
    if (rand() > 0.5) put(g, "wheelbarrow", { x: -2.4, z: 1.8, ry: 1.2 });
    return finish(g, tall ? {} : { smoke: chimney(kind, at) });
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
    const at: Place = { z: -0.6, s: 0.74 };
    put(g, "house", at);
    put(g, "planter", { x: -1.8, z: 2.6 });
    put(g, "barrel", { x: 2.4, z: 2.3 });
    return finish(g, { smoke: chimney("house", at) });
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
    put(g, "stall", { x: -0.3, z: -1, s: 1.75, ry: 0.12 });
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
    roundTower(g, 0, 0, 1.9, 7.6, { spire: 3.4 });
    opening(
      g,
      1.1,
      1.6,
      0,
      1.9 - 0.06,
      0,
      plain("#4a3524", { roughness: 0.8 }),
    );
    put(g, "barrel", { x: 1.9, z: 2 });
    put(g, "crate", { x: -2, z: 2, ry: 0.5 });
    return finish(g);
  },
  chapel: () => {
    const g = new THREE.Group();
    put(g, "chapel", { s: 1.15, z: -0.2 });
    put(g, "lamp", { x: 2.4, z: 2.6 });
    put(g, "planter", { x: -2, z: 2.6 });
    return finish(g);
  },
  fountain: () => {
    const g = new THREE.Group();
    fountain(g);
    for (const [x, z] of [
      [-2.6, -2.6],
      [2.6, -2.6],
      [-2.6, 2.6],
      [2.6, 2.6],
    ])
      put(g, "lamp", { x, z, ry: Math.atan2(x, z) + Math.PI });
    return finish(g);
  },
  clock: () => {
    const g = new THREE.Group();
    g.add(mesh(new THREE.BoxGeometry(5.4, 0.2, 5.4), stone(2, 2), 0, 0.1, 0));
    clockTower(g);
    put(g, "lamp", { x: -2.2, z: 2.2 });
    put(g, "lamp", { x: 2.2, z: 2.2 });
    put(g, "planter", { x: 0, z: 2.4 });
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
    const at: Place = { z: -2.5, s: 0.9 };
    put(g, "longHouse", at);
    put(g, "planter", { x: -2.3, z: 2.2 });
    put(g, "planter", { x: 2.3, z: 2.2 });
    put(g, "lamp", { x: -4, z: 4.5 });
    put(g, "lamp", { x: 4, z: 4.5 });
    put(g, "signpost", { x: 6.3, z: 5.5, ry: -0.6 });
    put(g, "wagon", { x: -6, z: 3, ry: 0.6 });
    put(g, "barrel", { x: 6.4, z: 2.4 });
    put(g, "barrel", { x: 7, z: 3.2 });
    for (let i = 0; i < 6; i++)
      put(g, "fence", { x: -5 + i * 2, z: 8.2, s: 1 });
    banner(g, 4.66, 11.3, -0.75, 2.4);
    return finish(g, { smoke: chimney("longHouse", at) });
  },
  town: () => {
    const g = new THREE.Group();
    plaza(g, 8.8);
    const at: Place = { z: -1.8, s: 0.95 };
    put(g, "greatHall", at);
    put(g, "brazier", { x: -3, z: 5.6, s: 1.4 });
    put(g, "brazier", { x: 3, z: 5.6, s: 1.4 });
    put(g, "lamp", { x: -6.5, z: 6.5 });
    put(g, "lamp", { x: 6.5, z: 6.5 });
    put(g, "flowerBed", { x: -5.2, z: 5.6, s: 1.3 });
    put(g, "flowerBed", { x: 5.2, z: 5.6, s: 1.3 });
    put(g, "cart", { x: 7.2, z: 7.6, ry: -0.8 });
    put(g, "signpost", { x: -7.4, z: 7.6, ry: 0.4 });
    banner(g, -8, 0, 4, 8);
    banner(g, 8, 0, 4, 8);
    return finish(g, { smoke: chimney("greatHall", at) });
  },
  city: () => {
    const g = new THREE.Group();
    plaza(g, 7.2);
    keep(g, 0, -1.5, 7, 13, { turrets: true });
    curtain(g, 7.6, 3.6, { r: 1.5, h: 6.5 });
    put(g, "lamp", { x: -2.6, z: 4.6 });
    put(g, "lamp", { x: 2.6, z: 4.6 });
    put(g, "brazier", { x: -4.6, z: 5.8, s: 1.4 });
    put(g, "brazier", { x: 4.6, z: 5.8, s: 1.4 });
    banner(g, 0, 14.5, -1.5, 3.4);
    return finish(g);
  },
  kingdom: () => {
    const g = new THREE.Group();
    plaza(g, 7.4);
    keep(g, 0, -2, 7.6, 18, { turrets: true, roof: 7, gold: true });
    roundTower(g, 5.2, -4.6, 1.3, 13, { spire: 5, flag: "#2f5aa8" });
    put(g, "brazier", { x: -4.4, z: 3.2, s: 1.4 });
    put(g, "brazier", { x: 4.4, z: 3.2, s: 1.4 });
    // A great hall leaning on the keep.
    g.add(mesh(new THREE.BoxGeometry(4, 6, 6), stone(1.4, 2), -5, 3, -1));
    const hallRoof = mesh(
      new THREE.CylinderGeometry(0.01, 3.3, 4.2, 4, 1),
      roofing(ROOF_DARK, 18, 4.8),
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
    // The palace: royal blue slate and gold over pale stone. It stands on a
    // raised terrace behind a wall: a long lamplit front, a cluster of
    // spires of different heights, and a great tower with a crown on top.
    const g = new THREE.Group();
    plaza(g, 8.8);
    const BLUE = "#2f4f8f";
    const gold = plain(GOLD, { metalness: 0.7, roughness: 0.3 });
    const UP = 2.2;
    g.add(
      mesh(
        new THREE.BoxGeometry(15.6, UP, 10.4),
        stone(5, 0.8),
        0,
        UP / 2,
        -2.6,
      ),
    );
    g.add(
      mesh(new THREE.BoxGeometry(16, 0.3, 10.8), stone(5, 0.1), 0, UP, -2.6),
    );
    for (let i = 0; i < 5; i++)
      g.add(
        mesh(
          new THREE.BoxGeometry(6, UP - i * 0.44, 0.5),
          stone(2, 0.6),
          0,
          (UP - i * 0.44) / 2,
          2.85 + i * 0.5,
        ),
      );
    const pal = new THREE.Group();
    pal.position.y = UP;
    g.add(pal);
    keep(pal, 0, -4.4, 6, 25, {
      turrets: true,
      roof: 11,
      gold: true,
      color: BLUE,
    });
    put(pal, "crown", { y: 25 + 0.4 + 11 + 0.6, z: -4.4, s: 4.6 });
    // The front range, with a tall entrance bay in the middle.
    pal.add(mesh(new THREE.BoxGeometry(13, 9, 5), stone(4.4, 3), 0, 4.5, -1.2));
    pal.add(
      mesh(
        new THREE.BoxGeometry(13.4, 0.4, 5.4),
        stone(4.4, 0.2),
        0,
        9.1,
        -1.2,
      ),
    );
    const roof = mesh(
      new THREE.CylinderGeometry(0.01, 4.6, 4, 4, 1),
      roofing(BLUE, 26, 4.6),
      0,
      11.3,
      -1.2,
    );
    roof.rotation.y = Math.PI / 4;
    roof.scale.set(2.05, 1, 0.82);
    pal.add(roof);
    windows(pal, 7, 12, 2.8, 1.32, 0, 0, 1.05);
    windows(pal, 7, 12, 6.4, 1.32, 0, 0, 0.95);
    pal.add(
      mesh(new THREE.BoxGeometry(4, 13, 1.2), stone(1.4, 4.3), 0, 6.5, 1.5),
    );
    const gable = mesh(
      new THREE.ConeGeometry(2.9, 4, 4),
      roofing(BLUE, 16, 4.5),
      0,
      15,
      1.5,
    );
    gable.rotation.y = Math.PI / 4;
    gable.scale.set(1, 1, 0.5);
    pal.add(gable);
    pal.add(mesh(new THREE.SphereGeometry(0.32, 10, 8), gold, 0, 17.1, 1.5));
    pal.add(
      mesh(new THREE.BoxGeometry(2, 3.2, 0.3), plain("#5a3a22"), 0, 1.6, 2.1),
    );
    windows(pal, 1, 2, 7.6, 2.15, 0, 0, 1.6);
    windows(pal, 1, 2, 11, 2.15, 0, 0, 1);
    // Spires of different heights round the great tower.
    for (const sx of [-1, 1]) {
      roundTower(pal, sx * 6.9, -1.2, 1.35, 12, {
        spire: 6,
        gold: true,
        flag: GOLD,
        roof: BLUE,
      });
      roundTower(pal, sx * 4.6, -6.6, 1.15, 17, {
        spire: 7,
        gold: true,
        flag: "#6a3fa0",
        roof: BLUE,
      });
    }
    curtain(g, 8.4, 3.4, {
      r: 1.4,
      h: 6.5,
      spire: 4,
      gold: true,
      flag: "#6a3fa0",
      roof: BLUE,
    });
    for (const sx of [-1, 1]) {
      put(g, "brazier", { x: sx * 3.8, z: 4.4, s: 1.5 });
      put(g, "statue", { x: sx * 2.2, z: 6.6, s: 1.1 });
      put(g, "cypress", { x: sx * 5.6, z: 3.6, s: 1.3 });
      put(g, "cypress", { x: sx * 5.6, z: 5.6, s: 1.3 });
      put(g, "flowerBed", { x: sx * 6.3, z: 4.6, s: 1.2 });
    }
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

// ---- the meadow's bushes, flowers and rocks ---------------------------------

const COVER: [ModelName, number][] = [
  ["stump", 0.7],
  ["boulder", 0.6],
  ["boulder", 0.4],
  ["boulder", 0.9],
];
function pick(list: [ModelName, number][], rand: () => number) {
  const [name, s] = list[Math.floor(rand() * list.length)];
  const g = new THREE.Group();
  put(g, name, { ry: rand() * 6, s: s * (0.85 + rand() * 0.35) });
  return finish(g);
}
/** Low ground cover: grass, flowers or a rock. */
export const cover = (rand: () => number): THREE.Object3D => pick(COVER, rand);

/** A villager who can walk: the model in world units and its walk clip. */
export function person(name: ModelName, scale = 1) {
  const inner = model(name);
  inner.scale.setScalar(METER * scale);
  const g = new THREE.Group();
  g.add(inner);
  const clips = (inner.userData.clips ?? []) as THREE.AnimationClip[];
  return {
    obj: g,
    walk: clips.find((c) => c.name === "Walk") ?? null,
    idle: clips.find((c) => c.name === "Idle") ?? null,
    root: inner,
  };
}

// ---- the ships in the bay and the balloons ----------------------------------

function canvasTexture(
  w: number,
  h: number,
  draw: (g: CanvasRenderingContext2D) => void,
) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d")!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
/** A thin pole or rope from one point to another. */
function strut(
  from: THREE.Vector3,
  to: THREE.Vector3,
  r: number,
  m: THREE.Material,
) {
  const len = from.distanceTo(to);
  const o = mesh(new THREE.CylinderGeometry(r, r, len, 6), m);
  o.position.copy(from).lerp(to, 0.5);
  o.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    to.clone().sub(from).normalize(),
  );
  return o;
}
function made(key: string, make: () => THREE.Material) {
  let m = matCache.get(key);
  if (!m) matCache.set(key, (m = make()));
  return m;
}
const wicker = () =>
  made("wicker", () => {
    const map = canvasTexture(128, 128, (g) => {
      g.fillStyle = "#7a5a34";
      g.fillRect(0, 0, 128, 128);
      for (let y = 0; y < 16; y++)
        for (let x = 0; x < 16; x++) {
          const over = (x + y) % 2 === 0;
          g.fillStyle = over ? "#a67c48" : "#5e4424";
          g.fillRect(x * 8 + 1, y * 8 + (over ? 1 : 3), 6, over ? 6 : 3);
        }
    });
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.repeat.set(3, 2);
    return new THREE.MeshStandardMaterial({ map, roughness: 0.95 });
  });
/**
 * A three-masted ship lying in the bay, its bow toward +z. The model's keel
 * is 1.5 m under its waterline, so it sits that deep in the sea.
 */
export function boat(): THREE.Object3D {
  const g = new THREE.Group();
  put(g, "ship", { y: -1.5 });
  return finish(g);
}

const BALLOON_COLOURS = [
  ["#a8322a", "#e9dfc6", "#d59a2e"],
  ["#2f4f8f", "#e9dfc6", "#b33a30"],
];
/**
 * A hot-air balloon, 11 m tall: an envelope of twelve gores that bulge
 * between their seams, coloured in a spiral, over a wicker basket.
 */
export function balloon(kind = 0): THREE.Object3D {
  const g = new THREE.Group();
  const R = 4.1; // the envelope at its widest
  const H = 8.6; // mouth to crown
  const MOUTH = 0.62;
  const GORES = 12;
  const LIFT = 2.5; // the mouth above the basket floor
  const rings = 30;
  const segs = GORES * 8;
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  for (let j = 0; j <= rings; j++) {
    const t = j / rings;
    // Narrow at the mouth, widest three fifths of the way up, closed on top.
    const round =
      MOUTH * Math.pow(1 - t, 3) +
      R * Math.pow(Math.sin(Math.PI * Math.pow(t, 1.35)), 0.85);
    for (let i = 0; i <= segs; i++) {
      const u = i / segs;
      const gore = (u * GORES) % 1;
      const bulge =
        0.955 + 0.045 * Math.sin(Math.PI * gore) * Math.sin(Math.PI * t);
      const a = u * Math.PI * 2;
      pos.push(
        Math.cos(a) * round * bulge,
        LIFT + t * H,
        Math.sin(a) * round * bulge,
      );
      uv.push(u, t);
    }
  }
  const row = segs + 1;
  for (let j = 0; j < rings; j++)
    for (let i = 0; i < segs; i++) {
      const a = j * row + i;
      idx.push(a, a + row, a + 1, a + 1, a + row, a + row + 1);
    }
  const shape = new THREE.BufferGeometry();
  shape.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  shape.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  shape.setIndex(idx);
  shape.computeVertexNormals();
  const cloth = made(`balloon:${kind}`, () => {
    const pal = BALLOON_COLOURS[kind % BALLOON_COLOURS.length];
    const BANDS = 9;
    const map = canvasTexture(768, 576, (c) => {
      const gw = 768 / GORES;
      const bh = 576 / BANDS;
      for (let i = 0; i < GORES; i++)
        for (let j = 0; j < BANDS; j++) {
          // Canvas rows run from the crown down; the colours climb in a spiral.
          const up = BANDS - 1 - j;
          c.fillStyle = up === 0 ? "#3a3530" : pal[(i + up) % pal.length];
          c.fillRect(i * gw, j * bh, gw + 1, bh + 1);
        }
      // Seams, and the load tapes that run up each one.
      c.fillStyle = "rgba(30,20,15,0.55)";
      for (let i = 0; i <= GORES; i++) c.fillRect(i * gw - 1.5, 0, 3, 576);
      c.fillStyle = "rgba(30,20,15,0.18)";
      for (let j = 1; j < BANDS; j++) c.fillRect(0, j * bh - 1, 768, 2);
    });
    return new THREE.MeshStandardMaterial({
      map,
      roughness: 0.62,
      side: THREE.DoubleSide,
    });
  });
  g.add(mesh(shape, cloth));
  // The basket, its padded rim, the burner and the lines up to the mouth.
  const basket = mesh(
    new THREE.BoxGeometry(1.5, 1.15, 1.5),
    wicker(),
    0,
    0.575,
    0,
  );
  g.add(basket);
  g.add(
    mesh(
      new THREE.BoxGeometry(1.62, 0.14, 1.62),
      plain("#3b2a1c", { roughness: 0.7 }),
      0,
      1.17,
      0,
    ),
  );
  const steel = plain("#8a8d92", { metalness: 0.8, roughness: 0.35 });
  g.add(
    mesh(
      new THREE.CylinderGeometry(0.2, 0.26, 0.4, 10),
      steel,
      0,
      LIFT - 0.55,
      0,
    ),
  );
  const flame = mesh(
    new THREE.ConeGeometry(0.2, 0.75, 8),
    plain("#ffd9a0", { emissive: "#ff9a3c", emissiveIntensity: 2.2 }),
    0,
    LIFT + 0.05,
    0,
  );
  flame.castShadow = false;
  g.add(flame);
  const line = plain("#2b2520");
  for (const [sx, sz] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ]) {
    const corner = new THREE.Vector3(sx * 0.72, 1.2, sz * 0.72);
    g.add(
      strut(
        corner,
        new THREE.Vector3(sx * 0.3, LIFT - 0.5, sz * 0.3),
        0.03,
        steel,
      ),
    );
    for (const turn of [-0.35, 0.35]) {
      const a = Math.atan2(sz, sx) + turn;
      g.add(
        strut(
          corner,
          new THREE.Vector3(
            Math.cos(a) * MOUTH * 1.25,
            LIFT + 0.45,
            Math.sin(a) * MOUTH * 1.25,
          ),
          0.018,
          line,
        ),
      );
    }
  }
  return finish(g);
}

/**
 * The wall round the whole land, from the city on: crenellated stone with
 * towers at the corners and the kit's gatehouse in the middle of the front.
 * `size` is the land's width in tiles; the group is centred on the land.
 */
export function cityWall(size: number, stage: StageId): THREE.Group {
  const g = new THREE.Group();
  const grand = stage !== "city";
  const roofColor = stage === "capital" ? "#2f4f8f" : ROOF;
  const h = stage === "city" ? 3 : stage === "kingdom" ? 3.6 : 4;
  const half = size * 3 + 1.8;
  const run = (len: number, x: number, z: number, ry: number) => {
    const part = new THREE.Group();
    part.add(
      mesh(new THREE.BoxGeometry(len, h, 1.2), stone(len / 3, h / 3), 0, h / 2),
    );
    const n = Math.max(2, Math.round(len / 1.5));
    const step = len / n;
    const merlons = new THREE.InstancedMesh(
      new THREE.BoxGeometry(step * 0.55, 0.8, 1.3),
      stone(0.3, 0.3),
      n,
    );
    const m = new THREE.Matrix4();
    for (let i = 0; i < n; i++)
      merlons.setMatrixAt(
        i,
        m.makeTranslation(-len / 2 + step * (i + 0.5), h + 0.4, 0),
      );
    merlons.castShadow = true;
    part.add(merlons);
    part.position.set(x, 0, z);
    part.rotation.y = ry;
    g.add(part);
  };
  const side = half * 2;
  run(side, 0, -half, 0);
  run(side, -half, 0, Math.PI / 2);
  run(side, half, 0, Math.PI / 2);
  // The front leaves a gap for the gatehouse.
  const gate = 4.2;
  const seg = half - gate;
  run(seg, -gate - seg / 2, half, 0);
  run(seg, gate + seg / 2, half, 0);
  put(g, "gatehouse", { z: half, s: 1.35 });
  put(g, "brazier", { x: -5.6, z: half + 1.6, s: 1.5 });
  put(g, "brazier", { x: 5.6, z: half + 1.6, s: 1.5 });
  const tower = (x: number, z: number, big: boolean) =>
    roundTower(g, x, z, big ? 2 : 1.6, h + (big ? 4.5 : 3), {
      spire: big ? 5 : 4,
      roof: roofColor,
      gold: stage === "capital",
      flag: stage === "capital" ? GOLD : ROOF,
    });
  for (const [sx, sz] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ])
    tower(sx * half, sz * half, true);
  if (grand) {
    tower(0, -half, false);
    tower(-half, 0, false);
    tower(half, 0, false);
  }
  return finish(g);
}
