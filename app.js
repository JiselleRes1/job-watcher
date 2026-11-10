/* Shared by every page: navigation, data loading, small helpers. */
const ELF = `<svg viewBox="0 0 48 48" aria-hidden="true">
  <path d="M13 29 L2 22 L14 24Z M35 29 L46 22 L34 24Z" fill="#f0b98d"/>
  <circle cx="24" cy="29" r="11" fill="#f7d0a8"/>
  <path d="M10 25 Q24 -4 38 25 Q24 18 10 25Z" fill="#2f9e5f"/>
  <path d="M11 24 Q24 31 37 24" stroke="#c4283a" stroke-width="4.5" fill="none" stroke-linecap="round"/>
  <path d="M26 5 Q40 4 42 15" stroke="#2f9e5f" stroke-width="5" fill="none" stroke-linecap="round"/><circle cx="42" cy="16" r="4.2" fill="#fff"/>
  <circle cx="20" cy="30" r="1.7" fill="#2b2b2b"/><circle cx="28" cy="30" r="1.7" fill="#2b2b2b"/>
  <circle cx="16" cy="34" r="2.2" fill="#f4a3a3" opacity=".7"/><circle cx="32" cy="34" r="2.2" fill="#f4a3a3" opacity=".7"/>
  <path d="M20 35 Q24 40 28 35" stroke="#7a3b2a" stroke-width="1.8" fill="none" stroke-linecap="round"/></svg>`;

const JW = (() => {
  const PAGES = [["index.html", "Today"], ["browse.html", "Browse"], ["market.html", "Market"]];

  function nav() {
    const here = location.pathname.split("/").pop() || "index.html";
    const links = PAGES.map(([href, label]) =>
      `<a class="link" href="${href}"${href === here ? ' aria-current="page"' : ""}>${label}</a>`).join("");
    document.body.insertAdjacentHTML("afterbegin",
      `<header class="nav"><div class="nav-inner"><a class="brand" href="index.html" data-sleigh>${ELF}<span>Job Watcher<small>North Pole edition</small></span></a>${links}</div></header>`);
  }

  function parseCSV(text) {
    const rows = []; let row = [], field = "", q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) {
        if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
        else field += c;
      } else if (c === '"') q = true;
      else if (c === ",") { row.push(field); field = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(field); field = ""; rows.push(row); row = [];
      } else field += c;
    }
    if (field !== "" || row.length) { row.push(field); rows.push(row); }
    const head = rows.shift() || [];
    return rows.filter(r => r.length === head.length).map(r => {
      const o = {}; head.forEach((h, i) => o[h] = r[i]);
      o.in_role = o.in_role === "true"; o.first_run = o.first_run === "true";
      return o;
    });
  }

  async function getJSON(path) { const r = await fetch(path, { cache: "no-cache" }); if (!r.ok) throw new Error(path); return r.json(); }
  async function getText(path) { const r = await fetch(path, { cache: "no-cache" }); if (!r.ok) throw new Error(path); return r.text(); }

  async function loadStatus() { return getJSON("data/status.json"); }
  async function loadHistory() { return parseCSV(await getText("data/history.csv")); }

  const DAY = 86400000;
  const toMs = d => Date.parse(d + "T00:00:00Z");
  const diffDays = (a, b) => Math.round((toMs(a) - toMs(b)) / DAY);
  const addDays = (d, n) => new Date(toMs(d) + n * DAY).toISOString().slice(0, 10);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmtTime = iso => new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

  function offlineBanner() {
    const show = () => { if (!document.querySelector(".offline")) document.body.insertAdjacentHTML("afterbegin", '<div class="offline">You are offline — showing the last data this device loaded.</div>'); };
    const hide = () => document.querySelector(".offline")?.remove();
    window.addEventListener("offline", show); window.addEventListener("online", hide);
    if (!navigator.onLine) show();
  }

  if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
  document.addEventListener("DOMContentLoaded", () => { nav(); offlineBanner(); });

  return { loadStatus, loadHistory, parseCSV, diffDays, addDays, esc, fmtTime, elfNote: msg => `<div class="elf-empty">${ELF}<span>${msg}</span></div>` };
})();
