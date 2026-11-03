import * as THREE from "three";
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
  scene.background = new THREE.Color("#101e2b");
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  host.appendChild(renderer.domElement);
  const camera = new THREE.OrthographicCamera(-16, 16, 16, -16, 0.1, 100);
  camera.position.set(0, 28, 23);
  camera.lookAt(0, 0, 0);
  scene.add(new THREE.HemisphereLight(0xc6e9ff, 0x253c37, 2.5));
  const sun = new THREE.DirectionalLight(0xffe3ac, 3);
  sun.position.set(-8, 18, 8);
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
      flatShading: true,
      ...(emissive ? { emissive: color, emissiveIntensity: 1.5 } : {}),
    });
    mats.push(m);
    return m;
  }
  const stone = material("#5c797a"),
    edge = material("#243a47"),
    path = material("#9eaaa0"),
    gold = material("#e9c884"),
    green = material("#36746b"),
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
  mesh(
    new THREE.ConeGeometry(0.55, 1.2, 7),
    material("#50c5b5"),
    0,
    0.75,
    0,
    hero,
  );
  mesh(
    new THREE.SphereGeometry(0.32, 12, 8),
    material("#f3d3ad"),
    0,
    1.6,
    0,
    hero,
  );
  mesh(
    new THREE.ConeGeometry(0.44, 0.6, 6),
    material("#e8e8d0"),
    0,
    2,
    0,
    hero,
  );
  box(0.6, 1, 0, 0.08, 1.8, 0.08, gold, hero);
  mesh(new THREE.OctahedronGeometry(0.25), glow, 0.6, 1.85, 0, hero);
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
  const shadeMeshes = [0, 1, 2].map(() => {
    const group = new THREE.Group();
    scene.add(group);
    mesh(new THREE.IcosahedronGeometry(0.7, 1), dark, 0, 0.8, 0, group);
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
  let world = newWorld(),
    paused = true,
    disposed = false,
    last = performance.now(),
    frame = 0,
    emitTime = 0;
  const keys = new Set<string>();
  let pad = { x: 0, z: 0 };
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  function emit() {
    onState({
      stage: world.stage,
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
    const size = aspect < 1 ? 14 / aspect : 12;
    camera.left = -size * aspect;
    camera.right = size * aspect;
    camera.top = size;
    camera.bottom = -size;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  };
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resize();
  const ray = new THREE.Raycaster(),
    ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  function pointer(e: PointerEvent) {
    if (paused) return;
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
      if (k === " ") attack(world);
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
    if (!paused)
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
    if (!paused && keys.has(" ")) attack(world);
    hero.position.set(world.player.x, 0, world.player.z);
    hero.visible =
      world.invulnerable === 0 || Math.floor(world.invulnerable * 12) % 2 === 0;
    world.shades.forEach((s, i) => {
      const m = shadeMeshes[i];
      m.visible = s.hp > 0;
      m.position.set(
        s.x,
        reduced ? 0 : Math.sin(world.time * 3 + i) * 0.1,
        s.z,
      );
      m.scale.setScalar(s.hit > 0 ? 1.2 : 1);
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
      sun.intensity = 4;
    } else {
      spirit.position.x = spirit.position.z = 0;
      sun.intensity = 3;
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
    renderer.render(scene, camera);
  }
  frame = requestAnimationFrame(animate);
  emit();
  return {
    start() {
      world = newWorld();
      world.stage = "fight";
      paused = false;
      host.focus({ preventScroll: true });
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
        attack(world);
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
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
