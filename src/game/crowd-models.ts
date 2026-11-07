/**
 * Loads the Polyfork models used by Crowd Rush 3D and turns the rigged
 * humanoids into baked animation frames that can be instanced.
 *
 * A skinned mesh can't be drawn with InstancedMesh, so each humanoid is
 * posed with our own run or walk cycle and its skinned vertices are copied
 * into a plain geometry, one per frame. A runner then picks the frame for its
 * point in the cycle, and every runner on the same frame shares one draw call.
 *
 * Models: Polyfork (https://polyfork.dev), CC BY 4.0. See
 * public/models/crowd/CREDITS.md.
 */
import * as THREE from "three";
import {
  GLTFLoader,
  type GLTF,
} from "three/examples/jsm/loaders/GLTFLoader.js";

export const MODEL_URLS = {
  runner: "/models/crowd/infantry-rifleman-c1c0a5.glb",
  brute: "/models/crowd/orc-brute-08c6ca.glb",
  boss: "/models/crowd/tyrannosaurus-rex-adf79f.glb",
};

export type Bones = Record<string, THREE.Bone>;
export type Pose = (b: Bones, phase: number) => void;

/** Baked frames: one geometry per phase, plus colour variants of the whole set. */
export type Baked = {
  frames: THREE.BufferGeometry[];
  height: number;
};

export function loadModel(url: string): Promise<GLTF> {
  return new GLTFLoader().loadAsync(url);
}

const TAU = Math.PI * 2;

/** Rifleman jogging with the rifle held across the body. */
export const runPose: Pose = (b, p) => {
  const s = Math.sin(p * TAU);
  const c = Math.cos(p * TAU);
  b.LeftUpLeg.rotation.x = -0.8 * s;
  b.RightUpLeg.rotation.x = 0.8 * s;
  b.LeftLeg.rotation.x = 0.3 + 0.9 * Math.max(0, c);
  b.RightLeg.rotation.x = 0.3 + 0.9 * Math.max(0, -c);
  b.Spine.rotation.x = 0.15;
  b.Spine.rotation.y = 0.08 * s;
  b.Hips.position.y += Math.abs(s) * 0.05;
  holdRifle(b);
};
/** Rifleman standing ready. */
export const standPose: Pose = (b) => {
  b.Spine.rotation.x = 0.05;
  b.LeftUpLeg.rotation.z = 0.05;
  b.RightUpLeg.rotation.z = -0.05;
  holdRifle(b);
};
function holdRifle(b: Bones) {
  b.RightArm.rotation.z = 1.2;
  b.RightForeArm.rotation.y = 1.3;
  b.LeftArm.rotation.z = -1.0;
  b.LeftArm.rotation.y = -0.9;
  b.LeftForeArm.rotation.y = -1.2;
}
/** Orc stomping forward with swinging fists. */
export const stompPose: Pose = (b, p) => {
  const s = Math.sin(p * TAU);
  const c = Math.cos(p * TAU);
  b.LeftUpLeg.rotation.x = -0.5 * s;
  b.RightUpLeg.rotation.x = 0.5 * s;
  b.LeftLeg.rotation.x = 0.15 + 0.6 * Math.max(0, c);
  b.RightLeg.rotation.x = 0.15 + 0.6 * Math.max(0, -c);
  b.Spine.rotation.x = 0.2;
  b.Spine.rotation.z = 0.06 * s;
  b.Hips.position.y += Math.abs(s) * 0.06 - 0.04;
  b.LeftArm.rotation.z = -1.15;
  b.RightArm.rotation.z = 1.15;
  b.LeftArm.rotation.x = 0.5 * s - 0.3;
  b.RightArm.rotation.x = -0.5 * s - 0.3;
  b.LeftForeArm.rotation.y = -0.5;
  b.RightForeArm.rotation.y = 0.5;
};

const _v = new THREE.Vector3();

/**
 * Poses a rigged model at each phase and copies the skinned result into
 * plain non-indexed geometries with flat normals and vertex colours.
 * `skip` leaves out parts too small to see, such as the face.
 */
export function bake(
  gltf: GLTF,
  pose: Pose,
  phases: number[],
  skip: (name: string) => boolean = () => false,
): Baked {
  const root = gltf.scene;
  const meshes: THREE.SkinnedMesh[] = [];
  root.traverse((o) => {
    if ((o as THREE.SkinnedMesh).isSkinnedMesh && !skip(o.name))
      meshes.push(o as THREE.SkinnedMesh);
  });
  for (const m of meshes)
    if (m.geometry.index) m.geometry = m.geometry.toNonIndexed();
  const bones: Bones = {};
  root.traverse((o) => {
    if ((o as THREE.Bone).isBone) bones[o.name] = o as THREE.Bone;
  });
  const rest = Object.values(bones).map((bone) => ({
    bone,
    p: bone.position.clone(),
    q: bone.quaternion.clone(),
  }));
  const total = meshes.reduce(
    (n, m) => n + m.geometry.attributes.position.count,
    0,
  );

  // colours and part ranges are the same for every frame
  const colors = new Float32Array(total * 3);
  const parts: { name: string; start: number; count: number }[] = [];
  let o = 0;
  for (const m of meshes) {
    const n = m.geometry.attributes.position.count;
    const col = m.geometry.getAttribute("color");
    for (let i = 0; i < n; i++) {
      colors[(o + i) * 3] = col ? col.getX(i) : 1;
      colors[(o + i) * 3 + 1] = col ? col.getY(i) : 1;
      colors[(o + i) * 3 + 2] = col ? col.getZ(i) : 1;
    }
    parts.push({ name: m.name, start: o, count: n });
    o += n;
  }
  const colorAttr = new THREE.BufferAttribute(colors, 3);

  let height = 0;
  const frames = phases.map((phase) => {
    for (const r of rest) {
      r.bone.position.copy(r.p);
      r.bone.quaternion.copy(r.q);
    }
    pose(bones, phase);
    root.updateMatrixWorld(true);
    const pos = new Float32Array(total * 3);
    let k = 0;
    for (const m of meshes) {
      m.skeleton.update();
      const n = m.geometry.attributes.position.count;
      for (let i = 0; i < n; i++) {
        m.getVertexPosition(i, _v).applyMatrix4(m.matrixWorld);
        pos[k++] = _v.x;
        pos[k++] = _v.y;
        pos[k++] = _v.z;
        if (_v.y > height) height = _v.y;
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("color", colorAttr);
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
    geo.userData.parts = parts;
    return geo;
  });
  return { frames, height };
}

/**
 * A copy of the baked colours with some parts recoloured, keeping their
 * shading: each vertex keeps its brightness relative to the part's average.
 */
export function recolor(
  baked: Baked,
  tint: Record<string, THREE.ColorRepresentation>,
): THREE.BufferAttribute {
  const base = baked.frames[0].getAttribute("color") as THREE.BufferAttribute;
  const out = new Float32Array(base.array as Float32Array);
  const parts = baked.frames[0].userData.parts as {
    name: string;
    start: number;
    count: number;
  }[];
  const lum = (i: number) =>
    out[i * 3] * 0.3 + out[i * 3 + 1] * 0.59 + out[i * 3 + 2] * 0.11;
  for (const part of parts) {
    const want = Object.entries(tint).find(([k]) => part.name.includes(k));
    if (!want) continue;
    const c = new THREE.Color(want[1]);
    let avg = 0;
    for (let i = part.start; i < part.start + part.count; i++) avg += lum(i);
    avg = Math.max(0.0001, avg / part.count);
    for (let i = part.start; i < part.start + part.count; i++) {
      const k = Math.min(1.6, lum(i) / avg);
      out[i * 3] = c.r * k;
      out[i * 3 + 1] = c.g * k;
      out[i * 3 + 2] = c.b * k;
    }
  }
  return new THREE.BufferAttribute(out, 3);
}
