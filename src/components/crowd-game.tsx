"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useLocale } from "./locale";
import {
  BOSS_STOP,
  crowdRadius,
  newLevel,
  opLabel,
  progress,
  squadRadius,
  type Monster,
  stars,
  start,
  steer,
  step,
  type GameEvent,
  type World,
} from "@/game/crowd-core";

const STORE = {
  level: "dingn.crowd.level",
  best: "dingn.crowd.best",
  sound: "dingn.crowd.sound",
};
const read = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const write = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {}
};

const TEAM = "#3ea6ff";
const TEAM_DARK = "#1f6fd1";
const RIVAL = "#ff5a5f";
const RIVAL_DARK = "#c2303a";
const MAX_DRAWN = 140;

/** Synthesised sound effects: no audio files are downloaded. */
class Sfx {
  private ctx?: AudioContext;
  private out?: GainNode;
  private noise?: AudioBuffer;
  private last: Record<string, number> = {};
  on = true;
  private ensure() {
    if (this.ctx) return this.ctx;
    const Ctor =
      typeof window !== "undefined"
        ? window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext
        : undefined;
    if (!Ctor) return undefined;
    try {
      const ctx = new Ctor();
      const out = ctx.createGain();
      out.gain.value = 0.5;
      out.connect(ctx.createDynamicsCompressor()).connect(ctx.destination);
      const len = Math.floor(ctx.sampleRate * 0.3);
      const noise = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.ctx = ctx;
      this.out = out;
      this.noise = noise;
    } catch {
      return undefined;
    }
    return this.ctx;
  }
  wake() {
    const ctx = this.ensure();
    if (ctx?.state === "suspended") void ctx.resume().catch(() => {});
  }
  private gap(name: string, seconds: number) {
    const now = this.ctx?.currentTime ?? 0;
    if (now - (this.last[name] ?? -1) < seconds) return false;
    this.last[name] = now;
    return true;
  }
  private tone(
    freq: number,
    to: number,
    dur: number,
    type: OscillatorType,
    vol: number,
    delay = 0,
  ) {
    const ctx = this.ctx;
    if (!ctx || !this.out) return;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.out);
    o.start(t);
    o.stop(t + dur + 0.02);
  }
  private thump(freq: number, dur: number, vol: number) {
    const ctx = this.ctx;
    if (!ctx || !this.out || !this.noise) return;
    const t = ctx.currentTime;
    const s = ctx.createBufferSource();
    s.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(this.out);
    s.start(t);
    s.stop(t + dur);
  }
  play(e: GameEvent | { type: "shot" }) {
    if (!this.on || !this.ensure()) return;
    switch (e.type) {
      case "shot":
        if (this.gap("shot", 0.07))
          this.tone(900 + Math.random() * 200, 300, 0.06, "square", 0.05);
        break;
      case "hit":
        if (this.gap("hit", 0.05))
          this.tone(
            e.target === "boss" ? 180 : 420,
            120,
            0.05,
            "triangle",
            0.12,
          );
        break;
      case "gate":
        if (e.good)
          [0, 4, 7].forEach((s, i) =>
            this.tone(
              523 * 2 ** (s / 12),
              523 * 2 ** (s / 12),
              0.18,
              "triangle",
              0.2,
              i * 0.06,
            ),
          );
        else this.tone(330, 110, 0.35, "sawtooth", 0.12);
        break;
      case "crate":
        this.tone(988, 988, 0.08, "square", 0.1);
        this.tone(1319, 1319, 0.25, "square", 0.1, 0.08);
        break;
      case "wall":
      case "clash":
        this.thump(900, 0.3, 0.7);
        break;
      case "kill":
        if (e.big) {
          this.thump(500, 0.35, 0.8);
          this.tone(784, 1568, 0.2, "square", 0.1, 0.05);
        } else if (this.gap("kill", 0.06))
          this.tone(660, 1320, 0.09, "square", 0.08);
        break;
      case "bite":
        if (this.gap("bite", 0.08)) this.thump(1400, 0.15, 0.5);
        break;
      case "summon":
        this.tone(140, 260, 0.4, "sawtooth", 0.12);
        break;
      case "slam":
        this.thump(220, 0.6, 1);
        this.tone(90, 40, 0.5, "sine", 0.6);
        break;
      case "won":
        [0, 4, 7, 12, 16].forEach((s, i) =>
          this.tone(
            523 * 2 ** (s / 12),
            523 * 2 ** (s / 12),
            0.3,
            "triangle",
            0.22,
            i * 0.1,
          ),
        );
        break;
      case "lost":
        [7, 4, 0, -5].forEach((s, i) =>
          this.tone(
            392 * 2 ** (s / 12),
            392 * 2 ** (s / 12),
            0.3,
            "triangle",
            0.18,
            i * 0.14,
          ),
        );
        break;
    }
  }
  close() {
    void this.ctx?.close().catch(() => {});
    this.ctx = undefined;
  }
}

type Spark = {
  x: number;
  z: number;
  h: number;
  vx: number;
  vz: number;
  vh: number;
  life: number;
  max: number;
  color: string;
  size: number;
};
type Float = {
  text: string;
  x: number;
  z: number;
  h: number;
  life: number;
  color: string;
  big: boolean;
};
type View = {
  w: number;
  h: number;
  dpr: number;
  horizon: number;
  F: number;
  camH: number;
  road: number;
};
const CAM_BACK = 7;

export function CrowdGame() {
  const { t } = useLocale();
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sfx = useRef<Sfx | null>(null);
  const world = useRef<World>(newLevel(1));
  const fx = useRef({
    sparks: [] as Spark[],
    floats: [] as Float[],
    shake: 0,
    bossHit: 0,
    slamAnim: 0,
    clock: 0,
    acc: 0,
    shots: 0,
    view: { w: 1, h: 1, dpr: 1, horizon: 0, F: 1, camH: 1, road: 1 } as View,
    drag: null as null | { id: number; x0: number; target0: number },
    keys: { left: false, right: false },
    paused: false,
  });
  const [phase, setPhase] = useState<World["phase"]>("ready");
  const [level, setLevel] = useState(1);
  const [best, setBest] = useState(0);
  const [result, setResult] = useState({ count: 0, stars: 0 });
  const [sound, setSound] = useState(true);

  function load(lv: number) {
    world.current = newLevel(lv);
    const f = fx.current;
    f.sparks = [];
    f.floats = [];
    f.shake = 0;
    f.slamAnim = 0;
    setLevel(lv);
    setPhase("ready");
  }

  useEffect(() => {
    const saved = Math.max(1, Number(read(STORE.level)) || 1);
    setBest(Number(read(STORE.best)) || 0);
    const s = read(STORE.sound) !== "off";
    setSound(s);
    sfx.current = new Sfx();
    sfx.current.on = s;
    load(saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function begin() {
    sfx.current?.wake();
    const w = world.current;
    if (w.phase === "ready") {
      start(w);
      setPhase("run");
      canvasRef.current?.focus({ preventScroll: true });
    }
  }
  function next() {
    load(world.current.level + 1);
  }
  function retry() {
    load(world.current.level);
  }

  // layout, game loop and input that lives outside React
  useEffect(() => {
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    if (!stage || !canvas) return;
    const f = fx.current;
    const layout = () => {
      const rect = stage.getBoundingClientRect();
      const w = Math.max(1, rect.width);
      const h = Math.max(1, rect.height);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      const horizon = h * 0.3;
      const F = h * 0.95;
      const camH = ((h * 0.84 - horizon) * CAM_BACK) / F;
      const road = (Math.min(w * 0.42, h * 0.5) * CAM_BACK) / F;
      f.view = { w, h, dpr, horizon, F, camH, road };
    };
    layout();
    const observer =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(layout)
        : undefined;
    observer?.observe(stage);
    const pause = () => {
      f.paused = document.hidden;
    };
    const blur = () => {
      f.paused = true;
      f.keys.left = f.keys.right = false;
    };
    const focus = () => {
      f.paused = false;
    };
    document.addEventListener("visibilitychange", pause);
    window.addEventListener("blur", blur);
    window.addEventListener("focus", focus);
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      update(f.paused ? 0 : dt);
      draw();
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      observer?.disconnect();
      document.removeEventListener("visibilitychange", pause);
      window.removeEventListener("blur", blur);
      window.removeEventListener("focus", focus);
      sfx.current?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function update(dt: number) {
    const f = fx.current;
    const w = world.current;
    f.clock += dt;
    if (f.keys.left !== f.keys.right)
      steer(w, w.targetX + (f.keys.left ? -2.2 : 2.2) * dt);
    const was = w.phase;
    f.acc += dt;
    while (f.acc >= 1 / 60) {
      f.acc -= 1 / 60;
      step(w, 1 / 60);
      for (const e of w.events) react(e);
      w.events.length = 0;
    }
    if (w.shotsFired !== f.shots) {
      f.shots = w.shotsFired;
      sfx.current?.play({ type: "shot" });
    }
    if (was !== w.phase) {
      setPhase(w.phase);
      if (w.phase === "won") {
        const s = stars(w);
        setResult({ count: w.count, stars: s });
        write(STORE.level, String(w.level + 1));
        setBest((b) => {
          const v = Math.max(b, w.level);
          write(STORE.best, String(v));
          return v;
        });
      }
    }
    for (const p of f.sparks) {
      p.life += dt;
      p.x += p.vx * dt;
      p.z += p.vz * dt;
      p.vh -= 9 * dt;
      p.h = Math.max(0, p.h + p.vh * dt);
    }
    f.sparks = f.sparks.filter((p) => p.life < p.max);
    for (const fl of f.floats) {
      fl.life += dt;
      fl.h += dt * 1.2;
    }
    f.floats = f.floats.filter((fl) => fl.life < 1.1);
    f.shake = Math.max(0, f.shake - dt * 2.5);
    f.bossHit = Math.max(0, f.bossHit - dt * 6);
    f.slamAnim = Math.max(0, f.slamAnim - dt * 2.2);
  }

  function burst(
    x: number,
    z: number,
    h: number,
    color: string,
    n: number,
    power = 3,
  ) {
    const f = fx.current;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      f.sparks.push({
        x,
        z,
        h,
        vx: Math.cos(a) * 0.12 * power * Math.random(),
        vz: Math.sin(a) * power * Math.random(),
        vh: 2 + Math.random() * power,
        life: 0,
        max: 0.4 + Math.random() * 0.4,
        color,
        size: 0.05 + Math.random() * 0.06,
      });
    }
    if (f.sparks.length > 500) f.sparks.splice(0, f.sparks.length - 500);
  }

  function react(e: GameEvent) {
    const f = fx.current;
    const w = world.current;
    if (e.type !== "hit") sfx.current?.play(e);
    switch (e.type) {
      case "gate":
        f.floats.push({
          text: `${e.after - e.before >= 0 ? "+" : ""}${e.after - e.before}`,
          x: w.x,
          z: w.z + 1.5,
          h: 1.6,
          life: 0,
          color: e.good ? "#9dff6a" : "#ff8a8a",
          big: true,
        });
        burst(w.x, w.z + 1, 0.6, e.good ? "#9dff6a" : "#ff8a8a", 18);
        if (!e.good) f.shake = Math.max(f.shake, 0.35);
        break;
      case "hit":
        if (e.target === "boss") {
          f.bossHit = 1;
          if (Math.random() < 0.3)
            burst(e.x, e.z - 0.8, 1.2 + Math.random() * 1.6, "#ffd36a", 2, 2);
          if (Math.random() < 0.08) sfx.current?.play(e);
        } else {
          burst(
            e.x,
            e.z,
            0.5,
            e.target === "squad"
              ? RIVAL
              : e.target === "monster"
                ? "#8be04e"
                : "#ffd36a",
            2,
            1.5,
          );
          sfx.current?.play(e);
        }
        break;
      case "crate":
        f.floats.push({
          text: `+${e.reward}`,
          x: e.x,
          z: e.z,
          h: 1.2,
          life: 0,
          color: "#ffe066",
          big: true,
        });
        burst(e.x, e.z, 0.5, "#ffcf3a", 24, 4);
        break;
      case "kill":
        burst(
          e.x,
          e.z,
          0.4,
          e.big ? "#c77dff" : "#8be04e",
          e.big ? 30 : 10,
          e.big ? 5 : 3,
        );
        if (e.reward)
          f.floats.push({
            text: `+${e.reward}`,
            x: e.x,
            z: e.z,
            h: e.big ? 1.4 : 0.9,
            life: 0,
            color: "#9dff6a",
            big: e.big,
          });
        if (e.big) f.shake = Math.max(f.shake, 0.3);
        break;
      case "bite":
        f.floats.push({
          text: `−${e.lost}`,
          x: e.x,
          z: e.z,
          h: 1,
          life: 0,
          color: "#ff8a8a",
          big: e.lost > 1,
        });
        burst(e.x, e.z, 0.4, TEAM, 6 + e.lost * 2, 3);
        if (e.lost > 1) f.shake = Math.max(f.shake, 0.35);
        break;
      case "wall":
        if (e.lost)
          f.floats.push({
            text: `−${e.lost}`,
            x: e.x,
            z: e.z,
            h: 1.2,
            life: 0,
            color: "#ff8a8a",
            big: true,
          });
        burst(e.x, e.z, 0.5, "#c9b79c", 22, 4);
        f.shake = Math.max(f.shake, 0.5);
        break;
      case "clash":
        f.floats.push({
          text: `−${e.lost}`,
          x: e.x,
          z: e.z,
          h: 1.2,
          life: 0,
          color: "#ff8a8a",
          big: true,
        });
        burst(e.x, e.z, 0.4, RIVAL, 26, 4);
        burst(e.x, e.z, 0.4, TEAM, 20, 4);
        f.shake = Math.max(f.shake, 0.45);
        break;
      case "slam":
        f.slamAnim = 1;
        f.shake = 0.8;
        f.floats.push({
          text: `−${e.lost}`,
          x: w.x,
          z: w.z + 1,
          h: 1.4,
          life: 0,
          color: "#ff8a8a",
          big: true,
        });
        burst(w.x, w.z + 0.5, 0.2, TEAM, Math.min(30, 6 + e.lost), 3);
        break;
      case "won":
        burst(0, w.boss.z, 2, "#ffd36a", 80, 7);
        burst(0, w.boss.z, 2, "#a580ff", 60, 6);
        break;
    }
  }

  // ---------- rendering ----------
  function draw() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const f = fx.current;
    const v = f.view;
    const w = world.current;
    const shakeX = f.shake ? (Math.random() - 0.5) * f.shake * 14 : 0;
    const shakeY = f.shake ? (Math.random() - 0.5) * f.shake * 10 : 0;
    ctx.setTransform(v.dpr, 0, 0, v.dpr, shakeX * v.dpr, shakeY * v.dpr);
    const camZ = w.z - CAM_BACK;
    const camX = w.x * 0.35;
    const project = (x: number, z: number, h = 0) => {
      const d = Math.max(0.3, z - camZ);
      const s = v.F / d;
      return {
        sx: v.w / 2 + (x - camX) * v.road * s,
        sy: v.horizon + (v.camH - h) * s,
        s,
        d,
      };
    };

    // sky and ground
    const sky = ctx.createLinearGradient(0, 0, 0, v.horizon);
    sky.addColorStop(0, "#6fb8ff");
    sky.addColorStop(1, "#d6ecff");
    ctx.fillStyle = sky;
    ctx.fillRect(-20, -20, v.w + 40, v.horizon + 20);
    ctx.fillStyle = "#c8e6a0";
    ctx.fillRect(-20, v.horizon, v.w + 40, v.h - v.horizon + 20);
    // far hills
    ctx.fillStyle = "#a4d38a";
    ctx.beginPath();
    ctx.moveTo(-20, v.horizon);
    for (let i = 0; i <= 12; i++) {
      const x = (i / 12) * (v.w + 40) - 20;
      ctx.lineTo(x, v.horizon - 10 - Math.abs(Math.sin(i * 1.7)) * v.h * 0.04);
    }
    ctx.lineTo(v.w + 20, v.horizon);
    ctx.fill();

    // road
    const far = 110;
    const a = project(-1.12, camZ + 0.4);
    const b = project(1.12, camZ + 0.4);
    const c = project(1.12, camZ + far);
    const d = project(-1.12, camZ + far);
    ctx.fillStyle = "#8a8fa3";
    ctx.beginPath();
    ctx.moveTo(a.sx, a.sy);
    ctx.lineTo(b.sx, b.sy);
    ctx.lineTo(c.sx, c.sy);
    ctx.lineTo(d.sx, d.sy);
    ctx.fill();
    const edge = (x: number, color: string) => {
      const p = project(x, camZ + 0.4);
      const q = project(x, camZ + far);
      ctx.strokeStyle = color;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(p.sx, p.sy);
      ctx.lineTo(q.sx, q.sy);
      ctx.stroke();
    };
    edge(-1.1, "#f2f2f2");
    edge(1.1, "#f2f2f2");
    // moving lane dashes
    ctx.fillStyle = "#ffffffaa";
    for (const lx of [-0.31, 0.31]) {
      for (let z = Math.floor(camZ / 6) * 6; z < camZ + far; z += 6) {
        if (z < camZ + 0.5) continue;
        const p1 = project(lx - 0.012, z);
        const p2 = project(lx + 0.012, z);
        const p3 = project(lx + 0.012, z + 2.6);
        const p4 = project(lx - 0.012, z + 2.6);
        ctx.beginPath();
        ctx.moveTo(p1.sx, p1.sy);
        ctx.lineTo(p2.sx, p2.sy);
        ctx.lineTo(p3.sx, p3.sy);
        ctx.lineTo(p4.sx, p4.sy);
        ctx.fill();
      }
    }
    // finish arena under the boss
    {
      const z0 = w.boss.z - BOSS_STOP + 2;
      const z1 = w.boss.z + 4;
      const pts = [
        project(-1.1, z0),
        project(1.1, z0),
        project(1.1, z1),
        project(-1.1, z1),
      ];
      ctx.fillStyle = "#b9a2ff55";
      ctx.beginPath();
      pts.forEach((pt, i) =>
        i ? ctx.lineTo(pt.sx, pt.sy) : ctx.moveTo(pt.sx, pt.sy),
      );
      ctx.fill();
    }

    // sort everything by depth, far to near
    type Item = { d: number; draw: () => void };
    const items: Item[] = [];
    for (const th of w.things) {
      if (th.z < camZ + 1 || th.z > camZ + far) continue;
      if (th.kind === "gate")
        items.push({
          d: th.z - camZ,
          draw: () => drawGate(ctx, project, th, w),
        });
      else if (th.kind === "block" && !th.dead)
        items.push({ d: th.z - camZ, draw: () => drawBlock(ctx, project, th) });
      else if (th.kind === "monster" && !th.dead)
        items.push({
          d: th.z - camZ,
          draw: () => drawMonster(ctx, project, th, f.clock),
        });
      else if (th.kind === "squad" && !th.dead && th.count > 0)
        items.push({
          d: th.z - camZ,
          draw: () =>
            drawCrowd(
              ctx,
              project,
              th.x,
              th.z,
              th.count,
              RIVAL,
              RIVAL_DARK,
              f.clock,
              false,
            ),
        });
    }
    if (w.boss.z - camZ < far)
      items.push({
        d: w.boss.z - camZ,
        draw: () => drawBoss(ctx, project, w, f),
      });
    if (w.count > 0)
      items.push({
        d: w.z - camZ,
        draw: () =>
          drawCrowd(
            ctx,
            project,
            w.x,
            w.z,
            w.count,
            TEAM,
            TEAM_DARK,
            f.clock,
            w.phase === "run",
          ),
      });
    for (const bl of w.bullets)
      items.push({
        d: bl.z - camZ,
        draw: () => {
          const p = project(bl.x, bl.z, 0.45);
          const q = project(bl.x, bl.z + 1.2, 0.45);
          ctx.strokeStyle = "#ffe26a";
          ctx.lineWidth = Math.max(1.5, p.s * 0.012);
          ctx.beginPath();
          ctx.moveTo(p.sx, p.sy);
          ctx.lineTo(q.sx, q.sy);
          ctx.stroke();
        },
      });
    for (const p of f.sparks)
      items.push({
        d: p.z - camZ,
        draw: () => {
          const q = project(p.x, p.z, p.h);
          ctx.globalAlpha = Math.max(0, 1 - p.life / p.max);
          ctx.fillStyle = p.color;
          const s = Math.max(1.5, p.size * q.s * 0.25);
          ctx.fillRect(q.sx - s / 2, q.sy - s / 2, s, s);
          ctx.globalAlpha = 1;
        },
      });
    items.sort((p, q) => q.d - p.d);
    for (const it of items) it.draw();

    // floating numbers
    for (const fl of f.floats) {
      const p = project(fl.x, fl.z, fl.h);
      ctx.globalAlpha = Math.max(0, 1 - fl.life / 1.1);
      ctx.font = `800 ${Math.round(fl.big ? 30 : 20)}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.lineWidth = 5;
      ctx.strokeStyle = "#00000088";
      ctx.strokeText(fl.text, p.sx, p.sy);
      ctx.fillStyle = fl.color;
      ctx.fillText(fl.text, p.sx, p.sy);
      ctx.globalAlpha = 1;
    }

    // HUD on canvas: progress bar, boss bar
    ctx.setTransform(v.dpr, 0, 0, v.dpr, 0, 0);
    const narrow = v.w < 520;
    const barW = narrow ? v.w - 32 : Math.min(320, v.w * 0.6);
    const bx = (v.w - barW) / 2;
    if (narrow) ctx.translate(0, 44);
    ctx.fillStyle = "#0b1426aa";
    roundRect(ctx, bx, 14, barW, 12, 6);
    ctx.fill();
    ctx.fillStyle = "#7cff6b";
    roundRect(ctx, bx, 14, Math.max(12, barW * progress(w)), 12, 6);
    ctx.fill();
    if (w.phase === "boss" || w.phase === "won") {
      ctx.fillStyle = "#0b1426cc";
      roundRect(ctx, bx, 34, barW, 16, 8);
      ctx.fill();
      ctx.fillStyle = f.bossHit ? "#ffb3d0" : "#b27bff";
      roundRect(
        ctx,
        bx,
        34,
        Math.max(0, barW * (w.boss.hp / w.boss.maxHp)),
        16,
        8,
      );
      ctx.fill();
      ctx.font = "700 11px system-ui, sans-serif";
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.fillText(`${w.boss.hp}`, v.w / 2, 46);
    }
  }

  // input
  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    sfx.current?.wake();
    const w = world.current;
    if (w.phase === "ready") begin();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
    fx.current.drag = { id: e.pointerId, x0: e.clientX, target0: w.targetX };
  }
  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    const drag = fx.current.drag;
    if (!drag || drag.id !== e.pointerId) return;
    const span = Math.min(fx.current.view.w * 0.42, 260);
    steer(world.current, drag.target0 + (e.clientX - drag.x0) / span);
  }
  function onPointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    if (fx.current.drag?.id === e.pointerId) fx.current.drag = null;
  }
  function onKey(e: React.KeyboardEvent, down: boolean) {
    const k = e.key.toLowerCase();
    const keys = fx.current.keys;
    if (k === "arrowleft" || k === "a") keys.left = down;
    else if (k === "arrowright" || k === "d") keys.right = down;
    else if (down && (k === "enter" || k === " ")) {
      const ph = world.current.phase;
      if (ph === "ready") begin();
      else if (ph === "won") next();
      else if (ph === "lost") retry();
    } else return;
    e.preventDefault();
  }
  function toggleSound() {
    const s = !sound;
    setSound(s);
    if (sfx.current) sfx.current.on = s;
    write(STORE.sound, s ? "on" : "off");
    if (s) sfx.current?.wake();
  }

  return (
    <div className="crowd-page">
      <div className="crowd-heading">
        <div>
          <p className="eyebrow">{t("ACTION · GROW YOUR SQUAD")}</p>
          <h1>{t("Crowd Rush")}</h1>
          <p className="lede">
            {t(
              "Steer through the best gates, blast everything in your way, then take down the boss.",
            )}
          </p>
        </div>
        <Link href="/">{t("Back to games")}</Link>
      </div>
      <div className="crowd-stage" ref={stageRef}>
        <canvas
          ref={canvasRef}
          className="crowd-canvas"
          tabIndex={0}
          role="application"
          aria-label={t(
            "Crowd Rush. Use the left and right arrow keys to steer. Press Enter to start.",
          )}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onKeyDown={(e) => onKey(e, true)}
          onKeyUp={(e) => onKey(e, false)}
          onContextMenu={(e) => e.preventDefault()}
        />
        <div className="crowd-hud">
          <span className="crowd-level">{t(`Level ${level}`)}</span>
          <button type="button" aria-pressed={sound} onClick={toggleSound}>
            {sound ? t("Sound on") : t("Sound off")}
          </button>
        </div>
        {phase === "ready" && (
          <div className="crowd-overlay">
            <p className="eyebrow">{t(`Level ${level}`)}</p>
            <h2>{t("Ready to rush?")}</h2>
            <ul>
              <li>{t("Drag left and right (or use ← →) to steer.")}</li>
              <li>
                {t(
                  "Every gate has two doors that look alike. Do the maths and take the one that leaves you more people.",
                )}
              </li>
              <li>
                {t(
                  "Your squad fires on its own. Shoot crates for recruits, dodge the walls.",
                )}
              </li>
              <li>
                {t(
                  "Monsters roam the road and the boss keeps calling more. Shoot them before they bite.",
                )}
              </li>
            </ul>
            <button type="button" className="button" onClick={begin}>
              {t("Start")}
            </button>
          </div>
        )}
        {phase === "won" && (
          <div className="crowd-overlay">
            <p
              className="crowd-stars"
              aria-label={t(`${result.stars} of 3 stars`)}
            >
              {"★".repeat(result.stars)}
              <span>{"★".repeat(3 - result.stars)}</span>
            </p>
            <h2>{t("Boss down!")}</h2>
            <p>{t(`${result.count} of your squad made it.`)}</p>
            <div className="crowd-actions">
              <button type="button" className="button" onClick={next}>
                {t("Next level →")}
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={retry}
              >
                {t("Replay")}
              </button>
            </div>
          </div>
        )}
        {phase === "lost" && (
          <div className="crowd-overlay">
            <h2>{t("Squad wiped out")}</h2>
            <p>
              {t(
                "Pick the bigger gate and shoot the crates for extra recruits.",
              )}
            </p>
            <button type="button" className="button" onClick={retry}>
              {t("Try again")}
            </button>
          </div>
        )}
      </div>
      <p className="crowd-hint">
        {t("Progress is saved on this device only.")}
        {best > 0 && <> {t(`Furthest level cleared: ${best}`)}</>}
      </p>
    </div>
  );
}

type Project = (
  x: number,
  z: number,
  h?: number,
) => { sx: number; sy: number; s: number; d: number };

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, Math.max(0, h), Math.min(r, w / 2, h / 2));
}

function label(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
  fill: string,
) {
  ctx.font = `800 ${Math.round(size)}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = Math.max(2, size / 6);
  ctx.strokeStyle = "#00000080";
  ctx.strokeText(text, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
  ctx.textBaseline = "alphabetic";
}

function drawGate(
  ctx: CanvasRenderingContext2D,
  project: Project,
  g: Extract<World["things"][number], { kind: "gate" }>,
  w: World,
) {
  for (const side of ["left", "right"] as const) {
    const s = g[side];
    const x0 = side === "left" ? -1.08 : 0.02;
    const x1 = side === "left" ? -0.02 : 1.08;
    const bl = project(x0, g.z, 0);
    const tr = project(x1, g.z, 1.9);
    // Both doors share one colour until you pass, so you have to do the
    // maths. Afterwards the door you took shows whether it was the better one.
    const chosen = g.used && g.chosen === side;
    const tone = chosen ? (g.wasBest ? "good" : "bad") : "plain";
    ctx.globalAlpha = g.used ? (chosen ? 0.6 : 0.25) : 1;
    ctx.fillStyle = { plain: "#4aa3ff66", good: "#36d17a77", bad: "#ff4d5a77" }[
      tone
    ];
    ctx.fillRect(bl.sx, tr.sy, tr.sx - bl.sx, bl.sy - tr.sy);
    ctx.strokeStyle = { plain: "#2b7fd6", good: "#2fbf6e", bad: "#e23b48" }[
      tone
    ];
    ctx.lineWidth = Math.max(2, bl.s * 0.03);
    ctx.strokeRect(bl.sx, tr.sy, tr.sx - bl.sx, bl.sy - tr.sy);
    label(
      ctx,
      opLabel(s),
      (bl.sx + tr.sx) / 2,
      (tr.sy + bl.sy) / 2,
      Math.max(10, bl.s * 0.42),
      "#fff",
    );
    ctx.globalAlpha = 1;
  }
  void w;
}

function drawBlock(
  ctx: CanvasRenderingContext2D,
  project: Project,
  b: Extract<World["things"][number], { kind: "block" }>,
) {
  const crate = b.reward > 0;
  const height = crate ? 0.75 : 1.2;
  const bl = project(b.x - b.w, b.z, 0);
  const tr = project(b.x + b.w, b.z, height);
  const back = project(b.x - b.w, b.z + 1, height);
  const backR = project(b.x + b.w, b.z + 1, height);
  // top face
  ctx.fillStyle = crate ? "#ffd970" : "#d9c9ad";
  ctx.beginPath();
  ctx.moveTo(bl.sx, tr.sy);
  ctx.lineTo(tr.sx, tr.sy);
  ctx.lineTo(backR.sx, backR.sy);
  ctx.lineTo(back.sx, back.sy);
  ctx.fill();
  // front
  ctx.fillStyle = crate ? "#f2a93b" : "#b59d7e";
  ctx.fillRect(bl.sx, tr.sy, tr.sx - bl.sx, bl.sy - tr.sy);
  ctx.strokeStyle = crate ? "#a8661c" : "#7d6a52";
  ctx.lineWidth = Math.max(1, bl.s * 0.012);
  ctx.strokeRect(bl.sx, tr.sy, tr.sx - bl.sx, bl.sy - tr.sy);
  if (crate) {
    ctx.beginPath();
    ctx.moveTo(bl.sx, tr.sy);
    ctx.lineTo(tr.sx, bl.sy);
    ctx.moveTo(tr.sx, tr.sy);
    ctx.lineTo(bl.sx, bl.sy);
    ctx.stroke();
  } else {
    for (let i = 1; i < 3; i++) {
      const y = tr.sy + ((bl.sy - tr.sy) * i) / 3;
      ctx.beginPath();
      ctx.moveTo(bl.sx, y);
      ctx.lineTo(tr.sx, y);
      ctx.stroke();
    }
  }
  const size = Math.max(9, bl.s * 0.2);
  label(
    ctx,
    String(b.hp),
    (bl.sx + tr.sx) / 2,
    (tr.sy + bl.sy) / 2,
    size,
    "#fff",
  );
  if (crate)
    label(
      ctx,
      `+${b.reward}`,
      (bl.sx + tr.sx) / 2,
      tr.sy - size * 0.9,
      size * 0.85,
      "#fff36a",
    );
}

function drawCrowd(
  ctx: CanvasRenderingContext2D,
  project: Project,
  cx: number,
  cz: number,
  count: number,
  color: string,
  dark: string,
  clock: number,
  running: boolean,
) {
  const n = Math.min(count, MAX_DRAWN);
  const R = color === TEAM ? crowdRadius(count) : squadRadius(count);
  const depth = R * 4.5;
  const people: { x: number; z: number; i: number }[] = [];
  for (let i = 0; i < n; i++) {
    const r = n === 1 ? 0 : Math.sqrt((i + 0.5) / n);
    const a = i * 2.39996;
    people.push({
      x: cx + Math.cos(a) * r * R,
      z: cz + Math.sin(a) * r * depth,
      i,
    });
  }
  people.sort((p, q) => q.z - p.z);
  for (const p of people) {
    const bob = running ? Math.abs(Math.sin(clock * 12 + p.i * 1.3)) * 0.08 : 0;
    const swing = running ? Math.sin(clock * 12 + p.i * 1.3) : 0;
    const foot = project(p.x, p.z, bob);
    const k = foot.s;
    const tall = 0.62 * k;
    const bw = Math.max(2.5, k * 0.075);
    const hip = foot.sy - tall * 0.38;
    // legs
    ctx.strokeStyle = dark;
    ctx.lineCap = "round";
    ctx.lineWidth = bw * 0.7;
    ctx.beginPath();
    ctx.moveTo(foot.sx - bw * 0.35, hip);
    ctx.lineTo(foot.sx - bw * 0.35 + swing * bw * 0.5, foot.sy);
    ctx.moveTo(foot.sx + bw * 0.35, hip);
    ctx.lineTo(foot.sx + bw * 0.35 - swing * bw * 0.5, foot.sy);
    ctx.stroke();
    // body
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(
      foot.sx - bw,
      hip - tall * 0.36,
      bw * 2,
      tall * 0.42,
      bw * 0.8,
    );
    ctx.fill();
    // head
    ctx.beginPath();
    ctx.arc(foot.sx, hip - tall * 0.36 - bw * 0.85, bw * 0.95, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff55";
    ctx.beginPath();
    ctx.arc(
      foot.sx - bw * 0.3,
      hip - tall * 0.36 - bw * 1.1,
      bw * 0.3,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  const top = project(cx, cz, 1.3);
  const size = Math.max(12, top.s * 0.13);
  ctx.fillStyle = color === TEAM ? "#0f3d78dd" : "#6d1218dd";
  const text = String(count);
  ctx.font = `800 ${Math.round(size)}px system-ui, sans-serif`;
  const tw = ctx.measureText(text).width + size;
  roundRect(
    ctx,
    top.sx - tw / 2,
    top.sy - size * 0.75,
    tw,
    size * 1.5,
    size * 0.75,
  );
  ctx.fill();
  label(ctx, text, top.sx, top.sy, size, "#fff");
}

function drawMonster(
  ctx: CanvasRenderingContext2D,
  project: Project,
  m: Monster,
  clock: number,
) {
  const hop = Math.abs(Math.sin(clock * (m.big ? 5 : 9) + m.id * 1.7));
  const foot = project(m.x, m.z, 0);
  const s = foot.s;
  const size = s * (m.big ? 1.5 : 0.85);
  const lift = hop * size * 0.25;
  const squash = 1 + (1 - hop) * 0.12;
  const cy = foot.sy - size * 0.55 - lift;
  const body = m.big ? "#9b5de5" : "#70c43b";
  const shade = m.big ? "#6a3cb0" : "#4c9324";
  // shadow
  ctx.fillStyle = "#00000030";
  ctx.beginPath();
  ctx.ellipse(foot.sx, foot.sy, size * 0.6, size * 0.14, 0, 0, Math.PI * 2);
  ctx.fill();
  // body: a squishy blob
  ctx.fillStyle = shade;
  ctx.beginPath();
  ctx.ellipse(
    foot.sx,
    cy + size * 0.06,
    size * 0.62 * squash,
    (size * 0.52) / squash,
    0,
    0,
    Math.PI * 2,
  );
  ctx.fill();
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(
    foot.sx,
    cy,
    size * 0.58 * squash,
    (size * 0.5) / squash,
    0,
    0,
    Math.PI * 2,
  );
  ctx.fill();
  if (m.big) {
    // horns
    ctx.fillStyle = "#ffe08a";
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(foot.sx + side * size * 0.28, cy - size * 0.38);
      ctx.lineTo(foot.sx + side * size * 0.48, cy - size * 0.8);
      ctx.lineTo(foot.sx + side * size * 0.1, cy - size * 0.45);
      ctx.fill();
    }
  }
  // angry eyes and mouth
  const eye = size * 0.12;
  ctx.fillStyle = "#fff";
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(foot.sx + side * size * 0.2, cy - size * 0.08, eye, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "#1b1b1b";
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(
      foot.sx + side * size * 0.18,
      cy - size * 0.05,
      eye * 0.55,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  ctx.strokeStyle = "#1b1b1b";
  ctx.lineWidth = Math.max(1, size * 0.05);
  ctx.beginPath();
  ctx.moveTo(foot.sx - size * 0.32, cy - size * 0.24);
  ctx.lineTo(foot.sx - size * 0.08, cy - size * 0.16);
  ctx.moveTo(foot.sx + size * 0.32, cy - size * 0.24);
  ctx.lineTo(foot.sx + size * 0.08, cy - size * 0.16);
  ctx.moveTo(foot.sx - size * 0.16, cy + size * 0.18);
  ctx.quadraticCurveTo(
    foot.sx,
    cy + size * 0.08,
    foot.sx + size * 0.16,
    cy + size * 0.18,
  );
  ctx.stroke();
  // health bar once damaged, or always for brutes
  if (m.big || m.hp < m.maxHp) {
    const bw = size * 1.1;
    const by = cy - size * (m.big ? 0.95 : 0.7);
    ctx.fillStyle = "#00000088";
    ctx.fillRect(foot.sx - bw / 2, by, bw, Math.max(3, size * 0.08));
    ctx.fillStyle = m.big ? "#ff9f43" : "#ff5a5f";
    ctx.fillRect(
      foot.sx - bw / 2,
      by,
      (bw * m.hp) / m.maxHp,
      Math.max(3, size * 0.08),
    );
  }
}

function drawBoss(
  ctx: CanvasRenderingContext2D,
  project: Project,
  w: World,
  f: { clock: number; bossHit: number; slamAnim: number },
) {
  if (w.boss.hp <= 0) return;
  const z = w.boss.z;
  const lift = f.slamAnim > 0.5 ? (1 - f.slamAnim) * 2 : f.slamAnim * 2;
  const foot = project(0, z, 0);
  const s = foot.s;
  const H = 7;
  const top = project(0, z, H);
  const bodyW = s * 2;
  const hit = f.bossHit > 0;
  // shadow
  ctx.fillStyle = "#00000033";
  ctx.beginPath();
  ctx.ellipse(foot.sx, foot.sy, bodyW * 0.9, bodyW * 0.18, 0, 0, Math.PI * 2);
  ctx.fill();
  // legs
  ctx.fillStyle = "#3b2a6b";
  ctx.fillRect(
    foot.sx - bodyW * 0.42,
    foot.sy - (foot.sy - top.sy) * 0.35,
    bodyW * 0.3,
    (foot.sy - top.sy) * 0.35,
  );
  ctx.fillRect(
    foot.sx + bodyW * 0.12,
    foot.sy - (foot.sy - top.sy) * 0.35,
    bodyW * 0.3,
    (foot.sy - top.sy) * 0.35,
  );
  // torso
  const torsoTop = top.sy + (foot.sy - top.sy) * 0.3;
  const torsoH = (foot.sy - top.sy) * 0.4;
  ctx.fillStyle = hit ? "#c9a6ff" : "#7b4ddb";
  roundRect(ctx, foot.sx - bodyW / 2, torsoTop, bodyW, torsoH, bodyW * 0.2);
  ctx.fill();
  // arms raised for a slam
  const armY = torsoTop - lift * torsoH * 0.9;
  ctx.fillStyle = "#5a37b0";
  roundRect(
    ctx,
    foot.sx - bodyW * 0.78,
    armY,
    bodyW * 0.24,
    torsoH * 0.95,
    bodyW * 0.1,
  );
  ctx.fill();
  roundRect(
    ctx,
    foot.sx + bodyW * 0.54,
    armY,
    bodyW * 0.24,
    torsoH * 0.95,
    bodyW * 0.1,
  );
  ctx.fill();
  // head with glowing eyes and horns
  const headR = bodyW * 0.32;
  const hy = torsoTop - headR * 0.8;
  ctx.fillStyle = hit ? "#c9a6ff" : "#8a5cf0";
  ctx.beginPath();
  ctx.arc(foot.sx, hy, headR, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffd36a";
  ctx.beginPath();
  ctx.moveTo(foot.sx - headR * 0.8, hy - headR * 0.5);
  ctx.lineTo(foot.sx - headR * 1.1, hy - headR * 1.5);
  ctx.lineTo(foot.sx - headR * 0.4, hy - headR * 0.85);
  ctx.moveTo(foot.sx + headR * 0.8, hy - headR * 0.5);
  ctx.lineTo(foot.sx + headR * 1.1, hy - headR * 1.5);
  ctx.lineTo(foot.sx + headR * 0.4, hy - headR * 0.85);
  ctx.fill();
  const glow = 0.6 + 0.4 * Math.sin(f.clock * 6);
  ctx.fillStyle = `rgba(255, 240, 120, ${glow})`;
  ctx.beginPath();
  ctx.arc(
    foot.sx - headR * 0.38,
    hy - headR * 0.05,
    headR * 0.16,
    0,
    Math.PI * 2,
  );
  ctx.arc(
    foot.sx + headR * 0.38,
    hy - headR * 0.05,
    headR * 0.16,
    0,
    Math.PI * 2,
  );
  ctx.fill();
}
