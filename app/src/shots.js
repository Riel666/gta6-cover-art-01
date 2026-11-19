// Fixed scenes for screenshots: ?shot=editor shows the page with sample photos loaded;
// ?shot=cover shows the cover alone, drawn at the export size. Query knobs:
// photos=pier,boulevard · layout=strip|hero|grid|split · grade=sunset|neon|noir|pastel
// caption=… · subcaption=… · size=1080x1080|1080x1350|1920x1080.
// window.__shotReady is set once the scene has painted.
export async function runShot(shot, query, api) {
  if (shot === 'cover') document.body.classList.add('shot-cover');
  if (shot === 'editor') document.body.classList.add('shot-editor');
  const names = (query.get('photos') ?? 'pier,boulevard').split(',').map((s) => s.trim()).filter(Boolean);
  if (query.get('layout')) api.setLayout(query.get('layout'));
  if (query.get('grade')) api.setGrade(query.get('grade'));
  if (query.get('size')) api.setSize(query.get('size'));
  const loaded = await api.loadSamples(names);
  api.addPhotos(loaded);
  api.spreadAcrossPanels();
  api.setCaption(query.get('caption') ?? 'Sunset Heist');
  api.setSubcaption(query.get('subcaption') ?? 'Neon Nights');
  await document.fonts.ready;
  api.redraw();
  requestAnimationFrame(() => requestAnimationFrame(() => { window.__shotReady = true; }));
}
