// Fixed scenes for screenshots: ?shot=editor shows the page with sample
// photos loaded; ?shot=cover shows the exported cover alone, drawn by the
// app itself at the viewport's size. `photo` names the samples (pier,
// boulevard), `layout`, `grade`, `size`, `caption` and `sub` pose the scene.
// window.__shotReady is set once the scene has painted.
export async function runShot(query, api, previewCanvas) {
  const shot = query.get('shot');
  const photos = (query.get('photo') ?? 'pier,boulevard').split(',').filter(Boolean);
  const layout = query.get('layout') ?? 'hero';
  const grade = query.get('grade') ?? 'sunset';
  const caption = query.get('caption') ?? 'Sunset Heist';
  const sub = query.get('sub') ?? 'Neon Streets';
  const size = query.get('size') ?? 'square';
  const panel = Number(query.get('panel') ?? '0');

  await api.loadSamples(photos);
  api.applyShot({ layout, grade, caption, sub, size, panel });

  // The caption fonts are local files: wait for them before painting, so the
  // lettering is the real Anton, not a fallback.
  try {
    await document.fonts.load('64px Anton');
    await document.fonts.load('32px "Bebas Neue"');
    await document.fonts.ready;
  } catch {
    // A font that cannot load still leaves a readable fallback behind.
  }

  if (shot === 'cover') {
    document.body.classList.add('shot-cover');
    api.drawCoverTo(previewCanvas, window.innerWidth, window.innerHeight);
  } else {
    api.applyShot({ layout, grade, caption, sub, size, panel });
  }
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  window.__shotReady = true;
}
