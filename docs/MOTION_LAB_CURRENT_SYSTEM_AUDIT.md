# Motion Lab Current System Audit

Audit date: 2026-10-02. This is an extension of the existing application.

## Current Architecture

- npm workspaces: apps/desktop-web, apps/phone-camera, apps/server and packages.
- React 19 / TypeScript / Vite frontend; Express 5 hosts Vite in development
  and dist/web in production. HTTP desktop, HTTPS LAN phone, WebSocket signaling.
- main.tsx lazily isolates phone and raw webcam routes from DesktopApp.
- DesktopApp owns webcam/phone/file/sample-room media; WebcamController owns
  native acquisition and teardown. Local media uses revocable object URLs.
- ThreeSceneManager, room-engine and layouts packages implement calibration,
  placement, transforms, measurements, comparison and layout interpolation.
- Cube Lab has its own store, marker worker, pose recording and replay.
  js-aruco2 is marker recognition, not human pose inference.
- Planner WorkspaceStore uses useSyncExternalStore. ModeBar owns navigation.
  Room time interpolates layouts, not source video timestamps; do not repurpose it.
- Zod project schema and ProjectRepository provide validated local JSON storage,
  autosave and backups. Optional motion references can extend schema version 1
  without changing existing room projects or embedding media.
- Shared dark CSS, lucide icons, segmented controls and dense work panels.
- Vitest unit tests, Playwright browser regressions, production smoke and physical
  webcam scripts. npm run check runs lint/typecheck/unit tests/build.

## Reuse And Boundaries

Reuse navigation, icons, local server, schema validation, store conventions,
Three.js and OrbitControls, project edits and browser download patterns.
Keep human video analysis separate from both room and cube pose engines.
Use video time as the sole motion clock. Render transforms outside React state.
Entering Motion Lab releases webcam acquisition; no iPhone or marker is required.

## Video Preparation

Root IMG_0135.MOV is present and private. Its metadata must be probed, never
hard-coded. No existing FFmpeg service/dependency; ffmpeg/ffprobe are not on PATH.
Add packaged local binaries with environment overrides, root-only discovery,
probe parser, range-capable stream endpoint and identity-keyed MP4 cache.
Normalize orientation during preparation; infer from those decoded pixels.
Root videos, previews, downloaded models and analyses are ignored by Git.
Private routes must require loopback and reject cross-origin access.

## Added Modules / Dependencies

- Server motion service/routes: discovery, FFprobe, FFmpeg, model asset serving.
- Shared motion types/schema/math: samples, interpolation, mapping and velocity.
- Desktop motion modules: store, worker/controller, player/overlay, 3D renderer,
  timeline, settings/inspector/graphs/export/manual club annotations.
- MediaPipe Tasks Vision for real 33-landmark pose estimation; verify installed
  API and official worker usage. Local WASM/model assets, CPU worker inference.
- ffmpeg-static / ffprobe-static for missing local tools; no cloud inference.
- A maintained lightweight chart library for derived motion plots.

## Existing Files To Extend

.gitignore, package.json/lock, server index, main route/ModeBar/DesktopApp,
shared project schema, README and documentation. Existing room/Cube/camera
algorithms remain unchanged. Add focused pure tests, API security tests,
browser flows and a real local-video integration script. Never stage the video,
generated caches, screenshots or exported personal motion data.
