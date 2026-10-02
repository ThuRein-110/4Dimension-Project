# Current System Audit

Audit date: 2026-10-02. Existing project inspected before implementation.

## Frontend

React 19, TypeScript strict mode, Vite 6, lucide-react icons, plain dark CSS.
`apps/desktop-web/src/main.tsx` dispatches `/camera` to the phone client and all
other paths to `DesktopApp`. `DesktopApp.tsx` owns source selection, media tracks,
receiver, QR/session state, preview geometry and certificate onboarding.
`apps/phone-camera/src/CameraApp.tsx` owns rear-camera preference, consent,
preview, stop/switch/connect and telemetry. FPS uses decoded video-frame counts.

## Backend and Realtime

`apps/server/src/index.ts` mounts Express and Vite middleware on localhost HTTP
5173 and LAN HTTPS 5443. Public certificate bootstrap alone uses HTTP 5442.
`scripts/certificates.ts` generates the local CA and server certificate.
`certificate-download.ts` serves the exact public CA, including from `.local`.
`sessions.ts` creates separate expiring desktop/camera credentials; `signaling.ts`
authenticates roles/origins and relays schema-validated messages.
`packages/shared/src/peer-link.ts` owns actual browser RTCPeerConnection offer,
answer, queued ICE, retry and disposal. Video travels browser-to-browser, not to
Express. `protocol.ts` defines signaling DTOs. `network.ts` supplies LAN addresses.

## Reuse and Preservation

Preserve iPhone/Safari permissions, HTTPS and QR flow, all four source choices,
reconnection, telemetry, fit/fill/fullscreen/reset, certificate fixes and startup.
Existing eleven unit/integration and seven Playwright tests form the regression
baseline. Physical iPhone acceptance must not be inferred from Chromium tests.

## Extension Points

Modify DesktopApp only to mount a persistent 3D layer, planner panels, mode bar,
project controls, timeline, status and composite export. Keep its video element
mounted across modes. Extend styles with existing neutral/lime conventions.
Extend Express with loopback-authorized project JSON endpoints and local assets.
Optional sensors may extend the existing validated control protocol separately.

Create modules in existing packages: shared project DTO/schema; room-engine
calibration/measurement/history/catalog; three-engine scene/projection/model and
raycast services; vision detector/worker/pose filtering; persistence repository;
layouts snapshot/interpolation; frontend planner store and UI components.

The reserved workspace packages currently have manifests only. No existing
calibration, furniture, Three.js, project database or timeline implementation needs
replacing. Current documentation describes the camera milestone and must be
updated to describe delivered planning functionality and honest accuracy limits.

## New Delivery Sequence

Follow the new brief's phases 0-22: audit, extension boundaries, transparent
overlay, grid, calibration/manual/marker, catalog/placement/edit/history,
measurement/collision, persistence/layouts/timeline/interpolation, comparison,
exports/demo, tests/docs/polish. The new brief explicitly authorizes continued
implementation; previous camera-only delivery gating is superseded. Physical
device/marker accuracy remains a separate acceptance record.
