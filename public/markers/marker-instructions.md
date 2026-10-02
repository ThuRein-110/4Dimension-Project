# Floor Reference Marker

Dictionary: ARUCO_MIP_36h12. ID: 100. Default black outer square: 20 cm by 20 cm.
Print marker-print.pdf on A4 at 100%, with scaling/fit-to-page disabled. Measure
the black square with a ruler; adjust the marker-size setting to its actual size.
Keep a white quiet border. Lay the paper flat on the floor with its top edge
pointing toward the room's negative Z direction. Keep all four corners visible.

The marker center is the room origin. FOV is an approximate intrinsic estimate;
change it to your camera's measured vertical FOV for better projection. Real
scale depends directly on printed size. Lighting, blur, planar ambiguity and
incorrect FOV can introduce alignment errors. This is not ARKit or SLAM.

Tracking runs in a local worker at up to 10 Hz. The last accepted camera pose is
held; Tracking Lost appears after a one-second hold. Recalibrate to reset the
filter after a large camera move. Manual calibration works without the marker.
