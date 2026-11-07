"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useLocale } from "./locale";
import {
  fitGrid,
  newSheet,
  nextBubble,
  nextStreak,
  sweep,
  pop,
  type Bubble,
  type Sheet,
} from "@/game/pop-core";

const STORE = {
  total: "dingn.pop.total",
  sheets: "dingn.pop.sheets",
  sound: "dingn.pop.sound",
  haptics: "dingn.pop.haptics",
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

/** Sheet colour themes: [plastic hue, saturation, backdrop]. */
const THEMES: [number, number, string][] = [
  [196, 70, "#12313b"],
  [158, 55, "#14322a"],
  [268, 55, "#271d3d"],
  [334, 60, "#3a1a2c"],
  [38, 75, "#3a2a14"],
  [212, 30, "#1d2632"],
];
const CALM_LINES = [
  "Lovely. Drop your shoulders and breathe out.",
  "One more sheet, or one slow breath. Both count.",
  "Nothing to win here. Just pops.",
  "Unclench your jaw. Here comes another.",
  "That’s a whole sheet. Nice and easy.",
  "Breathe in for four, out for six.",
];
const PENTATONIC = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21];

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  star: boolean;
};
type Ring = { x: number; y: number; t: number; golden: boolean };

/** Synthesised sounds: no audio files are downloaded. */
class PopAudio {
  private ctx?: AudioContext;
  private noise?: AudioBuffer;
  private master?: GainNode;
  private lastAt = 0;
  private burst = 0;
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
      const length = Math.floor(ctx.sampleRate * 0.09);
      const noise = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = noise.getChannelData(0);
      for (let i = 0; i < length; i++)
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 4);
      const master = ctx.createGain();
      master.gain.value = 0.7;
      const comp = ctx.createDynamicsCompressor();
      master.connect(comp).connect(ctx.destination);
      this.ctx = ctx;
      this.noise = noise;
      this.master = master;
    } catch {
      return undefined;
    }
    return this.ctx;
  }
  wake() {
    const ctx = this.ensure();
    if (ctx?.state === "suspended") void ctx.resume().catch(() => {});
  }
  pop(tone: number, streak: number, golden: boolean) {
    const ctx = this.ensure();
    if (!ctx || !this.noise || !this.master) return;
    const now = ctx.currentTime;
    // A fast swipe can pop many bubbles at once: keep it crisp, not noisy.
    if (now - this.lastAt < 0.012) {
      if (++this.burst > 2) return;
    } else this.burst = 0;
    this.lastAt = now;
    const lift = Math.min(streak, 24) * 0.012;
    const crack = ctx.createBufferSource();
    crack.buffer = this.noise;
    crack.playbackRate.value = 0.85 + tone * 0.35 + lift;
    const band = ctx.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.value = 900 + tone * 1300 + lift * 2000;
    band.Q.value = 1.1;
    const crackGain = ctx.createGain();
    crackGain.gain.setValueAtTime(0.9, now);
    crackGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    crack.connect(band).connect(crackGain).connect(this.master);
    crack.start(now);
    crack.stop(now + 0.1);

    const thock = ctx.createOscillator();
    thock.type = "sine";
    thock.frequency.setValueAtTime(220 + tone * 120, now);
    thock.frequency.exponentialRampToValueAtTime(70, now + 0.07);
    const thockGain = ctx.createGain();
    thockGain.gain.setValueAtTime(0.35, now);
    thockGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    thock.connect(thockGain).connect(this.master);
    thock.start(now);
    thock.stop(now + 0.1);

    if (golden) this.chime([0, 7, 12], 0.07, now + 0.02);
  }
  chime(steps: number[], gap: number, at?: number) {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const start = at ?? ctx.currentTime;
    steps.forEach((step, i) => {
      const t = start + i * gap;
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.value = 523.25 * Math.pow(2, step / 12);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.22, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
      osc.connect(gain).connect(this.master!);
      osc.start(t);
      osc.stop(t + 0.75);
    });
  }
  sheetDone() {
    this.chime([0, 4, 7, 12, 16], 0.09);
  }
  close() {
    void this.ctx?.close().catch(() => {});
    this.ctx = undefined;
  }
}

function bubbleSprite(hue: number, sat: number, golden: boolean, size: number) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = Math.ceil(size * 1.3);
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  const c = canvas.width / 2;
  const r = size / 2;
  // soft contact shadow
  const shadow = ctx.createRadialGradient(
    c + r * 0.12,
    c + r * 0.2,
    r * 0.6,
    c,
    c + r * 0.15,
    r * 1.15,
  );
  shadow.addColorStop(0, "rgba(0,0,0,0.35)");
  shadow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = shadow;
  ctx.beginPath();
  ctx.arc(c, c + r * 0.12, r * 1.15, 0, Math.PI * 2);
  ctx.fill();
  // dome
  const h = golden ? 45 : hue;
  const s = golden ? 95 : sat;
  const dome = ctx.createRadialGradient(
    c - r * 0.35,
    c - r * 0.4,
    r * 0.1,
    c,
    c,
    r,
  );
  dome.addColorStop(0, `hsla(${h}, ${s}%, ${golden ? 88 : 92}%, 0.95)`);
  dome.addColorStop(
    0.55,
    `hsla(${h}, ${s}%, ${golden ? 62 : 72}%, ${golden ? 0.95 : 0.55})`,
  );
  dome.addColorStop(
    1,
    `hsla(${h}, ${s}%, ${golden ? 38 : 45}%, ${golden ? 0.95 : 0.7})`,
  );
  ctx.fillStyle = dome;
  ctx.beginPath();
  ctx.arc(c, c, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = `hsla(${h}, ${s}%, 90%, 0.45)`;
  ctx.lineWidth = Math.max(1, r * 0.05);
  ctx.stroke();
  // specular highlight
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.beginPath();
  ctx.ellipse(
    c - r * 0.36,
    c - r * 0.42,
    r * 0.22,
    r * 0.12,
    -0.6,
    0,
    Math.PI * 2,
  );
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.beginPath();
  ctx.arc(c + r * 0.38, c + r * 0.3, r * 0.08, 0, Math.PI * 2);
  ctx.fill();
  return canvas;
}

/** The part of the stage below the HUD where the sheet is laid. */
function playArea(stage: HTMLElement, w: number, h: number) {
  const pad = w < 520 ? 12 : 24;
  const hud = stage.querySelector<HTMLElement>(".pop-hud")?.offsetHeight || 56;
  const top = Math.max(hud + 4, pad);
  return { left: pad, top, w: w - pad * 2, h: Math.max(1, h - top - pad) };
}

function sheetSeed() {
  return Math.floor(Math.random() * 2 ** 31);
}

export function PopGame() {
  const { t } = useLocale();
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audio = useRef<PopAudio | null>(null);
  const state = useRef({
    sheet: null as Sheet | null,
    clock: 0,
    started: 0,
    rollIn: 1,
    particles: [] as Particle[],
    rings: [] as Ring[],
    streak: 0,
    lastPop: -10,
    pointers: new Map<number, { x: number; y: number }>(),
    view: { scale: 1, ox: 0, oy: 0, w: 0, h: 0, dpr: 1 },
    sprites: new Map<string, HTMLCanvasElement>(),
    awakeUntil: 0,
    raf: 0,
    reduced: false,
    finishing: false,
  });
  const [session, setSession] = useState(0);
  const [total, setTotal] = useState(0);
  const [sheets, setSheets] = useState(0);
  const [sound, setSound] = useState(true);
  const [haptics, setHaptics] = useState(true);
  const [canVibrate, setCanVibrate] = useState(false);
  const [calm, setCalm] = useState("");
  const prefs = useRef({ sound: true, haptics: true });

  useEffect(() => {
    setTotal(Number(read(STORE.total)) || 0);
    setSheets(Number(read(STORE.sheets)) || 0);
    const s = read(STORE.sound) !== "off";
    const h = read(STORE.haptics) !== "off";
    setSound(s);
    setHaptics(h);
    prefs.current = { sound: s, haptics: h };
    setCanVibrate(typeof navigator !== "undefined" && "vibrate" in navigator);
    state.current.reduced =
      typeof matchMedia === "function" &&
      matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  const now = () => performance.now() / 1000;

  const wake = useCallback((seconds = 1.2) => {
    const s = state.current;
    s.awakeUntil = Math.max(s.awakeUntil, now() + seconds);
    if (!s.raf) s.raf = requestAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const layout = useCallback(() => {
    const s = state.current;
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    if (!stage || !canvas) return;
    const rect = stage.getBoundingClientRect();
    const w = Math.max(1, rect.width);
    const h = Math.max(1, rect.height);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const area = playArea(stage, w, h);
    if (!s.sheet) {
      const { cols, rows } = fitGrid(area.w, area.h);
      s.sheet = newSheet(
        cols,
        rows,
        sheetSeed(),
        Math.floor(Math.random() * 6),
      );
    }
    const sheet = s.sheet;
    // the plastic sheet extends 0.25 bubble beyond the outer bubbles
    const scale = Math.min(
      area.w / (sheet.width + 0.5),
      area.h / (sheet.height + 0.5),
    );
    s.view = {
      scale,
      ox: area.left + (area.w - sheet.width * scale) / 2,
      oy: area.top + (area.h - sheet.height * scale) / 2,
      w,
      h,
      dpr,
    };
    s.sprites.clear();
    wake(0.1);
  }, [wake]);

  const freshSheet = useCallback(() => {
    const s = state.current;
    const v = s.view;
    const area = stageRef.current
      ? playArea(stageRef.current, v.w, v.h)
      : { w: v.w, h: v.h };
    const { cols, rows } = fitGrid(area.w, area.h);
    s.sheet = newSheet(cols, rows, sheetSeed(), (s.sheet?.palette ?? 0) + 1);
    s.started = s.clock;
    s.rollIn = 0;
    s.finishing = false;
    layout();
    wake(1);
  }, [layout, wake]);

  const burst = useCallback((b: Bubble) => {
    const s = state.current;
    const sheet = s.sheet!;
    const [hue, sat] = THEMES[sheet.palette];
    const count = s.reduced ? 3 : b.golden ? 22 : 7 + Math.min(s.streak, 10);
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = (b.golden ? 3.2 : 1.6) * (0.5 + Math.random());
      s.particles.push({
        x: b.x,
        y: b.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 0.8,
        life: 0,
        max: 0.35 + Math.random() * (b.golden ? 0.7 : 0.35),
        size: 0.04 + Math.random() * (b.golden ? 0.09 : 0.05),
        color: b.golden
          ? `hsl(${40 + Math.random() * 20}, 100%, ${60 + Math.random() * 25}%)`
          : `hsla(${hue + (Math.random() * 30 - 15)}, ${sat}%, ${75 + Math.random() * 20}%, 0.9)`,
        star: b.golden && Math.random() < 0.5,
      });
    }
    s.rings.push({ x: b.x, y: b.y, t: 0, golden: b.golden });
    if (s.particles.length > 600)
      s.particles.splice(0, s.particles.length - 600);
  }, []);

  const afterPops = useCallback(
    (popped: Bubble[]) => {
      if (!popped.length) return;
      const s = state.current;
      const time = now();
      for (const b of popped) {
        s.streak = nextStreak(s.streak, s.lastPop, time);
        s.lastPop = time;
        burst(b);
        if (prefs.current.sound) audio.current?.pop(b.tone, s.streak, b.golden);
      }
      if (prefs.current.haptics && typeof navigator !== "undefined")
        try {
          navigator.vibrate?.(popped.some((b) => b.golden) ? [12, 30, 18] : 8);
        } catch {}
      setSession((n) => n + popped.length);
      setTotal((n) => {
        const next = n + popped.length;
        write(STORE.total, String(next));
        return next;
      });
      const sheet = s.sheet!;
      if (sheet.remaining === 0 && !s.finishing) {
        s.finishing = true;
        setSheets((n) => {
          write(STORE.sheets, String(n + 1));
          return n + 1;
        });
        setCalm(CALM_LINES[Math.floor(Math.random() * CALM_LINES.length)]);
        if (prefs.current.sound) audio.current?.sheetDone();
        window.setTimeout(() => freshSheet(), 1100);
      }
      wake(1.2);
    },
    [burst, freshSheet, wake],
  );

  const toSheet = (e: { clientX: number; clientY: number }) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const v = state.current.view;
    return {
      x: (e.clientX - rect.left - v.ox) / v.scale,
      y: (e.clientY - rect.top - v.oy) / v.scale,
    };
  };

  function frame() {
    const s = state.current;
    s.raf = 0;
    const t = now();
    const dt = Math.min(0.05, s.clock ? t - s.clock : 0.016);
    s.clock = t;
    draw(dt);
    if (
      t < s.awakeUntil ||
      s.particles.length ||
      s.rings.length ||
      s.rollIn < 1
    )
      s.raf = requestAnimationFrame(frame);
  }

  function draw(dt: number) {
    const s = state.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const sheet = s.sheet;
    if (!canvas || !ctx || !sheet) return;
    const v = s.view;
    const [hue, sat, backdrop] = THEMES[sheet.palette];
    ctx.setTransform(v.dpr, 0, 0, v.dpr, 0, 0);
    ctx.fillStyle = backdrop;
    ctx.fillRect(0, 0, v.w, v.h);

    s.rollIn = Math.min(1, s.rollIn + dt / (s.reduced ? 0.2 : 0.55));
    const ease = 1 - Math.pow(1 - s.rollIn, 3);
    const slide = s.reduced ? 0 : (1 - ease) * v.w;
    ctx.globalAlpha = s.reduced ? ease : 1;
    ctx.translate(v.ox + slide, v.oy);
    const k = v.scale;

    // the plastic sheet
    ctx.fillStyle = `hsla(${hue}, ${sat}%, 70%, 0.10)`;
    ctx.strokeStyle = `hsla(${hue}, ${sat}%, 80%, 0.22)`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(
      -k * 0.25,
      -k * 0.25,
      (sheet.width + 0.5) * k,
      (sheet.height + 0.5) * k,
      k * 0.35,
    );
    ctx.fill();
    ctx.stroke();

    const size = k * 0.9;
    const spriteKey = (golden: boolean) =>
      `${sheet.palette}:${golden}:${Math.round(size * v.dpr)}`;
    const sprite = (golden: boolean) => {
      const key = spriteKey(golden);
      let img = s.sprites.get(key);
      if (!img) {
        img = bubbleSprite(hue, sat, golden, size * v.dpr);
        s.sprites.set(key, img);
      }
      return img;
    };
    const elapsed = s.clock - s.started;
    for (const b of sheet.bubbles) {
      const cx = b.x * k;
      const cy = b.y * k;
      if (!b.popped) {
        // a slow, gentle shimmer so the sheet feels alive
        const breathe = s.reduced
          ? 1
          : 1 + Math.sin(elapsed * 1.4 + b.tone * 6.28) * 0.012;
        const scale = breathe;
        const img = sprite(b.golden);
        const d = img.width / v.dpr;
        ctx.drawImage(
          img,
          cx - (d / 2) * scale,
          cy - (d / 2) * scale,
          d * scale,
          d * scale,
        );
        if (b.golden && !s.reduced) {
          ctx.fillStyle = `rgba(255,240,170,${0.25 + 0.25 * Math.sin(elapsed * 4 + b.tone * 9)})`;
          ctx.beginPath();
          ctx.arc(cx + k * 0.18, cy - k * 0.22, k * 0.05, 0, Math.PI * 2);
          ctx.fill();
        }
        continue;
      }
      // popped: a quick swell, then a flattened, crinkled disc
      const age = s.clock - b.poppedAt;
      const swell =
        age < 0.06
          ? 1 + (age / 0.06) * 0.14
          : Math.max(0.86, 1.14 - (age - 0.06) * 2.4);
      const r = k * 0.45 * swell;
      const shade = b.golden
        ? `hsla(45, 70%, 55%,`
        : `hsla(${hue}, ${sat}%, 65%,`;
      ctx.fillStyle = `${shade} 0.16)`;
      ctx.strokeStyle = `${shade} 0.4)`;
      ctx.lineWidth = Math.max(1, k * 0.03);
      ctx.beginPath();
      const lobes = 7;
      for (let i = 0; i <= lobes * 2; i++) {
        const a = (i / (lobes * 2)) * Math.PI * 2 + b.tone * 3;
        const rr = r * (i % 2 ? 0.86 + b.tone * 0.06 : 1);
        if (i === 0) ctx.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
        else ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = `${shade} 0.3)`;
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.4, cy - r * (0.1 + b.tone * 0.3));
      ctx.lineTo(cx + r * 0.1, cy + r * 0.05);
      ctx.lineTo(cx + r * 0.35, cy - r * (0.3 - b.tone * 0.4));
      ctx.stroke();
    }

    // shock rings
    s.rings = s.rings.filter((ring) => (ring.t += dt) < 0.32);
    for (const ring of s.rings) {
      const p = ring.t / 0.32;
      ctx.strokeStyle = ring.golden
        ? `rgba(255,220,120,${1 - p})`
        : `rgba(255,255,255,${0.7 * (1 - p)})`;
      ctx.lineWidth = Math.max(1, k * 0.06 * (1 - p));
      ctx.beginPath();
      ctx.arc(
        ring.x * k,
        ring.y * k,
        k * (0.4 + p * (ring.golden ? 1.4 : 0.55)),
        0,
        Math.PI * 2,
      );
      ctx.stroke();
    }
    // flecks
    s.particles = s.particles.filter((p) => (p.life += dt) < p.max);
    for (const p of s.particles) {
      p.vy += 5 * dt;
      p.vx *= 0.96;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      ctx.globalAlpha = Math.max(0, 1 - p.life / p.max);
      ctx.fillStyle = p.color;
      const px = p.x * k;
      const py = p.y * k;
      const ps = p.size * k;
      ctx.beginPath();
      if (p.star) {
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2 + p.life * 6;
          const rr = i % 2 ? ps * 0.4 : ps * 1.3;
          ctx.lineTo(px + Math.cos(a) * rr, py + Math.sin(a) * rr);
        }
      } else ctx.arc(px, py, ps, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  useEffect(() => {
    audio.current = new PopAudio();
    layout();
    const stage = stageRef.current;
    const observer =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => layout())
        : undefined;
    if (stage) observer?.observe(stage);
    const s = state.current;
    return () => {
      observer?.disconnect();
      if (s.raf) cancelAnimationFrame(s.raf);
      s.raf = 0;
      audio.current?.close();
    };
  }, [layout]);

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.preventDefault();
    audio.current?.wake();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
    const s = state.current;
    const p = toSheet(e);
    s.pointers.set(e.pointerId, p);
    if (s.sheet) afterPops(sweep(s.sheet, p, p, now()));
  }
  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    const s = state.current;
    const last = s.pointers.get(e.pointerId);
    if (!last || !s.sheet) return;
    const p = toSheet(e);
    s.pointers.set(e.pointerId, p);
    afterPops(sweep(s.sheet, last, p, now()));
  }
  function onPointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    state.current.pointers.delete(e.pointerId);
  }
  function onKeyDown(e: React.KeyboardEvent<HTMLCanvasElement>) {
    if (e.key !== " " && e.key !== "Enter") return;
    e.preventDefault();
    audio.current?.wake();
    const s = state.current;
    const b = s.sheet && nextBubble(s.sheet);
    if (b && s.sheet && pop(s.sheet, b, now())) afterPops([b]);
  }

  function toggleSound() {
    const next = !sound;
    setSound(next);
    prefs.current.sound = next;
    write(STORE.sound, next ? "on" : "off");
    if (next) audio.current?.wake();
  }
  function toggleHaptics() {
    const next = !haptics;
    setHaptics(next);
    prefs.current.haptics = next;
    write(STORE.haptics, next ? "on" : "off");
  }

  return (
    <div className="pop-page">
      <div className="pop-heading">
        <div>
          <p className="eyebrow">{t("UNWIND · NO TIMER · NO SCORE")}</p>
          <h1>{t("Bubble Calm")}</h1>
          <p className="lede">
            {t(
              "Press, swipe, pop. A fresh sheet rolls in whenever you finish one.",
            )}
          </p>
        </div>
        <Link href="/">{t("Back to games")}</Link>
      </div>
      <div className="pop-stage" ref={stageRef}>
        <canvas
          ref={canvasRef}
          className="pop-canvas"
          tabIndex={0}
          role="application"
          aria-label={t("Bubble wrap. Press Space or Enter to pop a bubble.")}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onKeyDown={onKeyDown}
          onContextMenu={(e) => e.preventDefault()}
        />
        <div className="pop-hud">
          <div className="pop-stats" aria-label={t("Your pops")}>
            <span>
              <strong>{session}</strong>
              {t("this visit")}
            </span>
            <span>
              <strong>{total}</strong>
              {t("all time")}
            </span>
            <span>
              <strong>{sheets}</strong>
              {t("sheets")}
            </span>
          </div>
          <div className="pop-controls">
            <button type="button" aria-pressed={sound} onClick={toggleSound}>
              {sound ? t("Sound on") : t("Sound off")}
            </button>
            {canVibrate && (
              <button
                type="button"
                aria-pressed={haptics}
                onClick={toggleHaptics}
              >
                {haptics ? t("Buzz on") : t("Buzz off")}
              </button>
            )}
            <button type="button" onClick={freshSheet}>
              {t("Fresh sheet")}
            </button>
          </div>
        </div>
        <p className="pop-calm" role="status" aria-live="polite" key={sheets}>
          {calm ? t(calm) : ""}
        </p>
      </div>
      <p className="pop-hint">
        {t(
          "Tip: drag across the sheet to pop a whole row. Golden bubbles sparkle. Your counts stay on this device only.",
        )}
      </p>
    </div>
  );
}
