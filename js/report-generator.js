/**
 * Standalone inspection-report HTML generator.
 *
 * Phase 1: TOURS (cube photo tour) + FIND (defects) + PANOS (Pannellum).
 * Phase 2 (Gaussian splat) is intentionally not implemented here.
 *
 * Distribution: the returned string is a single .html file. Photos and
 * panoramas are data URIs in a <script> block. Pannellum is inlined so the
 * customer never hits a CDN. Chrome cannot feed data: URIs to Pannellum
 * (see mpetroff/pannellum#256); the report converts them to blob: URLs at runtime.
 *
 * Panorama size: inspectors compress to max 4096px wide JPEG ~0.72 quality
 * before embed. A 4096×2048 JPEG is typically 1–2.5 MB; three rooms can push
 * a report to 5–10 MB. That is the tradeoff vs. today's face photos (~200 KB each).
 */
(function (root) {
  "use strict";

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function embedJson(obj) {
    return JSON.stringify(obj).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
  }

  function hasPanos(PANOS) {
    if (!PANOS) return false;
    return Object.keys(PANOS).some(function (k) {
      return PANOS[k] && PANOS[k].src;
    });
  }

  var REPORT_CSS = [
    ":root{--bg:#0f1419;--surface:#1a2330;--line:#2c3a51;--text:#e8e4dc;--muted:#9aa7b8;--gold:#c4a35a;--hi:#d4534a;--mid:#d4a017;--lo:#4aa3d4;--ok:#3d9a6a;}",
    "*{box-sizing:border-box}",
    "html,body{margin:0;background:var(--bg);color:var(--text);font:15px/1.45 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}",
    "header.app{display:flex;flex-wrap:wrap;gap:.75rem 1.25rem;align-items:flex-end;justify-content:space-between;padding:1rem 1.25rem;border-bottom:1px solid var(--line);background:linear-gradient(180deg,#1a2330,#141c27)}",
    "header.app h1{margin:0;font-size:1.15rem;font-weight:650;letter-spacing:.02em}",
    "header.app .meta{color:var(--muted);font-size:.85rem}",
    "header.app .meta b{color:var(--gold);font-weight:600}",
    "nav.rooms{display:flex;gap:.4rem;overflow:auto;padding:.7rem 1.25rem;border-bottom:1px solid var(--line);-webkit-overflow-scrolling:touch}",
    "nav.rooms button{flex:0 0 auto;border:1px solid var(--line);background:transparent;color:var(--text);border-radius:999px;padding:.35rem .85rem;cursor:pointer}",
    "nav.rooms button.on{background:var(--gold);color:#1a160c;border-color:var(--gold);font-weight:650}",
    ".stage{padding:1rem 1.25rem 2.5rem;max-width:980px;margin:0 auto}",
    ".toggle{display:flex;gap:.35rem;margin:0 0 .75rem}",
    ".toggle[hidden]{display:none}",
    ".toggle button{border:1px solid var(--line);background:var(--surface);color:var(--muted);padding:.4rem .9rem;border-radius:8px;cursor:pointer}",
    ".toggle button.on{background:#243044;color:var(--gold);border-color:var(--gold)}",
    ".cube-stage{position:relative;perspective:1100px;height:min(62vw,440px);background:#0b1016;border:1px solid var(--line);border-radius:14px;overflow:hidden}",
    ".cube-card{position:absolute;inset:0;transform-style:preserve-3d;transition:transform .45s cubic-bezier(.2,.7,.2,1)}",
    ".cube-card img{width:100%;height:100%;object-fit:cover;display:block;user-select:none;-webkit-user-drag:none}",
    ".pins{position:absolute;inset:0;pointer-events:none}",
    ".pin{pointer-events:auto;position:absolute;transform:translate(-50%,-100%);border:0;background:none;padding:0;cursor:pointer}",
    ".pin i{display:flex;align-items:center;justify-content:center;min-width:26px;height:26px;padding:0 6px;border-radius:999px 999px 999px 4px;color:#fff;font:700 12px/1 system-ui;box-shadow:0 4px 10px #0008}",
    ".pin.H i{background:var(--hi)}",
    ".pin.M i{background:var(--mid)}",
    ".pin.L i{background:var(--lo)}",
    ".cube-nav{display:flex;align-items:center;justify-content:space-between;margin-top:.65rem;gap:.5rem}",
    ".cube-nav button{border:1px solid var(--line);background:var(--surface);color:var(--text);border-radius:8px;padding:.4rem .8rem;cursor:pointer}",
    ".cube-nav .lab{color:var(--muted);font-size:.85rem;text-align:center;flex:1}",
    "#pano-view{height:min(62vw,440px);border:1px solid var(--line);border-radius:14px;overflow:hidden;background:#000}",
    "#pano-view .pnlm-container{background:#000}",
    ".empty{padding:3rem 1rem;text-align:center;color:var(--muted)}",
    "#find-panel{position:fixed;left:0;right:0;bottom:0;background:var(--surface);border-top:1px solid var(--line);padding:1rem 1.25rem 1.4rem;padding-right:2.5rem;box-shadow:0 -12px 40px #0008;z-index:20;max-height:55vh;overflow:auto}",
    "#find-panel[hidden]{display:none}",
    "#find-panel h2{margin:0 0 .35rem;font-size:1rem}",
    "#find-panel .row{display:flex;gap:.5rem;flex-wrap:wrap;margin:.25rem 0 .5rem}",
    ".tag{font-size:.72rem;font-weight:700;letter-spacing:.04em;text-transform:uppercase;padding:.15rem .5rem;border-radius:999px}",
    ".tag.H{background:#d4534a22;color:var(--hi)}",
    ".tag.M{background:#d4a01722;color:var(--mid)}",
    ".tag.L{background:#4aa3d422;color:var(--lo)}",
    ".tag.Open{background:#d4534a22;color:var(--hi)}",
    ".tag.Closed{background:#3d9a6a22;color:var(--ok)}",
    "#find-panel p{margin:.25rem 0;color:var(--text)}",
    "#find-panel .k{color:var(--muted);font-size:.8rem}",
    "#find-panel .x{position:absolute;right:1rem;top:.7rem;border:0;background:none;color:var(--muted);font-size:1.2rem;cursor:pointer}",
    ".hint{margin:.6rem 0 0;color:var(--muted);font-size:.8rem}",
    ".register{margin:1.4rem 0 0;border-top:1px solid var(--line);padding-top:1rem}",
    ".register h2{margin:0 0 .7rem;font-size:1rem}",
    ".reg{border:1px solid var(--line);border-radius:10px;padding:.7rem .8rem;margin:0 0 .5rem;background:var(--surface)}",
    ".reg h3{margin:0 0 .25rem;font-size:.95rem}",
    ".reg p{margin:.2rem 0;font-size:.9rem}",
    ".snag-hs{background:var(--hi)!important;border:2px solid #fff!important;width:28px!important;height:28px!important;border-radius:50%!important;box-shadow:0 0 0 3px #d4534a66}",
    ".scene-hs{background:var(--gold)!important;border:2px solid #fff!important;width:26px!important;height:26px!important;border-radius:6px!important}",
    "@media(min-width:720px){#find-panel{left:auto;width:380px;right:1rem;bottom:1rem;border:1px solid var(--line);border-radius:14px;max-height:70vh}}"
  ].join("");

  var REPORT_JS = function () {
    /* runtime injected as string — keep ES5 for old mobile Safari */
    function $(id) {
      return document.getElementById(id);
    }
    function dataUriToBlobUrl(src) {
      if (!src) return src;
      if (src.indexOf("data:") !== 0) return src;
      var parts = src.split(",");
      var meta = parts[0];
      var b64 = parts[1] || "";
      var mime = (meta.match(/data:([^;]+)/) || [, "image/jpeg"])[1];
      var bin = atob(b64);
      var arr = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      return URL.createObjectURL(new Blob([arr], { type: mime }));
    }
    var room = (ROOMS[0] && ROOMS[0].code) || "";
    var face = 0;
    var mode = "cube";
    var viewer = null;
    var panoBlobs = {};
    var startX = 0;
    var dragging = false;

    function roomHasPano(code) {
      return !!(PANOS && PANOS[code] && PANOS[code].src);
    }
    function roomHasPhotos(code) {
      return !!(TOURS && TOURS[code] && TOURS[code].length);
    }
    function defaultMode(code) {
      if (roomHasPano(code) && !roomHasPhotos(code)) return "pano";
      if (roomHasPano(code) && roomHasPhotos(code)) return "pano";
      return "cube";
    }
    function openFind(no) {
      var f = FIND[no] || FIND[String(no)];
      var panel = $("find-panel");
      if (!f) {
        panel.hidden = true;
        return;
      }
      $("fp-title").textContent = "Snag #" + f.no + " · " + (f.room || "");
      $("fp-tags").innerHTML =
        '<span class="tag ' +
        (f.sev || "") +
        '">' +
        (f.sev === "H" ? "High" : f.sev === "M" ? "Medium" : "Low") +
        '</span><span class="tag ' +
        (f.status || "") +
        '">' +
        (f.status || "") +
        "</span>";
      $("fp-chk").textContent = f.chk || "";
      $("fp-obs").textContent = f.obs || "";
      $("fp-rem").textContent = f.rem || "—";
      $("fp-ddate").textContent = f.ddate || "—";
      $("fp-close").textContent = f.close || "—";
      panel.hidden = false;
    }
    window.openFind = openFind;

    function renderCube() {
      var photos = (TOURS && TOURS[room]) || [];
      var stage = $("cube-view");
      if (!photos.length) {
        stage.innerHTML = '<div class="empty">No photo tour for this room.</div>';
        return;
      }
      if (face < 0) face = photos.length - 1;
      if (face >= photos.length) face = 0;
      var p = photos[face];
      var pins = (p.pins || [])
        .map(function (pin) {
          return (
            '<button class="pin ' +
            (pin.sev || "M") +
            '" style="left:' +
            pin.x * 100 +
            "%;top:" +
            pin.y * 100 +
            '%" onclick="openFind(' +
            pin.no +
            ')"><i>' +
            pin.no +
            "</i></button>"
          );
        })
        .join("");
      var angle = -face * (360 / Math.max(photos.length, 1));
      stage.innerHTML =
        '<div class="cube-stage" id="cube-stage"><div class="cube-card" id="cube-card" style="transform:rotateY(' +
        angle +
        'deg)"><img alt="" src="' +
        p.src +
        '"><div class="pins">' +
        pins +
        "</div></div></div>" +
        '<div class="cube-nav"><button type="button" id="prev-face">‹ Prev</button><div class="lab">' +
        (p.label || "Photo " + (face + 1)) +
        " · " +
        (face + 1) +
        "/" +
        photos.length +
        '</div><button type="button" id="next-face">Next ›</button></div>';
      $("prev-face").onclick = function () {
        face--;
        renderCube();
      };
      $("next-face").onclick = function () {
        face++;
        renderCube();
      };
      var el = $("cube-stage");
      el.addEventListener("touchstart", function (e) {
        startX = e.changedTouches[0].clientX;
        dragging = true;
      }, { passive: true });
      el.addEventListener("touchend", function (e) {
        if (!dragging) return;
        dragging = false;
        var dx = e.changedTouches[0].clientX - startX;
        if (dx > 40) face--;
        else if (dx < -40) face++;
        renderCube();
      });
      el.addEventListener("pointerdown", function (e) {
        if (e.pointerType === "touch") return;
        startX = e.clientX;
        dragging = true;
      });
      window.addEventListener("pointerup", function (e) {
        if (!dragging || e.pointerType === "touch") return;
        dragging = false;
        var dx = e.clientX - startX;
        if (Math.abs(dx) > 50) {
          if (dx > 0) face--;
          else face++;
          renderCube();
        }
      });
    }

    function destroyViewer() {
      if (viewer) {
        try {
          viewer.destroy();
        } catch (e) {}
        viewer = null;
      }
    }

    function hotspotFor(h) {
      var hs = {
        yaw: h.yaw,
        pitch: h.pitch,
        cssClass: h.type === "scene" ? "scene-hs" : "snag-hs"
      };
      if (h.type === "scene") {
        hs.type = "scene";
        hs.text = (function () {
          for (var i = 0; i < ROOMS.length; i++) if (ROOMS[i].code === h.target) return ROOMS[i].name;
          return h.target;
        })();
        hs.sceneId = h.target;
      } else {
        hs.type = "info";
        hs.text = "Snag #" + h.target;
        hs.clickHandlerFunc = function () {
          openFind(h.target);
        };
      }
      return hs;
    }

    function buildScenes() {
      var scenes = {};
      Object.keys(PANOS || {}).forEach(function (code) {
        var p = PANOS[code];
        if (!p || !p.src) return;
        if (!panoBlobs[code]) panoBlobs[code] = dataUriToBlobUrl(p.src);
        scenes[code] = {
          type: "equirectangular",
          panorama: panoBlobs[code],
          hotSpots: (p.hotspots || []).map(hotspotFor),
          autoLoad: true
        };
      });
      return scenes;
    }

    function renderPano() {
      var wrap = $("pano-view");
      wrap.innerHTML = "";
      destroyViewer();
      if (!roomHasPano(room)) {
        wrap.innerHTML = '<div class="empty">No panorama for this room.</div>';
        return;
      }
      var holder = document.createElement("div");
      holder.style.height = "100%";
      wrap.appendChild(holder);
      if (typeof pannellum === "undefined") {
        wrap.innerHTML = '<div class="empty">Panorama viewer failed to load.</div>';
        return;
      }
      var scenes = buildScenes();
      viewer = pannellum.viewer(holder, {
        default: {
          firstScene: room,
          sceneFadeDuration: 600,
          compass: false,
          autoLoad: true,
          mouseZoom: true,
          draggable: true
        },
        scenes: scenes
      });
      viewer.on("scenechange", function (id) {
        if (id && id !== room) {
          room = id;
          face = 0;
          syncRoomButtons();
          updateToggle();
        }
      });
    }

    function updateToggle() {
      var tog = $("view-toggle");
      var both = roomHasPano(room) && roomHasPhotos(room);
      tog.hidden = !(roomHasPano(room) && roomHasPhotos(room)) && !(roomHasPano(room) || roomHasPhotos(room));
      if (!roomHasPano(room) && !roomHasPhotos(room)) tog.hidden = true;
      else if (!both) tog.hidden = true;
      else tog.hidden = false;
      $("btn-cube").className = mode === "cube" ? "on" : "";
      $("btn-pano").className = mode === "pano" ? "on" : "";
      $("cube-view").hidden = mode !== "cube";
      $("pano-view").hidden = mode !== "pano";
      $("btn-cube").disabled = !roomHasPhotos(room);
      $("btn-pano").disabled = !roomHasPano(room);
    }

    function showRoom(code) {
      room = code;
      face = 0;
      $("find-panel").hidden = true;
      mode = defaultMode(room);
      syncRoomButtons();
      updateToggle();
      destroyViewer();
      if (mode === "pano") renderPano();
      else renderCube();
    }

    function syncRoomButtons() {
      var buttons = document.querySelectorAll("nav.rooms button");
      for (var i = 0; i < buttons.length; i++) {
        buttons[i].className = buttons[i].getAttribute("data-room") === room ? "on" : "";
      }
    }

    $("btn-cube").onclick = function () {
      mode = "cube";
      destroyViewer();
      updateToggle();
      renderCube();
    };
    $("btn-pano").onclick = function () {
      mode = "pano";
      updateToggle();
      renderPano();
    };
    $("fp-close-btn").onclick = function () {
      $("find-panel").hidden = true;
    };
    document.querySelector("nav.rooms").addEventListener("click", function (e) {
      var b = e.target.closest("button");
      if (b) showRoom(b.getAttribute("data-room"));
    });
    showRoom(room);
  };

  function generateReportHtml(payload, vendor) {
    payload = payload || {};
    var meta = payload.meta || {};
    var rooms = payload.rooms || [];
    var TOURS = payload.TOURS || payload.tours || {};
    var FIND = payload.FIND || payload.find || {};
    var PANOS = payload.PANOS || payload.panos || {};
    var includePano = hasPanos(PANOS);
    var pannellumJs = (vendor && vendor.js) || "";
    var pannellumCss = (vendor && vendor.css) || "";
    var title = (meta.project || "Inspection") + (meta.unit ? " — " + meta.unit : "");

    var roomBtns = rooms
      .map(function (r, i) {
        return (
          '<button type="button" data-room="' +
          esc(r.code) +
          '"' +
          (i === 0 ? ' class="on"' : "") +
          ">" +
          esc(r.name || r.code) +
          "</button>"
        );
      })
      .join("");

    var finds = Object.keys(FIND)
      .map(function (k) {
        return FIND[k];
      })
      .sort(function (a, b) {
        return (a.no || 0) - (b.no || 0);
      });
    var register =
      '<section class="register"><h2>Snag register</h2>' +
      (finds.length
        ? finds
            .map(function (f) {
              return (
                '<article class="reg"><h3>#' +
                esc(f.no) +
                " · " +
                esc(f.room) +
                " · " +
                esc(f.chk || "Flaw") +
                '</h3><div class="row"><span class="tag ' +
                esc(f.sev) +
                '">' +
                (f.sev === "H" ? "High" : f.sev === "M" ? "Medium" : "Low") +
                '</span><span class="tag ' +
                esc(f.status || "") +
                '">' +
                esc(f.status || "") +
                "</span></div><div class=\"k\">Observation</div><p>" +
                esc(f.obs) +
                "</p><div class=\"k\">Rectification</div><p>" +
                esc(f.rem) +
                "</p></article>"
              );
            })
            .join("")
        : "<p class=\"hint\">No snags logged.</p>") +
      "</section>";

    return (
      "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n<meta charset=\"utf-8\">\n" +
      '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n' +
      "<title>" +
      esc(title) +
      "</title>\n<style>\n" +
      REPORT_CSS +
      "\n" +
      (includePano ? pannellumCss : "") +
      "\n</style>\n</head>\n<body>\n" +
      '<header class="app"><div><h1>' +
      esc(title) +
      '</h1><div class="meta">Inspector <b>' +
      esc(meta.inspector || "—") +
      "</b> · " +
      esc(meta.date || "") +
      (meta.address ? " · " + esc(meta.address) : "") +
      "</div></div></header>\n" +
      '<nav class="rooms">' +
      roomBtns +
      "</nav>\n" +
      '<div class="stage">' +
      '<div class="toggle" id="view-toggle" hidden>' +
      '<button type="button" id="btn-cube">Photo tour</button>' +
      '<button type="button" id="btn-pano">Walkthrough</button></div>' +
      '<div id="cube-view"></div>' +
      '<div id="pano-view" hidden></div>' +
      '<p class="hint">Photo tour is a swipeable 3D walk of the uploaded photos or video frames. Walkthrough is a 360° panorama when one was uploaded. Click pins or red dots for each flaw. The snag register below lists every defect and the rectification written on site.</p>' +
      register +
      "</div>\n" +
      '<aside id="find-panel" hidden><button class="x" id="fp-close-btn" aria-label="Close">×</button>' +
      '<h2 id="fp-title"></h2><div class="row" id="fp-tags"></div>' +
      '<div class="k">Check</div><p id="fp-chk"></p>' +
      '<div class="k">Observation</div><p id="fp-obs"></p>' +
      '<div class="k">Remedial</div><p id="fp-rem"></p>' +
      '<div class="k">Due / closed</div><p><span id="fp-ddate"></span> / <span id="fp-close"></span></p>' +
      "</aside>\n<script>\n" +
      "var META=" +
      embedJson(meta) +
      ";\nvar ROOMS=" +
      embedJson(rooms) +
      ";\nvar TOURS=" +
      embedJson(TOURS) +
      ";\nvar FIND=" +
      embedJson(FIND) +
      ";\nvar PANOS=" +
      embedJson(includePano ? PANOS : {}) +
      ";\n</script>\n" +
      (includePano ? "<script>\n" + pannellumJs + "\n</script>\n" : "") +
      "<script>\n(" +
      REPORT_JS.toString() +
      ")();\n</script>\n</body>\n</html>\n"
    );
  }

  root.generateReportHtml = generateReportHtml;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = { generateReportHtml: generateReportHtml };
  }
})(typeof window !== "undefined" ? window : global);
