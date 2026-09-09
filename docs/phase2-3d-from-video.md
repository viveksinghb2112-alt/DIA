# Phase 2 — 3D from video or photos (process, not phone-app reconstruction)

**Status:** process document only. No splat viewer is wired into the report yet.

Uploading a walkthrough **video** or a set of overlapping **photos** can produce a 3D look-around of the flat. That is **not** done inside `snag.html` on the inspector’s phone, and it is **not** an exact, measurable copy of the building.

## What you get vs what you do not

| You get | You do not get |
| --- | --- |
| A photoreal (or near-photoreal) view you can orbit / fly through in a browser | True surfaces you can tape-measure |
| A sense of layout, finishes, and where a snag sits in space | Guaranteed metric scale (mm-accurate lengths) |
| A file next to the HTML report (`.ply` / `.spz` / `.splat`) | A single self-contained HTML file like Phase 1 panos |

Gaussian splats are **coloured blobs in space**, not walls with thickness. Glossy tiles, marble, and mirrors (typical bathrooms/kitchens) often show noise, floating highlights, or “holes.” That is expected, not a silent bug.

Do not put a ruler, area tool, or “exact 3D model” label on this view.

## Why the inspector app cannot “just rebuild it”

Phase 1 panoramas are one JPEG per room. A 3D splat needs **hundreds of frames** with known (or estimated) camera poses, then a GPU training step. That is minutes to hours on a GPU, tens to hundreds of MB of output, and it cannot run reliably in mobile Safari as a no-build HTML tool.

**Inspector app role (when we implement it):** attach a video/photo set *or* a path to an already-processed splat. **Processing** stays outside the phone app.

## Capture (inspector)

Use **one of** these. Video is easier; a stills set is often cleaner.

### Video (recommended default)

1. Phone camera, 1080p or 4K, lock exposure/AF if the phone allows.
2. Walk the flat slowly for **2–5 minutes**. Pause in each room; overlap the previous viewpoint (think 70%+ overlap).
3. Hold the phone at chest height, lens forward, small arcs rather than fast pans.
4. Open every door you want the customer to “walk through.”
5. Around bathrooms/kitchens: **angle off** mirrors and polished floors; do not stare straight into a mirror for long. Expect splat artifacts there anyway.
6. Avoid people walking through the frame.

### Photos (alternative)

- 50–300 stills, same overlap rules, same lighting if possible.
- Better when you can control each frame; worse for a rushed site visit.

A **single 360 photo** (Phase 1) is not enough to reconstruct a walkable volume. It is a sphere from one point.

## Processing (outside the app) — pick one

### Option A — Polycam (recommended to try first)

- Capture in the Polycam app, **or** import the walkthrough video / photo set.
- Process as a **Gaussian splat**, export **`splat.ply`** (and optionally a mesh GLB if you also want a fallback).
- **Cost (as of 2026, check current pricing):** Basic is about **$30/month** per user with Gaussian splats on that plan. That is a **subscription**, not a clean per-flat fee. Unlimited-sounding splat quotas still have **per-capture image limits** (on the order of 150–300 images depending on plan). Enterprise API is a separate, expensive add-on (~$1200/year/seat, 3-seat minimum) — do **not** depend on the API for v1.
- **Offline reports:** export the file; do not embed a Polycam web viewer that hits their servers.

### Option B — Luma AI

- Easy capture → splat in their cloud.
- `@lumaai/luma-web` often wants a **hosted Luma capture URL**. That **breaks offline “double-click the HTML”** unless you also export a local splat bundle.
- Treat as hosted-demo only unless we confirm a local file export that `gsplat.js` / Spark can load without Luma’s network.

### Option C — Self-hosted COLMAP + `gaussian-splatting` (heavier)

- Zero per-flat SaaS cost; you need a **GPU machine**, storage, and someone to run:
  1. Extract frames from video (`ffmpeg`).
  2. COLMAP (feature match + sparse reconstruction).
  3. Train a splat (Inria / similar trainer).
- First real-flat run is an engineering project, not a one-afternoon script. Confirm GPU availability before choosing this as the default.

**v1 recommendation:** Option A, manual export, one splat **per flat** (not per room) unless the flat is huge.

## How it would sit next to today’s report

Phase 1 stays: cube photos + 360 panos, one HTML file.

Phase 2 adds a third toggle, e.g. **3D walkthrough**, that:

```text
report.html
12B-flat.ply          ← sibling file, relative path, NOT base64
```

or a URL with a visible message if the file is missing (“3D file not found — open Photo tour or Walkthrough instead”).

Typical splat: **tens to hundreds of MB**. Email/WhatsApp of a single HTML file will not carry it. Delivery becomes a **folder** or a download link.

Data model (additive, when coded) — sketch only:

```js
// one splat per inspection, not per room
SPLAT = {
  src: "12B-flat.ply",     // relative or https://
  kind: "ply",             // ply | spz | splat
  note: "Visualisation only. Not for measurements."
}
```

Snag pins in splat space need **3D positions** (or a camera pose + click). That is extra authoring work; do not assume Phase 1 yaw/pitch maps onto the splat.

## Known failure modes to write up on the first real flat

1. Bathroom/kitchen **reflections** — is quality acceptable for customers or only for “you are in the room”?
2. File size vs phone browsers (iOS Safari memory).
3. Missing sibling file when someone forwards only the HTML.
4. Scale: never show dimensions derived from the splat.

## What we will not do

- Train splats inside the browser from an uploaded video.
- Base64-embed the splat in the HTML.
- Imply the model is survey-accurate.
- Pay for Polycam/Luma/hosting without the cost being explicit in the product.

## Next implementation step (after you confirm this path)

1. Capture one real bathroom + living room with the video procedure above.
2. Export a `.ply` from Polycam.
3. Then (only then) add a report viewer (`gsplat.js` or Spark) with orbit/fly controls and a missing-file fallback.
