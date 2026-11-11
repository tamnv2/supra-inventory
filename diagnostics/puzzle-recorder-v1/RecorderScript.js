// Geometry-only drag observer. No keyboard, DOM text, URL, images, storage or network reads.
(() => {
  'use strict';
  if (window.__supraPuzzleRecorderV1) return;
  window.__supraPuzzleRecorderV1 = true;
  let active = null;
  const safeNumber = value => Math.round(Number(value) * 10) / 10;
  const point = e => [safeNumber(e.clientX), safeNumber(e.clientY),
                        Math.round(performance.now() - active.started)];
  const forbidden = target => {
    if (!target || !target.closest) return false;
    return !!target.closest('input, textarea, select, [contenteditable], [role="textbox"]');
  };
  const down = e => {
    if (!e.isPrimary || e.button !== 0 || forbidden(e.target)) return;
    active = { pointerId: e.pointerId, started: performance.now(),
      viewport: [Math.round(innerWidth), Math.round(innerHeight)],
      scale: safeNumber(devicePixelRatio || 1),
      frame: window === window.top ? 'main' : 'child',
      points: [] };
    active.points.push(point(e));
  };
  const move = e => {
    if (!active || e.pointerId !== active.pointerId) return;
    const now = performance.now();
    const last = active.points[active.points.length - 1];
    if (now - active.started - last[2] < 25 || active.points.length >= 120) return;
    active.points.push(point(e));
  };
  const finish = e => {
    if (!active || e.pointerId !== active.pointerId) return;
    const record = active;
    record.points.push(point(e));
    active = null;
    const first = record.points[0], last = record.points[record.points.length - 1];
    if (Math.hypot(last[0] - first[0], last[1] - first[1]) < 5) return;
    try {
      if (window.chrome && window.chrome.webview) {
        window.chrome.webview.postMessage({ kind: 'supra-drag-v1',
          viewport: record.viewport, scale: record.scale, frame: record.frame,
          points: record.points.slice(0, 121) });
      }
    } catch (_) { /* No fallback or external telemetry. */ }
  };
  document.addEventListener('pointerdown', down, true);
  document.addEventListener('pointermove', move, true);
  document.addEventListener('pointerup', finish, true);
  document.addEventListener('pointercancel', finish, true);
})();