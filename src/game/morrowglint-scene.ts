import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { cameraFrame, combatTarget } from "./morrowglint-camera";
import {
  attack,
  chooseRune,
  newWorld,
  rescue,
  runes,
  runeOrder,
  step,
  type World,
} from "./morrowglint-core";
export type Snapshot = {
  stage: World["stage"];
  shot: "intro" | "finish" | null;
  locked: boolean;
  health: number;
  remaining: number;
  cooldown: number;
  runeIndex: number;
  watching: boolean;
  flash: number;
  mistakes: number;
  nearSpirit: boolean;
};
export function createAdventure(
  host: HTMLElement,
  onState: (s: Snapshot) => void,
  onPause: () => void,
  onError: () => void,
) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#122a3a");
  scene.fog = new THREE.FogExp2(0x122a3a, 0.018);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  host.appendChild(renderer.domElement);
  const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 160);
  camera.position.set(10, 8, 20);
  camera.lookAt(0, 1, 0);
  const composer = new EffectComposer(renderer);
  const renderPass = new RenderPass(scene, camera);
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.3, 0.5, 1.3);
  const output = new OutputPass();
  composer.addPass(renderPass);
  composer.addPass(bloom);
  composer.addPass(output);
  const fill = new THREE.HemisphereLight(0x9ec9e8, 0x15251f, 1.5);
  scene.add(fill);
  const sun = new THREE.DirectionalLight(0xffce8a, 2.5);
  sun.position.set(-12, 11, -7);
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.025;
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, {
    left: -16,
    right: 16,
    top: 16,
    bottom: -16,
  });
  scene.add(sun);
  const mats: THREE.Material[] = [];
  const geometries: THREE.BufferGeometry[] = [];
  function material(color: string, emissive = false) {
    const m = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.8,
      flatShading: false,
      ...(emissive ? { emissive: color, emissiveIntensity: 1.05 } : {}),
    });
    mats.push(m);
    return m;
  }
  const stone = material("#405d60"),
    edge = material("#243a47"),
    path = material("#6c817d"),
    gold = material("#d4b57b"),
    green = material("#244c45"),
    dark = material("#293447"),
    glow = material("#b9ffe2", true),
    pink = material("#b1a6fc", true);
  function mesh(
    g: THREE.BufferGeometry,
    m: THREE.Material,
    x: number,
    y: number,
    z: number,
    parent: THREE.Object3D = scene,
  ) {
    geometries.push(g);
    const o = new THREE.Mesh(g, m);
    o.position.set(x, y, z);
    o.castShadow = true;
    o.receiveShadow = true;
    parent.add(o);
    return o;
  }
  function box(
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    m: THREE.Material,
    parent: THREE.Object3D = scene,
  ) {
    return mesh(new THREE.BoxGeometry(w, h, d), m, x, y, z, parent);
  }
  const mountain = material("#233f4e");
  for (let i = 0; i < 16; i++) {
    const x = (i - 8) * 9,
      z = -35 - (i % 3) * 10,
      h = 12 + (i % 5) * 4;
    const rock = mesh(
      new THREE.ConeGeometry(8, h, 5),
      mountain,
      x,
      h / 2 - 5,
      z,
    );
    rock.rotation.y = i;
  }
  mesh(
    new THREE.CylinderGeometry(60, 60, 2, 64),
    material("#172f36"),
    0,
    -4,
    0,
  );
  const moonMat = new THREE.MeshBasicMaterial({ color: 0xf6e4bb });
  mats.push(moonMat);
  const moon = mesh(
    new THREE.SphereGeometry(3.4, 24, 16),
    moonMat,
    -17,
    22,
    -58,
  );
  moon.castShadow = false;
  const moonRing = mesh(
    new THREE.TorusGeometry(4.5, 0.025, 6, 64),
    moonMat,
    -17,
    22,
    -58,
  );
  moonRing.castShadow = false;
  mesh(new THREE.CylinderGeometry(15, 12, 2, 8), edge, 0, -1.4, 0);
  box(0, -0.25, 0, 24, 0.5, 24, stone);
  for (let x = -9; x <= 9; x += 3)
    for (let z = -9; z <= 9; z += 3)
      box(x, 0.01, z, 2.8, 0.07, 2.8, x === 0 || z === 0 ? path : stone);
  mesh(
    new THREE.CylinderGeometry(2.4, 2.4, 0.18, 40),
    material("#2e817f", true),
    0,
    0.1,
    0,
  );
  const halo = mesh(new THREE.TorusGeometry(2.8, 0.12, 8, 50), gold, 0, 0.2, 0);
  halo.rotation.x = Math.PI / 2;
  for (const x of [-10, 10])
    for (const z of [-9, -3, 3, 9]) {
      box(x, 1.2, z, 0.8, 2.4, 0.8, edge);
      box(x, 2.45, z, 1.15, 0.2, 1.15, gold);
      mesh(new THREE.OctahedronGeometry(0.35), glow, x, 2.9, z);
    }
  for (const x of [-9, 9]) {
    box(x, 2, -11, 1.4, 4, 1.4, stone);
    box(x, 4.3, -11, 2, 0.45, 2, gold);
    box(x / 2, 4, -11, 7, 0.5, 1, stone);
  }
  for (const [x, z] of [
    [-8, 7],
    [8, 7],
    [-8, -8],
    [8, -8],
  ]) {
    mesh(new THREE.CylinderGeometry(0.22, 0.4, 2.4, 6), gold, x, 1.2, z);
    mesh(new THREE.IcosahedronGeometry(1.7, 0), green, x, 3, z);
    mesh(new THREE.IcosahedronGeometry(1.2, 0), green, x + 0.6, 4, z);
  }
  for (const x of [-13, 13])
    for (const z of [-13, -6, 1, 8]) {
      box(x, 2.7, z, 1.1, 5.4, 1.1, edge);
      box(x, 5.6, z, 1.7, 0.3, 1.7, stone);
      box(x, 1, z, 1.5, 0.25, 1.5, gold);
    }
  for (let i = 0; i < 60; i++) {
    const side = i % 2 ? -1 : 1,
      x = side * (10.8 + (i % 4) * 0.55),
      z = -11 + ((i * 1.73) % 23);
    const grass = mesh(
      new THREE.ConeGeometry(0.15, 0.5 + (i % 3) * 0.2, 4),
      green,
      x,
      0.3,
      z,
    );
    grass.rotation.z = Math.sin(i) * 0.2;
  }
  const runeMeshes = runes.map((p, i) => {
    const group = new THREE.Group();
    group.position.set(p.x, 0, p.z);
    scene.add(group);
    mesh(new THREE.CylinderGeometry(0.9, 1.2, 0.5, 6), edge, 0, 0.25, 0, group);
    const gem = mesh(
      new THREE.OctahedronGeometry(0.65),
      pink,
      0,
      1.3,
      0,
      group,
    );
    for (let j = 0; j <= i; j++)
      mesh(
        new THREE.SphereGeometry(0.12, 8, 6),
        gold,
        (j - i / 2) * 0.4,
        2.25,
        0,
        group,
      );
    return gem;
  });
  const hero = new THREE.Group();
  scene.add(hero);
  const robe = material("#277e82"),
    cloth = material("#123e50"),
    skin = material("#e8c6a0");
  const body = new THREE.Group();
  hero.add(body);
  mesh(new THREE.CapsuleGeometry(0.31, 0.65, 4, 10), robe, 0, 1.1, 0, body);
  const cape = mesh(
    new THREE.ConeGeometry(0.65, 1.35, 16, 1, true),
    cloth,
    0,
    0.9,
    -0.12,
    body,
  );
  cape.scale.z = 0.65;
  mesh(new THREE.SphereGeometry(0.34, 16, 12), cloth, 0, 1.86, 0, body);
  const face = mesh(
    new THREE.SphereGeometry(0.25, 12, 8),
    skin,
    0,
    1.85,
    0.16,
    body,
  );
  face.scale.z = 0.65;
  for (const x of [-0.1, 0.1])
    mesh(new THREE.SphereGeometry(0.025, 8, 6), dark, x, 1.9, 0.32, body);
  const legs = [-0.2, 0.2].map((x) =>
    mesh(new THREE.CapsuleGeometry(0.12, 0.42, 3, 8), cloth, x, 0.35, 0, hero),
  );
  const arms = [-0.42, 0.42].map((x) =>
    mesh(new THREE.CapsuleGeometry(0.11, 0.5, 3, 8), robe, x, 1.15, 0, body),
  );
  box(0.57, 1.05, 0.1, 0.07, 1.8, 0.07, gold, body);
  mesh(new THREE.OctahedronGeometry(0.2), glow, 0.57, 2, 0.1, body);
  const lantern = new THREE.PointLight(0x9cffe0, 5, 5);
  lantern.position.set(0.57, 1.9, 0.1);
  hero.add(lantern);
  const poolLight = new THREE.PointLight(0x72e7df, 18, 12);
  poolLight.position.set(0, 2, 0);
  scene.add(poolLight);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xc8ffbd,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
  });
  mats.push(ringMat);
  const ring = mesh(new THREE.RingGeometry(0.9, 1, 64), ringMat, 0, 0.16, 0);
  ring.rotation.x = -Math.PI / 2;
  ring.castShadow = false;
  ring.receiveShadow = false;
  const death = [0, 0, 0];
  const shadeMeshes = [0, 1, 2].map(() => {
    const group = new THREE.Group();
    scene.add(group);
    mesh(new THREE.IcosahedronGeometry(0.7, 2), dark, 0, 0.8, 0, group);
    for (const x of [-0.3, 0.3]) {
      mesh(new THREE.ConeGeometry(0.16, 0.65, 4), dark, x, 1.55, 0, group);
      mesh(new THREE.SphereGeometry(0.09, 8, 6), pink, x, 1, 0.59, group);
    }
    return group;
  });
  const spirit = new THREE.Group();
  spirit.position.set(0, 1.8, 0);
  scene.add(spirit);
  mesh(new THREE.IcosahedronGeometry(0.65, 1), glow, 0, 0, 0, spirit);
  for (const x of [-0.85, 0.85]) {
    const wing = mesh(new THREE.OctahedronGeometry(0.5), gold, x, 0, 0, spirit);
    wing.scale.set(1, 0.3, 0.65);
  }
  for (const x of [-0.18, 0.18])
    mesh(new THREE.SphereGeometry(0.07, 8, 6), dark, x, 0.1, 0.58, spirit);
  const cage = mesh(
    new THREE.TorusGeometry(1.1, 0.045, 6, 48),
    pink,
    0,
    1.8,
    0,
  );
  cage.rotation.x = Math.PI / 2;
  const lockMat = new THREE.MeshBasicMaterial({
    color: 0xffd58a,
    transparent: true,
    opacity: 0.75,
    side: THREE.DoubleSide,
  });
  mats.push(lockMat);
  const lockRing = mesh(
    new THREE.RingGeometry(0.85, 0.91, 48),
    lockMat,
    0,
    0.15,
    0,
  );
  lockRing.rotation.x = -Math.PI / 2;
  lockRing.castShadow = false;
  lockRing.receiveShadow = false;
  const flowers = new THREE.Group();
  scene.add(flowers);
  for (let i = 0; i < 36; i++) {
    const angle = i * 2.399;
    const radius = 3.5 + (i % 5) * 1.2;
    const x = Math.cos(angle) * radius,
      z = Math.sin(angle) * radius;
    mesh(
      new THREE.CylinderGeometry(0.025, 0.025, 0.55, 4),
      green,
      x,
      0.35,
      z,
      flowers,
    );
    mesh(
      new THREE.IcosahedronGeometry(0.18, 0),
      i % 2 ? gold : glow,
      x,
      0.7,
      z,
      flowers,
    );
  }
  flowers.visible = false;
  const particles: THREE.Mesh[] = [];
  for (let i = 0; i < 30; i++)
    particles.push(
      mesh(
        new THREE.OctahedronGeometry(0.04),
        glow,
        Math.sin(i * 4) * 11,
        1 + (i % 7) * 0.6,
        Math.cos(i * 7) * 11,
      ),
    );
  // Fade foreground scenery instead of letting the close camera hide the hero.
  const blockers = scene.children.filter(
    (o): o is THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial> =>
      o instanceof THREE.Mesh &&
      o.material instanceof THREE.MeshStandardMaterial &&
      Math.abs(o.position.x) >= 7 &&
      o.position.y > 1 &&
      o.material.emissiveIntensity <= 1,
  );
  blockers.forEach((o) => {
    o.material = o.material.clone();
    o.material.transparent = true;
    mats.push(o.material);
  });
  const sightRay = new THREE.Raycaster(),
    heroSight = new THREE.Vector3();
  let world = newWorld(),
    paused = true,
    disposed = false,
    last = performance.now(),
    frame = 0,
    emitTime = 0;
  const keys = new Set<string>();
  let pad = { x: 0, z: 0 };
  let reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let closeCamera = true,
    shot: "intro" | "finish" | null = null,
    shotTime = 0,
    shotDuration = 0,
    visualTime = 0;
  let locked = -1,
    previousRemaining = 3,
    previousX = 0,
    previousZ = 8;
  const look = new THREE.Vector3(0, 1, 0),
    desiredEye = new THREE.Vector3(),
    desiredLook = new THREE.Vector3();
  function finishShot() {
    shot = null;
    shotTime = 0;
    keys.clear();
  }
  function cast() {
    if (shot) return;
    attack(world);
  }
  function triggerShot(kind: "intro" | "finish", duration: number) {
    if (reduced) return;
    shot = kind;
    shotTime = 0;
    shotDuration = duration;
    keys.clear();
    pad = { x: 0, z: 0 };
  }

  function emit() {
    onState({
      stage: world.stage,
      shot,
      locked: locked >= 0,
      health: world.health,
      remaining: world.shades.filter((s) => s.hp > 0).length,
      cooldown: world.cooldown,
      runeIndex: world.runeIndex,
      watching: world.memoryTime < 4.5,
      flash:
        world.stage === "memory" && world.memoryTime < 4.5
          ? runeOrder[Math.min(2, Math.floor(world.memoryTime / 1.5))]
          : -1,
      mistakes: world.mistakes,
      nearSpirit: Math.hypot(world.player.x, world.player.z) < 2.5,
    });
  }
  const resize = () => {
    const w = host.clientWidth,
      h = host.clientHeight;
    const aspect = w / Math.max(1, h);
    camera.aspect = aspect;
    camera.fov = aspect < 1 ? 62 : 52;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
  };
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resize();
  const ray = new THREE.Raycaster(),
    ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  function pointer(e: PointerEvent) {
    if (paused || shot) return;
    host.focus({ preventScroll: true });
    const rect = host.getBoundingClientRect();
    ray.setFromCamera(
      new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        (-(e.clientY - rect.top) / rect.height) * 2 + 1,
      ),
      camera,
    );
    const hit = new THREE.Vector3();
    if (ray.ray.intersectPlane(ground, hit))
      world.target = {
        x: Math.max(-10, Math.min(10, hit.x)),
        z: Math.max(-10, Math.min(10, hit.z)),
      };
  }
  function keydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      pause();
      onPause();
      return;
    }
    if (paused) return;
    const k = e.key.toLowerCase();
    if (
      [
        "w",
        "a",
        "s",
        "d",
        "arrowup",
        "arrowdown",
        "arrowleft",
        "arrowright",
        " ",
        "e",
        "1",
        "2",
        "3",
      ].includes(k)
    ) {
      e.preventDefault();
      keys.add(k);
      if (k === " ") cast();
      if (k === "e") rescue(world);
      if (/[123]/.test(k) && k.length === 1) chooseRune(world, Number(k) - 1);
      emit();
    }
  }
  function keyup(e: KeyboardEvent) {
    keys.delete(e.key.toLowerCase());
  }
  function pause() {
    paused = true;
    keys.clear();
    pad = { x: 0, z: 0 };
  }
  function blur() {
    if (!paused) {
      pause();
      onPause();
    }
  }
  function visibility() {
    if (document.hidden) blur();
  }
  function lost(e: Event) {
    e.preventDefault();
    pause();
    onError();
  }
  host.addEventListener("pointerdown", pointer);
  host.addEventListener("keydown", keydown);
  window.addEventListener("keyup", keyup);
  window.addEventListener("blur", blur);
  document.addEventListener("visibilitychange", visibility);
  renderer.domElement.addEventListener("webglcontextlost", lost);
  function animate(now: number) {
    if (disposed) return;
    frame = requestAnimationFrame(animate);
    const dt = (now - last) / 1000;
    last = now;
    if (!paused && !shot)
      step(world, dt, {
        x:
          pad.x +
          Number(keys.has("d") || keys.has("arrowright")) -
          Number(keys.has("a") || keys.has("arrowleft")),
        z:
          pad.z +
          Number(keys.has("s") || keys.has("arrowdown")) -
          Number(keys.has("w") || keys.has("arrowup")),
      });
    if (!paused && !shot && keys.has(" ")) cast();
    const frameDt = Math.min(0.05, Math.max(0, dt));
    if (!paused || world.stage === "ready") visualTime += frameDt;
    if (shot && !paused) {
      shotTime += frameDt;
      if (shotTime >= shotDuration) finishShot();
    }
    const remaining = world.shades.filter((s) => s.hp > 0).length;
    if (remaining === 0 && previousRemaining > 0) triggerShot("finish", 1.1);
    previousRemaining = remaining;
    locked = combatTarget(world);
    lockRing.visible = locked >= 0;
    if (locked >= 0) {
      const target = world.shades[locked];
      lockRing.position.set(target.x, 0.15, target.z);
    }
    const dx = world.player.x - previousX,
      dz = world.player.z - previousZ;
    const walking = Math.hypot(dx, dz) > 0.001;
    if (walking) hero.rotation.y = Math.atan2(dx, dz);
    else if (locked >= 0)
      hero.rotation.y = Math.atan2(
        world.shades[locked].x - world.player.x,
        world.shades[locked].z - world.player.z,
      );
    previousX = world.player.x;
    previousZ = world.player.z;
    const stride = reduced
      ? 0
      : Math.sin(world.time * 11) * (walking ? 0.45 : 0);
    legs[0].rotation.x = stride;
    legs[1].rotation.x = -stride;
    arms[0].rotation.x = -stride * 0.5;
    arms[1].rotation.x = world.pulse > 0 ? -1.1 : stride * 0.5;
    cape.rotation.x = reduced
      ? 0
      : Math.sin(world.time * 4) * 0.04 + (walking ? 0.1 : 0);
    body.position.y = reduced
      ? 0
      : Math.abs(Math.sin(world.time * 11)) * (walking ? 0.05 : 0);
    hero.position.set(world.player.x, 0, world.player.z);
    hero.visible =
      reduced ||
      world.invulnerable === 0 ||
      Math.floor(world.invulnerable * 12) % 2 === 0;
    world.shades.forEach((s, i) => {
      const m = shadeMeshes[i];
      if (s.hp === 0 && !paused) death[i] = Math.min(0.8, death[i] + frameDt);
      m.visible = s.hp > 0 || death[i] < 0.8;
      m.position.set(
        s.x,
        reduced ? 0 : Math.sin(world.time * 3 + i) * 0.1,
        s.z,
      );
      m.scale.setScalar(
        s.hp === 0 ? Math.max(0.001, 1 - death[i] / 0.8) : s.hit > 0 ? 1.2 : 1,
      );
    });
    ring.position.set(world.player.x, 0.16, world.player.z);
    ring.scale.setScalar(1 + (1 - world.pulse / 0.5) * 3);
    ringMat.opacity = (world.pulse / 0.5) * 0.65;
    const restored = world.stage === "won";
    flowers.visible = restored;
    cage.visible = !["rescue", "won"].includes(world.stage);
    if (!reduced) spirit.position.y = 1.8 + Math.sin(world.time * 2) * 0.2;
    if (restored) {
      spirit.position.x = world.player.x + 1;
      spirit.position.z = world.player.z - 1;
      sun.intensity = 3.5;
      fill.intensity = 1.8;
    } else {
      spirit.position.x = spirit.position.z = 0;
      sun.intensity = 2.5;
      fill.intensity = 1.5;
    }
    const flash =
      world.stage === "memory" && world.memoryTime < 4.5
        ? runeOrder[Math.min(2, Math.floor(world.memoryTime / 1.5))]
        : -1;
    runeMeshes.forEach((m, i) => {
      m.material =
        i === flash || runeOrder.slice(0, world.runeIndex).includes(i)
          ? glow
          : pink;
      m.scale.setScalar(i === flash ? 1.4 : 1);
      if (!reduced && !paused) m.rotation.y += 0.01;
    });
    if (!reduced && !paused)
      particles.forEach((p, i) => {
        p.position.y = 1 + (i % 7) * 0.6 + Math.sin(world.time + i) * 0.3;
      });
    if (now - emitTime > 100) {
      emit();
      emitTime = now;
    }
    const target = locked >= 0 ? world.shades[locked] : null;
    const framing = cameraFrame(
      world.player,
      reduced ? null : target,
      camera.aspect,
      closeCamera && !!target && !reduced,
    );
    desiredEye.set(framing.eye.x, framing.eye.y, framing.eye.z);
    desiredLook.set(framing.focus.x, framing.focus.y, framing.focus.z);
    if (world.stage === "ready") {
      desiredEye.set(
        10 + (reduced ? 0 : Math.sin(visualTime * 0.12) * 2),
        7,
        19,
      );
      desiredLook.set(0, 1.5, 0);
    } else if (shot === "intro") {
      const a = THREE.MathUtils.smoothstep(shotTime / shotDuration, 0, 1);
      desiredEye.lerpVectors(new THREE.Vector3(-8, 5, 17), desiredEye, a);
      desiredLook.lerpVectors(new THREE.Vector3(0, 2, 0), desiredLook, a);
    } else if (shot === "finish") {
      desiredEye.set(world.player.x + 4, 3.5, world.player.z + 7);
      desiredLook.set(world.player.x, 1.2, world.player.z);
    } else if (world.stage === "memory") {
      desiredEye.set(
        0,
        camera.aspect < 1 ? 21 : 15,
        camera.aspect < 1 ? 25 : 19,
      );
      desiredLook.set(0, 0.6, 0);
    }
    const blend = reduced ? 1 : 1 - Math.exp(-frameDt * 4);
    if (!paused || world.stage === "ready") {
      camera.position.lerp(desiredEye, blend);
      look.lerp(desiredLook, blend);
    }
    camera.lookAt(look);
    heroSight.set(world.player.x, 1.1, world.player.z).sub(camera.position);
    sightRay.set(camera.position, heroSight.clone().normalize());
    sightRay.far = Math.max(0, heroSight.length() - 0.4);
    const blocked = new Set(
      world.stage === "ready"
        ? []
        : sightRay.intersectObjects(blockers, false).map((hit) => hit.object),
    );
    blockers.forEach((o) => {
      o.material.opacity = THREE.MathUtils.lerp(
        o.material.opacity,
        blocked.has(o) ? 0.14 : 1,
        1 - Math.exp(-frameDt * 12),
      );
      o.material.depthWrite = o.material.opacity > 0.95;
    });
    composer.render(frameDt);
  }
  frame = requestAnimationFrame(animate);
  emit();
  return {
    start() {
      world = newWorld();
      world.stage = "fight";
      paused = false;
      previousRemaining = 3;
      death.fill(0);
      previousX = 0;
      previousZ = 8;
      finishShot();
      triggerShot("intro", 2.6);
      host.focus({ preventScroll: true });
      emit();
    },
    setSteady(value: boolean) {
      reduced = value;
      if (value) finishShot();
    },
    setCloseCamera(value: boolean) {
      closeCamera = value;
    },
    skipShot() {
      finishShot();
      emit();
    },
    pause,
    resume() {
      paused = false;
      keys.clear();
      host.focus({ preventScroll: true });
    },
    attack() {
      if (!paused) {
        cast();
        emit();
      }
    },
    rune(i: number) {
      if (!paused) {
        chooseRune(world, i);
        emit();
      }
    },
    rescue() {
      if (!paused) {
        rescue(world);
        emit();
      }
    },
    move(x: number, z: number) {
      pad = { x, z };
    },
    replayPattern() {
      if (world.stage === "memory") {
        world.memoryTime = 0;
        world.runeIndex = 0;
        emit();
      }
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      host.removeEventListener("pointerdown", pointer);
      host.removeEventListener("keydown", keydown);
      window.removeEventListener("keyup", keyup);
      window.removeEventListener("blur", blur);
      document.removeEventListener("visibilitychange", visibility);
      renderer.domElement.removeEventListener("webglcontextlost", lost);
      geometries.forEach((g) => g.dispose());
      mats.forEach((m) => m.dispose());
      bloom.dispose();
      output.dispose();
      renderPass.dispose();
      composer.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
