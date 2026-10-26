/* ==========================================================================
   config.js — everything that is specific to Experiment 7:
   "Moment of inertia of a bar" (compound / bar pendulum with an IR-gate timer).

   Physics lives in js/physics.js, the 3-D apparatus in js/scene.js.
   ========================================================================== */

import { calcFromReading, G_NOM, GEO, DEG } from './physics.js';

const fixed = (n, d = 3) => (Number.isFinite(n) ? n.toFixed(d) : '—');

/** Numbers for the Results panel: the last recorded reading, or the live timer once it has stopped. */
function resultRow(s) {
  const last = s.readings[s.readings.length - 1];
  if (last) return { src: 'reading', r: last, c: calcFromReading(last) };
  const v = s.values;
  if (v.timerState === 'done') {
    const r = { m: v.m, L: v.L, l: v.l, N: v.timerN, t: v.timerValue };
    return { src: 'timer', r, c: calcFromReading(r) };
  }
  return null;
}

export const LAB = {
  /* ---------------------------------------------------------------- Branding */
  title: 'Moment of Inertia of a Bar',
  logo: 'images/nitk.webp',
  footer: 'Copyright © SOLVE The Virtual Lab @ NITK Surathkal',

  /* ---------------------------------------------------------------- Sections */
  sections: [
    { id: 'diagram',     title: 'Diagram',     icon: 'images/diagram.svg',     accent: '#3b82f6', interactive: false },
    { id: 'formula',     title: 'Formula',     icon: 'images/formula.svg',     accent: '#8b5cf6', interactive: false },
    { id: 'simulation',  title: 'Simulation',  icon: 'images/simulation.svg',  accent: '#0d9488', interactive: true  },
    { id: 'observation', title: 'Observation', icon: 'images/observation.svg', accent: '#f59e0b', interactive: false },
    { id: 'calculation', title: 'Calculation', icon: 'images/calculation.svg', accent: '#6366f1', interactive: false },
    { id: 'results',     title: 'Results',     icon: 'images/results.svg',     accent: '#f43f5e', interactive: false }
  ],

  /* ---------------------------------------------------------------- Diagram */
  diagram: {
    image: 'images/Compound Pendulum Diagram.png',
    alt: 'Bar pendulum hung from a pivot pin, with an IR gate and digital timer',
    caption: 'Fig. 1: Bar pendulum hung from the hole at distance l from its centre of gravity G. The IR gate sits at the lower end of the bar and the digital timer counts N oscillations.'
  },

  labels: { start: 'Release bar', pause: 'Pause', resume: 'Resume', reset: 'Reset' },

  /* ---------------------------------------------------------------- Extra buttons (appear beside Release / Pause / Reset) */
  extraButtons: [
    { id: 'arm',    label: 'Timer START',      run: (m) => m.timerPress('start') },
    { id: 'treset', label: 'Timer RESET',      run: (m) => m.timerPress('reset') },
    { id: 'stop',   label: 'Stop the bar',     run: (m) => m.stopPendulum(true) },
    { id: 'align',  label: 'Auto-align gate',  run: (m) => m.alignGate(false) },
    { id: 'record', label: 'Record reading',   run: (m) => m.recordReading() },
    { id: 'clear',  label: 'Clear readings',   run: (m) => m.clearReadings() }
  ],

  /* ---------------------------------------------------------------- Display toggles */
  toggles: [
    { id: 'beam',   label: 'IR beam',     checked: true }
  ],

  /* ---------------------------------------------------------------- Variables */
  variables: [
    { name: 'L',     label: 'Length of bar, L',            min: 0.4,  max: 0.8,  step: 0.01,  value: 0.8,  unit: 'm'  },
    { name: 'm',     label: 'Mass of bar, m',              min: 0.3,  max: 1.5,  step: 0.01,  value: 1,    unit: 'kg' },
    { name: 'l', label: 'Pivot to CG, l (+ above CG)', min: -0.375, max: 0.375, step: 0.025, value: 0.15, unit: 'm', snap: true },
    { name: 'slide', label: 'Slide bar: pivot hole from top', min: 0.025, max: 0.775, step: 0.025, value: 0.25, unit: 'm', snap: true },
    { name: 'N',     label: 'Oscillations timed, N',       min: 1,    max: 20,   step: 1,     value: 10,   unit: ''   },
    { name: 'angle', label: 'Set release angle, θ₀',       min: 0,    max: GEO.maxDragAngle / DEG,    step: 0.5,   value: 4,    unit: '°'  },
    { name: 'gateY', label: 'IR gate height above floor', min: 0.18, max: 1, step: 0.001, value: 0.55, unit: 'm' },
    { name: 'pin', label: 'Pivot pin withdrawal (0 = in, 1 = out)', min: 0, max: 1, step: 0.01, value: 0, unit: '' },
    { name: 'speed', label: 'Simulation speed',            min: 1,    max: 20,   step: 1,     value: 5,    unit: '×'  }
  ],

  /* ---------------------------------------------------------------- Status bar */
  statusText: (s) => {
    const v = s.values;
    if (v.busy) return 'Re-hanging the bar…';
    if (v.free) return 'Pin out — slide the bar to another hole';
    if (v.l === 0) return 'Pivot at CG — choose a hole above CG to oscillate';
    if (v.l < 0) return 'Pivot below CG — choose a hole above CG to oscillate';
    if (s.paused) return 'Paused';
    if (v.holding) return 'Angle set — press Release bar';
    if (v.timerState === 'done') return `Timer stopped: t = ${fixed(v.timerValue, 3)} s`;
    if (v.timerState === 'running') return `Timing… ${v.timerCount} / ${v.timerN} oscillations`;
    if (v.timerState === 'armed') return v.swinging ? 'Timer armed — waiting for the beam' : 'Timer armed — release the bar';
    return s.running ? 'Bar swinging' : 'Ready';
  },

  /* ---------------------------------------------------------------- Results */
  results: [
    { label: 'Timer reading, t',          unit: 's',     decimals: 3, get: (s) => resultRow(s)?.r.t ?? '—' },
    { label: 'Oscillations, N',           unit: '',      decimals: 0, get: (s) => resultRow(s)?.r.N ?? '—' },
    { label: 'Time period, T = t / N',    unit: 's',     decimals: 4, get: (s) => resultRow(s)?.c.T ?? '—' },
    { label: 'I (experiment)',            unit: 'kg m²', decimals: 4, get: (s) => resultRow(s)?.c.Iexp ?? '—' },
    { label: 'I (theory)',                unit: 'kg m²', decimals: 4, get: (s) => resultRow(s)?.c.Ith ?? '—' },
    { label: 'Percentage error',          unit: '%',     decimals: 2, get: (s) => resultRow(s)?.c.err ?? '—' },
    { label: 'Readings recorded',         unit: '',      decimals: 0, get: (s) => s.readings.length }
  ],

  resultsBar: {
    label: 'Agreement with theory',
    unit: '%',
    decimals: 1,
    get: (s) => { const r = resultRow(s); return r ? Math.max(0, 100 - r.c.err) : 0; },
    full: () => 100
  },

  /* ---------------------------------------------------------------- Observation */
  observationText: (s) => {
    const v = s.values;
    const base = `Bar L = ${fixed(v.L, 2)} m, m = ${fixed(v.m, 2)} kg, hung from a hole l = ${fixed(v.l, 3)} m from the centre of gravity; timing N = ${v.timerN} oscillations.`;
    if (v.free) return `${base} The pivot pin is out, so the bar is free: drag it up or down to line another hole up with the pin, then push the pin back in.`;
    if (v.timerState === 'done') return `${base} The timer stopped at t = ${fixed(v.timerValue, 3)} s. Press “Record reading” to add it to the table.`;
    if (!v.gateAligned) return `${base} The IR beam is not crossing the bar — drag the gate up or down (or use Auto-align gate).`;
    if (v.timerState === 'idle') return `${base} Arm the timer with START, then release the bar from a small angle.`;
    return base;
  },

  readingsTable: {
    title: 'Recorded readings (change l and repeat)',
    emptyText: 'Run the timer, then press “Record reading”.',
    columns: [
      { key: 'm', label: 'm (kg)',  format: (v) => fixed(v, 2) },
      { key: 'L', label: 'L (m)',   format: (v) => fixed(v, 2) },
      { key: 'l', label: 'l (m)',   format: (v) => fixed(v, 3) },
      { key: 'N', label: 'N',       format: (v) => `${v}` },
      { key: 't', label: 't (s)', format: (v) => fixed(v, 3) },
      { key: 'T', label: 'T (s)', format: (_, r) => fixed(calcFromReading(r).T, 4) },
      { key: 'Iexp', label: 'I<sub>exp</sub> (kg m²)', format: (_, r) => fixed(calcFromReading(r).Iexp, 4) },
      { key: 'Ith', label: 'I<sub>theory</sub> (kg m²)', format: (_, r) => fixed(calcFromReading(r).Ith, 4) },
      { key: 'err', label: '% Error', format: (_, r) => fixed(calcFromReading(r).err, 2) }
    ]
  },

  /* ---------------------------------------------------------------- Formulas */
  formulas: [
    {
      id: 'period',
      name: 'Time period of a bar (compound) pendulum',
      usage: 'A rigid bar swinging through small angles about a horizontal pivot at distance $l$ from its centre of gravity.',
      latex: 'T = 2\\pi\\sqrt{\\frac{I}{m g l}}',
      variables: [
        { symbol: 'T', desc: 'Time period of one oscillation (s)' },
        { symbol: 'I', desc: 'Moment of inertia about the pivot (kg m²)' },
        { symbol: 'm', desc: 'Mass of the bar (kg)' },
        { symbol: 'g', desc: 'Acceleration due to gravity, 9.8 m/s²' },
        { symbol: 'l', desc: 'Distance from the pivot to the centre of gravity (m)' }
      ]
    },
    {
      id: 'iexp',
      name: 'Moment of inertia from the measurements',
      usage: 'Rearranging the period formula gives $I$ from the measured time period $T = t/N$.',
      latex: 'I_{exp} = \\frac{m g l\\,T^{2}}{4\\pi^{2}}',
      variables: [
        { symbol: 'T', desc: 'Time period, $T = t/N$ (s)' },
        { symbol: 't', desc: 'Time shown by the digital timer for $N$ oscillations (s)' },
        { symbol: 'N', desc: 'Number of oscillations timed' }
      ]
    },
    {
      id: 'itheory',
      name: 'Theoretical moment of inertia (parallel-axis theorem)',
      usage: 'For a uniform bar of length $L$ the moment of inertia about its centre is $mL^2/12$; shifting the axis by $l$ adds $ml^2$.',
      latex: 'I_{theory} = \\frac{m L^{2}}{12} + m l^{2}',
      variables: [
        { symbol: 'L', desc: 'Length of the bar (m)' },
        { symbol: 'l', desc: 'Distance of the pivot from the centre of gravity (m)' }
      ]
    },
    {
      id: 'error',
      name: 'Percentage error',
      usage: 'Compares the experimental value with the theoretical one.',
      latex: '\\% \\text{ error} = \\frac{\\left| I_{exp} - I_{theory} \\right|}{I_{theory}} \\times 100',
      variables: [
        { symbol: 'I_{exp}', desc: 'From the measured time period (kg m²)' },
        { symbol: 'I_{theory}', desc: 'From $mL^2/12 + ml^2$ (kg m²)' }
      ]
    }
  ],

  /* ---------------------------------------------------------------- Calculation
     Defaults are a typical reading for L = 0.80 m, m = 1 kg, l = 0.15 m, N = 10.   */
  calculation: {
    inputs: [
      { id: 'm', label: 'Mass m (kg)',               value: 1,    step: 0.01,  min: 0.01 },
      { id: 'L', label: 'Length of bar L (m)',       value: 0.8,  step: 0.01,  min: 0.01 },
      { id: 'l', label: 'Pivot to CG distance l (m)', value: 0.15, step: 0.025, min: 0.001 },
      { id: 'N', label: 'Oscillations N',            value: 10,   step: 1,     min: 1 },
      { id: 't', label: 'Timer reading t (s)',       value: 14.3, step: 0.001, min: 0.001 }
    ],
    steps: [
      {
        key: 'T', title: 'Step 1: Time period (T)',
        latex: 'T = \\frac{t}{N}',
        substitute: (v) => `\\frac{${v.t}}{${v.N}}`,
        compute: (v) => v.t / v.N,
        unit: 's', digits: 4
      },
      {
        key: 'Iexp', title: 'Step 2: Experimental moment of inertia (I<sub>exp</sub>)',
        latex: 'I_{exp} = \\frac{m g l T^{2}}{4\\pi^{2}}',
        substitute: (v, r) => `\\frac{${v.m} \\times ${G_NOM} \\times ${v.l} \\times ${r.T.toFixed(4)}^{2}}{4\\pi^{2}}`,
        compute: (v, r) => (v.m * G_NOM * v.l * r.T * r.T) / (4 * Math.PI * Math.PI),
        unit: 'kg m$^{2}$', digits: 4
      },
      {
        key: 'Ith', title: 'Step 3: Theoretical moment of inertia (I<sub>theory</sub>)',
        latex: 'I_{theory} = \\frac{m L^{2}}{12} + m l^{2}',
        substitute: (v) => `\\frac{${v.m} \\times ${v.L}^{2}}{12} + ${v.m} \\times ${v.l}^{2}`,
        compute: (v) => (v.m * v.L * v.L) / 12 + v.m * v.l * v.l,
        unit: 'kg m$^{2}$', digits: 4
      },
      {
        key: 'err', title: 'Step 4: Percentage error',
        latex: '\\% \\text{ error} = \\frac{|I_{exp} - I_{theory}|}{I_{theory}} \\times 100',
        substitute: (v, r) => `\\frac{|${r.Iexp.toFixed(4)} - ${r.Ith.toFixed(4)}|}{${r.Ith.toFixed(4)}} \\times 100`,
        compute: (v, r) => (Math.abs(r.Iexp - r.Ith) / r.Ith) * 100,
        unit: '\\%', digits: 2
      }
    ]
  },

  /* ---------------------------------------------------------------- Side info (non-interactive sections) */
  sideInfo: {
    diagram: {
      title: 'Diagram terms',
      items: [
        { label: '$O,\\ G$', text: 'Pivot and centre of gravity; $G$ is at $L/2$.' },
        { label: '$L,\\ l$', text: 'Bar length and pivot-to-$G$ distance.' },
        { label: '$\\theta$', text: 'Angle from vertical.' },
        { label: '$mg$', text: 'Weight acting downward at $G$.' },
        { label: '$mg\\sin\\theta$', text: 'Tangential restoring force.' },
        { label: '$mg\\cos\\theta$', text: 'Force component along $OG$.' },
        { label: '$k_g$', text: 'Radius of gyration: $I_G=mk_g^2$.' },
        { label: 'SHM', text: 'Small-angle motion: $\\sin\\theta\\approx\\theta$.' }
      ]
    },
    formula: {
      title: 'Constants',
      items: [
        { label: 'g', text: '9.8 m/s²' },
        { label: 'Hole spacing', text: '2.5 cm' },
        { label: 'Bar width', text: '35 mm' }
      ]
    },
    observation: {
      title: 'Lab Reference',
      items: [
        { label: 'Tip', text: 'Keep the release angle small (under 5°) so that $\\sin\\theta \\approx \\theta$.' },
        { label: 'Tip', text: 'Take readings for several holes, e.g. $l$ = 5, 10, 15, 20 and 25 cm.' }
      ]
    }
  },

  /* ---------------------------------------------------------------- Help */
  helpTitle: 'Procedure & Operating Guide',
  helpSubtitle: 'Select a topic from the list to view the procedure',
  help: [
    {
      id: 'simulation',
      question: 'How the Simulation works',
      title: 'How the Simulation Section Works',
      subtitle: 'Doing the experiment on the virtual bench',
      steps: [
        { title: 'Choose the bar', desc: 'Open <strong>Variables</strong> and set the length $L$ and mass $m$ of the bar.' },
        { title: 'Choose the hole', desc: 'Use <strong>Slide bar: pivot hole from top</strong> or set $l$ to choose any drilled hole. Both inputs snap to the closest hole and update each other. With the pin inserted, the bar is re-hung automatically. <em>To slide by hand</em>: pull the pivot pin towards you, drag the bar up or down until another hole lines up with the pin, then push the pin back in.' },
        { title: 'Align the IR gate', desc: 'Drag the IR gate up or down its clamp until the red beam crosses the lower end of the bar. <strong>Auto-align gate</strong> does it for you. The gate cannot go through the bar and the bar cannot go through the gate.' },
        { title: 'Arm the timer', desc: 'Press the <strong>START</strong> button on the digital timer (or <strong>Timer START</strong>). The display shows <em>ARMED</em>. Use <strong>N−</strong> / <strong>N+</strong> or the slider to choose $N$.' },
        { title: 'Release the bar', desc: 'Press <strong>Release bar</strong>, or drag the bar sideways and let go. Changing the release-angle input first holds the bar visibly at that angle until Release bar is pressed. The timer starts at the first beam cut and stops after $N$ oscillations.' },
        { title: 'Record and repeat', desc: 'Press <strong>Record reading</strong>, change $l$, and repeat. Then use <em>Calculation</em> to find $I_{exp}$ and compare it with $I_{theory}$.' }
      ],
      tip: 'The timer counts only after START has been pressed, so arm it before you release the bar.'
    },
    {
      id: 'mouse',
      question: 'Mouse and touch controls',
      title: 'Moving the apparatus',
      subtitle: 'Everything is moved the way you would move it in the lab',
      steps: [
        { title: 'Bar', desc: 'Drag sideways to swing it. Motion is limited by the bar width and mount opening. With the pin out, drag it up/down through the full marked range; release it to snap to the nearest hole. The gate retreats if needed. The Slide bar input shows the nearest hole distance from the top end, and its slider and number box always agree. The live θ readout beside the status shows the actual angle; the release-angle input sets the next release. Reset and Stop the bar restore θ = 0°.' },
        { title: 'Pivot pin', desc: 'Click it, or drag it downwards, to pull it out. Push it back in once a hole is lined up.' },
        { title: 'IR gate', desc: 'Drag it up/down. The clamp, arm and cable move with it.' },
        { title: 'Variables and limits', desc: 'Length L changes the uniform bar and its CG (L/2). Mass changes inertia. Slide bar and pivot distance l snap to actual drilled holes, 2.5 cm apart, with limits following bar length. All holes can be selected; l is positive above CG, zero at CG and negative below CG. Time oscillations with a pivot above CG; a central pivot has no restoring torque and a pivot below CG is unstable. Gate height is measured from the floor and stops below the bar. Pin withdrawal runs from 0 (inserted) to 1 (out); stop the bar before withdrawing it. Release angle immediately positions and holds the bar for the Release button; use small angles (up to 5°) for measurements with the small-angle formulas, N sets the timer count, and speed changes playback only. Changing the setup clears the timer, so measure again.' },
        { title: 'Timer buttons', desc: 'Click START, RESET, N− and N+ on the timer.' },
        { title: 'View', desc: 'Drag empty space to tilt slightly, scroll or pinch to zoom, and use the View selector in Variables to inspect the pivot, gate or timer.' }
      ],
      tip: 'Use Variables for fine numeric adjustments. View presets inspect each component. Leaving a section restores the overview without clearing readings. Use the sliders and number inputs to adjust the apparatus precisely.'
    },

    {
      id: 'diagram', question: 'Diagram', title: 'Read the diagram',
      subtitle: 'Geometry, forces and symbols',
      steps: [
        { title: 'Identify the suspension', desc: 'O is the pivot and G is the centre of gravity. For this uniform bar, G is L/2 from either end; l is the distance from O to G.' },
        { title: 'Read the forces', desc: 'Weight mg acts downward at G. The tangential component mg sin θ returns the pendulum toward vertical. The component mg cos θ lies along OG.' },
        { title: 'Use the term panel', desc: 'The right panel explains θ, radius of gyration k_g, SHM and the remaining symbols. The drawing is fitted to the available area.' }
      ]
    },
    {
      id: 'formula', question: 'Formula', title: 'Choose a formula',
      subtitle: 'Connect measured time to inertia',
      steps: [
        { title: 'Select an equation', desc: 'Use the formula dropdown to view the period, experimental inertia, parallel-axis theorem or percentage error.' },
        { title: 'Check symbols and units', desc: 'Read the usage note and variables beside the equation. Use metres, kilograms and seconds. The period is T = t/N.' },
        { title: 'Compare the same axis', desc: 'Both experimental and theoretical inertia refer to the pivot axis. The theoretical value includes the shift ml² from the centre of gravity.' }
      ]
    },
    {
      id: 'observation', question: 'Observation', title: 'Record observations',
      subtitle: 'Save complete trials',
      steps: [
        { title: 'Complete the timing', desc: 'In Simulation, set N, align the gate, press Timer START and release the bar. Wait until the timer shows HOLD.' },
        { title: 'Save a row', desc: 'Press Record reading in Controls. The table stores m, L, l, N and t, then calculates T, experimental inertia, theoretical inertia and percentage error.' },
        { title: 'Repeat and review', desc: 'Change the pivot distance and repeat. Scroll the table horizontally on smaller screens. Reset retains saved readings; Clear readings removes them.' }
      ]
    },
    {
      id: 'calculation', question: 'Calculation', title: 'Work through a reading',
      subtitle: 'Substitution and calculation',
      steps: [
        { title: 'Enter a saved trial', desc: 'Copy m, L, l, N and t from one Observation row into Calculation Variables. These inputs are separate from the simulation controls.' },
        { title: 'Follow the steps', desc: 'The working updates as you type: first T = t/N, then experimental inertia, theoretical inertia and percentage error. Use positive values and keep the units consistent.' },
        { title: 'Interpret the result', desc: 'Compare the two inertia values about the pivot. Small differences can arise from the apparatus model, finite amplitude and timer rounding.' }
      ]
    },
    {
      id: 'results', question: 'Results', title: 'Read the results',
      subtitle: 'Summary of the measured trial',
      steps: [
        { title: 'Choose the source', desc: 'Results displays the most recently recorded trial. If there are no saved trials, it uses a completed timer measurement.' },
        { title: 'Inspect the summary', desc: 'Review elapsed time, oscillation count, period, experimental inertia, theoretical inertia and percentage error. The agreement bar is 100 minus percentage error, limited to zero at the lower end.' },
        { title: 'Update the summary', desc: 'Record a new completed trial to replace the displayed result. The readings count shows how many trials remain in Observation.' }
      ]
    },
    {
      id: 'dashboard', question: 'Dashboard and navigation', title: 'Move between sections',
      subtitle: 'Previews, saved state and fullscreen',
      steps: [
        { title: 'Open a section', desc: 'Select a dashboard preview or use the navigation rail. The Simulation preview follows the live apparatus.' },
        { title: 'Return to the overview', desc: 'Close returns to the dashboard. Changing sections restores the simulation camera overview while retaining the experiment and recorded readings.' },
        { title: 'Inspect the scene', desc: 'Use View in Variables for pivot, gate or timer close-ups. The scene fullscreen icon enlarges the viewport; the header fullscreen icon enlarges the whole page. Press Escape to exit fullscreen or close Help.' }
      ]
    },

  ]
};
