"use strict";
/* Kempner Mobile — core: storage, state, data index, events, routing.
   Data lives only on this phone (IndexedDB). Nothing leaves it except the
   files you choose to share yourself (and postcode look-ups for Nearby). */

// ---------- IndexedDB key/value ----------
const KV = (() => {
  let dbp;
  const db = () => dbp || (dbp = new Promise((res, rej) => {
    const r = indexedDB.open("kempner-mobile", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("kv");
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  }));
  async function tx(mode, fn) {
    const d = await db();
    return new Promise((res, rej) => {
      const t = d.transaction("kv", mode), out = fn(t.objectStore("kv"));
      t.oncomplete = () => res(out && out.result); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
    });
  }
  return { get: k => tx("readonly", s => s.get(k)), set: (k, v) => tx("readwrite", s => s.put(v, k)) };
})();

// ---------- state ----------
let SNAP = null, PENDING = [], IDX = null, GEO = {};
let META = { device: "", user: "", filter: "mine", sort: "az", lastExport: "", remindDays: 2, lastCall: null };

const CO_TABLES = ["company_owners","company_tags","people","addresses","actions","meetings","notes","quick_notes",
  "competitor_notes","quotes","film_orders","owned_equipment","company_known_film_specs","company_pack_profiles",
  "call_off_agreements","company_film_trials","reorder_orders"];
const STATUS_COL = {URGENT:"#e8192c",WARM:"#f59e0b",COLD:"#3b82f6",OK:"#16a34a",DEAD:"#6b7280",CONTACT:"#8000ff",ARCHIVED:"#aaa",NONE:"#dde1ea"};
const FLAG_PREFIX = {URGENT:"1RED", WARM:"2YELLOW", OK:"3GREEN", COLD:"4NONE", NONE:"4NONE"};
const FLAG_EMOJI = {"1RED":"🔴","2YELLOW":"🟠","3GREEN":"🟢","4NONE":""};

// ---------- helpers ----------
const $ = s => document.querySelector(s);
const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const pad = n => String(n).padStart(2, "0");
const localDate = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const localTime = (d = new Date()) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const nowIso = () => { const d = new Date(); return `${localDate(d)}T${localTime(d)}:${pad(d.getSeconds())}`; };
const stamp = () => { const d = new Date(); return `${localDate(d)}_${pad(d.getHours())}${pad(d.getMinutes())}`; };
const addDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return localDate(d); };
function nextWorkday(n = 1) { const d = new Date(); d.setDate(d.getDate() + n); while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1); return localDate(d); }
function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16)); b[6] = b[6] & 15 | 64; b[8] = b[8] & 63 | 128;
  const h = [...b].map(x => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}
const DOW = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"], MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function dayDiff(d) { if (!d) return 9999; const a = new Date(String(d).slice(0,10) + "T00:00:00"), b = new Date(localDate() + "T00:00:00"); return Math.round((a - b) / 86400000); }
function niceDate(s) {
  if (!s) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s); if (!m) return esc(s);
  const dd = dayDiff(s);
  if (dd === 0) return "Today"; if (dd === 1) return "Tomorrow"; if (dd === -1) return "Yesterday";
  const d = new Date(+m[1], +m[2]-1, +m[3]);
  return `${DOW[d.getDay()]} ${+m[3]} ${MON[+m[2]-1]}${d.getFullYear() !== new Date().getFullYear() ? " " + m[1] : ""}`;
}
const dueClass = d => !d ? "" : dayDiff(d) < 0 ? "over" : dayDiff(d) === 0 ? "today" : "";
const gbp = n => "£" + (+n || 0).toLocaleString("en-GB", {minimumFractionDigits: 2, maximumFractionDigits: 2});
const gbp0 = n => "£" + Math.round(+n || 0).toLocaleString("en-GB");
const num = v => (v == null || v === "" || isNaN(+v)) ? "" : String(+(+v).toFixed(3));
const norm = s => String(s || "").toLowerCase().replace(/[\s_\-.,'&]/g, "").replace(/(ltd|limited|plc)$/, "");
const digits = s => String(s || "").replace(/[^\d+]/g, "");
const dialable = s => digits(s).replace(/\D/g, "").length >= 5;
function ago(iso) { if (!iso) return ""; const ms = Date.now() - new Date(String(iso).replace(" ", "T")).getTime(); const h = ms / 3600000;
  return h < 1 ? "just now" : h < 24 ? `${Math.floor(h)}h ago` : `${Math.floor(h / 24)} day${Math.floor(h / 24) === 1 ? "" : "s"} ago`; }
function toast(msg, ms = 2600) { const t = $("#toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("show"), ms); }

// ---------- persistence ----------
async function loadAll() {
  try {
    SNAP = await KV.get("snapshot") || null;
    PENDING = await KV.get("pending") || [];
    META = Object.assign(META, await KV.get("meta") || {});
    GEO = await KV.get("geo") || {};
  } catch (e) { toast("Storage error: " + e.message, 5000); }
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  applyTheme();
  buildIndex();
}
async function savePending() { await KV.set("pending", PENDING); buildIndex(); updateBadges(); }
const saveMeta = () => KV.set("meta", META);

// ---------- colours: follow the PC by default (the PC is light unless Dark mode is ticked there) ----------
const THEME_MODES = {pc: "Match the PC", light: "Light", dark: "Dark", phone: "Match iPhone setting"};
const _darkMQ = window.matchMedia ? matchMedia("(prefers-color-scheme: dark)") : null;
function themeEffective() {
  const m = META.theme || "pc";
  if (m === "light" || m === "dark") return m;
  if (m === "phone") return _darkMQ && _darkMQ.matches ? "dark" : "light";
  return SNAP && SNAP.theme === "dark" ? "dark" : "light";
}
function applyTheme() {
  const eff = themeEffective(), dark = eff === "dark";
  document.documentElement.classList.toggle("dark", dark);
  const tc = document.getElementById("themeColor"); if (tc) tc.setAttribute("content", dark ? "#14171d" : "#ffffff");
  try { localStorage.setItem("km_theme_eff", eff); } catch (e) {}
}
if (_darkMQ && _darkMQ.addEventListener) _darkMQ.addEventListener("change", () => { if (META.theme === "phone") applyTheme(); });

// ---------- index (snapshot + pending merged) ----------
function groupBy(rows, key) { const m = new Map(); for (const r of rows || []) { const k = String(r[key]); if (!m.has(k)) m.set(k, []); m.get(k).push(r); } return m; }
const tempMap = () => (SNAP && SNAP.company_temp_map) || {};
function evCoKey(ev) {
  if (ev.company_id != null) return String(ev.company_id);
  const m = tempMap()[ev.company_temp];
  return m != null ? String(m) : "t:" + ev.company_temp;
}
function buildIndex() {
  const t = (SNAP && SNAP.tables) || {};
  IDX = { co: new Map(), by: {}, person: {}, drawdowns: groupBy(t.call_off_drawdowns, "agreement_id"),
          users: new Map(((SNAP && SNAP.users) || []).map(u => [String(u.id), u.name])),
          products: (SNAP && SNAP.products) || {}, pend: new Map(), doneIds: new Map(), moved: new Map(), pins: new Map(), hay: new Map(),
          files: groupBy((SNAP && SNAP.attachments) || [], "company_id") };
  for (const c of t.companies || []) IDX.co.set(String(c.id), Object.assign({}, c, {_key: String(c.id)}));
  for (const n of CO_TABLES) IDX.by[n] = groupBy(t[n], "company_id");
  for (const n of ["phone_numbers","person_emails","person_dates"]) IDX.person[n] = groupBy(t[n], "person_id");
  for (const ev of PENDING) if (ev.type === "company_new") { const k = evCoKey(ev);
    if (!IDX.co.has(k)) IDX.co.set(k, {_key: k, id: null, name: ev.data.name, status: "NONE", pipeline_stage: "Prospect", region: "", segment: ev.data.segment || "", _pending: true, updated_at: ev.created_at}); }
  // addresses added on the phone count straight away (postcodes for Nearby, routes and mileage)
  for (const ev of PENDING) if (ev.type === "address_new") { const k = evCoKey(ev), m = IDX.by.addresses;
    if (!m.has(k)) m.set(k, []); m.get(k).push(Object.assign({id: ev.id, company_id: k, _pending: ev}, ev.data)); }
  for (const ev of PENDING) { const k = evCoKey(ev);
    if (!IDX.pend.has(k)) IDX.pend.set(k, []); IDX.pend.get(k).push(ev);
    if (ev.type === "action_done") IDX.doneIds.set(ev.data.action_id, ev);
    if (ev.type === "action_move") IDX.moved.set(ev.data.action_id, ev);
    if (ev.type === "action_pin") IDX.pins.set(ev.data.action_id, ev); }
}
const rows = (table, key) => (IDX.by[table] && IDX.by[table].get(String(key))) || [];
const pend = (key, type) => (IDX.pend.get(String(key)) || []).filter(e => !type || e.type === type);
const view = key => (SNAP && SNAP.views && SNAP.views[String(key)]) || null;
const phoneActionId = ev => "ph" + ev.id.replace(/-/g, "").slice(0, 8);
function companyStatus(c) { // latest status chosen on the phone wins for display
  const st = pend(c._key, "note").map(e => e.data.status).filter(s => s && s !== "NONE").pop();
  return st || c.status || "NONE";
}
function myUserId() { const n = META.user || (SNAP && SNAP.current_user) || ""; for (const [id, x] of IDX.users) if (x === n) return id; return null; }
function isMine(c) {
  if (c._pending) return true;
  const uid = myUserId(); if (!uid) return true;
  if (String(c.assigned_to) === uid) return true;
  return rows("company_owners", c.id).some(o => String(o.user_id) === uid);
}
function people(key) {
  const out = rows("people", key).map(p => Object.assign({}, p, {
    numbers: IDX.person.phone_numbers.get(String(p.id)) || [],
    emails: [...new Set([p.email, ...(IDX.person.person_emails.get(String(p.id)) || []).map(e => e.email)].filter(Boolean))],
    dates: IDX.person.person_dates.get(String(p.id)) || [] }));
  for (const ev of pend(key)) {
    if (ev.type === "contact_new") out.push({name: ev.data.name, org_role: ev.data.role || "", numbers: ev.data.numbers || [], emails: ev.data.emails || [], dates: [], _pending: ev});
    if (ev.type === "company_new" && ev.data.contact_name) out.push({name: ev.data.contact_name, numbers: ev.data.phone ? [{number: ev.data.phone}] : [], emails: ev.data.email ? [ev.data.email] : [], dates: [], _pending: ev});
  }
  return out;
}
function mainContact(key) {
  const ppl = people(key), v = view(key) || {};
  const p = ppl.find(x => x.is_main_contact) || ppl.find(x => v.primary && x.name === v.primary.name) || ppl[0];
  if (!p) return null;
  const num = (p.numbers.find(n => n.is_best) || p.numbers.find(n => dialable(n.number)) || p.numbers[0] || {}).number || "";
  return {name: p.name, role: p.org_role || "", number: num, email: p.emails[0] || ""};
}
function actions(key) {
  const out = rows("actions", key).map(a => { const d = IDX.doneIds.get(a.id), m = IDX.moved.get(a.id);
    if (d) return Object.assign({}, a, {status: "DONE", _doneEv: d});
    const pn = IDX.pins.get(a.id), x = pn ? Object.assign({}, a, {pinned: pn.data.pinned ? 1 : 0, _pinEv: pn}) : a;
    return m ? Object.assign({}, x, {date: m.data.date, time: m.data.time ?? a.time, _moved: m}) : x; });
  for (const ev of pend(key, "action_new")) { const id = phoneActionId(ev), d = IDX.doneIds.get(id);
    out.push(Object.assign({}, ev.data, {id, company_id: key, status: d ? "DONE" : "OPEN", _pending: ev, _doneEv: d})); }
  return out;
}
const openActions = key => actions(key).filter(a => a.status !== "DONE").sort((a, b) => ((a.date||"9") + (a.time||"")).localeCompare((b.date||"9") + (b.time||"")));
function meetings(key) {
  const comp = new Map(pend(key, "meeting").filter(e => e.data.completes_meeting_id).map(e => [e.data.completes_meeting_id, e]));
  const base = rows("meetings", key);
  const out = base.map(m => { const e = comp.get(m.id); return e ? Object.assign({}, m, {status: "DONE", notes: [m.notes, e.data.notes].filter(Boolean).join("\n\n"), _pending: e}) : m; });
  for (const ev of pend(key, "meeting")) if (!ev.data.completes_meeting_id || !base.some(m => m.id === ev.data.completes_meeting_id)) out.push(Object.assign({_pending: ev, id: ev.id}, ev.data));
  return out;
}
function notes(key) {
  const out = rows("notes", key).slice();
  for (const ev of pend(key)) {
    const d = ev.created_at.slice(0, 10), t = ev.created_at.slice(11, 16), d0 = ev.data;
    if (ev.type === "note") out.push({date: d, time: t, content: d0.content, customer_name: d0.customer, reference: d0.reference, status_prefix: d0.flag, _pending: ev});
    if (ev.type === "action_done" && d0.outcome) out.push({date: d, time: t, content: `Action: ${d0.action_note}\nOutcome: ${d0.outcome}`, status_prefix: "3GREEN", _pending: ev});
    if (ev.type === "meeting" && d0.status === "DONE" && d0.notes) out.push({date: d, time: t, content: `Meeting: ${d0.date} @ ${d0.location || ""}\nOutcome: ${d0.notes}`, status_prefix: "3GREEN", _pending: ev});
    if (ev.type === "signoff") out.push({date: d, time: t, content: `✍️ Signed by ${d0.person || "customer"}\n\n${d0.statement}`, customer_name: d0.person, reference: "Signed sheet", status_prefix: "3GREEN", _pending: ev, _pdf: ev.id});
    if (ev.type === "photo") out.push({date: d, time: t, content: `📷 Photo on site${d0.caption ? ": " + d0.caption : ""}`, reference: "Photo", status_prefix: "4NONE", _pending: ev, _photo: ev.id});
  }
  return out.sort((a, b) => ((b.date||"") + (b.time||"")).localeCompare((a.date||"") + (a.time||"")));
}
function haystack(c) {
  let h = IDX.hay.get(c._key); if (h) return h;
  const parts = [c.name, c.region, c.pipeline_stage];
  for (const p of people(c._key)) parts.push(p.name, ...p.numbers.map(n => digits(n.number)), ...p.emails);
  for (const a of rows("addresses", c._key)) parts.push(a.lines, a.city, a.postcode, (a.postcode || "").replace(/\s/g, ""));
  for (const t of rows("company_tags", c._key)) parts.push(t.tag);
  h = parts.filter(Boolean).join(" ").toLowerCase(); IDX.hay.set(c._key, h); return h;
}
function lineCalc(lines, vatRate, ship) {
  const rate = +vatRate || 0, sh = +ship || 0; let subtotal = 0;
  for (const l of lines) { const q = +(l.quantity || 1) || 1, p = +(l.agreed_price || l.unit_price || l.quoted_price || 0) || 0; subtotal += q * p; }
  const vat = subtotal * rate + sh * rate;
  return {subtotal, shipping_cost: sh, vat_amount: vat, grand_total: subtotal + sh + vat};
}
const productList = () => Object.entries((SNAP && SNAP.products) || {}).map(([id, p]) => ({id, name: p.name, section: p.section || ""})).sort((a, b) => a.name.localeCompare(b.name));
const productByName = n => { n = String(n || "").trim().toLowerCase(); return productList().find(p => p.name.toLowerCase() === n) || null; };
function lastPrice(key, name) {
  const v = view(key) || {}, n = String(name || "").toLowerCase();
  for (const g of v.order_groups || []) for (const l of g.lines || []) if (String(l.description).toLowerCase() === n && l.unit_price) return l.unit_price;
  for (const g of v.quote_groups || []) for (const l of g.lines || []) if (String(l.description).toLowerCase() === n && (l.agreed_price || l.quoted_price)) return l.agreed_price || l.quoted_price;
  return "";
}
const defaultVatPct = () => String(Math.round((SNAP && SNAP.vat_rate != null ? +SNAP.vat_rate : 0.2) * 10000) / 100);
function pendingGroups(key, type) {
  return pend(key, type).map(ev => { const d = ev.data, ls = (d.lines || []).map(l => Object.assign({}, l, {description: l.description || l.product_name}));
    const g = Object.assign({}, d, lineCalc(ls, d.vat_rate, d.shipping_cost), {lines: ls, _pending: ev});
    g.headline = ls.length === 1 ? `${ls[0].description} · ${num(ls[0].quantity)}` : `${ls.length} line items`; return g; });
}

// ---------- events ----------
async function addEvent(type, coKey, data) {
  const c = coKey != null ? IDX.co.get(String(coKey)) : null;
  const ev = {id: uuid(), type, created_at: nowIso(), company_id: null, company_temp: null, company_name: c ? c.name : (data.name || ""), data};
  if (type === "company_new") ev.company_temp = "tmp-" + ev.id.slice(0, 8);
  else if (c && !c._pending) ev.company_id = c.id;
  else if (c && c._pending) ev.company_temp = c._key.slice(2);
  PENDING.push(ev);
  await savePending();
  return ev;
}
// ---------- customer-list tabs (Main · 🛋 Lobby · any made on the PC) ----------
const LOBBY = "Lobby";
const segments = () => (SNAP && SNAP.segments && SNAP.segments.length) ? SNAP.segments : [{name: LOBBY, icon: "🛋", quiet: true}];
function segOf(c) { const p = pend(c._key, "segment_set"); return p.length ? (p[p.length - 1].data.segment || "") : (c.segment || ""); }
function isQuiet(c) { const s = segOf(c); return !!s && segments().some(x => x.name === s && x.quiet); }
const segLabel = s => (s.icon ? s.icon + " " : "") + s.name;
function leadInfo(c) { try { return c.lead_info ? JSON.parse(c.lead_info) : {}; } catch (e) { return {}; } }

function describe(e) {
  const d = e.data || {};
  switch (e.type) {
    case "note": return "📝 " + (d.reference === "Phone call" ? "Call: " : "") + d.content;
    case "action_new": return `✅ ${d.note} (${niceDate(d.date)})`;
    case "visit_snooze": return d.days ? `💤 No visit suggestions for ${d.days} days` : "💤 Don't suggest visiting";
    case "address_new": return `📍 Address: ${d.lines.replace(/\n/g, ", ")}`;
    case "action_pin": return `${d.pinned ? "📌 Pinned" : "Unpinned"}: ${d.action_note}`;
    case "action_move": return `⏭ Moved to ${niceDate(d.date)}${d.time ? " " + d.time : ""}: ${d.action_note}${d.reason ? " (" + d.reason + ")" : ""}`;
    case "action_done": return `☑️ Done: ${d.action_note}${d.outcome ? " → " + d.outcome : ""}`;
    case "meeting": return `🤝 ${d.status === "DONE" ? "Visit" : "Booked"} ${niceDate(d.date)}: ${d.notes || d.location || ""}`;
    case "contact_new": return `👤 ${d.name}`;
    case "company_new": return `🏢 New company: ${d.name}`;
    case "quote_new": case "order_new": { const c = lineCalc(d.lines || [], d.vat_rate, d.shipping_cost);
      return `${e.type === "quote_new" ? "💷 Quote" : "🛒 Order"}: ${(d.lines||[]).map(l => `${num(l.quantity)}× ${l.description || l.product_name}`).join(", ")} — ${gbp(c.grand_total)}`; }
    case "signoff": return `✍️ Signed by ${d.person || "customer"}: ${d.statement}`;
    case "photo": return `📷 Photo${d.caption ? ": " + d.caption : ""}`;
    case "pack_save": return `📦 Pack ${d.profile_id ? "updated" : "added"}: ${d.name} (${num(d.length_mm)}×${num(d.width_mm)}×${num(d.height_mm)} mm)`;
    case "segment_set": return d.segment ? `🗂 Move to ${d.segment}` : "⬆ Promote to the main list";
  }
  return e.type;
}

// ---------- routing ----------
const routes = [];
const route = (re, fn) => routes.push([re, fn]);
function go(h) { if (location.hash === h) render(); else location.hash = h; }
let _lastHash = "";
function render() {
  const h = location.hash || "#/";
  if (h !== _lastHash) window.scrollTo(0, 0); _lastHash = h;
  $("#fab").classList.add("hidden"); $("#topRight").innerHTML = "";
  closeSheet();
  for (const [re, fn] of routes) { const m = h.match(re); if (m) { fn(...m.slice(1).map(x => x == null ? x : decodeURIComponent(x))); return; } }
  go("#/");
}
function setHeader(title, back, tab) {
  $("#title").textContent = title || "";
  $("#brand").classList.toggle("hidden", !!back);
  $("#backBtn").classList.toggle("hidden", !back);
  $("#backBtn").onclick = () => history.length > 1 ? history.back() : go(back);
  document.querySelectorAll("#tabs a").forEach(a => a.classList.toggle("on", a.dataset.tab === tab));
}
function showFab(fn) { const f = $("#fab"); f.classList.remove("hidden"); f.onclick = fn; }
function updateBadges() {
  const n = PENDING.length, b = $("#syncBdg");
  b.textContent = n; b.classList.toggle("hidden", !n);
}
window.addEventListener("hashchange", render);

// ---------- bottom sheet ----------
function openSheet(html, onMount) {
  $("#sheetBody").innerHTML = html; $("#sheet").classList.add("open");
  if (onMount) onMount($("#sheetBody"));
}
function closeSheet() { $("#sheet").classList.remove("open"); }
document.addEventListener("click", e => { if (e.target.classList && e.target.classList.contains("bk")) closeSheet(); });

// copy buttons + generic delegates
document.addEventListener("click", e => {
  const b = e.target.closest("[data-copy]"); if (!b) return; e.preventDefault();
  (navigator.clipboard ? navigator.clipboard.writeText(b.dataset.copy) : Promise.reject()).then(() => toast("Copied " + b.dataset.copy), () => toast(b.dataset.copy));
});
function telLink(n, key) {
  return dialable(n) ? `<a href="tel:${esc(digits(n))}" data-call="${esc(key || "")}" data-num="${esc(n)}">${esc(n)}</a><button class="copy" data-copy="${esc(n)}">⧉</button>`
                     : `${esc(n)} <span class="small">(not a dialable number)</span>`;
}

// ---------- call logging ----------
// Tapping any Call link remembers it; coming back to the app afterwards offers to log the call.
document.addEventListener("click", e => {
  const a = e.target.closest("[data-call]"); if (!a || !a.dataset.call) return;
  META.lastCall = {key: a.dataset.call, number: a.dataset.num || "", at: Date.now()}; saveMeta();
});
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible" || !META.lastCall) return;
  const lc = META.lastCall, secs = (Date.now() - lc.at) / 1000;
  META.lastCall = null; saveMeta();
  if (secs < 8 || secs > 3 * 3600 || !IDX.co.get(lc.key)) return;
  setTimeout(() => offerCallLog(lc), 400);
});

// ---------- sync files ----------
async function exportChanges() {
  if (!PENDING.length) return toast("Nothing to send");
  const name = `kempner_phone_changes_${stamp()}.json`;
  const payload = {kempner_phone_changes: 1, device: META.device || "iPhone", exported_at: nowIso(), based_on_snapshot: (SNAP && SNAP.exported_at) || "", events: PENDING};
  const file = new File([JSON.stringify(payload)], name, {type: "application/json"});
  const done = async () => { META.lastExport = nowIso(); await saveMeta(); render(); };
  if (navigator.canShare && navigator.canShare({files: [file]})) {
    try { await navigator.share({files: [file], title: name}); await done(); return; } catch (e) { if (e.name === "AbortError") return; }
  }
  const a = document.createElement("a"); a.href = URL.createObjectURL(file); a.download = name;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  await done(); toast("Saved to Downloads / Files");
}
$("#fileIn").onchange = async e => {
  const f = e.target.files[0]; if (!f) return;
  let data;
  try { data = JSON.parse(await f.text()); } catch (err) { return toast("That file isn't readable.", 4000); }
  if (data.kempner_phone_changes) return toast("That's a phone changes file — it goes into the CRM, not here.", 5000);
  if (data.kempner_phone_backup) return restoreBackup(data);
  if (!data.kempner_phone_snapshot || !data.tables) return toast("That isn't a Kempner snapshot file.", 4000);
  if (SNAP && data.exported_at && SNAP.exported_at && data.exported_at < SNAP.exported_at &&
      !confirm(`This snapshot (${data.exported_at.slice(0,16)}) is OLDER than the one loaded (${SNAP.exported_at.slice(0,16)}). Load it anyway?`)) return;
  const applied = new Set(data.applied_event_ids || []), before = PENDING.length;
  PENDING = PENDING.filter(ev => !applied.has(ev.id));
  SNAP = data;
  try { await KV.set("snapshot", SNAP); await KV.set("pending", PENDING); } catch (err) { return toast("Couldn't store it: " + err.message, 6000); }
  applyTheme(); buildIndex(); updateBadges();
  let extra = ""; if (window.onSnapshotLoaded) { try { extra = await window.onSnapshotLoaded() || ""; } catch (e) {} }
  render();
  const cleared = before - PENDING.length;
  toast(`✓ Loaded ${data.tables.companies.length} companies.${cleared ? ` ${cleared} synced item(s) cleared.` : ""}${PENDING.length ? ` ${PENDING.length} still to send.` : ""}${extra}`, 5000);
};
function pickSnapshot() { const f = $("#fileIn"); f.value = ""; f.click(); }

// ---------- 💾 backup of what only lives on this phone (mileage, visits, plans, card, unsent items) ----------
async function makeBackup() {
  const road = typeof ROAD !== "undefined" ? ROAD : {};
  const meta = Object.assign({}, META); delete meta.lastCall;
  const data = {kempner_phone_backup: 1, made_at: nowIso(), device: META.device || "iPhone", meta, road, pending: PENDING};
  const f = new File([JSON.stringify(data)], `kempner_phone_backup_${localDate()}.json`, {type: "application/json"});
  await shareFile(f); META.lastBackup = nowIso(); await saveMeta(); render();
}
async function restoreBackup(data) {
  const n = (data.road && data.road.visits || []).length, p = (data.pending || []).length;
  if (!confirm(`Restore the backup from ${String(data.made_at || "").slice(0, 16).replace("T", " ")}?\n\nThis puts back ${n} mileage stop(s), your day plans, mileage settings and card details. ${p} unsent item(s) in it are added to anything waiting here (nothing is sent twice).`)) return;
  if (typeof ROAD !== "undefined" && data.road) { for (const k of Object.keys(data.road)) { ROAD[k] = data.road[k]; await KV.set("road_" + k, ROAD[k]); } }
  const keep = {user: META.user, device: META.device};
  META = Object.assign(META, data.meta || {}, Object.fromEntries(Object.entries(keep).filter(([, v]) => v))); await saveMeta();
  const have = new Set(PENDING.map(e => e.id)), applied = new Set((SNAP && SNAP.applied_event_ids) || []);
  for (const e of data.pending || []) if (!have.has(e.id) && !applied.has(e.id)) PENDING.push(e);
  await savePending(); applyTheme(); render(); toast("✓ Backup restored", 4000);
}
const backupDue = () => { const last = META.lastBackup ? (Date.now() - new Date(META.lastBackup).getTime()) / 86400000 : 999;
  const hasData = typeof ROAD !== "undefined" && (ROAD.visits.length || Object.keys(ROAD.plans).length); return hasData && last >= 7 ? (META.lastBackup ? Math.floor(last) : -1) : 0; };
// A weekday "send your changes" reminder in the iPhone Calendar (web apps can't send their own notifications without a server).
function calendarReminder() {
  const t = META.remindTime || "17:00", start = nextWorkday(0 + 0).replace(/-/g, "") + "T" + t.replace(":", "") + "00";
  const url = location.href.split("#")[0] + "#/sync";
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Kempner Mobile//EN", "BEGIN:VEVENT", `UID:kempner-send-reminder@kempner-mobile`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`,
    `DTSTART:${start}`, "DURATION:PT10M", "RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR", "SUMMARY:📤 Send today's changes to the CRM",
    `DESCRIPTION:Open Kempner Mobile → Sync → Export changes (and save a backup on Fridays). ${url}`, `URL:${url}`,
    "BEGIN:VALARM", "TRIGGER:PT0M", "ACTION:DISPLAY", "DESCRIPTION:Send today's changes to the CRM", "END:VALARM", "END:VEVENT", "END:VCALENDAR"];
  shareFile(new File([lines.join("\r\n")], "Kempner send reminder.ics", {type: "text/calendar"}));
}

// ---------- health banners (shown on Today & Sync) ----------
function healthBanners() {
  const out = [];
  if (PENDING.length) {
    const oldest = PENDING.reduce((m, e) => e.created_at < m ? e.created_at : m, PENDING[0].created_at);
    const days = (Date.now() - new Date(oldest).getTime()) / 86400000;
    const cls = days >= (META.remindDays || 2) ? "amber" : "soft";
    out.push(`<a class="banner ${cls}" href="#/sync">⬆️ <span>${PENDING.length} item${PENDING.length === 1 ? "" : "s"} only on this phone${days >= 1 ? ` · oldest ${Math.floor(days)} day${Math.floor(days) === 1 ? "" : "s"}` : ""} — send to CRM</span><span class="chev">›</span></a>`);
  }
  const bd = backupDue(); if (bd) out.push(`<a class="banner soft" href="#/sync" data-backup="1">💾 <span>${bd < 0 ? "Back up your mileage, visits and plans — they only live on this phone" : `Last phone backup ${bd} days ago — back up your mileage and visits`}</span><span class="chev">›</span></a>`);
  if (SNAP && SNAP.exported_at) {
    const d = (Date.now() - new Date(SNAP.exported_at.replace(" ", "T")).getTime()) / 86400000;
    if (d >= 7) out.push(`<a class="banner soft" href="#/sync">🕘 <span>CRM copy is ${Math.floor(d)} days old — load a fresh snapshot</span><span class="chev">›</span></a>`);
  }
  return out.join("");
}

async function boot() {
  await loadAll();
  // opening the app lands on Home (links to a particular screen still work)
  if (!location.hash || location.hash === "#" || location.hash === "#/") history.replaceState(null, "", "#/home");
  updateBadges();
  render();
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
}

document.addEventListener("click", e => { const b = e.target.closest("[data-backup]"); if (b) { e.preventDefault(); makeBackup(); } });
document.getElementById("brand").addEventListener("click", () => go("#/home"));
// Tapping a bottom tab always closes any open sheet and refreshes that screen, even if it's the current one.
document.getElementById("tabs").addEventListener("click", e => {
  const a = e.target.closest("a"); if (!a) return;
  closeSheet();
  if (a.getAttribute("href") === (location.hash || "#/")) { e.preventDefault(); render(); window.scrollTo({top: 0, behavior: "smooth"}); }
});
