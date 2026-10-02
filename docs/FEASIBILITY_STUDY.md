# Feasibility Study

Technical feasibility is strongest for camera transport, manual dimensions,
local storage and 3D layout editing. Browsers support camera capture and WebRTC;
Safari needs trusted HTTPS. LAN connectivity still depends on firewall and Wi-Fi
policies, and no TURN fallback is planned for V1.

Marker pose estimation now uses installed js-aruco2 detection and POSIT APIs,
verified with generated ID 100 in a real browser worker. Calibration error, lighting, motion blur and
marker loss limit precision. Manual calibration must remain available. A plain
camera stream does not supply a metric floor plane or native world tracking.

Financial requirements are existing Windows/iPhone hardware and printed markers;
there are no runtime paid APIs. Initial dependency downloads need Internet.
Operational risks include certificate onboarding, Safari suspension and varying
camera resolutions. The first milestone isolates these risks before room features.

Delivery follows the expanded 23 phases in PROJECT_PLAN.md. Camera transport,
editing, persistence and timeline have automated evidence. Physical Safari,
real-room accuracy and hardware performance remain pending. Initial dependency
downloads need Internet; runtime vision/models/assets are local and unpaid.
