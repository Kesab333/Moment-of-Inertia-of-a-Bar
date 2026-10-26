/* ==========================================================================
   scene.js — the 3-D bench for Experiment 7 (Three.js).

   What you see (matches the reference picture):
     - a pale-blue plastered wall, tiled floor, skirting, conduit + wall socket
     - a wooden-top steel bench (left) with the digital timer, steel balls,
       a marker pen and a small key
     - a retort-style stand (right) that carries the bar-pendulum support
       and, lower down, the U-shaped IR gate
     - exactly TWO cables on the timer:  DC power  ->  wall socket
                                         IR sensor -> IR gate

   Nothing here decides physics. The scene draws `model.state` and turns mouse /
   touch actions into calls on the model (grabBar, setPin, slideBar, moveGate,
   timerPress). The model enforces the real-world rules, e.g. the gate cannot
   pass through the bar.

   Camera: one fixed "bench view". Orbit is limited to a few degrees and zoom
   is limited, so the whole room is never shown.
   ========================================================================== */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { clamp } from './utils.js';
import { GEO, DEG } from './physics.js';

const PI2 = Math.PI * 2;

/* ------------------------------------------------------------------ layout (metres) */
const WALL_Z = -0.45;
const POLE = { x: 0.27, z: -0.046, h: 1.62 };
const BENCH = { cx: -0.98, cz: 0.08, w: 1.12, d: 0.6, top: 0.78 };
const TIMER = { w: 0.46, h: 0.24, d: 0.19, x: -1.22, z: 0.1, yaw: 0.42, foot: 0.014 };
TIMER.y = BENCH.top + TIMER.foot + TIMER.h / 2;
const SOCKET = { x: -0.07, y: 0.27 };
// Keep the apparatus close to the wall so the support is a compact bracket.
const APPARATUS_Z = -0.30;
const BRACKET_Z = APPARATUS_Z - 0.05;

/* ------------------------------------------------------------------ tiny helpers */
function cvs(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); return c; }
function mkTex(c, o = {}) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (o.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(o.repeat[0], o.repeat[1]); }
  return t;
}
function box(w, h, d, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; return m;
}
function roundedBox(w, h, d, radius, mat, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 4, radius), mat);
  mesh.position.set(x, y, z); mesh.castShadow = mesh.receiveShadow = true;
  return mesh;
}
function cyl(rt, rb, h, mat, seg = 20) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
  m.castShadow = m.receiveShadow = true; return m;
}
/** cylinder whose axis is along +x / +z (cylinders are built along y) */
function cylX(r, len, mat, seg = 14) { const m = cyl(r, r, len, mat, seg); m.rotation.z = Math.PI / 2; return m; }
function cylZ(r, len, mat, seg = 14) { const m = cyl(r, r, len, mat, seg); m.rotation.x = Math.PI / 2; return m; }
const lerp = (a, b, t) => a + (b - a) * t;

/* ------------------------------------------------------------------ materials */
const MAT = {};
function makeMaterials() {
  const S = THREE.MeshStandardMaterial;
  MAT.steel = new S({ color: 0xaab4bb, metalness: 0.85, roughness: 0.38 });
  MAT.chrome = new S({ color: 0xe6ebef, metalness: 1, roughness: 0.14 });
  MAT.frame = new S({ color: 0x8c949a, metalness: 0.7, roughness: 0.46 });
  MAT.dark = new S({ color: 0x17191b, metalness: 0.5, roughness: 0.55 });
  MAT.iron = new S({ color: 0x2a2d30, metalness: 0.55, roughness: 0.6 });
  MAT.black = new S({ color: 0x0d0e0f, metalness: 0.2, roughness: 0.6 });
  MAT.rubber = new S({ color: 0x141414, metalness: 0, roughness: 0.95 });
  MAT.cable = new S({ color: 0x0b0b0c, metalness: 0.1, roughness: 0.55 });
  MAT.cableGrey = new S({ color: 0x2a2c2e, metalness: 0.1, roughness: 0.6 });
  MAT.brass = new S({ color: 0xc89b3c, metalness: 0.9, roughness: 0.3 });
  MAT.white = new S({ color: 0xe9ecee, metalness: 0, roughness: 0.5 });
  MAT.plug = new S({ color: 0x1c1d1f, metalness: 0.1, roughness: 0.45 });
  MAT.conduit = new S({ color: 0xaeb4b8, metalness: 0.35, roughness: 0.5 });
  MAT.skirt = new S({ color: 0xc9cfd1, metalness: 0, roughness: 0.8 });
  MAT.timerCase = new S({ color: 0x263641, metalness: 0.15, roughness: 0.48 });
  MAT.timerPanel = new S({ color: 0xdce5e5, metalness: 0.12, roughness: 0.5 });
  MAT.glass = new S({ color: 0x050607, metalness: 0.3, roughness: 0.25 });
  MAT.timerStart = new S({ color: 0x117e70, metalness: 0.05, roughness: 0.42 });
  MAT.timerReset = new S({ color: 0xd3664b, metalness: 0.05, roughness: 0.48 });
  MAT.timerAdjust = new S({ color: 0x42586b, metalness: 0.12, roughness: 0.45 });
  MAT.knob = new S({ color: 0x9aa1a6, metalness: 0.6, roughness: 0.35 });
  MAT.knobRed = new S({ color: 0xc9473a, metalness: 0.25, roughness: 0.4 });
  MAT.ghost = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });

  const wood = cvs(256, 256, (x, w, h) => {
    x.fillStyle = '#c29a66'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 90; i++) {
      x.strokeStyle = `rgba(${100 + Math.random() * 40},${62 + Math.random() * 30},28,${0.08 + Math.random() * 0.18})`;
      x.lineWidth = 0.6 + Math.random() * 2; x.beginPath();
      const y = Math.random() * h; x.moveTo(0, y);
      x.bezierCurveTo(w * 0.3, y + Math.random() * 6 - 3, w * 0.7, y + Math.random() * 6 - 3, w, y + Math.random() * 4 - 2); x.stroke();
    }
  });
  MAT.woodTop = new S({ map: mkTex(wood, { repeat: [3, 1] }), metalness: 0, roughness: 0.5, color: 0xe0cba9 });

  const wall = cvs(2048, 700, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#cfe4ee'); g.addColorStop(1, '#bcd8e5');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 26000; i++) {   // plaster grain
      x.fillStyle = `rgba(${Math.random() < 0.5 ? 255 : 40},${Math.random() < 0.5 ? 255 : 70},${Math.random() < 0.5 ? 255 : 80},${Math.random() * 0.05})`;
      x.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 4, 2 + Math.random() * 4);
    }
  });
  MAT.wall = new S({ map: mkTex(wall), metalness: 0, roughness: 0.95 });

  const floor = cvs(512, 512, (x, w, h) => {
    x.fillStyle = '#e4e7e6'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 5200; i++) {   // terrazzo speckle
      const d = Math.random();
      x.fillStyle = d < 0.5 ? `rgba(120,126,128,${Math.random() * 0.22})` : `rgba(255,255,255,${Math.random() * 0.3})`;
      x.beginPath(); x.arc(Math.random() * w, Math.random() * h, 0.6 + Math.random() * 2.2, 0, PI2); x.fill();
    }
    x.strokeStyle = '#a9aeb0'; x.lineWidth = 5; x.strokeRect(0, 0, w, h);
  });
  MAT.floor = new S({ map: mkTex(floor, { repeat: [20, 10] }), metalness: 0, roughness: 0.5 });
}

function envTexture() {
  return cvs(1024, 512, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#e8f3f9'); g.addColorStop(0.5, '#a9c0cb'); g.addColorStop(0.52, '#6a7880'); g.addColorStop(1, '#343b40');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    x.fillStyle = '#fff';
    [[120, 70, 200, 90], [520, 50, 260, 70], [820, 90, 150, 110], [300, 230, 120, 40]].forEach((r) => { x.globalAlpha = 0.95; x.fillRect(...r); });
  });
}

/* ------------------------------------------------------------------ seven-segment timer face */
const SEG = { 0: 'abcdef', 1: 'bc', 2: 'abdeg', 3: 'abcdg', 4: 'bcfg', 5: 'acdfg', 6: 'acdefg', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg', '-': 'g', ' ': '' };
function draw7(ctx, ch, x, y, w, hh, on, off) {
  const t = w * 0.17, hv = hh / 2 - t * 1.15;
  const s = {
    a: [x + t * 0.9, y, w - 1.8 * t, t], g: [x + t * 0.9, y + hh / 2 - t / 2, w - 1.8 * t, t], d: [x + t * 0.9, y + hh - t, w - 1.8 * t, t],
    f: [x, y + t * 0.9, t, hv], b: [x + w - t, y + t * 0.9, t, hv], e: [x, y + hh / 2 + t * 0.25, t, hv], c: [x + w - t, y + hh / 2 + t * 0.25, t, hv]
  };
  const act = SEG[ch] || '';
  for (const k in s) { ctx.fillStyle = act.includes(k) ? on : off; ctx.fillRect(...s[k]); }
}
function drawTimerFace(ctx, W, H, s) {
  ctx.save(); ctx.scale(W / 480, H / 200);
  const bg = ctx.createLinearGradient(0, 0, 0, 200);
  bg.addColorStop(0, '#162b32'); bg.addColorStop(1, '#08151c');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, 480, 200);
  const on = '#82f6de', off = 'rgba(130,246,222,0.055)';
  const FONT = 'Nunito, system-ui, sans-serif';
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#a6c1c7'; ctx.font = `800 12px ${FONT}`;
  ctx.fillText('PRECISION TIMER', 24, 23);
  ctx.textAlign = 'right'; ctx.fillStyle = '#688e99';
  ctx.fillText('IR / OSCILLATION', 456, 23); ctx.textAlign = 'left';
  const str = clamp(s.value, 0, 999.999).toFixed(3).padStart(7, '0').replace('.', '');
  const dw = 44, dh = 82, step = 59, x0 = 24, y0 = 41;
  ctx.shadowColor = 'rgba(80,235,205,.3)'; ctx.shadowBlur = 5;
  for (let i = 0; i < 6; i++) draw7(ctx, str[i], x0 + i * step + (i >= 3 ? 12 : 0), y0, dw, dh, on, off);
  ctx.fillStyle = on; ctx.beginPath(); ctx.arc(193, 118, 4, 0, PI2); ctx.fill();
  ctx.shadowBlur = 0; ctx.font = `700 16px ${FONT}`; ctx.fillStyle = '#a6c1c7';
  ctx.fillText('s', 413, 118);
  ctx.fillStyle = '#29434b'; ctx.fillRect(24, 140, 432, 1);
  ctx.font = `800 11px ${FONT}`; ctx.fillStyle = '#88a6af';
  ctx.fillText('N SET', 24, 160); ctx.fillText('COUNT', 130, 160); ctx.fillText('STATUS', 246, 160);
  ctx.font = `800 22px ${FONT}`; ctx.fillStyle = '#e2f4f3';
  ctx.fillText(String(s.N).padStart(2, '0'), 24, 186);
  ctx.fillText(String(s.count).padStart(2, '0'), 130, 186);
  const status = { idle: 'READY', armed: 'ARMED', running: 'TIMING', done: 'HOLD' }[s.state];
  ctx.font = `800 17px ${FONT}`; ctx.fillStyle = s.state === 'done' ? '#ffc379' : on;
  ctx.fillText(status, 246, 185);
  const col = !s.aligned ? '#758995' : s.blocked ? '#ffbc78' : '#82f6de';
  ctx.fillStyle = col; ctx.beginPath(); ctx.arc(377, 177, 4, 0, PI2); ctx.fill();
  ctx.font = `800 11px ${FONT}`;
  ctx.fillText(!s.aligned ? 'ALIGN IR' : s.blocked ? 'IR BLOCK' : 'IR CLEAR', 389, 181);
  // A restrained glass highlight, kept away from the main digits.
  const sheen = ctx.createLinearGradient(0, 0, 0, 32);
  sheen.addColorStop(0, 'rgba(220,255,255,.045)'); sheen.addColorStop(1, 'rgba(220,255,255,0)');
  ctx.fillStyle = sheen; ctx.fillRect(0, 0, 480, 32); ctx.restore();
}

/* ========================================================================== */

export class LabScene {
  constructor(host, { model }) {
    this.host = host; this.model = model;
    this.pickables = []; this.drag = null; this.hover = null; this.tween = null;
    this.cableGateY = null; this.pressAnim = null; this.lastPressId = 0; this.barL = null; this.timerKey = '';
    this.raycaster = new THREE.Raycaster(); this.ndc = new THREE.Vector2();

    /* ---- renderer / camera ---- */
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xb7d0dc);
    this.camera = new THREE.PerspectiveCamera(34, 1, 0.05, 40);
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.08;
    this.canvas = this.renderer.domElement; this.canvas.style.touchAction = 'none';
    host.append(this.canvas);

    makeMaterials();
    this.buildLights();
    this.buildRoom();
    this.buildBench();
    this.buildTimer();
    this.buildStand();
    this.buildBracket();
    this.buildGate();
    this.buildPendulum();
    this.buildCables();
    this.buildOverlay();

    // our pointer handler must run BEFORE OrbitControls'
    this.canvas.addEventListener('pointerdown', (e) => this.onDown(e), { capture: true });
    this.canvas.addEventListener('pointermove', (e) => this.onMove(e));
    this.canvas.addEventListener('pointerup', (e) => this.onUp(e));
    this.canvas.addEventListener('pointercancel', (e) => this.onUp(e));
    this.canvas.addEventListener('pointerleave', () => { if (!this.drag) this.setHover(null); });

    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = true; this.controls.dampingFactor = 0.08; this.controls.rotateSpeed = 0.35;
    this.controls.zoomSpeed = 0.8; this.controls.screenSpacePanning = true; this.controls.panSpeed = 0.6;
    this.controls.minAzimuthAngle = -0.32; this.controls.maxAzimuthAngle = 0.32;
    this.controls.minPolarAngle = 1.3; this.controls.maxPolarAngle = 1.74;
    this.controls.addEventListener('start', () => { this.tween = null; this.atDefault = false; });

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(host);
    this.resize(true);
  }

  /* ------------------------------------------------------------------ lights & room */
  buildLights() {
    const sc = this.scene;
    const pm = new THREE.PMREMGenerator(this.renderer);
    const et = new THREE.CanvasTexture(envTexture()); et.mapping = THREE.EquirectangularReflectionMapping; et.colorSpace = THREE.SRGBColorSpace;
    sc.environment = pm.fromEquirectangular(et).texture; pm.dispose();
    sc.add(new THREE.HemisphereLight(0xe6f1f7, 0x8b9296, 1.5));
    const sun = this.sun = new THREE.DirectionalLight(0xfff1de, 3.1);
    sun.position.set(-2.7, 4.0, 3.7); sun.target.position.set(-0.3, 0.8, 0);
    sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    const c = sun.shadow.camera; c.left = -3.2; c.right = 3.2; c.top = 3.0; c.bottom = -2.6; c.near = 1; c.far = 14;
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02; sun.shadow.radius = 4;
    sc.add(sun, sun.target);
  }

  buildRoom() {
    const sc = this.scene;
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(12, 4.2), MAT.wall);
    wall.position.set(0, 2.1, WALL_Z); wall.receiveShadow = true; sc.add(wall);
    sc.add(box(12, 0.1, 0.014, MAT.skirt, 0, 0.05, WALL_Z + 0.007));
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(12, 6), MAT.floor);
    floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, WALL_Z + 3); floor.receiveShadow = true; sc.add(floor);

    /* soft window-light patches on the wall */
    const patchTex = (pts) => mkTex(cvs(512, 256, (x, w, h) => {
      x.filter = 'blur(14px)'; x.fillStyle = 'rgba(255,255,255,0.85)'; x.beginPath();
      pts.forEach(([px, py], i) => (i ? x.lineTo(px * w, py * h) : x.moveTo(px * w, py * h))); x.closePath(); x.fill();
    }));
    const mkPatch = (pts, w, h, px, py, op) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: patchTex(pts), transparent: true, opacity: op, depthWrite: false }));
      m.position.set(px, py, WALL_Z + 0.003); m.renderOrder = 1; sc.add(m);
    };
    mkPatch([[0.12, 0.08], [0.72, 0.08], [0.9, 0.92], [0.3, 0.92]], 2.8, 1.9, -1.55, 1.5, 0.26);
    mkPatch([[0.1, 0.1], [0.66, 0.1], [0.88, 0.9], [0.32, 0.9]], 1.8, 1.9, 0.55, 1.55, 0.2);

    const sx = SOCKET.x, sy = SOCKET.y, zf = WALL_Z + 0.012;
    sc.add(box(0.17, 0.085, 0.012, MAT.white, sx, sy, WALL_Z + 0.006));
    [-0.04, 0.04].forEach((dx) => {
      const ring = cylZ(0.029, 0.006, MAT.white, 26); ring.position.set(sx + dx, sy, zf + 0.002); sc.add(ring);
      const hole = cylZ(0.021, 0.008, MAT.black, 26); hole.position.set(sx + dx, sy, zf + 0.003); sc.add(hole);
      [-0.0075, 0.0075].forEach((px) => { const pin = cylZ(0.0024, 0.01, MAT.brass, 8); pin.position.set(sx + dx + px, sy, zf + 0.004); sc.add(pin); });
    });
    /* the plug of the timer's power lead, pushed into the left socket */
    const px = sx - 0.04, plugZ = zf + 0.003 + 0.022;
    const body = box(0.052, 0.052, 0.044, MAT.plug, px, sy, plugZ); sc.add(body);
    const grip = box(0.04, 0.04, 0.012, MAT.plug, px, sy, plugZ + 0.026); sc.add(grip);
    const relief = cyl(0.0075, 0.0105, 0.03, MAT.plug, 10); relief.position.set(px, sy - 0.04, plugZ + 0.006); sc.add(relief);
    this.plugEnd = new THREE.Vector3(px, sy - 0.058, plugZ + 0.006);
    this.socketPos = new THREE.Vector3(sx, sy + 0.06, WALL_Z + 0.02);
  }

  /* ------------------------------------------------------------------ bench (wood top + steel frame) */
  buildBench() {
    const sc = this.scene, B = BENCH, g = new THREE.Group(); sc.add(g);
    g.add(box(B.w, 0.035, B.d, MAT.woodTop, B.cx, B.top - 0.0175, B.cz));
    const lx = B.w / 2 - 0.05, lz = B.d / 2 - 0.05, legH = B.top - 0.035;
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
      g.add(box(0.045, legH, 0.045, MAT.frame, B.cx + sx * lx, legH / 2, B.cz + sz * lz));
      const foot = cyl(0.02, 0.022, 0.012, MAT.rubber, 12); foot.position.set(B.cx + sx * lx, 0.006, B.cz + sz * lz); g.add(foot);
    });
    const rails = (y, h, t) => {
      [-1, 1].forEach((s) => {
        g.add(box(B.w - 0.12, h, t, MAT.frame, B.cx, y, B.cz + s * lz));
        g.add(box(t, h, B.d - 0.12, MAT.frame, B.cx + s * lx, y, B.cz));
      });
    };
    rails(B.top - 0.06, 0.04, 0.028);   // frame just under the top
    rails(0.34, 0.032, 0.03);           // lower stretcher rails, like the reference


  }

  /* ------------------------------------------------------------------ digital timer */
  buildTimer() {
    const T = TIMER, g = this.timerG = new THREE.Group(); this.scene.add(g);
    g.position.set(T.x, T.y, T.z); g.rotation.y = T.yaw;
    g.add(roundedBox(T.w, T.h, T.d, 0.022, MAT.timerCase));
    // A rubber rear bumper and inset faceplate make the case read as a real instrument.
    g.add(roundedBox(T.w + 0.002, T.h + 0.002, 0.032, 0.012, MAT.rubber, 0, 0, -T.d / 2 + 0.014));
    g.add(roundedBox(T.w - 0.014, T.h - 0.014, 0.012, 0.006, MAT.timerPanel, 0, 0, T.d / 2 - 0.001));
    g.add(roundedBox(0.402, 0.154, 0.014, 0.007, MAT.timerCase, 0, 0.031, T.d / 2 + 0.005));
    g.add(roundedBox(0.386, 0.140, 0.006, 0.003, MAT.glass, 0, 0.031, T.d / 2 + 0.011));
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sy]) => {
      const sc = cylZ(0.0045, 0.006, MAT.chrome, 10); sc.position.set(sx * (T.w / 2 - 0.012), sy * (T.h / 2 - 0.012), T.d / 2 + 0.006); g.add(sc);
      const ft = cyl(0.017, 0.019, T.foot, MAT.rubber, 12); ft.position.set(sx * (T.w / 2 - 0.04), -T.h / 2 - T.foot / 2, -sy * (T.d / 2 - 0.04)); g.add(ft);
    });
    /* display */
    this.timerCanvas = cvs(960, 400, () => {});
    this.timerTex = mkTex(this.timerCanvas); this.timerTex.anisotropy = 8;
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.374, 0.132), new THREE.MeshBasicMaterial({ map: this.timerTex, toneMapped: false }));
    face.position.set(0, 0.031, T.d / 2 + 0.0145); g.add(face);
    /* Tactile push buttons: fixed recess, moving cap, printed legend. */
    this.btns = {};
    [['start', -0.15, MAT.timerStart, 'START'], ['reset', -0.05, MAT.timerReset, 'RESET'], ['nminus', 0.05, MAT.timerAdjust, 'N −'], ['nplus', 0.15, MAT.timerAdjust, 'N +']].forEach(([act, x, mat, label]) => {
      const grp = new THREE.Group(); grp.position.set(x, -0.077, T.d / 2 + 0.006); g.add(grp);
      grp.add(roundedBox(0.081, 0.045, 0.010, 0.005, MAT.timerCase));
      const cap = new THREE.Group(); cap.position.z = 0.006; grp.add(cap);
      cap.add(roundedBox(0.069, 0.035, 0.014, 0.006, mat));
      const hit = box(0.084, 0.05, 0.03, MAT.ghost, 0, 0, 0.01); grp.add(hit);
      hit.userData = { kind: 'btn', action: act, tip: `Click: ${label.replace(' ', '')}` }; this.pickables.push(hit);
      this.btns[act] = cap; cap.userData.home = cap.position.z;
      const lab = new THREE.Mesh(new THREE.PlaneGeometry(0.061, 0.023), new THREE.MeshBasicMaterial({ toneMapped: false, transparent: true, map: mkTex(cvs(320, 112, (c, w, h) => {
        c.clearRect(0, 0, w, h); c.fillStyle = '#ffffff'; c.font = '800 52px Nunito, system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(label, w / 2, h / 2 + 1);
      })) }));
      lab.position.set(0, 0, 0.0075); cap.add(lab);
    });
    /* the two sockets on the left side: POWER (top) and IR GATE (bottom) — one cable each */
    const sideX = -T.w / 2;
    const jack = (y, name, plugMat, big) => {
      const base = cylX(big ? 0.0125 : 0.011, 0.01, MAT.chrome, 18); base.position.set(sideX - 0.003, y, 0.01); g.add(base);
      const pl = cylX(big ? 0.0105 : 0.0085, 0.03, plugMat, 16); pl.position.set(sideX - 0.024, y, 0.01); g.add(pl);
      const tail = cylX(big ? 0.0072 : 0.0058, 0.02, MAT.cable, 10); tail.position.set(sideX - 0.049, y, 0.01); g.add(tail);
      const sticker = new THREE.Mesh(new THREE.PlaneGeometry(0.058, 0.016), new THREE.MeshBasicMaterial({ toneMapped: false, side: THREE.DoubleSide, map: mkTex(cvs(232, 64, (c, w, h) => {
        c.fillStyle = '#d9dee1'; c.fillRect(0, 0, w, h); c.fillStyle = '#20262a'; c.font = '800 34px Nunito, system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(name, w / 2, h / 2 + 2);
      })) }));
      sticker.rotation.y = -Math.PI / 2; sticker.position.set(sideX - 0.0012, y - 0.026, 0.04); g.add(sticker);
    };
    jack(0.05, 'POWER IN', MAT.plug, true);
    jack(-0.025, 'IR GATE', MAT.plug, false);
    g.updateMatrixWorld(true);
    this.timerPowerEnd = g.localToWorld(new THREE.Vector3(sideX - 0.059, 0.05, 0.01));
    this.timerSensorEnd = g.localToWorld(new THREE.Vector3(sideX - 0.059, -0.025, 0.01));
    this.timerOut = new THREE.Vector3(-Math.cos(T.yaw), 0, Math.sin(T.yaw));   // world direction leaving the left face
    this.timerTop = new THREE.Vector3(T.x, T.y + T.h / 2 + 0.02, T.z);
  }

  /* ------------------------------------------------------------------ stand */
  buildStand() {
    const sc = this.scene, g = new THREE.Group(); g.position.z = APPARATUS_Z; sc.add(g);
    g.add(box(0.3, 0.024, 0.24, MAT.iron, POLE.x, 0.012, POLE.z + 0.05));
    const pole = cyl(0.0095, 0.0095, POLE.h, MAT.chrome, 16); pole.position.set(POLE.x, 0.024 + POLE.h / 2, POLE.z); g.add(pole);
    const capTop = cyl(0.0105, 0.0105, 0.012, MAT.black, 14); capTop.position.set(POLE.x, 0.024 + POLE.h + 0.006, POLE.z); g.add(capTop);

  }
  bossAt(x, y, z) {
    const b = new THREE.Group(); b.position.set(x, y, z);
    b.add(box(0.04, 0.04, 0.04, MAT.black));
    const wing = cylZ(0.006, 0.034, MAT.black, 8); wing.position.z = 0.03; b.add(wing);
    const knob = cylZ(0.0125, 0.01, MAT.black, 14); knob.position.z = 0.05; b.add(knob);
    return b;
  }

  /* ------------------------------------------------------------------ pendulum support (shelf with a slot) + pivot pin */
  buildBracket() {
    const g = this.bracket = new THREE.Group(); g.position.z = BRACKET_Z; this.scene.add(g);
    const top = GEO.plateTop, t = GEO.shelfThickness;
    // The pendulum bracket is fixed to the wall, independently of the IR stand.
    const backZ = WALL_Z - BRACKET_Z + 0.012;
    g.add(box(0.20, 0.14, 0.008, MAT.frame, 0, top - 0.045, backZ));
    [[-0.075, 0.012], [0.075, 0.012], [-0.075, -0.10], [0.075, -0.10]].forEach(([x, y]) => {
      const s = cylZ(0.007, 0.006, MAT.steel, 8); s.position.set(x, top + y, backZ + 0.009); g.add(s);
    });
    // Top-view L-shaped entry: open at the front, then turns right into
    // a rounded horizontal slot. The bar sits in the elbow in the apparatus plane.
    const sh = new THREE.Shape();
    sh.moveTo(-0.10, -0.092);
    sh.lineTo(-0.080, -0.092);
    sh.lineTo(-0.080, -0.040);
    sh.lineTo(0.063, -0.040);
    sh.quadraticCurveTo(0.077, -0.040, 0.077, -0.052);
    sh.quadraticCurveTo(0.077, -0.064, 0.063, -0.064);
    sh.lineTo(-0.035, -0.064);
    sh.lineTo(-0.035, -0.092);
    sh.lineTo(0.10, -0.092);
    sh.lineTo(0.10, -backZ);
    sh.lineTo(-0.10, -backZ);
    sh.closePath();
    const geo = new THREE.ExtrudeGeometry(sh, { depth: t, bevelEnabled: false }); geo.rotateX(-Math.PI / 2);
    const shelf = new THREE.Mesh(geo, MAT.frame); shelf.position.y = top - t; shelf.castShadow = shelf.receiveShadow = true; g.add(shelf);
    // Short bearing lands support the shaft; the head clears the front plate.
    const bearingHeight = GEO.pivotLift - GEO.pinR;
    [-0.021, 0.021].forEach(z => {
      g.add(box(0.048, bearingHeight, 0.007, MAT.steel, 0, top + bearingHeight / 2, 0.05 + z));
    });
    [-0.085, 0.085].forEach((x) => {
      const tri = new THREE.Shape(); tri.moveTo(0, 0); tri.lineTo(0.075, 0); tri.lineTo(0, -0.065); tri.closePath();
      const gg = new THREE.ExtrudeGeometry(tri, { depth: 0.008, bevelEnabled: false }); gg.rotateY(-Math.PI / 2);
      const m = new THREE.Mesh(gg, MAT.frame); m.position.set(x + 0.004, top - t, backZ + 0.006); m.castShadow = true; g.add(m);
    });
    /* pivot pin: drag down / click to pull it out, push back in when a hole is lined up */
    const pin = this.pin = new THREE.Group(); pin.position.set(0, GEO.pivotY, APPARATUS_Z); this.scene.add(pin);
    const shaft = cylZ(GEO.pinR, 0.056, MAT.steel, 14); pin.add(shaft);
    const head = cylZ(0.0095, 0.008, MAT.dark, 14); head.position.z = 0.03; pin.add(head);
    const tip = cylZ(0.003, 0.006, MAT.steel, 10); tip.position.z = -0.031; pin.add(tip);
    const hit = new THREE.Mesh(new THREE.SphereGeometry(0.024, 12, 10), MAT.ghost); hit.position.z = 0.03; pin.add(hit);
    [shaft, head, hit].forEach((m) => { m.userData = { kind: 'pin', tip: 'Pivot pin: click, or drag down, to pull out' }; this.pickables.push(m); });
  }

  /* ------------------------------------------------------------------ IR gate on the stand */
  buildGate() {
    const g = this.gateG = new THREE.Group(); this.scene.add(g);
    const parts = [box(0.036, 0.012, 0.1, MAT.black, 0, 0, 0), box(0.036, 0.074, 0.01, MAT.dark, 0, 0.043, -0.04), box(0.036, 0.074, 0.01, MAT.dark, 0, 0.043, 0.04)];
    parts.forEach((p) => g.add(p));
    const emit = cylZ(0.0036, 0.004, new THREE.MeshStandardMaterial({ color: 0x300000, emissive: 0xff2200, emissiveIntensity: 1.6 }), 12); emit.position.set(0, 0.036, -0.0345); g.add(emit);
    const rec = cylZ(0.0036, 0.004, MAT.black, 12); rec.position.set(0, 0.036, 0.0345); g.add(rec);
    this.beamMat = new THREE.MeshBasicMaterial({ color: 0xff3b2a, transparent: true, opacity: 0.85, toneMapped: false });
    this.beam = cylZ(0.0007, 0.069, this.beamMat, 6); this.beam.position.set(0, 0.036, 0); g.add(this.beam);
    this.glowMat = new THREE.MeshBasicMaterial({ color: 0xff3b2a, transparent: true, opacity: 0.18, depthWrite: false, toneMapped: false });
    this.glow = cylZ(0.0035, 0.069, this.glowMat, 8); this.glow.position.set(0, 0.036, 0); g.add(this.glow);
    this.ledMat = new THREE.MeshBasicMaterial({ color: 0x4fdc93, toneMapped: false });
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.0042, 10, 8), this.ledMat); led.position.set(0, 0.084, 0.04); g.add(led);
    // sensor socket on the front of the base
    const stub = box(0.022, 0.012, 0.028, MAT.black, 0, 0, 0.064); g.add(stub);
    const plug = cylZ(0.0075, 0.02, MAT.plug, 14); plug.position.set(0, 0.002, 0.08); g.add(plug);
    this.gateConnector = new THREE.Vector3(0, 0, 0.092);     // local; the cable leaves from here
    // arm + clamp boss that slide on the pole: at the same z as the pole, entering the base from the side
    const armLen = POLE.x - 0.018;
    const arm = cylX(0.0055, armLen, MAT.chrome, 12); arm.position.set(0.018 + armLen / 2, 0, POLE.z); g.add(arm);
    const boss = this.bossAt(POLE.x, 0, POLE.z); g.add(boss);
    [...parts, arm, ...boss.children].forEach((m) => { if (m.isMesh) { m.userData = { kind: 'gate', tip: 'IR gate: drag up / down' }; this.pickables.push(m); } });
    const hit = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, 0.13), MAT.ghost); hit.position.set(0, 0.04, 0); hit.userData = { kind: 'gate', tip: 'IR gate: drag up / down' }; g.add(hit); this.pickables.push(hit);
  }

  /* ------------------------------------------------------------------ the bar pendulum itself */
  buildPendulum() {
    this.root = new THREE.Group(); this.root.position.set(0, GEO.pivotY, APPARATUS_Z);
    this.anim = new THREE.Group(); this.swing = new THREE.Group(); this.body = new THREE.Group();
    this.root.add(this.anim); this.anim.add(this.swing); this.swing.add(this.body); this.scene.add(this.root);
  }
  holeList(L) {
    const out = [], sp = GEO.holePitch, K = Math.floor((L / 2 - 0.0125 + 1e-9) / sp);
    for (let k = -K; k <= K; k++) out.push(L / 2 + k * sp);
    return out;
  }
  rebuildBar(L) {
    if (this.barMesh) {
      this.body.remove(this.barMesh); this.barMesh.geometry.dispose(); this.barMesh.material.map?.dispose(); this.barMesh.material.dispose();
      this.pickables = this.pickables.filter((m) => m !== this.barMesh);
    }
    const w = GEO.barWidth, th = GEO.barThick, holes = this.holeList(L);
    const sh = new THREE.Shape();
    sh.moveTo(-w / 2, -L / 2); sh.lineTo(w / 2, -L / 2); sh.lineTo(w / 2, L / 2); sh.lineTo(-w / 2, L / 2); sh.closePath();
    holes.forEach((s) => { const p = new THREE.Path(); p.absarc(0, L / 2 - s, GEO.holeR, 0, PI2, true); sh.holes.push(p); });
    const geo = new THREE.ExtrudeGeometry(sh, { depth: th, bevelEnabled: false, curveSegments: 10 }); geo.translate(0, 0, -th / 2);
    const pos = geo.attributes.position, nor = geo.attributes.normal, uv = geo.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      if (Math.abs(nor.getZ(i)) > 0.5) uv.setXY(i, (pos.getX(i) + w / 2) / w, (pos.getY(i) + L / 2) / L); else uv.setXY(i, 0.5, 0.5);
    }
    const ppm = 2000;   // label texture: distance of every hole from the centre of gravity, in cm
    const tex = mkTex(cvs(Math.round(w * ppm), Math.round(L * ppm), (x, cw, ch) => {
      const g = x.createLinearGradient(0, 0, cw, 0); g.addColorStop(0, '#4f6376'); g.addColorStop(0.5, '#6f8499'); g.addColorStop(1, '#4f6376');
      x.fillStyle = g; x.fillRect(0, 0, cw, ch);
      for (let i = 0; i < 700; i++) { x.fillStyle = `rgba(255,255,255,${Math.random() * 0.05})`; x.fillRect(Math.random() * cw, Math.random() * ch, 1, 6 + Math.random() * 30); }
      x.fillStyle = '#10161b'; x.font = '700 11px Nunito, system-ui, sans-serif'; x.textBaseline = 'middle';
      holes.forEach((s) => {
        const cm = Math.abs(s - L / 2) * 100, txt = Math.abs(cm - Math.round(cm)) < 0.01 ? String(Math.round(cm)) : cm.toFixed(1);
        x.fillText(txt, cw / 2 + 10, s * ppm, cw / 2 - 13);
      });
    }));
    this.barMesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, metalness: 0.6, roughness: 0.46 }));
    this.barMesh.castShadow = this.barMesh.receiveShadow = true;
    this.barMesh.userData = { kind: 'bar', tip: 'Bar: drag sideways to swing it' };
    this.body.add(this.barMesh); this.pickables.push(this.barMesh);
    this.barL = L;
  }

  /* ------------------------------------------------------------------ cables: exactly two on the timer */
  buildCables() {
    this.powerCable = new THREE.Mesh(new THREE.BufferGeometry(), MAT.cable); this.powerCable.castShadow = true; this.scene.add(this.powerCable);
    this.sensorCable = new THREE.Mesh(new THREE.BufferGeometry(), MAT.cableGrey); this.sensorCable.castShadow = true; this.scene.add(this.sensorCable);
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    const a = this.timerPowerEnd, d = this.timerOut;
    const pts = [
      a.clone(), a.clone().addScaledVector(d, 0.05).add(V(0, -0.006, 0)), a.clone().addScaledVector(d, 0.11).add(V(0, -0.07, 0)),
      V(-1.655, a.y - 0.26, a.z - 0.02), V(-1.665, 0.4, a.z - 0.1), V(-1.64, 0.035, -0.12),
      V(-1.52, 0.035, -0.29), V(-1.2, 0.035, -0.345), V(-0.7, 0.035, -0.36), V(-0.3, 0.035, -0.35),
      V(this.plugEnd.x - 0.03, 0.03, -0.37), V(this.plugEnd.x - 0.012, 0.15, WALL_Z + 0.11), V(this.plugEnd.x, this.plugEnd.y - 0.02, WALL_Z + 0.075), this.plugEnd.clone()
    ];
    this.powerCable.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'centripetal'), 220, 0.0042, 8, false);
    this.powerMid = V(-1.66, 0.3, a.z - 0.08);
    this.sensorMid = V(-0.02, 0.28, 0.18);
  }
  updateSensorCable(gateY) {
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    const a = this.timerSensorEnd, d = this.timerOut, gy = gateY;
    const c = V(0, gy - 0.006, APPARATUS_Z).add(this.gateConnector);   // connector on the gate base
    const top = gy - 0.004;
    const rise = (k) => lerp(0.03, top - 0.05, k);
    const pts = [
      a.clone(), a.clone().addScaledVector(d, 0.045).add(V(0, -0.006, 0)), a.clone().addScaledVector(d, 0.09).add(V(0, -0.06, 0.02)),
      V(-1.595, a.y - 0.25, a.z + 0.1), V(-1.6, 0.4, 0.37), V(-1.57, 0.035, 0.44),
      V(-1.35, 0.035, 0.5), V(-0.95, 0.035, 0.49), V(-0.55, 0.035, 0.43), V(-0.25, 0.035, 0.31),
      V(-0.07, 0.035, 0.24), V(-0.035, rise(0.3), 0.2), V(-0.015, rise(0.7), 0.15), V(-0.004, top - 0.03, c.z + 0.05), V(0, top - 0.004, c.z + 0.015), c
    ];
    this.sensorCable.geometry.dispose();
    this.sensorCable.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'centripetal'), 260, 0.0031, 8, false);
    this.cableGateY = gateY;
  }

  /* ------------------------------------------------------------------ overlay UI inside the viewport */
  buildOverlay() {
    const m = this.model, el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
    const ov = this.overlay = el('div', 'lab-overlay'); ov.hidden = true; this.host.append(ov);
    this.hudEl = el('div', 'lab-hud'); ov.append(this.hudEl);
    this.toastEl = el('div', 'lab-toast'); ov.append(this.toastEl);
    this.tipEl = el('div', 'lab-tip'); ov.append(this.tipEl);

    /* view presets */
    const chips = el('div', 'lab-chips'); ov.append(chips);
    [['overview', 'Whole bench'], ['pivot', 'Pivot'], ['gate', 'IR gate'], ['timer', 'Timer']].forEach(([k, t]) => {
      const b = el('button', 'lab-chip', t); b.type = 'button'; b.addEventListener('click', () => this.setView(k)); chips.append(b);
    });

    /* nudge controls: same effect as dragging, for fine steps / touch screens */
    const nudge = el('div', 'lab-nudge'); ov.append(nudge);
    const hold = (btn, fn, up) => {
      let iv = null; const stop = () => { if (iv) { clearInterval(iv); iv = null; if (up) up(); } };
      btn.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); fn(); iv = setInterval(fn, 55); });
      ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => btn.addEventListener(ev, stop));
    };
    const row = (title) => { const r = el('div', 'lab-nudge-row'); r.append(el('span', 'lab-nudge-title', title)); nudge.append(r); return r; };
    const mk = (r, txt, label) => { const b = el('button', 'lab-nudge-btn', txt); b.type = 'button'; b.setAttribute('aria-label', label); r.append(b); return b; };
    const rg = row('IR gate');
    hold(mk(rg, '▲', 'Raise the IR gate'), () => m.moveGate(m.gateY + 0.002)); hold(mk(rg, '▼', 'Lower the IR gate'), () => m.moveGate(m.gateY - 0.002));
    const rp = row('Pivot pin');
    this.pinBtn = mk(rp, 'Pull out', 'Pull the pivot pin out or push it in'); this.pinBtn.classList.add('wide');
    this.pinBtn.addEventListener('click', () => m.pinTo(m.pinOut < 0.5 ? 1 : 0));
    this.barRow = row('Bar (pin out)');
    hold(mk(this.barRow, '▲', 'Slide the bar up'), () => m.slideBar(m.sPvis + 0.002), () => m.settleBar());
    hold(mk(this.barRow, '▼', 'Slide the bar down'), () => m.slideBar(m.sPvis - 0.002), () => m.settleBar());

    /* floating part labels */
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    this.labels = [
      { key: 'timer', text: () => 'Digital timer', pos: () => this.timerTop },
      { key: 'gate', text: () => 'IR gate · drag ↑↓', pos: () => V(0.0, m.gateY + 0.13, 0.0) },
      { key: 'pin', text: () => (m.free ? 'Pin out · push back in' : 'Pivot pin · pull out'), pos: () => V(0.0, GEO.pivotY + 0.05, 0.08 + this.pin.position.z) },
      { key: 'bar', text: () => (m.free ? 'Bar free · drag ↑↓' : 'Bar pendulum · drag sideways'), pos: () => V(0.0 + 0.1, GEO.pivotY - 0.34, 0.0) },
      { key: 'stand', text: () => 'Stand', pos: () => V(POLE.x, 1.64, POLE.z) },
      { key: 'sensor', text: () => 'IR sensor cable', pos: () => this.sensorMid },
      { key: 'power', text: () => 'Power cable', pos: () => this.powerMid },
      { key: 'socket', text: () => 'Wall socket', pos: () => this.socketPos }
    ].map((l) => { l.el = el('div', 'lab-label'); ov.append(l.el); return l; });
  }

  toast(text, kind = '') {
    const e = this.toastEl; e.textContent = text; e.className = `lab-toast show ${kind}`;
    clearTimeout(this._tt); this._tt = setTimeout(() => { e.className = 'lab-toast'; }, 3800);
  }

  /* ------------------------------------------------------------------ camera */
  viewDefs() {
    const m = this.model;
    return {
      overview: { t: this.fit.target, d: this.fit.dist },
      pivot: { t: new THREE.Vector3(0.02, GEO.plateTop - 0.04, APPARATUS_Z), d: Math.max(this.minDist, 0.95) },
      gate: { t: new THREE.Vector3(0, m.gateY + 0.08, APPARATUS_Z), d: Math.max(this.minDist, 0.85) },
      timer: { t: new THREE.Vector3(TIMER.x, TIMER.y, TIMER.z), d: Math.max(this.minDist, 1.0) }
    };
  }
  placeCamera(t, d, theta = 0.1, phi = 1.5) {
    const sp = Math.sin(phi);
    return new THREE.Vector3(t.x + d * sp * Math.sin(theta), t.y + d * Math.cos(phi), t.z + d * sp * Math.cos(theta));
  }
  setView(name, instant) {
    const v = this.viewDefs()[name]; if (!v) return;
    const toPos = this.placeCamera(v.t, v.d);
    this.tween = null;
    this.atDefault = name === 'overview';
    if (instant) { this.camera.position.copy(toPos); this.controls.target.copy(v.t); this.controls.update(); return; }
    this.tween = { t: 0, dur: 0.7, p0: this.camera.position.clone(), p1: toPos, t0: this.controls.target.clone(), t1: v.t.clone() };
  }

  overviewHeight() {
    return Math.max(1.78, GEO.pivotY + this.model.sPvis + this.model.lift + 0.10);
  }

  resize(first) {
    const w = this.host.clientWidth, h = this.host.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    const aspect = w / h; this.camera.aspect = aspect;
    const fov = this.camera.fov * DEG, tanH = Math.tan(fov / 2);
    const W = 2.45, H = this.overviewHeight();
    this.fitHeight = H;
    const dist = Math.max(H / 2 / tanH, W / 2 / (tanH * aspect)) * 1.04;
    this.fit = { dist, target: new THREE.Vector3(-0.64, H / 2 - 0.06, 0) };
    this.minDist = 0.55;
    if (this.controls) { this.controls.minDistance = this.minDist; this.controls.maxDistance = dist * 1.12; }
    this.camera.near = 0.05; this.camera.far = dist + 12;
    this.camera.updateProjectionMatrix();
    if (first || this.atDefault !== false) { this.atDefault = true; if (this.controls) this.setView('overview', true); else { this.camera.position.copy(this.placeCamera(this.fit.target, dist)); this.camera.lookAt(this.fit.target); } }
  }

  /* ------------------------------------------------------------------ pointer interaction */
  setPointer(e) {
    const r = this.canvas.getBoundingClientRect();
    this.ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(this.ndc, this.camera);
  }
  pick(e) { this.setPointer(e); const hs = this.raycaster.intersectObjects(this.pickables, false); return hs[0] || null; }
  planeAt(z) { const o = new THREE.Vector3(); return this.raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 0, 1), -z), o) ? o : null; }

  setHover(hit, e) {
    const k = hit ? hit.object.userData.kind : null, m = this.model;
    this.canvas.style.cursor = !k ? '' : k === 'btn' ? 'pointer' : k === 'gate' ? 'ns-resize' : k === 'bar' ? (m.free ? 'ns-resize' : 'ew-resize') : 'grab';
    if (hit && e && !this.drag) {
      const r = this.host.getBoundingClientRect();
      let tip = hit.object.userData.tip;
      if (k === 'bar' && m.free) tip = 'Bar is free: drag up / down to line up a hole with the pin';
      this.tipEl.textContent = tip; this.tipEl.style.transform = `translate(${e.clientX - r.left + 14}px, ${e.clientY - r.top + 16}px)`; this.tipEl.classList.add('show');
    } else if (!this.drag) this.tipEl.classList.remove('show');
  }

  onDown(e) {
    if (e.button !== 0) return;
    const hit = this.pick(e); if (!hit) return;
    const m = this.model, d = hit.object.userData, kind = d.kind;
    e.stopImmediatePropagation(); e.preventDefault();
    this.canvas.setPointerCapture?.(e.pointerId);
    this.tween = null; this.tipEl.classList.remove('show');
    if (kind === 'btn') { m.timerPress(d.action); this.drag = { kind }; return; }
    if (kind === 'gate') {
      if (m.anim) return m.notify('Wait — the bar is being re-hung.', 'warn');
      const p = this.planeAt(APPARATUS_Z); this.drag = { kind, off: p ? m.gateY - p.y : 0 }; this.canvas.style.cursor = 'grabbing'; return;
    }
    if (kind === 'bar') {
      if (m.anim) return m.notify('Wait — the bar is being re-hung.', 'warn');
      if (m.free) { const p = this.planeAt(APPARATUS_Z); this.drag = { kind: 'slide', y0: p ? p.y : 0, s0: m.sPvis }; this.canvas.style.cursor = 'grabbing'; return; }
      const p = this.planeAt(APPARATUS_Z);
      const side = p && p.y > GEO.pivotY ? -1 : 1;
      const pointerAngle = p ? Math.atan2(p.x * side, (GEO.pivotY - p.y) * side) : m.theta;
      this.drag = { kind: 'swing', side, angleOffset: m.theta - pointerAngle };
      this.canvas.style.cursor = 'grabbing'; this.moveSwing(e); return;
    }
    if (kind === 'pin') {
      if (m.anim) return m.notify('Wait — the bar is being re-hung.', 'warn');
      this.drag = { kind, y0: e.clientY, a0: m.pinOut, moved: false }; this.canvas.style.cursor = 'grabbing';
    }
  }
  moveSwing(e) {
    const m = this.model; this.setPointer(e); const p = this.planeAt(APPARATUS_Z); if (!p) return;
    const side = this.drag?.side ?? 1;
    const th = Math.atan2(p.x * side, (GEO.pivotY - p.y) * side) + (this.drag?.angleOffset ?? 0);
    if (!m.grabBar(th)) this.drag = null;
  }
  onMove(e) {
    const D = this.drag, m = this.model;
    if (!D) { this.setHover(this.pick(e), e); return; }
    if (D.kind === 'swing') return this.moveSwing(e);
    this.setPointer(e);
    if (D.kind === 'gate') { const p = this.planeAt(APPARATUS_Z); if (p) m.moveGate(p.y + D.off); }
    else if (D.kind === 'slide') { const p = this.planeAt(APPARATUS_Z); if (p) m.slideBar(D.s0 + (p.y - D.y0)); }
    else if (D.kind === 'pin') {
      if (Math.abs(e.clientY - D.y0) > 4) D.moved = true;
      if (D.moved) m.setPin(D.a0 + (e.clientY - D.y0) / 110);
    }
  }
  onUp(e) {
    const D = this.drag, m = this.model; this.drag = null; this.canvas.style.cursor = '';
    try { this.canvas.releasePointerCapture?.(e.pointerId); } catch (_) { /* not captured */ }
    if (!D) return;
    if (D.kind === 'swing') m.letGoBar();
    else if (D.kind === 'slide') m.settleBar();
    else if (D.kind === 'pin') {
      if (!D.moved) m.pinTo(m.pinOut < 0.5 ? 1 : 0);
      else m.pinTo(m.pinOut < 0.5 ? 0 : 1);
    }
  }

  /* ------------------------------------------------------------------ per-frame */
  update(state) {
    const v = state.values, m = this.model;
    if (this.barL !== v.L) this.rebuildBar(v.L);
    if (this.atDefault && Math.abs(this.fitHeight - this.overviewHeight()) > 0.01) this.resize();

    /* pendulum + pin + gate follow the model */
    this.anim.position.y = v.lift;
    this.swing.rotation.z = v.theta;
    this.barMesh.position.set(0, v.sPvis - v.L / 2, 0);
    this.pin.position.z = APPARATUS_Z + v.pinOut * GEO.pinTravel;
    this.gateG.position.set(GEO.gateX, v.gateY - 0.006, APPARATUS_Z);
    if (this.cableGateY === null || Math.abs(this.cableGateY - v.gateY) > 1e-4) this.updateSensorCable(v.gateY);

    /* IR beam + LED */
    const blocked = v.gateBlocked, aligned = v.gateAligned, show = state.toggles.beam !== false;
    this.beam.visible = show; this.glow.visible = show;
    this.beamMat.opacity = blocked ? 0.3 : 0.9; this.glowMat.opacity = blocked ? 0.04 : 0.2;
    this.ledMat.color.setHex(!aligned ? 0x777777 : blocked ? 0xff4d3d : 0x4fdc93);

    /* timer display + tactile button travel */
    const key = JSON.stringify([v.timerValue, v.timerN, v.timerCount, v.timerState, blocked, aligned]);
    if (key !== this.timerKey) {
      this.timerKey = key;
      drawTimerFace(this.timerCanvas.getContext('2d'), this.timerCanvas.width, this.timerCanvas.height, { value: v.timerValue, N: v.timerN, count: v.timerCount, state: v.timerState, blocked, aligned });
      this.timerTex.needsUpdate = true;
    }
    if (v.press.id !== this.lastPressId) { this.lastPressId = v.press.id; this.pressAnim = { act: v.press.action, t: 0 }; }
    if (this.pressAnim) {
      const P = this.pressAnim; P.t += 1 / 30; const b = this.btns[P.act];
      if (b) b.position.z = b.userData.home - 0.004 * Math.sin(Math.PI * Math.min(1, P.t / 0.16));
      if (P.t >= 0.16) { if (b) b.position.z = b.userData.home; this.pressAnim = null; }
    }



    /* camera */
    if (this.tween) {
      const now = performance.now(), fdt = Math.min(0.1, (now - (this._lt || now)) / 1000); const T = this.tween; T.t += fdt || 1 / 60; const q = Math.min(1, T.t / T.dur), e = q < 0.5 ? 2 * q * q : 1 - Math.pow(-2 * q + 2, 2) / 2;
      this.camera.position.lerpVectors(T.p0, T.p1, e); this.controls.target.lerpVectors(T.t0, T.t1, e);
      if (q >= 1) this.tween = null;
    }
    this._lt = performance.now();
    this.controls.update();
    const t = this.controls.target, c0 = t.clone();
    t.x = clamp(t.x, -1.5, 0.45); t.y = clamp(t.y, 0.3, 1.45); t.z = clamp(t.z, APPARATUS_Z - 0.05, 0.4);
    if (!t.equals(c0)) this.camera.position.add(t.clone().sub(c0));

    this.renderer.render(this.scene, this.camera);
  }

  updateOverlay(state) {
    const v = state.values, m = this.model, show = state.toggles.labels !== false;
    /* HUD */
    const st = { idle: 'ready', armed: 'armed — waiting for the beam', running: 'running…', done: 'stopped' }[v.timerState];
    let ir = '<span>IR gate aligned</span>';
    if (!v.gateAligned) ir = '<b class="bad">IR beam does not cross the bar — move the gate</b>';
    const lines = [`<div>Bar pendulum · l = ${v.l.toFixed(3)} m · θ = ${(v.theta / DEG).toFixed(1)}°</div>`, `<div>Timer ${st}</div>`, `<div>${ir}</div>`];
    if (v.free) lines.push('<div><b class="bad">Pivot pin is out — the bar is free</b></div>');
    const html = lines.join('');
    if (html !== this._hud) { this._hud = html; this.hudEl.innerHTML = html; }
    this.pinBtn.textContent = v.pinOut > 0.5 ? 'Push in' : 'Pull out';
    this.barRow.classList.toggle('off', !v.free);

    /* labels */
    const w = this.host.clientWidth, h = this.host.clientHeight, p = new THREE.Vector3();
    this.labels.forEach((l) => {
      if (!show) { l.el.style.display = 'none'; return; }
      p.copy(l.pos()).project(this.camera);
      if (p.z > 1 || p.z < -1) { l.el.style.display = 'none'; return; }
      const x = (p.x * 0.5 + 0.5) * w, y = (-p.y * 0.5 + 0.5) * h;
      l.el.style.display = 'block'; const txt = l.text(); if (l.el.textContent !== txt) l.el.textContent = txt;
      l.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -125%)`;
    });
  }

  dispose() {
    this.resizeObserver.disconnect(); this.controls.dispose(); this.renderer.dispose(); this.canvas.remove(); this.overlay.remove();
  }
}
