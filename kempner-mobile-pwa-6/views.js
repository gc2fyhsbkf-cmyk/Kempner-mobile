"use strict";
/* Kempner Mobile — screens: Today, Companies, Company, Nearby, Prices, Sync */

const TONE = {main: "t-main", muted: "t-muted", red: "t-red", amber: "t-amber", green: "t-green", blue: "t-blue", sub: "t-sub"};
const STAT_COL = {won:"#16a34a",accepted:"#16a34a",pending:"#f59e0b",negotiating:"#f59e0b","counter-offered":"#f59e0b","on hold":"#6b7280",lost:"#e8192c",rejected:"#e8192c",expired:"#6b7280"};
const MEETING_TYPES = {"": "Visit / meeting", film_trial: "Film trial", commission: "Commission", service: "Service", machine_demo: "Machine demo", check_up: "Check-up"};
const MEETING_ICON = {film_trial: "🎞", commission: "⚙", service: "🔧", machine_demo: "🎪", check_up: "✅", "": "🤝"};
const pendBadge = x => x && x._pending ? '<span class="badge">not synced</span>' : "";
const coHref = key => "#/c/" + encodeURIComponent(key);
const scoreCls = s => s == null ? "na" : s >= 70 ? "hi" : s < 40 ? "lo" : "";

function welcomeCard() {
  return `<div class="card" style="text-align:center;padding:22px 18px">
    <div style="font:700 40px/1 'Times New Roman',serif;color:var(--red)">KEMPNER</div>
    <p style="margin:10px 0 4px;font-weight:650">Your CRM, in your pocket — even with no signal.</p>
    <ol class="small" style="text-align:left;margin:14px 0">
      <li>On the PC: <b>Today → 📱 Phone sync → Export snapshot for phone</b>.</li>
      <li>Get the file onto this phone (email it to yourself, AirDrop, Drive…) and save it to Files.</li>
      <li>Tap below and pick the file.</li></ol>
    <button class="btn block red" onclick="pickSnapshot()">📥 Load snapshot from CRM</button>
    <p class="small">You can add new companies before loading anything.</p></div>`;
}

// ---------- shared list rows ----------
function listSub(c) {
  const v = view(c._key) || {}, parts = [];
  const cust = v.customer || (people(c._key)[0] || {}).name;
  if (cust) parts.push(esc(cust));
  const open = openActions(c._key), over = open.filter(a => a.date && dayDiff(a.date) < 0);
  let alert = false;
  if (over.length) { parts.push(`⚠ ${over.length} overdue`); alert = true; }
  else if (open.length) { const nd = Math.min(...open.map(a => dayDiff(a.date)));
    if (nd === 0) parts.push("⏰ today"); else if (nd === 1) parts.push("📅 tomorrow"); else if (nd < 7) parts.push(`📅 ${nd}d`); }
  return [parts.join("  ·  "), alert];
}
function coRow(c, extraRight = "") {
  if (isQuiet(c)) return quietRow(c, extraRight);
  const pc = pend(c._key).length, v = view(c._key) || {}, [sub, alert] = listSub(c), st = companyStatus(c);
  const tags = rows("company_tags", c._key).slice(0, 3);
  return `<a class="row" href="${coHref(c._key)}"><span class="score ${scoreCls(v.score)}">${v.score == null ? "" : esc(v.score)}</span>
    <div class="m"><div class="t">${c.pinned ? "★ " : ""}${esc(c.name)}${c._pending ? '<span class="badge">new</span>' : pc ? `<span class="badge">${pc}</span>` : ""}</div>
    ${sub ? `<div class="s ${alert ? "alert" : ""}">${sub}</div>` : ""}
    ${tags.length ? `<div style="margin-top:2px">${tags.map(t => `<span class="chip" style="font-size:10.5px;padding:1px 7px">${esc(t.tag)}</span>`).join("")}</div>` : ""}</div>
    ${extraRight}<span class="dot" style="background:${esc(STATUS_COL[st] || v.dot || "#dde1ea")}"></span></a>`;
}
function quietRow(c, extraRight = "") { // Lobby leads: no score, no warnings — what it is and why it's worth a try
  const li = leadInfo(c), pc = pend(c._key).length, seg = segOf(c);
  const sub = [coQuery ? seg : "", li.town, li.why].filter(Boolean).join("  ·  ");
  return `<a class="row" href="${coHref(c._key)}"><span class="score na" style="border-width:1px;font-size:15px">${seg === LOBBY ? "🛋" : "•"}</span>
    <div class="m"><div class="t">${esc(c.name)}${c._pending ? '<span class="badge">new</span>' : pc ? `<span class="badge">${pc}</span>` : ""}</div>
    <div class="s">${esc(sub || li.sector || "prospect")}</div></div>${extraRight}</a>`;
}
function actionRow(c, a, showCo = true) {
  return `<div class="row ${a._pending ? "pend" : ""}">
    <button class="done" data-done="${esc(c._key)}|${esc(a.id)}" aria-label="Mark done">✓</button>
    <a class="m" href="${coHref(c._key)}" style="color:inherit"><div class="t" style="white-space:normal">${a.tier == 1 ? "⭐ " : ""}${esc(a.note)}</div>
    <div class="s"><span class="${dueClass(a.date)}">${niceDate(a.date) || "No date"}${a.time ? " " + esc(a.time) : ""}</span>${showCo ? " · " + esc(c.name) : ""}${a.channel ? " · " + esc(a.channel) : ""}${a._pending ? " · not synced" : ""}</div></a></div>`;
}
document.addEventListener("click", e => { const b = e.target.closest("[data-done]"); if (!b) return; e.preventDefault();
  const [k, id] = b.dataset.done.split("|"); go(`#/done/${encodeURIComponent(k)}/${encodeURIComponent(id)}`); });

function scope() {
  const all = [...IDX.co.values()].filter(c => companyStatus(c) !== "ARCHIVED");
  return META.filter === "all" ? all : all.filter(isMine);
}

// ---------- TODAY ----------
route(/^#\/$/, () => {
  setHeader("", null, "today");
  $("#topRight").innerHTML = `<a class="tbtn" href="#/card" aria-label="My business card">🪪 My card</a>`;
  const v = $("#view");
  if (!SNAP && !PENDING.length) { v.innerHTML = welcomeCard(); showFab(() => go("#/newco")); return; }
  const cos = scope(), keys = cos.map(c => c._key), today = localDate();
  const over = [], due = [], soon = [];
  for (const k of keys) for (const a of openActions(k)) {
    const dd = dayDiff(a.date), c = IDX.co.get(k);
    if (!a.date) continue; if (dd < 0) over.push([c, a]); else if (dd === 0) due.push([c, a]); else if (dd <= 7) soon.push([c, a]);
  }
  const byDate = (x, y) => ((x[1].date || "") + (x[1].time || "")).localeCompare((y[1].date || "") + (y[1].time || "")) || (x[1].tier || 2) - (y[1].tier || 2);
  over.sort(byDate); due.sort(byDate); soon.sort(byDate);
  const mt = [];
  for (const k of keys) for (const m of meetings(k)) if (m.status !== "DONE" && m.date >= today && dayDiff(m.date) <= 7) mt.push([IDX.co.get(k), m]);
  mt.sort((x, y) => (x[1].date + (x[1].time || "")).localeCompare(y[1].date + (y[1].time || "")));
  const hr = new Date().getHours(), who = (META.user || (SNAP && SNAP.current_user) || "").split(" ")[0];
  const h = [];
  h.push(`<div style="margin:6px 4px 10px"><div style="font-size:24px;font-weight:800">${hr < 12 ? "Good morning" : hr < 18 ? "Good afternoon" : "Good evening"}${who ? ", " + esc(who) : ""}</div>
    <div class="small">${DOW[new Date().getDay()]} ${new Date().getDate()} ${MON[new Date().getMonth()]} · ${cos.length} ${META.filter === "all" ? "companies" : "of your companies"}</div></div>`);
  h.push(healthBanners());
  h.push(`<div id="nearStop"></div>`);
  h.push(`<div class="tiles">
    <a class="tile" style="background:var(--red)" href="#today-over"><b>${over.length}</b><span>Overdue</span></a>
    <a class="tile" style="background:var(--amber);color:#111" href="#today-due"><b>${due.length}</b><span>Due today</span></a>
    <a class="tile" style="background:var(--blue)" href="#today-mt"><b>${mt.length}</b><span>Meetings 7d</span></a>
    <a class="tile" style="background:var(--purple)" href="#/sync"><b>${PENDING.length}</b><span>To send</span></a></div>`);
  h.push(todayPlanCard());
  if (mt.length) h.push(`<h2 id="today-mt">🤝 Meetings — next 7 days</h2><div class="list">${mt.map(([c, m]) => {
    const addr = rows("addresses", c._key)[0];
    return `<div class="row ${m._pending ? "pend" : ""}"><div style="text-align:center;min-width:44px"><div style="font-size:11px;font-weight:800;color:var(--red)">${esc(niceDate(m.date).split(" ")[0].toUpperCase())}</div><div style="font-weight:800">${esc(m.time || "—")}</div></div>
      <a class="m" href="${coHref(c._key)}" style="color:inherit"><div class="t">${MEETING_ICON[m.meeting_type || ""] || "🤝"} ${esc(c.name)}</div><div class="s">${esc(niceDate(m.date))}${m.location ? " · " + esc(m.location) : ""}${m.meeting_type ? " · " + esc(MEETING_TYPES[m.meeting_type] || m.meeting_type) : ""}</div></a>
      ${addr ? `<a class="btn sm sec" href="https://maps.apple.com/?daddr=${encodeURIComponent((addr.lines || "").replace(/\n/g, ", "))}">🧭</a>` : ""}</div>`; }).join("")}</div>`);
  h.push(`<h2 id="today-over">⚠ Overdue <span class="r small">${over.length}</span></h2><div class="list">${over.slice(0, 30).map(([c, a]) => actionRow(c, a)).join("") || '<div class="empty">Nothing overdue 🎉</div>'}</div>`);
  if (over.length > 30) h.push(`<a class="btn sec block" href="#/companies">See all companies</a>`);
  h.push(`<h2 id="today-due">⏰ Due today <span class="r small">${due.length}</span></h2><div class="list">${due.map(([c, a]) => actionRow(c, a)).join("") || '<div class="empty">Nothing else due today.</div>'}</div>`);
  if (soon.length) h.push(`<h2>📅 Coming up this week</h2><div class="list">${soon.slice(0, 15).map(([c, a]) => actionRow(c, a)).join("")}</div>`);
  // CRM's own Today-page lists
  const mine = new Set(keys);
  const reo = ((SNAP && SNAP.today && SNAP.today.reorder_digest) || []).filter(r => mine.has(String(r.company_id))).slice(0, 12);
  if (reo.length) h.push(`<h2>🎞 Film reorders to chase</h2><div class="list">${reo.map(r => {
    const st = r.state === "overdue" ? ["c-red", "Overdue"] : r.at_risk ? ["c-red", "At risk"] : r.state === "due" ? ["c-amber", "Due"] : ["c-blue", "Soon"];
    const dd = r.days_until == null ? "" : r.days_until < 0 ? `${-r.days_until}d late` : `in ${r.days_until}d`;
    return `<a class="row" href="${coHref(r.company_id)}"><div class="m"><div class="t">${esc(r.company)}</div><div class="s">${esc(r.film_name || "")}${r.last_order ? " · last " + esc(niceDate(r.last_order)) : ""}</div></div>
      <span class="chip ${st[0]}">${st[1]}${dd ? " · " + dd : ""}</span></a>`; }).join("")}</div>`);
  const na = ((SNAP && SNAP.today && SNAP.today.needs_attention) || []).filter(r => mine.has(String(r.company_id))).slice(0, 10);
  const FL = {high_value_cold: "High value · cold", overdue_action: "Dropped follow-up", nothing_scheduled: "Nothing planned", cold: "Gone cold"};
  if (na.length) h.push(`<h2>👀 Needs a nudge</h2><div class="list">${na.map(r => `<a class="row" href="${coHref(r.company_id)}"><div class="m"><div class="t">${esc(r.company)}</div>
      <div class="s">${(r.flags || []).map(f => FL[f] || f).join(" · ")}${r.days_silent != null ? ` · ${r.days_silent} days silent` : ""}</div></div><span class="chev">›</span></a>`).join("")}</div>`);
  v.innerHTML = h.join("");
  v.querySelectorAll('a[href^="#today-"]').forEach(a => a.onclick = e => { e.preventDefault(); const t = document.getElementById(a.getAttribute("href").slice(1)); if (t) t.scrollIntoView({behavior: "smooth", block: "start"}); });
  showFab(() => quickAddSheet(null));
  nearStopCheck();
});

// ---------- COMPANIES ----------
let coQuery = "", coLimit = 80, coStatus = "";
route(/^#\/companies$/, () => {
  setHeader("Companies", null, "companies");
  const v = $("#view");
  if (!SNAP && !PENDING.length) { v.innerHTML = welcomeCard(); return; }
  const sts = (SNAP && SNAP.status_options) || ["URGENT","WARM","COLD","OK","DEAD","CONTACT","NONE"];
  const segN = s => scope().filter(c => segOf(c) === s).length, curSeg = META.seg || "";
  v.innerHTML = `<input class="search" id="q" type="search" placeholder="Company, person, phone, postcode, tag…" value="${esc(coQuery)}" autocomplete="off" autocorrect="off">
    <div class="seg" style="margin:8px 0 0"><button data-seg="" class="${curSeg === "" ? "on" : ""}">Main ${segN("")}</button>${segments().map(s => `<button data-seg="${esc(s.name)}" class="${curSeg === s.name ? "on" : ""}">${esc(segLabel(s))} ${segN(s.name)}</button>`).join("")}</div>
    <div class="scrollx">
      <button class="fchip ${META.filter !== "all" ? "on" : ""}" data-f="mine">Mine</button>
      <button class="fchip ${META.filter === "all" ? "on" : ""}" data-f="all">Everyone</button>
      <select class="fchip" id="stSel"><option value="">Any status</option>${sts.map(s => `<option ${coStatus === s ? "selected" : ""}>${s}</option>`).join("")}</select>
      <select class="fchip" id="sortSel">${[["az","A–Z"],["due","Most overdue"],["score","Health score"],["recent","Recently updated"]].map(([k, l]) => `<option value="${k}" ${META.sort === k ? "selected" : ""}>${l}</option>`).join("")}</select>
    </div><div id="coBody"></div>`;
  const q = $("#q"); q.oninput = () => { coQuery = q.value; coLimit = 80; coBody(); };
  v.querySelectorAll("[data-f]").forEach(b => b.onclick = async () => { META.filter = b.dataset.f; await saveMeta(); render(); });
  v.querySelectorAll("[data-seg]").forEach(b => b.onclick = async () => { META.seg = b.dataset.seg; await saveMeta(); render(); });
  $("#stSel").onchange = e => { coStatus = e.target.value; coBody(); };
  $("#sortSel").onchange = async e => { META.sort = e.target.value; await saveMeta(); coBody(); };
  coBody();
  showFab(() => go("#/newco"));
});
function coBody() {
  let list = scope();
  if (coStatus) list = list.filter(c => companyStatus(c) === coStatus);
  const q = coQuery.trim().toLowerCase();
  if (!q) list = list.filter(c => segOf(c) === (META.seg || ""));  // a search looks across every tab
  if (q) { const qd = digits(q), terms = q.split(/\s+/);
    list = list.filter(c => { const h = haystack(c); return terms.every(t => h.includes(t)) || (qd.length >= 4 && h.includes(qd)); }); }
  const overdue = c => openActions(c._key).filter(a => a.date && dayDiff(a.date) < 0).length;
  const sorters = {
    az: (a, b) => (b.pinned || 0) - (a.pinned || 0) || a.name.localeCompare(b.name),
    due: (a, b) => overdue(b) - overdue(a) || a.name.localeCompare(b.name),
    score: (a, b) => ((view(a._key) || {}).score ?? 50) - ((view(b._key) || {}).score ?? 50),
    recent: (a, b) => String(b.updated_at || "").localeCompare(String(a.updated_at || "")),
  };
  list.sort(q ? ((a, b) => (b.name.toLowerCase().startsWith(q)) - (a.name.toLowerCase().startsWith(q)) || a.name.localeCompare(b.name)) : (sorters[META.sort] || sorters.az));
  const lobbyHint = !q && META.seg === LOBBY ? `<div class="small" style="margin:6px 4px">Leads to try. No reminders or health scores here; open one and tap <b>⬆ Promote</b> once they're a real customer.</div>` : "";
  $("#coBody").innerHTML = `${lobbyHint}<h2>${list.length} ${list.length === 1 ? "company" : "companies"}</h2>
    <div class="list">${list.slice(0, coLimit).map(c => coRow(c)).join("") || '<div class="empty">Nothing matches.</div>'}</div>
    ${list.length > coLimit ? `<button class="btn sec block" id="more">Show ${Math.min(200, list.length - coLimit)} more</button>` : ""}`;
  const m = $("#more"); if (m) m.onclick = () => { coLimit += 200; coBody(); };
}

// ---------- COMPANY ----------
const coTab = {};
route(/^#\/c\/([^/]+)(?:\/(\w+))?$/, (key, tabArg) => {
  const c = IDX.co.get(key);
  if (!c) { toast("Company not found"); return go("#/companies"); }
  if (tabArg) coTab[key] = tabArg;
  const tab = coTab[key] || "overview";
  setHeader(c.name, "#/companies", "companies");
  const v = view(key) || {}, mc = mainContact(key), addr = rows("addresses", key)[0], st = companyStatus(c);
  const acts = actions(key), open = openActions(key), nts = notes(key), mts = meetings(key), ppl = people(key);
  const qg = pendingGroups(key, "quote_new").concat(v.quote_groups || []), og = pendingGroups(key, "order_new").concat(v.order_groups || []);
  const eq = rows("owned_equipment", key), specs = rows("company_known_film_specs", key), files = (IDX.files.get(String(c.id)) || []).concat(pend(key).filter(e => e.type === "photo" || e.type === "signoff"));
  const over = open.filter(a => a.date && dayDiff(a.date) < 0).length;
  const mapsQ = addr ? encodeURIComponent((addr.lines || "").replace(/\n/g, ", ")) : "";
  const h = [];
  h.push(`<div class="cohead ${c._pending ? "pend" : ""}">
    <div style="display:flex;align-items:center;gap:10px"><span class="dot" style="width:12px;height:12px;background:${esc(STATUS_COL[st] || "#dde1ea")}"></span>
      <div class="nm">${esc(c.name)}${c._pending ? '<span class="badge">new – not synced</span>' : ""}</div>
      ${v.score != null && !isQuiet(c) ? `<span class="score ${scoreCls(v.score)}">${esc(v.score)}</span>` : ""}</div>
    ${segOf(c) ? (li => `<div class="banner soft" style="margin:8px 0 0;display:flex;align-items:center;gap:8px"><span>${segOf(c) === LOBBY ? "🛋" : "🗂"} In the <b>${esc(segOf(c))}</b>${li.why ? ` · ${esc(li.why)}` : ""}${pend(key, "segment_set").length ? " · change not synced" : ""}</span><button class="btn sm green" id="promoteBtn" style="margin-left:auto;flex:none">⬆ Promote</button></div>`)(leadInfo(c)) : ""}
    <div style="margin-top:6px">${st !== "NONE" ? `<span class="chip" style="background:${esc(STATUS_COL[st])};color:#fff">${esc(st)}</span>` : ""}<span class="chip c-blue">📈 ${esc(c.pipeline_stage || "Prospect")}</span>${v.owners ? `<span class="chip">🧑‍💼 ${esc(v.owners)}</span>` : ""}${v.reorder ? `<span class="chip c-${esc(v.reorder.tone === "sub" ? "" : v.reorder.tone)}">${esc(v.reorder.text)}</span>` : ""}${c.region ? `<span class="chip">📍 ${esc(c.region)}</span>` : ""}</div>
    ${v.last_contact ? `<div class="small" style="margin-top:6px">Last contact: <b>${esc(v.last_contact)}</b></div>` : ""}
    ${mc ? `<div class="small" style="margin-top:2px">👤 ${esc(mc.name)}${mc.role ? " · " + esc(mc.role) : ""}${mc.number ? ` · ${telLink(mc.number, key)}` : ""}</div>` : ""}
    ${v.rate ? `<div style="margin-top:4px"><b class="t-green">${esc(v.rate.text)}</b> <span class="small">${esc(v.rate.sub || "")}</span></div>` : ""}
    <div class="qa">
      <a class="${mc && dialable(mc.number) ? "" : "off"}" href="tel:${esc(digits(mc && mc.number))}" data-call="${esc(key)}" data-num="${esc(mc && mc.number || "")}"><span class="i">📞</span>Call</a>
      <a class="${mc && dialable(mc.number) ? "" : "off"}" href="sms:${esc(digits(mc && mc.number))}"><span class="i">💬</span>Text</a>
      <a class="${mc && mc.email ? "" : "off"}" href="mailto:${esc(mc && mc.email || "")}"><span class="i">✉️</span>Email</a>
      <a class="${addr ? "" : "off"}" href="https://maps.apple.com/?daddr=${mapsQ}"><span class="i">🧭</span>Directions</a>
      <a href="#/brief/${encodeURIComponent(key)}"><span class="i">📋</span>Brief</a>
      <button id="addBtn" style="background:var(--red);color:#fff"><span class="i">＋</span>Add</button></div></div>`);
  const TABS = [["overview","Overview",""],["notes","Notes",nts.length],["actions","Actions",open.length],["meetings","Meetings",mts.length],["people","People",ppl.length],
    ["commercial","Commercial",qg.length + og.length],["equipment","Equipment",eq.length + specs.length],["files","Files",files.length]];
  h.push(`<div class="ctabs" id="ctabs">${TABS.map(([k, l, n]) => `<button data-tab="${k}" class="${tab === k ? "on" : ""}">${l}${n !== "" ? `<span class="n">${n}</span>` : ""}</button>`).join("")}</div><div id="tabBody"></div>`);
  $("#view").innerHTML = h.join("");
  const body = $("#tabBody");
  const renderTab = t => {
    coTab[key] = t;
    document.querySelectorAll("#ctabs button").forEach(b => b.classList.toggle("on", b.dataset.tab === t));
    body.innerHTML = TAB_RENDER[t]({key, c, v, acts, open, nts, mts, ppl, qg, og, eq, specs, files, addr, over});
    const cur = document.querySelector("#ctabs .on"); if (cur) cur.scrollIntoView({inline: "center", block: "nearest"});
  };
  $("#ctabs").onclick = e => { const b = e.target.closest("button"); if (b) renderTab(b.dataset.tab); };
  body.onclick = e => {
    const t = e.target.closest("[data-gotab]"); if (t) { renderTab(t.dataset.gotab); window.scrollTo({top: 0}); return; }
    if (e.target.id === "moreNotes") { body.querySelector("#notesList").innerHTML = notesHtml(nts, 100000); return; }
    const pb = e.target.closest("[data-pdf]"); if (pb) { const ev = PENDING.find(x => x.id === pb.dataset.pdf); if (ev) sharePdf(ev.data.pdf_b64, ev.data.filename); return; }
    const ph = e.target.closest("[data-photo]"); if (ph) { const ev = PENDING.find(x => x.id === ph.dataset.photo); if (ev) showPhoto(ev); return; }
    const ics = e.target.closest("[data-ics]"); if (ics) { const [kind, id] = ics.dataset.ics.split("|"); addToCalendar(key, kind, id); return; }
  };
  $("#addBtn").onclick = () => quickAddSheet(key);
  const pb = $("#promoteBtn"); if (pb) pb.onclick = async () => {
    if (!confirm(`Promote ${c.name} to your main list?`)) return;
    await addEvent("segment_set", key, {segment: ""}); toast("Promoted — the PC updates at the next sync"); render(); };
  renderTab(tab);
});
function notesHtml(list, n) {
  return list.slice(0, n).map(x => `<div class="item fl-${esc(x.status_prefix || "")} ${x._pending ? "pend" : ""}">
    <div class="meta"><b>${niceDate(x.date)}</b> ${esc(x.time || "")}${x.customer_name ? " · 👤 " + esc(x.customer_name) : ""}${x.reference ? ` <span class="chip" style="font-size:10.5px;padding:1px 7px">${esc(x.reference)}</span>` : ""} ${FLAG_EMOJI[x.status_prefix] || ""} ${pendBadge(x)}</div>
    <div class="body">${esc(x.content)}</div>
    ${x._pdf ? `<button class="btn sm sec" style="margin-top:8px" data-pdf="${esc(x._pdf)}">📄 View / share PDF</button>` : ""}
    ${x._photo ? `<button class="btn sm sec" style="margin-top:8px" data-photo="${esc(x._photo)}">🖼 View photo</button>` : ""}</div>`).join("")
    + (list.length > n ? `<button class="btn sec block" id="moreNotes" style="margin:8px">Show all ${list.length} notes</button>` : "");
}
function meetingItem(key, m) {
  return `<div class="item ${m._pending ? "pend" : ""}"><div class="meta"><b>${niceDate(m.date)}</b> ${esc(m.time || "")} · ${m.status === "DONE" ? "✅ done" : "📅 booked"}${m.meeting_type ? ` · ${MEETING_ICON[m.meeting_type] || ""} ${esc(MEETING_TYPES[m.meeting_type] || m.meeting_type)}` : ""}${m.location ? " · 📍 " + esc(m.location) : ""} ${pendBadge(m)}</div>
    ${m.contacts ? `<div class="small">With: ${esc(m.contacts)}</div>` : ""}<div class="body">${esc(m.notes || "")}</div>
    ${m.status !== "DONE" ? `<div style="display:flex;gap:6px;margin-top:8px">${!m._pending ? `<a class="btn sm green" href="#/add/meeting/${encodeURIComponent(key)}/${encodeURIComponent(m.id)}">✓ Log as done</a>` : ""}<button class="btn sm sec" data-ics="meeting|${esc(m.id)}">📅 Add to Calendar</button></div>` : ""}</div>`;
}
function groupHtml(g, isOrder) {
  const icon = ln => ln.section === "Film" ? "🎞" : ln.section === "Machines" ? "⚙" : "•";
  const tot = `Goods ${gbp(g.subtotal)}${g.shipping_cost ? ` + Shipping ${gbp(g.shipping_cost)}` : ""} = ${gbp((g.subtotal || 0) + (g.shipping_cost || 0))} +VAT ${gbp(g.vat_amount)} → ${gbp(g.grand_total)}`;
  return `<div class="item ${g._pending ? "pend" : ""}"><div class="qhead"><span class="small">${niceDate(isOrder ? g.order_date : g.date)}</span><span class="hl">${esc(g.headline)}${pendBadge(g)}</span>
    ${isOrder ? `<span class="amt box">${gbp(g.grand_total)}</span>` : `<span class="stat" style="background:${STAT_COL[String(g.status || "").toLowerCase()] || "#6b7280"}">${esc(g.status)}</span><span class="amt">${gbp(g.grand_total)}</span>`}</div>
    ${g.quote_number ? `<div class="small"><b>${esc(g.quote_number)}</b></div>` : ""}
    ${(g.lines || []).map(ln => { const pr = isOrder ? ln.unit_price : (ln.agreed_price || ln.quoted_price || 0);
      return `<div class="small">${icon(ln)} ${esc(ln.description)} ×${num(ln.quantity)} @ ${gbp(pr)}${!isOrder && ln.agreed_price && ln.quoted_price && ln.agreed_price != ln.quoted_price ? ` (was ${gbp(ln.quoted_price)})` : ""}</div>`; }).join("")}
    <div class="tot">${tot}</div>${g.follow_up_date ? `<div class="small">📅 Chase: ${niceDate(g.follow_up_date)}</div>` : ""}${g.competitor ? `<div class="small">vs ${esc(g.competitor)}</div>` : ""}${g.notes ? `<div class="small">${esc(g.notes)}</div>` : ""}</div>`;
}
const TAB_RENDER = {
  overview: ({key, c, v, open, nts, mts, addr, over}) => {
    const h = [];
    const glance = (v.glance || []).map(x => Object.assign({}, x));
    const na = glance.find(x => x.title === "NEXT ACTION");
    if (na) { const still = na.next_action_id && open.find(a => a.id === na.next_action_id), pick = still || open[0];
      Object.assign(na, pick ? {value: pick.note, sub: niceDate(pick.date), tone: "main"} : {value: "None open", sub: "", tone: "muted"}); }
    if (glance.length) h.push(`<div class="glance" style="margin-top:4px">${glance.map(x => `<div class="g b-${esc(x.tone)}"><div class="gt">${esc(x.icon)} ${esc(x.title)}</div><div class="gv ${TONE[x.tone] || ""}">${esc(x.value)}</div>${x.sub ? `<div class="gs">${esc(x.sub)}</div>` : ""}</div>`).join("")}</div>`);
    h.push(`<h2>✅ Open actions${over ? ` <span class="chip c-red">${over} overdue</span>` : ""}<a class="r small" data-gotab="actions">All ›</a></h2><div class="list">${open.slice(0, 4).map(a => actionRow(c, a, false)).join("") || '<div class="empty">No open actions. <a href="#/add/action/' + encodeURIComponent(key) + '">Add one</a></div>'}</div>`);
    const up = mts.filter(m => m.status !== "DONE" && m.date >= localDate()).sort((a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || "")));
    if (up.length) h.push(`<h2>🤝 Next meeting</h2><div class="list">${meetingItem(key, up[0])}</div>`);
    h.push(`<h2>📝 Latest notes<a class="r small" data-gotab="notes">All ${nts.length} ›</a></h2><div class="list">${notesHtml(nts, 3) || '<div class="empty">No notes yet.</div>'}</div>`);
    if (addr) h.push(`<h2>📍 Address</h2><div class="card"><div class="body" style="white-space:pre-wrap">${esc(addr.lines)}</div>
      <div style="display:flex;gap:6px;margin-top:8px"><a class="btn sm" href="https://maps.apple.com/?daddr=${encodeURIComponent((addr.lines || "").replace(/\n/g, ", "))}">🧭 Directions</a><button class="btn sm sec" data-copy="${esc((addr.lines || "").replace(/\n/g, ", "))}">⧉ Copy</button></div></div>`);
    if (c.vibe) h.push(`<h2>💬 Vibe</h2><div class="card">${esc(c.vibe)}</div>`);
    const qn = rows("quick_notes", key), cn = rows("competitor_notes", key).filter(x => x.content);
    if (qn.length || cn.length) h.push(`<h2>🗒 Scratchpad</h2><div class="list">${qn.map(q => `<div class="item"><div class="body">${esc(q.note)}</div></div>`).join("")}${cn.map(x => `<div class="item"><div class="meta">Competitors</div><div class="body">${esc(x.content)}</div></div>`).join("")}</div>`);
    if (c.updated_at) h.push(`<p class="small" style="text-align:center;margin-top:18px">Last updated in CRM ${esc(String(c.updated_at).slice(0, 16))}</p>`);
    return h.join("");
  },
  notes: ({key, nts}) => `<div style="display:flex;gap:6px;margin:6px 0"><a class="btn sm" href="#/add/note/${encodeURIComponent(key)}">📝 Add note</a><a class="btn sm sec" href="#/call/${encodeURIComponent(key)}">📞 Log a call</a></div>
    <div class="list" id="notesList">${notesHtml(nts, 25) || '<div class="empty">No notes yet.</div>'}</div>`,
  actions: ({key, c, acts, open}) => {
    const done = acts.filter(a => a.status === "DONE").sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    return `<div style="margin:6px 0"><a class="btn sm" href="#/add/action/${encodeURIComponent(key)}">✅ Add action</a></div>
      <h2>Open <span class="r small">${open.length}</span></h2><div class="list">${open.map(a => actionRow(c, a, false) + `<div style="padding:0 13px 8px 56px;margin-top:-6px"><button class="btn sm sec" data-ics="action|${esc(a.id)}" style="font-size:12px;padding:4px 9px">📅 Calendar</button></div>`).join("") || '<div class="empty">None open.</div>'}</div>
      <h2>Completed <span class="r small">${done.length}</span></h2><div class="list">${done.slice(0, 40).map(a => `<div class="item ${a._doneEv ? "pend" : ""}"><div class="meta">${niceDate(a.date)} ${a._doneEv ? pendBadge({_pending: 1}) : ""}</div><div class="body" style="color:var(--sub)">☑ ${esc(a.note)}</div></div>`).join("") || '<div class="empty">None.</div>'}</div>`;
  },
  meetings: ({key, mts}) => `<div style="margin:6px 0"><a class="btn sm" href="#/add/meeting/${encodeURIComponent(key)}">🤝 Log visit / book meeting</a></div>
    <div class="list">${mts.slice().sort((a, b) => (b.date + (b.time || "")).localeCompare(a.date + (a.time || ""))).map(m => meetingItem(key, m)).join("") || '<div class="empty">No meetings yet.</div>'}</div>`,
  people: ({key, ppl}) => `<div style="margin:6px 0"><a class="btn sm" href="#/add/contact/${encodeURIComponent(key)}">👤 Add contact</a></div>
    <div class="list">${ppl.map(p => `<div class="item ${p._pending ? "pend" : ""}">
      <div style="display:flex;align-items:center;gap:6px"><b style="font-size:16px">${esc(p.name)}</b>${p.is_main_contact ? '<span class="chip c-amber">★ main</span>' : ""}${p.org_role ? `<span class="chip">${esc(p.org_role)}</span>` : ""}${pendBadge(p)}</div>
      ${p.numbers.map(n => `<div style="margin-top:4px">📞 ${telLink(n.number, key)}${n.tag ? ` <span class="small">${esc(n.tag)}</span>` : ""}${n.is_best ? " ★" : ""}${dialable(n.number) ? ` <a class="small" href="sms:${esc(digits(n.number))}">💬 text</a>` : ""}</div>`).join("")}
      ${p.emails.map(e => `<div style="margin-top:4px">✉️ <a href="mailto:${esc(e)}">${esc(e)}</a></div>`).join("")}
      ${(p.dates || []).map(d => `<div class="small">🎂 ${esc(d.label)}: ${esc(d.date)}</div>`).join("")}
      ${p.reports_to_name ? `<div class="small">Reports to ${esc(p.reports_to_name)}</div>` : ""}</div>`).join("") || '<div class="empty">No contacts yet.</div>'}</div>`,
  commercial: ({key, v, qg, og}) => {
    const cm = v.commercial || {};
    return `<div style="display:flex;gap:6px;margin:6px 0"><a class="btn sm amber" href="#/add/quote/${encodeURIComponent(key)}">💷 New quote</a><a class="btn sm" style="background:var(--teal)" href="#/add/order/${encodeURIComponent(key)}">🛒 New order</a><a class="btn sm" style="background:var(--purple)" href="#/sign/${encodeURIComponent(key)}">✍️ Sign-off</a></div>
      <div class="ctiles"><div class="tile" style="background:#2563eb"><b>${esc(cm.total_quotes ?? qg.length)}</b><span>Quotes</span></div><div class="tile" style="background:#16a34a"><b>${esc(cm.win_rate ?? "—")}</b><span>Win rate</span></div>
        <div class="tile" style="background:#f59e0b;color:#111"><b>${gbp0(cm.open_value)}</b><span>Open quotes</span></div><div class="tile" style="background:#7c3aed"><b>${esc(cm.orders ?? og.length)}</b><span>Orders</span></div>
        <div class="tile" style="background:#0d9488"><b>${gbp0(cm.order_value)}</b><span>Order value</span></div>${v.reorder ? `<div class="tile" style="background:#6b7280"><b style="font-size:12px">${esc(v.reorder.text.replace(/^\S+\s/, ""))}</b><span>Film reorder</span></div>` : ""}</div>
      <h2>Quotes <span class="r small">${qg.length}</span></h2><div class="list">${qg.map(g => groupHtml(g, false)).join("") || '<div class="empty">No quotes.</div>'}</div>
      <h2>Orders <span class="r small">${og.length}</span></h2><div class="list">${og.map(g => groupHtml(g, true)).join("") || '<div class="empty">No orders.</div>'}</div>
      ${callOffsHtml(key)}`;
  },
  equipment: ({key, eq, specs}) => {
    const eqPend = pend(key, "meeting").filter(e => e.data.add_to_equipment && (e.data.films_seen || e.data.machines_seen));
    const packs = rows("company_pack_profiles", key), trials = rows("company_film_trials", key);
    return `<h2>🏭 Machines & film on site <span class="r small">${eq.length}</span></h2><div class="list">${eq.map(e => `<div class="item"><b>${esc(e.name)}</b>${e.quantity > 1 ? ` ×${esc(e.quantity)}` : ""}
        <span class="chip">${e.machine_type === "film" ? "🎞 film" : "⚙ machine"}</span>${e.is_ours ? '<span class="chip c-green">ours</span>' : '<span class="chip">theirs</span>'}
        ${e.manufacturer ? `<div class="small">${esc(e.manufacturer)}</div>` : ""}${e.notes ? `<div class="small">${esc(e.notes)}</div>` : ""}${e.fit_notes ? `<div class="small">${esc(e.fit_notes)}</div>` : ""}</div>`).join("")
        + eqPend.map(ev => `<div class="item pend">${esc([ev.data.films_seen, ev.data.machines_seen].filter(Boolean).join(", "))} ${pendBadge({_pending: 1})}</div>`).join("") || '<div class="empty">Nothing recorded. Log a visit to add what you see.</div>'}</div>
      ${specs.length ? `<h2>🎞 Known film specs</h2><div class="list">${specs.map(s => `<div class="item"><b>${num(s.width_mm)}mm × ${num(s.thickness_micron)}µm</b>${s.roll_length_m ? ` · ${num(s.roll_length_m)}m` : ""}
        ${s.is_ours ? '<span class="chip c-green">ours</span>' : '<span class="chip c-red">competitor</span>'}${s.is_suggested ? '<span class="chip c-blue">suggested</span>' : ""}
        ${s.supplier ? `<div class="small">Supplier: ${esc(s.supplier)}</div>` : ""}${s.roll_price ? `<div class="small">${gbp(s.roll_price)}/roll</div>` : ""}${s.notes ? `<div class="small">${esc(s.notes)}</div>` : ""}</div>`).join("")}</div>` : ""}
      <h2>📦 Pack profiles<a class="r small" href="#/pack/${encodeURIComponent(key)}">🧮 Cost per pack ›</a></h2>${packs.length ? `<div class="list">${packs.map(p => `<a class="item" style="display:block;color:inherit" href="#/pack/${encodeURIComponent(key)}/${p.id}"><span style="float:right" class="chip c-blue">🧮 cost</span><b>${esc(p.name)}</b> ${p.category ? `<span class="chip">${esc(p.category)}</span>` : ""}${p.frequency ? `<span class="chip">${esc(p.frequency)}</span>` : ""}
        <div class="small">${[p.length_mm, p.width_mm, p.height_mm].some(x => x) ? `${num(p.length_mm)} × ${num(p.width_mm)} × ${num(p.height_mm)} mm` : ""}${p.thickness_micron ? ` · ${num(p.thickness_micron)}µm` : ""}</div>${p.notes ? `<div class="small">${esc(p.notes)}</div>` : ""}</a>`).join("")}</div>` : '<div class="empty" style="background:var(--card);border-radius:14px">No pack profiles in the CRM — <a href="#/pack/' + encodeURIComponent(key) + '">work one out</a>.</div>'}
      ${trials.length ? `<h2>🧪 Film trials</h2><div class="list">${trials.map(t => `<div class="item"><div class="meta">${niceDate(t.trial_date)}</div><b>${esc(t.spec_name)}</b> ${["worked","interested","ordered"].filter(k => t[k]).map(k => `<span class="chip c-green">${k}</span>`).join("")}${t.notes ? `<div class="small">${esc(t.notes)}</div>` : ""}</div>`).join("")}</div>` : ""}`;
  },
  files: ({key, files}) => `<div style="display:flex;gap:6px;margin:6px 0"><button class="btn sm" onclick="takePhoto('${esc(key)}')">📷 Take photo</button><a class="btn sm" style="background:var(--purple)" href="#/sign/${encodeURIComponent(key)}">✍️ Sign-off sheet</a></div>
    <div class="list">${files.map(f => f.type ? `<div class="item pend"><div class="meta">${niceDate(f.created_at.slice(0, 10))} ${pendBadge({_pending: 1})}</div>
        ${f.type === "photo" ? `<button class="btn sm sec" data-photo="${esc(f.id)}">🖼 ${esc(f.data.caption || f.data.filename)}</button>` : `<button class="btn sm sec" data-pdf="${esc(f.id)}">📄 ${esc(f.data.filename)}</button>`}</div>`
      : `<div class="item"><div class="meta">${esc(String(f.added_at || "").slice(0, 16))} · ${esc(f.link_type || "file")}</div><div>${/\.pdf$/i.test(f.filename) ? "📄" : /\.(jpe?g|png|heic)$/i.test(f.filename) ? "🖼" : "📎"} ${esc(f.filename)}</div><div class="small">Saved in the CRM on the PC</div></div>`).join("") || '<div class="empty">No files yet.</div>'}</div>`,
};
function callOffsHtml(key) {
  const co = rows("call_off_agreements", key); if (!co.length) return "";
  return `<h2>📆 Call-off agreements</h2><div class="list">${co.map(a => {
    const dd = IDX.drawdowns.get(String(a.id)) || [], drawn = dd.reduce((s, d) => s + (+d.quantity_rolls || 0), 0), tot = +a.total_quantity_rolls || 0;
    const nm = (IDX.products[String(a.product_id)] || {}).name || a.spec_description || "Spec", pct = tot ? Math.min(100, Math.round(drawn / tot * 100)) : 0;
    return `<div class="item"><b>${esc(nm)}</b> <span class="chip">${esc((a.status || "").replace(/_/g, " "))}</span>
      <div style="height:6px;border-radius:3px;background:var(--chip);margin:6px 0"><div style="height:6px;border-radius:3px;background:var(--green);width:${pct}%"></div></div>
      <div class="small">${num(drawn)} of ${num(tot)} rolls drawn${a.unit_price ? ` · ${gbp(a.unit_price)}/roll` : ""} · ${num(a.duration_months)} months from ${niceDate(a.agreement_start_date || a.order_date)}</div>${a.notes ? `<div class="small">${esc(a.notes)}</div>` : ""}</div>`; }).join("")}</div>`;
}

// ---------- quick-add sheet ----------
function quickAddSheet(key) {
  if (!key) { // pick a company first
    openSheet(`<b style="font-size:17px">Add for which company?</b><input class="search" id="qaSearch" placeholder="Search companies…" style="margin-top:10px" autocomplete="off">
      <div class="list" id="qaList" style="margin-top:8px;max-height:50vh;overflow:auto"></div><a class="btn block sec" href="#/newco">🏢 New company</a>`, el => {
      const draw = () => { const q = el.querySelector("#qaSearch").value.toLowerCase().trim();
        const list = scope().filter(c => !q || haystack(c).includes(q)).sort((a, b) => a.name.localeCompare(b.name)).slice(0, 40);
        el.querySelector("#qaList").innerHTML = list.map(c => `<a class="row" data-pick="${esc(c._key)}"><div class="m"><div class="t">${esc(c.name)}</div></div><span class="chev">›</span></a>`).join("") || '<div class="empty">No match</div>'; };
      el.querySelector("#qaSearch").oninput = draw; draw();
      el.querySelector("#qaList").onclick = e => { const r = e.target.closest("[data-pick]"); if (r) quickAddSheet(r.dataset.pick); };
    });
    return;
  }
  const k = encodeURIComponent(key), c = IDX.co.get(key);
  const items = [["📝","Note","#4f46e5",`#/add/note/${k}`],["📞","Log call","#0891b2",`#/call/${k}`],["✅","Action","#16a34a",`#/add/action/${k}`],["🤝","Visit","#2563eb",`#/add/meeting/${k}`],
    ["📷","Photo","#db2777",`photo`],["💷","Quote","#f59e0b",`#/add/quote/${k}`],["🛒","Order","#0d9488",`#/add/order/${k}`],["✍️","Sign-off","#7c3aed",`#/sign/${k}`],
    ["👤","Contact","#64748b",`#/add/contact/${k}`],["🧮","Cost/pack","#0f766e",`#/pack/${k}`],["🔖","Reorder QR","#b91c1c","reorder"],["📋","Brief","#334155",`#/brief/${k}`]];
  openSheet(`<b style="font-size:17px">${esc(c ? c.name : "")}</b><div class="sgrid" style="margin-top:14px">${items.map(([i, l, col, href]) =>
    href === "reorder" ? `<button data-ro="1"><span class="ic" style="background:${col}">${i}</span>${l}</button>` : href === "photo" ? `<button data-ph="1"><span class="ic" style="background:${col}">${i}</span>${l}</button>` : `<a href="${href}"><span class="ic" style="background:${col}">${i}</span>${l}</a>`).join("")}</div>`, el => {
    el.querySelector("[data-ph]").onclick = () => { closeSheet(); takePhoto(key); };
    el.querySelector("[data-ro]").onclick = () => reorderSheet(key);
  });
}

// ---------- NEARBY ----------
const PC_RE = /\b([A-Z]{1,2}\d[A-Z\d]?)\s*(\d[A-Z]{2})\b/i;
function companyPostcode(key) {
  for (const a of rows("addresses", key)) {
    const m = PC_RE.exec(a.postcode || "") || PC_RE.exec(a.lines || "");
    if (m) return (m[1] + " " + m[2]).toUpperCase();
  }
  return "";
}
function miles(a, b) {
  const R = 3958.8, toR = x => x * Math.PI / 180, dLat = toR(b.lat - a.lat), dLon = toR(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toR(a.lat)) * Math.cos(toR(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
async function geocodeMissing(pcs, onProgress) {
  const todo = pcs.filter(p => !GEO[p]);
  for (let i = 0; i < todo.length; i += 100) {
    const batch = todo.slice(i, i + 100);
    const r = await fetch("https://api.postcodes.io/postcodes", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({postcodes: batch})});
    if (!r.ok) throw new Error("postcode lookup failed (" + r.status + ")");
    const j = await r.json();
    for (const x of j.result || []) GEO[x.query] = x.result ? {lat: x.result.latitude, lon: x.result.longitude} : {none: 1};
    await KV.set("geo", GEO); if (onProgress) onProgress(Math.min(i + 100, todo.length), todo.length);
  }
}
let HERE = null;
route(/^#\/nearby$/, () => {
  setHeader("On the road", null, "road");
  const v = $("#view");
  if (!SNAP) { v.innerHTML = welcomeCard(); return; }
  const cos = scope(), withPc = cos.map(c => [c, companyPostcode(c._key)]).filter(x => x[1]);
  const missing = withPc.filter(([, p]) => !GEO[p]).length;
  v.innerHTML = `${roadSeg("nearby")}<div class="card"><b>Customers near you</b><p class="small" style="margin:4px 0 10px">Uses your phone's location and each customer's postcode. ${withPc.length} of ${cos.length} have a postcode on file.${missing ? ` ${missing} postcode${missing === 1 ? "" : "s"} still need looking up (needs signal, done once and remembered — only the postcodes are sent to postcodes.io).` : ""}</p>
    <button class="btn block red" id="locBtn">📍 ${HERE ? "Refresh my location" : "Find customers near me"}</button><div class="small" id="locMsg"></div></div><div id="nearList"></div>`;
  const draw = () => {
    if (!HERE) return;
    const list = withPc.filter(([, p]) => GEO[p] && !GEO[p].none).map(([c, p]) => [c, miles(HERE, GEO[p]), p]).sort((a, b) => a[1] - b[1]).slice(0, 60);
    $("#nearList").innerHTML = `<h2>Closest first</h2><div class="list">${list.map(([c, d, p]) => coRow(c, `<span class="dist">${d < 10 ? d.toFixed(1) : Math.round(d)} mi</span><button class="btn sm sec" data-plan="${esc(c._key)}" style="padding:4px 8px">＋🗓</button>`).replace('<div class="m">', `<div class="m" data-pc="${esc(p)}">`)).join("") || '<div class="empty">No customers with known locations yet.</div>'}</div>`;
  };
  $("#locBtn").onclick = async () => {
    const msg = $("#locMsg");
    try {
      if (missing) { msg.textContent = "Looking up postcodes…"; await geocodeMissing(withPc.map(x => x[1]), (d, t) => msg.textContent = `Looking up postcodes… ${d}/${t}`); }
    } catch (e) { msg.textContent = "Couldn't look up postcodes (no signal?). Showing what's already known."; }
    msg.textContent = "Getting your location…";
    navigator.geolocation.getCurrentPosition(pos => { HERE = {lat: pos.coords.latitude, lon: pos.coords.longitude}; render(); },
      err => { msg.textContent = err.code === 1 ? "Location permission is off for this app. Turn it on in Settings → Privacy → Location Services → Safari Websites." : "Couldn't get your location: " + err.message; },
      {enableHighAccuracy: false, timeout: 15000, maximumAge: 120000});
  };
  draw();
});

// ---------- PRICES & TOOLS ----------
let prQuery = "", prTab = "prices";
function priceHistory() {
  const hist = new Map();
  for (const [k, v] of Object.entries((SNAP && SNAP.views) || {})) {
    const c = IDX.co.get(k); if (!c) continue;
    for (const g of v.order_groups || []) for (const l of g.lines || []) { const n = String(l.description); if (!hist.has(n)) hist.set(n, []); hist.get(n).push({c, date: g.order_date, price: +l.unit_price, qty: l.quantity, kind: "order"}); }
    for (const g of v.quote_groups || []) for (const l of g.lines || []) { const n = String(l.description), p = +(l.agreed_price || l.quoted_price); if (!p) continue; if (!hist.has(n)) hist.set(n, []); hist.get(n).push({c, date: g.date, price: p, qty: l.quantity, kind: "quote", status: g.status}); }
  }
  for (const a of hist.values()) a.sort((x, y) => String(y.date).localeCompare(String(x.date)));
  return hist;
}
route(/^#\/prices$/, () => {
  setHeader("Prices & tools", null, "prices");
  const v = $("#view");
  v.innerHTML = `<div class="scrollx" style="padding-top:2px"><button class="fchip ${prTab === "prices" ? "on" : ""}" data-pt="prices">💷 Price list</button><button class="fchip ${prTab === "tools" ? "on" : ""}" data-pt="tools">🧮 Calculators</button></div><div id="prBody"></div>`;
  v.querySelectorAll("[data-pt]").forEach(b => b.onclick = () => { prTab = b.dataset.pt; render(); });
  if (prTab === "tools") return calculators($("#prBody"));
  if (!SNAP) { $("#prBody").innerHTML = welcomeCard(); return; }
  const hist = priceHistory(), prods = productList();
  const names = new Set(prods.map(p => p.name)); for (const n of hist.keys()) names.add(n);
  const all = [...names].map(n => ({name: n, p: productByName(n), h: hist.get(n) || []}));
  $("#prBody").innerHTML = `<input class="search" id="pq" type="search" placeholder="Search products — e.g. 19 450, POF, sealer…" value="${esc(prQuery)}" autocomplete="off" style="margin-top:8px"><div id="pl"></div>`;
  const draw = () => {
    const terms = prQuery.toLowerCase().split(/\s+/).filter(Boolean);
    const list = all.filter(x => terms.every(t => x.name.toLowerCase().replace(/µm/g, "mu").includes(t) || x.name.toLowerCase().includes(t)))
      .sort((a, b) => b.h.length - a.h.length || a.name.localeCompare(b.name)).slice(0, 80);
    $("#pl").innerHTML = `<div class="list" style="margin-top:10px">${list.map(x => { const last = x.h.find(e => e.kind === "order") || x.h[0];
      const ps = x.h.filter(e => e.kind === "order").map(e => e.price);
      return `<a class="row" data-prod="${esc(x.name)}"><div class="m"><div class="t" style="white-space:normal">${x.p && x.p.section === "Machines" ? "⚙" : "🎞"} ${esc(x.name)}</div>
        <div class="s">${last ? `Last ${gbp(last.price)} · ${esc(last.c.name)} · ${niceDate(last.date)}` : "No sales on record"}${ps.length > 1 ? ` · range ${gbp(Math.min(...ps))}–${gbp(Math.max(...ps))}` : ""}</div></div>
        <span class="chip">${x.h.length}</span></a>`; }).join("") || '<div class="empty">No products match.</div>'}</div>`;
  };
  $("#pq").oninput = e => { prQuery = e.target.value; draw(); };
  $("#pl").onclick = e => { const r = e.target.closest("[data-prod]"); if (!r) return; const h = hist.get(r.dataset.prod) || [];
    openSheet(`<b style="font-size:16px">${esc(r.dataset.prod)}</b><div class="list" style="margin-top:10px;max-height:60vh;overflow:auto">${h.map(e => `<a class="row" href="${coHref(e.c._key)}"><div class="m"><div class="t">${esc(e.c.name)}</div><div class="s">${niceDate(e.date)} · ${e.kind === "order" ? "order" : "quote · " + esc(e.status || "")} · ×${num(e.qty)}</div></div><b class="money">${gbp(e.price)}</b></a>`).join("") || '<div class="empty">No history.</div>'}</div>`); };
  draw();
});
function calculators(host) {
  const f = (id, label, val = "", extra = "") => `<div><label class="f">${label}</label><input class="f" id="${id}" type="number" inputmode="decimal" step="any" value="${val}" ${extra}></div>`;
  host.innerHTML = `
  <a class="card row" href="#/pack" style="display:flex;margin-top:8px"><span style="font-size:26px">🧮</span><div class="m"><b>Cost per pack</b><div class="small">Pack size → film width, metres per pack, packs per roll and £ per pack (roll price optional)</div></div><span class="chev">›</span></a>
  <div class="card"><b>📈 GP / margin checker</b><div class="two">${f("gpCost", "Cost £")}${f("gpSale", "Sale price £")}</div><div class="two">${f("gpTarget", "…or target GP %")}<div></div></div><div class="totals" id="gpOut"></div></div>
  <div class="card"><b>🧾 VAT</b><div class="two">${f("vatAmt", "Amount £")}${f("vatRate", "VAT %", defaultVatPct())}</div><div class="totals" id="vatOut"></div></div>
  <div class="card"><b>📏 Price per m² / spec converter</b><p class="small" style="margin:4px 0">Known roll → what a different size would cost at the same £/m².</p>
    <div class="two">${f("kLen", "Known length m", "1067")}${f("kWid", "Known width mm", "450")}</div><div class="two">${f("kPrice", "Known price £")}<div><label class="f">Known folded?</label><select class="f" id="kFold"><option value="1">No</option><option value="2">Yes (×2)</option></select></div></div>
    <div class="two">${f("dLen", "New length m", "1067")}${f("dWid", "New width mm", "500")}</div><div class="two"><div><label class="f">New folded?</label><select class="f" id="dFold"><option value="1">No</option><option value="2">Yes (×2)</option></select></div><div></div></div>
    <div class="totals" id="specOut"></div></div>
  <div class="card"><b>🎚 Thickness converter</b><div class="two">${f("thT", "Current µm", "19")}${f("thL", "Roll length m", "1067")}</div><div class="two">${f("thW", "Width mm", "450")}${f("thP", "Price £")}</div><div class="totals" id="thOut"></div></div>
  <div class="card"><b>🧻 Standard roll lengths</b><div class="kv" style="margin-top:6px"><b>25µm</b><span>800 m</span><b>19µm</b><span>1,067 m</span><b>15µm</b><span>1,332 m</span><b>12µm</b><span>1,667 m</span></div></div>`;
  const val = id => parseFloat(host.querySelector("#" + id).value);
  const row = (a, b, big) => `<div class="${big ? "gt" : ""}"><span>${a}</span><span>${b}</span></div>`;
  const calc = () => {
    const c = val("gpCost"), s = val("gpSale"), t = val("gpTarget"); let o = "";
    if (c > 0 && s > 0) o += row("GP", `${((s - c) / s * 100).toFixed(2)}%`, true) + row("Profit", gbp(s - c)) + row("Mark-up", `${((s - c) / c * 100).toFixed(1)}%`);
    if (c > 0 && t > 0 && t < 100) o += row(`Sell at for ${t}% GP`, gbp(c / (1 - t / 100)), !o);
    host.querySelector("#gpOut").innerHTML = o || '<span class="small">Enter a cost and a sale price (or a target GP).</span>';
    const a = val("vatAmt"), r = (val("vatRate") || 0) / 100;
    host.querySelector("#vatOut").innerHTML = a > 0 ? row("Add VAT", `${gbp(a)} + ${gbp(a * r)} = ${gbp(a * (1 + r))}`, true) + row("Remove VAT", `${gbp(a)} ÷ ${(1 + r).toFixed(2)} = ${gbp(a / (1 + r))} (VAT ${gbp(a - a / (1 + r))})`) : '<span class="small">Enter an amount.</span>';
    const kl = val("kLen"), kw = val("kWid") / 1000, kf = +host.querySelector("#kFold").value, kp = val("kPrice"), dl = val("dLen"), dw = val("dWid") / 1000, df = +host.querySelector("#dFold").value;
    if (kl > 0 && kw > 0 && kp > 0) { const sqm = kp / (kl * kw * kf); host.querySelector("#specOut").innerHTML = row("Price per m²", `£${sqm.toFixed(4)}`) + (dl > 0 && dw > 0 ? row("New roll price", gbp(sqm * dl * dw * df), true) : ""); }
    else host.querySelector("#specOut").innerHTML = '<span class="small">Enter the known roll\'s length, width and price.</span>';
    const tt = val("thT"), tl = val("thL"), tw = val("thW"), tp = val("thP");
    if (tt > 0 && tl > 0 && tw > 0 && tp > 0) { const per = tp / (tl * (tw / 1000) * tt);
      host.querySelector("#thOut").innerHTML = [12, 15, 19, 25, 38].map(t => row(`${t}µm${t === Math.round(tt) ? " (current)" : ""}`, gbp(per * tl * (tw / 1000) * t), t === Math.round(tt))).join(""); }
    else host.querySelector("#thOut").innerHTML = '<span class="small">Enter thickness, length, width and price.</span>';
  };
  host.querySelectorAll("input,select").forEach(i => i.addEventListener("input", calc));
  calc();
}

// ---------- SYNC ----------
route(/^#\/sync$/, () => {
  setHeader("Sync", null, "sync");
  const t = (SNAP && SNAP.tables) || {}, users = (SNAP && SNAP.users) || [];
  const byType = {}; for (const e of PENDING) byType[e.type] = (byType[e.type] || 0) + 1;
  const names = {note:"notes",action_new:"actions",action_done:"ticked off",meeting:"visits/meetings",contact_new:"contacts",company_new:"new companies",quote_new:"quotes",order_new:"orders",signoff:"signed sheets",photo:"photos"};
  const snapAge = SNAP && SNAP.exported_at ? ago(SNAP.exported_at) : "";
  $("#view").innerHTML = `${healthBanners()}
    <div class="card"><div style="display:flex;align-items:center;gap:10px"><span style="font-size:28px">⬆️</span><div><b>Send to the CRM</b><div class="small">${PENDING.length ? `${PENDING.length} item${PENDING.length === 1 ? "" : "s"}: ${Object.entries(byType).map(([k, n]) => `${n} ${names[k] || k}`).join(", ")}` : "Nothing waiting — all sent."}</div></div></div>
      <button class="btn block red" id="exportBtn" ${PENDING.length ? "" : "disabled"}>📤 Export changes${PENDING.length ? ` (${PENDING.length})` : ""}</button>
      <div class="small">Share to email / AirDrop / Drive / Files, then on the PC: <b>📱 Phone sync → Choose changes file</b>. Sending twice is harmless.${META.lastExport ? `<br>Last exported ${esc(ago(META.lastExport))}.` : ""}</div></div>
    <div class="card"><div style="display:flex;align-items:center;gap:10px"><span style="font-size:28px">⬇️</span><div><b>Load from the CRM</b><div class="small">${SNAP ? `Copy from ${esc(snapAge)} · ${(t.companies || []).length} companies · ${(t.people || []).length} contacts · ${(t.notes || []).length} notes` : "No CRM data yet."}</div></div></div>
      <button class="btn block green" id="importBtn">📥 Load snapshot from CRM</button>
      <div class="small">Anything the CRM has already imported clears from the list below automatically; the rest stays.</div></div>
    <h2>Waiting to send <span class="r small">${PENDING.length}</span></h2>
    <div class="list">${PENDING.slice().reverse().map(e => `<div class="row"><div class="m"><div class="t" style="white-space:normal">${esc(describe(e))}</div>
      <div class="s">${esc(e.company_name || "")} · ${esc(e.created_at.replace("T", " ").slice(0, 16))}</div></div><button class="btn sm sec" data-del="${esc(e.id)}" style="color:var(--red)">✕</button></div>`).join("") || '<div class="empty">Nothing.</div>'}</div>
    <h2>Settings</h2><div class="card">
      <label class="f">Who am I? (for "Mine")</label><select class="f" id="userSel"><option value="">${SNAP && SNAP.current_user ? esc(SNAP.current_user) + " (from CRM)" : "Not set – show everyone"}</option>${users.map(u => `<option ${META.user === u.name ? "selected" : ""}>${esc(u.name)}</option>`).join("")}</select>
      <label class="f">Device name (shown on the PC when importing)</label><input class="f" id="devName" value="${esc(META.device || "")}" placeholder="e.g. Dan's iPhone">
      <label class="f">Warn me when items haven't been sent for</label><select class="f" id="remSel">${[1, 2, 3, 7].map(d => `<option value="${d}" ${+META.remindDays === d ? "selected" : ""}>${d} day${d === 1 ? "" : "s"}</option>`).join("")}</select>
      <label class="f">Colours</label><select class="f" id="themeSel">${Object.entries(THEME_MODES).map(([k, n]) => `<option value="${k}" ${(META.theme || "pc") === k ? "selected" : ""}>${n}${k === "pc" ? ` (${SNAP && SNAP.theme === "dark" ? "dark" : "light"})` : ""}</option>`).join("")}</select>
      <a class="btn block sec" href="#/card" style="margin-top:14px">🪪 My business card (QR)</a>
      <p class="small" id="persist" style="margin-top:12px"></p><p class="small">App version 6 · data stays on this phone.</p></div>`;
  $("#exportBtn").onclick = exportChanges;
  $("#importBtn").onclick = pickSnapshot;
  $("#userSel").onchange = async e => { META.user = e.target.value; await saveMeta(); buildIndex(); toast("Saved"); };
  $("#devName").onchange = async e => { META.device = e.target.value.trim(); await saveMeta(); toast("Saved"); };
  $("#remSel").onchange = async e => { META.remindDays = +e.target.value; await saveMeta(); toast("Saved"); };
  $("#themeSel").onchange = async e => { META.theme = e.target.value; await saveMeta(); applyTheme(); };
  $("#view").querySelectorAll("[data-del]").forEach(b => b.onclick = async () => {
    const ev = PENDING.find(x => x.id === b.dataset.del);
    if (!ev || !confirm(`Delete this unsent item?\n\n${describe(ev).slice(0, 200)}`)) return;
    let gone = [ev.id];
    if (ev.type === "company_new") { const k = evCoKey(ev), deps = PENDING.filter(x => x !== ev && evCoKey(x) === k);
      if (deps.length && !confirm(`This also deletes ${deps.length} item(s) added to that new company. Continue?`)) return; gone = gone.concat(deps.map(x => x.id)); }
    if (ev.type === "action_new") { const aid = phoneActionId(ev); gone = gone.concat(PENDING.filter(x => x.type === "action_done" && x.data.action_id === aid).map(x => x.id)); }
    PENDING = PENDING.filter(x => !gone.includes(x.id)); await savePending(); render();
  });
  if (navigator.storage && navigator.storage.persisted) navigator.storage.persisted().then(p => { const el = $("#persist"); if (el) el.textContent = p ? "✓ iOS won't clear this app's data automatically." : "Tip: open the app from the Home Screen icon so iOS keeps its data safe."; });
});
