# Project Proposal

## Title

4D LiveSpace: Real-Time Room Digital Twin and Temporal Layout Planner

## Problem

Users often have difficulty visualizing how a physical room may change when
furniture is moved, replaced, added or removed. Static plans do not readily
communicate changes between bedroom, study and gaming arrangements.

## Solution

A Windows system receives live iPhone Safari camera video, overlays an
approximately calibrated 3D environment and stores multiple room configurations.
Temporal interpolation animates furniture position, rotation, scale, visibility
and existence. X/Y/Z describe space; T describes layout state/time. This is an
editable planning model, not automatic depth reconstruction.

## Deliverables And Evaluation

Preserved camera transport; manual/reference-marker calibration; furniture
editing and reversible commands; local projects with backups; real state
interpolation, comparison, demo and exports; tests and university documentation.
CURRENT_SYSTEM_AUDIT.md records reuse decisions and PROGRESS.md records evidence.

Evaluate browser transport and workflows automatically. Evaluate physical Safari,
Wi-Fi recovery, marker stability, alignment repeatability and tape-measure error
on real devices. Target users are students, renters and homeowners; record
task-completion time and errors in usability sessions. No architectural accuracy
is claimed.
