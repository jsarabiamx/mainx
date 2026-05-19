/**
 * charts.js v4 - Helpers pequenos para las graficas de la mesa de control.
 * Usa Chart.js cuando esta disponible y cae a canvas nativo si el CDN no carga.
 */
const Charts = (() => {
  const instances = new Map();

  function canvas(id) {
    const el = document.getElementById(id);
    return el && el.getContext ? el : null;
  }

  function clear(id) {
    const old = instances.get(id);
    if (old && typeof old.destroy === 'function') old.destroy();
    instances.delete(id);

    const c = canvas(id);
    if (!c) return null;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, c.width, c.height);
    return c;
  }

  function make(id, config) {
    const c = clear(id);
    if (!c || typeof Chart === 'undefined') return null;
    const chart = new Chart(c, config);
    instances.set(id, chart);
    return chart;
  }

  function sizeCanvas(c) {
    const rect = c.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    const w = Math.max(1, Math.round((rect.width || c.clientWidth || 120) * ratio));
    const h = Math.max(1, Math.round((rect.height || c.clientHeight || 60) * ratio));
    if (c.width !== w || c.height !== h) {
      c.width = w;
      c.height = h;
    }
    return { w, h, ratio };
  }

  function fallbackLine(id, values, color, fill) {
    const c = clear(id);
    if (!c) return;
    const ctx = c.getContext('2d');
    const { w, h } = sizeCanvas(c);
    const data = (values || []).map(Number);
    if (!data.length) return;

    const min = Math.min(...data);
    const max = Math.max(...data);
    const span = max - min || 1;
    const pad = Math.max(4, Math.round(Math.min(w, h) * 0.1));
    const pts = data.map((v, i) => ({
      x: pad + (data.length === 1 ? 0.5 : i / (data.length - 1)) * (w - pad * 2),
      y: h - pad - ((v - min) / span) * (h - pad * 2)
    }));

    if (fill && pts.length > 1) {
      ctx.beginPath();
      ctx.moveTo(pts[0].x, h - pad);
      pts.forEach(p => ctx.lineTo(p.x, p.y));
      ctx.lineTo(pts[pts.length - 1].x, h - pad);
      ctx.closePath();
      ctx.fillStyle = hexToRgba(color, 0.16);
      ctx.fill();
    }

    ctx.beginPath();
    pts.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(2, Math.round(w / 90));
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  }

  function fallbackBar(id, values, color) {
    const c = clear(id);
    if (!c) return;
    const ctx = c.getContext('2d');
    const { w, h } = sizeCanvas(c);
    const data = (values || []).map(Number);
    if (!data.length) return;
    const max = Math.max(...data, 1);
    const gap = Math.max(2, Math.round(w * 0.025));
    const bw = Math.max(2, (w - gap * (data.length + 1)) / data.length);
    data.forEach((v, i) => {
      const bh = Math.max(2, (v / max) * (h - gap * 2));
      ctx.fillStyle = color;
      ctx.fillRect(gap + i * (bw + gap), h - gap - bh, bw, bh);
    });
  }

  function fallbackDonut(id, values, colors) {
    const c = clear(id);
    if (!c) return;
    const ctx = c.getContext('2d');
    const { w, h } = sizeCanvas(c);
    const data = (values || []).map(Number);
    const total = data.reduce((a, b) => a + b, 0);
    if (!total) return;
    const cx = w / 2;
    const cy = h / 2;
    const r = Math.max(4, Math.min(w, h) * 0.46);
    const inner = r * 0.62;
    let start = -Math.PI / 2;
    data.forEach((v, i) => {
      const end = start + (v / total) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(cx, cy, r, start, end);
      ctx.arc(cx, cy, inner, end, start, true);
      ctx.closePath();
      ctx.fillStyle = colors[i % colors.length];
      ctx.fill();
      start = end;
    });
  }

  function hexToRgba(hex, alpha) {
    const clean = String(hex || '#3b82f6').replace('#', '');
    const full = clean.length === 3 ? clean.split('').map(ch => ch + ch).join('') : clean;
    const n = parseInt(full, 16);
    const r = (n >> 16) & 255;
    const g = (n >> 8) & 255;
    const b = n & 255;
    return `rgba(${r},${g},${b},${alpha})`;
  }

  function sparkline(id, values, color = '#3b82f6') {
    if (make(id, {
      type: 'line',
      data: { labels: values.map((_, i) => i + 1), datasets: [{ data: values, borderColor: color, backgroundColor: hexToRgba(color, 0.14), borderWidth: 2, tension: 0.35, fill: true, pointRadius: 0 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { enabled: false } }, scales: { x: { display: false }, y: { display: false } } }
    })) return;
    fallbackLine(id, values, color, true);
  }

  function bar(id, labels, values, color = '#3b82f6') {
    if (make(id, {
      type: 'bar',
      data: { labels: labels || values.map((_, i) => i + 1), datasets: [{ data: values, backgroundColor: color, borderRadius: 3 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { enabled: false } }, scales: { x: { display: false }, y: { display: false } } }
    })) return;
    fallbackBar(id, values, color);
  }

  function donut(id, labels, values, colors) {
    if (make(id, {
      type: 'doughnut',
      data: { labels, datasets: [{ data: values, backgroundColor: colors, borderWidth: 0 }] },
      options: { responsive: true, maintainAspectRatio: false, cutout: '64%', plugins: { legend: { display: false } } }
    })) return;
    fallbackDonut(id, values, colors);
  }

  function lineChart(id, labels, values, color = '#3b82f6') {
    if (make(id, {
      type: 'line',
      data: { labels, datasets: [{ data: values, borderColor: color, backgroundColor: hexToRgba(color, 0.12), borderWidth: 2, tension: 0.3, fill: true, pointRadius: 2 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(148,163,184,.12)' } }, y: { beginAtZero: true, ticks: { color: '#94a3b8' }, grid: { color: 'rgba(148,163,184,.12)' } } } }
    })) return;
    fallbackLine(id, values, color, true);
  }

  return { sparkline, bar, donut, lineChart };
})();
