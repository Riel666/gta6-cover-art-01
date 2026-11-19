// Vice Cover Studio — editor wiring.
// Owns the page state (photos, layout, grade, caption, per-panel placement),
// draws the live preview, and exports the finished cover as a PNG. Photos are
// read on this machine only: file inputs, drag and drop, or the bundled
// samples. A `?shot=` query hands the page to ./shots.js for screenshots.
import { LAYOUTS, GRADES, SIZES, blankPanels, drawCover, panelAt } from './cover.js';
import { runShot } from './shots.js';

const PREVIEW_MAX = 760;

const state = {
  layout: 'hero',
  grade: 'sunset',
  caption: 'Sunset Heist',
  sub: 'Neon Streets',
  size: 'square',
  photos: [],
  photoNames: [],
  panelsByLayout: {},
  selectedPanel: 0,
  // A layout stays auto-filled until the person places a photo in one of its
  // panels by hand; while auto, a newly added photo spreads across the panels.
  autoByLayout: {},
};

function panels() {
  if (!state.panelsByLayout[state.layout]) {
    state.panelsByLayout[state.layout] = blankPanels(state.layout, state.photos.length);
    state.autoByLayout[state.layout] = true;
  }
  return state.panelsByLayout[state.layout];
}

function currentSize() {
  return SIZES[state.size];
}

const canvas = document.getElementById('preview');
const statusEl = document.getElementById('status');
const captionInput = document.getElementById('caption');
const subInput = document.getElementById('subcaption');
const photoInput = document.getElementById('photos');
const panelPhotoSelect = document.getElementById('panel-photo');
const zoomRange = document.getElementById('panel-zoom');
const zoomLabel = document.getElementById('zoom-label');
const panelLabel = document.getElementById('panel-label');

function setStatus(text) {
  statusEl.textContent = text;
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`could not load ${url}`));
    img.src = url;
  });
}

async function addPhotoFiles(files) {
  const added = [];
  for (const file of files) {
    if (!file.type.startsWith('image/')) continue;
    const url = URL.createObjectURL(file);
    try {
      const img = await loadImage(url);
      state.photos.push(img);
      state.photoNames.push(file.name.replace(/\.[^.]+$/, ''));
      added.push(file.name);
    } catch {
      setStatus(`Could not read ${file.name} as a photo.`);
    }
  }
  if (added.length) {
    reassignEmptyPanels();
    refreshPanelControls();
    redraw();
    setStatus(`Loaded ${added.length} photo${added.length > 1 ? 's' : ''}: ${added.join(', ')}.`);
  }
}

async function addSample(name) {
  try {
    const img = await loadImage(`./samples/${name}.jpg`);
    state.photos.push(img);
    state.photoNames.push(name === 'pier' ? 'Pier sunset' : 'Boulevard');
    reassignEmptyPanels();
    refreshPanelControls();
    redraw();
    setStatus(`Sample photo “${name}” loaded.`);
  } catch {
    setStatus(`Sample photo “${name}” failed to load.`);
  }
}

// Any panel pointing at no photo takes the next photo in turn, so one photo
// fills the whole cover and several photos spread across the panels. A layout
// the person has placed by hand keeps its choices and only fills empties;
// an untouched layout is re-spread, so a second photo actually shows up.
function reassignEmptyPanels() {
  const count = state.photos.length;
  if (!count) return;
  for (const layoutId of Object.keys(state.panelsByLayout)) {
    const list = state.panelsByLayout[layoutId];
    if (state.autoByLayout[layoutId] === false) {
      list.forEach((placement, i) => {
        if (placement.photo < 0) placement.photo = i % count;
      });
    } else {
      list.forEach((placement, i) => {
        placement.photo = i % count;
      });
      state.autoByLayout[layoutId] = true;
    }
  }
}

function redraw() {
  const size = currentSize();
  const scale = Math.min(1, PREVIEW_MAX / Math.max(size.w, size.h));
  const pw = Math.round(size.w * scale);
  const ph = Math.round(size.h * scale);
  if (canvas.width !== pw || canvas.height !== ph) {
    canvas.width = pw;
    canvas.height = ph;
  }
  const ctx = canvas.getContext('2d');
  drawCover(ctx, pw, ph, {
    layout: state.layout,
    grade: state.grade,
    caption: state.caption,
    sub: state.sub,
    photos: state.photos,
    panels: panels(),
  });
  drawSelectionRing(ctx, pw, ph);
}

function drawSelectionRing(ctx, W, H) {
  const layout = LAYOUTS[state.layout];
  const panel = layout.panels[state.selectedPanel];
  if (!panel) return;
  ctx.save();
  ctx.strokeStyle = '#ffd319';
  ctx.lineWidth = 3;
  ctx.setLineDash([10, 6]);
  ctx.strokeRect(panel.x * W + 2, panel.y * H + 2, panel.w * W - 4, panel.h * H - 4);
  ctx.setLineDash([]);
  ctx.fillStyle = '#ffd319';
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(`PANEL ${state.selectedPanel + 1}`, panel.x * W + 8, panel.y * H + 8);
  ctx.restore();
}

function refreshPanelControls() {
  const list = panels();
  const placement = list[state.selectedPanel];
  panelLabel.textContent = `Panel ${state.selectedPanel + 1} of ${list.length}`;
  panelPhotoSelect.innerHTML = '';
  const none = document.createElement('option');
  none.value = '-1';
  none.textContent = 'Empty';
  panelPhotoSelect.append(none);
  state.photoNames.forEach((name, i) => {
    const option = document.createElement('option');
    option.value = String(i);
    option.textContent = `Photo ${i + 1} — ${name}`;
    panelPhotoSelect.append(option);
  });
  panelPhotoSelect.value = String(placement ? placement.photo : -1);
  const zoom = placement ? placement.zoom : 1;
  zoomRange.value = String(zoom);
  zoomLabel.textContent = `${zoom.toFixed(2)}×`;
}

function buildPickers() {
  const layoutBox = document.getElementById('layout-pick');
  for (const [id, layout] of Object.entries(LAYOUTS)) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'pick';
    button.dataset.layout = id;
    button.innerHTML = `<strong>${layout.name}</strong><span>${layout.blurb}</span>`;
    button.addEventListener('click', () => {
      state.layout = id;
      state.selectedPanel = 0;
      panels();
      markPicked(layoutBox, button);
      refreshPanelControls();
      redraw();
    });
    layoutBox.append(button);
  }
  const gradeBox = document.getElementById('grade-pick');
  for (const [id, grade] of Object.entries(GRADES)) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'swatch';
    button.dataset.grade = id;
    button.title = grade.name;
    button.style.background = `linear-gradient(135deg, ${grade.sky[0]}, ${grade.sky[1]})`;
    button.innerHTML = `<span>${grade.name}</span>`;
    button.addEventListener('click', () => {
      state.grade = id;
      markPicked(gradeBox, button);
      redraw();
    });
    gradeBox.append(button);
  }
  const sizeBox = document.getElementById('size-pick');
  for (const [id, size] of Object.entries(SIZES)) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'pick';
    button.dataset.size = id;
    button.innerHTML = `<strong>${size.label}</strong>`;
    button.addEventListener('click', () => {
      state.size = id;
      markPicked(sizeBox, button);
      redraw();
    });
    sizeBox.append(button);
  }
  markPicked(layoutBox, layoutBox.querySelector('[data-layout="hero"]'));
  markPicked(gradeBox, gradeBox.querySelector('[data-grade="sunset"]'));
  markPicked(sizeBox, sizeBox.querySelector('[data-size="square"]'));
}

function markPicked(box, button) {
  box.querySelectorAll('button').forEach((b) => b.classList.toggle('picked', b === button));
}

// Dragging on the preview pans the photo inside the panel under the pointer;
// a plain click just selects that panel.
let drag = null;
canvas.addEventListener('pointerdown', (event) => {
  const rect = canvas.getBoundingClientRect();
  const px = ((event.clientX - rect.left) / rect.width) * canvas.width;
  const py = ((event.clientY - rect.top) / rect.height) * canvas.height;
  const hit = panelAt(state, canvas.width, canvas.height, px, py);
  if (hit < 0) return;
  state.selectedPanel = hit;
  refreshPanelControls();
  const placement = panels()[hit];
  drag = { x: event.clientX, y: event.clientY, dx: placement.dx, dy: placement.dy, moved: false };
  canvas.setPointerCapture(event.pointerId);
  redraw();
});
canvas.addEventListener('pointermove', (event) => {
  if (!drag) return;
  const rect = canvas.getBoundingClientRect();
  const layout = LAYOUTS[state.layout];
  const panel = layout.panels[state.selectedPanel];
  const dpx = ((event.clientX - drag.x) / rect.width) * canvas.width;
  const dpy = ((event.clientY - drag.y) / rect.height) * canvas.height;
  if (Math.abs(dpx) + Math.abs(dpy) > 2) drag.moved = true;
  const placement = panels()[state.selectedPanel];
  placement.dx = drag.dx + dpx / (panel.w * canvas.width);
  placement.dy = drag.dy + dpy / (panel.h * canvas.height);
  redraw();
});
canvas.addEventListener('pointerup', () => {
  drag = null;
});

photoInput.addEventListener('change', (event) => {
  addPhotoFiles([...event.target.files]);
  event.target.value = '';
});
document.getElementById('sample-pier').addEventListener('click', () => addSample('pier'));
document.getElementById('sample-boulevard').addEventListener('click', () => addSample('boulevard'));

captionInput.addEventListener('input', () => {
  state.caption = captionInput.value;
  redraw();
});
subInput.addEventListener('input', () => {
  state.sub = subInput.value;
  redraw();
});

panelPhotoSelect.addEventListener('change', () => {
  const placement = panels()[state.selectedPanel];
  if (placement) placement.photo = Number(panelPhotoSelect.value);
  state.autoByLayout[state.layout] = false;
  redraw();
});
zoomRange.addEventListener('input', () => {
  const placement = panels()[state.selectedPanel];
  if (!placement) return;
  placement.zoom = Number(zoomRange.value);
  zoomLabel.textContent = `${placement.zoom.toFixed(2)}×`;
  redraw();
});
document.getElementById('panel-reset').addEventListener('click', () => {
  const list = panels();
  list[state.selectedPanel] = { photo: state.selectedPanel % Math.max(1, state.photos.length), zoom: 1, dx: 0, dy: 0 };
  if (!state.photos.length) list[state.selectedPanel].photo = -1;
  state.autoByLayout[state.layout] = false;
  refreshPanelControls();
  redraw();
});
document.getElementById('fill-all').addEventListener('click', () => {
  const placement = panels()[state.selectedPanel];
  if (!placement || placement.photo < 0) {
    setStatus('Pick a photo for this panel first.');
    return;
  }
  for (const layoutId of Object.keys(state.panelsByLayout)) {
    state.panelsByLayout[layoutId].forEach((slot) => {
      slot.photo = placement.photo;
      slot.zoom = placement.zoom;
      slot.dx = placement.dx;
      slot.dy = placement.dy;
    });
    state.autoByLayout[layoutId] = false;
  }
  redraw();
  setStatus(`Every panel now shows photo ${placement.photo + 1}.`);
});

// Drop photos straight onto the preview.
canvas.addEventListener('dragover', (event) => event.preventDefault());
canvas.addEventListener('drop', (event) => {
  event.preventDefault();
  addPhotoFiles([...event.dataTransfer.files]);
});

document.getElementById('export').addEventListener('click', () => {
  const size = currentSize();
  const off = document.createElement('canvas');
  off.width = size.w;
  off.height = size.h;
  drawCover(off.getContext('2d'), size.w, size.h, {
    layout: state.layout,
    grade: state.grade,
    caption: state.caption,
    sub: state.sub,
    photos: state.photos,
    panels: panels(),
  });
  off.toBlob((blob) => {
    if (!blob) {
      setStatus('Export failed: the browser could not make the PNG.');
      return;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `vice-cover-${state.size}-${size.w}x${size.h}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    setStatus(`Saved vice-cover-${state.size}-${size.w}x${size.h}.png — share it anywhere.`);
  }, 'image/png');
});

// The screenshot scene driver: it loads the samples and poses the app, and
// the editor then runs exactly as a person would see it.
const shotApi = {
  state,
  async loadSamples(names) {
    for (const name of names) await addSample(name);
  },
  applyShot(patch) {
    if (patch.layout && LAYOUTS[patch.layout]) state.layout = patch.layout;
    if (patch.grade && GRADES[patch.grade]) state.grade = patch.grade;
    if (patch.caption !== undefined) {
      state.caption = patch.caption;
      captionInput.value = patch.caption;
    }
    if (patch.sub !== undefined) {
      state.sub = patch.sub;
      subInput.value = patch.sub;
    }
    if (patch.size && SIZES[patch.size]) state.size = patch.size;
    if (patch.panel !== undefined) state.selectedPanel = patch.panel;
    panels();
    document.querySelectorAll('#layout-pick .pick').forEach((b) => b.classList.toggle('picked', b.dataset.layout === state.layout));
    document.querySelectorAll('#grade-pick .swatch').forEach((b) => b.classList.toggle('picked', b.dataset.grade === state.grade));
    document.querySelectorAll('#size-pick .pick').forEach((b) => b.classList.toggle('picked', b.dataset.size === state.size));
    refreshPanelControls();
    redraw();
  },
  drawCoverTo(canvasEl, w, h) {
    canvasEl.width = w;
    canvasEl.height = h;
    drawCover(canvasEl.getContext('2d'), w, h, {
      layout: state.layout,
      grade: state.grade,
      caption: state.caption,
      sub: state.sub,
      photos: state.photos,
      panels: panels(),
    });
  },
};

buildPickers();
refreshPanelControls();
redraw();

const query = new URLSearchParams(location.search);
if (query.get('shot')) {
  document.fonts.load('64px Anton').then(() => document.fonts.load('32px "Bebas Neue"')).catch(() => {});
  runShot(query, shotApi, canvas).catch((error) => {
    setStatus(`Shot setup failed: ${error.message}`);
  });
} else {
  document.fonts.ready.then(() => redraw());
}
