// SEMS face detector: a dependency-free JavaScript port of the Viola-Jones cascade evaluator.
// The trained model (face-cascade.json) is OpenCV's haarcascade_frontalface_alt2, redistributed under the
// Intel License Agreement (see OPENCV-LICENSE.txt). Everything runs in the browser; frames are never uploaded.
//
// detectFaces(gray, width, height, cascade, opts) -> [{ x, y, w, h, n }]
//   gray: Uint8Array/Uint8ClampedArray of width*height grey values.

const DEFAULTS = { scaleFactor: 1.2, minSize: 40, maxSize: 0, step: 1, minNeighbors: 3 };

function integrals(gray, w, h) {
  const W = w + 1, sum = new Float64Array(W * (h + 1)), sq = new Float64Array(W * (h + 1));
  for (let y = 0; y < h; y++) {
    let rs = 0, rq = 0;
    for (let x = 0; x < w; x++) {
      const v = gray[y * w + x]; rs += v; rq += v * v;
      sum[(y + 1) * W + x + 1] = sum[y * W + x + 1] + rs;
      sq[(y + 1) * W + x + 1] = sq[y * W + x + 1] + rq;
    }
  }
  return { sum, sq, W };
}

// Pre-scale every feature rectangle for one window scale (cached). Like OpenCV, the weight of the first rectangle is
// recomputed after rounding so that the feature still sums to zero on flat areas.
const scaleCache = new WeakMap();
function scaleFeatures(cascade, s) {
  let m = scaleCache.get(cascade); if (!m) scaleCache.set(cascade, (m = new Map()));
  const key = Math.round(s * 1000); if (m.has(key)) return m.get(key);
  const out = cascade.feats.map((rects) => {
    const sc = rects.map(([x, y, w, h, wt]) => [Math.round(x * s), Math.round(y * s), Math.round(w * s), Math.round(h * s), wt]);
    let sum0 = 0; for (let k = 1; k < sc.length; k++) sum0 += sc[k][4] * sc[k][2] * sc[k][3];
    const a0 = sc[0][2] * sc[0][3]; if (a0 > 0) sc[0][4] = -sum0 / a0;
    return sc;
  });
  m.set(key, out); return out;
}

function windowPasses(ii, feats, cascade, wx, wy, size) {
  const { sum, sq, W } = ii;
  // Normalise by the contrast (standard deviation) of the window, ignoring a 1-cell border like OpenCV does.
  const sc = size / cascade.w, b = Math.round(sc), nx = wx + b, ny = wy + b, ns = Math.round((cascade.w - 2) * sc);
  const area = ns * ns, a = ny * W + nx, bb = ny * W + nx + ns, c = (ny + ns) * W + nx, d = (ny + ns) * W + nx + ns;
  const mean = (sum[d] - sum[bb] - sum[c] + sum[a]) / area;
  let vn = (sq[d] - sq[bb] - sq[c] + sq[a]) / area - mean * mean;
  vn = vn > 1 ? Math.sqrt(vn) : 1;
  const invArea = 1 / area;
  const stages = cascade.stages;
  for (let si = 0; si < stages.length; si++) {
    const st = stages[si]; let acc = 0;
    for (let wi = 0; wi < st.w.length; wi++) {
      const [nodes, leaves] = st.w[wi]; let idx = 0;
      do {
        const nd = nodes[idx], rects = feats[nd[2]]; let v = 0;
        for (let r = 0; r < rects.length; r++) {
          const q = rects[r], x0 = wx + q[0], y0 = wy + q[1], x1 = x0 + q[2], y1 = y0 + q[3];
          v += q[4] * (sum[y1 * W + x1] - sum[y0 * W + x1] - sum[y1 * W + x0] + sum[y0 * W + x0]);
        }
        idx = v * invArea < nd[3] * vn ? nd[0] : nd[1];
      } while (idx > 0);
      acc += leaves[-idx];
    }
    if (acc < st.t) return false;
  }
  return true;
}

function group(rects, minNeighbors, eps = 0.2) {
  const n = rects.length, parent = rects.map((_, i) => i);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const similar = (r1, r2) => {
    const d = eps * (Math.min(r2.w, r1.w) + Math.min(r2.h, r1.h)) * 0.5;
    return Math.abs(r1.x - r2.x) <= d && Math.abs(r1.y - r2.y) <= d && Math.abs(r1.x + r1.w - r2.x - r2.w) <= d && Math.abs(r1.y + r1.h - r2.y - r2.h) <= d;
  };
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (similar(rects[i], rects[j])) parent[find(i)] = find(j);
  const cl = new Map();
  for (let i = 0; i < n; i++) { const k = find(i); const c = cl.get(k) || { x: 0, y: 0, w: 0, h: 0, n: 0 }; c.x += rects[i].x; c.y += rects[i].y; c.w += rects[i].w; c.h += rects[i].h; c.n++; cl.set(k, c); }
  const out = [...cl.values()].map((c) => ({ x: Math.round(c.x / c.n), y: Math.round(c.y / c.n), w: Math.round(c.w / c.n), h: Math.round(c.h / c.n), n: c.n })).filter((c) => c.n >= minNeighbors);
  // drop a detection that sits inside a clearly stronger one
  return out.filter((r1, i) => !out.some((r2, j) => {
    if (i === j) return false;
    const dx = Math.round(r2.w * eps), dy = Math.round(r2.h * eps);
    return r1.x >= r2.x - dx && r1.y >= r2.y - dy && r1.x + r1.w <= r2.x + r2.w + dx && r1.y + r1.h <= r2.y + r2.h + dy && (r2.n > Math.max(3, r1.n) || r1.n < 3);
  }));
}

export function detectFaces(gray, width, height, cascade, opts = {}) {
  const o = { ...DEFAULTS, ...opts }, ii = integrals(gray, width, height), hits = [];
  const maxSize = o.maxSize || Math.min(width, height);
  // window sizes follow the same geometric ladder as OpenCV: 20, 24, 28.8, ... (only those >= minSize are scanned)
  for (let k = 0, s = 1; ; k++, s = Math.pow(o.scaleFactor, k)) {
    const size = Math.round(cascade.w * s);
    if (size > maxSize) break;
    if (size < o.minSize) continue;
    const feats = scaleFeatures(cascade, size / cascade.w);
    const step = Math.max(1, Math.round(o.step * (s > 2 ? s : 2 * s)));   // coarser stride for bigger windows, as in OpenCV
    for (let y = 0; y + size <= height; y += step)
      for (let x = 0; x + size <= width; x += step)
        if (windowPasses(ii, feats, cascade, x, y, size)) hits.push({ x, y, w: size, h: size });
  }
  return group(hits, o.minNeighbors);
}

// Convert RGBA canvas pixels to grey values.
export function toGray(rgba, width, height) {
  const g = new Uint8Array(width * height);
  for (let i = 0, p = 0; i < g.length; i++, p += 4) g[i] = (rgba[p] * 299 + rgba[p + 1] * 587 + rgba[p + 2] * 114) / 1000;
  return g;
}
