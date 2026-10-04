# TASK-052 implementation evidence

Date: 2026-10-04. Status: Done.

Separate pose and hand views, optional wrist alignment, raw details, and keyboard controls pass the required checks.

See the [shared implementation record](studio-implementation.md) for files, commands, results, requirement mapping, and remaining checks.
See the [browser results](studio-features-smoke.json) for synthetic test results.

This record closes TASK-052. Physical tracking acceptance remains under TASK-055 and TASK-056.

## Raw geometry and detail coordinates

`src/tracking-inspector-3d.ts` now builds estimated segments separately from the motion solver.
Missing and nonfinite endpoints omit their segment. Valid zero coordinates remain valid.
The coordinate transform preserves raw lengths and absolute positions.
A unit fixture changes a segment from five meters to ten meters without a fixed rig constraint.
All seven coordinate and segment tests pass.

The Estimated 3D detail panel previously showed image coordinates.
It now shows the original world coordinates with a meter label.
The display transform affects rendered geometry only.
The browser checks original Y = -1.4 beside displayed Y = 1.4.

`node scripts/tracking_overlay_smoke.mjs` verifies actual rendered geometry and omitted invalid edges.
Keyboard orbit, zoom, and reset work with reduced motion enabled.
A return to Observations releases all renderer geometries and removes the 3D canvas.
The [browser report](tracking-overlay-smoke.json) records these results.
Type checking passes.

The front, side, and rotated checks pass as recorded below.

## Face counts and calculated wrist alignment

The browser draws face contours before dense points are enabled.
Dense mode draws exactly 478 and 468 points for the two supplied observation arrays.
Missing visibility and presence values remain absent from the detail data.
The installed worker independently produced 478 face points in [the functional tracking check](tracking-positive-functional.json).

Calculated wrist alignment is now an optional control. The separate hand estimate remains the default.
The calculation uses the existing hand association and `poseWrist + (handPoint - handWrist)` before the display transform.
The combined view shows the pose and the selected aligned hand.
The detail panel keeps the associated hand's original world coordinates.
Missing samples, invalid coordinates, or failed association remove the alignment.
A status message identifies unavailable alignment.

All six segment and alignment unit tests pass.
The browser checks successful alignment and removal after an ambiguous association.
The source frame remains unchanged in the unit check.
No tracking threshold, scheduler, or solver behavior changes.

## Front, side, and rotated views

The first front-view image showed clipped lower legs.
The initial camera target used the canonical skeleton height for raw pose coordinates.
The estimated camera now targets the raw origin. The canonical camera retains its one-meter target.
The renderer no longer sets a fixed CSS width.

Reviewed images show the complete synthetic pose from front, rotated, and side positions.
Images: `ops/001-zhil/sprint-001/reports/local/estimated-views/front.png`, `rotated.png`, and `side.png`.
The browser projects all known pose points inside the front camera bounds.
It waits for a rendered frame before it reads the camera matrices.
The canvas fits its panel at widths of 390, 768, and 1440 pixels without page overflow.
Five additional layer changes each release all previous renderer geometries and the graphics context.

The [browser report](tracking-overlay-smoke.json) records camera positions, panel widths, and disposal results.
These synthetic checks establish the display behavior. They do not establish physical tracking accuracy.
