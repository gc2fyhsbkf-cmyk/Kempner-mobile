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
const TEMP_COL = {URGENT: "#e74c3c", WARM: "#f39c12", COLD: "#3498db", OK: "#27ae60", CONTACT: "#8e44ad", DEAD: "#7f8c8d"};
const TEMP_NAME = {URGENT: "Hot", WARM: "Warm", COLD: "Cold", OK: "OK", CONTACT: "To contact", DEAD: "Dead", NONE: "Not set"};
function listSub(c) { // [contact line, next-action badge html]
  const v = view(c._key) || {};
  const _gone = new Set(rows("people", c._key).filter(p => p.left_on).map(p => norm(p.name)));
  const cust = (v.customer && !_gone.has(norm(v.customer)) ? v.customer : "") || (mainContact(c._key) || {}).name;
  const open = openActions(c._key), over = open.filter(a => a.date && dayDiff(a.date) < 0);
  let badge = "";
  if (over.length) badge = `<span class="nb red">⚠ ${over.length}</span>`;
  else if (open.length) { const nd = Math.min(...open.map(a => dayDiff(a.date)));
    if (nd === 0) badge = '<span class="nb amber">⏰ today</span>'; else if (nd === 1) badge = '<span class="nb">tomorrow</span>'; else if (nd < 7) badge = `<span class="nb">${nd}d</span>`; }
  return [cust ? "👤 " + esc(cust) : "", badge];
}
function coRow(c, extraRight = "") {
  if (isQuiet(c)) return quietRow(c, extraRight);
  const pc = pend(c._key).length, [sub, badge] = listSub(c), st = companyStatus(c);
  const tags = rows("company_tags", c._key).slice(0, 3);
  return `<a class="row corow" href="${coHref(c._key)}" style="border-left:4px solid ${TEMP_COL[st] || "transparent"}">
    <div class="m"><div class="t2"><span class="nm">${c.pinned ? "⭐ " : ""}${esc(c.name)}${c._pending ? '<span class="badge">new</span>' : pc ? `<span class="badge">${pc}</span>` : ""}</span>${badge}</div>
    ${sub || tags.length ? `<div class="s">${sub}${tags.length ? `${sub ? "  ·  " : ""}${tags.map(t => esc(t.tag)).join(", ")}` : ""}</div>` : ""}</div>
    ${extraRight}</a>`;
}
function quietRow(c, extraRight = "") { // Lobby leads: no score, no warnings — what it is and why it's worth a try
  const li = leadInfo(c), pc = pend(c._key).length, seg = segOf(c);
  const sub = [coQuery ? seg : "", li.town, li.why].filter(Boolean).join("  ·  ");
  return `<a class="row" href="${coHref(c._key)}"><span class="score na" style="border-width:1px;font-size:15px">${seg === LOBBY ? "🛋" : "•"}</span>
    <div class="m"><div class="t">${esc(c.name)}${c._pending ? '<span class="badge">new</span>' : pc ? `<span class="badge">${pc}</span>` : ""}</div>
    <div class="s">${esc(sub || li.sector || "prospect")}</div></div>${extraRight}</a>`;
}
function actionRow(c, a, showCo = true) {
  return `<div class="row ${a._pending || a._moved ? "pend" : ""}">
    <button class="done" data-done="${esc(c._key)}|${esc(a.id)}" aria-label="Mark done">${ICON("check", 17, 2.6)}</button>
    <a class="m" href="${coHref(c._key)}" style="color:inherit"><div class="t" style="white-space:normal">${a.pinned ? "📌 " : ""}${a.tier == 1 ? "⭐ " : ""}${esc(a.note)}</div>
    <div class="s"><span class="${dueClass(a.date)}">${niceDate(a.date) || "No date"}${a.time ? " " + esc(a.time) : ""}</span>${showCo ? " · " + esc(c.name) : ""}${a.channel ? " · " + esc(a.channel) : ""}${a._pending ? " · not synced" : a._moved ? " · moved, not synced" : ""}</div></a>
    <button class="push" data-push="${esc(c._key)}|${esc(a.id)}" aria-label="Reschedule">${ICON("clock", 17)}</button></div>`;
}
// ⏭ push / reschedule an action
document.addEventListener("click", e => { const b = e.target.closest("[data-push]"); if (!b) return; e.preventDefault(); e.stopPropagation();
  const [k, id] = b.dataset.push.split("|"); pushSheet(k, id); });
function moveAllSheet(list) {
  openSheet(`<b style="font-size:17px">⏭ Move all overdue</b><div class="small" style="margin:4px 0 8px">Untick any you want to keep where they are.</div>
    <div class="list" style="max-height:34vh;overflow:auto">${list.map(([c, a], i) => `<label class="row" style="gap:10px"><input type="checkbox" data-mi="${i}" checked style="transform:scale(1.3)"><div class="m"><div class="t" style="font-size:14px">${esc(a.note)}</div><div class="s">${esc(c.name)} · ${esc(niceDate(a.date))}</div></div></label>`).join("")}</div>
    ${moveGrid(true)}`, el => {
    el.querySelectorAll("[data-to]").forEach(b => b.onclick = async () => {
      b.dataset.to = weekendCheck(b.dataset.to);
      const picked = [...el.querySelectorAll("[data-mi]")].filter(x => x.checked).map(x => list[+x.dataset.mi]);
      if (!picked.length) return toast("Nothing ticked");
      for (const [c, a] of picked) {
        if (a._pending) a._pending.data.date = b.dataset.to;
        else await addEvent("action_move", c._key, {action_id: a.id, action_note: a.note, date: b.dataset.to, time: a.time || "", old_date: a.date || "", reason: "moved in bulk from the phone"});
      }
      await savePending(); closeSheet(); toast(`Moved ${picked.length} to ${niceDate(b.dataset.to)}`); render(); });
  });
}
// the same date buttons as the PC's 📅 Move picker
function moveChoices(showToday = true) {
  const d0 = new Date(), add = n => { const d = new Date(d0); d.setDate(d.getDate() + n); return localDate(d); };
  const plusMonth = () => { const d = new Date(d0); d.setMonth(d.getMonth() + 1); return localDate(d); };
  const mon = new Date(d0); mon.setDate(mon.getDate() + ((8 - mon.getDay()) % 7 || 7));
  const nw = ["Mon", "Tue", "Wed", "Thu", "Fri"].map((l, i) => { const d = new Date(mon); d.setDate(d.getDate() + i); return [l, localDate(d)]; });
  return {soon: (showToday ? [["Today", add(0)]] : []).concat([["Tomorrow", add(1)], ["+2 days", add(2)], ["+3 days", add(3)], ["+4 days", add(4)]]),
          later: [["+1 week", add(7)], ["+2 weeks", add(14)], ["+1 month", plusMonth()]], next: nw};
}
const isWeekend = ds => { const d = new Date(ds + "T12:00:00").getDay(); return d === 0 || d === 6; };
function moveGrid(showToday = true) {
  const ch = moveChoices(showToday), btn = ([l, d]) => `<button class="fchip mvb ${isWeekend(d) ? "wk" : ""}" data-to="${d}">${l}<br><span class="small">${esc(niceDate(d))}${isWeekend(d) ? " ⚠" : ""}</span></button>`;
  return `<div class="mvh">SOON</div><div class="qgrid mv5">${ch.soon.map(btn).join("")}</div>
    <div class="mvh">LATER</div><div class="qgrid mv5">${ch.later.map(btn).join("")}</div>
    <div class="mvh">NEXT WEEK</div><div class="qgrid mv5">${ch.next.map(btn).join("")}</div>`;
}
function weekendCheck(date) { // a Saturday/Sunday asks first, offering the Monday instead
  if (!isWeekend(date)) return date;
  const d = new Date(date + "T12:00:00"), mon = new Date(d); mon.setDate(d.getDate() + (d.getDay() === 6 ? 2 : 1));
  return confirm(`${niceDate(date)} is a weekend.\n\nOK = keep it on the weekend\nCancel = use Monday ${niceDate(localDate(mon))} instead`) ? date : localDate(mon);
}
function nextMonday() { const d = new Date(); d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7)); return localDate(d); }
function pushSheet(key, aid) {
  const c = IDX.co.get(key), a = actions(key).find(x => x.id === aid); if (!c || !a) return toast("Action not found");
  openSheet(`<b style="font-size:17px">⏭ Move this action</b>
    <div class="card" style="margin-top:8px"><div class="small">${niceDate(a.date) || "No date"}${a.time ? " " + esc(a.time) : ""} · ${esc(c.name)}</div><div style="font-weight:650">${esc(a.note)}</div></div>
    ${moveGrid(true)}
    <div class="two"><div><label class="f">Or pick a date</label><input class="f" type="date" id="pDate" value="${esc(a.date && dayDiff(a.date) > 0 ? a.date : nextWorkday(1))}"></div>
      <div><label class="f">Time (optional)</label><input class="f" type="time" id="pTime" value="${esc(a.time || "")}"></div></div>
    <label class="f">Why? (optional)</label><input class="f" id="pWhy" placeholder="e.g. They're away until Monday">
    <button class="btn block" id="pGo" style="margin-top:12px">Move it</button>
    <button class="btn block sec" id="pPin" style="margin-top:8px">${a.pinned ? "Unpin it" : "📌 Pin it to the top of Today"}</button>`, el => {
    el.querySelector("#pPin").onclick = async () => {
      if (a._pending) { a._pending.data.pinned = a.pinned ? 0 : 1; await savePending(); }
      else await addEvent("action_pin", key, {action_id: a.id, action_note: a.note, pinned: a.pinned ? 0 : 1});
      closeSheet(); toast(a.pinned ? "Unpinned" : "📌 Pinned"); render(); };
    const move = async date => { if (!date) return toast("Pick a date");
      const time = el.querySelector("#pTime").value, reason = el.querySelector("#pWhy").value.trim();
      if (a._pending) { a._pending.data.date = date; a._pending.data.time = time; await savePending(); }   // not synced yet: just change it
      else await addEvent("action_move", key, {action_id: a.id, action_note: a.note, date, time, old_date: a.date || "", reason});
      closeSheet(); toast(`Moved to ${niceDate(date)}`); render(); };
    el.querySelectorAll("[data-to]").forEach(b => b.onclick = () => move(weekendCheck(b.dataset.to)));
    el.querySelector("#pGo").onclick = () => move(el.querySelector("#pDate").value);
  });
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
  // 📌 pinned actions (pin them on the PC before you head out) sit up top in full; everything else is tidied away below
  const pinned = [], over = [], due = [], soon = [], later = [];
  for (const k of keys) for (const a of openActions(k)) {
    const c = IDX.co.get(k), dd = a.date ? dayDiff(a.date) : null;
    if (a.pinned) { pinned.push([c, a]); continue; }
    if (dd == null) later.push([c, a]); else if (dd < 0) over.push([c, a]); else if (dd === 0) due.push([c, a]); else if (dd <= 7) soon.push([c, a]); else later.push([c, a]);
  }
  const byDate = (x, y) => ((x[1].date || "9") + (x[1].time || "")).localeCompare((y[1].date || "9") + (y[1].time || "")) || (x[1].tier || 2) - (y[1].tier || 2);
  [pinned, over, due, soon, later].forEach(l => l.sort(byDate));
  const mt = [];
  for (const k of keys) for (const m of meetings(k)) if (m.status !== "DONE" && m.date >= today && dayDiff(m.date) <= 7) mt.push([IDX.co.get(k), m]);
  mt.sort((x, y) => (x[1].date + (x[1].time || "")).localeCompare(y[1].date + (y[1].time || "")));
  const hr = new Date().getHours(), who = (META.user || (SNAP && SNAP.current_user) || "").split(" ")[0];
  const h = [];
  h.push(`<div style="margin:6px 4px 14px"><div style="font-size:29px;font-weight:800;letter-spacing:-.025em;line-height:1.1">${hr < 12 ? "Good morning" : hr < 18 ? "Good afternoon" : "Good evening"}${who ? ", " + esc(who) : ""}</div>
    <div class="small">${DOW[new Date().getDay()]} ${new Date().getDate()} ${MON[new Date().getMonth()]} · ${cos.length} ${META.filter === "all" ? "companies" : "of your companies"}</div></div>`);
  h.push(healthBanners());
  h.push(`<div id="nearStop"></div>`);
  const BUCKETS = {over: ["⚠ Overdue", over], due: ["⏰ Today", due], soon: ["📅 This week", soon], all: ["All", over.concat(due, soon, later)]};
  let tab = META.todayTab && BUCKETS[META.todayTab] ? META.todayTab : (due.length ? "due" : over.length ? "over" : "soon");
  h.push(`<div class="stiles">
    <a class="st" style="--k:#e11d2e" href="#" data-tt="over"><b>${over.length}</b><span>Overdue</span></a>
    <a class="st" style="--k:#d97706" href="#" data-tt="due"><b>${due.length}</b><span>Due today</span></a>
    <a class="st" style="--k:#2563eb" href="#today-mt"><b>${mt.length}</b><span>Meetings</span></a>
    <a class="st" style="--k:#92400e" href="#today-pin"><b>${pinned.length}</b><span>Pinned</span></a></div>`);
  h.push(todayPlanCard());
  h.push(`<h2 id="today-pin">Pinned <span class="r small">${pinned.length}</span></h2>${pinned.length ? `<div class="list">${pinned.map(([c, a]) => actionRow(c, a)).join("")}</div>`
    : `<div class="card small">Pin the actions you want in front of you (📌 on the PC, or ⏭ → Pin here) and they'll sit at the top. Everything else is still below, just tucked away.</div>`}`);
  if (mt.length) h.push(`<h2 id="today-mt">Meetings · next 7 days</h2><div class="list">${mt.map(([c, m]) => {
    const addr = rows("addresses", c._key)[0];
    return `<div class="row ${m._pending ? "pend" : ""}"><div style="text-align:center;min-width:44px"><div style="font-size:11px;font-weight:800;color:var(--red)">${esc(niceDate(m.date).split(" ")[0].toUpperCase())}</div><div style="font-weight:800">${esc(m.time || "—")}</div></div>
      <a class="m" href="${coHref(c._key)}" style="color:inherit"><div class="t">${MEETING_ICON[m.meeting_type || ""] || "🤝"} ${esc(c.name)}</div><div class="s">${esc(niceDate(m.date))}${m.location ? " · " + esc(m.location) : ""}${m.meeting_type ? " · " + esc(MEETING_TYPES[m.meeting_type] || m.meeting_type) : ""}</div></a>
      ${addr ? `<a class="btn sm sec" href="${navUrl((addr.lines || "").replace(/\n/g, ", "))}">🧭</a>` : ""}</div>`; }).join("")}</div>`);
  h.push(`<h2 id="today-acts">Actions <span class="r small">${over.length + due.length + soon.length + later.length}</span></h2>
    <div class="seg" id="tTabs" style="margin-top:0">${Object.entries(BUCKETS).map(([k, [l, list]]) => `<button data-tb="${k}" class="${k === tab ? "on" : ""}">${l} <span class="muted">${list.length}</span></button>`).join("")}</div>
    <div id="tBody"></div>`);
  const drawBucket = () => {
    const list = BUCKETS[tab][1], cap = META.todayAll ? 1e9 : 8, groups = new Map();
    for (const [c, a] of list) { if (!groups.has(c._key)) groups.set(c._key, {c, acts: []}); groups.get(c._key).acts.push(a); }
    let shown = 0, html = "";
    for (const {c, acts} of groups.values()) { if (shown >= cap) break;
      const take = acts.slice(0, Math.max(1, cap - shown)); shown += take.length;
      html += `<div class="cgrp"><a class="cgh" href="${coHref(c._key)}">${esc(c.name)}${acts.length > 1 ? ` <span class="chip" style="font-size:10.5px;padding:0 6px">${acts.length}</span>` : ""}<span class="chev">›</span></a>
        ${take.map(a => `<div class="crow ${a._pending || a._moved ? "pend" : ""}"><button class="cdone" data-done="${esc(c._key)}|${esc(a.id)}" aria-label="Done">✓</button>
          <div class="ct">${a.tier == 1 ? "⭐ " : ""}${esc(a.note)}</div><span class="cd ${dueClass(a.date)}">${a.date ? esc(niceDate(a.date).replace(/^\w+ /, "")) : "no date"}</span>
          <button class="cpush" data-push="${esc(c._key)}|${esc(a.id)}" aria-label="Move">⏭</button></div>`).join("")}</div>`; }
    $("#tBody").innerHTML = (tab === "over" && over.length ? `<button class="btn sm sec" id="moveAll" style="margin:8px 0 2px">⏭ Move all overdue…</button>` : "")
      + `<div class="list" style="margin-top:6px">${html || `<div class="empty">${tab === "over" ? "Nothing overdue 🎉" : "Nothing here."}</div>`}</div>`
      + (list.length > shown ? `<button class="btn sec block" id="tMore">Show all ${list.length}</button>` : META.todayAll && list.length > 8 ? `<button class="btn sec block" id="tLess">Show fewer</button>` : "");
    const mv = $("#moveAll"); if (mv) mv.onclick = () => moveAllSheet(over);
    const more = $("#tMore"); if (more) more.onclick = () => { META.todayAll = true; saveMeta(); drawBucket(); };
    const less = $("#tLess"); if (less) less.onclick = () => { META.todayAll = false; saveMeta(); drawBucket(); };
  };
  // CRM's own Today-page lists
  const mine = new Set(keys);
  const reo = ((SNAP && SNAP.today && SNAP.today.reorder_digest) || []).filter(r => mine.has(String(r.company_id))).slice(0, 12);
  if (reo.length) h.push(`<h2>Film reorders to chase</h2><div class="list">${reo.map(r => {
    const st = r.state === "overdue" ? ["c-red", "Overdue"] : r.at_risk ? ["c-red", "At risk"] : r.state === "due" ? ["c-amber", "Due"] : ["c-blue", "Soon"];
    const dd = r.days_until == null ? "" : r.days_until < 0 ? `${-r.days_until}d late` : `in ${r.days_until}d`;
    return `<a class="row" href="${coHref(r.company_id)}"><div class="m"><div class="t">${esc(r.company)}</div><div class="s">${esc(r.film_name || "")}${r.last_order ? " · last " + esc(niceDate(r.last_order)) : ""}</div></div>
      <span class="chip ${st[0]}">${st[1]}${dd ? " · " + dd : ""}</span></a>`; }).join("")}</div>`);
  const na = ((SNAP && SNAP.today && SNAP.today.needs_attention) || []).filter(r => mine.has(String(r.company_id))).slice(0, 10);
  const FL = {high_value_cold: "High value · cold", overdue_action: "Dropped follow-up", nothing_scheduled: "Nothing planned", cold: "Gone cold"};
  if (na.length) h.push(`<h2>Needs a nudge</h2><div class="list">${na.map(r => `<a class="row" href="${coHref(r.company_id)}"><div class="m"><div class="t">${esc(r.company)}</div>
      <div class="s">${(r.flags || []).map(f => FL[f] || f).join(" · ")}${r.days_silent != null ? ` · ${r.days_silent} days silent` : ""}</div></div><span class="chev">›</span></a>`).join("")}</div>`);
  v.innerHTML = h.join("");
  drawBucket();
  const setTab = t => { tab = t; META.todayTab = t; saveMeta(); document.querySelectorAll("#tTabs button").forEach(b => b.classList.toggle("on", b.dataset.tb === t)); drawBucket(); };
  v.querySelectorAll("[data-tb]").forEach(b => b.onclick = () => setTab(b.dataset.tb));
  v.querySelectorAll("[data-tt]").forEach(a => a.onclick = e => { e.preventDefault(); setTab(a.dataset.tt); document.getElementById("today-acts").scrollIntoView({behavior: "smooth", block: "start"}); });
  v.querySelectorAll('a[href^="#today-"]').forEach(a => a.onclick = e => { e.preventDefault(); const t = document.getElementById(a.getAttribute("href").slice(1)); if (t) t.scrollIntoView({behavior: "smooth", block: "start"}); });
  showFab(() => quickAddSheet(null));
  nearStopCheck();
});

// ---------- COMPANIES ----------
let coQuery = "", coLimit = 80, coStatus = "";
route(/^#\/companies$/, () => {
  setHeader("Customers", null, "companies");
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
      <select class="fchip" id="sortSel">${[["az","A–Z"],["due","Most overdue"],["score","Health score"],["recent","Recently updated"],["added","Newest added"]].map(([k, l]) => `<option value="${k}" ${META.sort === k ? "selected" : ""}>${l}</option>`).join("")}</select>
      <select class="fchip" id="addSel">${[["","🆕 Added: any time"],["week","🆕 This week"],["lastweek","🆕 Last week"],["30","🆕 Last 30 days"]].map(([k, l]) => `<option value="${k}" ${coAdded === k ? "selected" : ""}>${l}</option>`).join("")}</select>
    </div><div id="coBody"></div>`;
  const q = $("#q"); q.oninput = () => { coQuery = q.value; coLimit = 80; coBody(); };
  v.querySelectorAll("[data-f]").forEach(b => b.onclick = async () => { META.filter = b.dataset.f; await saveMeta(); render(); });
  v.querySelectorAll("[data-seg]").forEach(b => b.onclick = async () => { META.seg = b.dataset.seg; await saveMeta(); render(); });
  $("#stSel").onchange = e => { coStatus = e.target.value; coBody(); };
  $("#sortSel").onchange = async e => { META.sort = e.target.value; await saveMeta(); coBody(); };
  $("#addSel").onchange = e => { coAdded = e.target.value; coBody(); };
  coBody();
});
function coBody() {
  let list = scope();
  if (coStatus) list = list.filter(c => companyStatus(c) === coStatus);
  if (coAdded) { const r = addedRange(coAdded); list = list.filter(c => { const d = addedOn(c); return d && d >= r[0] && d < r[1]; }); }
  const q = coQuery.trim().toLowerCase();
  if (!q) list = list.filter(c => segOf(c) === (META.seg || ""));  // a search looks across every tab
  let noteHits = new Map();
  if (q) { const qd = digits(q), terms = q.split(/\s+/), all = list;
    list = all.filter(c => { const h = haystack(c); return terms.every(t => h.includes(t)) || (qd.length >= 4 && h.includes(qd)); });
    // …and inside their notes (3+ letters), shown underneath with the matching bit
    if (q.length >= 3) { const named = new Set(list.map(c => c._key));
      for (const c of all) { if (named.has(c._key)) continue; const hit = notes(c._key).find(n => terms.every(t => String(n.content || "").toLowerCase().includes(t)));
        if (hit) noteHits.set(c._key, {c, n: hit}); if (noteHits.size >= 40) break; } } }
  const overdue = c => openActions(c._key).filter(a => a.date && dayDiff(a.date) < 0).length;
  const sorters = {
    az: (a, b) => (b.pinned || 0) - (a.pinned || 0) || a.name.localeCompare(b.name),
    due: (a, b) => overdue(b) - overdue(a) || a.name.localeCompare(b.name),
    score: (a, b) => ((view(a._key) || {}).score ?? 50) - ((view(b._key) || {}).score ?? 50),
    recent: (a, b) => String(b.updated_at || "").localeCompare(String(a.updated_at || "")),
    added: (a, b) => addedOn(b).localeCompare(addedOn(a)),
  };
  list.sort(q ? ((a, b) => (b.name.toLowerCase().startsWith(q)) - (a.name.toLowerCase().startsWith(q)) || a.name.localeCompare(b.name)) : (sorters[META.sort] || sorters.az));
  const lobbyHint = !q && META.seg === LOBBY ? `<div class="small" style="margin:6px 4px">Leads to try. No reminders or health scores here; open one and tap <b>⬆ Promote</b> once they're a real customer.</div>` : "";
  const snip = (txt, t) => { const s = String(txt || ""), i = s.toLowerCase().indexOf(t); const a = Math.max(0, i - 30);
    return (a ? "…" : "") + esc(s.slice(a, i)) + "<b>" + esc(s.slice(i, i + t.length)) + "</b>" + esc(s.slice(i + t.length, i + t.length + 50)) + "…"; };
  let numHits = "";
  if (q && digits(q).length >= 5) { const qd = digits(q), hits = [];
    for (const c of scope()) { for (const p of people(c._key)) for (const nb of p.numbers) if (digits(nb.number).includes(qd)) hits.push({c, p, nb}); if (hits.length >= 3) break; }
    numHits = hits.map(h => `<a class="banner soft" href="#/snap/${encodeURIComponent(h.c._key)}" style="margin:8px 0 0">📞 <span><b>${esc(h.nb.number)}</b> is <b>${esc(h.p.name)}</b> at ${esc(h.c.name)}</span><span class="chev">›</span></a>`).join(""); }
  $("#coBody").innerHTML = `${numHits}${lobbyHint}<h2>${list.length} ${list.length === 1 ? "company" : "companies"}</h2>
    <div class="list">${list.slice(0, coLimit).map(c => coRow(c)).join("") || (noteHits.size ? "" : '<div class="empty">Nothing matches.</div>')}</div>
    ${noteHits.size ? `<h2>📝 In their notes <span class="r small">${noteHits.size}</span></h2><div class="list">${[...noteHits.values()].map(({c, n}) => `<a class="row" href="${coHref(c._key)}/notes"><div class="m"><div class="t">${esc(c.name)}</div>
      <div class="s" style="white-space:normal">${niceDate(n.date)} · ${snip(n.content, q.split(/\s+/)[0])}</div></div><span class="chev">›</span></a>`).join("")}</div>` : ""}
    ${list.length > coLimit ? `<button class="btn sec block" id="more">Show ${Math.min(200, list.length - coLimit)} more</button>` : ""}`;
  const m = $("#more"); if (m) m.onclick = () => { coLimit += 200; coBody(); };
}

// 🆕 when a company was added (phone-made ones count from when you made them)
let coAdded = "";
const addedOn = c => String(c._pending ? (c.updated_at || "") : (c.created_at || "")).slice(0, 10);
function addedRange(k) {
  const t = new Date(), day = 864e5, d0 = new Date(t.getFullYear(), t.getMonth(), t.getDate()), mon = new Date(d0 - ((d0.getDay() + 6) % 7) * day), tom = new Date(+d0 + day);
  if (k === "week") return [localDate(mon), localDate(tom)];
  if (k === "lastweek") return [localDate(new Date(mon - 7 * day)), localDate(mon)];
  return [localDate(new Date(d0 - 29 * day)), localDate(tom)];
}
// 🔧 one machine on a customer's Equipment tab: quiet facts, service, spares, videos, data sheet
function machineItem(key, e) {
  const isFilm = e.machine_type === "film", sheet = machineSheet(e.name) || {};
  const svc = rows("equipment_services", key).filter(x => String(x.equipment_id) === String(e.id)).sort((a, b) => String(b.service_date).localeCompare(String(a.service_date)));
  const svcP = pend(key, "equipment_service").filter(x => String(x.data.equipment_id) === String(e.id));
  const sp = rows("equipment_spares", key).filter(x => String(x.equipment_id) === String(e.id));
  const spP = pend(key, "equipment_spare").filter(x => String(x.data.equipment_id) === String(e.id));
  const spLast = new Map(); for (const x of sp.concat(spP.map(p => ({name: p.data.name, order_date: p.data.date, quantity: p.data.quantity, _p: 1})))) {
    const k = String(x.name).toLowerCase(); if (!spLast.has(k) || String(x.order_date) > String(spLast.get(k).order_date)) spLast.set(k, x); }
  const inst = e.install_date || "", age = inst ? (/^\d{4}$/.test(inst) ? `c. ${inst}` : `${niceDate(inst)}`) : "";
  const lastSvc = svcP.length ? svcP[svcP.length - 1].data.date : (svc[0] || {}).service_date;
  const facts = [age && "installed " + age, e.serial_no && "S/N " + e.serial_no, lastSvc && "last serviced " + niceDate(lastSvc),
    e.warranty_end && e.warranty_end >= localDate() && "warranty to " + niceDate(e.warranty_end),
    (sheet.cap_max_roll_carriage_mm || sheet.cap_max_width) && `max roll ${num(sheet.cap_max_roll_carriage_mm || sheet.cap_max_width)}mm`,
    sheet.cap_cycles_per_min && `${num(sheet.cap_cycles_per_min)}/min`, e.condition].filter(Boolean);
  const vids = ((SNAP && SNAP.videos) || []).concat(META.videos || []).filter(v => { const nm = String(e.name + " " + (e.machine_type || "")).toLowerCase().replace(/[^a-z0-9]/g, "");
    return String(v.tags || "").split(",").map(t => t.toLowerCase().replace(/[^a-z0-9]/g, "")).some(t => t && nm.includes(t)); });
  const k = encodeURIComponent(key);
  return `<div class="item"><b>${esc(e.name)}</b>${e.quantity > 1 ? ` ×${esc(e.quantity)}` : ""}
    <span class="chip">${isFilm ? "🎞 film" : "⚙ machine"}</span>${e.is_ours ? '<span class="chip c-green">ours</span>' : '<span class="chip">theirs</span>'}
    ${e.manufacturer ? `<div class="small">${esc(e.manufacturer)}</div>` : ""}
    ${facts.length ? `<div class="small" style="color:var(--sub)">${facts.map(esc).join(" · ")}</div>` : ""}
    ${svcP.length ? `<div class="small">🔧 ${svcP.map(p => niceDate(p.data.date)).join(", ")} ${pendBadge({_pending: 1})}</div>` : ""}
    ${spLast.size ? `<div class="small">🔩 ${[...spLast.values()].slice(0, 4).map(x => `${esc(x.name)} — ${niceDate(x.order_date)} (×${num(x.quantity)})${x._p ? " ⏳" : ""}`).join(" · ")}</div>` : ""}
    ${e.notes ? `<div class="small">${esc(e.notes)}</div>` : ""}${e.fit_notes ? `<div class="small">${esc(e.fit_notes)}</div>` : ""}
    ${vids.length ? `<div style="margin-top:6px">${vids.slice(0, 3).map(v => `<button class="btn sm sec" style="font-size:12px;padding:4px 9px;margin:2px 4px 2px 0" data-vid="${esc(v.phone_id || (String(v.id).startsWith("pv") ? v.id : "pc" + v.id))}">▶ ${esc(v.title)}</button>`).join("")}</div>` : ""}
    ${!isFilm && e.id ? `<div style="display:flex;gap:6px;margin-top:8px"><a class="btn sm sec" href="#/svc/${k}/${esc(e.id)}">🔧 Log a service</a><a class="btn sm sec" href="#/spare/${k}/${esc(e.id)}">🔩 Log spares</a></div>` : ""}</div>`;
}
document.addEventListener("click", e => { const b = e.target.closest("[data-vid]"); if (!b || typeof playVideo !== "function") return;
  e.preventDefault(); refreshVidHave().then(() => playVideo(videoList().find(v => v.key === b.dataset.vid || "pc" + v.id === b.dataset.vid))); });

// ---------- COMPANY ----------
const coTab = {};
route(/^#\/c\/([^/]+)(?:\/(\w+))?$/, (key, tabArg) => {
  const c = IDX.co.get(key);
  if (!c) { toast("Company not found"); return go("#/companies"); }
  if (tabArg) coTab[key] = tabArg;
  META.recent = [key].concat((META.recent || []).filter(k => k !== key)).slice(0, 8); saveMeta();
  const tab = coTab[key] || "overview";
  setHeader(c.name, "#/companies", "companies");
  const v = view(key) || {}, mc = mainContact(key), addr = rows("addresses", key)[0], st = companyStatus(c);
  const acts = actions(key), open = openActions(key), nts = notes(key), mts = meetings(key), ppl = people(key);
  const qg = pendingGroups(key, "quote_new").concat(v.quote_groups || []), og = pendingGroups(key, "order_new").concat(v.order_groups || []);
  const eq = rows("owned_equipment", key), specs = rows("company_known_film_specs", key), files = (IDX.files.get(String(c.id)) || []).concat(pend(key).filter(e => e.type === "photo" || e.type === "signoff"));
  const over = open.filter(a => a.date && dayDiff(a.date) < 0).length;
  const mapsQ = addr ? encodeURIComponent((addr.lines || "").replace(/\n/g, ", ")) : "";
  const h = [];
  const tcol = TEMP_COL[st] || "#94a3b8";
  const qbtn = (on, href, icon, label, extra = "", cls = "") => `<a class="${on ? "" : "off"} ${cls}" href="${href}" ${extra}><span class="qi">${ICON(icon, 21)}</span>${label}</a>`;
  h.push(`<div class="cohead hero ${c._pending ? "pend" : ""}">
    <div class="hrow">
      <span class="coav" style="background:linear-gradient(145deg,${tcol},${tcol}cc)">${esc(initials(c.name))}</span>
      <div class="hmain"><div class="nm">${esc(c.name)}${c._pending ? '<span class="badge">new – not synced</span>' : ""}</div>
        <div class="hsub">${mc ? `${esc(mc.name)}${mc.role ? " · " + esc(mc.role) : ""}` : "No main contact yet"}${c.region ? ` · ${esc(c.region)}` : ""}</div></div>
      ${v.score != null && !isQuiet(c) ? `<span class="score ${scoreCls(v.score)}" title="Health score">${esc(v.score)}</span>` : ""}</div>
    ${segOf(c) ? (li => `<div class="banner soft" style="margin:12px 0 0;display:flex;align-items:center;gap:8px"><span>${segOf(c) === LOBBY ? "🛋" : "🗂"} In the <b>${esc(segOf(c))}</b>${li.why ? ` · ${esc(li.why)}` : ""}${pend(key, "segment_set").length ? " · change not synced" : ""}</span><button class="btn sm green" id="promoteBtn" style="margin-left:auto;flex:none">⬆ Promote</button></div>`)(leadInfo(c)) : ""}
    <div class="tchips" id="tchips">${["URGENT", "WARM", "OK", "COLD", "CONTACT", "DEAD", "NONE"].map(x => { const col = TEMP_COL[x] || "#9aa3af";
      return `<button data-temp="${x}" class="${x === st ? "on" : ""}" style="--tc:${col}"><i></i>${TEMP_NAME[x]}</button>`; }).join("")}</div>
    <div class="facts">
      <div><span>Last contact</span><b>${esc((m => m ? m[1] : (v.last_contact || "—"))(String(v.last_contact || "").match(/\(([^)]+)\)/)))}</b></div>
      <div><span>Stage</span><b>${esc(c.pipeline_stage || "Prospect")}</b></div>
      ${v.rate ? `<div><span>Film use</span><b class="t-green">${esc(String(v.rate.text).replace(/^≈\s*/, "≈").replace(/\s*rolls?\/yr/, "/yr"))}</b></div>` : v.reorder ? `<div><span>Film</span><b>${esc(v.reorder.text)}</b></div>` : `<div><span>Owner</span><b>${esc(v.owners || "—")}</b></div>`}
    </div>
    ${v.reorder && v.rate ? `<div style="margin-top:8px"><span class="chip c-${esc(v.reorder.tone === "sub" ? "" : v.reorder.tone)}">${esc(v.reorder.text)}</span>${v.owners ? `<span class="chip">🧑‍💼 ${esc(v.owners)}</span>` : ""}</div>` : ""}
    <div class="qa">
      ${qbtn(mc && dialable(mc.number), `tel:${esc(digits(mc && mc.number))}`, "phone", "Call", `data-call="${esc(key)}" data-num="${esc(mc && mc.number || "")}"`)}
      ${qbtn(mc && dialable(mc.number), `sms:${esc(digits(mc && mc.number))}`, "msg", "Text")}
      ${qbtn(mc && mc.email, `mailto:${esc(mc && mc.email || "")}`, "mail", "Email")}
      ${qbtn(addr, navUrl(addr ? (addr.lines || "").replace(/\n/g, ", ") : ""), "nav", "Go")}
      ${qbtn(true, `#/snap/${encodeURIComponent(key)}`, "zap", "Snapshot", "", "hot")}
      ${qbtn(true, `#/brief/${encodeURIComponent(key)}`, "brief", "Brief")}</div></div>`);
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
    const qp = e.target.closest("[data-qpdf]"); if (qp) { quotePdfSheet(key, qp.dataset.qpdf); return; }
    const qr = e.target.closest("[data-qrec]"); if (qr) { openQuoteRecord(key, qr.dataset.qrec); return; }
    const pb = e.target.closest("[data-pdf]"); if (pb) { const ev = PENDING.find(x => x.id === pb.dataset.pdf); if (ev) sharePdf(ev.data.pdf_b64, ev.data.filename); return; }
    const ph = e.target.closest("[data-photo]"); if (ph) { const ev = PENDING.find(x => x.id === ph.dataset.photo); if (ev) showPhoto(ev); return; }
    const ics = e.target.closest("[data-ics]"); if (ics) { const [kind, id] = ics.dataset.ics.split("|"); addToCalendar(key, kind, id); return; }
  };
  $("#tchips").onclick = async e => { const b = e.target.closest("[data-temp]"); if (!b || b.dataset.temp === st) return;
    await addEvent("temperature", key, {status: b.dataset.temp}); toast(`🌡 ${TEMP_NAME[b.dataset.temp]} — the PC updates at the next sync`); render(); };
  const pb = $("#promoteBtn"); if (pb) pb.onclick = async () => {
    if (!confirm(`Promote ${c.name} to your main list?`)) return;
    await addEvent("segment_set", key, {segment: ""}); toast("Promoted — the PC updates at the next sync"); render(); };
  renderTab(tab);
});
function notesHtml(list, n) {
  return list.slice(0, n).map(x => `<div class="item fl-${esc(x.status_prefix || "")} ${x._pending ? "pend" : ""}">
    <div class="meta"><b>${niceDate(x.date)}</b> ${esc(x.time || "")}${x.customer_name ? " · 👤 " + esc(x.customer_name) : ""}${x.reference ? ` <span class="chip" style="font-size:10.5px;padding:1px 7px">${esc(x.reference)}</span>` : ""} ${FLAG_EMOJI[x.status_prefix] || ""} ${pendBadge(x)}</div>
    <div class="body">${esc(x.content)}</div>${x._pending && x._pending.type === "note" ? `<button class="btn sm sec" data-editn="${esc(x._pending.id)}" style="margin-top:6px;font-size:12px;padding:4px 10px">✏️ Edit</button>` : ""}
    ${x._pdf ? `<button class="btn sm sec" style="margin-top:8px" data-pdf="${esc(x._pdf)}">📄 View / share PDF</button>` : ""}
    ${x._photo ? `<button class="btn sm sec" style="margin-top:8px" data-photo="${esc(x._photo)}">🖼 View photo</button>` : ""}</div>`).join("")
    + (list.length > n ? `<button class="btn sec block" id="moreNotes" style="margin:8px">Show all ${list.length} notes</button>` : "");
}
function meetingItem(key, m) {
  return `<div class="item ${m._pending ? "pend" : ""}"><div class="meta"><b>${niceDate(m.date)}</b> ${esc(m.time || "")} · ${m.status === "DONE" ? "✅ done" : "📅 booked"}${m.meeting_type ? ` · ${MEETING_ICON[m.meeting_type] || ""} ${esc(MEETING_TYPES[m.meeting_type] || m.meeting_type)}` : ""}${m.location ? " · 📍 " + esc(m.location) : ""} ${pendBadge(m)}</div>
    ${m.contacts ? `<div class="small">With: ${esc(m.contacts)}</div>` : ""}<div class="body">${esc(m.notes || "")}</div>
    ${m.status !== "DONE" ? `<div style="display:flex;gap:6px;margin-top:8px">${!m._pending ? `<a class="btn sm green" href="#/add/meeting/${encodeURIComponent(key)}/${encodeURIComponent(m.id)}">✓ Log as done</a>` : ""}<button class="btn sm sec" data-ics="meeting|${esc(m.id)}">📅 Add to Calendar</button></div>` : ""}</div>`;
}
function groupHtml(g, isOrder, key) {
  const icon = ln => ln.section === "Film" ? "🎞" : ln.section === "Machines" ? "⚙" : "•";
  const tot = `Goods ${gbp(g.subtotal)}${g.shipping_cost ? ` + Shipping ${gbp(g.shipping_cost)}` : ""} = ${gbp((g.subtotal || 0) + (g.shipping_cost || 0))} +VAT ${gbp(g.vat_amount)} → ${gbp(g.grand_total)}`;
  const scol = STAT_COL[String(g.status || "").toLowerCase()] || "#6b7280";
  return `<div class="item grp ${g._pending ? "pend" : ""}"><div class="gtop"><span class="gdate">${niceDate(isOrder ? g.order_date : g.date)}${g.quote_number ? " · " + esc(g.quote_number) : ""}</span>
    ${isOrder ? `<span class="gst" style="--sc:#16a34a">Order</span>` : `<span class="gst" style="--sc:${scol}">${esc(g.status)}</span>`}${pendBadge(g)}<span class="gamt">${gbp(g.grand_total)}</span></div>
    <div class="ghl">${esc(g.headline)}</div>
    ${(g.lines || []).map(ln => { const pr = isOrder ? ln.unit_price : (ln.agreed_price || ln.quoted_price || 0);
      return `<div class="small">${icon(ln)} ${esc(ln.description)} ×${num(ln.quantity)} @ ${gbp(pr)}${!isOrder && ln.agreed_price && ln.quoted_price && ln.agreed_price != ln.quoted_price ? ` (was ${gbp(ln.quoted_price)})` : ""}</div>`; }).join("")}
    <div class="tot">${tot}</div>${!isOrder && key ? (quoteConverted(key, g) ? `<div class="small t-green" style="font-weight:700">✓ Converted to an order${g._pending || pend(key, "order_new").some(e => e.data.from_quote && e.data.from_quote.key === quoteKeyOf(g)) ? " (not synced)" : ""}</div>`
      : ["rejected", "expired", "lost"].includes(String(g.status || "").toLowerCase()) ? "" : `<a class="btn sm" style="background:var(--teal);margin:6px 0 2px" href="#/add/order/${encodeURIComponent(key)}?from=${encodeURIComponent(quoteKeyOf(g))}">🛒 Convert to order</a>`) : ""}${!isOrder && key && !g._pending && (g.lines || []).some(l => l.section === "Machines") ? ` <button class="btn sm sec" style="margin:6px 0 2px" data-qpdf="${esc(quoteKeyOf(g))}">📄 Quote PDF</button>` : ""}${g.follow_up_date ? `<div class="small">📅 Chase: ${niceDate(g.follow_up_date)}</div>` : ""}${g.competitor ? `<div class="small">vs ${esc(g.competitor)}</div>` : ""}${g.notes ? `<div class="small">${esc(g.notes)}</div>` : ""}</div>`;
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
    if (!addr) h.push(`<h2>📍 Address</h2><a class="banner soft" href="#/add/address/${encodeURIComponent(key)}">📍 <span>No address yet — add one (needed for Nearby, routes and mileage)</span><span class="chev">›</span></a>`);
    if (addr) h.push(`<h2>📍 Address<a class="r small" href="#/add/address/${encodeURIComponent(key)}">＋ Add</a></h2><div class="card ${addr._pending ? "pend" : ""}"><div class="body" style="white-space:pre-wrap">${esc(addr.lines)}${addr._pending ? " " + pendBadge({_pending: 1}) : ""}</div>
      <div style="display:flex;gap:6px;margin-top:8px"><a class="btn sm" href="${navUrl((addr.lines || "").replace(/\n/g, ", "))}">🧭 Directions</a><button class="btn sm sec" data-copy="${esc((addr.lines || "").replace(/\n/g, ", "))}">⧉ Copy</button></div>${siteInfoHtml(key)}</div>`);
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
      <div class="ctiles soft"><div class="st" style="--k:#2563eb"><b>${esc(cm.total_quotes ?? qg.length)}</b><span>Quotes</span></div><div class="st" style="--k:#16a34a"><b>${esc(cm.win_rate ?? "—")}</b><span>Win rate</span></div>
        <div class="st" style="--k:#d97706"><b>${gbp0(cm.open_value)}</b><span>Open quotes</span></div><div class="st" style="--k:#7c3aed"><b>${esc(cm.orders ?? og.length)}</b><span>Orders</span></div>
        <div class="st" style="--k:#0d9488"><b>${gbp0(cm.order_value)}</b><span>Order value</span></div>${v.reorder ? `<div class="st" style="--k:#64748b"><b style="font-size:13px">${esc(v.reorder.text.replace(/^\S+\s/, ""))}</b><span>Film reorder</span></div>` : ""}</div>
      <h2>Quotes <span class="r small">${qg.length}</span></h2><div class="list">${qg.map(g => groupHtml(g, false, key)).join("") || '<div class="empty">No quotes.</div>'}</div>
      ${typeof quotePdfsMadeHtml === "function" ? quotePdfsMadeHtml(key) : ""}
      <h2>Orders <span class="r small">${og.length}</span></h2><div class="list">${og.map(g => groupHtml(g, true)).join("") || '<div class="empty">No orders.</div>'}</div>
      ${callOffsHtml(key)}`;
  },
  equipment: ({key, eq, specs}) => {
    const eqPend = pend(key, "meeting").filter(e => e.data.add_to_equipment && (e.data.films_seen || e.data.machines_seen));
    const packs = packProfiles(key), trials = rows("company_film_trials", key);
    const ints = machineInterests(key);
    return `<h2>⭐ Interested in<a class="r small" href="#" data-addint="${esc(key)}">＋ Add</a></h2>
      <div class="card">${ints.map(i => `<span class="chip" style="background:#f3eefa;color:#5b3f86">${esc(i.product)}${i._pending ? " ⏳" : ""}</span>`).join("") || '<span class="small">Nothing noted — tap ＋ Add when they ask about a machine.</span>'}
      ${ints.filter(i => i.note).map(i => `<div class="small">${esc(i.product)}: ${esc(i.note)}</div>`).join("")}</div>
      <h2>🏭 Machines & film on site <span class="r small">${eq.length}</span></h2><div class="list">${eq.filter(e => !e.is_retired).map(e => machineItem(key, e)).join("")
        + eqPend.map(ev => `<div class="item pend">${esc([ev.data.films_seen, ev.data.machines_seen].filter(Boolean).join(", "))} ${pendBadge({_pending: 1})}</div>`).join("") || '<div class="empty">Nothing recorded. Log a visit to add what you see.</div>'}</div>
      ${specs.length ? `<h2>🎞 Known film specs</h2><div class="list">${specs.map(s => `<div class="item"><b>${num(s.thickness_micron)}µm · ${s.roll_length_m ? (+s.roll_length_m).toLocaleString("en-GB") + " m" : "std length"}</b> · ${num(s.width_mm)}mm
        ${s.is_ours ? '<span class="chip c-green">ours</span>' : '<span class="chip c-red">competitor</span>'}${s.is_suggested ? '<span class="chip c-blue">suggested</span>' : ""}
        ${s.supplier ? `<div class="small">Supplier: ${esc(s.supplier)}</div>` : ""}${s.roll_price ? `<div class="small">${gbp(s.roll_price)}/roll</div>` : ""}${s.notes ? `<div class="small">${esc(s.notes)}</div>` : ""}</div>`).join("")}</div>` : ""}
      <h2>📦 Pack profiles<a class="r small" href="#/pack/${encodeURIComponent(key)}">🧮 Cost per pack ›</a></h2>${packs.length ? `<div class="list">${packs.map(p => `<a class="item" style="display:block;color:inherit" href="#/pack/${encodeURIComponent(key)}/${p.id}"><span style="float:right" class="chip c-blue">🧮 open</span><b>${esc(p.name)}</b>${p._pending ? pendBadge({_pending: 1}) : ""} ${p.category ? `<span class="chip">${esc(p.category)}</span>` : ""}${p.frequency ? `<span class="chip">${esc(p.frequency)}</span>` : ""}
        <div class="small">${[p.length_mm, p.width_mm, p.height_mm].some(x => x) ? `${num(p.length_mm)} × ${num(p.width_mm)} × ${num(p.height_mm)} mm` : ""}${p.thickness_micron ? ` · ${num(p.thickness_micron)}µm` : ""}</div>${packSummary(key, p) ? `<div class="small">🧮 ${packSummary(key, p)}</div>` : ""}${p.notes ? `<div class="small">${esc(p.notes)}</div>` : ""}</a>`).join("")}</div>` : '<div class="empty" style="background:var(--card);border-radius:14px">No pack profiles in the CRM — <a href="#/pack/' + encodeURIComponent(key) + '">work one out</a>.</div>'}
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
  if (!key) { // what are you adding, and for whom?
    const rec = (META.recent || []).map(k => IDX.co.get(k)).filter(Boolean).slice(0, 8);
    const av = c => { const col = STATUS_COL[companyStatus(c)] || "#94a3b8", ini = c.name.replace(/[^A-Za-z0-9 ]/g, "").split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase();
      return `<span class="av" style="background:linear-gradient(145deg,${col === "#dde1ea" ? "#94a3b8" : col},${col === "#dde1ea" ? "#94a3b8" : col}cc)">${esc(initials(c.name))}</span>`; };
    openSheet(`<b style="font-size:19px;letter-spacing:-.01em">Add something</b>
      <div class="qa-gen"><a href="#/newco">🏢 New lead</a><a href="#/dropin">📍 Drop-in</a><a href="#/board">📌 Sticky</a></div>
      ${rec.length ? `<h2 style="margin:14px 2px 6px">Recent customers</h2><div class="recentchips">${rec.map(c => `<a data-pick="${esc(c._key)}">${av(c)}<span class="nm">${esc(c.name)}</span></a>`).join("")}</div>` : ""}
      <input class="search" id="qaSearch" placeholder="Search customers…" style="margin-top:4px" autocomplete="off">
      <div class="list" id="qaList" style="margin-top:8px;max-height:42vh;overflow:auto"></div>`, el => {
      const draw = () => { const q = el.querySelector("#qaSearch").value.toLowerCase().trim();
        const list = scope().filter(c => !q || haystack(c).includes(q)).sort((a, b) => a.name.localeCompare(b.name)).slice(0, 40);
        el.querySelector("#qaList").innerHTML = list.map(c => `<a class="row" data-pick="${esc(c._key)}"><div class="m"><div class="t">${esc(c.name)}</div></div><span class="chev">›</span></a>`).join("") || '<div class="empty">No match</div>'; };
      el.querySelector("#qaSearch").oninput = draw; draw();
      const pick = e => { const r = e.target.closest("[data-pick]"); if (r) { e.preventDefault(); quickAddSheet(r.dataset.pick); } };
      el.querySelector("#qaList").onclick = pick; const rc = el.querySelector(".recentchips"); if (rc) rc.onclick = pick;
    });
    return;
  }
  const k = encodeURIComponent(key), c = IDX.co.get(key);
  const items = [["📝","Note","#4f46e5",`#/add/note/${k}`],["📞","Log call","#0891b2",`#/call/${k}`],["✅","Action","#16a34a",`#/add/action/${k}`],["🤝","Visit","#2563eb",`#/add/meeting/${k}`],
    ["📷","Photo","#db2777",`photo`],["💷","Quote","#f59e0b",`#/add/quote/${k}`],["🛒","Order","#0d9488",`#/add/order/${k}`],["✍️","Sign-off","#7c3aed",`#/sign/${k}`],
    ["👤","Contact","#64748b",`#/add/contact/${k}`],["🧪","Samples","#9333ea",`#/samples/${k}`],["📍","Address","#ea580c",`#/add/address/${k}`],["🧮","Cost/pack","#0f766e",`#/pack/${k}`],["🔖","Reorder QR","#b91c1c","reorder"],["📋","Brief","#334155",`#/brief/${k}`]];
  openSheet(`<b style="font-size:17px">${esc(c ? c.name : "")}</b><div class="sgrid" style="margin-top:14px">${items.map(([i, l, col, href]) =>
    href === "reorder" ? `<button data-ro="1"><span class="ic" style="background:${col}">${i}</span>${l}</button>` : href === "photo" ? `<button data-ph="1"><span class="ic" style="background:${col}">${i}</span>${l}</button>` : `<a href="${href}"><span class="ic" style="background:${col}">${i}</span>${l}</a>`).join("")}</div><button class="btn block sec" id="delCo" style="margin-top:14px;color:var(--red);font-size:14px">🗑 Delete this company</button>`, el => {
    el.querySelector("#delCo").onclick = () => deleteCompany(key);
    el.querySelector("[data-ph]").onclick = () => { closeSheet(); takePhoto(key); };
    el.querySelector("[data-ro]").onclick = () => reorderSheet(key);
  });
}

async function deleteCompany(key) {
  const c = IDX.co.get(key); if (!c) return;
  if (String(key).startsWith("t:")) {   // made on this phone and never sent: just remove it and everything added to it
    if (!confirm(`Delete ${c.name}? It was only ever on this phone, so it simply disappears (with anything you added to it).`)) return;
    PENDING = PENDING.filter(ev => evCoKey(ev) !== key);
    if (typeof ROAD !== "undefined") { ROAD.visits = ROAD.visits.filter(v => v.key !== key); for (const d of Object.keys(ROAD.plans)) ROAD.plans[d] = ROAD.plans[d].filter(k => k !== key); await saveRoad("visits"); await saveRoad("plans"); }
  } else {
    if (!confirm(`Delete ${c.name}?\n\nIt disappears from the phone now. At the next sync the PC asks before deleting it there too (it goes to the CRM's bin for 7 days). To undo before then, remove "Delete company" from the Sync list.`)) return;
    await addEvent("company_delete", key, {name: c.name});
  }
  await savePending(); closeSheet(); toast(`🗑 ${c.name} deleted`); go("#/companies");
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
let nearAll = false;
route(/^#\/nearby$/, () => {
  setHeader("On the road", null, "road");
  const v = $("#view");
  if (!SNAP) { v.innerHTML = welcomeCard(); return; }
  const cos = scope(), withPc = cos.map(c => [c, companyPostcode(c._key)]).filter(x => x[1]);
  const missing = withPc.filter(([, p]) => !GEO[p]).length;
  v.innerHTML = `${roadSeg("nearby")}<div class="card"><b>Customers near you</b><p class="small" style="margin:4px 0 10px">Uses your phone's location and each customer's postcode. ${withPc.length} of ${cos.length} have a postcode on file.${missing ? ` ${missing} postcode${missing === 1 ? "" : "s"} still need looking up (needs signal, done once and remembered — only the postcodes are sent to postcodes.io).` : ""}</p>
    <button class="btn block red" id="locBtn">📍 ${HERE ? "Refresh my location" : "Find customers near me"}</button><div class="small" id="locMsg"></div>
    <div class="chips" style="margin-top:10px">${NEAR_STEPS.map(r => `<button class="fchip sm ${r === nearMiles() ? "on" : ""}" data-nmi="${r}">${r ? r + " mi" : "Any"}</button>`).join("")}</div></div><div id="nearList"></div>`;
  v.querySelectorAll("[data-nmi]").forEach(b => b.onclick = async () => { META.nearMiles = +b.dataset.nmi; nearAll = false; await saveMeta(); render(); });
  const draw = () => {
    if (!HERE) return;
    const lim = nearMiles();
    const all = withPc.filter(([, p]) => GEO[p] && !GEO[p].none).map(([c, p]) => [c, miles(HERE, GEO[p]), p]).filter(x => !lim || x[1] <= lim).sort((a, b) => a[1] - b[1]);
    const list = nearAll ? all : all.slice(0, 60);
    $("#nearList").innerHTML = `<h2>${all.length} ${lim ? `within ${lim} miles` : "with a postcode"} · closest first</h2><div class="list">${list.map(([c, d, p]) => coRow(c, `<span class="dist">${d < 10 ? d.toFixed(1) : Math.round(d)} mi</span><button class="btn sm sec" data-plan="${esc(c._key)}" style="padding:4px 8px">＋🗓</button>`).replace('<div class="m">', `<div class="m" data-pc="${esc(p)}">`)).join("") || `<div class="empty">${lim && withPc.some(([, p]) => GEO[p] && !GEO[p].none) ? `Nobody within ${lim} miles — try further.` : "No customers with known locations yet."}</div>`}</div>
      ${all.length > list.length ? `<button class="btn block sec" id="nearMore" style="margin-top:8px">Show all ${all.length}</button>` : ""}`;
    const nm = $("#nearMore"); if (nm) nm.onclick = () => { nearAll = true; draw(); };
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
    const ms = machineSheet(r.dataset.prod);
    const msTxt = ms ? [ms.model_code, ms.list_price && "list " + gbp(+String(ms.list_price).replace(/[£,]/g, "")), (ms.cap_max_width || ms.max_film_width) && "max film " + (ms.cap_max_width ? num(ms.cap_max_width) + "mm" : ms.max_film_width),
      ms.seal_dimensions && "seal " + ms.seal_dimensions, (ms.cap_cycles_per_min || ms.packs_per_minute) && (ms.cap_cycles_per_min ? num(ms.cap_cycles_per_min) + "/min" : ms.packs_per_minute), ms.lead_time && "lead " + ms.lead_time,
      ms.warranty_months && ms.warranty_months + " mo warranty", ms.power && "power " + ms.power, ms.air && "air " + ms.air].filter(Boolean) : [];
    openSheet(`<b style="font-size:16px">${esc(r.dataset.prod)}</b>${msTxt.length ? `<div class="card small" style="margin-top:8px">📋 ${msTxt.map(esc).join(" · ")}</div>` : ""}<div class="list" style="margin-top:10px;max-height:60vh;overflow:auto">${h.map(e => `<a class="row" href="${coHref(e.c._key)}"><div class="m"><div class="t">${esc(e.c.name)}</div><div class="s">${niceDate(e.date)} · ${e.kind === "order" ? "order" : "quote · " + esc(e.status || "")} · ×${num(e.qty)}</div></div><b class="money">${gbp(e.price)}</b></a>`).join("") || '<div class="empty">No history.</div>'}</div>`); };
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

// ---------- ✏️ edit something before it's sent to the CRM ----------
const EDITABLE = {
  note: [["content", "Note", "area"]],
  action_new: [["note", "Action", "text"], ["date", "Date", "date"], ["time", "Time", "time"]],
  meeting: [["date", "Date", "date"], ["time", "Time", "time"], ["location", "Where", "text"], ["notes", "Notes", "area"]],
  company_new: [["name", "Company name", "text"], ["contact_name", "Contact", "text"], ["phone", "Phone", "tel"], ["email", "Email", "email"]],
  contact_new: [["name", "Name", "text"], ["role", "Role", "text"]],
  address_new: [["line1", "Address line 1", "text"], ["line2", "Address line 2", "text"], ["city", "Town", "text"], ["postcode", "Postcode", "text"]],
  quote_new: [["quote_number", "Quote no.", "text"], ["follow_up_date", "Chase on", "date"], ["notes", "Notes", "area"]],
  order_new: [["order_date", "Order date", "date"], ["notes", "PO / notes", "area"]],
  photo: [["caption", "Caption", "text"]],
};
function editEventSheet(id) {
  const ev = PENDING.find(x => x.id === id), fields = ev && EDITABLE[ev.type]; if (!fields) return;
  openSheet(`<b style="font-size:17px">✏️ Edit before sending</b><div class="small" style="margin:2px 0 8px">${esc(ev.company_name || "")}${["quote_new", "order_new"].includes(ev.type) ? " · to change the items, delete it and make it again" : ""}</div>
    ${fields.map(([k, l, t]) => `<label class="f">${l}</label>${t === "area" ? `<textarea class="f" data-k="${k}" style="min-height:110px">${esc(ev.data[k] || "")}</textarea>` : `<input class="f" data-k="${k}" type="${t}" value="${esc(ev.data[k] || "")}">`}`).join("")}
    <button class="btn block" id="evSave" style="margin-top:12px">Save changes</button>`, el => {
    el.querySelector("#evSave").onclick = async () => {
      el.querySelectorAll("[data-k]").forEach(i => { ev.data[i.dataset.k] = i.value.trim(); });
      if (ev.type === "address_new") { ev.data.postcode = (ev.data.postcode || "").toUpperCase(); ev.data.lines = [ev.data.line1, ev.data.line2, ev.data.city, ev.data.county, ev.data.postcode].filter(Boolean).join("\n"); }
      if (ev.type === "company_new") ev.company_name = ev.data.name;
      await savePending(); closeSheet(); toast("Updated"); render(); };
  });
}
// a pending note on a company's Notes tab can be tapped to edit it
document.addEventListener("click", e => { const b = e.target.closest("[data-editn]"); if (b) { e.preventDefault(); editEventSheet(b.dataset.editn); } });

// ---------- SYNC ----------
route(/^#\/sync$/, () => {
  setHeader("Sync", null, "sync");
  const t = (SNAP && SNAP.tables) || {}, users = (SNAP && SNAP.users) || [];
  const byType = {}; for (const e of PENDING) byType[e.type] = (byType[e.type] || 0) + 1;
  const names = {note:"notes",action_new:"actions",action_done:"ticked off",meeting:"visits/meetings",contact_new:"contacts",company_new:"new companies",quote_new:"quotes",order_new:"orders",signoff:"signed sheets",photo:"photos"};
  const snapAge = SNAP && SNAP.exported_at ? ago(SNAP.exported_at) : "";
  $("#view").innerHTML = `${healthBanners()}
    <div class="card"><div style="display:flex;align-items:center;gap:10px"><span style="font-size:28px">⬆️</span><div><b>Send to the CRM</b><div class="small">${PENDING.length ? `${PENDING.length} item${PENDING.length === 1 ? "" : "s"}: ${Object.entries(byType).map(([k, n]) => `${n} ${names[k] || k}`).join(", ")}` : (META.roadDirty ? "Mileage has changed since you last sent it." : "Nothing waiting — all sent.")}</div></div></div>
      <button class="btn block red" id="exportBtn" ${PENDING.length || META.roadDirty ? "" : "disabled"}>📤 Export changes${PENDING.length ? ` (${PENDING.length})` : ""}${META.roadDirty ? " + mileage" : ""}</button>
      <div class="small">Share to email / AirDrop / Drive / Files, then on the PC: <b>📱 Phone sync → Choose changes file</b>. Sending twice is harmless.${META.lastExport ? `<br>Last exported ${esc(ago(META.lastExport))}.` : ""}</div></div>
    <div class="card"><div style="display:flex;align-items:center;gap:10px"><span style="font-size:28px">⬇️</span><div><b>Load from the CRM</b><div class="small">${SNAP ? `Copy from ${esc(snapAge)} · ${(t.companies || []).length} companies · ${(t.people || []).length} contacts · ${(t.notes || []).length} notes` : "No CRM data yet."}</div></div></div>
      <button class="btn block green" id="importBtn">📥 Load snapshot from CRM</button>
      <div class="small">Anything the CRM has already imported clears from the list below automatically; the rest stays.</div></div>
    <h2>Waiting to send <span class="r small">${PENDING.length}</span></h2>
    <div class="list">${PENDING.slice().reverse().map(e => `<div class="row"><div class="m"><div class="t" style="white-space:normal">${esc(describe(e))}</div>
      <div class="s">${esc(e.company_name || "")} · ${esc(e.created_at.replace("T", " ").slice(0, 16))}</div></div>${EDITABLE[e.type] ? `<button class="btn sm sec" data-edit-ev="${esc(e.id)}" style="margin-right:4px">✏️</button>` : ""}<button class="btn sm sec" data-del="${esc(e.id)}" style="color:var(--red)">✕</button></div>`).join("") || '<div class="empty">Nothing.</div>'}</div>
    <a class="card" href="#/settings" style="display:flex;align-items:center;gap:10px;color:inherit;margin-top:16px"><span style="font-size:20px">⚙️</span>
      <div style="flex:1"><b>Settings, backup & reminders</b><div class="small">Who you are, mileage, directions, backup</div></div><span class="chev">›</span></a>`;
  $("#exportBtn").onclick = exportChanges;
  $("#importBtn").onclick = pickSnapshot;
  $("#view").querySelectorAll("[data-edit-ev]").forEach(b => b.onclick = () => editEventSheet(b.dataset.editEv));
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

// ---------- ⚙️ SETTINGS: everything you set once, in one place ----------
route(/^#\/settings$/, () => {
  setHeader("Settings", "#/more", "more");
  const users = (SNAP && SNAP.users) || [], rate = mileRateP();
  const chips = (attr, opts, cur) => `<div class="chips">${opts.map(([v, l]) => `<button class="fchip sm ${String(v) === String(cur) ? "on" : ""}" ${attr}="${v}">${l}</button>`).join("")}</div>`;
  $("#view").innerHTML = `
    <h2>You</h2><div class="card">
      <label class="f">Who am I? (for "Mine")</label><select class="f" id="userSel"><option value="">${SNAP && SNAP.current_user ? esc(SNAP.current_user) + " (from CRM)" : "Not set – show everyone"}</option>${users.map(u => `<option ${META.user === u.name ? "selected" : ""}>${esc(u.name)}</option>`).join("")}</select>
      <label class="f">Device name (shown on the PC when importing)</label><input class="f" id="devName" value="${esc(META.device || "")}" placeholder="e.g. Dan's iPhone"></div>
    <h2>Mileage</h2><div class="card"><div class="two">
      <div><label class="f">Home postcode</label><input class="f" id="homePc" value="${esc(homePc())}" placeholder="e.g. LS1 4AB" autocapitalize="characters"></div>
      <div><label class="f">Office postcode</label><input class="f" id="offPc" value="${esc(officePc())}" autocapitalize="characters"></div></div>
      <label class="f">Rate per mile</label><input class="f" id="rate" inputmode="decimal" value="${esc(rate ? rate + "p" : "")}" placeholder="e.g. 45p or 0.45">${rate ? `<div class="small">= ${gbp(rate / 100)} a mile</div>` : ""}
      <div class="small" style="margin-top:6px">Also changeable on the PC — whichever was changed last wins.</div></div>
    <h2>On the road</h2><div class="card">
      <label class="f">🧭 Directions open in</label>${chips("data-nav", NAV_APPS, META.navApp || "apple")}
      <label class="f">📍 Ask "Arrived?" when I open the app within</label>${chips("data-arr", [[0.5, "½ mi"], [1, "1 mi"], [2, "2 mi"], [3, "3 mi"], [0, "Off"]], META.arriveOff ? 0 : arriveMiles())}
      <label class="f">Nearby reaches</label>${chips("data-nmi", NEAR_STEPS.map(r => [r, r ? r + " mi" : "Any"]), nearMiles())}
      <label class="f">"Worth a visit while you're there" reaches</label>${chips("data-rad", [3, 6, 10, 20, 30].map(r => [r, r + " mi"]), nearRadius())}</div>
    <h2>Reminders & look</h2><div class="card">
      <label class="f">Warn me when items haven't been sent for</label><select class="f" id="remSel">${[1, 2, 3, 7].map(d => `<option value="${d}" ${+META.remindDays === d ? "selected" : ""}>${d} day${d === 1 ? "" : "s"}</option>`).join("")}</select>
      <label class="f">Colours</label><select class="f" id="themeSel">${Object.entries(THEME_MODES).map(([k, n]) => `<option value="${k}" ${(META.theme || "pc") === k ? "selected" : ""}>${n}${k === "pc" ? ` (${SNAP && SNAP.theme === "dark" ? "dark" : "light"})` : ""}</option>`).join("")}</select>
      <button class="btn block sec" id="calRem" style="margin-top:12px">⏰ Weekday 5pm "send to CRM" reminder in my Calendar</button></div>
    <h2>Backup & data</h2><div class="card">
      <p class="small" style="margin:0 0 8px">Your mileage, visits, day plans and card live only on this phone. Save a backup now and then; to restore, choose the backup file with 📥 Load snapshot.${META.lastBackup ? ` Last backup ${esc(ago(META.lastBackup))}.` : " No backup yet."}</p>
      <button class="btn block sec" data-backup="1">💾 Back up this phone's data</button>
      <button class="btn block sec" id="fullCopyBtn" style="margin-top:8px" ${SNAP ? "" : "disabled"}>📦 Export the full CRM copy (for the home laptop)</button>
      <button class="btn block sec" id="wipeBtn" style="margin-top:8px;color:var(--red)">🧹 Clear this phone's data and start fresh</button>
      <p class="small" id="persist" style="margin-top:12px"></p></div>
    <p class="small" style="text-align:center;margin:18px 0 6px">Kempner Mobile · v${APP_V} · your data stays on this phone</p>`;
  const v = $("#view");
  $("#userSel").onchange = async e => { META.user = e.target.value; await saveMeta(); buildIndex(); toast("Saved"); };
  $("#devName").onchange = async e => { META.device = e.target.value.trim(); await saveMeta(); toast("Saved"); };
  $("#remSel").onchange = async e => { META.remindDays = +e.target.value; await saveMeta(); toast("Saved"); };
  $("#themeSel").onchange = async e => { META.theme = e.target.value; await saveMeta(); applyTheme(); };
  $("#calRem").onclick = calendarReminder; $("#wipeBtn").onclick = wipePhoneData; $("#fullCopyBtn").onclick = exportFullCopy;
  // a mileage settings change is sent with the next export (and says when, so the newest of phone/PC wins)
  const setChanged = () => { META.mileSetAt = nowIso(); META.roadDirty = true; };
  $("#offPc").onchange = async e => { META.officePostcode = e.target.value.toUpperCase().trim(); setChanged(); await saveMeta(); await ensureGeo([officePc()]); toast("Saved"); };
  $("#homePc").onchange = async e => { META.homePostcode = e.target.value.toUpperCase().trim(); setChanged(); await saveMeta(); await ensureGeo([homePc()]); toast("Saved"); };
  $("#rate").onchange = async e => { META.mileRate = e.target.value.trim(); META.mileRate = mileRateP() || ""; setChanged(); await saveMeta(); render(); };
  wireNavPicker(v); wireArrivePicker(v);
  v.querySelectorAll("[data-nmi]").forEach(b => b.onclick = async () => { META.nearMiles = +b.dataset.nmi; await saveMeta(); render(); });
  v.querySelectorAll("[data-rad]").forEach(b => b.onclick = () => { try { localStorage.setItem("kempner_near_radius", b.dataset.rad); } catch (e) {} render(); });
  if (navigator.storage && navigator.storage.persisted) navigator.storage.persisted().then(p => { const el = $("#persist"); if (el) el.textContent = p ? "✓ iOS won't clear this app's data automatically." : "Tip: open the app from the Home Screen icon so iOS keeps its data safe."; });
});

// ⭐ "interested in a machine" from the phone
document.addEventListener("click", e => { const b = e.target.closest("[data-addint]"); if (!b) return; e.preventDefault();
  const key = b.dataset.addint, have = new Set(machineInterests(key).map(i => String(i.product).toLowerCase()));
  const ms = catalogue().filter(p => p.section === "Machines" && !have.has(p.name.toLowerCase())).sort((a, b) => a.name.localeCompare(b.name));
  openSheet(`<b style="font-size:17px">⭐ Which machine are they interested in?</b>
    <input class="f" id="intNote" placeholder="Note (optional) — e.g. asked at the show" style="margin:10px 0">
    <div class="list">${ms.map(p => `<button class="row" data-intp="${esc(p.id)}" style="width:100%;text-align:left;background:none;border:0;border-bottom:1px solid var(--line)"><div class="m"><div class="t">${esc(p.name)}</div></div><span class="chev">＋</span></button>`).join("") || '<div class="empty">No machines in the catalogue yet.</div>'}</div>`);
  document.querySelectorAll("[data-intp]").forEach(x => x.onclick = async () => { const p = ms.find(m => m.id === x.dataset.intp);
    await addEvent("machine_interest", key, {product_id: +p.id || null, product: p.name, note: ($("#intNote").value || "").trim()});
    closeSheet(); toast(`⭐ ${p.name} — the PC updates at the next sync`); render(); });
});

// ---------- 📞 SNAPSHOT: someone's on the phone ----------
route(/^#\/snap\/(.+)$/, key => {
  const c = IDX.co.get(String(key)); if (!c) return go("#/companies");
  setHeader("📞 " + c.name, coHref(key), "companies");
  const v = view(key) || {}, st = companyStatus(c), ppl = people(key);
  const ago = d => { const n = -dayDiff(d); return n <= 0 ? "today" : n === 1 ? "yesterday" : n < 14 ? `${n} days ago` : n < 60 ? `${Math.floor(n / 7)} weeks ago` : n < 730 ? `${Math.floor(n / 30)} months ago` : `${Math.floor(n / 365)} years ago`; };
  const box = (icon, title, col, body) => body ? `<div class="snapsec" style="border-top-color:${col}"><h3>${icon} ${title}</h3>${body}</div>` : "";
  const ln = (l, r = "", sub = "", rcol = "") => `<div class="ln"><div class="l">${l}${sub ? `<div class="sub">${sub}</div>` : ""}</div>${r ? `<div class="r" style="${rcol ? "color:" + rcol : ""}">${r}</div>` : ""}</div>`;
  const prodName = (pid, fallback) => { const p = pid && catalogue().find(x => x.id === String(pid)); return p ? p.name : (fallback || "film"); };
  // ⚡ heads up
  const heads = [];
  if (v.reorder && /overdue/i.test(v.reorder.text || "")) heads.push(["⚠", v.reorder.text.replace(/^\S+\s/, ""), "var(--red)"]);
  const openQ = (v.quote_groups || []).filter(g => ["pending", "counter-offered", "on hold"].includes(String(g.status || "").toLowerCase()));
  if (openQ.length) heads.push(["💷", `Quote waiting from ${niceDate(openQ[0].date)} (${ago(openQ[0].date)}) — worth asking about`, "#d35400"]);
  const trials = rows("company_film_trials", key).filter(t => !t.success && !t.ordered);
  if (trials.length) heads.push(["🧪", `Trial of ${trials[0].spec_name} — no result yet`, "#8e44ad"]);
  const ints = machineInterests(key); if (ints.length) heads.push(["⭐", "Interested in " + ints.map(i => i.product).slice(0, 2).join(", "), "#7f5ba6"]);
  if (c.vibe) heads.push(["💭", c.vibe, "var(--sub)"]);
  // 👤 who
  const who = ppl.slice(0, 5).map(p => { const n = (p.numbers.find(x => x.is_best) || p.numbers[0] || {}).number, em = p.emails[0];
    return `<div style="padding:4px 0"><b>${esc(p.name)}</b>${p.is_main_contact ? " ★" : ""}${p.org_role ? ` <span class="small">${esc(p.org_role)}</span>` : ""}
      <div class="small">${n ? "📞 " + telLink(n, key) : ""}${em ? `${n ? " &nbsp; " : ""}✉️ <a href="mailto:${esc(em)}">${esc(em)}</a>` : ""}</div></div>`; }).join("")
    + `<a class="btn sm sec" href="#/add/contact/${encodeURIComponent(key)}" style="margin-top:6px">＋ New person calling</a>`;
  // 🎞 film they use: per product, last price paid + last bought
  const fo = rows("film_orders", key).filter(o => o.product_id && (o.section || "Film") === "Film");
  const byP = new Map();
  for (const o of fo) { const k = String(o.product_id), b = byP.get(k) || {pid: k, last: "", price: 0, rolls: 0, desc: o.description};
    if ((o.order_date || "") >= b.last) { b.last = o.order_date || ""; if (+o.unit_price) b.price = +o.unit_price; }
    if (-dayDiff(o.order_date) <= 365) b.rolls += +o.quantity || 0; byP.set(k, b); }
  let film = [...byP.values()].sort((a, b) => b.last.localeCompare(a.last)).slice(0, 6)
    .map(b => ln(`<b>${esc(prodName(b.pid, b.desc))}</b>`, b.price ? `${gbp(b.price)}/roll` : "", `last bought ${niceDate(b.last)} (${ago(b.last)})${b.rolls ? ` · ${num(b.rolls)} rolls in the last year` : ""}`, "var(--green)")).join("");
  if (!film) film = rows("company_known_film_specs", key).slice(0, 4).map(s => ln(`<b>${num(s.thickness_micron)}µm · ${num(s.width_mm)}mm</b>`, s.roll_price ? `${gbp(s.roll_price)}/roll` : "",
    `runs this · ${s.is_ours ? "ours" : esc(s.supplier || "another supplier")}`)).join("") || '<div class="small">Not bought film from us yet.</div>';
  // 💷 recently quoted
  const qs = (v.quote_groups || []).slice(0, 5).map(g => `<div style="padding:3px 0"><div class="sub"><b>${niceDate(g.date)}</b> · ${ago(g.date)} <span style="float:right;font-weight:700;color:${STAT_COL[String(g.status || "").toLowerCase()] || "var(--sub)"}">${esc(g.status || "")}</span></div>
    ${(g.lines || []).slice(0, 4).map(l => { const a = l.agreed_price, q = l.quoted_price, pr = a && q && Math.abs(a - q) > 0.005 ? `${gbp(q)} → ${gbp(a)}` : gbp(a || q || 0);
      return ln(`${num(l.quantity) !== "1" ? num(l.quantity) + " × " : ""}${esc(l.description)}`, pr); }).join("")}</div>`).join("") || '<div class="small">Nothing quoted yet.</div>';
  // 🛒 last bought
  const ob = (v.order_groups || []).slice(0, 3).map(g => ln(`<b>${niceDate(g.order_date)}</b> <span class="sub">(${ago(g.order_date)})</span>`, gbp0(g.subtotal || g.grand_total),
    (g.lines || []).slice(0, 3).map(l => `${num(l.quantity)} × ${esc(l.description)}`).join(", "))).join("") || '<div class="small">No orders logged.</div>';
  // 🗣 last talked about
  const talk = notes(key).slice(0, 5).map(n => ({d: n.date, w: n.customer_name, t: n.content, i: "📝"}))
    .concat(meetings(key).filter(m => m.status === "DONE").slice(0, 3).map(m => ({d: m.date, w: m.contacts, t: `${MEETING_TYPES[m.meeting_type || ""] || "Visit"}: ${m.notes || ""}`, i: "🤝"})))
    .sort((a, b) => String(b.d).localeCompare(String(a.d))).slice(0, 5)
    .map(x => `<div style="padding:3px 0"><div class="sub">${x.i} <b>${niceDate(x.d)}</b> · ${ago(x.d)}${x.w ? " · with " + esc(x.w) : ""}</div><div style="font-size:14px">${esc(String(x.t || "").replace(/\s+/g, " ").slice(0, 240))}</div></div>`).join("") || '<div class="small">Nothing written down yet.</div>';
  // ⏰ coming up
  const up = openActions(key).slice(0, 4).map(a => ln(esc(a.note), niceDate(a.date), "", a.date && dayDiff(a.date) < 0 ? "var(--red)" : "")).join("");
  $("#view").innerHTML = `<div class="card" style="border-left:5px solid ${TEMP_COL[st] || "var(--line)"}"><b style="font-size:19px">${esc(c.name)}</b>
      <div class="small">${TEMP_NAME[st] || ""}${v.last_contact ? ` · last contact ${esc(v.last_contact)}` : ""}${v.owners ? ` · ${esc(v.owners)}` : ""}</div></div>
    ${heads.length ? box("⚡", "Heads up", "#f0a500", heads.map(([i, t, col]) => `<div style="color:${col};font-weight:700;font-size:14px;padding:2px 0">${i} ${esc(t)}</div>`).join("")) : ""}
    ${box("👤", "Who's who", "#8e44ad", who)}
    ${box("🎞", "Film they use", "#27ae60", film)}
    ${box("💷", "Recently quoted", "#d35400", qs)}
    ${box("🛒", "Last bought", "#2f80ed", ob)}
    ${box("🗣", "What we last talked about", "#56606e", talk)}
    ${up ? box("⏰", "Coming up", "#e67e22", up) : ""}
    <div style="display:flex;gap:6px;margin:10px 0 20px"><a class="btn" href="#/call/${encodeURIComponent(key)}" style="flex:1">📝 Log this call</a><a class="btn sec" href="${coHref(key)}">Open company</a></div>`;
});
