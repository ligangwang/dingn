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
import { GTAOPass } from "three/examples/jsm/postprocessing/GTAOPass.js";
import {
  HALL_RADIUS,
  STAGE_IDS,
  landBounds,
  type StageId,
} from "@/data/kingdom.mjs";
import {
  LAND_HALF,
  SEA,
  depthTexture,
  forest,
  forestSpots,
  landMesh,
  landShape,
  skyDome,
  type LandShape,
  type Stack,
  type TreeSpot,
} from "./kingdom-land";
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
  person,
} from "./kingdom-models";

export const T = 2; // a tile's width in world units
// The sun stands where it does in the photograph of the sky (48 degrees up),
// off to the side, so one face of each wall is in shade.
const SUN = new THREE.Vector3(-0.6044, 0.7431, 0.2871).normalize();
// The horizon, and the fog that fades into it (linear light, like the sky).
const HAZE = new THREE.Color().setRGB(0.31, 0.36, 0.45);

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

let shadeTex: THREE.CanvasTexture | null = null;
/** The soft shadow a tree's crown throws on the grass. */
function treeShade() {
  if (!shadeTex) {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const g = c.getContext("2d")!;
    const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    r.addColorStop(0, "rgba(0,0,0,1)");
    r.addColorStop(0.55, "rgba(0,0,0,0.8)");
    r.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = r;
    g.fillRect(0, 0, 64, 64);
    shadeTex = new THREE.CanvasTexture(c);
  }
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.MeshBasicMaterial({
      map: shadeTex,
      color: "#0a1408",
      transparent: true,
      opacity: 0.34,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    }),
  );
  m.rotation.x = -Math.PI / 2;
  m.userData.flat = true;
  return m;
}
let wornTex: THREE.CanvasTexture | null = null;
/**
 * Trodden earth, laid under a building so it stands on worn ground, not on
 * a lawn: brown in the middle, darker where the walls meet it, fading to
 * nothing at a ragged edge.
 */
function wornGround(size: number) {
  if (!wornTex) {
    const S = 256;
    const c = document.createElement("canvas");
    c.width = c.height = S;
    const g = c.getContext("2d")!;
    const rand = seeded(9);
    const grad = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    grad.addColorStop(0, "rgba(120, 96, 66, 0.9)");
    grad.addColorStop(0.45, "rgba(132, 108, 74, 0.8)");
    grad.addColorStop(0.75, "rgba(140, 122, 80, 0.4)");
    grad.addColorStop(1, "rgba(140, 130, 84, 0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, S, S);
    // Grass creeps in from the edge, and pebbles lie on the earth.
    g.globalCompositeOperation = "destination-out";
    for (let i = 0; i < 160; i++) {
      const a = rand() * Math.PI * 2;
      const d = S * (0.3 + rand() * 0.2);
      g.globalAlpha = 0.25 + rand() * 0.35;
      g.beginPath();
      g.arc(
        S / 2 + Math.cos(a) * d,
        S / 2 + Math.sin(a) * d,
        4 + rand() * 12,
        0,
        7,
      );
      g.fill();
    }
    g.globalCompositeOperation = "source-atop";
    for (let i = 0; i < 260; i++) {
      g.globalAlpha = 0.25 + rand() * 0.35;
      g.fillStyle = i % 2 ? "#6f573b" : "#b39a72";
      g.beginPath();
      g.arc(rand() * S, rand() * S, 0.8 + rand() * 1.6, 0, 7);
      g.fill();
    }
    wornTex = new THREE.CanvasTexture(c);
    wornTex.colorSpace = THREE.SRGBColorSpace;
  }
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({
      map: wornTex,
      transparent: true,
      depthWrite: false,
      roughness: 1,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    }),
  );
  m.position.y = 0.012;
  m.receiveShadow = true;
  m.userData.flat = true;
  return m;
}
// Tiles that are ground already, or should stand in grass.
const NO_WORN = new Set(["path", "tree", "flowers", "farm"]);

/**
 * A tuft of three grass blades, for scattering over the meadow. Each blade
 * is drawn on both faces with the ground's own normal, so a tuft takes the
 * light as the grass under it does.
 */
function tuftGeometry() {
  // Two crossed cards, each drawn from both sides. Their corners are in
  // `corner`, not `position`, so the ambient-shadow pass, which draws every
  // mesh with a plain material, draws nothing for them.
  const corner: number[] = [];
  const uv: number[] = [];
  const index: number[] = [];
  for (let k = 0; k < 4; k++) {
    const a = (k % 2) * (Math.PI / 2) + 0.4;
    const dx = Math.cos(a) * 0.075;
    const dz = Math.sin(a) * 0.075;
    corner.push(-dx, 0, -dz, dx, 0, dz, dx, 0.1, dz, -dx, 0.1, -dz);
    uv.push(0, 0, 1, 0, 1, 1, 0, 1);
    const i = k * 4;
    if (k < 2) index.push(i, i + 1, i + 2, i, i + 2, i + 3);
    else index.push(i + 2, i + 1, i, i + 3, i + 2, i);
  }
  const geo = new THREE.BufferGeometry();
  const n = corner.length / 3;
  geo.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(new Float32Array(n * 3), 3),
  );
  geo.setAttribute("corner", new THREE.Float32BufferAttribute(corner, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute(
    "normal",
    new THREE.Float32BufferAttribute(
      Array.from({ length: n }, () => [0, 1, 0]).flat(),
      3,
    ),
  );
  geo.setIndex(index);
  return geo;
}
/** A clump of fine grass blades, pale so each tuft's own green tints it. */
function tuftMaterial() {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 128;
  const g = c.getContext("2d")!;
  let seed = 7;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 70; i++) {
    // Each blade leaves the foot of the clump and bends outward.
    const x0 = 128 + (rand() - 0.5) * 90;
    const lean = (x0 - 128) * 0.9 + (rand() - 0.5) * 60;
    const h = 40 + rand() * 84;
    const w = 1.6 + rand() * 1.6;
    g.fillStyle = `hsl(${70 + rand() * 30}, ${12 + rand() * 18}%, ${58 + rand() * 36}%)`;
    g.beginPath();
    g.moveTo(x0 - w, 128);
    g.quadraticCurveTo(x0 + lean * 0.3, 128 - h * 0.6, x0 + lean, 128 - h);
    g.quadraticCurveTo(x0 + lean * 0.3 + w, 128 - h * 0.6, x0 + w, 128);
    g.fill();
  }
  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;
  const m = new THREE.MeshStandardMaterial({
    map,
    alphaTest: 0.35,
    roughness: 1,
  });
  m.onBeforeCompile = (s) => {
    s.vertexShader =
      "attribute vec3 corner;\n" +
      s.vertexShader.replace(
        "#include <begin_vertex>",
        "vec3 transformed = corner;",
      );
  };
  return m;
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
    // How deep the water is over the whole land (kingdom-land.ts).
    seaDepth: { value: null as THREE.Texture | null },
    seaCentre: { value: new THREE.Vector2() },
    seaSky: { value: new THREE.Color().setRGB(0.3, 0.38, 0.5) },
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
        uniform sampler2D seaDepth;
        uniform vec2 seaCentre;
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
        // How far out from the nearest shore, judged by the water's depth.
        float seaShore(vec2 p){
          float depth = texture2D(seaDepth, (p - seaCentre) / ${(LAND_HALF * 2).toFixed(1)} + 0.5).r * 8.0 - 2.0;
          return depth * 4.4;
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
        seaCol = mix(seaCol, vec3(0.025, 0.19, 0.46), smoothstep(12.0, 26.0, seaD));
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
        totalEmissiveRadiance += seaSky * seaFresnel * 0.12 * (1.0 - seaFoam);`,
      )
      .replace(
        "#include <opaque_fragment>",
        `// The sun on the water is a scatter of glints, not a sheet of white.
        float seaGlint = smoothstep(0.6, 0.85, seaNoise(vSea.xz * 5.0 + vec2(seaTime * 0.7, -seaTime * 0.5)));
        outgoingLight = totalDiffuse + totalEmissiveRadiance
          + min(reflectedLight.directSpecular, vec3(2.6)) * (0.1 + 0.9 * seaGlint)
          + reflectedLight.indirectSpecular;
        #include <opaque_fragment>`,
      );
  };
  return { material, uniforms };
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
  private land: LandShape | null = null;
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
  private touched = 0;
  private flock: THREE.Object3D[] = [];
  private flockKey = "";
  private dragonSpot = new THREE.Vector3();
  private pending: { state: SceneState; animate: boolean } | null = null;
  private previewId: string | null = null;
  private grid: THREE.LineSegments | null = null;
  private spinners: THREE.Object3D[] = [];
  private flows = new Set<THREE.Texture>(); // falling water
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
    this.scene.fog = new THREE.Fog(HAZE, 120, 500);
    const water = seaMaterial();
    this.sea = water.uniforms;
    const sea = new THREE.Mesh(
      new THREE.CircleGeometry(480, 48).rotateX(-Math.PI / 2),
      water.material,
    );
    sea.position.y = SEA;
    sea.receiveShadow = true;
    this.scene.add(sea);
    // The sky is a photograph of a real one; once it is here it also lights
    // the scene, so shade is filled with the blue of that same sky.
    const sky = skyDome(SUN, HAZE, () => {
      if (this.disposed) return;
      const around = new THREE.Scene();
      around.add(sky.mesh.clone());
      // The ground below the horizon bounces a little warm light back up.
      const below = new THREE.Mesh(
        new THREE.SphereGeometry(600, 16, 8, 0, Math.PI * 2, Math.PI / 2),
        new THREE.MeshBasicMaterial({
          color: new THREE.Color().setRGB(0.1, 0.11, 0.06),
          side: THREE.BackSide,
        }),
      );
      around.add(below);
      const pmrem = new THREE.PMREMGenerator(renderer);
      this.scene.environment = pmrem.fromScene(around, 0, 1, 1000).texture;
      pmrem.dispose();
      hemi.intensity = 0.12;
    });
    this.scene.add(sky.mesh);

    // Until the sky arrives, a plain light stands in for it.
    const hemi = new THREE.HemisphereLight("#bcd6ff", "#8f7a5c", 1.0);
    const sun = new THREE.DirectionalLight("#fff1dc", 3.9);
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
      // Soft shade where walls meet the ground and in corners, which is
      // what makes a building sit in the scene, not on it.
      const ao = new GTAOPass(
        this.scene,
        this.camera,
        host.clientWidth,
        host.clientHeight,
      );
      ao.updateGtaoMaterial({
        radius: 0.7,
        distanceExponent: 1.4,
        thickness: 1.2,
        scale: 1.15,
      });
      ao.blendIntensity = 0.85;
      // Smoke, glows and other see-through things cast no such shade.
      const hide = ao as unknown as {
        _overrideVisibility: () => void;
        _visibilityCache: THREE.Object3D[];
      };
      hide._overrideVisibility = () => {
        this.scene.traverse((o) => {
          if (!o.visible) return;
          const m = (o as THREE.Mesh).material as THREE.Material | undefined;
          const solid =
            (o as THREE.Mesh).isMesh &&
            m &&
            !Array.isArray(m) &&
            !m.transparent &&
            m.depthWrite;
          const group = !(o as THREE.Mesh).isMesh && o.children.length;
          const many = (o as THREE.Mesh).isMesh && Array.isArray(m);
          if (solid || group || many || o === this.scene) return;
          o.visible = false;
          hide._visibilityCache.push(o);
        });
      };
      this.composer.addPass(ao);
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
        const b = balloon(i);
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
      if (!NO_WORN.has(id)) obj.add(wornGround(T * 1.5));
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

    // The country round the town: level under the town itself, then
    // hills, forest and a bay.
    const shape = landShape(radius);
    this.land = shape;
    const ground = landMesh(shape);
    ground.position.set(c, 0, c);
    this.island.add(ground);
    const trees = forestSpots(
      shape,
      window.innerWidth < 700 ? 2200 : 6000,
      radius * 2.4 + 4,
    );

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
        const s = 0.8 + rand() * 0.45;
        rand(); // keeps the groves where they were when some were firs
        trees.push({ x: x - c, y: 0, z: z - c, s, kind: 0 });
        // Its shadow on the grass, thrown away from the sun.
        const shade = treeShade();
        shade.scale.set(2.0 * s, 1.5 * s, 1);
        shade.rotation.z = Math.atan2(SUN.z, -SUN.x);
        shade.position.set(x - SUN.x * 2.2 * s, 0.02, z - SUN.z * 2.2 * s);
        this.island.add(shade);
      }
    }
    for (const mesh of forest(trees, SUN)) {
      mesh.position.set(c, 0, c);
      this.island.add(mesh);
    }
    // Tufts of longer grass, so the meadow isn't a mown lawn up close.
    const tufts = new THREE.InstancedMesh(
      tuftGeometry(),
      tuftMaterial(),
      Math.round(radius * radius * 22),
    );
    const at = new THREE.Object3D();
    const tint = new THREE.Color();
    let placed = 0;
    for (let i = 0; i < tufts.count; i++) {
      const x = c + (rand() * 2 - 1) * radius * 1.05;
      const z = c + (rand() * 2 - 1) * radius * 1.05;
      if (!free(x, z, 0.25)) continue;
      at.position.set(x, 0, z);
      at.rotation.y = rand() * 6.3;
      at.scale.setScalar(0.7 + rand() * 0.8);
      at.updateMatrix();
      tufts.setMatrixAt(placed, at.matrix);
      tufts.setColorAt(
        placed++,
        tint.set(["#7d9144", "#8c9c4c", "#74883e", "#99a656"][i % 4]),
      );
    }
    tufts.count = placed;
    tufts.receiveShadow = true;
    tufts.frustumCulled = false; // its `position` is empty
    this.island.add(tufts);
    const saplings: TreeSpot[] = [];
    for (let i = 0; i < 24 + size * size * 1.1; i++) {
      const x = c + (rand() * 2 - 1) * radius;
      const z = c + (rand() * 2 - 1) * radius;
      if (!free(x, z)) continue;
      // Most are saplings, small ones of the forest's trees; the rest are
      // boulders and stumps.
      if (rand() < 0.6) {
        saplings.push({
          x: x - c,
          y: 0,
          z: z - c,
          s: 0.18 + rand() * 0.14,
          kind: 0,
        });
        continue;
      }
      const item = cover(rand);
      item.position.set(x, 0, z);
      this.island.add(item);
    }
    for (const mesh of forest(saplings, SUN)) {
      mesh.position.set(c, 0, c);
      this.island.add(mesh);
    }

    // A rock that stands in the sea is moved out if the shore reaches it.
    const afloat = (x: number, z: number) => {
      while (shape.height(x, z) > SEA - 0.9) x -= 3;
      return [x, z];
    };
    const stacks: Stack[] = [];
    // A bare rock off the shore, where the kingdom's dragon keeps watch.
    if (dragon) {
      const [x, z] = afloat(shape.bay.x + 22, shape.bay.z + 34);
      const g = this.islet(2.6, rand, 2.2);
      g.position.set(c + x, 2.2, c + z);
      this.dragonSpot.copy(g.position);
      this.island.add(g);
      stacks.push({ x, z, r: 2.6 * 1.1 });
    }
    this.sea.seaDepth.value?.dispose();
    this.sea.seaDepth.value = depthTexture(shape, stacks);
    this.sea.seaCentre.value.set(c, c);

    this.controls.target.set(c, 1.6, c);
  }

  /** A bare rock that stands in the sea. */
  private islet(r: number, rand: () => number, y: number) {
    const g = new THREE.Group();
    const top = new THREE.Mesh(
      new THREE.CylinderGeometry(r, r * 0.94, 0.6, 18),
      mat(C.rock),
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
    return g;
  }

  private placeHall(stage: StageId, animate: boolean) {
    const old = this.buildings.getObjectByName("hall");
    if (old) this.removeObject(old);
    const hall = makeHall(stage);
    hall.name = "hall";
    hall.add(wornGround(T * (HALL_RADIUS * 2 + 1) * 1.45));
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
      if (o.userData.flow) {
        const map = ((o as THREE.Mesh).material as THREE.MeshStandardMaterial)
          .map;
        if (map) this.flows.add(map);
      }
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
    // A garden tree is one of the forest's trees, with its shade under it.
    const tree = obj.userData.tree as { s: number; kind: number } | undefined;
    if (tree) {
      const turn = (obj.userData.turn as number) * 0.4;
      for (const mesh of forest([{ x: turn, y: 0, z: -turn, ...tree }], SUN))
        obj.add(mesh);
      const shade = treeShade();
      shade.scale.set(2.0 * tree.s, 1.5 * tree.s, 1);
      shade.rotation.z = Math.atan2(SUN.z, -SUN.x);
      shade.position.set(-SUN.x * 2.2 * tree.s, 0.03, -SUN.z * 2.2 * tree.s);
      obj.add(shade);
    }
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
    // Measure the building without the worn ground it stands on.
    const flat = obj.children.filter((o) => o.userData.flat);
    obj.remove(...flat);
    const bounds = new THREE.Box3().setFromObject(obj);
    obj.add(...flat);
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
        // Over the rooftops, where the camera never comes close to them.
        r: 7 + i * 2.6,
        h: 9.5 + i * 1.2,
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
      const d = this.radius - 0.8 - rand() * 0.8;
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
    // The camera never dips into a hillside.
    if (this.land) {
      const floor =
        this.land.height(
          this.camera.position.x - this.centre,
          this.camera.position.z - this.centre,
        ) + 0.8;
      if (this.camera.position.y < floor) this.camera.position.y = floor;
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
      // Round and round, well out in the bay.
      const a = time * 0.02 * dir + i * 2.1 + 0.4;
      const r = 22 + i * 12;
      const bay = this.land?.bay ?? { x: 0, z: 0 };
      b.position.set(
        this.centre + bay.x - 45 + Math.cos(a) * r,
        SEA - 0.05 + Math.sin(time * 1.1 + i) * 0.04,
        this.centre + bay.z + Math.sin(a) * r,
      );
      b.rotation.y = -a + (dir > 0 ? 0 : Math.PI);
      b.rotation.z = Math.sin(time * 0.9 + i) * 0.04;
    });
    for (const s of this.spinners) s.rotation.z += dt * 0.6;
    for (const t of this.flows) t.offset.y += dt * 0.9;
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
