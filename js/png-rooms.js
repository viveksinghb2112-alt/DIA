/* Tiny uncompressed-filter PNG encoder (Node). */
const zlib = require("zlib");

function crc32(buf) {
  let crc = ~0;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return ~crc >>> 0;
}

function chunk(type, data) {
  const t = Buffer.from(type);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crcBuf = Buffer.concat([t, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcBuf));
  return Buffer.concat([len, t, data, crc]);
}

function rgbPng(width, height, rgb) {
  const stride = width * 3 + 1;
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    raw[y * stride] = 0;
    rgb.copy(raw, y * stride + 1, y * width * 3, (y + 1) * width * 3);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

function dataUriPng(width, height, rgb) {
  return "data:image/png;base64," + rgbPng(width, height, rgb).toString("base64");
}

function setPx(rgb, w, x, y, r, g, b) {
  const i = (y * w + x) * 3;
  rgb[i] = r;
  rgb[i + 1] = g;
  rgb[i + 2] = b;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function paintEquirect(w, h, spec) {
  const rgb = Buffer.alloc(w * h * 3);
  const wall = spec.wall || [70, 88, 108];
  const wall2 = spec.wall2 || [58, 74, 92];
  const floor1 = spec.floor1 || [92, 86, 76];
  const floor2 = spec.floor2 || [78, 72, 62];
  const ceil = spec.ceil || [210, 214, 220];
  const doors = spec.doors || [];
  const title = spec.name || "";

  for (let y = 0; y < h; y++) {
    const pitch = (0.5 - (y + 0.5) / h) * Math.PI;
    const cosP = Math.cos(pitch);
    const sinP = Math.sin(pitch);
    for (let x = 0; x < w; x++) {
      const yaw = ((x + 0.5) / w - 0.5) * 2 * Math.PI;
      const dx = Math.sin(yaw) * cosP;
      const dy = sinP;
      const dz = Math.cos(yaw) * cosP;
      let t = Infinity;
      let face = "z";
      if (dx > 1e-8) {
        const tt = 1 / dx;
        if (tt > 0 && tt < t) {
          t = tt;
          face = "+x";
        }
      } else if (dx < -1e-8) {
        const tt = -1 / dx;
        if (tt > 0 && tt < t) {
          t = tt;
          face = "-x";
        }
      }
      if (dy > 1e-8) {
        const tt = 1 / dy;
        if (tt > 0 && tt < t) {
          t = tt;
          face = "+y";
        }
      } else if (dy < -1e-8) {
        const tt = -1 / dy;
        if (tt > 0 && tt < t) {
          t = tt;
          face = "-y";
        }
      }
      if (dz > 1e-8) {
        const tt = 1 / dz;
        if (tt > 0 && tt < t) {
          t = tt;
          face = "+z";
        }
      } else if (dz < -1e-8) {
        const tt = -1 / dz;
        if (tt > 0 && tt < t) {
          t = tt;
          face = "-z";
        }
      }
      const px = dx * t;
      const py = dy * t;
      const pz = dz * t;
      let r, g, b;
      if (face === "+y") {
        r = ceil[0];
        g = ceil[1];
        b = ceil[2];
      } else if (face === "-y") {
        const cx = Math.floor((px + 1) * 4);
        const cz = Math.floor((pz + 1) * 4);
        const chk = (cx + cz) & 1;
        r = chk ? floor1[0] : floor2[0];
        g = chk ? floor1[1] : floor2[1];
        b = chk ? floor1[2] : floor2[2];
      } else {
        const u = face === "+x" || face === "-x" ? (pz + 1) / 2 : (px + 1) / 2;
        const v = (py + 1) / 2;
        const use = (face === "+z" || face === "-x" ? wall : wall2);
        r = use[0] + v * 12;
        g = use[1] + v * 8;
        b = use[2];
        if (v > 0.35 && v < 0.92 && u > 0.38 && u < 0.62) {
          const isDoor = doors.some(function (d) {
            let dyaw = Math.atan2(dx, dz) - (d.yaw * Math.PI) / 180;
            while (dyaw > Math.PI) dyaw -= Math.PI * 2;
            while (dyaw < -Math.PI) dyaw += Math.PI * 2;
            return Math.abs(dyaw) < 0.22 && face !== "+y" && face !== "-y";
          });
          if (isDoor) {
            r = 48;
            g = 36;
            b = 28;
          }
        }
      }
      setPx(rgb, w, x, y, r, g, b);
    }
  }

  /* Title band near horizon */
  const ty = Math.floor(h * 0.42);
  for (let y = ty; y < ty + 18 && y < h; y++) {
    for (let x = 0; x < Math.min(w, title.length * 8 + 20); x++) {
      const i = (y * w + x) * 3;
      rgb[i] = lerp(rgb[i], 196, 0.55);
      rgb[i + 1] = lerp(rgb[i + 1], 163, 0.55);
      rgb[i + 2] = lerp(rgb[i + 2], 90, 0.55);
    }
  }
  return rgb;
}

function paintPhoto(w, h, spec) {
  const rgb = Buffer.alloc(w * h * 3);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const u = x / w;
      const v = y / h;
      let r = spec.wall[0] + v * 20;
      let g = spec.wall[1] + v * 10;
      let b = spec.wall[2];
      if (v > 0.72) {
        const chk = (Math.floor(u * 8) + Math.floor(v * 8)) & 1;
        r = chk ? 90 : 76;
        g = chk ? 82 : 68;
        b = chk ? 70 : 58;
      }
      if (v < 0.18) {
        r = 200;
        g = 204;
        b = 210;
      }
      setPx(rgb, w, x, y, r, g, b);
    }
  }
  return rgb;
}

module.exports = { rgbPng, dataUriPng, paintEquirect, paintPhoto };
