/* ==========================================================================
   physics.js — Moment of inertia of a bar (compound pendulum).

   The model owns EVERYTHING that is physically true about the apparatus:
     - the rigid-body pendulum   (full sin(theta), light damping, RK4)
     - the digital timer + IR gate (counts beam interruptions, like the real one)
     - the mechanical set-up      (pivot pin, sliding bar, height of the IR gate)
   scene.js only draws `model.state` and forwards the student's mouse actions
   to the methods at the bottom of this file (grabBar, pullPin, moveGate, ...).

   Real-world rules that are enforced here (so parts never "just overlap"):
     - the bar can only be moved once the pivot pin has been pulled out
     - the pin only goes back in when a hole is lined up with it
     - the bar cannot be pushed down through the IR gate, and the IR gate
       cannot be pushed up through the bar
     - the timer only counts when it has been armed with START

   Contract with the rest of the app (same as the template):
     model.update(dt)  model.state  model.setParameter()  model.setMode() ...
   ========================================================================== */

import { clamp } from './utils.js';

/* ------------------------------------------------------------------ constants */
export const G = 9.78;       // the g the simulation really uses (slightly off, like a real lab)
export const G_NOM = 9.8;    // the g students are told to use in their calculations
const PI2 = Math.PI * 2;
export const DEG = Math.PI / 180;

/** Apparatus geometry in metres. Shared with scene.js so both always agree. */
export const GEO = {
  plateTop: 1.12,        // top of the support shelf the pin rests on
  pivotLift: 0.0105,     // pin axis sits this far above the shelf
  barWidth: 0.035,
  barThick: 0.006,
  holePitch: 0.025,      // holes every 2.5 cm
  holeR: 0.004,
  gateX: 0,              // IR beam sits in the plane of the bar, at the mean position
  gateMin: 0.18,         // lowest the gate can be clamped
  gateClear: 0.003,      // gap that stops the gate touching the bar
  pinR: 0.0038,          // shaft radius, with clearance inside the 4 mm hole
  pinTravel: 0.08,       // how far the pin pulls out towards the student
  pinClear: 0.45,        // pin fraction at which the pin tip has left the bar
  shelfThickness: 0.008,
  slotLeft: -0.080,
  slotStraightEnd: 0.063,
  slotSafety: 0.002
};
GEO.pivotY = GEO.plateTop + GEO.pivotLift;
// At the lower face of the shelf, the tilted bar must still fit the straight
// part of the L-slot: drop*tan(theta) + halfWidth/cos(theta) <= clearance.
const slotClearance = Math.min(-GEO.slotLeft, GEO.slotStraightEnd) - GEO.slotSafety;
const shelfDrop = GEO.pivotLift + GEO.shelfThickness;
GEO.maxDragAngle = Math.floor((Math.acos((GEO.barWidth / 2) / Math.hypot(slotClearance, shelfDrop)) - Math.atan2(shelfDrop, slotClearance)) / DEG * 2) / 2 * DEG;

/* ------------------------------------------------------------------ helpers */
function gauss() {
  let u = 0, v = 0;
  while (!u) u = Math.random();
  while (!v) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(PI2 * v);
}
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const SESSION_SEED = (Math.random() * 2147483647) | 0;
/** Drilling / edge error that is fixed for the whole session (sigma ~0.4 mm). */
function fixedError(key, sigma) {
  const r = mulberry32(SESSION_SEED + Math.round(key * 1000) * 7919);
  return ((r() + r() + r() + r()) - 2) * 1.2247 * sigma;
}
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const phase = (q, a, b) => clamp((q - a) / (b - a), 0, 1);
const lerp = (a, b, t) => a + (b - a) * t;

/** The numbers the Calculation / Results panels derive from one recorded reading. */
export function calcFromReading(r) {
  if (!r) return null;
  const T = r.t / r.N;
  const Iexp = (r.m * G_NOM * r.l * T * T) / (4 * Math.PI * Math.PI);
  const Ith = (r.m * r.L * r.L) / 12 + r.m * r.l * r.l;
  return { T, Iexp, Ith, err: (Math.abs(Iexp - Ith) / Ith) * 100 };
}

/* ==========================================================================
   Digital timer with IR gate
   Starts on the first interruption of the beam, stops after 2N further
   interruptions (the bar cuts the beam twice per oscillation).
   ========================================================================== */
export class IRTimer {
  constructor() { this.N = 10; this.reset(); }
  reset() { this.state = 'idle'; this.value = 0; this.ev = 0; this.t0 = 0; }
  setN(n) { this.N = clamp(Math.round(n), 1, 40); if (this.state !== 'idle') this.reset(); }
  /** START button: idle -> armed -> idle (toggle), done -> armed. */
  start() {
    if (this.state === 'idle') this.state = 'armed';
    else if (this.state === 'armed') this.state = 'idle';
    else if (this.state === 'done') { this.reset(); this.state = 'armed'; }
  }
  event(t) {
    if (this.state === 'armed') {
      this.state = 'running'; this.t0 = t + gauss() * 0.0004; this.ev = 0; this.value = 0;
    } else if (this.state === 'running') {
      this.ev += 1;
      if (this.ev >= 2 * this.N) {
        this.value = Math.max(0, t + gauss() * 0.0004 - this.t0);
        this.value = Math.round(this.value * 1000) / 1000;
        this.state = 'done';
        if (this.onDone) this.onDone();
      }
    }
  }
  tick(now) {
    if (this.state === 'running') this.value = Math.max(0, Math.round((now - this.t0) * 1000) / 1000);
  }
  get count() { return this.state === 'idle' || this.state === 'armed' ? 0 : Math.min(this.N, Math.floor(this.ev / 2)); }
  get done() { return this.state === 'done'; }
}

/* ==========================================================================
   The experiment model
   ========================================================================== */
export class ExperimentModel {
  static HISTORY_SECONDS = 10;
  static HISTORY_INTERVAL = 0.015;
  static MAX_READINGS = 12;

  constructor({ variables = [], toggles = [] } = {}) {
    this.defs = Object.fromEntries(variables.map((v) => [v.name, v]));
    this.parameters = Object.fromEntries(variables.map((v) => [v.name, v.value]));
    this.toggles = Object.fromEntries(toggles.map((t) => [t.id, t.checked ?? true]));
    this.readings = [];
    this.onMessage = null;   // (text, 'ok' | 'warn' | '') -> set by app.js (toast in the viewport)
    this.onSync = null;      // (name, value)            -> set by app.js (moves a slider)
    this._msgAt = {};
    this.timer = new IRTimer();
    this.timer.onDone = () => this.notify(`Timer stopped — t = ${this.timer.value.toFixed(3)} s for N = ${this.timer.N}`, 'ok');

    /* mechanical set-up */
    this.L = this.parameters.L;
    this.l = this.parameters.l;                 // hole the bar is hung from (distance from CG)
    this.sP = this.L / 2 - this.l;              // pivot position measured from the bar's top end
    this.sPvis = this.sP;                       // where the bar actually is on the pin right now
    this.pinOut = 0;                            // 0 = pin in the hole, 1 = fully pulled out
    this.pinTarget = 0;
    this.free = false;                          // pin withdrawn: the bar can be slid by hand
    this.lift = 0;                              // bar lifted off the shelf during the automatic re-hang
    this.anim = null;                           // automatic re-hang animation
    this.pendingL = null;
    this.gateY = 0.5;                           // top of the gate's base (bridge)
    this.gateTween = null;
    this.snap = null;
    this.press = { id: 0, action: '' };         // last timer button pressed (for the 3-D button animation)
    this.computePhysics();
    this.reset();
    this.gateY = this.gateTarget();
  }

  /* ------------------------------------------------------------------------
     Generic lifecycle (same shape as the template)
     ------------------------------------------------------------------------ */

  /** Reset button: bar to rest, timer cleared, pin back in. Recorded readings are kept. */
  reset() {
    this.time = 0; this.simTime = 0;
    this.theta = 0; this.omega = 0; this.dragging = false; this.holding = false; this.braking = false;
    this.paused = false;
    this.history = []; this.lastHistoryTime = -Infinity;
    this.gateBlocked = false; this.gateAligned = false;
    this.timer.reset();
    this.anim = null; this.pendingL = null; this.snap = null; this.lift = 0;
    // a withdrawn pin that is lined up with a hole goes back in; otherwise leave the bar free
    if (this.free && this.holeAligned()) this.commitHang();
    if (!this.free) { this.pinOut = 0; this.pinTarget = 0; this.sPvis = this.sP; this.syncHoleControls(this.sP); }
    this.computeOutputs();
  }

  /** Release the angle preview, or use the selected release angle. */
  start() {
    if (!this.canSwing(true)) return;
    this.paused = false; this.braking = false;
    this.theta = this.holding ? this.theta : this.parameters.angle * DEG;
    this.omega = 0; this.dragging = false; this.holding = false;
    if (this.timer.state === 'idle') this.notify('Tip: press START on the timer to arm it before releasing the bar.', 'warn');
  }

  togglePause() { this.paused = !this.paused; }
  toggleRun() { this.togglePause(); }
  pause() { this.paused = true; }

  setToggle(id, enabled) { this.toggles[id] = enabled; }

  /** Clamp to the slider range, store, apply, and return the value actually used. */
  setParameter(name, value) {
    if (!Number.isFinite(Number(value))) return this.parameters[name];
    if (name === 'cg') return this.L / 2;
    if (name === 'slide' || name === 'l') {
      const hole = this.nearestHole(name === 'slide' ? Number(value) : this.L / 2 - Number(value));
      this.syncHoleControls(hole);
      if (this.free) {
        this.snap = null; this.sPvis = hole; this.clearGateForBar();
      } else this.rehang(this.parameters.l);
      this.computeOutputs();
      return this.parameters[name];
    }
    if (name === 'gateY') { this.moveGate(Number(value)); this.computeOutputs(); return this.gateY; }
    if (name === 'pin') { const applied = this.setPin(Number(value)); this.computeOutputs(); return applied; }
    let next = Number(value);
    if (!Number.isFinite(next)) return this.parameters[name];
    const def = this.defs[name];
    if (def) next = clamp(next, def.min, def.max);
    if (name === 'L' && def) next = Number((Math.round(next / def.step) * def.step).toFixed(6));

    if (name === 'L' || name === 'angle') {
      if (this.free || this.anim) {
        this.notify(this.free ? 'Push the pivot pin back in before changing the set-up.' : 'Wait — the bar is being re-hung.', 'warn');
        return this.parameters[name];
      }
    }
    if (name === 'N') next = Math.round(next);
    if (name === 'l') next = this.snapL(next);
    this.parameters[name] = next;
    this.onParameterChanged(name);
    this.computeOutputs();
    return next;
  }

  onParameterChanged(name) {
    switch (name) {
      case 'L': {
        const L = this.parameters.L;
        this.stopPendulum(true); this.timer.reset();
        this.L = L;
        const l = this.snapL(this.parameters.l);
        if (l !== this.parameters.l) { this.parameters.l = l; this.sync('l', l); }
        this.l = l; this.sP = L / 2 - l; this.sPvis = this.sP;
        this.syncHoleControls(this.sP);
        this.computePhysics();
        this.alignGate(false);
        break;
      }
      case 'm': this.timer.reset(); this.computePhysics(); break;
      case 'l': this.rehang(this.parameters.l); break;
      case 'N': this.timer.setN(this.parameters.N); break;
      case 'angle':
        this.theta = this.parameters.angle * DEG; this.omega = 0;
        this.holding = this.theta !== 0; this.dragging = false;
        this.braking = false; this.paused = false;
        if (this.timer.state === 'running' || this.timer.done) this.timer.reset();
        this.gateBlocked = this.blockedAt(this.theta);
        break;
      default: break;
    }
  }

  /** Called every frame with a fixed dt (real seconds). */
  update(dt) {
    this.stepApparatus(dt);
    if (!this.paused) this.simulate(Math.min(dt, 0.05) * (this.parameters.speed ?? 1));
    this.computeOutputs();
  }

  /** Snapshot consumed by the UI + scene. */
  get state() {
    const swinging = !this.holding && !this.dragging && !this.isAtRest();
    return {
      time: this.time,
      running: !this.paused && swinging,
      paused: this.paused,
      complete: this.timer.done,
      canStart: !swinging && !this.dragging && !this.free && !this.anim && this.l > 0 && this.parameters.angle > 0,
      canPause: swinging || this.paused,
      parameters: { ...this.parameters },
      toggles: { ...this.toggles },
      values: this.values,
      history: this.history,
      readings: this.readings
    };
  }

  /* ------------------------------------------------------------------------
     Physics
     ------------------------------------------------------------------------ */

  holeList() {            // distances of the holes from the bar's top end
    const out = [], L = this.L, sp = GEO.holePitch;
    const K = Math.floor((L / 2 - 0.0125 + 1e-9) / sp);
    for (let k = -K; k <= K; k++) out.push(L / 2 + k * sp);
    return out;
  }
  nearestHole(s) {
    return this.holeList().reduce((best, hole) => Math.abs(hole - s) < Math.abs(best - s) - 1e-10 ? hole : best);
  }
  lMax() { return this.L / 2 - this.holeList()[0]; }
  lMin() { return -this.lMax(); }
  snapL(l) { return Number((this.L / 2 - this.nearestHole(this.L / 2 - l)).toFixed(6)); }
  syncHoleControls(hole) {
    this.parameters.slide = Number(hole.toFixed(6));
    this.parameters.l = Number((this.L / 2 - hole).toFixed(6));
    this.sync('slide', this.parameters.slide); this.sync('l', this.parameters.l);
  }
  clearGateForBar() {
    this.gateTween = null;
    this.gateY = Math.max(GEO.gateMin, Math.min(this.gateY, this.gateMax()));
  }
  sOfL(l) { return this.L / 2 - l; }
  get barBottomDrop() { return this.L - this.sPvis; }   // distance from pin axis to the bar's lower end

  computePhysics() {
    const L = this.L, m = this.parameters.m, w = GEO.barWidth;
    const M = m, sCG = L / 2, Icg = (m * (L * L + w * w)) / 12;
    const delta = fixedError(this.sP, 0.0004);
    const hh = this.l === 0 ? 0 : sCG - (this.sP + delta);
    this.M = M; this.Icg = Icg; this.hh = hh;
    this.Ip = Icg + M * hh * hh;
    this.k = (M * G * hh) / this.Ip;                     // omega0^2 of the small-angle motion
    this.gamma = 0.012;
  }

  isAtRest() { return !this.dragging && Math.abs(this.theta) < 1e-3 && Math.abs(this.omega) < 1e-3; }

  stepBar(dt) {
    if (!this.dragging && Math.abs(this.theta) < 2e-6 && Math.abs(this.omega) < 2e-6) {
      this.theta = this.omega = 0; this.braking = false; return false;
    }
    const g = this.gamma + (this.braking ? 3.2 : 0), k = this.k;
    const f = (th, om) => -k * Math.sin(th) - g * om;
    const t = this.theta, w = this.omega;
    const k1t = w, k1w = f(t, w);
    const k2t = w + 0.5 * dt * k1w, k2w = f(t + 0.5 * dt * k1t, w + 0.5 * dt * k1w);
    const k3t = w + 0.5 * dt * k2w, k3w = f(t + 0.5 * dt * k2t, w + 0.5 * dt * k2w);
    const k4t = w + dt * k3w, k4w = f(t + dt * k3t, w + dt * k3w);
    this.theta = t + (dt / 6) * (k1t + 2 * k2t + 2 * k3t + k4t);
    this.omega = w + (dt / 6) * (k1w + 2 * k2w + 2 * k3w + k4w);
    if (this.braking && Math.abs(this.theta) < 0.003 && Math.abs(this.omega) < 0.01) { this.theta = this.omega = 0; this.braking = false; }
    return true;
  }

  /** Does the bar (hanging at angle th) cut the IR beam? Rectangle test in the bar's own frame. */
  blockedAt(th, gx = GEO.gateX, by = this.beamY) {
    const rx = gx, ry = by - GEO.pivotY, s = Math.sin(th), c = Math.cos(th);
    const u = rx * s - ry * c, v = rx * c + ry * s;
    return u >= -this.sP && u <= this.L - this.sP && Math.abs(v) <= GEO.barWidth / 2;
  }
  get beamY() { return this.gateY + 0.03; }
  get barBottomY() { return GEO.pivotY + this.lift - this.barBottomDrop; }
  /** Height the gate must be at so the beam crosses the lower end of the bar. */
  gateTarget() { return GEO.pivotY - (this.L - this.sP) - 0.018; }
  /** Highest the gate can go before it touches the bar. */
  gateMax() { return this.barBottomY - GEO.gateClear; }

  /** Advance the pendulum + timer by dtSim seconds of *simulated* time (sub-stepped so the beam is never missed). */
  simulate(dtSim) {
    const n = clamp(Math.ceil(dtSim / 0.0005), 1, 8000), hs = dtSim / n;
    const movable = !this.anim && !this.free && this.l > 0;
    for (let i = 0; i < n; i++) {
      if (!this.dragging && !this.holding && movable) {
        const th0 = this.theta;
        if (this.stepBar(hs)) {
          const b1 = this.blockedAt(this.theta);
          if (!this.gateBlocked && b1) {          // beam just got interrupted: bisect for the exact instant
            let lo = 0, hi = 1;
            for (let j = 0; j < 8; j++) { const mid = (lo + hi) / 2; if (this.blockedAt(th0 + (this.theta - th0) * mid)) hi = mid; else lo = mid; }
            this.timer.event(this.simTime + hi * hs);
          }
          this.gateBlocked = b1;
        }
      }
      this.simTime += hs; this.time = this.simTime;
      this.sample();
    }
    this.timer.tick(this.simTime);
    this.gateBlocked = this.blockedAt(this.theta);
    this.gateAligned = this.blockedAt(0);
  }

  sample() {
    if (this.simTime - this.lastHistoryTime < ExperimentModel.HISTORY_INTERVAL && this.history.length) return;
    this.history.push({ time: this.simTime, angle: this.theta / DEG, omega: this.omega });
    this.lastHistoryTime = this.simTime;
    while (this.history.length && this.simTime - this.history[0].time > ExperimentModel.HISTORY_SECONDS) this.history.shift();
  }

  computeOutputs() {
    const tm = this.timer;
    this.values = {
      L: this.L, m: this.parameters.m, l: this.l, targetL: this.parameters.l, N: tm.N,
      theta: this.theta, omega: this.omega, angle: this.theta / DEG,
      sPvis: this.sPvis, pinOut: this.pinOut, free: this.free, lift: this.lift, busy: !!this.anim,
      gateY: this.gateY, beamY: this.beamY, gateBlocked: this.gateBlocked, gateAligned: this.gateAligned,
      barBottomY: this.barBottomY, swinging: !this.holding && !this.dragging && !this.isAtRest(), holding: this.holding || this.dragging,
      timerState: tm.state, timerValue: tm.value, timerCount: tm.count, timerN: tm.N,
      press: this.press, holeAligned: this.holeAligned(), period: this.timer.done ? tm.value / tm.N : null,
      theoryPeriod: this.k > 0 ? PI2 / Math.sqrt(this.k) : null
    };
  }

  notify(text, kind = '') {
    const now = performance.now();
    if (this._msgAt[text] && now - this._msgAt[text] < 1800) return;   // do not spam the toast
    this._msgAt[text] = now;
    if (this.onMessage) this.onMessage(text, kind);
  }
  sync(name, value) { if (this.onSync) this.onSync(name, value); }

  /* ------------------------------------------------------------------------
     Apparatus mechanics (all in real time, independent of the speed slider)
     ------------------------------------------------------------------------ */

  stepApparatus(dt) {
    /* automatic re-hang (slider): pin out, lift, slide, lower, pin in */
    if (this.anim) {
      const a = this.anim; a.t += dt; const q = Math.min(1, a.t / a.dur);
      this.pinOut = ease(phase(q, 0, 0.17)) - ease(phase(q, 0.86, 1));
      this.lift = 0.34 * ease(phase(q, 0.17, 0.44)) - 0.34 * ease(phase(q, 0.7, 0.88));
      this.sPvis = lerp(a.sp0, a.sp1, ease(phase(q, 0.44, 0.7)));
      // the gate backs away from the bar so the two never overlap while it is being lowered
      this.gateY = Math.min(this.gateY, this.gateMax() - 0.012);
      if (q >= 1) {
        this.anim = null; this.lift = 0; this.pinOut = 0; this.pinTarget = 0;
        this.l = a.newL; this.sP = a.sp1; this.sPvis = a.sp1;
        this.computePhysics(); this.timer.reset();
        this.alignGate(false);
        if (this.pendingL != null && Math.abs(this.pendingL - this.l) > 1e-9) { const p = this.pendingL; this.pendingL = null; this.rehang(p); }
        else this.pendingL = null;
      }
    }
    /* the student's pin: eases towards its target when released */
    if (!this.anim && Math.abs(this.pinOut - this.pinTarget) > 1e-4) {
      const step = 3.2 * dt, d = this.pinTarget - this.pinOut;
      this.setPin(this.pinOut + clamp(d, -step, step), false);
      if (Math.abs(this.pinTarget - this.pinOut) < 1e-3) this.pinOut = this.pinTarget;
    }
    /* bar snapping into the nearest hole after being slid */
    if (this.snap) {
      const s = this.snap; s.t += dt; const q = Math.min(1, s.t / 0.16);
      this.sPvis = lerp(s.from, s.to, ease(q)); this.clearGateForBar();
      if (q >= 1) { this.sPvis = s.to; this.snap = null; this.notify('Hole lined up with the pin — push the pin back in.', 'ok'); }
    }
    /* gate gliding to the auto-aligned height */
    if (this.gateTween) {
      const g = this.gateTween; g.t += dt; const q = Math.min(1, g.t / 0.7);
      this.gateY = lerp(g.y0, Math.min(g.y1, this.gateMax()), ease(q));
      if (q >= 1) this.gateTween = null;
    }
  }

  /** Slider / hole choice: a "lab assistant" lifts the bar off, slides it and hangs it on the new hole. */
  rehang(newL) {
    newL = this.snapL(newL);
    if (this.anim) { this.pendingL = newL; return; }
    if (Math.abs(newL - this.l) < 1e-9) return;
    this.stopPendulum(true); this.timer.reset(); this.gateTween = null;
    this.anim = { t: 0, dur: 1.5, sp0: this.sP, sp1: this.sOfL(newL), newL };
    this.l = newL; this.sP = this.anim.sp1;      // physics of the NEW hole (the bar is not swinging while it is moved)
    this.computePhysics();
  }

  alignGate(instant) {
    const y1 = this.gateTarget();
    this.gateTween = null;
    if (instant) { this.gateY = Math.min(y1, this.gateMax()); return; }
    this.gateTween = { t: 0, y0: this.gateY, y1 };
  }

  stopPendulum(instant = false) {
    if (instant) { this.theta = this.omega = 0; this.braking = false; this.dragging = false; this.holding = false; this.paused = false; }
    else this.braking = true;
  }

  canSwing(warn = false) {
    if (this.anim) { if (warn) this.notify('Wait — the bar is being re-hung.', 'warn'); return false; }
    if (this.free) { if (warn) this.notify('The pivot pin is out. Push it back in first.', 'warn'); return false; }
    if (this.l <= 0) { if (warn) this.notify('For oscillations, select a pivot hole above the centre of gravity.', 'warn'); return false; }
    return true;
  }

  /* ---------------- timer buttons (3-D buttons and side-panel buttons) ---------------- */
  timerPress(action) {
    this.press = { id: this.press.id + 1, action };
    if (action === 'start') this.timer.start();
    else if (action === 'reset') this.timer.reset();
    else if (action === 'nplus') this.nudgeN(1);
    else if (action === 'nminus') this.nudgeN(-1);
    this.computeOutputs();
  }
  nudgeN(d) {
    const n = clamp(this.parameters.N + d, this.defs.N?.min ?? 1, this.defs.N?.max ?? 20);
    this.parameters.N = n; this.timer.setN(n); this.sync('N', n);
  }

  /* ---------------- grabbing the bar and swinging it by hand ---------------- */
  grabBar(theta) {
    if (!this.canSwing(true)) return false;
    this.dragging = true; this.holding = false; this.braking = false; this.omega = 0; this.paused = false;
    this.theta = clamp(theta, -GEO.maxDragAngle, GEO.maxDragAngle);
    this.parameters.angle = Math.abs(this.theta / DEG); this.sync('angle', this.parameters.angle);
    this.gateBlocked = this.blockedAt(this.theta);
    return true;
  }
  letGoBar() { this.dragging = false; this.holding = false; this.omega = 0; if (Math.abs(this.theta) < 0.002) this.theta = 0; }

  /* ---------------- IR gate: slide it up / down its clamp ---------------- */
  moveGate(y) {
    this.gateTween = null;
    const max = this.gateMax();
    if (y > max) { this.notify('The IR gate is touching the bar — it cannot go any higher.', 'warn'); y = max; }
    this.gateY = clamp(y, GEO.gateMin, Math.max(GEO.gateMin, max));
  }

  /* ---------------- pivot pin: pull out / push in ---------------- */
  holeAligned() {
    const sp = GEO.holePitch, k = Math.round((this.L / 2 - this.sPvis) / sp);
    return Math.abs(this.sPvis - (this.L / 2 - k * sp)) < 0.0015;
  }
  /** Set the pin position (0 = in, 1 = out) obeying the real-world rules. Returns the value used. */
  setPin(a, userDrag = true) {
    if (this.anim) return this.pinOut;
    a = clamp(a, 0, 1);
    if (!this.free) {
      // pin is in the hole: it may only be withdrawn while the bar hangs still
      if (a > 0.02 && !this.isAtRest()) { this.notify('Stop the bar first — then pull the pin.', 'warn'); this.pinTarget = this.pinOut; return this.pinOut; }
      if (a >= GEO.pinClear) { this.free = true; this.stopPendulum(true); this.timer.reset(); this.notify('Pin is out — the bar is free. Drag it up/down to line another hole up with the pin.', 'ok'); }
    } else if (a < GEO.pinClear) {
      // pushing it back in: only possible with a hole lined up
      if (!this.holeAligned() || this.snap) {
        a = GEO.pinClear; this.pinTarget = a;
        this.notify('The pin is blocked by the bar — line a hole up with the pin first.', 'warn');
      } else {
        this.commitHang();
      }
    }
    this.pinOut = a;
    if (userDrag) this.pinTarget = a;
    return a;
  }
  /** Pin is back in a hole: the bar now hangs from it. */
  commitHang() {
    const sp = GEO.holePitch, k = Math.round((this.L / 2 - this.sPvis) / sp);
    this.free = false;
    this.l = k * sp; this.sP = this.L / 2 - this.l; this.sPvis = this.sP;
    this.syncHoleControls(this.sP);
    this.computePhysics(); this.theta = this.omega = 0; this.timer.reset(); this.alignGate(false);
    this.notify(`Bar hung from the hole l = ${this.l.toFixed(3)} m. Check that the IR beam crosses the lower end of the bar.`, 'ok');
  }
  pinTo(target) { this.pinTarget = clamp(target, 0, 1); }

  /* ---------------- sliding the (free) bar along the shelf slot ---------------- */
  slideBar(sP) {
    if (!this.free) return;
    this.snap = null;
    const holes = this.holeList();
    this.sPvis = clamp(sP, holes[0], holes[holes.length - 1]);
    this.clearGateForBar();
    this.syncHoleControls(this.nearestHole(this.sPvis));
  }
  /** Settle on the closest drilled hole, including both end holes. */
  settleBar() {
    if (!this.free) return;
    const best = this.nearestHole(this.sPvis);
    this.syncHoleControls(best);
    if (Math.abs(best - this.sPvis) < 1e-5) { this.sPvis = best; return; }
    this.snap = { t: 0, from: this.sPvis, to: best };
  }

  /* ---------------- observation table ---------------- */
  recordReading() {
    if (!this.timer.done) { this.notify('Run the timer first — arm it with START, then release the bar.', 'warn'); return false; }
    const tm = this.timer;
    this.readings.push({ time: this.simTime, m: this.parameters.m, L: this.L, l: this.l, N: tm.N, t: tm.value });
    if (this.readings.length > ExperimentModel.MAX_READINGS) this.readings.shift();
    this.notify('Reading recorded in the Observation table.', 'ok');
    return true;
  }
  clearReadings() { this.readings.length = 0; }
}
