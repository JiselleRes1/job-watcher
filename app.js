/* Shared by every page: navigation, data loading, small helpers. */
const JW = (() => {
  const PAGES = [["index.html", "Today"], ["browse.html", "Browse"], ["market.html", "Market"]];

  function nav() {
    const here = location.pathname.split("/").pop() || "index.html";
    const links = PAGES.map(([href, label]) =>
      `<a class="link" href="${href}"${href === here ? ' aria-current="page"' : ""}>${label}</a>`).join("");
    document.body.insertAdjacentHTML("afterbegin",
      `<header class="nav"><div class="nav-inner"><a class="brand" href="index.html">Job Watcher</a>${links}</div></header>`);
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

  return { loadStatus, loadHistory, parseCSV, diffDays, addDays, esc, fmtTime };
})();
