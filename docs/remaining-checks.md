# What's left, and what only you can do

Everything that can be finished without you is finished. The 17 open tasks all wait on the same four things: **your camera, your microphone and ears, one Windows permission prompt, and two final recordings.** Nothing here needs code edits or developer tools.

They are ordered so each one unblocks the most work. You can stop after any step; progress is recorded as you go.

## 1. Move in front of your camera (about 10 minutes)

**Unblocks seven tasks: TASK-003, 009, 010, 011, 012, 013, 015.**

Follow [Check movement on your camera](live-check.md). It walks through face, torso, arms, hands, loss and recovery, mirroring, standing and stop.

Automated fixtures already drive the rig with still photos, so the maths is exercised. What no fixture can tell us is how *your* camera sees *your* movements — lighting, distance, framing and the speed you actually move at. That is why these seven tasks are still open rather than assumed to work.

Useful feedback names the check, what your body did, what Ene did, seated or standing, and the settings used.

## 2. Say which voice you like (about 10 minutes)

**Unblocks TASK-023, and lets TASK-027 close without training a new voice.**

Run **Start Voice Auditions.cmd**. It opens the listening room at `http://127.0.0.1:5081/` with three converted English voices plus the unconverted reference, all level-matched. Leave that window open while you listen; Ctrl+C in it when you are done.

Tell us your **default** and your **alternatives**, and say what is wrong with the ones you reject — too breathy, too young, consonants mushy, whatever you hear. A voice nobody has listened to cannot be marked accepted, and a rejected fit becomes the brief for training a custom one.

There is a [suggested passage](voice-audition-passage.md) if you would rather compare them on the same words.

## 3. Approve the OBS Virtual Camera prompt (about 1 minute)

**Unblocks TASK-017.**

Run **Install OBS Camera.cmd**. Windows will show an administrator prompt; the last attempt returned *"operation was canceled by the user"*, so neither camera architecture is registered.

We deliberately do not re-trigger this prompt automatically. Without it, OBS window capture and recording still work — only the virtual camera, which is what lets Zoom, Discord and similar apps see Ene as a webcam, is unavailable.

## 4. Record the two final clips with us (about 20 minutes)

**Unblocks TASK-018, and is the last input TASK-020, TASK-021, TASK-026 and TASK-028 need.**

Once steps 1-3 are done, we record one 16:9 landscape and one 9:16 portrait clip using the real Ene avatar and your chosen voice, following the [recording guide](recording.md). Short silent fixture clips already exist and prove the file path works; they are not the deliverable, because G2 requires a playable clip with intelligible audio and a visibly animated avatar.

This step also supplies the live microphone timing that the voice work still needs.

## Where the voice work actually stands

Honest answer: **not ready, and we now know why.**

On a quiet machine the converter keeps up perfectly — a full 30-second run completed **577 of 577** neural calls with zero missed deadlines. But that result does not repeat. Four further identical attempts, run while an editor and browser were open, all failed within a fifth of a second. Two more failed with the avatar running.

The cause is CPU headroom, not a bug. Your laptop has two kinds of processor core: two fast ones and eight slow ones. The converter needs a fast core to finish each 52 ms chunk of audio in time. Pinning it to the fast cores stops Windows putting it on a slow core, but it cannot stop your editor and browser using those same cores too — and on battery the processor runs at 72% of its maximum speed. Under normal working conditions each chunk takes about 65 ms, which is already too slow.

Encouragingly, **the avatar is not the problem**. With the converter running, the avatar kept 96-100% of its frame rate and recovered fully. The two do not fight each other.

Details: [combined workload and reproducibility](../ops/reports/voice-combined-workload.md) and the [hybrid-core diagnosis](../ops/reports/voice-llvc-hybrid-cores.md).

Your listening preference in step 2 still matters, and matters more now: if one of the three existing RVC voices fits, we may not need this particular converter at all.

## The long-session problem: cause found

The failure where the avatar slowed to about one frame per second and OBS screenshots came out white now has a mechanism, and it is a simple one.

**Minimizing the output window stops it completely.** Measured: 60.0 frames per second normally, **0.0 while minimized**, 59.9 again the moment it is restored. A minimized window produces no frames at all, so the avatar freezes and OBS has nothing to capture — which is exactly white stills plus a near-dead frame rate, both symptoms from one cause.

The good news is the other half of that measurement:

- **Covering the window is completely safe.** Put anything you like in front of it, full screen included — still a full 60 frames per second. You can work normally while streaming.
- **Minimizing it is the one thing to avoid.**
- **Restoring it fixes everything instantly.** No restart, nothing to reconfigure.

So: if the avatar ever freezes or your scene goes white, check the taskbar first.

I should be straight about what this is and isn't. I proved the mechanism reproduces the symptoms; I did **not** prove the original failure was a minimize, because nothing recorded the window state at that moment. The test harness now records it, so next time there will be no guessing. Details: [minimizing the output window](../ops/reports/capture-minimize-cause.md).

A full 15-minute seated session also passed cleanly — 58.5 fps, zero dropped OBS frames out of 27,002, zero blank captures — while your browser and editor were open.

The standing-with-hands session still has not completed a full 15 minutes. It sustained 30 fps with a passing render gate and no dropped frames for 11.5 minutes before a sudden whole-system stall, and later attempts were interrupted by the window being minimized. That one gate stays open.

## Checking the build yourself

`npm run verify` runs every check that does not need a device or a person — unit tests, the production build, the runtime bundle, the beginner guides, the task register, the acceptance-claim guard, and the voice studio and converter tests. It takes about half a minute and prints a single verdict.

It also prints what it deliberately does **not** cover, so the gap stays visible:

```
Not covered here, and still required for delivery:
  - Live camera quality, gestures and standing movement (needs a person).
  - Voice preference and listening acceptance (needs the user).
  - OBS Virtual Camera registration and consumer test (needs an administrator prompt).
  - Final landscape and portrait recordings with audio (needs the operator).
  - Combined OBS soaks and physical audio latency or sync (needs devices and time).
```

That list is the same four steps above, plus the long soaks. A green `verify` means the software is sound; it does not mean the kit is accepted.

## What is already done

- **Your avatar (G1).** Ene Cyber legs is imported, rigged, expression-mapped and exported as a reusable VRM, with the editable Blender source and a [conversion recipe](avatar-conversion.md) so it can be rebuilt.
- **The website resources (G4).** All five animated resources — the full-body greeting and four desk expressions — plus a runnable showcase, measured and accepted.
- **The app itself.** Launcher, offline assets, clean landscape and portrait output views, OBS capture scenes, and beginner documentation.

Twenty-one of the 38 tasks are complete. The remaining seventeen are not waiting on more code.
