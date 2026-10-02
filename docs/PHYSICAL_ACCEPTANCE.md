# Physical Camera Acceptance

Current primary acceptance path: fixed Windows webcam, manual calibration, floor,
furniture/transforms/measurement, T0/T1/T2, interpolation, comparison and PNG.
iPhone and marker/Cube Lab hardware results are optional secondary checks and do
not gate the webcam version.

## Optional Cube Lab Experiment

The owner reports the Windows webcam is already working. The physical cube
experiment has not yet been tested by the owner. Automated marker-pixel tests
must not be treated as evidence of real lens accuracy or physical alignment.

| Cube Lab Hardware Check | Result |
| --- | --- |
| Webcam model / resolution / fixed mounting / FOV | Pending |
| Printed ID 101 black edge actual width / cube side | Pending |
| Real detection / approximate alignment / XYZ and rotation | Pending |
| Left/right/near/far/up/rotate recorded | Pending |
| Marker loss / no invalid samples / reacquire | Pending |
| Stop decouples physical cube / scrub / playback speeds / loop | Pending |
| Trajectory / Start, Left, Right, Near, Far, Rotated keyframes | Pending |
| Export / save / import and replay with webcam off | Pending |
| Observed errors and fixes | Pending |

Run the exact two tests in [CUBE_MARKER_SETUP](CUBE_MARKER_SETUP.md). Do not call
the first physical 4D milestone complete until these checks are recorded.

## Primary Webcam and Secondary iPhone Protocol

Current development priority: fixed Windows webcam and manual calibration.
iPhone/marker records below remain secondary; they do not gate webcam development.

| Primary Webcam Check | Result |
| --- | --- |
| Windows/browser/webcam model and fixed mounting | Pending |
| Permission, live frames, resolution and FPS | Pending |
| Manual A/B/C and measured A-B | Pending |
| Grid/alignment and approximate measurement error | Pending |
| Place/move/rotate/scale without phone or marker | Pending |
| T0/T1/T2 scrub/interpolation/play/pause | Pending |
| Compare/composite PNG/save/reopen | Pending |
| Move webcam, Recalibrate, retain all room content | Pending |

Status: **pending owner hardware tests**. Automated browser tests cannot fill in
this record.

| Field | Result |
| --- | --- |
| Test date | Pending |
| Windows / browser version | Pending |
| iPhone / iOS / Safari | iPhone 16e / pending |
| Wi-Fi / subnet / isolation | Pending |
| HTTPS CA installation/trust | Pending |
| QR opens camera page | Pending |
| Camera permission / rear camera | Pending |
| Moving video received on Windows | Pending |
| Actual resolution / FPS | Pending |
| Approximate glass-to-glass latency | Pending |
| Orientation change | Pending |
| Stop / restart / reconnect | Pending |
| Errors and fixes | Pending |
| Printed marker actual edge length / lighting | Pending |
| Marker found / pose alignment / smoothing | Pending |
| Marker loss / last-pose hold / reacquire | Pending |
| Manual A/B/C distance / repeatability | Pending |
| Tape-measure error in meters / percent | Pending |
| Furniture transforms / overlap / measurements | Pending |
| T0/T1/T2 scrub / play / pause / next / previous | Pending |
| Camera stays live during timeline | Pending |
| Save / host restart / reopen / all states | Pending |
| Compare / composite and 3D-only exports | Pending |

Pass the live-camera milestone when the actual rear-camera video appears and
continues moving on the Windows viewport. The expanded brief authorizes planner
implementation, but does not waive this physical acceptance. Final live-room
acceptance additionally requires calibration, editing, full timeline, export and
save/reopen; record approximate accuracy rather than implying surveying precision.
