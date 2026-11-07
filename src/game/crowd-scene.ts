/**
 * Crowd Rush 3D — a three.js view of the same world that crowd-core runs.
 *
 * Everything is built from code: low-poly meshes with flat shading, no model
 * or texture files. Characters are drawn with InstancedMesh, one mesh per
 * body part, so a squad of 140 runners costs a handful of draw calls.
 *
 * Coordinates: crowd-core uses x in [-1, 1] across the road and z in metres
 * along it. Here X = x * ROAD, Y is up and Z = -z, so the squad runs toward
 * -Z and the camera looks down -Z.
 */
import * as THREE from "three";
import {
  BOSS_STOP,
  crowdRadius,
  opLabel,
  rng,
  squadRadius,
  type Block,
  type Gate,
  type Monster,
  type World,
} from "./crowd-core";

/** Metres per road unit: the road is 2 × ROAD wide. */
export const ROAD = 3.4;
/** People drawn per squad; the count label shows the real number. */
export const MAX_DRAWN = 140;
const VIEW_AHEAD = 120;
const VIEW_BEHIND = 12;

export const TEAM = 0x3ea6ff;
export const RIVAL = 0xff5a5f;

export type SceneFx = {
  clock: number;
  shake: number;
  bossHit: number;
  slamAnim: number;
  sparks: {
    x: number;
    z: number;
    h: number;
    life: number;
    max: number;
    color: string;
    size: number;
  }[];
};

const flat = (
  color: number,
  extra: THREE.MeshStandardMaterialParameters = {},
) =>
  new THREE.MeshStandardMaterial({
    color,
    flatShading: true,
    roughness: 0.8,
    metalness: 0,
    ...extra,
  });

/** Formation slot i of n inside an ellipse: a sunflower spiral. */
function slot(i: number, n: number, rx: number, rz: number) {
  const r = Math.sqrt((i + 0.5) / n);
  const a = i * 2.39996;
  return { x: Math.cos(a) * r * rx, z: Math.sin(a) * r * rz };
}
/** How deep a crowd of n runners is, so they are not packed shoulder to shoulder. */
function crowdDepth(n: number, rx: number) {
  return Math.min(3.2, Math.max(rx, (n * 0.16) / (Math.PI * rx)));
}

/** A set of InstancedMeshes that share instance slots, one per body part. */
class Parts {
  meshes: THREE.InstancedMesh[] = [];
  used = 0;
  constructor(
    scene: THREE.Scene,
    parts: { geo: THREE.BufferGeometry; mat: THREE.Material; per?: number }[],
    readonly capacity: number,
    shadows = true,
  ) {
    for (const p of parts) {
      const mesh = new THREE.InstancedMesh(
        p.geo,
        p.mat,
        capacity * (p.per ?? 1),
      );
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.castShadow = shadows;
      mesh.frustumCulled = false;
      mesh.count = 0;
      scene.add(mesh);
      this.meshes.push(mesh);
    }
  }
  finish() {
    for (const m of this.meshes) {
      m.count = Math.min(m.instanceMatrix.count, this.used * this.perOf(m));
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
    this.used = 0;
  }
  private perOf(m: THREE.InstancedMesh) {
    return m.instanceMatrix.count / this.capacity;
  }
}

const _m = new THREE.Matrix4();
const _local = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _c = new THREE.Color();
const _v = new THREE.Vector3();

function base(x: number, y: number, z: number, yaw: number, s: number) {
  _q.setFromEuler(_e.set(0, yaw, 0));
  return _m.compose(_p.set(x, y, z), _q, _s.set(s, s, s));
}
function local(
  x: number,
  y: number,
  z: number,
  rx = 0,
  ry = 0,
  rz = 0,
  sx = 1,
  sy = 1,
  sz = 1,
) {
  _q.setFromEuler(_e.set(rx, ry, rz));
  return _local.compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz));
}
const _out = new THREE.Matrix4();
function put(
  mesh: THREE.InstancedMesh,
  i: number,
  b: THREE.Matrix4,
  l: THREE.Matrix4,
) {
  _out.multiplyMatrices(b, l);
  mesh.setMatrixAt(i, _out);
}

/** Low-poly runners with a cap, a rifle and swinging legs. */
class Runners {
  private parts: Parts;
  private torso: THREE.InstancedMesh;
  private head: THREE.InstancedMesh;
  private cap: THREE.InstancedMesh;
  private legs: THREE.InstancedMesh;
  private arms: THREE.InstancedMesh;
  private gun: THREE.InstancedMesh;
  constructor(scene: THREE.Scene, capacity: number) {
    const torso = new THREE.CapsuleGeometry(0.13, 0.16, 2, 6);
    const head = new THREE.IcosahedronGeometry(0.14, 1);
    const cap = new THREE.SphereGeometry(
      0.15,
      7,
      4,
      0,
      Math.PI * 2,
      0,
      Math.PI / 2,
    );
    cap.translate(0, 0.01, 0);
    const leg = new THREE.BoxGeometry(0.09, 0.28, 0.1);
    leg.translate(0, -0.14, 0);
    const arm = new THREE.BoxGeometry(0.07, 0.22, 0.07);
    arm.translate(0, -0.11, 0);
    const gun = new THREE.BoxGeometry(0.06, 0.07, 0.34);
    const white = flat(0xffffff);
    this.parts = new Parts(
      scene,
      [
        { geo: torso, mat: white },
        { geo: head, mat: flat(0xffd2b0) },
        { geo: cap, mat: white },
        { geo: leg, mat: white, per: 2 },
        { geo: arm, mat: white, per: 2 },
        { geo: gun, mat: flat(0x2b2f3a) },
      ],
      capacity,
    );
    [this.torso, this.head, this.cap, this.legs, this.arms, this.gun] =
      this.parts.meshes;
    // per-instance colours need the buffers to exist up front
    for (const m of [this.torso, this.cap, this.legs, this.arms])
      for (let i = 0; i < m.instanceMatrix.count; i++)
        m.setColorAt(i, _c.set(0xffffff));
  }
  /** Draws a squad of `count` around road position (x, z). */
  squad(
    x: number,
    z: number,
    count: number,
    radius: number,
    color: number,
    facing: 1 | -1,
    clock: number,
    running: boolean,
    lean: number,
  ) {
    const n = Math.min(count, MAX_DRAWN);
    const rx = radius * ROAD * 1.1;
    const rz = crowdDepth(n, rx);
    // the crowd bunches forward a little so its tail stays on screen
    const ahead = rz * 0.3 * facing;
    const body = _c.set(color);
    const dark = new THREE.Color(color).multiplyScalar(0.55);
    const yaw = facing === 1 ? lean : Math.PI + lean;
    for (let i = 0; i < n; i++) {
      const k = this.parts.used;
      if (k >= this.parts.capacity) break;
      this.parts.used++;
      const s = slot(i, n, rx, rz);
      const ph = clock * 12 + i * 1.3;
      const swing = running ? Math.sin(ph) * 0.8 : 0;
      const bob = running ? Math.abs(Math.sin(ph)) * 0.05 : 0;
      const bb = base(
        x * ROAD + s.x,
        bob,
        -z - s.z * facing - ahead,
        yaw,
        1.35,
      );
      put(this.torso, k, bb, local(0, 0.44, 0));
      put(this.head, k, bb, local(0, 0.71, 0));
      put(this.cap, k, bb, local(0, 0.74, 0, -0.15));
      put(this.legs, k * 2, bb, local(-0.065, 0.3, 0, swing));
      put(this.legs, k * 2 + 1, bb, local(0.065, 0.3, 0, -swing));
      // both arms reach forward to hold the rifle
      put(this.arms, k * 2, bb, local(-0.15, 0.55, 0, 1.25, 0.25));
      put(this.arms, k * 2 + 1, bb, local(0.15, 0.55, 0, 1.25, -0.35));
      put(this.gun, k, bb, local(0.02, 0.52, -0.24));
      this.torso.setColorAt(k, body);
      this.cap.setColorAt(k, dark);
      this.legs.setColorAt(k * 2, dark);
      this.legs.setColorAt(k * 2 + 1, dark);
      this.arms.setColorAt(k * 2, body);
      this.arms.setColorAt(k * 2 + 1, body);
    }
  }
  finish() {
    this.parts.finish();
  }
}

/** Slimes and horned brutes. */
class Monsters {
  private slimes: Parts;
  private brutes: Parts;
  private bars: Parts;
  constructor(scene: THREE.Scene) {
    const eye = new THREE.SphereGeometry(1, 8, 6);
    const brow = new THREE.BoxGeometry(1, 1, 1);
    const whiteM = flat(0xffffff, { roughness: 0.4 });
    const blackM = flat(0x1b1b1b);
    this.slimes = new Parts(
      scene,
      [
        {
          geo: new THREE.IcosahedronGeometry(0.42, 1),
          mat: flat(0x70c43b, { roughness: 0.35 }),
        },
        { geo: eye, mat: whiteM, per: 2 },
        { geo: eye, mat: blackM, per: 2 },
        { geo: brow, mat: blackM, per: 2 },
      ],
      120,
    );
    const horn = new THREE.ConeGeometry(0.13, 0.55, 5);
    horn.translate(0, 0.27, 0);
    const fist = new THREE.DodecahedronGeometry(0.22);
    this.brutes = new Parts(
      scene,
      [
        { geo: new THREE.DodecahedronGeometry(0.72), mat: flat(0x9b5de5) },
        { geo: horn, mat: flat(0xffe08a), per: 2 },
        { geo: eye, mat: whiteM, per: 2 },
        { geo: eye, mat: blackM, per: 2 },
        { geo: fist, mat: flat(0x6a3cb0), per: 2 },
        {
          geo: new THREE.BoxGeometry(0.34, 0.3, 0.4),
          mat: flat(0x4b2a86),
          per: 2,
        },
      ],
      24,
    );
    const bar = new THREE.BoxGeometry(1, 1, 1);
    this.bars = new Parts(
      scene,
      [
        { geo: bar, mat: new THREE.MeshBasicMaterial({ color: 0x1a1a1a }) },
        { geo: bar, mat: new THREE.MeshBasicMaterial({ color: 0xffffff }) },
      ],
      140,
      false,
    );
    const fill = this.bars.meshes[1];
    for (let i = 0; i < fill.instanceMatrix.count; i++)
      fill.setColorAt(i, _c.set(0xffffff));
  }
  draw(m: Monster, clock: number) {
    const hop = Math.abs(Math.sin(clock * (m.big ? 5 : 9) + m.id * 1.7));
    const X = m.x * ROAD;
    const Z = -m.z;
    // monsters face the squad, which comes from +Z
    if (!m.big) {
      const p = this.slimes;
      if (p.used >= p.capacity) return;
      const k = p.used++;
      const squash = 1 + (1 - hop) * 0.18;
      const lift = hop * 0.32;
      const b = base(X, 0, Z, 0, 1);
      const [body, eyes, pupils, brows] = p.meshes;
      put(
        body,
        k,
        b,
        local(0, 0.34 + lift, 0, 0, m.id, 0, squash, 0.8 / squash, squash),
      );
      const ey = 0.42 + lift;
      for (const side of [-1, 1]) {
        const j = k * 2 + (side > 0 ? 1 : 0);
        put(eyes, j, b, local(side * 0.15, ey, 0.3, 0, 0, 0, 0.1, 0.11, 0.06));
        put(
          pupils,
          j,
          b,
          local(side * 0.13, ey - 0.01, 0.35, 0, 0, 0, 0.05, 0.055, 0.03),
        );
        put(
          brows,
          j,
          b,
          local(
            side * 0.15,
            ey + 0.12,
            0.33,
            0,
            0,
            side * -0.5,
            0.17,
            0.035,
            0.03,
          ),
        );
      }
      if (m.hp < m.maxHp)
        this.bar(X, 0.95 + lift, Z, 0.7, m.hp / m.maxHp, 0xff5a5f);
    } else {
      const p = this.brutes;
      if (p.used >= p.capacity) return;
      const k = p.used++;
      const lift = hop * 0.25;
      const b = base(X, 0, Z, 0, 1);
      const [body, horns, eyes, pupils, fists, feet] = p.meshes;
      put(body, k, b, local(0, 0.85 + lift, 0, 0.2, 0.3, 0, 1, 0.92, 0.9));
      for (const side of [-1, 1]) {
        const j = k * 2 + (side > 0 ? 1 : 0);
        put(
          horns,
          j,
          b,
          local(side * 0.38, 1.38 + lift, 0, 0, 0, side * -0.55),
        );
        put(
          eyes,
          j,
          b,
          local(side * 0.24, 1.05 + lift, 0.55, 0, 0, 0, 0.13, 0.15, 0.08),
        );
        put(
          pupils,
          j,
          b,
          local(side * 0.22, 1.03 + lift, 0.62, 0, 0, 0, 0.065, 0.075, 0.04),
        );
        const punch = Math.sin(clock * 5 + m.id + side) * 0.15;
        put(
          fists,
          j,
          b,
          local(side * 0.78, 0.7 + lift, 0.15 + punch, 0.4, 0.4, 0),
        );
        put(
          feet,
          j,
          b,
          local(side * 0.32, 0.15, 0.05 + (side > 0 ? hop : 1 - hop) * 0.12),
        );
      }
      this.bar(X, 2.0 + lift, Z, 1.3, m.hp / m.maxHp, 0xff9f43);
    }
  }
  private bar(
    X: number,
    Y: number,
    Z: number,
    w: number,
    share: number,
    color: number,
  ) {
    const p = this.bars;
    if (p.used >= p.capacity) return;
    const k = p.used++;
    const [bg, fill] = p.meshes;
    bg.setMatrixAt(k, local(X, Y, Z, 0, 0, 0, w + 0.06, 0.13, 0.02));
    const fw = Math.max(0.001, w * share);
    fill.setMatrixAt(
      k,
      local(X - w / 2 + fw / 2, Y, Z + 0.02, 0, 0, 0, fw, 0.09, 0.02),
    );
    fill.setColorAt(k, _c.set(color));
  }
  finish() {
    this.slimes.finish();
    this.brutes.finish();
    this.bars.finish();
  }
}

/** The horned boss at the end of the road. */
class Boss {
  group = new THREE.Group();
  private arms: THREE.Group[] = [];
  private skin: THREE.MeshStandardMaterial[] = [];
  private eyes: THREE.MeshStandardMaterial;
  private body: THREE.Group;
  constructor(scene: THREE.Scene) {
    const purple = flat(0x6c3fd6);
    const deep = flat(0x5a37b0);
    const legs = flat(0x3b2a6b);
    const gold = flat(0xffd36a, { metalness: 0.3, roughness: 0.5 });
    this.eyes = flat(0xfff078, { emissive: 0xffe060, emissiveIntensity: 1 });
    this.skin = [purple, deep];
    const g = new THREE.Group();
    this.body = g;
    const add = (
      geo: THREE.BufferGeometry,
      mat: THREE.Material,
      x: number,
      y: number,
      z: number,
      parent: THREE.Object3D = g,
    ) => {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      parent.add(mesh);
      return mesh;
    };
    for (const side of [-1, 1]) {
      add(new THREE.BoxGeometry(1.1, 2.2, 1.2), legs, side * 0.95, 1.1, 0);
      add(new THREE.BoxGeometry(1.3, 0.5, 1.6), legs, side * 0.95, 0.25, 0.2);
    }
    const torso = add(
      new THREE.DodecahedronGeometry(1.9, 0),
      purple,
      0,
      3.7,
      0,
    );
    torso.scale.set(1.25, 1.05, 0.95);
    const belly = add(
      new THREE.IcosahedronGeometry(1.15, 0),
      flat(0xb79cff),
      0,
      3.3,
      1.05,
    );
    belly.scale.set(1, 1, 0.45);
    const head = add(
      new THREE.IcosahedronGeometry(1.25, 1),
      purple,
      0,
      6.1,
      0.15,
    );
    head.scale.set(1.05, 0.92, 1);
    for (const side of [-1, 1]) {
      const horn = add(
        new THREE.ConeGeometry(0.32, 1.6, 6),
        gold,
        side * 1.05,
        7.1,
        0,
      );
      horn.rotation.z = side * -0.6;
      const eye = add(
        new THREE.SphereGeometry(0.22, 10, 8),
        this.eyes,
        side * 0.45,
        6.15,
        1.18,
      );
      eye.scale.set(1, 0.8, 0.6);
      const brow = add(
        new THREE.BoxGeometry(0.62, 0.16, 0.2),
        flat(0x2a1650),
        side * 0.45,
        6.5,
        1.15,
      );
      brow.rotation.z = side * -0.4;
      // shoulder pivots so the arms can swing up for a slam
      const arm = new THREE.Group();
      arm.position.set(side * 2.35, 4.8, 0);
      g.add(arm);
      add(new THREE.DodecahedronGeometry(0.75, 0), deep, 0, 0, 0, arm);
      add(new THREE.BoxGeometry(0.85, 2.4, 0.85), deep, 0, -1.4, 0, arm);
      add(new THREE.DodecahedronGeometry(0.75, 0), purple, 0, -2.8, 0.1, arm);
      for (const sp of [-0.3, 0.3])
        add(new THREE.ConeGeometry(0.16, 0.5, 4), gold, sp, 0.55, 0, arm);
      this.arms.push(arm);
    }
    // teeth
    for (let i = -2; i <= 2; i++) {
      const tooth = add(
        new THREE.ConeGeometry(0.09, 0.28, 4),
        flat(0xffffff),
        i * 0.2,
        5.55,
        1.15,
      );
      tooth.rotation.x = Math.PI;
    }
    // back spikes
    for (let i = 0; i < 4; i++) {
      const sp = add(
        new THREE.ConeGeometry(0.28, 0.9, 5),
        gold,
        0,
        4.9 - i * 0.7,
        -1.6,
      );
      sp.rotation.x = -1.1;
    }
    g.rotation.y = 0;
    this.group.add(g);
    scene.add(this.group);
  }
  update(w: World, fx: SceneFx, dead: number) {
    this.group.position.set(0, 0, -w.boss.z);
    const lift = fx.slamAnim > 0.5 ? (1 - fx.slamAnim) * 2 : fx.slamAnim * 2;
    const idle = Math.sin(fx.clock * 2.2) * 0.08;
    for (const [i, arm] of this.arms.entries()) {
      arm.rotation.x = -lift * 2.6 + idle * (i ? 1 : -1);
      arm.rotation.z = (i ? 1 : -1) * (0.15 + lift * 0.2);
    }
    this.body.position.y = Math.sin(fx.clock * 2.2) * 0.06 - lift * 0.15;
    for (const m of this.skin)
      m.emissive.setRGB(fx.bossHit * 0.3, fx.bossHit * 0.12, fx.bossHit * 0.25);
    this.eyes.emissiveIntensity = 0.7 + 0.5 * Math.sin(fx.clock * 6);
    // after the last hit the boss topples and sinks away
    const k = Math.min(1, dead);
    this.body.rotation.x = -k * 1.4;
    this.body.position.y -= k * k * 6;
    this.group.visible = k < 1;
  }
}

/** Two doors with their number painted on a glassy panel. */
class GateView {
  group = new THREE.Group();
  private panels: {
    mat: THREE.MeshBasicMaterial;
    canvas: HTMLCanvasElement;
    tex: THREE.CanvasTexture;
  }[] = [];
  private state = "";
  constructor(
    readonly gate: Gate,
    frame: THREE.Material,
  ) {
    const H = 2.3;
    const span = ROAD * 1.06;
    for (const [i, side] of (["left", "right"] as const).entries()) {
      const canvas = document.createElement("canvas");
      canvas.width = 256;
      canvas.height = 192;
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      const mat = new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const panel = new THREE.Mesh(
        new THREE.PlaneGeometry(span, H * 0.86),
        mat,
      );
      const cx = (i === 0 ? -0.55 : 0.55) * ROAD;
      panel.position.set(cx, H * 0.47, 0);
      panel.renderOrder = 2;
      this.group.add(panel);
      this.panels.push({ mat, canvas, tex });
      void side;
    }
    const post = new THREE.BoxGeometry(0.22, H, 0.3);
    for (const x of [-1.1, 0, 1.1]) {
      const m = new THREE.Mesh(post, frame);
      m.position.set(x * ROAD, H / 2, 0);
      m.castShadow = true;
      this.group.add(m);
    }
    const beam = new THREE.Mesh(
      new THREE.BoxGeometry(ROAD * 2.3, 0.22, 0.32),
      frame,
    );
    beam.position.set(0, H, 0);
    beam.castShadow = true;
    this.group.add(beam);
    this.group.position.z = -gate.z;
    this.paint();
  }
  paint() {
    const g = this.gate;
    const state = `${g.used}${g.chosen}${g.wasBest}`;
    if (state === this.state) return;
    this.state = state;
    for (const [i, side] of (["left", "right"] as const).entries()) {
      const { canvas, tex, mat } = this.panels[i];
      const ctx = canvas.getContext("2d");
      if (!ctx) continue;
      // Both doors look the same until you pass, so you have to do the
      // maths. Afterwards the one you took shows whether it was the better.
      const chosen = g.used && g.chosen === side;
      const tone = chosen ? (g.wasBest ? "good" : "bad") : "plain";
      const fill = { plain: "#3d9bff", good: "#2fd17a", bad: "#ff4d5a" }[tone];
      ctx.clearRect(0, 0, 256, 192);
      const grad = ctx.createLinearGradient(0, 0, 0, 192);
      grad.addColorStop(0, fill + "cc");
      grad.addColorStop(1, fill + "66");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 256, 192);
      ctx.fillStyle = "#ffffff30";
      ctx.fillRect(0, 0, 256, 18);
      ctx.font = "900 92px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineWidth = 10;
      ctx.strokeStyle = "#0b2a55aa";
      const text = opLabel(g[side]);
      ctx.strokeText(text, 128, 100);
      ctx.fillStyle = "#fff";
      ctx.fillText(text, 128, 100);
      tex.needsUpdate = true;
      mat.opacity = g.used ? (chosen ? 0.75 : 0.3) : 0.92;
    }
  }
  dispose() {
    for (const p of this.panels) {
      p.tex.dispose();
      p.mat.dispose();
    }
    this.group.traverse((o) => {
      if (o instanceof THREE.Mesh && o.geometry) o.geometry.dispose();
    });
  }
}

/** A crate (shoot it open for recruits) or a stone wall (dodge it). */
class BlockView {
  group = new THREE.Group();
  private canvas = document.createElement("canvas");
  private tex: THREE.CanvasTexture;
  private hp = -1;
  private mats: THREE.Material[];
  private geos: THREE.BufferGeometry[] = [];
  constructor(
    readonly block: Block,
    rewardTex?: THREE.Texture,
  ) {
    const crate = block.reward > 0;
    const W = block.w * 2 * ROAD;
    const H = crate ? 1.3 : 1.7;
    const D = crate ? 1.3 : 0.8;
    this.canvas.width = 256;
    this.canvas.height = Math.round((256 * H) / W);
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    const side = flat(crate ? 0xe3963a : 0xa9a39a);
    const top = flat(crate ? 0xf5b85a : 0xc4beb4);
    const front = new THREE.MeshStandardMaterial({
      map: this.tex,
      roughness: 0.85,
    });
    this.mats = [side, side, top, side, front, side];
    const geo = new THREE.BoxGeometry(W, H, D);
    this.geos.push(geo);
    const box = new THREE.Mesh(geo, this.mats);
    box.position.y = H / 2;
    box.castShadow = true;
    box.receiveShadow = true;
    this.group.add(box);
    if (crate && rewardTex) {
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: rewardTex, depthWrite: false }),
      );
      sprite.scale.set(1.3, 0.65, 1);
      sprite.position.y = H + 0.55;
      this.group.add(sprite);
      this.mats.push(sprite.material);
    }
    this.group.position.set(block.x * ROAD, 0, -block.z);
    this.paint();
  }
  paint() {
    const b = this.block;
    if (b.hp === this.hp) return;
    this.hp = b.hp;
    const ctx = this.canvas.getContext("2d");
    if (!ctx) return;
    const { width: w, height: h } = this.canvas;
    const crate = b.reward > 0;
    if (crate) {
      ctx.fillStyle = "#f0a541";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#d98a2a";
      for (let y = 0; y < h; y += h / 4) ctx.fillRect(0, y + h / 4 - 4, w, 4);
      ctx.strokeStyle = "#9c5d1a";
      ctx.lineWidth = 14;
      ctx.strokeRect(7, 7, w - 14, h - 14);
      ctx.beginPath();
      ctx.moveTo(14, 14);
      ctx.lineTo(w - 14, h - 14);
      ctx.moveTo(w - 14, 14);
      ctx.lineTo(14, h - 14);
      ctx.lineWidth = 12;
      ctx.stroke();
    } else {
      ctx.fillStyle = "#b5ada2";
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = "#857c70";
      ctx.lineWidth = 4;
      const rows = 5;
      for (let r = 0; r < rows; r++) {
        const y = (r * h) / rows;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
        for (let x = r % 2 ? 32 : 0; x < w; x += 64) {
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x, y + h / rows);
          ctx.stroke();
        }
      }
    }
    ctx.font = `900 ${Math.round(Math.min(h * 0.5, 96))}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 10;
    ctx.strokeStyle = "#000000aa";
    ctx.strokeText(String(b.hp), w / 2, h / 2 + 4);
    ctx.fillStyle = "#fff";
    ctx.fillText(String(b.hp), w / 2, h / 2 + 4);
    this.tex.needsUpdate = true;
  }
  dispose() {
    this.tex.dispose();
    for (const m of this.mats) m.dispose();
    for (const g of this.geos) g.dispose();
  }
}

function labelTexture(text: string, color: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.font = "900 84px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 12;
    ctx.strokeStyle = "#000000aa";
    ctx.strokeText(text, 128, 66);
    ctx.fillStyle = color;
    ctx.fillText(text, 128, 66);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class CrowdScene {
  readonly renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(50, 1, 0.1, 400);
  private sun: THREE.DirectionalLight;
  private runners: Runners;
  private monsters: Monsters;
  private boss: Boss;
  private bullets: THREE.InstancedMesh;
  private sparks: THREE.InstancedMesh;
  private level = new THREE.Group();
  private gates: GateView[] = [];
  private blocks = new Map<number, BlockView>();
  private levelGeos: THREE.BufferGeometry[] = [];
  private levelMats: THREE.Material[] = [];
  private gateFrame = flat(0xf4f6fb);
  private ring: THREE.Mesh;
  private camX = 0;
  private camPull = 0;
  private bossDead = 0;
  private width = 1;
  private height = 1;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.scene.background = new THREE.Color(0xc4e5ff);
    this.scene.fog = new THREE.Fog(0xc4e5ff, 50, VIEW_AHEAD);

    this.scene.add(new THREE.HemisphereLight(0xe6f4ff, 0x6c8f4a, 1.6));
    const sun = new THREE.DirectionalLight(0xfff3dd, 2.4);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = -14;
    sc.right = 14;
    sc.top = 30;
    sc.bottom = -16;
    sc.near = 1;
    sc.far = 80;
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.03;
    this.scene.add(sun, sun.target);
    this.sun = sun;

    // grass that follows the camera, so it never runs out
    const grass = new THREE.Mesh(
      new THREE.PlaneGeometry(400, 400),
      new THREE.MeshStandardMaterial({ color: 0x8fcf6a, roughness: 1 }),
    );
    grass.rotation.x = -Math.PI / 2;
    grass.position.y = -0.02;
    grass.receiveShadow = true;
    grass.name = "grass";
    this.scene.add(grass);

    this.runners = new Runners(this.scene, 360);
    this.monsters = new Monsters(this.scene);
    this.boss = new Boss(this.scene);

    this.bullets = new THREE.InstancedMesh(
      new THREE.CapsuleGeometry(0.05, 0.5, 1, 4),
      new THREE.MeshBasicMaterial({ color: 0xffe26a }),
      500,
    );
    this.bullets.frustumCulled = false;
    this.bullets.count = 0;
    this.scene.add(this.bullets);
    this.sparks = new THREE.InstancedMesh(
      new THREE.OctahedronGeometry(1, 0),
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
      600,
    );
    for (let i = 0; i < 600; i++) this.sparks.setColorAt(i, _c.set(0xffffff));
    this.sparks.frustumCulled = false;
    this.sparks.count = 0;
    this.scene.add(this.sparks);

    this.ring = new THREE.Mesh(
      new THREE.RingGeometry(0.85, 1, 40),
      new THREE.MeshBasicMaterial({
        color: 0xffe08a,
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.visible = false;
    this.scene.add(this.ring);
    this.scene.add(this.level);
  }

  resize(width: number, height: number, dpr: number) {
    this.width = width;
    this.height = height;
    this.renderer.setPixelRatio(Math.min(dpr, 2));
    this.renderer.setSize(width, height, false);
    const aspect = width / height;
    this.camera.aspect = aspect;
    // keep the whole road in view on a tall phone screen
    this.camera.fov = aspect < 0.8 ? 64 : aspect < 1.2 ? 56 : 48;
    this.camera.updateProjectionMatrix();
  }

  /** Builds the road, scenery, gates and blocks for a fresh level. */
  load(w: World) {
    this.clearLevel();
    this.bossDead = 0;
    const L = w.length + 40;
    const keep = <G extends THREE.BufferGeometry>(g: G) => (
      this.levelGeos.push(g),
      g
    );
    const mat = <M extends THREE.Material>(m: M) => (this.levelMats.push(m), m);

    const road = new THREE.Mesh(
      keep(new THREE.BoxGeometry(ROAD * 2.2, 0.1, L + 40)),
      mat(new THREE.MeshStandardMaterial({ color: 0x8a8fa3, roughness: 0.95 })),
    );
    road.position.set(0, -0.04, -(L / 2) + 20);
    road.receiveShadow = true;
    this.level.add(road);

    // red and white kerbs along both edges
    const kerbGeo = keep(new THREE.BoxGeometry(0.3, 0.16, 1.5));
    const kerbs = new THREE.InstancedMesh(
      kerbGeo,
      mat(flat(0xffffff)),
      Math.ceil((L + 40) / 1.5) * 2,
    );
    let k = 0;
    for (let z = -20; z < L; z += 1.5)
      for (const side of [-1, 1]) {
        kerbs.setMatrixAt(k, local(side * ROAD * 1.13, 0.04, -z));
        kerbs.setColorAt(
          k,
          _c.set(Math.round(z / 1.5) % 2 ? 0xff5d5d : 0xffffff),
        );
        k++;
      }
    kerbs.count = k;
    kerbs.receiveShadow = true;
    this.level.add(kerbs);

    // lane dashes
    const dashGeo = keep(new THREE.BoxGeometry(0.1, 0.02, 2.6));
    const dashes = new THREE.InstancedMesh(
      dashGeo,
      mat(new THREE.MeshBasicMaterial({ color: 0xe9ecf3 })),
      Math.ceil(L / 6) * 2 + 4,
    );
    k = 0;
    for (let z = 0; z < L - 10; z += 6)
      for (const lx of [-0.36, 0.36])
        dashes.setMatrixAt(k++, local(lx * ROAD, 0.02, -z - 1.3));
    dashes.count = k;
    this.level.add(dashes);

    // scenery: low-poly trees, bushes and rocks on the verges
    const r = rng(w.level * 31 + 7);
    const trunk = keep(new THREE.CylinderGeometry(0.12, 0.18, 0.9, 5));
    trunk.translate(0, 0.45, 0);
    const crown = keep(new THREE.ConeGeometry(0.9, 2.1, 6));
    crown.translate(0, 1.85, 0);
    const round = keep(new THREE.IcosahedronGeometry(0.85, 0));
    round.translate(0, 1.6, 0);
    const rock = keep(new THREE.DodecahedronGeometry(0.5, 0));
    const maxTrees = Math.ceil((L + 40) / 3.2) * 2;
    const trunks = new THREE.InstancedMesh(
      trunk,
      mat(flat(0x8a5a35)),
      maxTrees,
    );
    const pines = new THREE.InstancedMesh(crown, mat(flat(0x3f9b4f)), maxTrees);
    const oaks = new THREE.InstancedMesh(round, mat(flat(0x5bb45a)), maxTrees);
    const rocks = new THREE.InstancedMesh(rock, mat(flat(0xb8b2a8)), maxTrees);
    let t = 0;
    let pi = 0;
    let oi = 0;
    let ri = 0;
    for (let z = -20; z < L + 20; z += 3.2)
      for (const side of [-1, 1]) {
        const X = side * (ROAD * 1.13 + 1.6 + r() * 9);
        const Z = -(z + r() * 3);
        const s = 0.75 + r() * 0.7;
        const roll = r();
        if (roll < 0.15) {
          rocks.setMatrixAt(
            ri++,
            local(X, 0.15, Z, r(), r() * 3, 0, s, s * 0.7, s),
          );
          continue;
        }
        trunks.setMatrixAt(t++, local(X, 0, Z, 0, 0, 0, s, s, s));
        if (roll < 0.6)
          pines.setMatrixAt(
            pi++,
            local(X, 0, Z, 0, r() * 3, 0, s, s * (0.9 + r() * 0.4), s),
          );
        else oaks.setMatrixAt(oi++, local(X, 0, Z, 0, r() * 3, 0, s, s, s));
      }
    for (const [m, n] of [
      [trunks, t],
      [pines, pi],
      [oaks, oi],
      [rocks, ri],
    ] as const) {
      m.count = n;
      m.castShadow = true;
      m.frustumCulled = false;
      this.level.add(m);
    }

    // the arena where the boss waits
    const arena = new THREE.Mesh(
      keep(new THREE.CircleGeometry(ROAD * 1.6, 7)),
      mat(new THREE.MeshStandardMaterial({ color: 0xb9a2ff, roughness: 0.9 })),
    );
    arena.rotation.x = -Math.PI / 2;
    arena.position.set(0, 0.02, -w.boss.z);
    arena.receiveShadow = true;
    this.level.add(arena);
    const line = new THREE.Mesh(
      keep(new THREE.PlaneGeometry(ROAD * 2.2, 0.8)),
      mat(new THREE.MeshBasicMaterial({ map: checker(), transparent: false })),
    );
    line.rotation.x = -Math.PI / 2;
    line.position.set(0, 0.025, -(w.boss.z - BOSS_STOP - 1));
    this.level.add(line);

    for (const th of w.things) {
      if (th.kind === "gate") {
        const g = new GateView(th, this.gateFrame);
        this.gates.push(g);
        this.level.add(g.group);
      } else if (th.kind === "block") {
        const tex = th.reward
          ? labelTexture(`+${th.reward}`, "#fff36a")
          : undefined;
        if (tex) this.levelMats.push(new THREE.SpriteMaterial({ map: tex }));
        const b = new BlockView(th, tex);
        this.blocks.set(th.id, b);
        this.level.add(b.group);
      }
    }
  }

  private clearLevel() {
    for (const g of this.gates) g.dispose();
    for (const b of this.blocks.values()) b.dispose();
    this.gates = [];
    this.blocks.clear();
    for (const g of this.levelGeos) g.dispose();
    for (const m of this.levelMats) {
      const map = (m as THREE.MeshBasicMaterial).map;
      map?.dispose();
      m.dispose();
    }
    this.levelGeos = [];
    this.levelMats = [];
    this.level.clear();
  }

  render(w: World, fx: SceneFx, dt: number) {
    const near = w.z - VIEW_BEHIND;
    const far = w.z + VIEW_AHEAD;
    const clock = fx.clock;
    const running = w.phase === "run";

    // gates and blocks
    for (const g of this.gates) {
      g.group.visible = g.gate.z > near && g.gate.z < far;
      if (g.group.visible) g.paint();
    }
    for (const b of this.blocks.values()) {
      b.group.visible = !b.block.dead && b.block.z > near && b.block.z < far;
      if (b.group.visible) b.paint();
    }

    // squads
    if (w.count > 0)
      this.runners.squad(
        w.x,
        w.z,
        w.count,
        crowdRadius(w.count),
        TEAM,
        1,
        clock,
        running,
        Math.max(-0.5, Math.min(0.5, (w.x - w.targetX) * 1.2)),
      );
    for (const th of w.things) {
      if (th.kind === "gate" || th.z < near || th.z > far || th.dead) continue;
      if (th.kind === "squad" && th.count > 0)
        this.runners.squad(
          th.x,
          th.z,
          th.count,
          squadRadius(th.count),
          RIVAL,
          -1,
          clock,
          th.z - w.z < 26,
          0,
        );
      else if (th.kind === "monster") this.monsters.draw(th, clock);
    }
    this.runners.finish();
    this.monsters.finish();

    // boss
    if (w.phase === "won") this.bossDead += dt * 0.8;
    this.boss.update(w, fx, this.bossDead);
    this.boss.group.visible = this.boss.group.visible && w.boss.z < far;

    // bullets
    let n = 0;
    for (const b of w.bullets) {
      if (n >= this.bullets.instanceMatrix.count) break;
      this.bullets.setMatrixAt(
        n++,
        local(b.x * ROAD, 0.5, -b.z - 0.3, Math.PI / 2),
      );
    }
    this.bullets.count = n;
    this.bullets.instanceMatrix.needsUpdate = true;

    // sparks
    n = 0;
    for (const p of fx.sparks) {
      if (n >= 600) break;
      const s = p.size * 1.2 * Math.max(0, 1 - p.life / p.max);
      this.sparks.setMatrixAt(
        n,
        local(p.x * ROAD, p.h, -p.z, p.life * 7, p.life * 5, 0, s, s, s),
      );
      this.sparks.setColorAt(n, _c.set(p.color));
      n++;
    }
    this.sparks.count = n;
    this.sparks.instanceMatrix.needsUpdate = true;
    if (this.sparks.instanceColor) this.sparks.instanceColor.needsUpdate = true;

    // slam shockwave rolls out from the boss toward the squad
    if (fx.slamAnim > 0 && fx.slamAnim < 0.75 && w.phase !== "won") {
      const k = 1 - fx.slamAnim / 0.75;
      const reach = BOSS_STOP * k + 2;
      this.ring.visible = true;
      this.ring.position.set(0, 0.06, -w.boss.z);
      this.ring.scale.setScalar(reach);
      (this.ring.material as THREE.MeshBasicMaterial).opacity = 1 - k * 0.8;
    } else this.ring.visible = false;

    // camera rides behind and above the squad
    this.camX += (w.x * ROAD * 0.45 - this.camX) * Math.min(1, dt * 4);
    const portrait = this.width / this.height < 0.8;
    // pull back as the squad grows so the whole crowd stays in frame
    const drawn = Math.min(Math.max(1, w.count), MAX_DRAWN);
    const depth = crowdDepth(drawn, crowdRadius(w.count) * ROAD * 1.1);
    this.camPull += (depth - this.camPull) * Math.min(1, dt * 2);
    const back = (portrait ? 10.5 : 8.5) + this.camPull * 0.9;
    const up = (portrait ? 10 : 7.4) + this.camPull * 0.6;
    const shake = fx.shake;
    const sx = shake ? (Math.random() - 0.5) * shake * 0.5 : 0;
    const sy = shake ? (Math.random() - 0.5) * shake * 0.35 : 0;
    this.camera.position.set(this.camX + sx, up + sy, -w.z + back);
    this.camera.lookAt(this.camX * 0.6 + sx, 0, -w.z - 13);

    this.sun.position.set(-8 + this.camX, 22, -w.z + 12);
    this.sun.target.position.set(this.camX, 0, -w.z - 8);
    const grass = this.scene.getObjectByName("grass");
    if (grass) grass.position.z = -w.z - 60;

    this.renderer.render(this.scene, this.camera);
  }

  /** Screen position in CSS pixels of a road point (x road units, z metres, h metres up). */
  project(x: number, z: number, h: number) {
    _v.set(x * ROAD, h, -z).project(this.camera);
    return {
      x: ((_v.x + 1) / 2) * this.width,
      y: ((1 - _v.y) / 2) * this.height,
      visible: _v.z < 1 && _v.z > -1,
    };
  }

  dispose() {
    this.clearLevel();
    this.scene.traverse((o) => {
      if (o instanceof THREE.Mesh || o instanceof THREE.InstancedMesh) {
        o.geometry.dispose();
        const m = o.material;
        (Array.isArray(m) ? m : [m]).forEach((x) => x.dispose());
      }
    });
    this.renderer.dispose();
  }
}

function checker() {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 16;
  const ctx = c.getContext("2d");
  if (ctx)
    for (let x = 0; x < 16; x++)
      for (let y = 0; y < 2; y++) {
        ctx.fillStyle = (x + y) % 2 ? "#ffffff" : "#20232c";
        ctx.fillRect(x * 8, y * 8, 8, 8);
      }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  return tex;
}
