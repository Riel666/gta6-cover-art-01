// Wires the page: photos in, panels arranged, caption typed, PNG out. A `?shot=` query
// sets up a fixed scene for a screenshot instead (./shots.js).
import { drawCover, freshState, LAYOUTS, GRADES, CAPTION_COLORS, SIZES, panelRects } from './cover.js';
import { runShot } from './shots.js';

const canvas = document.getElementById('cover');
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');
const tray = document.getElementById('tray');
const zoomInput = document.getElementById('zoom');
const panelPhotoSelect = document.getElementById('panelPhoto');

let photos = []; // { img, name, url }
let state = freshState('strip');
state.size = '1080x1080';
let selectedPanel = 0;
let selectedPhoto = 0;
let currentSizeId = '';

/** Loads an image from a URL, resolving once it can be drawn. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function exportSize() {
  return SIZES.find((s) => s.id === state.size) ?? SIZES[0];
}

/** Paints the preview at the chosen export size, so preview and export match exactly. */
function redraw() {
  const size = exportSize();
  if (currentSizeId !== size.id) {
    canvas.width = size.w;
    canvas.height = size.h;
    currentSizeId = size.id;
  }
  drawCover(ctx, photos.map((p) => p.img), state, size.w, size.h);
}

/** Renders the export as a PNG data URL (used by the Export button and by tests). */
function exportDataURL(sizeId) {
  const size = SIZES.find((s) => s.id === sizeId) ?? exportSize();
  const off = document.createElement('canvas');
  off.width = size.w;
  off.height = size.h;
  drawCover(off.getContext('2d'), photos.map((p) => p.img), state, size.w, size.h);
  return off.toDataURL('image/png');
}

function syncPanelControls() {
  const panel = state.panels[selectedPanel];
  zoomInput.value = panel ? panel.zoom : 1;
  panelPhotoSelect.value = panel && panel.photo != null ? String(panel.photo) : '';
  [...tray.children].forEach((thumb, i) => {
    thumb.classList.toggle('selected', i === selectedPhoto);
    thumb.classList.toggle('assigned', state.panels.some((p) => p.photo === i));
  });
}

function renderTray() {
  tray.replaceChildren();
  photos.forEach((photo, i) => {
    const thumb = document.createElement('img');
    thumb.src = photo.url;
    thumb.alt = photo.name;
    thumb.title = photo.name;
    thumb.addEventListener('click', () => {
      selectedPhoto = i;
      state.panels[selectedPanel].photo = i;
      syncPanelControls();
      redraw();
    });
    tray.appendChild(thumb);
  });
  syncPanelControls();
}

function renderPanelPhotoOptions() {
  panelPhotoSelect.replaceChildren();
  const none = document.createElement('option');
  none.value = '';
  none.textContent = '— empty —';
  panelPhotoSelect.appendChild(none);
  photos.forEach((photo, i) => {
    const option = document.createElement('option');
    option.value = String(i);
    option.textContent = photo.name;
    panelPhotoSelect.appendChild(option);
  });
  syncPanelControls();
}

function addPhotos(newPhotos) {
  photos = photos.concat(newPhotos);
  renderTray();
  renderPanelPhotoOptions();
  redraw();
}

function buildChoices(container, entries, current, onPick) {
  container.replaceChildren();
  entries.forEach(([id, label]) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.dataset.choiceId = id;
    button.classList.toggle('active', id === current);
    button.addEventListener('click', () => {
      onPick(id);
      [...container.children].forEach((b) => b.classList.toggle('active', b === button));
    });
    container.appendChild(button);
  });
  return container;
}

/** Re-marks every choice button from the state (shots and code set state directly). */
function syncChoices() {
  const sync = (container, current) => {
    [...container.children].forEach((b) => b.classList.toggle('active', b.dataset.choiceId === current));
  };
  sync(layoutChoices, state.layout);
  sync(gradeChoices, state.grade);
  sync(sizeChoices, state.size);
  sync(colorSwatches, state.captionColor);
}

function setLayout(layoutId) {
  const old = state.panels;
  state.layout = layoutId;
  state.panels = LAYOUTS[layoutId].panels.map((_, i) => old[i] ?? { photo: photos.length ? 0 : null, zoom: 1, ox: 0, oy: 0 });
  selectedPanel = Math.min(selectedPanel, state.panels.length - 1);
  syncPanelControls();
  syncChoices();
  redraw();
}

function setGrade(gradeId) {
  state.grade = gradeId;
  syncChoices();
  redraw();
}

function setSize(sizeId) {
  state.size = sizeId;
  syncChoices();
  redraw();
}

function buildCaptionColors() {
  const container = document.getElementById('captionColors');
  container.replaceChildren();
  CAPTION_COLORS.forEach((color) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.style.background = color;
    button.dataset.choiceId = color;
    button.setAttribute('aria-label', `Caption colour ${color}`);
    button.classList.toggle('active', color === state.captionColor);
    button.addEventListener('click', () => {
      state.captionColor = color;
      [...container.children].forEach((b) => b.classList.toggle('active', b === button));
      redraw();
    });
    container.appendChild(button);
  });
  return container;
}

const layoutChoices = buildChoices(
  document.getElementById('layouts'),
  Object.entries(LAYOUTS).map(([id, l]) => [id, l.name]),
  state.layout,
  setLayout,
);
const gradeChoices = buildChoices(
  document.getElementById('grades'),
  Object.entries(GRADES).map(([id, g]) => [id, g.name]),
  state.grade,
  setGrade,
);
const sizeChoices = buildChoices(
  document.getElementById('sizes'),
  SIZES.map((s) => [s.id, s.label]),
  state.size,
  setSize,
);
const colorSwatches = buildCaptionColors();

document.getElementById('caption').addEventListener('input', (e) => {
  state.caption = e.target.value;
  redraw();
});
document.getElementById('subcaption').addEventListener('input', (e) => {
  state.subcaption = e.target.value;
  redraw();
});
document.getElementById('captionPos').addEventListener('change', (e) => {
  state.captionPos = e.target.value;
  redraw();
});
zoomInput.addEventListener('input', () => {
  state.panels[selectedPanel].zoom = Number(zoomInput.value);
  redraw();
});
panelPhotoSelect.addEventListener('change', () => {
  state.panels[selectedPanel].photo = panelPhotoSelect.value === '' ? null : Number(panelPhotoSelect.value);
  syncPanelControls();
  redraw();
});
document.getElementById('fillAll').addEventListener('click', () => {
  const photo = photos[selectedPhoto];
  if (!photo) return;
  state.panels.forEach((panel) => { panel.photo = selectedPhoto; });
  syncPanelControls();
  redraw();
});
document.getElementById('shuffle').addEventListener('click', () => {
  if (!photos.length) return;
  state.panels.forEach((panel) => {
    panel.photo = Math.floor(Math.random() * photos.length);
    panel.zoom = 1 + Math.random() * 0.4;
    panel.ox = (Math.random() - 0.5) * 0.6;
    panel.oy = (Math.random() - 0.5) * 0.6;
  });
  syncPanelControls();
  redraw();
});
document.getElementById('photos').addEventListener('change', async (e) => {
  const files = [...e.target.files];
  if (!files.length) return;
  const loaded = [];
  for (const file of files) {
    const url = URL.createObjectURL(file);
    try {
      loaded.push({ img: await loadImage(url), name: file.name, url });
    } catch {
      URL.revokeObjectURL(url);
    }
  }
  if (loaded.length) {
    addPhotos(loaded);
    status.textContent = `Added ${loaded.length} photo${loaded.length > 1 ? 's' : ''}. Click one to put it in the selected panel.`;
  }
  e.target.value = '';
});
document.getElementById('export').addEventListener('click', async () => {
  const size = exportSize();
  const button = document.getElementById('export');
  button.disabled = true;
  status.textContent = 'Exporting…';
  await document.fonts.ready;
  const dataUrl = exportDataURL(size.id);
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `vice-cover-${size.id}.png`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 60_000);
  status.textContent = `Saved vice-cover-${size.id}.png`;
  button.disabled = false;
});

/** Click selects a panel; dragging inside it pans the photo. */
let drag = null;
function canvasPoint(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((e.clientX - rect.left) / rect.width) * canvas.width,
    y: ((e.clientY - rect.top) / rect.height) * canvas.height,
  };
}
canvas.addEventListener('pointerdown', (e) => {
  const point = canvasPoint(e);
  const rects = panelRects(state.layout, canvas.width, canvas.height);
  const hit = rects.findIndex((r) => point.x >= r.x && point.x <= r.x + r.w && point.y >= r.y && point.y <= r.y + r.h);
  if (hit === -1) return;
  selectedPanel = hit;
  syncPanelControls();
  try { canvas.setPointerCapture(e.pointerId); } catch { /* synthetic pointer */ }
  drag = { start: point, moved: false, ox: state.panels[hit].ox, oy: state.panels[hit].oy, rect: rects[hit] };
  redraw();
});
canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const point = canvasPoint(e);
  const dx = point.x - drag.start.x;
  const dy = point.y - drag.start.y;
  if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
  const panel = state.panels[selectedPanel];
  panel.ox = Math.max(-1, Math.min(1, drag.ox + dx / (drag.rect.w * 0.3)));
  panel.oy = Math.max(-1, Math.min(1, drag.oy + dy / (drag.rect.h * 0.3)));
  redraw();
});
canvas.addEventListener('pointerup', () => { drag = null; });

/** Loads the shipped sample photos and spreads them across the panels. */
async function loadSamples(names) {
  const loaded = [];
  for (const name of names) {
    const url = `samples/${name}.jpg`;
    try {
      loaded.push({ img: await loadImage(url), name: `${name}.jpg`, url });
    } catch {
      // A missing sample leaves the tray shorter; the app still works.
    }
  }
  return loaded;
}

function spreadAcrossPanels() {
  state.panels.forEach((panel, i) => {
    panel.photo = photos.length ? i % photos.length : null;
  });
}

const shot = new URLSearchParams(location.search).get('shot');
if (shot) {
  runShot(shot, new URLSearchParams(location.search), {
    loadSamples,
    addPhotos,
    spreadAcrossPanels,
    setLayout,
    setGrade,
    setSize,
    setCaption(text) {
      state.caption = text;
      document.getElementById('caption').value = text;
    },
    setSubcaption(text) {
      state.subcaption = text;
      document.getElementById('subcaption').value = text;
    },
    redraw,
  });
} else {
  loadSamples(['pier', 'boulevard']).then((loaded) => {
    addPhotos(loaded);
    spreadAcrossPanels();
    syncPanelControls();
    redraw();
  });
  document.fonts.ready.then(redraw);
  redraw();
}

// Test hook: the screenshots and the local check call the export path through here.
window.__viceCover = {
  get state() { return state; },
  get photos() { return photos; },
  redraw,
  exportDataURL,
};
