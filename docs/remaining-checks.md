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

Open the listening room at `http://127.0.0.1:5081/`. It has three converted English voices plus the unconverted reference, all level-matched.

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

## The long-session problem: mostly resolved, one part needs free memory

The failure where drawing slowed to about one frame per second and OBS screenshots came out white **did not come back**. A full 15-minute seated session just completed cleanly: 58.5 frames per second, zero dropped OBS frames out of 27,002, zero blank captures, and no slowdown from start to finish. That ran while your browser and editor were open, which makes it a more honest result than a quiet-machine run would have been.

Two suspects were ruled in or out along the way: processor core placement is [tested and rejected](../ops/reports/capture-core-placement.md), and the "Chrome hid the window" idea is [untested rather than disproven](../ops/reports/capture-occlusion-investigation.md) because neither probe managed to actually hide the window.

**One thing I could not finish.** The standing-with-hands session failed twice — once the browser closed after 55 seconds, once tracking never started. Both times the machine was out of memory: 1.5 GB free of 16 GB, with 23-25 GB committed. Your editor, browser, OBS and background services already fill the machine, and the test browser needs about 2 GB on top.

This does not look like a bug. No crash was logged, no worker errored, and hand tracking ran correctly at 169-303 ms per result whenever it got going.

**If you want this closed:** close your editor and spare browser windows, then run this one command and leave the laptop alone for about 17 minutes:

```
node scripts/combined_fixture_soak.mjs --run --quiet-window --phase=standing-hands
```

Until then the standing preset is genuinely unmeasured, and I am not inferring it from the seated pass.

One separate performance fact worth knowing: with hands enabled, a complete tracking update takes 418-464 ms, so standing tracking refreshes about **2.2 times per second**. Head and body motion stay smooth because drawing runs independently, but fast hand movement will lag.

## What is already done

- **Your avatar (G1).** Ene Cyber legs is imported, rigged, expression-mapped and exported as a reusable VRM, with the editable Blender source and a [conversion recipe](avatar-conversion.md) so it can be rebuilt.
- **The website resources (G4).** All five animated resources — the full-body greeting and four desk expressions — plus a runnable showcase, measured and accepted.
- **The app itself.** Launcher, offline assets, clean landscape and portrait output views, OBS capture scenes, and beginner documentation.

Twenty-one of the 38 tasks are complete. The remaining seventeen are not waiting on more code.
