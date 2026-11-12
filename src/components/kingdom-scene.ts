// The kingdom in 3D: a green island in a blue sea, lit by a low golden sun. Plain three.js with no React, so the page (kingdom.tsx) only
// tells it what stands where and hears which tile was tapped.
//
// The buildings are Polyfork's Medieval Village models (kingdom-models.ts);
// the island, sky, clouds and water are drawn here. Tile x,y of the kingdom
// sits at world (x·T, 0, y·T), and the hall stands on the 3 x 3 tiles at 0,0.
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import {
  HALL_RADIUS,
  STAGE_IDS,
  landBounds,
  type StageId,
} from "@/data/kingdom.mjs";
import {
  PEOPLE,
  balloon,
  boat,
  cityWall,
  cover,
  loadModels,
  loadPeople,
  makeBuilding,
  makeHall,
  peak,
  person,
  scenery,
  tree,
} from "./kingdom-models";

export const T = 2; // a tile's width in world units
const SEA = -1.5; // the water's height; the meadow is at 0
const SUN = new THREE.Vector3(-0.55, 0.42, 0.72).normalize();

export type SceneState = {
  size: number;
  hall: StageId;
  tiles: Record<string, string>;
};
type Options = {
  onTile: (x: number, y: number) => void;
  reducedMotion: boolean;
  onReady?: () => void;
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
  meadow: "#86b85c",
  soil: "#8a6340",
  rock: "#7d746b",
  rockDark: "#5d5650",
  water: "#5fb4e0",
};

// ---- the world ------------------------------------------------------------

function skyDome() {
  const geo = new THREE.SphereGeometry(400, 32, 16);
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      top: { value: new THREE.Color("#2f6cc0") },
      middle: { value: new THREE.Color("#8cc4f0") },
      horizon: { value: new THREE.Color("#e6eef2") },
      below: { value: new THREE.Color("#d3e6f2") },
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
  g.addColorStop(0, "rgba(255,255,255,0.9)");
  g.addColorStop(0.35, "rgba(255,255,255,0.45)");
  g.addColorStop(0.7, "rgba(255,255,255,0.12)");
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
/** Grass with soft light and dark patches, for the island's top. */
function meadowTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const g = c.getContext("2d")!;
  g.fillStyle = "#86b85c";
  g.fillRect(0, 0, 512, 512);
  const rand = seeded(5);
  for (let i = 0; i < 260; i++) {
    const x = rand() * 512;
    const y = rand() * 512;
    const r = 12 + rand() * 46;
    const light = rand() > 0.5;
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    const tone = light ? "164, 200, 106" : "104, 150, 72";
    grad.addColorStop(0, `rgba(${tone}, ${0.25 + rand() * 0.25})`);
    grad.addColorStop(1, `rgba(${tone}, 0)`);
    g.fillStyle = grad;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Pale streaks on white, tinted by the sea's colour and tiled. */
function seaTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  g.fillStyle = "#dfeaf2";
  g.fillRect(0, 0, 256, 256);
  const rand = seeded(3);
  g.strokeStyle = "#ffffff";
  g.lineCap = "round";
  for (let i = 0; i < 70; i++) {
    const x = rand() * 256;
    const y = rand() * 256;
    const w = 8 + rand() * 26;
    g.globalAlpha = 0.35 + rand() * 0.5;
    g.lineWidth = 1 + rand() * 1.6;
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + w / 2, y - 2 - rand() * 2, x + w, y);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(70, 70);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
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
  private ready = false;
  private peopleLoaded = false;
  private sun!: THREE.DirectionalLight;
  private radius = 12;
  private centre = 0;
  private islandKey = "";
  private wallKey = "";
  private mixers: { mixer: THREE.AnimationMixer; owner: THREE.Object3D }[] = [];
  private balloons: THREE.Object3D[] = [];
  private boats: THREE.Object3D[] = [];
  private foams: THREE.Mesh[] = [];
  private seaTex!: THREE.Texture;
  private flock: THREE.Object3D[] = [];
  private flockKey = "";
  private dragonSpot = new THREE.Vector3();
  private pending: { state: SceneState; animate: boolean } | null = null;
  private previewId: string | null = null;
  private grid: THREE.LineSegments | null = null;
  private spinners: THREE.Object3D[] = [];
  private walkers: {
    obj: THREE.Object3D;
    mixer: THREE.AnimationMixer | null;
    d: number;
    speed: number;
  }[] = [];

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
    renderer.toneMappingExposure = 1.18;
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
    this.scene.fog = new THREE.Fog("#d3e6f2", 55, 300);
    // The sea, with pale streaks that drift to make it shimmer.
    this.seaTex = seaTexture();
    const sea = new THREE.Mesh(
      new THREE.CircleGeometry(420, 48).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({
        color: "#49a9df",
        map: this.seaTex,
        roughness: 0.38,
        metalness: 0.05,
      }),
    );
    sea.position.y = SEA;
    sea.receiveShadow = true;
    this.scene.add(sea);
    this.scene.add(skyDome());

    const hemi = new THREE.HemisphereLight("#c4dcff", "#8a7350", 0.95);
    const sun = new THREE.DirectionalLight("#ffdcae", 3.5);
    this.sun = sun;
    sun.position.copy(SUN).multiplyScalar(40);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = sc.bottom = -16;
    sc.right = sc.top = 16;
    sc.near = 1;
    sc.far = 200;
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
    // The models load once; the kingdom appears, and the camera flies in,
    // when they're here. If they fail, the island shows without buildings.
    const done = () => {
      if (this.disposed) return;
      this.ready = true;
      for (let i = 0; i < 2; i++) {
        const b = balloon();
        this.balloons.push(b);
        this.scene.add(b);
      }
      for (let i = 0; i < 3; i++) {
        const b = boat();
        this.boats.push(b);
        this.scene.add(b);
      }
      if (this.pending) this.set(this.pending.state, this.pending);
      this.preview(this.previewId);
      options.onReady?.();
    };
    loadModels().then(done, (e) => {
      console.error("kingdom models", e);
      done();
    });
  }

  /** Shows a kingdom; new buildings rise, and a new size reshapes the island. */
  set(state: SceneState, { animate = true } = {}) {
    if (!this.ready) {
      this.pending = { state, animate };
      return;
    }
    this.pending = null;
    const first = !this.state;
    const walled = STAGE_IDS.indexOf(state.hall) >= STAGE_IDS.indexOf("city");
    const islandKey = `${state.size}:${walled}:${state.hall === "kingdom" || state.hall === "capital"}`;
    if (this.islandKey !== islandKey) {
      this.islandKey = islandKey;
      this.buildIsland(state.size, walled, islandKey.endsWith("true"));
    }
    const wallKey = walled ? `${state.size}:${state.hall}` : "";
    if (this.wallKey !== wallKey) {
      this.wallKey = wallKey;
      const old = this.buildings.getObjectByName("wall");
      if (old) this.removeObject(old);
      if (walled) {
        const wall = cityWall(state.size, state.hall);
        wall.name = "wall";
        wall.position.set(this.centre, 0, this.centre);
        this.adopt(wall);
        this.buildings.add(wall);
        if (animate && !first) this.dust(wall.position);
      }
    }
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
      const obj = makeBuilding(id, x * 31 + y * 17 + 1000);
      obj.name = key;
      obj.position.set(x * T, 0, y * T);
      this.adopt(obj);
      this.buildings.add(obj);
      this.placed.set(key, id);
      if (animate && !first) this.rise(obj);
    }
    this.people(state.hall);
    if (first) this.flyIn();
  }

  /** The building shown under the cursor while the player picks a tile. */
  preview(id: string | null) {
    this.previewId = id;
    if (this.ghost) this.scene.remove(this.ghost);
    this.ghost = null;
    this.showGrid();
    if (!id || !this.ready) return;
    const g = makeBuilding(id, 1);
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
    this.showGrid();
  }
  /** The tile grid shows only while the player is building or moving. */
  private showGrid() {
    if (this.grid) this.grid.visible = !!this.previewId || this.cursor.visible;
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

  private buildIsland(size: number, walled: boolean, dragon: boolean) {
    this.island.clear();
    this.tileMeshes = [];
    const { lo, hi } = landBounds(size);
    const c = ((lo + hi) / 2) * T;
    // Wide enough for the land's corners, the city wall and a meadow beyond.
    const radius = (size * 0.707 + 1.7) * T;
    this.radius = radius;
    this.centre = c;
    const rand = seeded(7);
    // The sun's shadows cover the whole island.
    this.sun.position.set(c, 0, c).addScaledVector(SUN, 70);
    this.sun.target.position.set(c, 0, c);
    const sc = this.sun.shadow.camera;
    sc.left = sc.bottom = -(radius + 3);
    sc.right = sc.top = radius + 3;
    sc.updateProjectionMatrix();
    this.controls.maxDistance = radius * 4.2;

    // The grass top: a rounded slab, then the tiles of the land on it.
    const top = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius * 0.97, 0.7, 40),
      [
        mat(C.meadow),
        new THREE.MeshStandardMaterial({
          map: meadowTexture(),
          roughness: 0.95,
        }),
        mat(C.meadow),
      ],
    );
    top.position.set(c, -0.35, c);
    top.receiveShadow = true;
    this.island.add(top);
    // A sandy beach slopes from the meadow into the sea, with pale
    // shallows round it and rocks along the shore.
    const beach = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.99, radius * 1.19, 1.3, 48),
      mat("#ecdcae", { flatShading: false }),
    );
    beach.position.set(c, -1.35, c);
    beach.receiveShadow = true;
    this.island.add(beach);
    // Where the beach meets the water (the slope crosses sea level here).
    const shore = radius * (0.99 + ((-0.7 - SEA) / 1.3) * 0.2);
    this.foams = [];
    this.shallows(c, c, shore);
    for (let i = 0; i < 14; i++) {
      const a = rand() * Math.PI * 2;
      const r = shore * (0.97 + rand() * 0.16);
      const b = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.35 + rand() * 0.7, 0),
        mat(i % 2 ? C.rock : C.rockDark),
      );
      b.position.set(c + Math.cos(a) * r, SEA - 0.1, c + Math.sin(a) * r);
      b.castShadow = true;
      this.island.add(b);
    }

    // Buildable tiles: invisible, for picking, with a grid drawn over them
    // while the player builds.
    const tileGeo = new THREE.PlaneGeometry(T, T).rotateX(-Math.PI / 2);
    const pick = new THREE.MeshBasicMaterial({ visible: false });
    for (let x = lo; x <= hi; x++)
      for (let y = lo; y <= hi; y++) {
        const t = new THREE.Mesh(tileGeo, pick);
        t.position.set(x * T, 0.01, y * T);
        t.userData.tile = [x, y];
        this.island.add(t);
        this.tileMeshes.push(t);
      }
    const lines: number[] = [];
    const h = 0.16;
    for (let i = lo; i <= hi + 1; i++) {
      const v = (i - 0.5) * T;
      // Skip the lines inside the hall's grounds.
      const inHall = (u: number) =>
        Math.abs(u) < (HALL_RADIUS + 0.5) * T - 0.01;
      for (let j = lo; j <= hi; j++) {
        const u0 = (j - 0.5) * T;
        const u1 = (j + 0.5) * T;
        const mid = j * T;
        if (!(inHall(v) && inHall(mid))) {
          lines.push(v, h, u0, v, h, u1);
          lines.push(u0, h, v, u1, h, v);
        }
      }
    }
    const gridGeo = new THREE.BufferGeometry();
    gridGeo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(lines, 3),
    );
    this.grid = new THREE.LineSegments(
      gridGeo,
      new THREE.LineBasicMaterial({
        color: "#fff6d8",
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
      }),
    );
    this.showGrid();
    this.island.add(this.grid);

    // The meadow round the land: trees stand in groves with open grass
    // between them, and low cover (bushes, flowers, rocks) is scattered
    // everywhere. The side the camera arrives on has no groves, so trees
    // never stand between it and the kingdom.
    const landHalf = (size / 2) * T;
    const free = (x: number, z: number, margin = 0.5) => {
      const edge = Math.max(Math.abs(x - c), Math.abs(z - c));
      return (
        edge > landHalf + (walled ? 1.3 : 0.3) &&
        Math.hypot(x - c, z - c) < radius - margin
      );
    };
    const front = Math.atan2(19.5, 13);
    for (let i = 0; i < 5 + size; i++) {
      const a = front + Math.PI * (0.38 + rand() * 1.24);
      const d = radius * (0.72 + rand() * 0.2);
      const gx = c + Math.cos(a) * d;
      const gz = c + Math.sin(a) * d;
      for (let j = 0; j < 4 + Math.floor(rand() * 5); j++) {
        const x = gx + (rand() + rand() - 1) * 1.7;
        const z = gz + (rand() + rand() - 1) * 1.7;
        if (!free(x, z, 0.8)) continue;
        const item = tree(rand);
        item.position.set(x, 0, z);
        this.island.add(item);
      }
    }
    for (let i = 0; i < 40 + size * size * 1.8; i++) {
      const x = c + (rand() * 2 - 1) * radius;
      const z = c + (rand() * 2 - 1) * radius;
      if (!free(x, z)) continue;
      const item = cover(rand);
      item.position.set(x, 0, z);
      this.island.add(item);
    }

    // Sea stacks behind the kingdom: white cliffs with pines rising from
    // the water, far enough back to frame it without hiding it.
    const islets: [number, number, number, number, number][] = [
      [-1.3, -1.25, 2.6, 5.5, 2.6],
      [0.35, -1.8, 1.2, 4, 1.9],
      [1.55, -0.8, 1.8, 3.4, 1.5],
    ];
    for (const [fx, fz, y, r, s] of islets) {
      const g = this.islet(r, rand, 7, y);
      g.position.set(c + fx * radius, y, c + fz * radius);
      const cliff = peak(rand, s);
      cliff.position.set(-r * 0.15, 0, -r * 0.1);
      g.add(cliff);
      if (s > 2) {
        const second = peak(rand, s * 0.62);
        second.position.set(r * 0.5, 0, r * 0.2);
        g.add(second);
      }
      this.island.add(g);
      this.shallows(g.position.x, g.position.z, r * 1.1);
    }
    // A bare rock off to the side, where the kingdom's dragon keeps watch.
    if (dragon) {
      const g = this.islet(2.6, rand, 0, 2.2);
      g.position.set(c + radius * 1.02, 2.2, c - radius * 1.22);
      this.dragonSpot.copy(g.position);
      this.island.add(g);
      this.shallows(g.position.x, g.position.z, 2.6 * 1.1);
    }

    this.controls.target.set(c, 1.6, c);
  }

  /**
   * The water round a shore of radius `shore`: two bands of pale shallows
   * and two rings of foam that wash in and out.
   */
  private shallows(
    x: number,
    z: number,
    shore: number,
    parent = this.island,
    y = SEA,
  ) {
    const disc = (r: number, color: string, opacity: number, lift: number) => {
      const m = new THREE.Mesh(
        new THREE.CircleGeometry(r, 48).rotateX(-Math.PI / 2),
        new THREE.MeshStandardMaterial({
          color,
          transparent: true,
          opacity,
          roughness: 0.25,
          depthWrite: false,
        }),
      );
      m.position.set(x, y + lift, z);
      m.renderOrder = 1;
      parent.add(m);
    };
    disc(shore * 1.34, "#57c9de", 0.38, 0.02);
    disc(shore * 1.16, "#9cecdf", 0.5, 0.03);
    [0, 1].forEach((i) => {
      const foam = new THREE.Mesh(
        new THREE.RingGeometry(
          shore * 0.995,
          shore * (1.004 + i * 0.002),
          72,
        ).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({
          color: "#ffffff",
          transparent: true,
          opacity: 0.8,
          depthWrite: false,
        }),
      );
      foam.position.set(x, y + 0.04 + i * 0.005, z);
      foam.renderOrder = 2;
      foam.userData.phase = i * Math.PI + shore;
      parent.add(foam);
      this.foams.push(foam);
    });
  }

  /** A small islet: a grass top on a rock that stands in the sea. */
  private islet(r: number, rand: () => number, trees: number, y: number) {
    const g = new THREE.Group();
    const top = new THREE.Mesh(
      new THREE.CylinderGeometry(r, r * 0.94, 0.6, 18),
      mat(trees ? C.meadow : C.rock),
    );
    top.position.y = -0.3;
    top.receiveShadow = true;
    const h = y - 0.6 - SEA + 0.6;
    const rock = cliff(r * 0.93, r * 1.12, h);
    rock.position.y = -0.6 - h / 2;
    g.add(top, rock);
    // Fallen rocks at the foot of the cliff.
    for (let i = 0; i < 6; i++) {
      const a = rand() * Math.PI * 2;
      const b = new THREE.Mesh(
        new THREE.DodecahedronGeometry(r * (0.12 + rand() * 0.14), 0),
        mat("#cfc8ba"),
      );
      b.position.set(
        Math.cos(a) * r * 1.2,
        SEA - y + 0.05,
        Math.sin(a) * r * 1.2,
      );
      g.add(b);
    }
    for (let i = 0; i < trees; i++) {
      const a = rand() * Math.PI * 2;
      const d = r * (0.45 + rand() * 0.45);
      const item = scenery(rand);
      item.position.set(Math.cos(a) * d, 0, Math.sin(a) * d);
      g.add(item);
    }
    return g;
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
      this.fire.position.copy(hall.userData.light);
      this.scene.add(this.fire);
    }
    if (animate) this.rise(hall);
  }

  /** Registers a model's animated parts: flames, flags and chimney smoke. */
  private adopt(obj: THREE.Object3D) {
    obj.traverse((o) => {
      if (o.userData.flame) this.flames.push(o as THREE.Mesh);
      if (o.userData.flag) this.flags.push(o as THREE.Mesh);
      if (o.userData.spin) this.spinners.push(o);
      // Kit models with their own loop (fire, cloth) play it.
      const tick = (
        o.userData.clips as THREE.AnimationClip[] | undefined
      )?.find((c) => c.name === "tick");
      if (tick && !this.options.reducedMotion) {
        const mixer = new THREE.AnimationMixer(o);
        mixer.clipAction(tick).play();
        this.mixers.push({ mixer, owner: obj });
      }
    });
    const smoke = obj.userData.smoke as THREE.Vector3 | undefined;
    if (smoke && !this.options.reducedMotion) {
      const origin = smoke
        .clone()
        .multiplyScalar(obj.scale.x)
        .add(obj.position);
      for (let i = 0; i < 7; i++) {
        const sprite = new THREE.Sprite(
          new THREE.SpriteMaterial({
            map: puff(),
            color: "#a9a39c",
            transparent: true,
            opacity: 0,
            depthWrite: false,
          }),
        );
        sprite.userData.owner = obj;
        this.scene.add(sprite);
        this.smoke.push({ sprite, origin, t: i / 7 });
      }
    }
  }

  private removeObject(obj: THREE.Object3D) {
    this.buildings.remove(obj);
    this.flames = this.flames.filter((f) => !isChild(obj, f));
    this.flags = this.flags.filter((f) => !isChild(obj, f));
    this.spinners = this.spinners.filter((f) => !isChild(obj, f));
    this.mixers = this.mixers.filter((m) => m.owner !== obj);
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
    for (let i = 0; i < 54; i++) {
      const a = rand() * Math.PI * 2;
      const below = false;
      // The sea of clouds lies well under the island; the few clouds at the
      // island's height stay far off, so none drifts between it and the camera.
      // Big banks low on the horizon, smaller clouds higher up.
      const low = i % 3 === 0;
      const r = below
        ? 14 + rand() * 120
        : low
          ? 150 + rand() * 90
          : 80 + rand() * 150;
      const puff = cloudPuff(rand, low ? 6 + rand() * 6 : 2.5 + rand() * 3.5);
      puff.position.set(
        Math.cos(a) * r,
        below ? -26 - rand() * 18 : low ? 6 + rand() * 14 : 22 + rand() * 40,
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

  /** Villagers walking the lane round the hall, more as the kingdom grows. */
  private people(stage: StageId) {
    if (this.options.reducedMotion) return;
    if (!this.peopleLoaded) {
      loadPeople().then(
        () => {
          this.peopleLoaded = true;
          if (!this.disposed && this.state) this.people(this.state.hall);
        },
        () => {},
      );
      return;
    }
    const count = {
      camp: 1,
      village: 2,
      town: 3,
      city: 4,
      kingdom: 5,
      capital: 6,
    }[stage];
    while (this.walkers.length < count) {
      const i = this.walkers.length;
      const p = person(PEOPLE[i % PEOPLE.length]);
      let mixer: THREE.AnimationMixer | null = null;
      if (p.walk) {
        mixer = new THREE.AnimationMixer(p.root);
        mixer.clipAction(p.walk).play();
        mixer.setTime(i * 0.37);
      }
      this.scene.add(p.obj);
      this.walkers.push({
        obj: p.obj,
        mixer,
        d: i * 5.3,
        speed: (i % 2 ? -1 : 1) * (0.42 + (i % 3) * 0.04),
      });
    }
    this.creatures(stage);
  }
  /** Sheep on the meadow, and from the kingdom stage a dragon on its rock. */
  private creatures(stage: StageId) {
    const key = `${this.islandKey}:${stage}`;
    if (this.flockKey === key) return;
    this.flockKey = key;
    for (const o of this.flock) {
      this.scene.remove(o);
      this.mixers = this.mixers.filter((m) => m.owner !== o);
    }
    this.flock = [];
    const add = (name: "sheep" | "dragon", scale: number, t: number) => {
      const p = person(name, scale);
      if (p.idle) {
        const mixer = new THREE.AnimationMixer(p.root);
        mixer.clipAction(p.idle).play();
        mixer.setTime(t);
        this.mixers.push({ mixer, owner: p.obj });
      }
      this.scene.add(p.obj);
      this.flock.push(p.obj);
      return p.obj;
    };
    const rand = seeded(23);
    const c = this.centre;
    const rank = STAGE_IDS.indexOf(stage);
    for (let i = 0; i < 3 + rank; i++) {
      // The meadow between the land (or its wall) and the island's edge.
      const a = rand() * Math.PI * 2;
      const d = this.radius - 0.7 - rand() * 0.8;
      const sheep = add("sheep", 1.15, i * 0.9);
      sheep.position.set(c + Math.cos(a) * d, 0, c + Math.sin(a) * d);
      sheep.rotation.y = rand() * 6;
    }
    if (rank >= STAGE_IDS.indexOf("kingdom")) {
      const dragon = add("dragon", 2.6, 0);
      dragon.position.copy(this.dragonSpot);
      dragon.lookAt(c, this.dragonSpot.y, c);
    }
  }
  /** A point d along the square lane round the hall's grounds. */
  private lane(d: number): [number, number, number] {
    const half = (HALL_RADIUS + 0.55) * T;
    const side = half * 2;
    const total = side * 4;
    const t = ((d % total) + total) % total;
    const k = Math.floor(t / side);
    const u = t - k * side - half;
    const pts: [number, number, number][] = [
      [u, half, Math.PI / 2],
      [half, -u, Math.PI],
      [-u, -half, -Math.PI / 2],
      [-half, u, 0],
    ];
    return pts[k];
  }

  // ---- camera ----

  private flyIn() {
    const target = this.controls.target.clone();
    // The camera sits low, looking across the kingdom to the hall, far
    // enough back for the whole island to fit the screen's width (a tall
    // phone needs much more room than a wide desktop).
    const halfWidth =
      Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) *
      Math.min(this.camera.aspect, 1.9);
    const distance = Math.max(
      this.radius * 2.25,
      (this.radius * 1.02) / halfWidth,
    );
    this.controls.maxDistance = Math.max(this.radius * 4.2, distance * 1.25);
    const to = new THREE.Vector3(13, 8.2, 19.5)
      .normalize()
      .multiplyScalar(distance)
      .add(target);
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
    for (const f of this.foams) {
      // Each ring washes a little way out and fades, then comes back.
      const w = (Math.sin(time * 0.7 + f.userData.phase) + 1) / 2;
      f.scale.setScalar(1 + w * 0.03);
      (f.material as THREE.MeshBasicMaterial).opacity = 0.7 - w * 0.55;
    }
    this.seaTex.offset.x += dt * 0.004;
    this.seaTex.offset.y += dt * 0.007;
    this.boats.forEach((b, i) => {
      const dir = i % 2 ? -1 : 1;
      const a = time * 0.012 * dir + i * 2.1 + 0.4;
      const r = this.radius * (1.75 + i * 0.55);
      b.position.set(
        this.centre + Math.cos(a) * r,
        SEA - 0.05 + Math.sin(time * 1.1 + i) * 0.04,
        this.centre + Math.sin(a) * r,
      );
      b.rotation.y = -a + (dir > 0 ? 0 : Math.PI);
      b.rotation.z = Math.sin(time * 0.9 + i) * 0.04;
    });
    for (const s of this.spinners) s.rotation.z += dt * 0.6;
    for (const m of this.mixers) m.mixer.update(dt);
    this.balloons.forEach((b, i) => {
      const a = time * 0.02 * (i ? -1 : 1) + i * 2.2 + 3.6;
      const r = this.radius * (1.7 + i * 0.5);
      b.position.set(
        this.centre + Math.cos(a) * r,
        11 + i * 5 + Math.sin(time * 0.3 + i) * 0.5,
        this.centre + Math.sin(a) * r,
      );
    });
    for (const w of this.walkers) {
      w.d += w.speed * dt;
      const [x, z, heading] = this.lane(w.d);
      w.obj.position.set(x, 0, z);
      w.obj.rotation.y = heading + (w.speed < 0 ? Math.PI : 0);
      w.mixer?.update(dt);
    }
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
      // A thin grey plume that leans with the wind and thins as it rises.
      s.t = (s.t + dt * 0.16) % 1;
      s.sprite.position
        .copy(s.origin)
        .add(
          new THREE.Vector3(
            s.t * s.t * 1.3 + Math.sin(time * 1.3 + s.t * 9) * 0.04,
            s.t * 2.2,
            s.t * 0.25,
          ),
        );
      s.sprite.scale.setScalar(0.22 + s.t * 0.75);
      s.sprite.material.opacity = Math.sin(s.t * Math.PI) ** 1.5 * 0.34;
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

/**
 * A cliff face: a column whose sides are pushed in and out, more toward the
 * foot, so it reads as weathered rock, not a drum.
 */
function cliff(top: number, bottom: number, h: number) {
  const geo = new THREE.CylinderGeometry(top, bottom, h, 13, 4, true);
  const pos = geo.attributes.position;
  // Jitter by position, so the vertices on the cylinder's seam move together.
  const hash = (x: number, y: number, z: number, n: number) => {
    const v =
      Math.sin(
        Math.round(x * 10) * 12.9898 +
          Math.round(y * 10) * 78.233 +
          Math.round(z * 10) * 37.719 +
          n,
      ) * 43758.5453;
    return v - Math.floor(v) - 0.5;
  };
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const down = 0.5 - y / h; // 0 at the top, 1 at the foot
    if (down < 0.05) continue;
    const k = 1 + hash(x, y, z, 1) * 0.34 * (0.4 + down);
    pos.setXYZ(i, x * k, y + hash(x, y, z, 2) * h * 0.06, z * k);
  }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, mat("#d6d0c3"));
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
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
