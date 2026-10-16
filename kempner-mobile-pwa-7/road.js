"use strict";
/* Kempner Mobile — on the road: pre-visit brief (+ read aloud), day plan / route, visit check-ins, mileage log.
   Visits, plans and mileage live only on this phone (they're yours, not CRM records). */

let ROAD = {visits: [], plans: {}, mileage: {}, dist: {}, pc: {seen: {}, notes: {}, merged: ""}};
async function loadRoad() {
  try { for (const k of ["visits", "plans", "mileage", "dist", "pc"]) ROAD[k] = (await KV.get("road_" + k)) || ROAD[k]; } catch (e) {}
}
const saveRoad = k => KV.set("road_" + k, ROAD[k]);
const _bootCore = boot;
boot = async () => { await loadRoad(); await mergePcPlans(); return _bootCore(); };

// ---------- plans made on the PC (🗓 Plan visits) ----------
// Each snapshot carries the PC's plans from today on. A day you haven't touched on the phone just takes the PC's list;
// a day you've changed here keeps your changes, gains any stops newly added on the PC and loses ones removed there.
const sameList = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
async function mergePcPlans() {
  if (!SNAP || !SNAP.plans || ROAD.pc.merged === SNAP.exported_at) return 0;
  const today = localDate(), pcPlans = {}; let changed = 0;
  for (const [d, list] of Object.entries(SNAP.plans)) if (d >= today) pcPlans[d] = list;
  const dates = new Set(Object.keys(pcPlans).concat(Object.keys(ROAD.pc.seen).filter(d => d >= today)));
  for (const d of dates) {
    const pc = (pcPlans[d] || []).map(s => String(s.company_id)), prev = ROAD.pc.seen[d] || [], phone = ROAD.plans[d] || [];
    ROAD.pc.notes[d] = Object.fromEntries((pcPlans[d] || []).filter(s => s.note).map(s => [String(s.company_id), s.note]));
    if (sameList(pc, prev)) continue;
    if (!phone.length || sameList(phone, prev)) ROAD.plans[d] = pc.slice();
    else { const gone = new Set(prev.filter(k => !pc.includes(k)));
      ROAD.plans[d] = phone.filter(k => !gone.has(k)).concat(pc.filter(k => !prev.includes(k) && !phone.includes(k))); }
    ROAD.pc.seen[d] = pc; changed++;
  }
  for (const d of Object.keys(ROAD.pc.seen)) if (d < today) { delete ROAD.pc.seen[d]; delete ROAD.pc.notes[d]; }
  ROAD.pc.merged = SNAP.exported_at || "";
  await saveRoad("plans"); await saveRoad("pc");
  return changed;
}
const fromPc = (d, k) => (ROAD.pc.seen[d] || []).includes(String(k));
const pcNote = (d, k) => (ROAD.pc.notes[d] || {})[String(k)] || "";
window.onSnapshotLoaded = async () => { const n = await mergePcPlans(); return n ? ` 🗓 ${n} day plan${n === 1 ? "" : "s"} from the PC.` : ""; };

// ---------- visits (check-ins + logged visits) ----------
function visitsOn(date) { return ROAD.visits.filter(v => v.date === date).sort((a, b) => (a.time || "").localeCompare(b.time || "")); }
async function recordVisit(key, date, time, src) {
  const c = IDX.co.get(String(key)); if (!c) return;
  date = date || localDate(); time = time || localTime();
  const ex = ROAD.visits.find(v => v.key === String(key) && v.date === date);
  if (ex) { if (time < ex.time) ex.time = time; if (src === "checkin" || !ex.src) ex.src = src; }
  else ROAD.visits.push({id: uuid(), date, time, key: String(key), name: c.name, pc: companyPostcode(key), src});
  await saveRoad("visits");
}
async function checkIn(key) {
  await recordVisit(key, localDate(), localTime(), "checkin");
  const c = IDX.co.get(String(key));
  openSheet(`<b style="font-size:17px">📍 Checked in · ${esc(c ? c.name : "")}</b><div class="small" style="margin:4px 0 14px">${localTime()} — added to today's mileage.</div>
    <a class="btn block green" href="#/add/meeting/${encodeURIComponent(key)}">🤝 Log the visit now</a>
    <a class="btn block sec" href="#/brief/${encodeURIComponent(key)}">📋 Read the brief</a>
    <button class="btn block sec" onclick="closeSheet()">Later</button>`);
}

// ---------- geo helpers ----------
// Look up missing postcodes once per app session (so no signal or an odd reply can't make a screen keep retrying).
const _geoTried = new Set();
const geoPending = pcs => pcs.some(p => p && !GEO[p] && !_geoTried.has(p));
async function ensureGeo(pcs, force) { const miss = [...new Set(pcs.filter(p => p && !GEO[p] && (force || !_geoTried.has(p))))]; miss.forEach(p => _geoTried.add(p));
  if (miss.length && navigator.onLine !== false) { try { await geocodeMissing(miss); } catch (e) {} } }
const geoOf = pc => (pc && GEO[pc] && !GEO[pc].none) ? GEO[pc] : null;
const homePc = () => (META.homePostcode || "").toUpperCase().trim();
function hereNow(timeout = 12000) {
  return new Promise((res, rej) => navigator.geolocation ? navigator.geolocation.getCurrentPosition(p => res({lat: p.coords.latitude, lon: p.coords.longitude}), rej,
    {enableHighAccuracy: false, timeout, maximumAge: 120000}) : rej(new Error("no location on this device")));
}

// ---------- PRE-VISIT BRIEF ----------
function briefParts(key) {
  const c = IDX.co.get(String(key)), v = view(key) || {};
  const ppl = people(key), open = openActions(key), nts = notes(key).slice(0, 3);
  const openQ = (v.quote_groups || []).filter(g => ["pending", "counter-offered", "on hold", "negotiating"].includes(String(g.status || "").toLowerCase()));
  const og = (v.order_groups || []).slice(0, 2), eq = rows("owned_equipment", key), specs = rows("company_known_film_specs", key);
  const trials = rows("company_film_trials", key).slice().sort((a, b) => String(b.trial_date).localeCompare(String(a.trial_date))).slice(0, 3);
  const upMeet = meetings(key).filter(m => m.status !== "DONE" && m.date >= localDate()).sort((a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || "")))[0];
  return {c, v, ppl, open, nts, openQ, og, eq, specs, trials, upMeet};
}
function briefSpeech(key) {
  const b = briefParts(key), s = [];
  const clean = t => String(t || "").replace(/µm/g, " micron").replace(/·/g, ",").replace(/£/g, "").replace(/\s+/g, " ").trim();
  s.push(`Brief for ${b.c.name}.`);
  if (b.v.last_contact) s.push(`Last contact ${b.v.last_contact.replace(/\(.*\)/, "")}.`);
  const main = b.ppl.find(p => p.is_main_contact) || b.ppl[0];
  if (main) s.push(`Main contact ${main.name}${main.org_role ? ", " + main.org_role : ""}.`);
  if (b.upMeet) s.push(`Booked: ${MEETING_TYPES[b.upMeet.meeting_type || ""] || "meeting"} ${niceDate(b.upMeet.date)}${b.upMeet.time ? " at " + b.upMeet.time : ""}.`);
  const over = b.open.filter(a => a.date && dayDiff(a.date) < 0);
  if (over.length) s.push(`${over.length} overdue action${over.length === 1 ? "" : "s"}: ${over.slice(0, 2).map(a => clean(a.note)).join("; ")}.`);
  else if (b.open.length) s.push(`Next action: ${clean(b.open[0].note)}.`);
  if (b.nts.length) s.push(`Last note, ${niceDate(b.nts[0].date)}: ${clean(b.nts[0].content).slice(0, 260)}.`);
  if (b.openQ.length) s.push(`${b.openQ.length} open quote${b.openQ.length === 1 ? "" : "s"}: ${b.openQ.slice(0, 2).map(g => `${clean(g.headline)}, ${Math.round(g.grand_total)} pounds`).join("; ")}.`);
  if (b.og.length) s.push(`Last order ${niceDate(b.og[0].order_date)}: ${clean(b.og[0].headline)}.`);
  if (b.v.reorder && b.v.reorder.text) s.push(clean(b.v.reorder.text.replace(/^\S+\s/, "")) + ".");
  if (b.eq.length) s.push(`They run ${b.eq.slice(0, 4).map(e => clean(e.name)).join(", ")}.`);
  if (b.trials.length) s.push(`Last trial: ${clean(b.trials[0].spec_name)}${b.trials[0].trial_date ? ", " + niceDate(b.trials[0].trial_date) : ""}.`);
  return s.join(" ");
}
function speak(text) {
  if (!("speechSynthesis" in window)) return toast("Read aloud isn't available on this device");
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text), vs = speechSynthesis.getVoices();
  u.voice = vs.find(v => /en-GB/i.test(v.lang)) || vs.find(v => /^en/i.test(v.lang)) || null; u.lang = "en-GB"; u.rate = 1.02;
  speechSynthesis.speak(u);
}
route(/^#\/brief\/(.+)$/, key => {
  const b = briefParts(key); if (!b.c) return go("#/companies");
  setHeader("Brief · " + b.c.name, coHref(key), "companies");
  const st = companyStatus(b.c), addr = rows("addresses", key)[0];
  const sec = (t, body) => body ? `<h2>${t}</h2><div class="list">${body}</div>` : "";
  const it = (meta, body, cls = "") => `<div class="item ${cls}">${meta ? `<div class="meta">${meta}</div>` : ""}<div class="body">${body}</div></div>`;
  const checked = ROAD.visits.some(v => v.key === String(key) && v.date === localDate());
  $("#view").innerHTML = `
    <div class="card"><div style="display:flex;align-items:center;gap:10px"><span class="dot" style="width:12px;height:12px;background:${esc(STATUS_COL[st] || "#dde1ea")}"></span>
      <b style="font-size:19px;flex:1">${esc(b.c.name)}</b>${b.v.score != null ? `<span class="score ${scoreCls(b.v.score)}">${esc(b.v.score)}</span>` : ""}</div>
      ${b.v.last_contact ? `<div class="small" style="margin-top:6px">Last contact <b>${esc(b.v.last_contact)}</b></div>` : ""}
      <div style="margin-top:6px">${b.v.reorder ? `<span class="chip c-${esc(b.v.reorder.tone === "sub" ? "" : b.v.reorder.tone)}">${esc(b.v.reorder.text)}</span>` : ""}${b.v.rate ? `<span class="chip c-green">${esc(b.v.rate.text)}</span>` : ""}</div>
      <div class="qa" style="grid-template-columns:repeat(4,1fr)">
        <button id="speakBtn"><span class="i">🔊</span>Read aloud</button>
        <a class="${addr ? "" : "off"}" href="https://maps.apple.com/?daddr=${addr ? encodeURIComponent((addr.lines || "").replace(/\n/g, ", ")) : ""}"><span class="i">🧭</span>Directions</a>
        <button id="ciBtn" ${checked ? 'style="background:var(--green-soft)"' : ""}><span class="i">📍</span>${checked ? "Checked in" : "Check in"}</button>
        <a href="#/add/meeting/${encodeURIComponent(key)}"><span class="i">🤝</span>Log visit</a></div></div>
    ${b.upMeet ? `<div class="banner blue">📅 <span>Booked ${esc(niceDate(b.upMeet.date))}${b.upMeet.time ? " " + esc(b.upMeet.time) : ""} · ${esc(MEETING_TYPES[b.upMeet.meeting_type || ""] || "Meeting")}${b.upMeet.notes ? " — " + esc(b.upMeet.notes.slice(0, 80)) : ""}</span></div>` : ""}
    ${sec("👤 Who you'll meet", b.ppl.map(p => it("", `<b>${esc(p.name)}</b>${p.is_main_contact ? " ★" : ""}${p.org_role ? ` <span class="chip">${esc(p.org_role)}</span>` : ""}${p.numbers[0] ? `<div class="small">📞 ${telLink(p.numbers[0].number, key)}</div>` : ""}`)).join(""))}
    ${sec("⚠ Open actions", b.open.slice(0, 5).map(a => it(`<span class="${dueClass(a.date)}">${niceDate(a.date) || "No date"}</span>`, esc(a.note))).join(""))}
    ${sec("💬 Last time", b.nts.map(n => it(`<b>${niceDate(n.date)}</b>${n.customer_name ? " · " + esc(n.customer_name) : ""}`, esc(String(n.content).slice(0, 400)), "fl-" + esc(n.status_prefix || ""))).join(""))}
    ${sec("💷 Open quotes", b.openQ.map(g => it(`${niceDate(g.date)} · ${esc(g.status)}${g.follow_up_date ? " · chase " + niceDate(g.follow_up_date) : ""}`, `<b>${esc(g.headline)}</b> — ${gbp(g.grand_total)}${g.competitor ? ` <span class="small">vs ${esc(g.competitor)}</span>` : ""}`)).join(""))}
    ${sec("🛒 Recent orders", b.og.map(g => it(niceDate(g.order_date), `<b>${esc(g.headline)}</b> — ${gbp(g.grand_total)}`)).join(""))}
    ${sec("🏭 What they run", b.eq.map(e => it("", `${e.machine_type === "film" ? "🎞" : "⚙"} ${esc(e.name)} ${e.is_ours ? '<span class="chip c-green">ours</span>' : '<span class="chip">theirs</span>'}`)).join("")
        + b.specs.map(s => it("", `🎞 ${num(s.width_mm)}mm × ${num(s.thickness_micron)}µm ${s.is_ours ? '<span class="chip c-green">ours</span>' : `<span class="chip c-red">${esc(s.supplier || "competitor")}</span>`}${s.roll_price ? ` · ${gbp(s.roll_price)}/roll` : ""}`)).join(""))}
    ${sec("🧪 Film trials", b.trials.map(t => it(niceDate(t.trial_date), `${esc(t.spec_name)} ${["worked", "interested", "ordered"].filter(k => t[k]).map(k => `<span class="chip c-green">${k}</span>`).join("")}`)).join(""))}
    <a class="btn block sec" href="${coHref(key)}">Open full company page</a>`;
  let speaking = false;
  $("#speakBtn").onclick = () => { if (speaking) { speechSynthesis.cancel(); speaking = false; $("#speakBtn").innerHTML = '<span class="i">🔊</span>Read aloud'; return; }
    speak(briefSpeech(key)); speaking = true; $("#speakBtn").innerHTML = '<span class="i">⏹</span>Stop'; };
  $("#ciBtn").onclick = () => checkIn(key);
});
window.addEventListener("hashchange", () => { try { if ("speechSynthesis" in window) speechSynthesis.cancel(); } catch (e) {} });

// ---------- ROAD TAB: segment header ----------
function roadSeg(on) {
  return `<div class="seg" style="margin:0 0 10px">${[["plan", "🗓 Plan my day", "#/plan"], ["nearby", "📍 Nearby", "#/nearby"], ["mileage", "🚗 Mileage", "#/mileage"]].map(([k, l, h]) => `<button data-go="${h}" class="${k === on ? "on" : ""}">${l}</button>`).join("")}</div>`;
}
document.addEventListener("click", e => { const b = e.target.closest("[data-go]"); if (b) { e.preventDefault(); go(b.dataset.go); } });

// ---------- PLAN MY DAY ----------
let planDate = null;
function planFor(d) { return ROAD.plans[d] || (ROAD.plans[d] = []); }
async function addToPlan(d, key) { const p = planFor(d); if (!p.includes(String(key))) p.push(String(key)); await saveRoad("plans"); }
function routeUrl(stops, start) {
  const pt = s => s.geo ? `${s.geo.lat},${s.geo.lon}` : encodeURIComponent(s.addr || s.name);
  if (!stops.length) return "";
  const dest = stops[stops.length - 1], mids = stops.slice(0, -1).slice(0, 9);
  return `https://www.google.com/maps/dir/?api=1${start ? `&origin=${start}` : ""}&destination=${pt(dest)}${mids.length ? `&waypoints=${mids.map(pt).join("%7C")}` : ""}&travelmode=driving`;
}
function suggestNear(stopsGeo, exclude) {
  if (!stopsGeo.length) return [];
  const mine = new Set(scope().map(c => c._key)), reasons = new Map();
  const snz = (SNAP && SNAP.visit_snoozes) || {}, snoozed = k => String(k) in snz;  // snoozed on the PC's Plan visits
  const add = (k, r) => { if (!mine.has(String(k)) || exclude.has(String(k)) || snoozed(k)) return; if (!reasons.has(String(k))) reasons.set(String(k), []); reasons.get(String(k)).push(r); };
  for (const r of (SNAP && SNAP.today && SNAP.today.reorder_digest) || []) add(r.company_id, r.state === "overdue" ? "film reorder overdue" : r.at_risk ? "reorder at risk" : "reorder due");
  for (const r of (SNAP && SNAP.today && SNAP.today.needs_attention) || []) add(r.company_id, (r.flags || []).includes("overdue_action") ? "dropped follow-up" : "needs a nudge");
  for (const c of scope()) { const n = openActions(c._key).filter(a => a.date && dayDiff(a.date) <= 0).length; if (n) add(c._key, `${n} action${n === 1 ? "" : "s"} due`); }
  const out = [];
  for (const [k, rs] of reasons) { const c = IDX.co.get(String(k)); if (c && isQuiet(c)) continue; const g = geoOf(companyPostcode(k)); if (!g) continue;
    const d = Math.min(...stopsGeo.map(s => miles(s, g))); if (d <= 6) out.push({key: k, d, rs: [...new Set(rs)]}); }
  // plus a few Lobby leads close to a stop — "while you're there, try these"
  const leads = [];
  for (const c of scope()) { if (!isQuiet(c) || exclude.has(c._key) || snoozed(c._key)) continue; const g = geoOf(companyPostcode(c._key)); if (!g) continue;
    const d = Math.min(...stopsGeo.map(s => miles(s, g))); if (d <= 3) leads.push({key: c._key, d, rs: ["🛋 lead to try" + (leadInfo(c).sector ? ` (${leadInfo(c).sector})` : "")]}); }
  return out.sort((a, b) => a.d - b.d).slice(0, 8).concat(leads.sort((a, b) => a.d - b.d).slice(0, 3));
}
route(/^#\/plan(?:\/(\d{4}-\d{2}-\d{2}))?$/, async dArg => {
  setHeader("On the road", null, "road");
  const d = planDate = dArg || planDate || localDate();
  const keys = planFor(d).filter(k => IDX.co.get(k));
  const stops = keys.map(k => { const c = IDX.co.get(k), pc = companyPostcode(k), a = rows("addresses", k)[0];
    return {key: k, name: c.name, pc, geo: geoOf(pc), addr: a ? (a.lines || "").replace(/\n/g, ", ") : "", done: ROAD.visits.some(v => v.key === k && v.date === d)}; });
  const dayChip = (dd, l) => `<button class="fchip ${dd === d ? "on" : ""}" data-go="#/plan/${dd}">${l}</button>`;
  const start = homePc() && geoOf(homePc()) ? `${geoOf(homePc()).lat},${geoOf(homePc()).lon}` : "";
  const sugg = suggestNear(stops.filter(s => s.geo).map(s => s.geo), new Set(keys));
  $("#view").innerHTML = `${roadSeg("plan")}
    <div class="scrollx" style="padding-top:0">${dayChip(localDate(), "Today")}${dayChip(nextWorkday(1), "Next work day")}${dayChip(addDays(1) === nextWorkday(1) ? addDays(2) : addDays(1), niceDate(addDays(1) === nextWorkday(1) ? addDays(2) : addDays(1)))}
      <input type="date" class="fchip" id="pdate" value="${d}" style="padding:5px 10px"></div>
    <h2>🗓 ${esc(niceDate(d))} — ${stops.length} stop${stops.length === 1 ? "" : "s"}${homePc() ? ` <span class="r small">from ${esc(homePc())}</span>` : ""}</h2>
    <div class="list" id="stops">${stops.map((s, i) => `<div class="row ${s.done ? "pend" : ""}">
        <div style="width:26px;height:26px;border-radius:50%;background:${s.done ? "var(--green)" : "var(--red)"};color:#fff;font-weight:800;display:flex;align-items:center;justify-content:center;flex:none">${s.done ? "✓" : i + 1}</div>
        <a class="m" href="#/brief/${encodeURIComponent(s.key)}" style="color:inherit"><div class="t">${esc(s.name)}</div><div class="s">${fromPc(d, s.key) ? '<span class="chip c-blue" style="font-size:10.5px;padding:1px 6px;margin-right:6px">🖥 from PC</span>' : ""}${s.pc ? esc(s.pc) : "⚠ no postcode"}${i && s.geo && stops[i - 1].geo ? ` · ${miles(stops[i - 1].geo, s.geo).toFixed(1)} mi from last` : ""}${s.done ? " · checked in" : ""}</div>${pcNote(d, s.key) ? `<div class="s" style="white-space:normal">🗒 ${esc(pcNote(d, s.key))}</div>` : ""}</a>
        <div style="display:flex;gap:4px"><button class="btn sm sec" data-mv="${i}|-1" ${i ? "" : "disabled"}>↑</button><button class="btn sm sec" data-mv="${i}|1" ${i < stops.length - 1 ? "" : "disabled"}>↓</button><button class="btn sm sec" data-rm="${i}" style="color:var(--red)">✕</button></div></div>`).join("")
      || '<div class="empty">No stops yet. Add the customers you\'re seeing.</div>'}</div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin:8px 0">
      <button class="btn sm" id="addStop">＋ Add stop</button>
      <button class="btn sm sec" id="bestOrder" ${stops.length > 1 ? "" : "disabled"}>✨ Best order</button>
      ${stops.length ? `<a class="btn sm green" href="${routeUrl(stops, start)}" target="_blank">🗺 Route in Google Maps</a>` : ""}</div>
    ${stops.length ? `<div class="small">Google Maps takes all the stops at once. For Apple Maps, tap a stop and use 🧭 Directions on its brief.</div>` : ""}
    ${!homePc() ? `<div class="banner soft" style="margin-top:10px">🏠 <span>Set your home postcode in Mileage so routes and miles start from home.</span></div>` : ""}
    ${sugg.length ? `<h2>💡 Worth a visit while you're there</h2><div class="list">${sugg.map(x => { const c = IDX.co.get(x.key);
      return `<div class="row"><div class="m"><div class="t">${esc(c.name)}</div><div class="s">${x.d.toFixed(1)} mi from a stop · ${esc(x.rs.join(", "))}</div></div><button class="btn sm" data-add="${esc(x.key)}">＋ Add</button></div>`; }).join("")}</div>` : ""}`;
  const v = $("#view");
  v.querySelector("#pdate").onchange = e => go("#/plan/" + e.target.value);
  v.querySelectorAll("[data-mv]").forEach(b => b.onclick = async () => { const [i, dir] = b.dataset.mv.split("|").map(Number), p = planFor(d), j = i + dir;
    [p[i], p[j]] = [p[j], p[i]]; await saveRoad("plans"); render(); });
  v.querySelectorAll("[data-rm]").forEach(b => b.onclick = async () => { planFor(d).splice(+b.dataset.rm, 1); await saveRoad("plans"); render(); });
  v.querySelectorAll("[data-add]").forEach(b => b.onclick = async () => { await addToPlan(d, b.dataset.add); toast("Added to the plan"); render(); });
  v.querySelector("#addStop").onclick = () => pickCompany("Add a stop", async k => { closeSheet(); await addToPlan(d, k); await ensureGeo([companyPostcode(k)]); render(); });
  v.querySelector("#bestOrder").onclick = async () => {
    await ensureGeo(stops.map(s => s.pc).concat(homePc()), true);
    let from = geoOf(homePc());
    if (!from) { try { from = await hereNow(); } catch (e) { from = null; } }
    const left = keys.map(k => ({k, g: geoOf(companyPostcode(k))})), withG = left.filter(x => x.g), noG = left.filter(x => !x.g), order = [];
    let cur = from || (withG[0] && withG[0].g);
    while (withG.length) { let bi = 0; withG.forEach((x, i) => { if (miles(cur, x.g) < miles(cur, withG[bi].g)) bi = i; }); const nx = withG.splice(bi, 1)[0]; order.push(nx.k); cur = nx.g; }
    ROAD.plans[d] = order.concat(noG.map(x => x.k)); await saveRoad("plans");
    toast(noG.length ? `Re-ordered (${noG.length} without a postcode left at the end)` : "Re-ordered — shortest hops first"); render();
  };
  const pcs = stops.map(s => s.pc).concat(homePc());
  if (geoPending(pcs)) { await ensureGeo(pcs); if (location.hash.startsWith("#/plan")) render(); }
});
function pickCompany(title, onPick) {
  openSheet(`<b style="font-size:17px">${esc(title)}</b><input class="search" id="pkS" placeholder="Search companies…" style="margin-top:10px" autocomplete="off">
    <div class="list" id="pkL" style="margin-top:8px;max-height:52vh;overflow:auto"></div>`, el => {
    const draw = () => { const q = el.querySelector("#pkS").value.toLowerCase().trim();
      el.querySelector("#pkL").innerHTML = scope().filter(c => !q || haystack(c).includes(q)).sort((a, b) => a.name.localeCompare(b.name)).slice(0, 40)
        .map(c => `<a class="row" data-pk="${esc(c._key)}"><div class="m"><div class="t">${esc(c.name)}</div><div class="s">${esc(companyPostcode(c._key) || "no postcode")}</div></div><span class="chev">＋</span></a>`).join("") || '<div class="empty">No match</div>'; };
    el.querySelector("#pkS").oninput = draw; draw();
    el.querySelector("#pkL").onclick = e => { const r = e.target.closest("[data-pk]"); if (r) onPick(r.dataset.pk); };
  });
}

// ---------- MILEAGE ----------
let mlMonth = null;
const distKey = (a, b) => [a, b].sort().join("|");
function legMiles(a, b) {
  if (!a || !b || a === b) return {mi: 0, est: false};
  const k = distKey(a, b); if (ROAD.dist[k] != null) return {mi: ROAD.dist[k], est: false};
  const ga = geoOf(a), gb = geoOf(b); if (!ga || !gb) return {mi: null, est: true};
  return {mi: Math.round(miles(ga, gb) * 1.25 * 10) / 10, est: true};
}
async function roadMiles(a, b) {
  const ga = geoOf(a), gb = geoOf(b); if (!ga || !gb) return;
  const r = await fetch(`https://router.project-osrm.org/route/v1/driving/${ga.lon},${ga.lat};${gb.lon},${gb.lat}?overview=false`);
  if (!r.ok) throw new Error("route lookup failed"); const j = await r.json();
  if (j.routes && j.routes[0]) ROAD.dist[distKey(a, b)] = Math.round(j.routes[0].distance / 1609.344 * 10) / 10;
}
function dayLegs(date) {
  const vs = visitsOn(date), cfg = ROAD.mileage[date] || {}, home = homePc(), legs = [];
  const pts = [];
  if (home && cfg.startHome !== false) pts.push({pc: home, label: "Home"});
  for (const v of vs) pts.push({pc: v.pc || companyPostcode(v.key), label: v.name, key: v.key, time: v.time});
  if (home && cfg.endHome !== false && vs.length) pts.push({pc: home, label: "Home"});
  for (let i = 1; i < pts.length; i++) { const k = `${i}`, base = legMiles(pts[i - 1].pc, pts[i].pc), ov = (cfg.over || {})[k];
    legs.push({i: k, from: pts[i - 1], to: pts[i], mi: ov != null ? ov : base.mi, est: ov != null ? false : base.est, edited: ov != null}); }
  return legs;
}
route(/^#\/mileage(?:\/(\d{4}-\d{2}))?$/, mArg => {
  setHeader("On the road", null, "road");
  const m = mlMonth = mArg || mlMonth || localDate().slice(0, 7);
  const [yy, mm] = m.split("-").map(Number), prev = `${mm === 1 ? yy - 1 : yy}-${pad(mm === 1 ? 12 : mm - 1)}`, next = `${mm === 12 ? yy + 1 : yy}-${pad(mm === 12 ? 1 : mm + 1)}`;
  const days = [...new Set(ROAD.visits.filter(v => v.date.startsWith(m)).map(v => v.date))].sort().reverse();
  const rate = +META.mileRate || 0;
  let total = 0, anyEst = false, missing = 0;
  const dayHtml = days.map(d => { const legs = dayLegs(d), cfg = ROAD.mileage[d] || {};
    const dt = legs.reduce((s, l) => s + (+l.mi || 0), 0); total += dt; if (legs.some(l => l.est && l.mi != null)) anyEst = true; missing += legs.filter(l => l.mi == null).length;
    return `<h2>${esc(niceDate(d))} <span class="r small"><b>${dt.toFixed(1)} mi</b>${rate ? ` · ${gbp(dt * rate / 100)}` : ""}</span></h2><div class="list">${legs.map(l => `<div class="row">
        <div class="m"><div class="t" style="white-space:normal;font-weight:600">${esc(l.from.label)} → ${esc(l.to.label)}</div><div class="s">${esc(l.from.pc || "?")} → ${esc(l.to.pc || "no postcode")}${l.to.time ? " · " + esc(l.to.time) : ""}</div></div>
        <button class="btn sm sec" data-edit="${d}|${l.i}" style="min-width:78px">${l.mi == null ? "? mi" : `${l.est ? "≈" : ""}${(+l.mi).toFixed(1)} mi`}${l.edited ? " ✎" : ""}</button></div>`).join("") || '<div class="empty">One stop and no home postcode — nothing to measure yet.</div>'}
      <div class="row" style="justify-content:flex-start;gap:14px;font-size:13px"><label class="check" style="margin:0"><input type="checkbox" data-sh="${d}" ${cfg.startHome !== false ? "checked" : ""}> Started from home</label>
        <label class="check" style="margin:0"><input type="checkbox" data-eh="${d}" ${cfg.endHome !== false ? "checked" : ""}> Ended at home</label><button class="btn sm sec" data-addv="${d}" style="margin-left:auto">＋ Stop</button></div></div>`; }).join("");
  const claimed = (ROAD.mileage["claimed:" + m] || false);
  $("#view").innerHTML = `${roadSeg("mileage")}
    <div class="card"><div style="display:flex;align-items:center;gap:8px"><button class="btn sm sec" data-go="#/mileage/${prev}">‹</button>
      <b style="flex:1;text-align:center;font-size:17px">${["January","February","March","April","May","June","July","August","September","October","November","December"][mm - 1]} ${yy}</b><button class="btn sm sec" data-go="#/mileage/${next}">›</button></div>
      <div style="text-align:center;margin-top:10px"><div style="font-size:32px;font-weight:800">${total.toFixed(1)} mi</div>
        <div class="small">${days.length} day${days.length === 1 ? "" : "s"} on the road${rate ? ` · ${gbp(total * rate / 100)} at ${rate}p/mile` : ""}${anyEst ? " · ≈ = estimate" : ""}${claimed ? " · ✅ claimed" : ""}</div></div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:12px;justify-content:center">
        <button class="btn sm" id="roadBtn">🛣 Work out road miles</button><button class="btn sm green" id="csvBtn" ${days.length ? "" : "disabled"}>📤 Export CSV</button>
        <button class="btn sm sec" id="claimBtn">${claimed ? "Unmark claimed" : "Mark claimed"}</button></div>
      <div class="small" id="mlMsg" style="text-align:center;margin-top:6px">${missing ? `${missing} leg${missing === 1 ? "" : "s"} missing a postcode — tap the miles to type them.` : "Tap any miles figure to correct it."}</div></div>
    ${dayHtml || '<div class="empty" style="margin-top:10px">No visits this month yet. Visits you log, check-ins and signed sheets appear here automatically.</div>'}
    <h2>Settings</h2><div class="card"><div class="two"><div><label class="f">Home postcode</label><input class="f" id="homePc" value="${esc(homePc())}" placeholder="e.g. LS1 4AB" autocapitalize="characters"></div>
      <div><label class="f">Pence per mile</label><input class="f" id="rate" type="number" inputmode="decimal" value="${esc(META.mileRate || "")}" placeholder="e.g. 45"></div></div>
      <p class="small">Road miles come from OpenStreetMap routing (needs signal; only the two postcodes' map points are sent). Without signal you get a straight-line estimate × 1.25, marked ≈.</p></div>`;
  const v = $("#view");
  v.querySelector("#homePc").onchange = async e => { META.homePostcode = e.target.value.toUpperCase().trim(); await saveMeta(); await ensureGeo([homePc()]); render(); };
  v.querySelector("#rate").onchange = async e => { META.mileRate = e.target.value; await saveMeta(); render(); };
  v.querySelectorAll("[data-edit]").forEach(b => b.onclick = async () => { const [d, i] = b.dataset.edit.split("|"), cur = (dayLegs(d).find(l => l.i === i) || {}).mi;
    const ans = prompt("Miles for this leg (leave blank to reset):", cur == null ? "" : cur); if (ans === null) return;
    const cfg = ROAD.mileage[d] || (ROAD.mileage[d] = {}); cfg.over = cfg.over || {};
    if (ans.trim() === "") delete cfg.over[i]; else if (!isNaN(+ans)) cfg.over[i] = Math.round(+ans * 10) / 10;
    await saveRoad("mileage"); render(); });
  v.querySelectorAll("[data-sh],[data-eh]").forEach(c => c.onchange = async () => { const d = c.dataset.sh || c.dataset.eh, cfg = ROAD.mileage[d] || (ROAD.mileage[d] = {});
    cfg[c.dataset.sh ? "startHome" : "endHome"] = c.checked; await saveRoad("mileage"); render(); });
  v.querySelectorAll("[data-addv]").forEach(b => b.onclick = () => pickCompany("Add a stop to " + niceDate(b.dataset.addv), async k => {
    const t = prompt("Roughly what time were you there? (HH:MM)", "12:00") || "12:00"; closeSheet(); await recordVisit(k, b.dataset.addv, t, "manual"); await ensureGeo([companyPostcode(k)]); render(); }));
  v.querySelector("#claimBtn").onclick = async () => { ROAD.mileage["claimed:" + m] = !claimed; await saveRoad("mileage"); render(); };
  v.querySelector("#roadBtn").onclick = async () => {
    const msg = v.querySelector("#mlMsg"); msg.textContent = "Looking up postcodes…";
    await ensureGeo(days.flatMap(d => visitsOn(d).map(x => x.pc || companyPostcode(x.key))).concat(homePc()));
    const pairs = []; for (const d of days) for (const l of dayLegs(d)) if (l.est && l.from.pc && l.to.pc && geoOf(l.from.pc) && geoOf(l.to.pc)) pairs.push([l.from.pc, l.to.pc]);
    let n = 0, fail = 0;
    for (const [a, b] of pairs) { try { await roadMiles(a, b); n++; msg.textContent = `Road miles ${n}/${pairs.length}…`; } catch (e) { fail++; } }
    await saveRoad("dist"); render(); toast(fail ? `Got ${n} road distances; ${fail} couldn't be looked up (signal?)` : `✓ Road miles for ${n} leg${n === 1 ? "" : "s"}`);
  };
  v.querySelector("#csvBtn").onclick = () => {
    const q = s => `"${String(s ?? "").replace(/"/g, '""')}"`, lines = [["Date", "From", "To", "From postcode", "To postcode", "Purpose", "Miles", "Estimated"].map(q).join(",")];
    for (const d of days.slice().reverse()) for (const l of dayLegs(d)) lines.push([d, l.from.label, l.to.label, l.from.pc, l.to.pc, l.to.key ? "Customer visit" : "Return home", l.mi == null ? "" : (+l.mi).toFixed(1), l.est ? "Yes" : "No"].map(q).join(","));
    lines.push(["", "", "", "", "", "TOTAL", total.toFixed(1), ""].map(q).join(","));
    if (rate) lines.push(["", "", "", "", "", `CLAIM @ ${rate}p`, (total * rate / 100).toFixed(2), ""].map(q).join(","));
    shareFile(new File([lines.join("\r\n")], `Mileage ${m}.csv`, {type: "text/csv"}));
  };
});

// ---------- hooks into the rest of the app ----------
// Logged visits and signed sheets count as being on site (feeds mileage).
const _addEventCore = addEvent;
addEvent = async (type, coKey, data) => {
  const ev = await _addEventCore(type, coKey, data);
  try {
    if (type === "meeting" && data.status === "DONE") await recordVisit(evCoKey(ev), data.date || localDate(), data.time || localTime(), "visit");
    if (type === "signoff") await recordVisit(evCoKey(ev), localDate(), localTime(), "signoff");
  } catch (e) {}
  return ev;
};
// Today: today's plan card + "you seem to be at a planned stop" offer.
function todayPlanCard() {
  const d = localDate(), keys = (ROAD.plans[d] || []).filter(k => IDX.co.get(k));
  if (!keys.length) return `<a class="banner soft" href="#/plan">🗓 <span>Plan today's visits — route, briefs and mileage in one place</span><span class="chev">›</span></a>`;
  const done = keys.filter(k => ROAD.visits.some(v => v.key === k && v.date === d)).length;
  return `<h2>🗓 Today's plan <span class="r small">${done}/${keys.length} done · <a href="#/plan">open ›</a></span></h2><div class="list">${keys.map((k, i) => { const c = IDX.co.get(k), dn = ROAD.visits.some(v => v.key === k && v.date === d);
    return `<a class="row ${dn ? "pend" : ""}" href="#/brief/${encodeURIComponent(k)}"><div style="width:24px;height:24px;border-radius:50%;background:${dn ? "var(--green)" : "var(--red)"};color:#fff;font-weight:800;font-size:12px;display:flex;align-items:center;justify-content:center;flex:none">${dn ? "✓" : i + 1}</div><div class="m"><div class="t">${esc(c.name)}</div><div class="s">${dn ? "checked in" : esc(pcNote(d, k)) || "tap for the brief"}</div></div><span class="chev">›</span></a>`; }).join("")}</div>`;
}
async function nearStopCheck() {
  const d = localDate(), keys = (ROAD.plans[d] || []).filter(k => IDX.co.get(k) && !ROAD.visits.some(v => v.key === k && v.date === d));
  if (!keys.length || !navigator.permissions || !navigator.geolocation) return;
  try { const p = await navigator.permissions.query({name: "geolocation"}); if (p.state !== "granted") return; } catch (e) { return; }
  let here; try { here = await hereNow(8000); } catch (e) { return; }
  const near = keys.map(k => ({k, g: geoOf(companyPostcode(k))})).filter(x => x.g).map(x => ({k: x.k, d: miles(here, x.g)})).sort((a, b) => a.d - b.d)[0];
  if (!near || near.d > 0.6 || (location.hash || "#/") !== "#/") return;
  const c = IDX.co.get(near.k), host = $("#nearStop"); if (!host || !c) return;
  host.innerHTML = `<div class="banner green">📍 <span>Looks like you're at <b>${esc(c.name)}</b></span><button class="btn sm" style="margin-left:auto;background:#fff;color:var(--green)" id="nsBtn">Check in</button></div>`;
  $("#nsBtn").onclick = () => { checkIn(near.k); host.innerHTML = ""; };
}
// Nearby: "+🗓" adds a customer to today's plan.
document.addEventListener("click", async e => { const b = e.target.closest("[data-plan]"); if (!b) return; e.preventDefault(); e.stopPropagation();
  await addToPlan(localDate(), b.dataset.plan); toast("Added to today's plan"); });
