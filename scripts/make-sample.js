"use strict";

const fs = require("fs");
const path = require("path");
const { dataUriPng, paintEquirect, paintPhoto } = require("../js/png-rooms");
const { generateReportHtml } = require("../js/report-generator");

const root = path.join(__dirname, "..");
const pannellumJs = fs.readFileSync(path.join(root, "vendor/pannellum.js"), "utf8");
const pannellumCss = fs.readFileSync(path.join(root, "vendor/pannellum.css"), "utf8");

function pano(spec) {
  const w = 1280;
  const h = 640;
  const rgb = paintEquirect(w, h, spec);
  return dataUriPng(w, h, rgb);
}
function photo(spec, label) {
  const w = 640;
  const h = 400;
  const rgb = paintPhoto(w, h, spec);
  return dataUriPng(w, h, rgb);
}

const today = new Date().toISOString().slice(0, 10);

const rooms = [
  { code: "ENT", name: "Entrance" },
  { code: "LIV", name: "Living Room" },
  { code: "KIT", name: "Kitchen" }
];

const FIND = {
  1: { no: 1, room: "ENT", chk: "Skirting", obs: "Scuffed paint on hall skirting.", sev: "M", status: "Open", rem: "Fill, sand, repaint to match.", ddate: today, close: "", after: "" },
  2: { no: 2, room: "KIT", chk: "Floor tiles", obs: "Hairline crack at threshold.", sev: "H", status: "Open", rem: "Replace cracked tile.", ddate: today, close: "", after: "" },
  3: { no: 3, room: "LIV", chk: "Paint", obs: "Drip on ceiling line.", sev: "L", status: "Open", rem: "Spot sand and touch up.", ddate: today, close: "", after: "" }
};

const TOURS = {
  ENT: [
    { label: "Front", src: photo({ wall: [72, 90, 110] }, "Entrance"), pins: [{ x: 0.42, y: 0.78, no: 1, sev: "M" }] },
    { label: "Right", src: photo({ wall: [68, 86, 104] }, "Entrance"), pins: [] }
  ],
  LIV: [
    { label: "Front", src: photo({ wall: [90, 86, 78] }, "Living"), pins: [{ x: 0.55, y: 0.22, no: 3, sev: "L" }] },
    { label: "Window", src: photo({ wall: [86, 82, 74] }, "Living"), pins: [] }
  ],
  KIT: [
    { label: "Front", src: photo({ wall: [86, 78, 70] }, "Kitchen"), pins: [{ x: 0.5, y: 0.82, no: 2, sev: "H" }] },
    { label: "Window", src: photo({ wall: [80, 74, 66] }, "Kitchen"), pins: [] }
  ]
};

const PANOS = {
  ENT: {
    src: pano({ name: "Entrance", wall: [70, 88, 108], doors: [{ yaw: 0 }, { yaw: 90 }] }),
    hotspots: [
      { yaw: 0, pitch: -8, type: "scene", target: "LIV" },
      { yaw: -40, pitch: -18, type: "snag", target: 1 }
    ]
  },
  LIV: {
    src: pano({ name: "Living Room", wall: [92, 86, 74], doors: [{ yaw: -90 }, { yaw: 90 }] }),
    hotspots: [
      { yaw: -90, pitch: -6, type: "scene", target: "ENT" },
      { yaw: 90, pitch: -6, type: "scene", target: "KIT" },
      { yaw: 20, pitch: 12, type: "snag", target: 3 }
    ]
  },
  KIT: {
    src: pano({ name: "Kitchen", wall: [88, 76, 64], doors: [{ yaw: 180 }] }),
    hotspots: [
      { yaw: 180, pitch: -8, type: "scene", target: "LIV" },
      { yaw: 15, pitch: -22, type: "snag", target: 2 }
    ]
  }
};

const meta = {
  project: "Harbour View",
  unit: "12B",
  inspector: "Demo",
  date: today,
  address: "Sample / synthetic panoramas"
};

const vendor = { js: pannellumJs, css: pannellumCss };

const withPano = generateReportHtml({ meta, rooms, TOURS, FIND, PANOS }, vendor);
fs.mkdirSync(path.join(root, "samples"), { recursive: true });
fs.writeFileSync(path.join(root, "samples/sample-report.html"), withPano);

const noPano = generateReportHtml({ meta, rooms, TOURS, FIND, PANOS: {} }, vendor);
fs.writeFileSync(path.join(root, "samples/sample-report-photos-only.html"), noPano);

console.log("wrote samples/sample-report.html", withPano.length);
console.log("wrote samples/sample-report-photos-only.html", noPano.length);
console.log("photos-only contains pannellum?", noPano.includes("Pannellum"));
console.log("pano report contains pannellum?", withPano.includes("Pannellum"));
