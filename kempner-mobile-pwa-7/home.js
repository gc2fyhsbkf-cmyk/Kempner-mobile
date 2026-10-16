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
  const nx = SNAP || PENDING.length ? upNext() : null, nc = nx && IDX.co.get(nx.key);
  const mc = nc ? mainContact(nx.key) : null, addr = nc ? rows("addresses", nx.key)[0] : null;
  const tiles = [["📝", "Note", "#4f46e5", "note"], ["📞", "Log call", "#0891b2", "call"], ["✅", "Action", "#16a34a", "action"],
    ["🤝", "Visit", "#2563eb", "meeting"], ["📷", "Photo", "#db2777", "photo"], ["🏢", "New lead", "#64748b", "#/newco"], ["📍", "Nearby", "#0d9488", "#/nearby"], ["🧮", "Cost/pack", "#0f766e", "pack"]];
  v.innerHTML = `
    <div style="margin:2px 4px 10px"><div style="font-size:22px;font-weight:800">${hi}${first ? ", " + esc(first) : ""}</div>
      <div class="small">${esc(new Date().toLocaleDateString("en-GB", {weekday: "long", day: "numeric", month: "long"}))}</div></div>
    <input class="search" id="hq" type="search" placeholder="🔎 Find a company, person or postcode…" autocomplete="off">
    ${hasCard ? `<a href="#/card/qr" class="homecard" aria-label="Show my business card QR"><div class="bcface">${cardFrontHtml(card)}</div></a>
      <div class="small" style="text-align:center;margin:-2px 0 10px">Tap your card to show the QR · <a href="#/card">front</a></div>`
      : `<a class="banner soft" href="#/card/edit">🪪 <span>Set up your business card (QR people scan to save you)</span><span class="chev">›</span></a>`}
    ${nc ? `<h2>➡️ Up next</h2><div class="card"><div style="font-weight:800;font-size:17px">${esc(nc.name)}</div>
        <div class="small">${esc(nx.why)}${nx.note ? " · " + esc(nx.note) : ""}${addr ? " · " + esc((addr.lines || "").split("\n").slice(-2).join(", ")) : ""}</div>
        <div class="hq4">${addr ? `<a href="https://maps.apple.com/?daddr=${encodeURIComponent((addr.lines || "").replace(/\n/g, ", "))}">🧭<span>Directions</span></a>` : ""}
          <a href="#/brief/${encodeURIComponent(nx.key)}">📋<span>Brief</span></a>
          <button id="hCheck">📍<span>Check in</span></button>
          ${mc && dialable(mc.number) ? `<a href="tel:${esc(digits(mc.number))}" data-call="${esc(nx.key)}" data-num="${esc(mc.number)}">📞<span>Call</span></a>` : ""}</div></div>`
      : `<a class="banner soft" href="#/plan" style="margin-top:4px">🗓 <span>Nothing planned yet today — plan your visits</span><span class="chev">›</span></a>`}
    <h2>⚡ Quick</h2>
    <div class="sgrid">${tiles.map(([i, l, col, k]) => k.startsWith("#") ? `<a href="${k}"><span class="ic" style="background:${col}">${i}</span>${l}</a>`
      : `<button data-q="${k}"><span class="ic" style="background:${col}">${i}</span>${l}</button>`).join("")}</div>
    <div class="list" style="margin-top:14px">
      <a class="row" href="#/"><span style="font-size:22px">📋</span><div class="m"><div class="t">Today</div><div class="s ${over ? "alert" : ""}">${over ? `${over} overdue · ` : ""}${due} due today</div></div><span class="chev">›</span></a>
      <a class="row" href="#/plan"><span style="font-size:22px">🗓</span><div class="m"><div class="t">My day & route</div><div class="s">${((typeof ROAD !== "undefined" && ROAD.plans[localDate()]) || []).length} stops planned</div></div><span class="chev">›</span></a>
      ${PENDING.length ? `<a class="row" href="#/sync"><span style="font-size:22px">⬆️</span><div class="m"><div class="t">${PENDING.length} waiting to send</div><div class="s">Export to the CRM when you're back</div></div><span class="chev">›</span></a>` : ""}
    </div>`;
  const q = $("#hq"); q.onkeydown = e => { if (e.key === "Enter") { coQuery = q.value; coLimit = 80; go("#/companies"); } };
  q.oninput = () => { if (q.value.length >= 2) { coQuery = q.value; coLimit = 80; go("#/companies"); setTimeout(() => { const s = $("#q"); if (s) { s.focus(); s.setSelectionRange(s.value.length, s.value.length); } }, 30); } };
  const hc = $("#hCheck"); if (hc) hc.onclick = () => checkIn(nx.key);
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
