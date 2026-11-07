/** Saved progress and synthesised sound shared by Crowd Rush. */
import type { GameEvent } from "@/game/crowd-core";
export const STORE = {
  level: "dingn.crowd.level",
  best: "dingn.crowd.best",
  sound: "dingn.crowd.sound",
};
export const read = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
export const write = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {}
};

/** Synthesised sound effects: no audio files are downloaded. */
export class Sfx {
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
