# Check movement on your camera

These are the remaining physical checks for Ene. Automated poses already exercise the rig, but they cannot tell us how your camera sees your movements. This check does not require a public stream or saving raw webcam footage.

Open **Start VModel.cmd**, use **Seated**, start the camera and recenter. Begin at **640×480**, **Balanced** quality and **Gentle** hair motion. Enable the camera preview only if it helps you stay in frame.

| Check | Try | Look for |
| --- | --- | --- |
| Face | Turn left/right, look up/down, blink each eye, speak | Correct direction, separate blinks and comfortable mouth movement |
| Torso and arms | Lean, raise each arm, bend your elbows | The corresponding side follows; Ene stays in frame |
| Hands | Show an open palm, make a fist, turn your wrist, cross hands | Visible fingers move and the hands recover their correct sides |
| Loss and recovery | Lower a hand out of view, cover your face briefly, return | Smooth relaxation and recovery without an extreme locked pose |
| Mirror | Toggle Mirror my performance and repeat an arm raise | Presentation flips; each tracked limb still owns its correct motion |
| Standing | Keep head and feet visible, switch to Standing, recenter; lean, raise arms, bend knees and take small steps | Recognizable movement, stable knees and bounded position |
| Stop | Click Stop or use Space in Clean view | Camera indicator turns off; Ene relaxes |

Use **Head movement range**, **Mouth sensitivity** and **Response speed** if needed. Record which setting improved the result. Standing uses simple grounding; it does not lock feet to the floor or reliably capture jumps. Hands hidden behind the body cannot be observed reliably.

Useful feedback is specific: the check, what your body did, what Ene did, seated/standing mode and the settings used. The fps/tracking values beneath the stage help diagnose slowness. Do not enter passwords, API tokens or unrelated personal details in feedback.

Voice selection, converted microphone routing and final landscape/portrait clips have separate acceptance checks. The [OBS guide](obs-setup.md) explains capture setup and the pending virtual-camera registration.
