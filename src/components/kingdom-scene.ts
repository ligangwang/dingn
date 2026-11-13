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
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
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
// A low sun off to the side: long shadows, and one face of each wall in shade.
const SUN = new THREE.Vector3(-0.8, 0.34, 0.38).normalize();
const HAZE = "#dfe6ea"; // the horizon, and the fog that fades into it

/**
 * How far the coast stands out at angle `a` round the island (1 is the
 * average), so the shore is a ragged line, not a circle. The sea's shader
 * repeats this sum to put the shallows and surf on the same line.
 */
function coast(a: number) {
  return (
    1 +
    0.06 * Math.sin(a * 3 + 1) +
    0.035 * Math.sin(a * 5 + 2.3) +
    0.015 * Math.sin(a * 9 + 0.7)
  );
}
const SHORES = 6; // the most shores the sea's shader follows

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
      top: { value: new THREE.Color("#2a62b8") },
      middle: { value: new THREE.Color("#86bdec") },
      horizon: { value: new THREE.Color(HAZE) },
      warm: { value: new THREE.Color("#ffd9a8") },
      sun: { value: SUN.clone() },
    },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 top; uniform vec3 middle; uniform vec3 horizon; uniform vec3 warm; uniform vec3 sun; varying vec3 vDir;
      void main(){
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 c = mix(horizon, middle, smoothstep(0.02, 0.32, h));
        c = mix(c, top, smoothstep(0.25, 0.9, h));
        float s = max(dot(d, sun), 0.0);
        // The sky warms toward the sun, most of all low down; then the
        // sun's glow and its disc.
        c = mix(c, warm, pow(s, 3.0) * 0.45 * (1.0 - smoothstep(0.0, 0.55, h)));
        c += vec3(1.0, 0.8, 0.5) * pow(s, 32.0) * 0.3;
        c += vec3(1.0, 0.93, 0.8) * (pow(s, 400.0) * 0.6 + smoothstep(0.99965, 0.99985, s) * 3.0);
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  return new THREE.Mesh(geo, material);
}

/** A soft white puff made of a few flattened icospheres. */
function cloudPuff(rand: () => number, scale: number) {
  const g = new THREE.Group();
  const m = new THREE.MeshLambertMaterial({
    color: "#ffffff",
    emissive: "#ffe9d2",
    emissiveIntensity: 0.4,
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

/**
 * The sea: a standard material (so it takes the sun, shadows and fog) whose
 * shader adds what makes water read as water. Its colour runs from pale
 * turquoise at a shore to deep blue; small moving waves tilt the surface,
 * which breaks the sun into glitter; it reflects the sky at a glancing
 * angle; and surf washes onto each shore.
 */
function seaMaterial() {
  const uniforms = {
    seaTime: { value: 0 },
    // x, z, radius, and whether the shore follows `coast`.
    seaShores: {
      value: Array.from({ length: SHORES }, () => new THREE.Vector4()),
    },
    seaShoreCount: { value: 0 },
    seaSky: { value: new THREE.Color("#bcd5ea") },
  };
  const material = new THREE.MeshStandardMaterial({
    color: "#ffffff",
    roughness: 0.24,
    metalness: 0,
  });
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vSea;")
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nvSea = (modelMatrix * vec4(position, 1.0)).xyz;",
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        varying vec3 vSea;
        uniform float seaTime;
        uniform vec4 seaShores[${SHORES}];
        uniform int seaShoreCount;
        uniform vec3 seaSky;
        float seaHash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float seaNoise(vec2 p){
          vec2 i = floor(p); vec2 f = fract(p); f = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
          return mix(mix(seaHash(i), seaHash(i + vec2(1.0, 0.0)), f.x),
                     mix(seaHash(i + vec2(0.0, 1.0)), seaHash(i + vec2(1.0, 1.0)), f.x), f.y);
        }
        float seaWaves(vec2 p){
          return seaNoise(p * 0.45 + vec2(seaTime * 0.2, seaTime * 0.12)) * 0.55
               + seaNoise(p * 1.15 - vec2(seaTime * 0.28, -seaTime * 0.2)) * 0.3
               + seaNoise(p * 2.7 + vec2(-seaTime * 0.4, seaTime * 0.36)) * 0.15;
        }
        // The distance out from the nearest shore.
        float seaShore(vec2 p){
          float d = 1000.0;
          for (int i = 0; i < ${SHORES}; i++) {
            if (i >= seaShoreCount) break;
            vec2 q = p - seaShores[i].xy;
            float a = atan(q.y, q.x);
            float k = 1.0 + seaShores[i].w * (0.06 * sin(a * 3.0 + 1.0) + 0.035 * sin(a * 5.0 + 2.3) + 0.015 * sin(a * 9.0 + 0.7));
            d = min(d, length(q) - seaShores[i].z * k);
          }
          return d;
        }
        float seaFoam = 0.0;
        float seaFresnel = 0.0;`,
      )
      .replace(
        "#include <map_fragment>",
        `#include <map_fragment>
        float seaD = seaShore(vSea.xz) + (seaNoise(vSea.xz * 0.35) - 0.5) * 1.4;
        vec3 seaCol = mix(vec3(0.42, 0.9, 0.8), vec3(0.08, 0.56, 0.8), smoothstep(0.2, 3.8, seaD));
        seaCol = mix(seaCol, vec3(0.035, 0.28, 0.6), smoothstep(3.0, 13.0, seaD));
        seaCol = mix(seaCol, vec3(0.025, 0.19, 0.46), smoothstep(14.0, 90.0, seaD));
        // Surf: a bright edge on the sand, and thin broken lines that roll in.
        float seaBreak = seaNoise(vSea.xz * 1.3 + seaTime * 0.1);
        float seaEdge = 1.0 - smoothstep(0.0, 0.3 + 0.25 * sin(seaTime * 0.7), seaD + seaBreak * 0.35);
        float seaRoll = sin(seaD * 2.4 + seaTime * 0.9 + seaBreak * 2.5);
        float seaLines = smoothstep(0.9, 0.99, seaRoll) * (1.0 - smoothstep(0.4, 3.2, seaD)) * smoothstep(0.3, 0.65, seaBreak);
        seaFoam = clamp(seaEdge * 0.9 + seaLines * 0.5, 0.0, 1.0);
        diffuseColor.rgb = mix(seaCol, vec3(1.0), seaFoam);`,
      )
      .replace(
        "#include <normal_fragment_maps>",
        `#include <normal_fragment_maps>
        float seaE = 0.3;
        float seaH = seaWaves(vSea.xz);
        vec3 seaN = normalize(vec3(
          (seaH - seaWaves(vSea.xz + vec2(seaE, 0.0))) * 0.6,
          seaE,
          (seaH - seaWaves(vSea.xz + vec2(0.0, seaE))) * 0.6));
        normal = normalize((viewMatrix * vec4(seaN, 0.0)).xyz);
        seaFresnel = pow(1.0 - max(dot(normal, normalize(vViewPosition)), 0.0), 5.0);`,
      )
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
        totalEmissiveRadiance += seaSky * seaFresnel * 0.42 * (1.0 - seaFoam);`,
      )
      .replace(
        "#include <opaque_fragment>",
        `// The sun on the water is a scatter of glints, not a sheet of white.
        float seaGlint = smoothstep(0.6, 0.85, seaNoise(vSea.xz * 5.0 + vec2(seaTime * 0.7, -seaTime * 0.5)));
        outgoingLight = totalDiffuse + totalEmissiveRadiance
          + min(totalSpecular, vec3(2.6)) * (0.1 + 0.9 * seaGlint);
        #include <opaque_fragment>`,
      );
  };
  return { material, uniforms };
}

/** A far range of mountains, low on the horizon and pale with haze. */
function farMountains() {
  const g = new THREE.Group();
  const rand = seeded(11);
  const m = new THREE.MeshStandardMaterial({
    color: "#6d8196",
    roughness: 1,
    flatShading: true,
  });
  for (let i = 0; i < 9; i++) {
    // Ranges stand round most of the horizon, with gaps of open sea.
    const a = (i / 9) * Math.PI * 2 + rand() * 0.3;
    if (i % 4 === 3) continue;
    const r = 215 + rand() * 40;
    for (let j = 0; j < 5 + Math.floor(rand() * 4); j++) {
      const h = 16 + rand() * 34;
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(h * (0.9 + rand() * 0.7), h, 6, 1),
        m,
      );
      const b = a + (j - 3) * 0.075 + rand() * 0.03;
      cone.position.set(
        Math.cos(b) * (r + rand() * 20),
        SEA + h / 2 - 1,
        Math.sin(b) * (r + rand() * 20),
      );
      cone.rotation.y = rand() * 6;
      g.add(cone);
    }
  }
  return g;
}

/** Darkens the corners of the picture a little, as a lens does. */
const Vignette = {
  uniforms: { tDiffuse: { value: null } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `uniform sampler2D tDiffuse; varying vec2 vUv;
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      float d = length((vUv - 0.5) * vec2(1.0, 0.82));
      c.rgb *= mix(1.0, 0.62, smoothstep(0.38, 0.86, d));
      gl_FragColor = c;
    }`,
};

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
  private sea!: ReturnType<typeof seaMaterial>["uniforms"];
  private shores: [number, number, number, number][] = [];
  private touched = 0;
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
    this.scene.fog = new THREE.Fog(HAZE, 55, 300);
    const water = seaMaterial();
    this.sea = water.uniforms;
    const sea = new THREE.Mesh(
      new THREE.CircleGeometry(420, 48).rotateX(-Math.PI / 2),
      water.material,
    );
    sea.position.y = SEA;
    sea.receiveShadow = true;
    this.scene.add(sea, farMountains());
    this.scene.add(skyDome());

    // Warm sunlight against cool light from the sky, so shade reads blue.
    const hemi = new THREE.HemisphereLight("#bcd6ff", "#8f7a5c", 1.0);
    const sun = new THREE.DirectionalLight("#ffc888", 4.1);
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
    // Low enough to look up at the towers from near the ground.
    this.controls.maxPolarAngle = 1.47;
    this.controls.enablePan = false;
    this.controls.autoRotate = !options.reducedMotion;
    this.controls.autoRotateSpeed = 0.25;
    // The slow turn stops at a touch and picks up again once left alone.
    const touch = () => (this.touched = this.clock.elapsedTime);
    this.controls.addEventListener("start", touch);
    this.controls.addEventListener("end", touch);

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
      this.composer.addPass(new ShaderPass(Vignette));
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

    // The grass top: a slab whose edge follows the coast a little, then the
    // tiles of the land on it.
    const topGeo = new THREE.CylinderGeometry(radius, radius * 0.97, 0.7, 96);
    const tp = topGeo.attributes.position;
    for (let i = 0; i < tp.count; i++) {
      const x = tp.getX(i);
      const z = tp.getZ(i);
      if (!x && !z) continue;
      const k = this.edge(Math.atan2(z, x)) / radius;
      tp.setX(i, x * k);
      tp.setZ(i, z * k);
    }
    topGeo.computeVertexNormals();
    const top = new THREE.Mesh(topGeo, [
      mat(C.meadow),
      new THREE.MeshStandardMaterial({
        map: meadowTexture(),
        roughness: 0.95,
      }),
      mat(C.meadow),
    ]);
    top.position.set(c, -0.35, c);
    top.receiveShadow = true;
    this.island.add(top);
    // A sandy beach slopes from the meadow into the sea: wide where the
    // coast stands out, narrow where it cuts in. The sea draws the shallows
    // and surf along the same line.
    const shore = radius * 1.16;
    const beachGeo = new THREE.CylinderGeometry(1, 1, 1.3, 96, 1, true);
    const bp = beachGeo.attributes.position;
    for (let i = 0; i < bp.count; i++) {
      const a = Math.atan2(bp.getZ(i), bp.getX(i));
      const inner = this.edge(a) * 0.99;
      // The slope crosses sea level 8/13 of the way down.
      const r =
        bp.getY(i) > 0
          ? inner
          : inner + ((shore * coast(a) - inner) * 1.3) / (-0.7 - SEA);
      bp.setX(i, Math.cos(a) * r);
      bp.setZ(i, Math.sin(a) * r);
    }
    beachGeo.computeVertexNormals();
    const beach = new THREE.Mesh(
      beachGeo,
      mat("#ecdcae", { flatShading: false }),
    );
    beach.position.set(c, -1.35, c);
    beach.receiveShadow = true;
    this.island.add(beach);
    this.shores = [[c, c, shore, 1]];
    for (let i = 0; i < 14; i++) {
      const a = rand() * Math.PI * 2;
      const r = shore * coast(a) * (0.97 + rand() * 0.16);
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
        Math.hypot(x - c, z - c) < this.edge(Math.atan2(z - c, x - c)) - margin
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
      this.shores.push([g.position.x, g.position.z, r * 1.1, 0]);
    }
    // A bare rock off to the side, where the kingdom's dragon keeps watch.
    if (dragon) {
      const g = this.islet(2.6, rand, 0, 2.2);
      g.position.set(c + radius * 1.02, 2.2, c - radius * 1.22);
      this.dragonSpot.copy(g.position);
      this.island.add(g);
      this.shores.push([g.position.x, g.position.z, 2.6 * 1.1, 0]);
    }
    this.shores.slice(0, SHORES).forEach((v, i) => {
      this.sea.seaShores.value[i].set(...v);
    });
    this.sea.seaShoreCount.value = Math.min(this.shores.length, SHORES);

    this.controls.target.set(c, 1.6, c);
  }

  /** The meadow's edge at angle `a` round the island's centre. */
  private edge(a: number) {
    return this.radius * (1 + (coast(a) - 1) * 0.5);
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
      const d = this.edge(a) - 0.8 - rand() * 0.8;
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
      (this.radius * 1.14) / halfWidth,
    );
    this.controls.maxDistance = Math.max(this.radius * 4.2, distance * 1.25);
    const to = new THREE.Vector3(13, 6.3, 19.5)
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
    this.sea.seaTime.value = time;
    // Left alone for a while, the view drifts slowly round the kingdom.
    this.controls.autoRotate =
      !this.options.reducedMotion &&
      !this.previewId &&
      !this.cursor.visible &&
      (!this.touched || time - this.touched > 12);
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
