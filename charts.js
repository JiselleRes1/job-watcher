/* Tiny dependency-free SVG charts (work offline). */
const Charts = (() => {
  const NS = "http://www.w3.org/2000/svg";
  const COLORS = ["var(--c1)", "var(--c2)", "var(--c3)", "var(--c4)"];
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const nice = max => { if (max <= 5) return 5; const p = 10 ** Math.floor(Math.log10(max)); return Math.ceil(max / p) * p; };

  /* Vertical grouped bars. series: [{name, values:[]}] */
  function bars(el, labels, series, { height = 260, ariaLabel = "Bar chart", rawLabels = false } = {}) {
    const W = 760, H = height, m = { l: 40, r: 10, t: 10, b: 46 };
    const iw = W - m.l - m.r, ih = H - m.t - m.b;
    const max = nice(Math.max(1, ...series.flatMap(s => s.values)));
    const gw = iw / Math.max(labels.length, 1), bw = Math.min(28, (gw * 0.8) / series.length);
    let g = "";
    for (let i = 0; i <= 4; i++) {
      const y = m.t + ih - (ih * i) / 4;
      g += `<line x1="${m.l}" x2="${W - m.r}" y1="${y}" y2="${y}" stroke="var(--line)"/><text x="${m.l - 6}" y="${y + 4}" text-anchor="end">${Math.round((max * i) / 4)}</text>`;
    }
    const step = Math.ceil(labels.length / 12);
    labels.forEach((lab, i) => {
      const cx = m.l + gw * i + gw / 2;
      series.forEach((s, j) => {
        const v = s.values[i], h = (v / max) * ih;
        const x = cx - (bw * series.length) / 2 + bw * j;
        g += `<rect x="${x}" y="${m.t + ih - h}" width="${bw - 1}" height="${Math.max(h, 0)}" rx="2" fill="${COLORS[j % 4]}"><title>${esc(lab)} — ${esc(s.name)}: ${v}</title></rect>`;
      });
      if (i % step === 0) g += `<text x="${cx}" y="${H - m.b + 16}" text-anchor="middle">${esc(rawLabels ? lab : lab.slice(5))}</text>`;
    });
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(ariaLabel)}">${g}</svg>` + legend(series);
  }

  /* Horizontal bars. items: [{label, value}] */
  function hbars(el, items, { ariaLabel = "Bar chart", color = COLORS[0] } = {}) {
    const rowH = 26, W = 760, lw = 230, H = items.length * rowH + 10;
    const max = Math.max(1, ...items.map(i => i.value));
    const body = items.map((it, i) => {
      const y = 5 + i * rowH, w = ((W - lw - 60) * it.value) / max;
      const lab = it.label.length > 34 ? it.label.slice(0, 33) + "…" : it.label;
      return `<text x="${lw - 8}" y="${y + 16}" text-anchor="end">${esc(lab)}</text>
        <rect x="${lw}" y="${y + 3}" width="${Math.max(w, 1)}" height="${rowH - 8}" rx="2" fill="${color}"><title>${esc(it.label)}: ${it.value}</title></rect>
        <text x="${lw + w + 6}" y="${y + 16}">${it.value}</text>`;
    }).join("");
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(ariaLabel)}">${body}</svg>`;
  }

  function legend(series) {
    if (series.length < 2) return "";
    return `<div class="legend">${series.map((s, j) => `<span><i style="background:${COLORS[j % 4]}"></i>${esc(s.name)}</span>`).join("")}</div>`;
  }

  return { bars, hbars };
})();
