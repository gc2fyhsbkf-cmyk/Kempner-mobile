"use strict";
/* Kempner Mobile — Home: the things you want in one tap when you're stood in front of someone.
   Today (the full list of what's due) is one tab along. */

function upNext() {
  const d = localDate(), now = localTime();
  // 1) the next stop on today's plan you haven't checked in at
  const plan = (typeof ROAD !== "undefined" && ROAD.plans[d]) || [];
  for (const k of plan) { if (!IDX.co.get(k)) continue;
    if (!ROAD.visits.some(v => v.key === k && v.date === d)) return {key: k, why: "Next on today's plan", note: typeof pcNote === "function" ? pcNote(d, k) : ""}; }
  // 2) else the next meeting booked for today
  let best = null;
  for (const c of scope()) for (const m of meetings(c._key)) {
    if (m.date !== d || m.status === "DONE") continue;
    if (!best || (m.time || "99") < (best.m.time || "99")) best = {key: c._key, m};
  }
  return best ? {key: best.key, why: `Meeting${best.m.time ? " at " + best.m.time : " today"}`, note: best.m.notes || best.m.location || ""} : null;
}

route(/^#\/home$/, () => {
  setHeader("", null, "home");
  const v = $("#view"), card = myCard(), hasCard = card.name && (card.mobile || card.email);
  const hr = new Date().getHours(), hi = hr < 12 ? "Good morning" : hr < 18 ? "Good afternoon" : "Good evening";
  const first = (card.name || META.user || (SNAP && SNAP.current_user) || "").split(" ")[0];
  let due = 0, over = 0;
  if (SNAP || PENDING.length) for (const c of scope()) for (const a of openActions(c._key)) { if (!a.date) continue; const dd = dayDiff(a.date); if (dd < 0) over++; else if (dd === 0) due++; }
  const pins = (SNAP || PENDING.length) ? scope().flatMap(c => openActions(c._key).filter(a => a.pinned)) : [];
  const nx = SNAP || PENDING.length ? upNext() : null, nc = nx && IDX.co.get(nx.key);
  const mc = nc ? mainContact(nx.key) : null, addr = nc ? rows("addresses", nx.key)[0] : null;
  const tiles = [["📝", "Note", "#4f46e5", "note"], ["📞", "Log call", "#0891b2", "call"], ["✅", "Action", "#16a34a", "action"],
    ["🤝", "Visit", "#2563eb", "meeting"], ["📷", "Photo", "#db2777", "photo"], ["🏢", "New lead", "#64748b", "#/newco"], ["🎬", "Videos", "#0d9488", "#/videos"], ["🧮", "Cost/pack", "#0f766e", "pack"]];
  v.innerHTML = `${healthBanners()}
    <div style="margin:6px 4px 14px"><div style="font-size:29px;font-weight:800;letter-spacing:-.025em;line-height:1.1">${hi}${first ? ", " + esc(first) : ""}</div>
      <div class="small">${esc(new Date().toLocaleDateString("en-GB", {weekday: "long", day: "numeric", month: "long"}))}</div></div>
    <input class="search" id="hq" type="search" placeholder="Find a company, person or postcode…" autocomplete="off">
    ${hasCard ? `<a href="#/card/qr" class="homecard" aria-label="Show my business card QR"><div class="bcface">${cardFrontHtml(card)}</div></a>
      <div class="small" style="text-align:center;margin:-2px 0 10px">Tap your card to show the QR · <a href="#/card">front</a></div>` : ""}
    ${nc ? `<h2>Up next</h2><div class="card"><div style="font-weight:800;font-size:17px">${esc(nc.name)}</div>
        <div class="small">${esc(nx.why)}${nx.note ? " · " + esc(nx.note) : ""}${addr ? " · " + esc((addr.lines || "").split("\n").slice(-2).join(", ")) : ""}</div>
        <div class="hq4">${addr ? `<a href="https://maps.apple.com/?daddr=${encodeURIComponent((addr.lines || "").replace(/\n/g, ", "))}">🧭<span>Directions</span></a>` : ""}
          <a href="#/brief/${encodeURIComponent(nx.key)}">📋<span>Brief</span></a>
          <button id="hCheck">📍<span>Check in</span></button>
          ${mc && dialable(mc.number) ? `<a href="tel:${esc(digits(mc.number))}" data-call="${esc(nx.key)}" data-num="${esc(mc.number)}">📞<span>Call</span></a>` : ""}</div></div>`
      : ""}
    ${(!nc || !hasCard) ? `<div class="list nudges">${!nc ? `<a class="row" href="#/plan"><span class="ni" style="--k:#2563eb">${ICON("cal", 18)}</span><div class="m"><div class="t">Plan today's visits</div><div class="s">Nothing planned yet — route, briefs and mileage</div></div><span class="chev">›</span></a>` : ""}
      ${!hasCard ? `<a class="row" href="#/card/edit"><span class="ni" style="--k:#e11d2e">${ICON("user", 18)}</span><div class="m"><div class="t">Set up your business card</div><div class="s">A QR people scan to save your details</div></div><span class="chev">›</span></a>` : ""}</div>` : ""}
    <a class="small" href="#/dropin" style="display:block;text-align:right;margin:4px 6px 0">📍 Popped in somewhere not on your list? Drop-in ›</a>
    ${(r => r.length ? `<h2>Recently opened</h2><div class="recentchips">${r.map(c => { const col = TEMP_COL[companyStatus(c)] || "#94a3b8";
      return `<a href="${coHref(c._key)}"><span class="av" style="background:linear-gradient(145deg,${col},${col}cc)">${esc(initials(c.name))}</span><span class="nm">${esc(c.name)}</span></a>`; }).join("")}</div>` : "")((META.recent || []).map(k => IDX.co.get(k)).filter(Boolean).slice(0, 6))}
    <div id="homeNear"></div>
    <h2>Quick add</h2>
    <div class="sgrid">${tiles.map(([i, l, col, k]) => k.startsWith("#") ? `<a href="${k}"><span class="ic" style="background:${col}">${i}</span>${l}</a>`
      : `<button data-q="${k}"><span class="ic" style="background:${col}">${i}</span>${l}</button>`).join("")}</div>
    <div class="list" style="margin-top:14px">
      ${(n => n ? `<a class="row" href="#/"><span style="font-size:22px">📌</span><div class="m"><div class="t">${n} pinned action${n === 1 ? "" : "s"}</div><div class="s">${esc(pins.slice(0, 2).map(x => x.note).join(" · "))}</div></div><span class="chev">›</span></a>` : "")(pins.length)}
      <a class="row" href="#/"><span style="font-size:22px">📋</span><div class="m"><div class="t">Today</div><div class="s ${over ? "alert" : ""}">${over ? `${over} overdue · ` : ""}${due} due today</div></div><span class="chev">›</span></a>
      <a class="row" href="#/plan"><span style="font-size:22px">🗓</span><div class="m"><div class="t">My day & route</div><div class="s">${((typeof ROAD !== "undefined" && ROAD.plans[localDate()]) || []).length} stops planned</div></div><span class="chev">›</span></a>
      ${(SNAP || PENDING.length) ? (n => n ? `<a class="row" href="#/health"><span style="font-size:22px">🩺</span><div class="m"><div class="t">Missing info</div><div class="s">${n} customer${n === 1 ? "" : "s"} missing a postcode, contact, number or email</div></div><span class="chev">›</span></a>` : "")(gapList().length) : ""}
      ${(n => n ? `<a class="row" href="#" id="calAll"><span style="font-size:22px">📅</span><div class="m"><div class="t">Put upcoming meetings in Calendar</div><div class="s">${n} meeting${n === 1 ? "" : "s"} booked · adding again updates them, no doubles</div></div><span class="chev">›</span></a>` : "")(upcomingMeetings().length)}
      ${(new Date().getHours() >= 15 || visitsOn(localDate()).some(v => v.key)) ? `<a class="row" href="#/wrap"><span style="font-size:22px">🌙</span><div class="m"><div class="t">Wrap up the day</div><div class="s">${(n => n ? `${n} visit${n === 1 ? "" : "s"} not written up · ` : "")(visitsOn(localDate()).filter(v => v.key && v.kind !== "office" && v.kind !== "place" && !visitLogged(v.key, localDate())).length)}miles, what's left to send, tomorrow</div></div><span class="chev">›</span></a>` : ""}
      <a class="row" href="#/board"><span style="font-size:22px">📌</span><div class="m"><div class="t">Notice board</div><div class="s">${(((SNAP && SNAP.stickies) || []).length + PENDING.filter(e => e.type === "sticky_new").length) || "No"} sticky note${(((SNAP && SNAP.stickies) || []).length + PENDING.filter(e => e.type === "sticky_new").length) === 1 ? "" : "s"} · jot one down</div></div><span class="chev">›</span></a>
      ${PENDING.length ? `<a class="row" href="#/sync"><span style="font-size:22px">⬆️</span><div class="m"><div class="t">${PENDING.length} waiting to send</div><div class="s">Export to the CRM when you're back</div></div><span class="chev">›</span></a>` : ""}
    </div>`;
  const q = $("#hq"); q.onkeydown = e => { if (e.key === "Enter") { coQuery = q.value; coLimit = 80; go("#/companies"); } };
  q.oninput = () => { if (q.value.length >= 2) { coQuery = q.value; coLimit = 80; go("#/companies"); setTimeout(() => { const s = $("#q"); if (s) { s.focus(); s.setSelectionRange(s.value.length, s.value.length); } }, 30); } };
  homeNearby();
  const hc = $("#hCheck"); if (hc) hc.onclick = () => checkIn(nx.key);
  const ca = $("#calAll"); if (ca) ca.onclick = e => { e.preventDefault(); addAllMeetingsToCalendar(); };
  const ROUTES = {note: k => `#/add/note/${k}`, call: k => `#/call/${k}`, action: k => `#/add/action/${k}`, meeting: k => `#/add/meeting/${k}`, sign: k => `#/sign/${k}`, pack: k => `#/pack/${k}/new`};
  v.querySelectorAll("[data-q]").forEach(b => b.onclick = () => {
    const kind = b.dataset.q, title = {note: "Note for…", call: "Log a call with…", action: "Action for…", meeting: "Visit at…", photo: "Photo for…", sign: "Sign-off for…", pack: "Cost per pack for…"}[kind];
    const pick = k => { closeSheet(); if (kind === "photo") return takePhoto(k); go(ROUTES[kind](encodeURIComponent(k))); };
    if (nc) openSheet(`<b style="font-size:17px">${esc(title)}</b><a class="row" data-pk1="1" style="margin-top:8px"><div class="m"><div class="t">${esc(nc.name)}</div><div class="s">${esc(nx.why)}</div></div><span class="chev">›</span></a>
        <button class="btn block sec" id="other" style="margin-top:8px">Someone else…</button>`, el => {
        el.querySelector("[data-pk1]").onclick = () => pick(nx.key); el.querySelector("#other").onclick = () => pickCompany(title, pick); });
    else pickCompany(title, pick);
  });
});

// "Near you now": only if you've already allowed location (it never asks from Home), closest 3 customers within 3 miles.
async function homeNearby() {
  const host = $("#homeNear"); if (!host || !navigator.permissions || !navigator.geolocation) return;
  try { const p = await navigator.permissions.query({name: "geolocation"}); if (p.state !== "granted") return; } catch (e) { return; }
  let here; try { here = await hereNow(8000); } catch (e) { return; }
  const near = scope().map(c => ({c, g: geoOf(companyPostcode(c._key))})).filter(x => x.g).map(x => ({c: x.c, d: miles(here, x.g)})).filter(x => x.d <= 3).sort((a, b) => a.d - b.d).slice(0, 3);
  if (!near.length || !$("#homeNear")) return;
  $("#homeNear").innerHTML = `<h2>📍 Near you now <a class="r small" href="#/nearby">All ›</a></h2><div class="list">${near.map(x => `<a class="row" href="${coHref(x.c._key)}"><div class="m"><div class="t">${esc(x.c.name)}${isQuiet(x.c) ? ' <span class="chip">🛋 lead</span>' : ""}</div><div class="s">${x.d.toFixed(1)} mi away${(() => { const n = openActions(x.c._key).length; return n ? ` · ${n} open action${n === 1 ? "" : "s"}` : ""; })()}</div></div><span class="chev">›</span></a>`).join("")}</div>`;
}

// ---------- 🩺 MISSING INFO — the phone's version of the CRM's data health check ----------
// Lobby leads are left out (they're allowed to be bare). Anything you add here goes to the CRM at the next sync.
const GAP_KINDS = [["postcode", "📍", "No postcode", "Address"], ["contact", "👤", "No contact", "Contact"], ["number", "📞", "No phone number", "Number"], ["email", "✉️", "No email", "Email"]];
function companyGaps(c) {
  const k = c._key, ppl = people(k), g = [];
  if (!companyPostcode(k)) g.push("postcode");
  if (!ppl.length) g.push("contact");
  else { if (!ppl.some(p => p.numbers.some(n => dialable(n.number)))) g.push("number"); if (!ppl.some(p => p.emails.length)) g.push("email"); }
  return g;
}
function gapList() { return scope().filter(c => !isQuiet(c)).map(c => ({c, g: companyGaps(c)})).filter(x => x.g.length); }
let gapFilter = "";
route(/^#\/health$/, () => {
  setHeader("Missing info", "#/home", "home");
  const v = $("#view");
  if (!SNAP && !PENDING.length) { v.innerHTML = welcomeCard(); return; }
  const all = gapList(), count = k => all.filter(x => x.g.includes(k)).length;
  const list = (gapFilter ? all.filter(x => x.g.includes(gapFilter)) : all).sort((a, b) => b.g.length - a.g.length || a.c.name.localeCompare(b.c.name));
  const fix = (c, kind) => { const k = encodeURIComponent(c._key), mc = mainContact(c._key);
    return kind === "postcode" ? `#/add/address/${k}` : kind === "contact" ? `#/add/contact/${k}` : `#/add/contact/${k}${mc ? "?name=" + encodeURIComponent(mc.name) : ""}`; };
  v.innerHTML = `<div class="small" style="margin:2px 4px 8px">${all.length ? `${all.length} of your ${META.filter === "all" ? "" : "own "}customers are missing something. Postcodes matter most: Nearby, routes and mileage use them. Lobby leads aren't included.` : "✓ Every customer has a postcode, a contact, a number and an email."}</div>
    <div class="scrollx" style="padding-top:0"><button class="fchip ${gapFilter ? "" : "on"}" data-gf="">All ${all.length}</button>${GAP_KINDS.map(([k, i, l]) => `<button class="fchip ${gapFilter === k ? "on" : ""}" data-gf="${k}">${i} ${l} ${count(k)}</button>`).join("")}</div>
    <div class="list" style="margin-top:8px">${list.slice(0, 150).map(({c, g}) => `<div class="row"><a class="m" href="${coHref(c._key)}" style="color:inherit"><div class="t">${esc(c.name)}</div>
        <div class="s">${g.map(k => GAP_KINDS.find(x => x[0] === k)).map(x => x[1] + " " + x[2].replace(/^No /, "no ")).join(" · ")}</div></a>
        <a class="btn sm" href="${fix(c, gapFilter || g[0])}" style="flex:none">＋ ${GAP_KINDS.find(x => x[0] === (gapFilter || g[0]))[3]}</a></div>`).join("") || '<div class="empty">Nothing missing here.</div>'}</div>
    ${list.length > 150 ? `<div class="small" style="text-align:center;margin:8px">Showing the first 150 of ${list.length}.</div>` : ""}
    <p class="small" style="margin:10px 4px">For duplicates and untagged products, use 🩺 Data health on the PC.</p>`;
  v.querySelectorAll("[data-gf]").forEach(b => b.onclick = () => { gapFilter = b.dataset.gf; render(); });
});

// ---------- ⋯ MORE: everything that isn't one of the four tabs, one tap away ----------
route(/^#\/more$/, () => {
  setHeader("More", null, "more");
  const n = PENDING.length;
  const stick = ((SNAP && SNAP.stickies) || []).length + PENDING.filter(e => e.type === "sticky_new").length;
  const gaps = (SNAP || PENDING.length) ? gapList().length : 0;
  const t = (href, icon, col, title, sub, badge) => `<a class="mtile" href="${href}"><span class="mi" style="background:${col}">${icon}</span>
    <div><b>${title}</b><br><span class="s">${sub}</span></div>${badge ? `<span class="bdg">${badge}</span>` : ""}</a>`;
  const snapAge = SNAP && SNAP.exported_at ? niceDate(String(SNAP.exported_at).slice(0, 10)) + " " + String(SNAP.exported_at).slice(11, 16) : "never";
  $("#view").innerHTML = `
    <a class="card" href="#/sync" style="display:flex;align-items:center;gap:12px;color:inherit">
      <span class="mi" style="width:44px;height:44px;border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:22px;background:${n ? "var(--amber)" : "var(--green)"};color:#fff">${n ? "⬆" : "✓"}</span>
      <div style="flex:1"><b>${n ? `${n} change${n === 1 ? "" : "s"} waiting to send` : "All synced"}</b><div class="small">CRM data from ${esc(snapAge)} · tap to sync</div></div><span class="chev">›</span></a>
    <h2>Selling</h2>
    <div class="mgrid">
      ${t("#/prices", "💷", "#7c3aed", "Prices & tools", "Price list, calculators")}
      ${t("#/pack", "🧮", "#0f766e", "Cost per pack", "Packs per roll, cost per pack")}
      ${t("#/card", "🪪", "#d7182a", "My business card", "Show your QR to be saved")}
      ${t("#/videos", "🎬", "#0d9488", "Videos", "Machine demos to show")}
    </div>
    <h2>Out and about</h2>
    <div class="mgrid">
      ${t("#/nearby", "📍", "#ea580c", "Nearby", "Customers near you now")}
      ${t("#/mileage", "🚗", "#2563eb", "Mileage", "Miles by day and month")}
      ${t("#/wrap", "🌙", "#334155", "Wrap up the day", "Write-ups, miles, tomorrow")}
      ${t("#/dropin", "🚪", "#64748b", "Drop-in visit", "Popped in somewhere new")}
    </div>
    <h2>Keeping tidy</h2>
    <div class="mgrid">
      ${t("#/board", "📌", "#f59e0b", "Notice board", stick ? `${stick} sticky note${stick === 1 ? "" : "s"}` : "Jot a sticky for the PC")}
      ${t("#/health", "🩺", "#16a34a", "Missing info", gaps ? `${gaps} customer${gaps === 1 ? "" : "s"} to tidy` : "All complete")}
      ${t("#/sync", "🔄", "#0891b2", "Sync", "Send changes, load the CRM", n || "")}
      ${t("#cal", "📅", "#e11d2e", "Meetings → Calendar", `${upcomingMeetings().length} upcoming · no doubles`)}
    </div>
    <p class="small" style="text-align:center;margin:18px 0 6px">Kempner Mobile · v29</p>`;
  const cal = $("#view").querySelector('[href="#cal"]');
  if (cal) cal.onclick = e => { e.preventDefault(); addAllMeetingsToCalendar(); };
});
