// Vice Cover Studio — cover renderer.
// Draws a multi-panel GTA-style poster cover onto any 2D canvas: photos fill
// the layout's panels (each cropped and positioned on its own), a sunset or
// neon colour grade washes over the whole cover, and a bold caption lettered
// in Anton sits in the band along the bottom. Pure drawing: no DOM, no fetch.

export const SIZES = {
  square: { label: 'Square 1080 x 1080', w: 1080, h: 1080 },
  portrait: { label: 'Portrait 1080 x 1350', w: 1080, h: 1350 },
  wide: { label: 'Wide 1920 x 1080', w: 1920, h: 1080 },
};

// A layout is a set of photo panels plus the caption band, all in unit space
// (0..1 across the cover). Gutters between panels show the dark backing.
export const LAYOUTS = {
  hero: {
    name: 'Hero Split',
    blurb: 'One big hero shot, two small frames beside it.',
    panels: [
      { x: 0, y: 0, w: 0.605, h: 0.765 },
      { x: 0.62, y: 0, w: 0.38, h: 0.375 },
      { x: 0.62, y: 0.39, w: 0.38, h: 0.375 },
    ],
    band: { x: 0, y: 0.78, w: 1, h: 0.22 },
  },
  strip: {
    name: 'Triple Strip',
    blurb: 'Three tall panels side by side, poster style.',
    panels: [
      { x: 0, y: 0, w: 0.3233, h: 0.78 },
      { x: 0.3383, y: 0, w: 0.3233, h: 0.78 },
      { x: 0.6767, y: 0, w: 0.3233, h: 0.78 },
    ],
    band: { x: 0, y: 0.795, w: 1, h: 0.205 },
  },
  quad: {
    name: 'Quad Grid',
    blurb: 'Four equal frames, two by two.',
    panels: [
      { x: 0, y: 0, w: 0.4925, h: 0.3825 },
      { x: 0.5075, y: 0, w: 0.4925, h: 0.3825 },
      { x: 0, y: 0.3975, w: 0.4925, h: 0.3825 },
      { x: 0.5075, y: 0.3975, w: 0.4925, h: 0.3825 },
    ],
    band: { x: 0, y: 0.795, w: 1, h: 0.205 },
  },
  stack: {
    name: 'Poster Stack',
    blurb: 'One wide hero on top, two frames below it.',
    panels: [
      { x: 0, y: 0, w: 1, h: 0.56 },
      { x: 0, y: 0.575, w: 0.4925, h: 0.205 },
      { x: 0.5075, y: 0.575, w: 0.4925, h: 0.205 },
    ],
    band: { x: 0, y: 0.795, w: 1, h: 0.205 },
  },
};

// A grade is the colour wash of the whole cover: a sky gradient laid over the
// photos, a soft tint, the caption band's colours and the accent ink.
export const GRADES = {
  sunset: {
    name: 'Sunset Strip',
    sky: ['#ff5e8a', '#ff9a3c'],
    tint: '#ff7a18', tintAlpha: 0.16,
    band: ['#160a2e', '#3d0b3d'],
    accent: '#ffd319', ink: '#ffffff', outline: '#1c0630',
  },
  neon: {
    name: 'Neon Nights',
    sky: ['#00e5ff', '#ff2fb3'],
    tint: '#00b7ff', tintAlpha: 0.15,
    band: ['#03122e', '#3b0f54'],
    accent: '#00f0ff', ink: '#ffffff', outline: '#02122b',
  },
  pink: {
    name: 'Hot Pink',
    sky: ['#ff2f92', '#ff8ac2'],
    tint: '#ff2f92', tintAlpha: 0.18,
    band: ['#2b0a2e', '#5c1040'],
    accent: '#ff7ad9', ink: '#ffffff', outline: '#2b0620',
  },
  teal: {
    name: 'Teal Noir',
    sky: ['#00c9a7', '#0a4d68'],
    tint: '#00c9a7', tintAlpha: 0.14,
    band: ['#03181c', '#0b3d4d'],
    accent: '#7dffd4', ink: '#f4fffa', outline: '#02181c',
  },
  gold: {
    name: 'Golden Hour',
    sky: ['#ffc93c', '#ff6b35'],
    tint: '#ffc93c', tintAlpha: 0.18,
    band: ['#241505', '#4d2a08'],
    accent: '#ffe66d', ink: '#fffaf0', outline: '#241203',
  },
};

// A panel's photo placement: which photo, how far zoomed in, and how far the
// photo is panned inside its frame (fractions of the panel's own size).
export function blankPanel(photo) {
  return { photo, zoom: 1, dx: 0, dy: 0 };
}

export function blankPanels(layoutId, photoCount) {
  const layout = LAYOUTS[layoutId];
  return layout.panels.map((_, i) => blankPanel(photoCount ? i % photoCount : -1));
}

// A tiny deterministic noise tile, so the grain looks the same on every run.
let noiseTile = null;
function grainTile() {
  if (noiseTile) return noiseTile;
  const tile = document.createElement('canvas');
  tile.width = 128;
  tile.height = 128;
  const tctx = tile.getContext('2d');
  const data = tctx.createImageData(128, 128);
  let seed = 20261119;
  const next = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < data.data.length; i += 4) {
    const v = Math.floor(next() * 255);
    data.data[i] = v;
    data.data[i + 1] = v;
    data.data[i + 2] = v;
    data.data[i + 3] = 255;
  }
  tctx.putImageData(data, 0, 0);
  noiseTile = tile;
  return tile;
}

function drawPhotoInPanel(ctx, img, rect, placement) {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const base = Math.max(rect.w / iw, rect.h / ih);
  const scale = base * placement.zoom;
  const dw = iw * scale;
  const dh = ih * scale;
  const dx = rect.x + (rect.w - dw) / 2 + placement.dx * rect.w;
  const dy = rect.y + (rect.h - dh) / 2 + placement.dy * rect.h;
  ctx.drawImage(img, dx, dy, dw, dh);
}

function drawPanelShine(ctx, rect) {
  const shine = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.w, rect.y + rect.h);
  shine.addColorStop(0, 'rgba(255,255,255,0.14)');
  shine.addColorStop(0.35, 'rgba(255,255,255,0.02)');
  shine.addColorStop(1, 'rgba(0,0,0,0.10)');
  ctx.fillStyle = shine;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.strokeStyle = 'rgba(255,255,255,0.28)';
  ctx.lineWidth = Math.max(1, rect.w * 0.004);
  ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
}

function drawEmptyPanel(ctx, rect, index) {
  ctx.fillStyle = '#241a33';
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.setLineDash([rect.w * 0.02, rect.w * 0.02]);
  ctx.lineWidth = Math.max(1, rect.w * 0.004);
  ctx.strokeRect(rect.x + 2, rect.y + 2, rect.w - 4, rect.h - 4);
  ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = `${Math.round(rect.h * 0.11)}px "Bebas Neue", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`PANEL ${index + 1} — ADD A PHOTO`, rect.x + rect.w / 2, rect.y + rect.h / 2);
}

function drawGradeWash(ctx, W, H, grade) {
  const sky = ctx.createLinearGradient(0, 0, W * 0.35, H);
  sky.addColorStop(0, grade.sky[0]);
  sky.addColorStop(1, grade.sky[1]);
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = 0.38;
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
  ctx.save();
  ctx.globalCompositeOperation = 'soft-light';
  ctx.globalAlpha = grade.tintAlpha;
  ctx.fillStyle = grade.tint;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
  const vignette = ctx.createRadialGradient(
    W / 2, H / 2, Math.min(W, H) * 0.35,
    W / 2, H / 2, Math.max(W, H) * 0.75,
  );
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(0,0,0,0.32)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, W, H);
  const tile = grainTile();
  const pattern = ctx.createPattern(tile, 'repeat');
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = 0.06;
  ctx.fillStyle = pattern;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

function fitCaptionFont(ctx, text, maxWidth, startSize) {
  let size = startSize;
  ctx.font = `${size}px Anton, sans-serif`;
  while (size > 12 && ctx.measureText(text).width > maxWidth) {
    size = Math.floor(size * 0.94);
    ctx.font = `${size}px Anton, sans-serif`;
  }
  return size;
}

function drawCaptionBand(ctx, W, H, band, grade, caption, sub) {
  const bx = band.x * W;
  const by = band.y * H;
  const bw = band.w * W;
  const bh = band.h * H;
  const wash = ctx.createLinearGradient(bx, by, bx + bw, by);
  wash.addColorStop(0, grade.band[0]);
  wash.addColorStop(1, grade.band[1]);
  ctx.fillStyle = wash;
  ctx.fillRect(bx, by, bw, bh);
  // Slanted accent stripes across the top edge of the band.
  ctx.fillStyle = grade.accent;
  ctx.beginPath();
  ctx.moveTo(bx, by);
  ctx.lineTo(bx + bw * 0.22, by);
  ctx.lineTo(bx + bw * 0.18, by + bh * 0.075);
  ctx.lineTo(bx, by + bh * 0.075);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath();
  ctx.moveTo(bx + bw * 0.24, by);
  ctx.lineTo(bx + bw * 0.30, by);
  ctx.lineTo(bx + bw * 0.26, by + bh * 0.075);
  ctx.lineTo(bx + bw * 0.20, by + bh * 0.075);
  ctx.closePath();
  ctx.fill();

  const words = (caption || 'UNTITLED').toUpperCase();
  const textTop = by + bh * 0.16;
  const textHeight = bh * 0.56;
  ctx.save();
  ctx.translate(bx + bw / 2, textTop + textHeight / 2);
  ctx.transform(1, 0, -0.07, 1, 0, 0);
  const size = fitCaptionFont(ctx, words, bw * 0.94, Math.round(textHeight));
  ctx.font = `${size}px Anton, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = grade.outline;
  ctx.lineWidth = Math.max(2, size * 0.09);
  ctx.strokeText(words, 0, 0);
  ctx.fillStyle = grade.ink;
  ctx.fillText(words, 0, 0);
  ctx.restore();

  if (sub && sub.trim()) {
    const subText = sub.toUpperCase();
    ctx.save();
    ctx.font = `${Math.round(bh * 0.17)}px "Bebas Neue", sans-serif`;
    try { ctx.letterSpacing = `${Math.round(bh * 0.045)}px`; } catch { /* older canvas: no letter spacing */ }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = grade.accent;
    ctx.fillText(subText, bx + bw / 2, by + bh * 0.93);
    ctx.restore();
  }
}

// Draws the whole cover for a state:
//   { layout, grade, caption, sub, photos, panels }
// photos is an array of loaded images; panels is an array with one placement
// per panel of the chosen layout (see blankPanels).
export function drawCover(ctx, W, H, state) {
  const layout = LAYOUTS[state.layout] ?? LAYOUTS.hero;
  const grade = GRADES[state.grade] ?? GRADES.sunset;
  ctx.save();
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#0d0817';
  ctx.fillRect(0, 0, W, H);
  const panels = state.panels ?? [];
  layout.panels.forEach((panel, i) => {
    const rect = {
      x: panel.x * W,
      y: panel.y * H,
      w: panel.w * W,
      h: panel.h * H,
    };
    const placement = panels[i];
    const img = placement && placement.photo >= 0 ? state.photos[placement.photo] : null;
    ctx.save();
    ctx.beginPath();
    ctx.rect(rect.x, rect.y, rect.w, rect.h);
    ctx.clip();
    if (img) {
      drawPhotoInPanel(ctx, img, rect, placement);
    } else {
      drawEmptyPanel(ctx, rect, i);
    }
    drawPanelShine(ctx, rect);
    ctx.restore();
  });
  drawGradeWash(ctx, W, H, grade);
  drawCaptionBand(ctx, W, H, layout.band, grade, state.caption, state.sub);
  // Thin poster frame.
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = Math.max(2, W * 0.004);
  ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, W - ctx.lineWidth, H - ctx.lineWidth);
  ctx.restore();
}

// Maps a point on a W x H cover to the index of the panel under it, or -1.
export function panelAt(state, W, H, px, py) {
  const layout = LAYOUTS[state.layout] ?? LAYOUTS.hero;
  for (let i = layout.panels.length - 1; i >= 0; i--) {
    const p = layout.panels[i];
    if (px >= p.x * W && px < (p.x + p.w) * W && py >= p.y * H && py < (p.y + p.h) * H) return i;
  }
  return -1;
}
