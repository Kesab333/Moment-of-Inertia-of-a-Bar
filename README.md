# Moment of Inertia of a Bar (SOLVE Virtual Lab)

Built from the SOLVE Virtual Lab template. Files that differ from the template: `js/config.js`, `js/physics.js`, `js/scene.js`, small hooks in `js/app.js` and `js/controls.js`, `css/scene-ui.css`, `images/Compound Pendulum Diagram.png`.

---

# Original template notes

A reusable static-site template for creating interactive SOLVE Virtual Lab experiments. The template separates generic navigation, layout, controls, graphs, modals, and dashboard behavior from experiment-specific configuration, physics, and scene code.

## What the template provides

- Dashboard and section navigation.
- Diagram, formula, simulation, observation, calculation, graph, and results panels.
- Responsive layout and reusable UI components.
- Configurable controls, variables, modes, labels, formulas, and result formatting.
- A small runnable damped-oscillator demonstration.
- Extension points for replacing the demonstration physics and 3D scene.

## Create a new experiment

1. Copy this directory to a new experiment folder.
2. Edit `js/config.js` for the title, sections, variables, formulas, labels, observations, and results.
3. Replace the demonstration model in `js/physics.js`.
4. Replace the placeholder scene in `js/scene.js` or the relevant workspace module.
5. Replace diagrams, icons, and branding assets under `images/`.
6. Update the copied README and LICENSE with the experiment's final title and attribution.

## Run locally

Serve the folder with any static HTTP server, then open `index.html` in a modern browser. A local server is recommended because the application uses JavaScript modules and an import map.

For example, from this directory:

```text
python -m http.server 8000
```

Open `http://localhost:8000` in the browser. The page loads KaTeX, fonts, and Three.js from public CDNs, so an internet connection is required for those external assets.

## Project structure

- `index.html` — template shell.
- `js/config.js` — experiment-specific configuration.
- `js/physics.js` — demonstration physics model to replace.
- `js/scene.js` / `js/workspace.js` — simulation and workspace behavior.
- `css/` — reusable visual components and responsive styles.
- `images/` — template diagrams, icons, and branding.

## Developer and attribution

- **Developer/maintainer:** SOLVE Virtual Lab team
- **Institution:** National Institute of Technology Karnataka (NITK), Surathkal
- **Project:** SOLVE Virtual Lab experiment template
- **Contact:** No individual contact details are defined in this distribution. Please use the official NITK/SOLVE project channel when publishing or adapting this work.

## License

This template is distributed under the MIT License. See [LICENSE](LICENSE).

