# DIA — snag inspector + panorama walkthrough (Phase 1)

Plain-JS inspection tool. No framework, no build step for day-to-day use. Open `snag.html` in a browser (a local static server is best if the file is opened from disk and scripts are blocked).

## Assumption

This repository only contained `# DIA` in `README.md`. There was no existing `snag.html`, report generator, or `TOURS`/`FIND` code. Phase 1 therefore **includes** a working inspector and report generator that implement the data model from the walkthrough spec, rather than patching a missing original. Visual style is the navy / brass palette in `snag.html` (not copied from an attached report, because none existed).

Phase 2 (survey-grade Gaussian splat from video) still needs an **off-device** GPU tool. The inspector **does** rebuild a walkable 3D photo / 360 structure in the browser from an uploaded video or photos — that is the snagging workflow, not a measured mesh. See `docs/phase2-3d-from-video.md` for splat capture.

## Files

| Path | Role |
| --- | --- |
| `snag.html` | Upload video or photos → 3D photo walk / 360 → click flaws → rectification → **Generate report** |
| `js/report-generator.js` | Builds the standalone customer HTML. Threads `TOURS`, `FIND`, and `PANOS` into one file |
| `js/pannellum-source.js` | Inlined Pannellum 2.5.6 JS+CSS so reports never hit a CDN |
| `vendor/pannellum.js` / `.css` | Same bundle, used live in the inspector preview |
| `samples/sample-report.html` | Demo customer report with panoramas + cube tour |
| `samples/sample-report-photos-only.html` | Same snags/photos, empty `PANOS` — regression check |
| `scripts/make-sample.js` | Regenerates the sample reports (`node scripts/make-sample.js`) |

## Data model (additive)

Unchanged from the spec:

- `TOURS[roomCode]` = `[{ label, src, pins: [{ x, y, no, sev }] }]` with `x`/`y` in 0–1
- `FIND[no]` = `{ no, room, chk, obs, sev, status, rem, ddate, close, after }`

Added:

- `PANOS[roomCode]` = `{ src, hotspots: [{ yaw, pitch, type: "scene"|"snag", target }] }`
  - `scene` → `target` is a room code
  - `snag` → `target` is a `FIND` number (not duplicated)

Hotspot authoring: click the equirectangular image. Pixel → sphere:

`yaw = (x/w - 0.5) * 360`, `pitch = (0.5 - y/h) * 180` (Pannellum: 0 yaw at image centre, positive right; positive pitch up).

## Report behaviour

- No `PANOS` data: cube photo tour only. Pannellum is **not** embedded. Toggle is hidden.
- With `PANOS`: per-room **Photo tour** / **Walkthrough**. Default is Walkthrough when a panorama exists.
- Gold squares = room links. Red dots = snags, opening the same FIND panel as cube pins.
- Panoramas are stored as data URIs but converted to `blob:` URLs at runtime (Chrome cannot feed `data:` URIs to Pannellum).

## Size

Inspectors downscale panoramas to **max 4096px wide JPEG at ~0.72 quality** (face photos 1920px / 0.82). A 4096×2048 pano is typically 1–2.5 MB; three rooms can make a 5–10 MB report. That is the Phase 1 tradeoff vs today's face photos. Do not raise the cap without expecting email/WhatsApp failures.

## Inspector usage

**1. Capture** — Upload a walkthrough **video** or several **photos** of the flat (include a 2:1 360 JPEG if you have one).
**2. Structure** — The app builds a 3D photo walk from video frames / stills, plus a 360 walkthrough when a panorama is present. This is not a survey mesh.
**3. Click flaws** — Tap the crack, switch, or tile. Write what is wrong and the **rectification**.
**4. Report** — **Generate report** downloads a standalone HTML file with the walk, pins, and a snag register.

## Phase 2 (video / photos → 3D)

Uploading a walkthrough video or overlapping stills can produce a **Gaussian splat** (look-around 3D), not a measured “exact” building. Processing is **outside** `snag.html`. The splat is a **sibling file** (or URL), never inlined like Phase 1 photos. Full capture procedure, tool choice, and cost notes: `docs/phase2-3d-from-video.md`.
