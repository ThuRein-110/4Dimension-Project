# Installation

Windows 11, Node.js 22.12+, npm, Chrome/Edge with WebGL and a webcam are the primary
requirements. Wi-Fi/iPhone Safari are needed only for optional phone streaming. No Mac/Xcode, LiDAR,
native iOS app or paid service is needed.

```sh
npm install
npm run dev
```

Open http://localhost:5173. start.bat checks Node and installs only if node_modules
is absent, starts the combined frontend/backend host, prints desktop/LAN URLs and
opens the browser. Run npm install explicitly after dependency updates.

The default webcam uses local browser permission and fixed-camera manual
calibration; no phone pairing or certificate installation is required. Recalibrate
after moving the webcam. For optional iPhone streaming, select iPhone camera and
follow NETWORK_SETUP.md for public CA trust and Safari pairing. Permit Node and
desktop browser on Private networks. Defaults: loopback HTTP 5173, LAN HTTPS/WSS
5443, certificate-only HTTP 5442. PORT/HTTPS_PORT/CERT_PORT override these.
If IP changes: stop, npm run certs, restart/rescan. CA is retained. Server
certificate expires after 90 days, CA after one year. Never share private keys.

```sh
npm run check
npx playwright install chromium
npm run test:e2e
npm run test:production
npm run build
npm start
```

Stop development before production takes the same ports. Production smoke uses
isolated ports and closes its host. Initial dependency/browser installation needs
Internet; runtime assets/scripts are local. .local/projects contains validated
JSON plus one previous valid .bak; export JSON for independent backups.
.local/certs is private. Neither is committed or publicly served.
public/markers has printable references; assets/models has generated previews.
Furniture geometry is local in ModelLoader. scripts/generate-thumbnails.ts uses
the running dev host; scripts/generate-marker.ts uses installed detector APIs and
Chromium to regenerate assets.
