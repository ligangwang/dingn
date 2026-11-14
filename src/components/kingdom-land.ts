// The land the kingdom stands on: a wide country of meadow, rolling hills and
// forest that falls to a bay on one side, in place of a small round island.
// The town's plot in the middle is level, so tiles and buildings sit at y = 0.
//
// The ground is drawn from photographs of real ground (Poly Haven, CC0): one
// for the turf up close, one from the air for the hills far off, rock on the
// steep slopes and sand at the shore. See public/models/kingdom/land.
import * as THREE from "three";

/** Half the land's width in world units (about 1 km each way). */
export const LAND_HALF = 330;
/** The sea's surface. */
export const SEA = -1.5;
const BASE = "/models/kingdom/land/";
// The sea lies this way from the town: the side the sun is on.
const SEA_X = -0.998;
const SEA_Z = 0.06;

function hash(x: number, z: number) {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function noise(x: number, z: number) {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  let fx = x - ix;
  let fz = z - iz;
  fx = fx * fx * (3 - 2 * fx);
  fz = fz * fz * (3 - 2 * fz);
  const a = hash(ix, iz);
  const b = hash(ix + 1, iz);
  const c = hash(ix, iz + 1);
  const d = hash(ix + 1, iz + 1);
  return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
}
function fbm(x: number, z: number, octaves: number) {
  let sum = 0;
  let amp = 0.5;
  let total = 0;
  for (let i = 0; i < octaves; i++) {
    sum += noise(x, z) * amp;
    total += amp;
    x = x * 2.03 + 17.3;
    z = z * 2.03 - 9.1;
    amp *= 0.5;
  }
  return sum / total;
}
const smooth = (a: number, b: number, v: number) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export type Stack = { x: number; z: number; r: number };
export type LandShape = {
  /** The level ground round the town reaches this far from its centre. */
  flat: number;
  /** Height of the ground at x,z, measured from the town's centre. */
  height: (x: number, z: number) => number;
  /** A point out in the bay, for boats and sea stacks. */
  bay: { x: number; z: number };
};

/** The shape of the land for a town whose meadow has this radius. */
export function landShape(radius: number): LandShape {
  const flat = radius * 1.12;
  const coast = flat + 17;
  const height = (x: number, z: number) => {
    const d = Math.hypot(x, z);
    const rise = smooth(flat + 1, flat + 42, d);
    const far = smooth(45, 230, d);
    const n = fbm(x * 0.016 + 3.1, z * 0.016 - 1.7, 4);
    const ridge = 1 - Math.abs(fbm(x * 0.0065 + 9, z * 0.0065 + 4, 3) * 2 - 1);
    let h =
      rise *
      (Math.max(n - 0.34, 0) * 11 +
        far * (ridge * ridge * 30 + n * 9) +
        // Mountains stand along the far edge of the country.
        smooth(190, 300, d) * ridge * ridge * (40 + n * 50) +
        (fbm(x * 0.05, z * 0.05, 2) - 0.5) * 1.1);
    // The country ends in the sea on every side, far out in the haze.
    const rim = smooth(292, 326, Math.max(Math.abs(x), Math.abs(z)));
    h = h * (1 - rim) - rim * 4;
    // The shore: a wandering line on the sea's side. Past it the ground
    // slopes under the water; the town's own ground is never cut.
    let s =
      x * SEA_X +
      z * SEA_Z -
      coast +
      (fbm(x * 0.021 + 5, z * 0.021 + 8, 3) - 0.5) * 30 +
      (noise(x * 0.11, z * 0.11) - 0.5) * 3;
    s = Math.min(s, d - flat - 10);
    const cap = s < -7 ? (-7 - s) * 0.5 : Math.max(-6.5, -(s + 7) * 0.214);
    if (cap < h + 1.5) {
      // Blend into the slope so the bluff's top is rounded.
      const k = smooth(-1.5, 1.5, h - cap);
      h = h + (cap - h) * k;
    }
    return h;
  };
  return {
    flat,
    height,
    bay: { x: SEA_X * (coast + 34), z: SEA_Z * (coast + 34) + 6 },
  };
}

/**
 * How deep the sea is over the whole land, as a texture the sea's shader
 * reads to colour the shallows and lay surf on every shore. Red holds the
 * depth: 0 at 2 units above the sea, 1 at 6 below.
 */
export function depthTexture(shape: LandShape, stacks: Stack[]) {
  const n = 640;
  const data = new Uint8Array(n * n);
  for (let j = 0; j < n; j++) {
    const z = ((j + 0.5) / n - 0.5) * 2 * LAND_HALF;
    for (let i = 0; i < n; i++) {
      const x = ((i + 0.5) / n - 0.5) * 2 * LAND_HALF;
      let depth = SEA - shape.height(x, z);
      for (const s of stacks)
        depth = Math.min(depth, (Math.hypot(x - s.x, z - s.z) - s.r) * 0.3);
      data[j * n + i] = Math.round(
        Math.min(1, Math.max(0, (depth + 2) / 8)) * 255,
      );
    }
  }
  const t = new THREE.DataTexture(data, n, n, THREE.RedFormat);
  t.magFilter = t.minFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
}

let textures: Record<string, THREE.Texture> | null = null;
function groundTextures() {
  if (textures) return textures;
  const loader = new THREE.TextureLoader();
  const load = (file: string, color = true) => {
    const t = loader.load(BASE + file);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
    if (color) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  textures = {
    grass: load("grass.jpg"),
    grassN: load("grass-n.jpg", false),
    hills: load("hills.jpg"),
    rock: load("rock.jpg"),
    sand: load("sand.jpg"),
  };
  return textures;
}

function groundMaterial() {
  const t = groundTextures();
  const uniforms = {
    landGrass: { value: t.grass },
    landGrassN: { value: t.grassN },
    landHills: { value: t.hills },
    landRock: { value: t.rock },
    landSand: { value: t.sand },
  };
  const material = new THREE.MeshStandardMaterial({
    color: "#ffffff",
    roughness: 0.96,
    metalness: 0,
  });
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying vec3 vLand;\nvarying vec3 vLandN;",
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        vLand = (modelMatrix * vec4(position, 1.0)).xyz;
        vLandN = normalize(mat3(modelMatrix) * normal);`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        varying vec3 vLand;
        varying vec3 vLandN;
        uniform sampler2D landGrass;
        uniform sampler2D landGrassN;
        uniform sampler2D landHills;
        uniform sampler2D landRock;
        uniform sampler2D landSand;
        float landNear = 0.0;`,
      )
      .replace(
        "#include <map_fragment>",
        `#include <map_fragment>
        {
          vec2 p = vLand.xz;
          float dist = length(cameraPosition - vLand);
          vec3 n = normalize(vLandN);
          // Turf at two scales, so its pattern never lines up in rows.
          vec3 turf = mix(texture2D(landGrass, p * 1.3).rgb,
                          texture2D(landGrass, p * 0.31 + 0.37).rgb, 0.45);
          // Greener than the photograph's dry field.
          turf *= vec3(0.74, 1.02, 0.6);
          // The same country seen from the air, which takes over far off
          // and shades the turf in broad patches up close.
          vec3 air = texture2D(landHills, p / 34.0).rgb;
          vec3 airFar = texture2D(landHills, p / 97.0 + 0.21).rgb;
          float tone = dot(mix(air, airFar, 0.5), vec3(0.3, 0.6, 0.1)) / 0.085;
          landNear = 1.0 - smoothstep(22.0, 95.0, dist);
          vec3 c = mix(mix(air, airFar, 0.5) * vec3(1.5, 1.75, 1.3), turf, landNear);
          c *= mix(1.0, clamp(tone, 0.55, 1.45), 0.5);
          // Bare rock where the ground is steep.
          float steep = smoothstep(0.16, 0.36, 1.0 - n.y);
          vec3 rock = mix(texture2D(landRock, p / 27.0).rgb,
                          texture2D(landRock, vec2(p.x + p.y, vLand.y * 2.0) / 9.0).rgb, 0.5)
                      * vec3(1.25, 1.2, 1.25);
          c = mix(c, rock, steep);
          // Sand at the shore, darker where the sea has wetted it.
          float low = vLand.y + (texture2D(landHills, p / 11.0).g - 0.2) * 1.6;
          float beach = 1.0 - smoothstep(${(SEA + 0.55).toFixed(2)}, ${(SEA + 1.25).toFixed(2)}, low);
          vec3 sand = texture2D(landSand, p * 0.21).rgb * vec3(1.45, 1.4, 1.3);
          sand *= mix(0.55, 1.0, smoothstep(${(SEA - 0.05).toFixed(2)}, ${(SEA + 0.4).toFixed(2)}, vLand.y));
          c = mix(c, sand, beach * (1.0 - steep * 0.7));
          diffuseColor.rgb = c;
        }`,
      )
      .replace(
        "#include <normal_fragment_maps>",
        `#include <normal_fragment_maps>
        {
          vec3 g = texture2D(landGrassN, vLand.xz * 1.3).xyz * 2.0 - 1.0;
          vec3 wn = normalize(normalize(vLandN) + vec3(g.x, 0.0, -g.y) * 0.55 * landNear);
          normal = normalize((viewMatrix * vec4(wn, 0.0)).xyz);
        }`,
      );
  };
  return material;
}

/** The ground itself, centred on the town. */
export function landMesh(shape: LandShape) {
  const n = 230;
  const geo = new THREE.PlaneGeometry(2, 2, n, n).rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  // Small squares near the town, where the camera is; large ones far off.
  const spread = (u: number) => LAND_HALF * (0.2 * u + 0.8 * u * u * u);
  for (let i = 0; i < pos.count; i++) {
    const x = spread(pos.getX(i));
    const z = spread(pos.getZ(i));
    pos.setXYZ(i, x, shape.height(x, z), z);
  }
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, groundMaterial());
  mesh.receiveShadow = true;
  return mesh;
}

/** Where forest stands: thick on the hills, none on the town's meadow. */
export function forestSpots(
  shape: LandShape,
  count: number,
  clear: number,
  seed = 5,
) {
  let s = seed;
  const rand = () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
  const spots: TreeSpot[] = [];
  let tries = 0;
  while (spots.length < count && tries++ < count * 30) {
    // Spread evenly over the country, thinning toward the far edge.
    const near = shape.flat + 4;
    const d = Math.sqrt(rand() * (285 * 285 - near * near) + near * near);
    if (rand() < smooth(110, 290, d) * 0.65) continue;
    const a = rand() * Math.PI * 2;
    const x = Math.cos(a) * d;
    const z = Math.sin(a) * d;
    if (Math.abs(x) > LAND_HALF - 8 || Math.abs(z) > LAND_HALF - 8) continue;
    // Only scattered trees stand where the camera can travel.
    if (d < clear && rand() > 0.12) continue;
    const wood = fbm(x * 0.022 + 40, z * 0.022 + 13, 3);
    if (wood < 0.47 + rand() * 0.1) continue;
    const y = shape.height(x, z);
    if (y < SEA + 1.6) continue;
    const slope =
      Math.abs(shape.height(x + 1, z) - y) +
      Math.abs(shape.height(x, z + 1) - y);
    if (slope > 0.7) continue;
    // Pines take the high ground.
    const high = smooth(5, 16, y) * 0.8 + 0.1;
    spots.push({
      x,
      y,
      z,
      s: 0.8 + rand() * 0.7,
      kind: rand() < high ? 1 : 0,
    });
  }
  return spots;
}

/**
 * The sky: a photograph of a real one (Poly Haven's Kloofendal, CC0), stored
 * with a curve so one small file holds its whole range of brightness. It
 * turns so its sun stands where the scene's sunlight comes from.
 */
export function skyDome(
  sun: THREE.Vector3,
  haze: THREE.Color,
  onLoad: () => void,
) {
  const map = new THREE.TextureLoader().load(BASE + "sky.jpg", onLoad);
  map.wrapS = THREE.RepeatWrapping;
  map.minFilter = THREE.LinearFilter;
  map.generateMipmaps = false;
  // The photograph's sun is at 214.3 degrees round; ours is at `sun`.
  const turn = (214.3 / 360 - 0.5) * Math.PI * 2 - Math.atan2(sun.z, sun.x);
  const uniforms = {
    map: { value: map },
    turn: { value: turn },
    sun: { value: sun },
    haze: { value: haze },
    gain: { value: 0.62 },
  };
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms,
    vertexShader: `varying vec3 vDir;
      void main(){
        vDir = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `uniform sampler2D map; uniform float turn; uniform vec3 sun; uniform vec3 haze; uniform float gain;
      varying vec3 vDir;
      void main(){
        vec3 d = normalize(vDir);
        float u = (atan(d.z, d.x) + turn) / 6.2831853 + 0.5;
        float v = asin(clamp(d.y, 0.0, 1.0)) / 1.5707963;
        vec3 c = pow(texture2D(map, vec2(u, v)).rgb, vec3(2.2)) * 6.0 * gain;
        // The far land and sea fade into the same haze as the sky's foot.
        c = mix(haze, c, smoothstep(0.0, 0.085, d.y));
        float s = max(dot(d, sun), 0.0);
        c += vec3(1.0, 0.93, 0.8) * smoothstep(0.99962, 0.99985, s) * 3.0;
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(700, 48, 24), material);
  mesh.renderOrder = -2;
  mesh.frustumCulled = false;
  return { mesh, map };
}

// ---- trees ----------------------------------------------------------------

// Real trees (Poly Haven, CC0) are millions of triangles each, far too many
// to draw a forest of. Each was photographed in the round ahead of time:
// eight views of its colour from the side, eight of which way its surfaces
// face, and one view from above. A tree in the scene is four upright cards
// crossed through its trunk, each showing the view from its own side, and one
// level card in its crown for the view from above. The cards stand still, so
// a tree never turns or leans as the camera moves, and each is lit by the
// scene's own sun.
const VIEWS = 8;
const CARDS = [0, 1, 2, 3, 4];
const SPECIES = [
  // Sizes in meters, as measured when the views were made.
  // `crown` is how far up the level card sits, as a share of the height.
  {
    file: "tree",
    halfW: 2.232,
    halfH: 2.79,
    tall: 4.557,
    grow: 2.3,
    crown: 0.62,
  },
  {
    file: "fir",
    halfW: 2.743,
    halfH: 5.487,
    tall: 8.89,
    grow: 1.55,
    crown: 0.3,
  },
];
export type TreeSpot = {
  x: number;
  y: number;
  z: number;
  s: number;
  kind: number;
};

// One material for each kind of tree, shared by every wood and garden tree.
const treeMaterials: (THREE.ShaderMaterial | undefined)[] = [];

/** All the trees at `spots` (measured from the returned meshes' position). */
export function forest(spots: TreeSpot[], sun: THREE.Vector3) {
  const loader = new THREE.TextureLoader();
  const meshes: THREE.Mesh[] = [];
  SPECIES.forEach((sp, kind) => {
    const mine = spots.filter((s) => s.kind === kind);
    if (!mine.length) return;
    const geo = new THREE.InstancedBufferGeometry();
    // Five cards; z says which: 0 to 3 the upright ones, 4 the level one.
    // They go in `corner`, and `position` stays at the trunk's foot, so that a
    // pass that redraws the scene with its own material (the soft shadows in
    // corners) draws nothing for the trees instead of stray squares.
    const corners = CARDS.flatMap((k) => [
      -1,
      -1,
      k,
      1,
      -1,
      k,
      1,
      1,
      k,
      -1,
      1,
      k,
    ]);
    geo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(new Float32Array(corners.length), 3),
    );
    geo.setAttribute("corner", new THREE.Float32BufferAttribute(corners, 3));
    geo.setIndex(
      CARDS.flatMap((k) => [0, 1, 2, 0, 2, 3].map((i) => i + k * 4)),
    );
    const at = new Float32Array(mine.length * 4);
    const turn = new Float32Array(mine.length * 2);
    mine.forEach((s, i) => {
      at.set([s.x, s.y - 0.05, s.z, (sp.grow * s.s) / 3], i * 4);
      // A turn of its own, and its own shade of green.
      turn.set([hash(s.x, s.z) * 6.283, hash(s.z, s.x)], i * 2);
    });
    geo.setAttribute("at", new THREE.InstancedBufferAttribute(at, 4));
    geo.setAttribute("turn", new THREE.InstancedBufferAttribute(turn, 2));
    geo.instanceCount = mine.length;
    const sheets = () => {
      const colour = loader.load(`${BASE}${sp.file}.webp`);
      colour.colorSpace = THREE.SRGBColorSpace;
      const facing = loader.load(`${BASE}${sp.file}-n.webp`);
      const top = loader.load(`${BASE}${sp.file}-top.webp`);
      top.colorSpace = THREE.SRGBColorSpace;
      for (const t of [colour, facing, top]) {
        t.generateMipmaps = true;
        t.minFilter = THREE.LinearMipmapLinearFilter;
        t.anisotropy = 4;
      }
      return { colour, facing, top };
    };
    const material = (treeMaterials[kind] ??= treeMaterial(sp, sheets(), sun));
    const mesh = new THREE.Mesh(geo, material);
    mesh.frustumCulled = false;
    meshes.push(mesh);
  });
  return meshes;
}

function treeMaterial(
  sp: (typeof SPECIES)[number],
  sheets: { colour: THREE.Texture; facing: THREE.Texture; top: THREE.Texture },
  sun: THREE.Vector3,
) {
  return new THREE.ShaderMaterial({
    uniforms: {
      ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
      colour: { value: sheets.colour },
      facing: { value: sheets.facing },
      top: { value: sheets.top },
      sun: { value: sun },
      size: { value: new THREE.Vector3(sp.halfW, sp.halfH, sp.tall) },
      crown: { value: sp.crown },
    },
    fog: true,
    side: THREE.DoubleSide,
    vertexShader: `
      attribute vec3 corner; attribute vec4 at; attribute vec2 turn;
      uniform vec3 size; uniform float crown;
      varying vec2 vUv; varying float vCard; varying float vSee; varying float vYaw; varying float vShade;
      #include <fog_pars_vertex>
      void main(){
        vec3 base = (modelMatrix * vec4(at.xyz, 1.0)).xyz;
        vec3 toCam = cameraPosition - base;
        vec3 world;
        if (corner.z < 3.5) {
          // An upright card, facing the side its view was taken from.
          float a = corner.z * 0.7853982 - turn.x;
          vec3 right = vec3(sin(a), 0.0, -cos(a));
          float h = size.z * 0.5 + corner.y * size.y;
          world = base + (right * corner.x * size.x + vec3(0.0, h, 0.0)) * at.w;
          // How squarely the camera sees it: 0 when it is edge-on.
          vSee = abs(dot(normalize(toCam.xz), vec2(cos(a), sin(a))));
        } else {
          // The level card in the crown, turned with the tree.
          float c = cos(turn.x); float s = sin(turn.x);
          vec2 o = vec2(corner.x, -corner.y) * size.x;
          world = base + vec3(o.x * c + o.y * s, size.z * crown, -o.x * s + o.y * c) * at.w;
          // How far above the tree the camera is: 1 straight overhead.
          vSee = normalize(toCam).y;
        }
        vUv = corner.xy * 0.5 + 0.5;
        vCard = corner.z;
        vYaw = turn.x;
        vShade = turn.y;
        vec4 mvPosition = viewMatrix * vec4(world, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        // A tree right in front of the lens is not drawn at all.
        if (length(toCam) - size.x * at.w < 6.0) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
        #include <fog_vertex>
      }`,
    fragmentShader: `
      uniform sampler2D colour; uniform sampler2D facing; uniform sampler2D top; uniform vec3 sun;
      varying vec2 vUv; varying float vCard; varying float vSee; varying float vYaw; varying float vShade;
      #include <fog_pars_fragment>
      float grain(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void main(){
        // Cards thin out leaf by leaf as they turn edge-on, so none shows as a line.
        float g = grain(floor(vUv * 40.0) + vCard * 17.0);
        vec4 c; vec3 n; float foot = 1.0;
        if (vCard < 3.5) {
          if (vSee < 0.08 + g * 0.24) discard;
          // The back of a card shows the view from the far side, mirrored.
          float frame = gl_FrontFacing ? vCard : vCard + 4.0;
          float u = gl_FrontFacing ? vUv.x : 1.0 - vUv.x;
          vec2 uv = vec2((frame + u) / ${VIEWS}.0, vUv.y);
          c = texture2D(colour, uv);
          n = texture2D(facing, uv).xyz * 2.0 - 1.0;
          // Darker toward the foot, where the crown shades the trunk.
          foot = mix(0.6, 1.0, smoothstep(0.05, 0.5, vUv.y));
        } else {
          // The level card only shows from well above, where the upright ones thin.
          if (vSee < 0.58 + g * 0.22) discard;
          c = texture2D(top, vUv);
          vec2 d = vUv * 2.0 - 1.0;
          n = normalize(vec3(d.x * 0.8, 0.75, -d.y * 0.8));
        }
        if (c.a < 0.45) discard;
        float cy = cos(vYaw); float sy = sin(vYaw);
        n = normalize(vec3(cy * n.x + sy * n.z, n.y, -sy * n.x + cy * n.z));
        // Leaves let some light through, so the sunlit side wraps round.
        float lit = max((dot(n, sun) + 0.4) / 1.4, 0.0);
        vec3 leaf = c.rgb * mix(vec3(0.95, 1.12, 0.8), vec3(1.2, 1.25, 0.85), vShade) * 1.9;
        vec3 light = vec3(1.0, 0.95, 0.86) * 1.25 * lit
                   + vec3(0.2, 0.26, 0.36) * (0.45 + 0.55 * n.y);
        gl_FragColor = vec4(leaf * light * foot, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
}
