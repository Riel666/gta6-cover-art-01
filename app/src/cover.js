// Draws the multi-panel cover: photos in a panel layout, a Vice City sunset / neon colour
// grade, and a bold caption. The same function paints the live preview and the exported
// PNG, so what you see is exactly what you share.

/** Panel layouts, each a list of [x, y, width, height] fractions of the cover. */
export const LAYOUTS = {
  strip: {
    name: 'Vice Strip',
    panels: [
      [0, 0, 1 / 3, 1],
      [1 / 3, 0, 1 / 3, 1],
      [2 / 3, 0, 1 / 3, 1],
    ],
  },
  hero: {
    name: 'Hero + Duo',
    panels: [
      [0, 0, 0.62, 1],
      [0.62, 0, 0.38, 0.5],
      [0.62, 0.5, 0.38, 0.5],
    ],
  },
  grid: {
    name: 'Four Corners',
    panels: [
      [0, 0, 0.5, 0.5],
      [0.5, 0, 0.5, 0.5],
      [0, 0.5, 0.5, 0.5],
      [0.5, 0.5, 0.5, 0.5],
    ],
  },
  split: {
    name: 'Sunset Split',
    panels: [
      [0, 0, 1, 0.62],
      [0, 0.62, 0.5, 0.38],
      [0.5, 0.62, 0.5, 0.38],
    ],
  },
};

/** Colour grades: a canvas filter on each photo plus a tint painted over the panels. */
export const GRADES = {
  sunset: {
    name: 'Vice Sunset',
    filter: 'saturate(1.4) contrast(1.08) brightness(1.02)',
    accent: '#ff2e88',
    tint(ctx, x, y, w, h) {
      const g = ctx.createLinearGradient(x, y, x, y + h);
      g.addColorStop(0, 'rgba(255, 150, 60, 0.14)');
      g.addColorStop(0.55, 'rgba(255, 80, 90, 0.05)');
      g.addColorStop(1, 'rgba(255, 45, 120, 0.38)');
      ctx.fillStyle = g;
      ctx.fillRect(x, y, w, h);
    },
  },
  neon: {
    name: 'Neon Nights',
    filter: 'saturate(1.6) contrast(1.15)',
    accent: '#00e5ff',
    tint(ctx, x, y, w, h) {
      const g = ctx.createLinearGradient(x, y, x + w, y + h);
      g.addColorStop(0, 'rgba(255, 46, 136, 0.30)');
      g.addColorStop(0.5, 'rgba(120, 40, 200, 0.10)');
      g.addColorStop(1, 'rgba(0, 229, 255, 0.24)');
      ctx.fillStyle = g;
      ctx.fillRect(x, y, w, h);
    },
  },
  noir: {
    name: 'Palm Noir',
    filter: 'saturate(0.55) contrast(1.22) brightness(0.92)',
    accent: '#ffd23f',
    tint(ctx, x, y, w, h) {
      const g = ctx.createLinearGradient(x, y, x, y + h);
      g.addColorStop(0, 'rgba(8, 8, 40, 0.10)');
      g.addColorStop(1, 'rgba(8, 8, 40, 0.45)');
      ctx.fillStyle = g;
      ctx.fillRect(x, y, w, h);
    },
  },
  pastel: {
    name: 'Pastel Dusk',
    filter: 'saturate(1.1) brightness(1.08) contrast(0.95)',
    accent: '#ff8fb8',
    tint(ctx, x, y, w, h) {
      const g = ctx.createLinearGradient(x, y, x, y + h);
      g.addColorStop(0, 'rgba(255, 180, 220, 0.16)');
      g.addColorStop(1, 'rgba(255, 220, 150, 0.14)');
      ctx.fillStyle = g;
      ctx.fillRect(x, y, w, h);
    },
  },
};

/** Caption colours offered in the editor. */
export const CAPTION_COLORS = ['#ffffff', '#ffd23f', '#ff2e88', '#7df9ff'];

/** Export sizes: the common post sizes. */
export const SIZES = [
  { id: '1080x1080', w: 1080, h: 1080, label: 'Square · 1080 × 1080' },
  { id: '1080x1350', w: 1080, h: 1350, label: 'Portrait · 1080 × 1350' },
  { id: '1920x1080', w: 1920, h: 1080, label: 'Wide · 1920 × 1080' },
];

/** A fresh cover state: the first panel holds the first photo, the rest follow it. */
export function freshState(layoutId = 'strip') {
  const count = LAYOUTS[layoutId].panels.length;
  return {
    layout: layoutId,
    panels: Array.from({ length: count }, (_, i) => ({ photo: i === 0 ? 0 : null, zoom: 1, ox: 0, oy: 0 })),
    caption: 'Sunset Heist',
    subcaption: 'Neon Nights',
    captionColor: '#ffffff',
    captionPos: 'bottom',
    grade: 'sunset',
  };
}

/** Panel rectangles in pixels for a cover of w by h, with a gutter between panels. */
export function panelRects(layoutId, w, h) {
  const gutter = Math.max(2, Math.round(w * 0.007));
  return LAYOUTS[layoutId].panels.map(([fx, fy, fw, fh]) => {
    const x = Math.round(fx * w) + (fx > 0 ? gutter / 2 : 0);
    const y = Math.round(fy * h) + (fy > 0 ? gutter / 2 : 0);
    const pw = Math.round(fw * w) - (fx > 0 ? gutter / 2 : 0) - (fx + fw < 1 ? gutter / 2 : 0);
    const ph = Math.round(fh * h) - (fy > 0 ? gutter / 2 : 0) - (fy + fh < 1 ? gutter / 2 : 0);
    return { x, y, w: pw, h: ph };
  });
}

/** Draws one photo into a panel rect, cover-fit, with the panel's zoom and pan. */
function drawPhotoInPanel(ctx, img, rect, panel, filter) {
  const { x, y, w, h } = rect;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.filter = filter;
  const base = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const sw = img.naturalWidth * base * panel.zoom;
  const sh = img.naturalHeight * base * panel.zoom;
  const dx = x + (w - sw) / 2 + panel.ox * w * 0.3;
  const dy = y + (h - sh) / 2 + panel.oy * h * 0.3;
  ctx.drawImage(img, dx, dy, sw, sh);
  ctx.restore();
}

/** Draws the empty-panel placeholder: a tinted gradient and an invitation. */
function drawEmptyPanel(ctx, rect, grade, scale) {
  const { x, y, w, h } = rect;
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, '#3a1650');
  g.addColorStop(1, '#1a0b2a');
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  grade.tint(ctx, x, y, w, h);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
  ctx.font = `bold ${Math.round(34 * scale)}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('+', x + w / 2, y + h / 2 - 14 * scale);
  ctx.font = `${Math.round(20 * scale)}px system-ui, sans-serif`;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.fillText('add a photo', x + w / 2, y + h / 2 + 18 * scale);
  ctx.textBaseline = 'alphabetic';
}

/** Draws the caption and its small line, tilted a touch like a poster title. */
function drawCaption(ctx, state, grade, w, h) {
  const text = state.caption.trim().toUpperCase();
  const small = state.subcaption.trim().toUpperCase();
  if (!text && !small) return;
  const scale = h / 1080;
  const cx = w / 2;
  const bottom = state.captionPos === 'bottom';
  const baseY = bottom ? h * 0.92 : h * 0.13;
  ctx.save();
  ctx.translate(cx, baseY);
  ctx.rotate(-0.022);
  ctx.textAlign = 'center';
  if (text) {
    let size = Math.round(h * 0.115);
    ctx.font = `${size}px Anton, "Arial Narrow", sans-serif`;
    while (ctx.measureText(text).width > w * 0.92 && size > 14) {
      size -= 2;
      ctx.font = `${size}px Anton, "Arial Narrow", sans-serif`;
    }
    const tw = ctx.measureText(text).width;
    ctx.shadowColor = grade.accent;
    ctx.shadowBlur = size * 0.12;
    ctx.shadowOffsetY = size * 0.04;
    ctx.lineWidth = Math.max(2, size * 0.09);
    ctx.strokeStyle = 'rgba(12, 4, 24, 0.9)';
    ctx.lineJoin = 'round';
    ctx.strokeText(text, 0, 0);
    ctx.fillStyle = state.captionColor;
    ctx.fillText(text, 0, 0);
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    // Gradient accent bar under the words.
    const bar = ctx.createLinearGradient(-tw / 2, 0, tw / 2, 0);
    bar.addColorStop(0, '#ff2e88');
    bar.addColorStop(0.5, '#ff8c28');
    bar.addColorStop(1, '#ffd23f');
    ctx.fillStyle = bar;
    const barY = size * 0.22;
    ctx.fillRect(-tw * 0.3, barY, tw * 0.6, Math.max(3, size * 0.07));
    if (small) {
      ctx.font = `bold ${Math.round(size * 0.24)}px system-ui, sans-serif`;
      try { ctx.letterSpacing = `${Math.round(size * 0.08)}px`; } catch { /* older canvas */ }
      ctx.fillStyle = '#ffd23f';
      // Clear of the big letters: above them at the foot, below them at the top.
      const smallY = bottom ? -size * 1.08 : size * 0.62;
      ctx.fillText(small, 0, smallY);
      try { ctx.letterSpacing = '0px'; } catch { /* older canvas */ }
    }
  } else if (small) {
    ctx.font = `bold ${Math.round(30 * scale)}px system-ui, sans-serif`;
    try { ctx.letterSpacing = '6px'; } catch { /* older canvas */ }
    ctx.fillStyle = '#ffd23f';
    ctx.fillText(small, 0, 0);
    try { ctx.letterSpacing = '0px'; } catch { /* older canvas */ }
  }
  ctx.restore();
}

/**
 * Draws the whole cover onto `ctx` at w by h.
 * `photos` is the tray of loaded images (a panel's `photo` indexes into it).
 * `state` is a cover state as freshState makes it.
 */
export function drawCover(ctx, photos, state, w, h) {
  const grade = GRADES[state.grade] ?? GRADES.sunset;
  const scale = h / 1080;
  ctx.save();
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#14091f';
  ctx.fillRect(0, 0, w, h);
  const rects = panelRects(state.layout, w, h);
  rects.forEach((rect, i) => {
    const panel = state.panels[i];
    const img = panel && panel.photo != null ? photos[panel.photo] : null;
    if (img) {
      drawPhotoInPanel(ctx, img, rect, panel, grade.filter);
      grade.tint(ctx, rect.x, rect.y, rect.w, rect.h);
    } else {
      drawEmptyPanel(ctx, rect, grade, scale);
    }
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.lineWidth = Math.max(2, Math.round(3 * scale));
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
  });
  // Soft vignette so the panels read as one poster.
  const vig = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
  vig.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vig.addColorStop(1, 'rgba(10, 4, 20, 0.30)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);
  drawCaption(ctx, state, grade, w, h);
  ctx.restore();
}
