/* North Pole effects: falling snow, freeze-over page transitions, Santa's sleigh, sparkles.
   Everything is decoration; the pages work the same with it switched off
   (and it is skipped when the visitor prefers reduced motion). */
const Theme = (() => {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const rand = (a, b) => a + Math.random() * (b - a);
  let canvas, ctx, W = 0, H = 0, parts = [], running = false, flake = "#fff";

  const SLEIGH = `
  <svg id="sleigh" viewBox="0 0 380 130" aria-hidden="true">
    <defs>
      <g id="deer">
        <ellipse cx="40" cy="70" rx="26" ry="13" fill="#8a5a36"/>
        <path d="M60 64 Q72 48 76 40" stroke="#8a5a36" stroke-width="10" stroke-linecap="round" fill="none"/>
        <ellipse cx="80" cy="38" rx="9" ry="7" fill="#8a5a36"/>
        <circle cx="88" cy="39" r="3.4" fill="#e8213a"/>
        <path d="M76 31 L72 14 M72 14 L64 18 M72 14 L74 6 M82 30 L88 14 M88 14 L96 16 M88 14 L86 6" stroke="#5b3a22" stroke-width="2.4" stroke-linecap="round" fill="none"/>
        <path d="M20 80 L14 104 M30 82 L28 104 M52 82 L56 104 M62 78 L70 102" stroke="#6b4426" stroke-width="4" stroke-linecap="round"/>
      </g>
    </defs>
    <use href="#deer" x="0" y="0"/><use href="#deer" x="72" y="4"/>
    <path d="M60 66 H196 M132 70 H196" stroke="#f3c64f" stroke-width="2" fill="none"/>
    <path d="M205 64 H292 Q308 64 314 44 L328 44 Q322 86 288 90 H214 Q198 90 205 64Z" fill="#c4283a"/>
    <path d="M200 102 H312 Q338 102 338 80" stroke="#f3c64f" stroke-width="6" stroke-linecap="round" fill="none"/>
    <path d="M222 90 V102 M290 90 V102" stroke="#f3c64f" stroke-width="4"/>
    <circle cx="282" cy="56" r="15" fill="#8d5a2b"/><path d="M276 43 H288" stroke="#e8c99a" stroke-width="3"/>
    <rect x="236" y="50" width="30" height="22" rx="9" fill="#e8213a"/>
    <circle cx="251" cy="40" r="10" fill="#f5cba7"/>
    <path d="M241 46 Q251 62 261 46 Q251 52 241 46Z" fill="#fff"/>
    <path d="M241 36 Q248 10 268 30 Q258 28 241 36Z" fill="#e8213a"/>
    <circle cx="268" cy="30" r="4.5" fill="#fff"/><rect x="240" y="34" width="22" height="5" rx="2.5" fill="#fff"/>
    <circle cx="247" cy="40" r="1.4" fill="#222"/><circle cx="256" cy="40" r="1.4" fill="#222"/>
  </svg>`;

  /* ---------------- canvas: snow, bursts and sparkles ---------------- */
  function resize() {
    W = canvas.width = innerWidth; H = canvas.height = innerHeight;
  }
  function readColors() { flake = getComputedStyle(document.documentElement).getPropertyValue("--flake").trim() || "#fff"; }

  function ambient(randomY) {
    return { ch: "❄", x: rand(0, W), y: randomY ? rand(-20, H) : -20, size: rand(8, 18), vx: rand(-.25, .25), vy: rand(.35, 1.1),
      sway: rand(0, 6.3), swaySpd: rand(.01, .03), rot: rand(0, 6.3), rotSpd: rand(-.02, .02), alpha: rand(.55, .95), ambient: true, color: null };
  }

  function burst(x, y, n = 40, { ch = "❄", color = null, spread = 4.5, sizeMin = 8, sizeMax = 20 } = {}) {
    if (reduce || !ctx) return;
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2), s = rand(.8, spread);
      parts.push({ ch, x, y, size: rand(sizeMin, sizeMax), vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1.5, g: .07, sway: 0, swaySpd: 0,
        rot: rand(0, 6.3), rotSpd: rand(-.12, .12), alpha: 1, life: rand(60, 120), color, ambient: false });
    }
    start();
  }
  const sparkle = (x, y, n = 14) => burst(x, y, n, { ch: "✦", color: "#ffd166", spread: 3.2, sizeMin: 8, sizeMax: 16 });

  function frame() {
    ctx.clearRect(0, 0, W, H);
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.rot += p.rotSpd;
      if (p.ambient) {
        p.sway += p.swaySpd; p.x += p.vx + Math.sin(p.sway) * .5; p.y += p.vy;
        if (p.y > H + 20) Object.assign(p, ambient(false), { x: rand(0, W) });
      } else {
        p.vy += p.g; p.vx *= .985; p.x += p.vx; p.y += p.vy; p.life--;
        p.alpha = Math.min(1, p.life / 40);
        if (p.life <= 0 || p.y > H + 30) { parts.splice(i, 1); continue; }
      }
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color || flake; ctx.font = `${p.size}px sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      if (!p.ambient || p.size > 14) { ctx.shadowColor = p.color || "rgba(255,255,255,.9)"; ctx.shadowBlur = 6; }
      ctx.fillText(p.ch, 0, 0); ctx.restore();
    }
    running = !document.hidden;
    if (running) requestAnimationFrame(frame);
  }
  function start() { if (!running && !document.hidden) { running = true; requestAnimationFrame(frame); } }

  /* ---------------- freeze over / thaw ---------------- */
  function makeFrost(x, y, label) {
    const o = document.createElement("div");
    o.className = "frost"; o.setAttribute("aria-hidden", "true");
    o.style.setProperty("--x", x + "px"); o.style.setProperty("--y", y + "px");
    o.innerHTML = `<div class="big">❄</div><p>${label}</p>`;
    document.body.appendChild(o);
    return o;
  }
  const twoFrames = fn => requestAnimationFrame(() => requestAnimationFrame(fn));

  function freezeTo(url, x, y) {
    if (reduce) { location.href = url; return; }
    const o = makeFrost(x, y, "Brrr… freezing over!");
    twoFrames(() => o.classList.add("on"));
    burst(x, y, 60, { spread: 6 });
    try { sessionStorage.setItem("jw.frost", `${x},${y}`); } catch (e) {}
    setTimeout(() => { location.href = url; }, 820);
  }

  function thaw() {
    let pos = null;
    try { pos = sessionStorage.getItem("jw.frost"); sessionStorage.removeItem("jw.frost"); } catch (e) {}
    if (!pos || reduce) { document.documentElement.classList.remove("frosted"); return; }
    const [x, y] = pos.split(",").map(Number);
    const o = makeFrost(x, y, "Thawing out…");
    o.classList.add("on", "instant");
    document.documentElement.classList.remove("frosted");
    twoFrames(() => {
      o.classList.remove("instant");
      setTimeout(() => o.classList.remove("on"), 250);
      setTimeout(() => o.remove(), 1300);
      for (let i = 0; i < 4; i++) setTimeout(() => burst(rand(0, W), 0, 14, { spread: 1.2 }), i * 180);
    });
  }

  /* briefly ice over one element (used when results are switched) */
  function iceOver(el) {
    if (reduce || !el) return;
    el.classList.remove("iced"); void el.offsetWidth; el.classList.add("iced");
    const r = el.getBoundingClientRect();
    burst(r.left + r.width / 2, Math.max(r.top, 0) + 10, 24, { spread: 2.5 });
    setTimeout(() => el.classList.remove("iced"), 1100);
  }

  /* ---------------- Santa's sleigh ---------------- */
  let lastFly = 0, trail = null;
  function flySleigh() {
    const el = document.getElementById("sleigh");
    if (reduce || !el || Date.now() - lastFly < 7000) return;
    lastFly = Date.now();
    el.classList.remove("fly"); el.getBoundingClientRect(); el.classList.add("fly");  // svg has no offsetWidth
    clearInterval(trail);
    trail = setInterval(() => {
      const r = el.getBoundingClientRect();
      sparkle(r.left + r.width * .12, r.top + r.height * .7, 2);
    }, 90);
    setTimeout(() => clearInterval(trail), 5600);
  }

  function init() {
    document.body.insertAdjacentHTML("beforeend", SLEIGH);
    document.body.insertAdjacentHTML("beforeend",
      '<footer class="snowbank">Made with ❄ and a little elf magic · fresh data every day</footer>');
    canvas = document.createElement("canvas"); canvas.id = "snow"; canvas.setAttribute("aria-hidden", "true");
    document.body.appendChild(canvas); ctx = canvas.getContext("2d");
    resize(); readColors();
    addEventListener("resize", resize);
    matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", readColors);
    document.addEventListener("visibilitychange", start);
    if (!reduce) { for (let i = 0; i < 70; i++) parts.push(ambient(true)); start(); }
    thaw();

    document.addEventListener("click", e => {
      const a = e.target.closest("a.link, a.brand");
      if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
      if (a.getAttribute("aria-current") === "page" || new URL(a.href).origin !== location.origin) return;
      e.preventDefault();
      freezeTo(a.href, e.clientX || innerWidth / 2, e.clientY || 40);
    });
    document.addEventListener("mouseover", e => { if (e.target.closest("[data-sleigh]")) flySleigh(); });
    addEventListener("pageshow", e => { if (e.persisted) document.querySelectorAll(".frost").forEach(o => o.remove()); });
  }
  document.addEventListener("DOMContentLoaded", init);

  return { burst, sparkle, iceOver, flySleigh, reduce };
})();
