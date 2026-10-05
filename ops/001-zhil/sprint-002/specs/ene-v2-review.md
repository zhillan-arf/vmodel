# Ene v2 appearance review

Date: 2026-10-05.
Status: User review and physical tests remain open.

Ene v2 is a separate edited copy of the cyber-legs model.
The [plan](ene-v2-plan.md) defines its scope.
The [verification report](../reports/ene-v2-verification.md) records the measured results and limits.
The original Ene remains available in VModel.

## Files

| File | Use |
| --- | --- |
| [Image comparison](../reports/local/ene-v2/index.html) | Compare 37 paired views, including expressions, cuffs, transparency, and spring movement. |
| [Ene v2 VRM](../../../../assets/avatars/ene-v2.vrm) | Load the edited model in a VRM application. |
| [Blender source](../../../../assets/work/ene-v2/ene-v2.blend) | Edit the model, materials, and face shapes. |
| [Recipe](../../../../config/avatars/ene-v2.json) | Specify repeatable changes to the original VRM. |
| [Build report](../reports/ene-v2-build.json) | Check source hashes and preserved data. |
| [Browser report](../reports/ene-v2-comparison.json) | Check controls, cuff separation, springs, and image hashes. |
| [Blender report](../reports/ene-v2-blender.json) | Check the saved source and a separate VRM viewer. |

The model, Blender file, and images remain local.
Git excludes those files.
The [source terms](../../../../public/avatars/ene-v2-notices/index.html) retain their original bytes and text encoding.
The original asset restrictions still apply.

## Appearance checks

1. Open the image comparison.
2. Compare the front, side, and back views.
3. Examine hair and cyber-leg edges on both backgrounds.
4. Compare the smile, blink, wink, mouth, and `ee` views.
5. Examine the combined expression for eyelid or mouth defects.
6. Compare each hand gesture and wrist turn.
7. Examine the cuff opening and the exposed wrist.
8. Compare the moving hair and its position after recovery.
9. Record the preferred appearance and any visible defect.

The paired views use equal camera settings, lights, and input poses.
The new brow controls and `ee` shape exist only on Ene v2.
These tests use fixed synthetic input.
They do not measure live camera accuracy.

| Item | User result |
| --- | --- |
| Character appearance | Not reviewed |
| Face and eye appearance | Not reviewed |
| Blink, smile, and mouth shapes | Not reviewed |
| Separate brow controls | Not reviewed |
| Shorter cuffs and exposed wrists | Not reviewed |
| Hair movement and contact | Not reviewed |
| Cyber-leg transparency | Not reviewed |
| Overall appearance | Not accepted |

## VModel setup

1. Start VModel with the existing local launcher.
2. Select **Ene v2 · Appearance test**.
3. Set **Face controls** to **More detail**.
4. Set **Light** to **Studio**.
5. Set **Light intensity** to `0.85`.
6. Set **Frame** to **Upper body** or **Face**.
7. Set **Camera field of view** to `42`.
8. Set **Output size** to **1080p**.
9. Set **Hair & accessory motion** to **Gentle**.
10. Start the camera.
11. Face the camera with relaxed brows and a closed mouth.
12. Select **Recenter & calibrate**.
13. Select **Neutral** to use continuous facial controls.

More detail uses camera estimates and the available face shapes.
It does not identify spoken vowels.
Smile and Surprise replace continuous facial controls until you select Neutral.
VModel saves appearance settings for each model hash.

## Physical checks

1. Open the output window.
2. Verify landscape and portrait output at 1080p.
3. Raise each eyebrow separately.
4. Close each eye separately.
5. Open your mouth, smile, and round your lips.
6. Perform open-hand, fist, point, and peace-sign gestures with each hand.
7. Bend and turn each wrist while you examine cuff contact.
8. Turn your head quickly and examine hair recovery.
9. Lean in the seated position and examine the jacket and shoulders.
10. Run the existing [human procedure](human-test.md) with Ene v2.
11. Record a 15-minute combined camera and output session.
12. Save the trace, video, settings, computer details, and observations together.

The [motion targets](sprint-002-plan.md#acceptance-targets) remain unchanged.
The intended computer must supply GPU timing, camera delay, detector cadence, and gesture accuracy.
The shorter cuffs cannot correct hidden or inaccurate hand observations.

## Rebuild and check

Run these commands from the repository root:

```bash
python scripts/build_ene_v2.py
blender --background --python-exit-code 1 --python scripts/ene_v2_blender.py
npm test
npm run build
npm run test:ene-v2
node scripts/v2_studio_smoke.mjs ene-v2
```

The build requires the original Ene VRM and the source terms from the local research directory.
The recipe requires the recorded source hash.
The Blender command requires the local add-ons from the existing setup.
The recipe produces the tested VRM directly.
The Blender file supplies editable source work.
Changes made in Blender require a separate export and the same checks.
