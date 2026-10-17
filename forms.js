"use strict";
/* Kempner Mobile — forms: note, call, action, done, visit, contact, company, quote, order, sign-off, photo, calendar */

function form(title, back, fieldsHtml, saveLabel, onSave, tab = "companies") {
  setHeader(title, back, tab);
  $("#view").innerHTML = `<form id="frm" autocomplete="off">${fieldsHtml}
    <div class="formbar"><button class="btn sec" type="button" id="cancel">Cancel</button><button class="btn green" type="submit" id="saveBtn">${saveLabel}</button></div></form>`;
  $("#cancel").onclick = () => history.back();
  $("#frm").onsubmit = async e => {
    e.preventDefault();
    const fd = {};
    for (const [k, v] of new FormData($("#frm")).entries()) fd[k] = typeof v === "string" ? v.trim() : v;
    const btn = $("#saveBtn"); btn.disabled = true;
    try { const ok = await onSave(fd, $("#frm")); if (ok !== false) { toast("Saved on phone ✓"); history.back(); } }
    catch (err) { toast("Couldn't save: " + err.message, 5000); }
    finally { btn.disabled = false; }
  };
}
const opt = (name, choices, sel, clsFn) => `<div class="opts">${choices.map(([v, l]) => `<label class="${clsFn ? clsFn(v) : ""}"><input type="radio" name="${name}" value="${esc(v)}" ${String(v) === String(sel) ? "checked" : ""}><span>${l}</span></label>`).join("")}</div>`;
const pplList = key => `<datalist id="ppl">${people(key).map(p => `<option value="${esc(p.name)}">`).join("")}</datalist>`;
const mustCo = key => { const c = IDX.co.get(key); if (!c) { go("#/companies"); return null; } return c; };
function statusPicker(c) {
  const st = companyStatus(c);
  return `<label class="f">Update company status (optional)</label>${opt("status", [["", "Keep"], ["URGENT", "Urgent"], ["WARM", "Warm"], ["OK", "OK"], ["COLD", "Cold"]], "", v => "o-" + v)}
    <div class="small" style="margin:4px 2px">Currently: <b>${esc(st)}</b>. Changes the colour in the CRM too.</div>`;
}

// ---------- NOTE (CRM templates) ----------
const DEFAULT_TEMPLATES = {"General note": [["person","👤 Person","person"],["reference","🔖 Reference","line"],["reason","📌 Reason for call","line"],["notes","📝 Notes","text"]]};
function templateFields(key, fields) {
  return fields.map(([k, label, kind]) => kind === "person" ? `<label class="f">${esc(label)}</label><input class="f" name="t_${k}" list="ppl" value="${esc((mainContact(key) || {}).name || "")}">`
    : kind === "text" ? `<label class="f">${esc(label)}</label><textarea class="f" name="t_${k}" ${k === "notes" ? "" : 'style="min-height:80px"'}></textarea>`
    : `<label class="f">${esc(label)}</label><input class="f" name="t_${k}">`).join("");
}
function buildTemplateNote(fields, fd) { // mirrors the CRM's own compose logic
  let reference = "", person = "", notesTxt = ""; const lines = [];
  for (const [k, label] of fields) { const v = (fd["t_" + k] || "").trim();
    if (k === "reference") { reference = v; continue; } if (k === "person") { person = v; continue; } if (!v) continue;
    if (k === "notes") notesTxt = v; else lines.push(`${label.includes(" ") ? label.split(" ").slice(1).join(" ") : label}: ${v}`); }
  return {content: [lines.join("\n"), notesTxt].filter(Boolean).join("\n\n").trim(), reference, person};
}
route(/^#\/add\/note\/(.+)$/, key => {
  const c = mustCo(key); if (!c) return;
  const T = (SNAP && SNAP.note_templates && Object.keys(SNAP.note_templates).length) ? SNAP.note_templates : DEFAULT_TEMPLATES;
  const names = Object.keys(T);
  form("Note · " + c.name, "#/c/" + key, `${pplList(key)}
    <label class="f">Template</label><select class="f" id="tmpl">${names.map(n => `<option>${esc(n)}</option>`).join("")}</select>
    <div id="tfields"></div>
    <label class="f">Flag</label>${opt("flag", [["4NONE", "None"], ["1RED", "🔴 Urgent"], ["2YELLOW", "🟠 Warm"], ["3GREEN", "🟢 Good"]], "4NONE")}
    ${statusPicker(c)}
    <p class="small">💡 If this replaces older info, just say so — you can tidy up on the PC later.</p>`, "Save note",
    async fd => { const fields = T[$("#tmpl").value] || T[names[0]], n = buildTemplateNote(fields, fd);
      if (!n.content) throw new Error("the note is empty");
      await addEvent("note", key, {content: n.content, customer: n.person, reference: n.reference, tags: "", flag: fd.flag || "4NONE", status: fd.status || ""}); });
  const draw = () => { $("#tfields").innerHTML = templateFields(key, T[$("#tmpl").value] || []); const ta = $("#tfields textarea[name=t_notes]") || $("#tfields textarea"); if (ta) ta.focus(); };
  $("#tmpl").onchange = draw; draw();
});

// ---------- CALL LOG (Live-call prompts) ----------
function offerCallLog(lc) {
  const c = IDX.co.get(lc.key); if (!c) return;
  openSheet(`<b style="font-size:17px">📞 How did the call go?</b><div class="small" style="margin:4px 0 14px">${esc(c.name)}${lc.number ? " · " + esc(lc.number) : ""}</div>
    <a class="btn block green" href="#/call/${encodeURIComponent(lc.key)}">📝 Log this call</a>
    <a class="btn block sec" href="#/add/action/${encodeURIComponent(lc.key)}">✅ Just add a follow-up</a>
    <button class="btn block sec" onclick="closeSheet()">No answer / skip</button>`);
}
route(/^#\/call\/(.+)$/, key => {
  const c = mustCo(key); if (!c) return;
  const prompts = (SNAP && SNAP.call_prompts) || [];
  form("Call · " + c.name, "#/c/" + key, `${pplList(key)}
    <label class="f">Spoke with</label><input class="f" name="person" list="ppl" value="${esc((mainContact(key) || {}).name || "")}">
    <label class="f">What was said</label><textarea class="f" name="notes" placeholder="Summary of the call"></textarea>
    ${prompts.length ? `<div class="prompts"><label class="f">Asked / noted — fill any you covered</label>${prompts.map((p, i) => `<label class="f" style="margin-top:8px">${esc(p)}</label><input class="f" name="p_${i}">`).join("")}</div>` : ""}
    <label class="f">Outcome</label>${opt("flag", [["4NONE", "Neutral"], ["3GREEN", "🟢 Positive"], ["2YELLOW", "🟠 Follow up"], ["1RED", "🔴 Problem"]], "4NONE")}
    ${statusPicker(c)}
    <label class="check"><input type="checkbox" name="follow" id="follow"> Add a follow-up action</label>
    <div id="fu" class="hidden"><div class="two"><div><label class="f">Follow-up</label><input class="f" name="fu_note" placeholder="e.g. Send quote"></div><div><label class="f">When</label><input class="f" type="date" name="fu_date" value="${nextWorkday(7)}"></div></div></div>`, "Save call",
    async fd => {
      const ans = prompts.map((p, i) => [p, fd["p_" + i]]).filter(x => x[1]);
      let content = fd.notes || "";
      if (ans.length) content += (content ? "\n\n" : "") + "Asked / noted:\n" + ans.map(([p, a]) => `  • ${p} — ${a}`).join("\n");
      if (!content) throw new Error("add a summary or answer at least one question");
      await addEvent("note", key, {content: "📞 Phone call\n" + content, customer: fd.person || "", reference: "Phone call", tags: "", flag: fd.flag || "4NONE", status: fd.status || ""});
      if (fd.follow && fd.fu_note) await addEvent("action_new", key, {date: fd.fu_date || nextWorkday(7), time: "", note: fd.fu_note, tier: 2, channel: "call", contact_person: fd.person || ""});
    });
  $("#follow").onchange = e => $("#fu").classList.toggle("hidden", !e.target.checked);
});

// ---------- ACTION ----------
route(/^#\/add\/action\/(.+)$/, key => {
  const c = mustCo(key); if (!c) return;
  const quick = [["Tomorrow", nextWorkday(1)], ["+3 days", nextWorkday(3)], ["+1 week", nextWorkday(7)], ["+2 weeks", nextWorkday(14)], ["+1 month", nextWorkday(30)]];
  form("Action · " + c.name, "#/c/" + key, `${pplList(key)}
    <label class="f">What needs doing?</label><textarea class="f" name="note" required style="min-height:80px" placeholder="e.g. Call about film order"></textarea>
    <div class="scrollx" style="padding-top:8px">${["Check in", "Call about film", "Send quote", "Chase PO", "Book visit", "Keep in touch", "🔧 Annual service due"].map(t => `<button type="button" class="fchip" data-tpl="${esc(t)}">${esc(t)}</button>`).join("")}</div>
    <label class="f">When</label><div class="scrollx" style="padding-top:0">${quick.map(([l, d]) => `<button type="button" class="fchip ${d === quick[0][1] ? "on" : ""}" data-date="${d}">${l}</button>`).join("")}</div>
    <div class="two"><div><label class="f">Date</label><input class="f" type="date" name="date" value="${quick[0][1]}" required></div><div><label class="f">Time (optional)</label><input class="f" type="time" name="time"></div></div>
    <label class="f">Priority</label>${opt("tier", [[1, "⭐ Today"], [2, "Soon"], [3, "Reminder"]], 2)}
    <label class="f">How</label>${opt("channel", [["", "—"], ["call", "📞 Call"], ["email", "✉️ Email"], ["visit", "🚗 Visit"], ["admin", "🗂 Admin"]], "")}
    <label class="f">Contact (optional)</label><input class="f" name="contact_person" list="ppl">`, "Save action",
    async fd => { if (!fd.note) throw new Error("say what needs doing");
      await addEvent("action_new", key, {date: fd.date, time: fd.time || "", note: fd.note, tier: +fd.tier || 2, channel: fd.channel || "", contact_person: fd.contact_person || ""}); });
  const frm = $("#frm");
  frm.querySelectorAll("[data-tpl]").forEach(b => b.onclick = () => { frm.note.value = b.dataset.tpl;
    if (/Annual service/.test(b.dataset.tpl) && frm.date) { const d = new Date(); d.setFullYear(d.getFullYear() + 1); frm.date.value = localDate(d);
      frm.querySelectorAll("[data-date]").forEach(x => x.classList.remove("on")); } });
  frm.querySelectorAll("[data-date]").forEach(b => b.onclick = () => { frm.date.value = b.dataset.date; frm.querySelectorAll("[data-date]").forEach(x => x.classList.toggle("on", x === b)); });
});
route(/^#\/done\/([^/]+)\/(.+)$/, (key, aid) => {
  const c = mustCo(key); if (!c) return;
  const a = actions(key).find(x => x.id === aid);
  if (!a) { toast("Action not found"); return go("#/c/" + encodeURIComponent(key)); }
  form("Mark done", "#/c/" + key, `<div class="card"><div class="small">${niceDate(a.date)} · ${esc(c.name)}</div><div style="font-weight:650;margin-top:2px">${esc(a.note)}</div></div>
    <label class="f">What happened? (optional — saved as a note)</label><textarea class="f" name="outcome" style="min-height:90px"></textarea>
    <label class="f">Next step (optional)</label><input class="f" name="next_note" placeholder="e.g. Chase for PO" value="">
    <div class="scrollx" style="padding-top:8px">${[["Same again next week", 7], ["Same again next month", 30]].map(([l, n]) => `<button type="button" class="fchip" data-again="${n}">${l}</button>`).join("")}</div>
    <label class="f">Next step date</label><input class="f" type="date" name="next_date" value="${nextWorkday(7)}">`, "✓ Mark done",
    async fd => {
      await addEvent("action_done", key, {action_id: a.id, action_note: a.note, outcome: fd.outcome || ""});
      if (fd.next_note) await addEvent("action_new", key, {date: fd.next_date || nextWorkday(7), time: "", note: fd.next_note, tier: a.tier || 2, channel: a.channel || ""});
    }, "today");
  $("#frm").querySelectorAll("[data-again]").forEach(b => b.onclick = () => { const f = $("#frm"); f.next_note.value = a.note; f.next_date.value = nextWorkday(+b.dataset.again); });
});

// ---------- VISIT / MEETING (typed, like the CRM) ----------
const MEETING_PROMPTS = {
  film_trial: ["Kempner spec(s) trialled", "Up against (competitor film)", "Machine(s) used", "How did it run?"],
  commission: ["Machine commissioned", "Customer confirmed ready?", "Anything outstanding?"],
  service: ["Machine(s) serviced", "Parts / tools used", "Work done / findings"],
  machine_demo: ["Machine(s) demoed", "Film used", "Pack details", "Their reaction"],
  check_up: ["What was discussed"],
};
route(/^#\/add\/meeting\/([^/]+)(?:\/(.+))?$/, (key, mid) => {
  const c = mustCo(key); if (!c) return;
  const orig = mid ? rows("meetings", key).find(m => m.id === mid) : null;
  const addr = rows("addresses", key)[0] || {};
  const loc = orig ? orig.location : (addr.city || (addr.lines || "").split("\n").slice(-2).join(", ") || c.region || "");
  form((orig ? "Log meeting · " : "Visit · ") + c.name, "#/c/" + key, `${pplList(key)}
    ${orig ? `<div class="card small">Booked: ${niceDate(orig.date)} ${esc(orig.time || "")} — ${esc(orig.notes || orig.location || "")}</div><input type="hidden" name="status" value="DONE">`
      : `<label class="f">What is it?</label>${opt("status", [["DONE", "✅ Visit done"], ["SCHEDULED", "📅 Book a meeting"]], "DONE")}`}
    <label class="f">Type</label><select class="f" name="meeting_type" id="mtype">${Object.entries(MEETING_TYPES).map(([k, l]) => `<option value="${k}" ${orig && orig.meeting_type === k ? "selected" : ""}>${MEETING_ICON[k]} ${l}</option>`).join("")}</select>
    <div class="two"><div><label class="f">Date</label><input class="f" type="date" name="date" value="${orig ? esc(orig.date) : localDate()}" required></div>
    <div><label class="f">Time</label><input class="f" type="time" name="time" value="${orig ? esc(orig.time || "") : localTime()}"></div></div>
    <label class="f">Location</label><input class="f" name="location" value="${esc(loc)}">
    <label class="f">Who was there</label><input class="f" name="contacts" list="ppl" value="${orig ? esc(orig.contacts || "") : esc((mainContact(key) || {}).name || "")}">
    <div id="typeQs"></div>
    <label class="f">Notes / outcome</label><textarea class="f" name="notes"></textarea>
    <details class="more" ${orig ? "" : "open"}><summary>🏭 Films &amp; machines seen</summary>
      <label class="f">Films seen (comma separated)</label><input class="f" name="films_seen" placeholder="e.g. 19µm POF, competitor 15µm">
      <label class="f">Machines seen (comma separated)</label><input class="f" name="machines_seen">
      <label class="check"><input type="checkbox" name="add_to_equipment" checked> Add them to the company's equipment</label></details>
    <label class="check" id="svcRow"><input type="checkbox" name="annual" checked> 🔧 Add an "annual service due" action for this time next year</label>
    <label class="check"><input type="checkbox" name="follow" id="follow"> Add a follow-up action</label>
    <div id="fu" class="hidden"><div class="two"><div><label class="f">Follow-up</label><input class="f" name="fu_note"></div><div><label class="f">When</label><input class="f" type="date" name="fu_date" value="${nextWorkday(7)}"></div></div></div>
    <label class="check"><input type="checkbox" name="photo_after"> 📷 Take a photo after saving</label>`,
    orig ? "✓ Log as done" : "Save", async fd => {
      const qs = (MEETING_PROMPTS[fd.meeting_type] || []).map((q, i) => [q, fd["q_" + i]]).filter(x => x[1]);
      const notesTxt = [qs.map(([q, a]) => `${q}: ${a}`).join("\n"), fd.notes].filter(Boolean).join("\n\n");
      const d = {date: fd.date, time: fd.time || "", location: fd.location || "", contacts: fd.contacts || "", notes: notesTxt,
        status: fd.status || "DONE", meeting_type: fd.meeting_type || "", films_seen: fd.films_seen || "", machines_seen: fd.machines_seen || "", add_to_equipment: !!fd.add_to_equipment};
      if (orig) d.completes_meeting_id = orig.id;
      await addEvent("meeting", key, d);
      if (fd.meeting_type === "service" && (fd.status || "DONE") === "DONE" && fd.annual) {
        const nd = new Date((fd.date || localDate()) + "T12:00:00"); nd.setFullYear(nd.getFullYear() + 1);
        await addEvent("action_new", key, {date: localDate(nd), time: "", note: `🔧 Annual service due${fd.machines_seen ? " – " + fd.machines_seen : ""}`, tier: 2, channel: "visit", contact_person: fd.contacts || ""});
      }
      if (fd.follow && fd.fu_note) await addEvent("action_new", key, {date: fd.fu_date || nextWorkday(7), time: "", note: fd.fu_note, tier: 2, channel: "", contact_person: fd.contacts || ""});
      if (fd.photo_after) { toast("Saved ✓"); history.back(); setTimeout(() => takePhoto(key), 350); return false; }
    });
  const drawQs = () => { const t = $("#mtype").value; $("#typeQs").innerHTML = (MEETING_PROMPTS[t] || []).map((q, i) => `<label class="f">${esc(q)}</label><input class="f" name="q_${i}">`).join(""); };
  const svc = () => $("#svcRow").classList.toggle("hidden", $("#mtype").value !== "service");
  $("#mtype").onchange = () => { drawQs(); svc(); }; drawQs(); svc();
  $("#follow").onchange = e => $("#fu").classList.toggle("hidden", !e.target.checked);
});

// ---------- CONTACT / COMPANY ----------
route(/^#\/add\/contact\/([^?]+)(?:\?name=(.*))?$/, (key, preName) => {
  const c = mustCo(key); if (!c) return;
  form("Contact · " + c.name, "#/c/" + key, `
    <label class="f">Name</label><input class="f" name="name" required autocapitalize="words" value="${esc(preName || "")}">
    <label class="f">Role / job title</label><input class="f" name="role" list="roles"><datalist id="roles"><option value="Decision maker"><option value="Influencer"><option value="Gatekeeper"><option value="User"></datalist>
    <div class="two"><div><label class="f">Mobile</label><input class="f" type="tel" name="mobile"></div><div><label class="f">Other phone</label><input class="f" type="tel" name="phone2"></div></div>
    <label class="f">Email</label><input class="f" type="email" name="email" autocapitalize="off">
    <p class="small">If this person is already in the CRM, new numbers/emails are added to them — nothing is overwritten.</p>`, "Save contact",
    async fd => { if (!fd.name) throw new Error("name needed");
      const nums = []; if (fd.mobile) nums.push({number: fd.mobile, tag: "mobile"}); if (fd.phone2) nums.push({number: fd.phone2, tag: ""});
      await addEvent("contact_new", key, {name: fd.name, role: fd.role || "", numbers: nums, emails: fd.email ? [fd.email] : []}); });
});
// ---------- ADDRESS ----------
const PC_FULL = /^([A-Z]{1,2}\d[A-Z\d]?)\s*(\d[A-Z]{2})$/i;
route(/^#\/add\/address\/(.+)$/, key => {
  const c = mustCo(key); if (!c) return;
  const has = rows("addresses", key).length;
  form("Address · " + c.name, "#/c/" + key, `
    ${has ? `<div class="banner soft" style="display:block;font-weight:500">They already have ${has === 1 ? "an address" : has + " addresses"} on file. This adds another; the CRM keeps both so you can tidy up there.</div>` : ""}
    <button type="button" class="btn block sec" id="hereBtn">📍 I'm here — fill in from my location</button>
    <div class="small" id="hereMsg" style="margin-top:4px"></div>
    <label class="f">Label</label><select class="f" name="label"><option>Main</option><option>Site</option><option>Warehouse</option><option>Delivery</option><option>Invoice</option><option>Head office</option></select>
    <label class="f">Address line 1</label><input class="f" name="line1" autocapitalize="words">
    <label class="f">Address line 2</label><input class="f" name="line2" autocapitalize="words">
    <div class="two"><div><label class="f">Town / city</label><input class="f" name="city" autocapitalize="words"></div><div><label class="f">County</label><input class="f" name="county" autocapitalize="words"></div></div>
    <label class="f">Postcode</label><input class="f" name="postcode" autocapitalize="characters" placeholder="e.g. LS11 5PS">`, "Save address",
    async fd => {
      const pc = (fd.postcode || "").toUpperCase().replace(/\s+/g, " ").trim(), m = PC_FULL.exec(pc.replace(/\s/g, ""));
      const postcode = m ? (m[1] + " " + m[2]).toUpperCase() : pc;
      if (!fd.line1 && !fd.city && !postcode) throw new Error("add at least a line, town or postcode");
      if (postcode && !m && !confirm(`"${postcode}" doesn't look like a UK postcode. Save it anyway?`)) return false;
      const lines = [fd.line1, fd.line2, fd.city, fd.county, postcode].filter(Boolean).join("\n");
      await addEvent("address_new", key, {label: fd.label || "Main", line1: fd.line1 || "", line2: fd.line2 || "", city: fd.city || "", county: fd.county || "", postcode, lines});
      if (postcode && typeof ensureGeo === "function") ensureGeo([postcode], true);
    }, "companies");
  $("#hereBtn").onclick = () => {
    const msg = $("#hereMsg"); msg.textContent = "Finding where you are…";
    navigator.geolocation.getCurrentPosition(async pos => {
      try {
        const r = await fetch(`https://api.postcodes.io/postcodes?lon=${pos.coords.longitude}&lat=${pos.coords.latitude}&limit=1&radius=300`), j = await r.json(), x = j.result && j.result[0];
        if (!x) { msg.textContent = "No postcode found right here — type it in."; return; }
        const f = $("#frm"); f.postcode.value = x.postcode; if (!f.city.value) f.city.value = x.admin_district || x.parish || "";
        if (!f.county.value && x.admin_county) f.county.value = x.admin_county;
        msg.textContent = `✓ ${x.postcode} (nearest postcode, about ${Math.round(x.distance || 0)} m away) — add the street yourself.`;
      } catch (e) { msg.textContent = "Couldn't look it up (no signal?) — type it in."; }
    }, err => { msg.textContent = err.code === 1 ? "Location is off for this app (Settings → Privacy → Location Services → Safari Websites)." : "Couldn't get your location."; },
    {enableHighAccuracy: true, timeout: 12000, maximumAge: 60000});
  };
});

route(/^#\/newco$/, () => {
  form("New company", "#/companies", `
    <label class="f">Company name</label><input class="f" name="name" id="coName" required autocapitalize="words"><div id="dupe"></div>
    <label class="f">Contact name</label><input class="f" name="contact_name" autocapitalize="words">
    <div class="two"><div><label class="f">Phone</label><input class="f" type="tel" name="phone"></div><div><label class="f">Email</label><input class="f" type="email" name="email" autocapitalize="off"></div></div>
    <label class="f">First note (optional)</label><textarea class="f" name="note" style="min-height:90px"></textarea>
    <label class="check"><input type="checkbox" name="lobby" ${META.seg === LOBBY ? "checked" : ""}> Just a lead for now — put it in the 🛋 Lobby</label>`, "Create company",
    async fd => {
      if (!fd.name) throw new Error("name needed");
      const ev = await addEvent("company_new", null, {name: fd.name, contact_name: fd.contact_name || "", phone: fd.phone || "", email: fd.email || "", segment: fd.lobby ? LOBBY : ""});
      const key = evCoKey(ev);
      if (fd.note) await addEvent("note", key, {content: fd.note, customer: fd.contact_name || "", reference: "", tags: "", flag: "4NONE"});
      toast("Company added ✓"); location.replace(coHref(key)); return false;
    });
  const inp = $("#coName");
  inp.oninput = () => { const n = norm(inp.value), box = $("#dupe");
    if (n.length < 3) { box.innerHTML = ""; return; }
    const hits = [...IDX.co.values()].filter(c => norm(c.name).includes(n) || n.includes(norm(c.name))).slice(0, 4);
    box.innerHTML = hits.length ? `<div class="banner soft" style="display:block;font-weight:500">Already on file? ${hits.map(c => `<div><a href="${coHref(c._key)}"><b>${esc(c.name)}</b> ›</a></div>`).join("")}</div>` : ""; };
  setTimeout(() => inp.focus(), 50);
});

// ---------- LINE EDITOR (quotes, orders, sign-off) ----------
// Same narrowing as the PC's quote/order editor: Film → Material → Thickness → Width → CX,
// Machines → Automation → Type → Manufacturer. Plus one-tap "their usual" products.
const CX_YES = v => ["yes", "y", "true", "cx", "1"].includes(String(v || "").trim().toLowerCase());
const numKey = v => { const n = parseFloat(v); return isNaN(n) ? [1, String(v)] : [0, n]; };
const byNum = (a, b) => { const x = numKey(a), y = numKey(b); return x[0] - y[0] || (x[0] ? String(x[1]).localeCompare(String(y[1])) : x[1] - y[1]); };
const uniq = arr => [...new Set(arr.filter(v => v !== "" && v != null))];
function catalogue() {
  if (catalogue._snap === SNAP) return catalogue._c;
  const c = Object.entries((SNAP && SNAP.products) || {}).map(([id, p]) => ({id, name: p.name, section: p.section || "Machines", t: p.tags || {}}));
  catalogue._snap = SNAP; catalogue._c = c; return c;
}
function theirUsual(key) { // products this customer has ordered/quoted, most recent first
  const v = view(key) || {}, seen = new Map();
  const add = (desc, pid, date, price) => { const p = (pid && catalogue().find(x => x.id === String(pid))) || productByName(desc);
    const k = p ? "id:" + p.id : "n:" + desc; if (!seen.has(k)) seen.set(k, {p, name: p ? p.name : desc, date, price}); };
  for (const g of v.order_groups || []) for (const l of g.lines || []) add(l.description, l.product_id, g.order_date, l.unit_price);
  for (const g of v.quote_groups || []) for (const l of g.lines || []) add(l.description, l.product_id, g.date, l.agreed_price || l.quoted_price);
  return [...seen.values()].sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 8);
}
function lineEdHtml() {
  return `<label class="f">Items</label><div id="lines"></div><button type="button" class="btn sec sm" id="addLine">+ Add another item</button>
    <div class="two"><div><label class="f">VAT %</label><input class="f" id="vatPct" type="number" inputmode="decimal" step="any" value="${defaultVatPct()}"></div>
    <div><label class="f">Shipping £</label><input class="f" id="ship" type="number" inputmode="decimal" step="0.01" value="0"></div></div><div class="totals" id="totals"></div>`;
}
function initLineEd(key, mode, onChange) {
  const host = $("#lines");
  const add = () => {
    const d = document.createElement("div"); d.className = "lineed";
    const usual = theirUsual(key);
    const hasFilm = catalogue().some(p => p.section === "Film"), hasMach = catalogue().some(p => p.section === "Machines");
    d.innerHTML = `
      <div class="picked hidden"><div class="pk"><span class="pkn"></span><button type="button" class="btn sm sec chg">Change</button></div></div>
      <div class="picker">
        ${usual.length ? `<div class="small" style="font-weight:700;margin:2px 2px 4px">⭐ Their usual</div><div class="scrollx" style="padding-top:0">${usual.map((u, i) => `<button type="button" class="fchip" data-usual="${i}">${esc(u.name)}${u.price ? ` · ${gbp(u.price)}` : ""}</button>`).join("")}</div>` : ""}
        <div class="seg">${hasFilm ? '<button type="button" data-sec="Film" class="on">🎞 Film</button>' : ""}${hasMach ? `<button type="button" data-sec="Machines" class="${hasFilm ? "" : "on"}">⚙ Machine</button>` : ""}<button type="button" data-sec="search" class="${hasFilm || hasMach ? "" : "on"}">🔎 Search / type</button></div>
        <div class="qf"></div><div class="res"></div>
      </div>
      <div class="lr"><div><label class="f" style="margin-top:4px">Qty</label><input class="f" data-f="qty" type="number" inputmode="decimal" step="any" value="1"></div>
        <div><label class="f" style="margin-top:4px">£ each (ex VAT)</label><input class="f" data-f="price" type="number" inputmode="decimal" step="0.01"></div>
        <button type="button" class="x" title="Remove item">✕</button></div><div class="hint"></div>`;
    host.appendChild(d);
    const st = {sec: hasFilm ? "Film" : hasMach ? "Machines" : "search", f: {material: "", thickness: "", width: "", cx: "Any"}, m: {automation: "", type: "", manufacturer: ""}, q: "", chosen: null};
    const mats = uniq(catalogue().filter(p => p.section === "Film").map(p => p.t.material)).sort();
    st.f.material = mats.includes("Polyolefin") ? "Polyolefin" : (mats[0] || "");
    const price = d.querySelector("[data-f=price]"), hint = d.querySelector(".hint");
    const sel = (field, label, opts, cur) => `<div><label class="f" style="margin-top:6px">${label}</label><select class="f" data-q="${field}"><option value="">${opts.length ? "Any" : "—"}</option>${opts.map(o => `<option ${String(o) === String(cur) ? "selected" : ""}>${esc(o)}</option>`).join("")}</select></div>`;
    const choose = (p, name, lastPx) => {
      st.chosen = p ? {id: p.id, name: p.name, section: p.section} : {id: null, name, section: st.sec === "Machines" ? "Machines" : "Film"};
      d.querySelector(".pkn").innerHTML = `${st.chosen.section === "Machines" ? "⚙" : "🎞"} <b>${esc(st.chosen.name)}</b>`;
      d.querySelector(".picked").classList.remove("hidden"); d.querySelector(".picker").classList.add("hidden");
      const lp = lastPx || lastPrice(key, st.chosen.name);
      if (lp && !price.value) price.value = lp;
      hint.textContent = p ? ("✓ In your catalogue" + (lp ? ` · they last paid ${gbp(lp)}` : "")) : (mode === "quote" ? "Not in catalogue — saved as typed" : "Not in catalogue — added to Products when imported");
      update(); if (!price.value) price.focus();
    };
    const drawQF = () => {
      d.querySelectorAll(".seg button").forEach(b => b.classList.toggle("on", b.dataset.sec === st.sec));
      const qf = d.querySelector(".qf"), res = d.querySelector(".res");
      let matches = [];
      if (st.sec === "Film") {
        const films = catalogue().filter(p => p.section === "Film");
        const inMat = films.filter(p => !st.f.material || p.t.material === st.f.material);
        const ths = uniq(inMat.map(p => p.t.thickness)).sort(byNum);
        const inTh = inMat.filter(p => !st.f.thickness || p.t.thickness === st.f.thickness);
        const wds = uniq(inTh.map(p => p.t.width)).sort(byNum);
        qf.innerHTML = `<div class="two">${sel("material", "Material", mats, st.f.material)}${sel("thickness", "Thickness µm", ths, st.f.thickness)}</div>
          <div class="two">${sel("width", "Width mm", wds, st.f.width)}<div><label class="f" style="margin-top:6px">CX</label><select class="f" data-q="cx">${["Any", "CX only", "Non-CX"].map(o => `<option ${o === st.f.cx ? "selected" : ""}>${o}</option>`).join("")}</select></div></div>`;
        matches = inTh.filter(p => (!st.f.width || p.t.width === st.f.width) && (st.f.cx === "Any" || (st.f.cx === "CX only") === CX_YES(p.t.cx)));
        matches.sort((a, b) => byNum(a.t.thickness, b.t.thickness) || byNum(a.t.width, b.t.width) || byNum(a.t.length, b.t.length));
        if (!st.f.thickness) { res.innerHTML = `<div class="small" style="margin:8px 2px">Pick a thickness, then a width — ${inMat.length} ${esc(st.f.material || "film")} specs.</div>`; return; }
      } else if (st.sec === "Machines") {
        const ms = catalogue().filter(p => p.section === "Machines");
        const autos = uniq(ms.map(p => p.t.automation)).sort();
        const inA = ms.filter(p => !st.m.automation || p.t.automation === st.m.automation);
        const types = uniq(inA.map(p => p.t.type)).sort();
        const inT = inA.filter(p => !st.m.type || p.t.type === st.m.type);
        const mfrs = uniq(inT.map(p => p.t.manufacturer)).sort();
        qf.innerHTML = `<div class="two">${sel("automation", "Automation", autos, st.m.automation)}${sel("type", "Type", types, st.m.type)}</div><div class="two">${sel("manufacturer", "Manufacturer", mfrs, st.m.manufacturer)}<div></div></div>`;
        matches = inT.filter(p => !st.m.manufacturer || p.t.manufacturer === st.m.manufacturer).sort((a, b) => a.name.localeCompare(b.name));
      } else {
        qf.innerHTML = `<input class="f" data-q="q" placeholder="Type any part — e.g. 19 450 cx" value="${esc(st.q)}" autocomplete="off" style="margin-top:8px">`;
        const terms = st.q.toLowerCase().split(/\s+/).filter(Boolean);
        matches = terms.length ? catalogue().filter(p => { const n = p.name.toLowerCase().replace(/µm/g, " ").replace(/mm|m\b/g, " "); return terms.every(t => p.name.toLowerCase().includes(t) || n.includes(t)); }) : [];
      }
      res.innerHTML = `${matches.length > 1 || st.sec === "search" ? `<div class="small" style="margin:8px 2px 4px">${matches.length} match${matches.length === 1 ? "" : "es"}${matches.length > 12 ? " — narrow it down or tap one" : ""}</div>` : ""}
        <div class="reslist">${matches.slice(0, 12).map(p => `<button type="button" class="resbtn" data-pid="${esc(p.id)}">${esc(p.name)}${lastPrice(key, p.name) ? `<span class="small"> · ${gbp(lastPrice(key, p.name))}</span>` : ""}</button>`).join("")}</div>
        ${st.sec === "search" && st.q.trim() ? `<button type="button" class="btn sm sec" data-typed="1" style="margin-top:6px">Use “${esc(st.q.trim())}” as typed</button>` : ""}
        ${!matches.length && st.sec !== "search" ? `<div class="small" style="margin:8px 2px">Nothing in the catalogue with that combination.</div>` : ""}`;
      if (matches.length === 1 && st.sec === "Film" && st.f.thickness && st.f.width) choose(matches[0]);
    };
    d.querySelector(".picker").addEventListener("change", e => { const q = e.target.dataset.q; if (!q || q === "q") return;
      if (st.sec === "Film") { st.f[q] = e.target.value || (q === "cx" ? "Any" : ""); if (q === "material") { st.f.thickness = ""; st.f.width = ""; } if (q === "thickness") st.f.width = ""; }
      else { st.m[q] = e.target.value; if (q === "automation") { st.m.type = ""; st.m.manufacturer = ""; } if (q === "type") st.m.manufacturer = ""; }
      drawQF(); });
    d.querySelector(".picker").addEventListener("input", e => { if (e.target.dataset.q !== "q") return; st.q = e.target.value;
      const pos = e.target.selectionStart; drawQF(); const i = d.querySelector("[data-q=q]"); i.focus(); try { i.setSelectionRange(pos, pos); } catch (_) {} });
    d.querySelector(".picker").addEventListener("click", e => {
      const s = e.target.closest("[data-sec]"); if (s) { st.sec = s.dataset.sec; drawQF(); if (st.sec === "search") d.querySelector("[data-q=q]").focus(); return; }
      const r = e.target.closest("[data-pid]"); if (r) { choose(catalogue().find(p => p.id === r.dataset.pid)); return; }
      const u = e.target.closest("[data-usual]"); if (u) { const x = usual[+u.dataset.usual]; choose(x.p, x.name, x.price); return; }
      if (e.target.closest("[data-typed]")) choose(productByName(st.q.trim()), st.q.trim());
    });
    d.querySelector(".chg").onclick = () => { st.chosen = null; d.querySelector(".picked").classList.add("hidden"); d.querySelector(".picker").classList.remove("hidden"); hint.textContent = ""; update(); };
    d.querySelector(".x").onclick = () => { if (host.children.length > 1) { d.remove(); update(); } else { d.querySelector(".chg").click(); price.value = ""; } };
    d.querySelectorAll("[data-f]").forEach(i => i.addEventListener("input", update));
    d._get = () => st.chosen;
    d._set = (ln) => { const p = (ln.product_id && catalogue().find(x => x.id === String(ln.product_id))) || productByName(ln.description);
      st.sec = ln.section === "Machines" ? "Machines" : (p ? p.section : "Film"); choose(p, ln.description, ln.price);
      d.querySelector("[data-f=qty]").value = ln.quantity; if (ln.price != null) price.value = ln.price; update(); };
    drawQF();
    return d;
  };
  const read = () => [...host.children].map(d => { const c = d._get(); if (!c) return null;
    return {product_id: c.id ? +c.id : null, product_name: c.name, description: c.name, section: c.section || "Film",
      quantity: +d.querySelector("[data-f=qty]").value || 0, price: +d.querySelector("[data-f=price]").value || 0}; }).filter(Boolean);
  const vat = () => (+($("#vatPct").value) || 0) / 100, ship = () => +($("#ship").value) || 0;
  const calc = () => lineCalc(read().map(l => ({quantity: l.quantity, unit_price: l.price})), vat(), ship());
  function update() { const c = calc();
    $("#totals").innerHTML = `<div><span>Goods</span><span>${gbp(c.subtotal)}</span></div>${c.shipping_cost ? `<div><span>Shipping</span><span>${gbp(c.shipping_cost)}</span></div>` : ""}
      <div><span>VAT</span><span>${gbp(c.vat_amount)}</span></div><div class="gt"><span>Total</span><span>${gbp(c.grand_total)}</span></div>`;
    if (onChange) onChange(); }
  add();
  // pre-fill (e.g. converting a quote): every line with its product, quantity and agreed price
  const load = (lines, vatRate, shipping) => {
    lines.forEach((ln, i) => { const d = i === 0 ? host.children[0] : add(); d._set(ln); });
    if (vatRate != null) $("#vatPct").value = num(vatRate * 100); if (shipping != null) $("#ship").value = shipping; update(); };
  $("#addLine").onclick = () => { add().scrollIntoView({behavior: "smooth", block: "center"}); };
  ["vatPct", "ship"].forEach(id => $("#" + id).addEventListener("input", update));
  update();
  return {read, vat, ship, calc, load};
}
// A quote by its key: a CRM quote's group_key, or "ev:<id>" for one made on this phone and not synced yet.
function findQuote(key, qk) {
  if (String(qk).startsWith("ev:")) return pendingGroups(key, "quote_new").find(g => g._pending.id === qk.slice(3)) || null;
  return ((view(key) || {}).quote_groups || []).find(g => String(g.group_key) === String(qk)) || null;
}
const quoteKeyOf = g => g._pending ? "ev:" + g._pending.id : String(g.group_key || "");
function quoteConverted(key, g) {
  const qk = quoteKeyOf(g);
  return String(g.status || "").toLowerCase() === "won"
    || ((view(key) || {}).order_groups || []).some(o => o.quote_id && String(o.quote_id) === String(g.group_key))
    || pend(key, "order_new").some(e => e.data.from_quote && e.data.from_quote.key === qk);
}
route(/^#\/add\/quote\/(.+)$/, key => {
  const c = mustCo(key); if (!c) return; let ed;
  const sts = (SNAP && SNAP.quote_statuses) || ["Pending", "Accepted", "Rejected", "Expired", "Counter-offered", "On hold"];
  form("Quote · " + c.name, "#/c/" + key + "/commercial", `
    <div class="two"><div><label class="f">Date</label><input class="f" type="date" name="date" value="${localDate()}"></div>
    <div><label class="f">Status</label><select class="f" name="status">${sts.map(x => `<option>${esc(x)}</option>`).join("")}</select></div></div>
    ${lineEdHtml()}
    <div class="two"><div><label class="f">Chase on</label><input class="f" type="date" name="follow_up_date" value="${nextWorkday(7)}"></div><div><label class="f">Quote no.</label><input class="f" name="quote_number"></div></div>
    <label class="f">Up against (competitor)</label><input class="f" name="competitor">
    <label class="f">Notes</label><textarea class="f" name="notes" style="min-height:70px"></textarea>
    <label class="check"><input type="checkbox" name="chase" checked> Add a "chase quote" action on the chase date</label>`, "Save quote",
    async fd => { const ls = ed.read(); if (!ls.length) throw new Error("add at least one item"); const t = ed.calc();
      await addEvent("quote_new", key, {date: fd.date || localDate(), status: fd.status || "Pending", follow_up_date: fd.follow_up_date || "", quote_number: fd.quote_number || "",
        competitor: fd.competitor || "", notes: fd.notes || "", vat_rate: ed.vat(), shipping_cost: ed.ship(),
        lines: ls.map(l => ({product_id: l.product_id, product_name: l.product_name, description: l.description, section: l.section, quantity: l.quantity, quoted_price: l.price, agreed_price: null}))});
      if (fd.chase && fd.follow_up_date) await addEvent("action_new", key, {date: fd.follow_up_date, time: "", note: `Chase quote – ${ls.map(l => `${num(l.quantity)}× ${l.description}`).join(", ")} (${gbp(t.grand_total)})`, tier: 2, channel: "call"}); });
  ed = initLineEd(key, "quote");
});
route(/^#\/add\/order\/([^?]+)(?:\?from=(.+))?$/, (key, fromQ) => {
  const c = mustCo(key); if (!c) return; let ed;
  const q = fromQ ? findQuote(key, fromQ) : null;
  if (fromQ && !q) toast("That quote isn't on the phone any more — starting a blank order");
  const qLabel = q ? (q.quote_number ? `quote ${q.quote_number}` : `the quote of ${niceDate(q.date)}`) : "";
  form((q ? "Quote → order · " : "Order · ") + c.name, "#/c/" + key + "/commercial", `
    ${q ? `<div class="banner soft" style="display:block;font-weight:500">🔁 Converting ${esc(qLabel)} — every item, quantity and agreed price is copied in. Change anything they've altered (e.g. fewer rolls).</div>` : ""}
    <label class="f">Order date</label><input class="f" type="date" name="order_date" value="${localDate()}">
    ${lineEdHtml()}
    <label class="f">PO number / notes</label><textarea class="f" name="notes" style="min-height:70px" placeholder="e.g. PO 12345, deliver to the back gate"></textarea>
    ${q ? '<label class="check"><input type="checkbox" name="won" checked> Mark the quote as Won</label>' : ""}`, "Save order",
    async fd => { const ls = ed.read(); if (!ls.length) throw new Error("add at least one item");
      const notes = [fd.notes || "", q ? `Converted from ${qLabel}` : ""].filter(Boolean).join(" · ");
      await addEvent("order_new", key, {order_date: fd.order_date || localDate(), notes, vat_rate: ed.vat(), shipping_cost: ed.ship(),
        from_quote: q ? {key: fromQ, group_key: q._pending ? null : q.group_key, event_id: q._pending ? q._pending.id : null, quote_number: q.quote_number || "", mark_won: !!fd.won} : null,
        lines: ls.map(l => ({product_id: l.product_id, product_name: l.product_name, description: l.description, section: l.section, quantity: l.quantity, unit_price: l.price}))}); });
  ed = initLineEd(key, "order");
  if (q) ed.load((q.lines || []).map(l => ({product_id: l.product_id, description: l.description || l.product_name, section: l.section,
    quantity: l.quantity, price: +(l.agreed_price || l.quoted_price || 0)})), q.vat_rate, q.shipping_cost || 0);
});

// ---------- SIGN-OFF SHEETS ----------
const SHEET_TYPES = {
  left: {label: "Goods left on site", title: "Goods Left on Site - Customer Acknowledgement", lines: true, order: true, invoice: true,
    text: (items, total, terms) => `${items || "Goods"} left on site, total ${total} including VAT${terms ? `, to be invoiced and paid ${terms}` : ""}.`,
    confirm: "I confirm the goods listed above have been received and left on site, and I agree to the terms stated."},
  delivery: {label: "Delivery note", title: "Delivery Note - Proof of Delivery", lines: true, order: false, invoice: false,
    text: (items) => `${items || "The goods listed"} delivered and received in good condition.`,
    confirm: "I confirm the goods listed above have been delivered and received in good condition."},
  trial: {label: "Film trial agreement", title: "Film Trial Agreement", lines: true, order: false, invoice: false,
    text: (items) => `${items || "Trial film"} supplied for a trial on site. Any film not used will be collected, or invoiced at the price shown if kept.`,
    confirm: "I confirm receipt of the trial material above and agree to the trial terms stated."},
  collect: {label: "Collection / returns", title: "Collection / Returns Note", lines: true, order: false, invoice: false,
    text: (items) => `${items || "The items listed"} collected from site by Kempner.`,
    confirm: "I confirm the items listed above have been handed over for collection."},
  work: {label: "Work completed (service / commission)", title: "Work Completed - Customer Sign-off", lines: false, order: false, invoice: false,
    text: () => `Work carried out today:\n`, confirm: "I confirm the work described above has been completed to my satisfaction."},
};
route(/^#\/sign\/([^/]+)(?:\/(\w+))?$/, (key, typeArg) => {
  const c = mustCo(key); if (!c) return;
  const type = SHEET_TYPES[typeArg] ? typeArg : "left", ST = SHEET_TYPES[type];
  loadJsPDF().catch(() => {});
  const mc = mainContact(key), rep = META.user || (SNAP && SNAP.current_user) || "";
  let ed = null;
  form("Sign-off · " + c.name, "#/c/" + key, `${pplList(key)}
    <label class="f">Sheet type</label><select class="f" id="stype">${Object.entries(SHEET_TYPES).map(([k, s]) => `<option value="${k}" ${k === type ? "selected" : ""}>${esc(s.label)}</option>`).join("")}</select>
    <div class="two"><div><label class="f">Customer name (signing)</label><input class="f" name="person" list="ppl" value="${esc(mc ? mc.name : "")}" required></div><div><label class="f">Position</label><input class="f" name="position"></div></div>
    ${ST.lines ? lineEdHtml() : ""}
    ${type === "left" ? `<label class="f">Payment</label><select class="f" id="terms"><option>later today</option><option>on receipt of invoice</option><option>within 7 days</option><option>within 30 days</option><option value="">(write my own)</option></select>` : ""}
    <label class="f">Wording on the sheet (edit freely)</label><textarea class="f" name="statement" id="stmt" style="min-height:110px"></textarea>
    ${ST.order ? `<label class="check"><input type="checkbox" name="log_order" checked> Also log this as an order in the CRM</label>` : ""}
    ${ST.invoice ? `<label class="check"><input type="checkbox" name="invoice_action" checked> Add an action for today: raise the invoice</label>` : ""}
    <label class="f">Signed for Kempner by</label><input class="f" name="rep" value="${esc(rep)}">
    <label class="f">Customer signature</label>
    <div class="sigwrap"><canvas id="sig"></canvas><div class="ln"></div><div class="lbl">Sign here with a finger</div></div>
    <button type="button" class="btn sec sm" id="sigClear" style="margin-top:6px">Clear signature</button>`, "✍️ Create signed PDF",
    async fd => {
      const ls = ed ? ed.read() : [];
      if (ST.lines && !ls.length) throw new Error("add at least one item");
      if (pad.isEmpty()) throw new Error("the customer hasn't signed yet");
      if (!fd.statement) throw new Error("the wording is empty");
      await loadJsPDF();
      const now = new Date(), calc = ed ? ed.calc() : null, addr = rows("addresses", key)[0], ref = uuid().slice(0, 8).toUpperCase();
      const pdf = makeSignoffPdf({title: ST.title, confirm: ST.confirm, company: c.name, addressLines: addr ? String(addr.lines || "").split("\n") : [], person: fd.person, position: fd.position || "",
        dateText: longDate(now), timeText: localTime(now), lines: ls, calc, vatRate: ed ? ed.vat() : 0, statement: fd.statement, sig: pad.png(), rep: fd.rep || rep, ref});
      const filename = `Kempner ${ST.label} - ${c.name} - ${localDate(now)}.pdf`.replace(/[\\/:*?"<>|]/g, "-");
      const ev = await addEvent("signoff", key, {sheet_type: type, sheet_title: ST.title, person: fd.person, position: fd.position || "", statement: fd.statement, rep: fd.rep || rep, ref,
        lines: ls.map(l => ({description: l.description, quantity: l.quantity, unit_price: l.price})), vat_rate: ed ? ed.vat() : 0, shipping_cost: ed ? ed.ship() : 0,
        total: calc ? calc.grand_total : 0, filename, pdf_b64: pdf});
      if (fd.log_order) await addEvent("order_new", key, {order_date: localDate(now), notes: `Left on site – signed by ${fd.person} (ref ${ref})`, vat_rate: ed.vat(), shipping_cost: ed.ship(),
        lines: ls.map(l => ({product_id: l.product_id, product_name: l.product_name, description: l.description, section: l.section, quantity: l.quantity, unit_price: l.price}))});
      if (fd.invoice_action) await addEvent("action_new", key, {date: localDate(now), time: "", note: `Raise invoice – ${ls.map(l => `${num(l.quantity)}× ${l.description}`).join(", ")} (${gbp(calc.grand_total)} inc VAT), signed by ${fd.person}, payment ${($("#terms") || {}).value || "as agreed"}`, tier: 1, channel: "admin"});
      location.replace(`#/signed/${encodeURIComponent(key)}/${ev.id}`); return false;
    });
  $("#stype").onchange = e => location.replace(`#/sign/${encodeURIComponent(key)}/${e.target.value}`);
  const stmt = $("#stmt"); let touched = false;
  const auto = () => { if (touched) return;
    const ls = ed ? ed.read() : [], calc = ed ? ed.calc() : {grand_total: 0}, terms = $("#terms") ? $("#terms").value : "";
    const items = ls.map(l => `${num(l.quantity)} ${/film|µ|mu|micron|\d+mm/i.test(l.description) ? (l.quantity == 1 ? "roll" : "rolls") + " of" : "x"} ${l.description} at ${gbp(l.price)} each`).join("; ");
    stmt.value = ST.text(items, gbp(calc.grand_total), terms); };
  if (ST.lines) ed = initLineEd(key, "order", auto);
  stmt.addEventListener("input", () => { touched = true; });
  if ($("#terms")) $("#terms").addEventListener("change", () => { if (!$("#terms").value) { touched = true; stmt.focus(); } else auto(); });
  const pad = sigPad($("#sig"));
  $("#sigClear").onclick = () => pad.clear();
  auto();
});
route(/^#\/signed\/([^/]+)\/(.+)$/, (key, id) => {
  const ev = PENDING.find(x => x.id === id), c = IDX.co.get(key);
  if (!ev || !c) return go(coHref(key));
  setHeader("Signed ✓", coHref(key), "companies");
  const mc = mainContact(key);
  $("#view").innerHTML = `<div class="card" style="text-align:center;padding:24px 16px"><div style="font-size:46px">✅</div><h3 style="margin:6px 0">Signed by ${esc(ev.data.person)}</h3>
    <p class="small">Saved on the phone. On your next sync it goes into the CRM, with the PDF attached to ${esc(c.name)}.</p>
    <button class="btn block red" id="shareP">📤 Email / share the PDF</button>
    ${mc && mc.email ? `<p class="small" style="margin:2px 0 8px">Their email: <b>${esc(mc.email)}</b> <button class="copy" data-copy="${esc(mc.email)}">⧉ copy</button></p>` : ""}
    <button class="btn block sec" id="openP">📄 View PDF</button><a class="btn block sec" href="${coHref(key)}">Back to ${esc(c.name)}</a></div>`;
  $("#shareP").onclick = () => sharePdf(ev.data.pdf_b64, ev.data.filename);
  $("#openP").onclick = () => { const u = URL.createObjectURL(dataUriToFile(ev.data.pdf_b64, ev.data.filename, "application/pdf")); window.open(u, "_blank") || (location.href = u); };
});

// ---------- PHOTOS ----------
let _photoKey = null;
function takePhoto(key) { _photoKey = key; const p = $("#photoIn"); p.value = ""; p.click(); }
$("#photoIn").onchange = async e => {
  const f = e.target.files[0], key = _photoKey; if (!f || !key) return;
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("couldn't read that photo")); i.src = URL.createObjectURL(f); });
    const max = 1600, s = Math.min(1, max / Math.max(img.width, img.height));
    const cv = document.createElement("canvas"); cv.width = Math.round(img.width * s); cv.height = Math.round(img.height * s);
    cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
    const data = cv.toDataURL("image/jpeg", 0.72);
    const c = IDX.co.get(key);
    openSheet(`<b style="font-size:17px">📷 Photo · ${esc(c ? c.name : "")}</b><img src="${data}" style="width:100%;border-radius:12px;margin:10px 0;max-height:40vh;object-fit:contain;background:#000">
      <input class="f" id="cap" placeholder="What is it? e.g. Their sealer, film label…" autocomplete="off">
      <button class="btn block green" id="savePh">Save photo</button><button class="btn block sec" onclick="closeSheet()">Discard</button>`, el => {
      el.querySelector("#savePh").onclick = async () => {
        const cap = el.querySelector("#cap").value.trim();
        await addEvent("photo", key, {caption: cap, filename: `Photo - ${(c ? c.name : "site").replace(/[\\/:*?"<>|]/g, "-")} - ${stamp()}.jpg`, image_b64: data});
        closeSheet(); toast("Photo saved ✓ — goes to the CRM on next sync"); render(); };
    });
  } catch (err) { toast(err.message, 4000); }
};
function showPhoto(ev) {
  openSheet(`<b>${esc(ev.data.caption || "Photo")}</b><div class="small">${esc(ev.created_at.replace("T", " ").slice(0, 16))} · not synced yet</div><img src="${ev.data.image_b64}" style="width:100%;border-radius:12px;margin-top:10px">
    <button class="btn block sec" id="shPh">📤 Share</button>`, el => el.querySelector("#shPh").onclick = () => shareFile(dataUriToFile(ev.data.image_b64, ev.data.filename, "image/jpeg")));
}

// ---------- CALENDAR (.ics) ----------
function icsEscape(s) { return String(s || "").replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/[,;]/g, m => "\\" + m); }
function addToCalendar(key, kind, id) {
  const c = IDX.co.get(key); if (!c) return;
  const item = kind === "meeting" ? meetings(key).find(m => m.id === id) : actions(key).find(a => a.id === id);
  if (!item || !item.date) return toast("No date to add");
  const d = item.date.replace(/-/g, ""), t = (item.time || "").replace(":", "");
  const addr = rows("addresses", key)[0];
  const title = kind === "meeting" ? `${MEETING_TYPES[item.meeting_type || ""] || "Meeting"} – ${c.name}` : `${item.note} – ${c.name}`;
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Kempner Mobile//EN", "BEGIN:VEVENT", `UID:${id}@kempner-mobile`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`,
    t ? `DTSTART:${d}T${t}00` : `DTSTART;VALUE=DATE:${d}`, t ? `DURATION:PT${kind === "meeting" ? "1H" : "30M"}` : "",
    `SUMMARY:${icsEscape(title)}`, `DESCRIPTION:${icsEscape(kind === "meeting" ? item.notes : "Kempner action")}`,
    `LOCATION:${icsEscape(kind === "meeting" ? (item.location || (addr && addr.lines) || "") : "")}`,
    "BEGIN:VALARM", "TRIGGER:-PT30M", "ACTION:DISPLAY", "DESCRIPTION:Reminder", "END:VALARM", "END:VEVENT", "END:VCALENDAR"].filter(Boolean);
  const file = new File([lines.join("\r\n")], `${title.replace(/[\\/:*?"<>|]/g, "-").slice(0, 60)}.ics`, {type: "text/calendar"});
  shareFile(file);
}

// ---------- MY BUSINESS CARD (QR → contact card on their phone) ----------
function myCard() { return Object.assign({}, CARD_DEFAULTS, {name: META.user || (SNAP && SNAP.current_user) || ""}, META.card || {}); }
// What the QR opens: your digital card page (shows the card, saves you with the card as your contact photo) or the plain contact.
const cardPageUrl = c => new URL("card.html", location.href).href.split("#")[0] + "#" + cardToHash(c, localDate());
const cardQrText = c => (META.cardQr || "page") === "vcard" ? vcardText(c) : cardPageUrl(c);
function qrSvg(text) {
  qrcode.stringToBytes = qrcode.stringToBytesFuncs["UTF-8"];
  const q = qrcode(0, "M"); q.addData(text); q.make();
  // centred in whatever box it sits in (the library's default pins it to the top-left)
  return q.createSvgTag({cellSize: 6, margin: 2, scalable: true}).replace('preserveAspectRatio="xMinYMin meet"', 'preserveAspectRatio="xMidYMid meet"');
}
route(/^#\/card(\/qr)?$/, qrFirst => {
  const c = myCard();
  if (!c.name || !(c.mobile || c.email)) return go("#/card/edit");
  setHeader("My business card", "#/home", "home");
  const page = (META.cardQr || "page") !== "vcard";
  $("#view").innerHTML = `<div class="bcwrap"><div class="bcflip" id="bcFlip">
      <div class="bcface">${cardFrontHtml(c)}</div>
      <div class="bcface bk"><div class="bc-qr2">${qrSvg(cardQrText(c))}</div><div class="bc-scan">Scan to save my card</div></div>
    </div></div>
    <div class="bc-hint" id="bcHint"></div>
    <button class="btn block red" id="bcQr"></button>
    <button class="btn block sec" id="shareCard" style="margin-top:8px">📤 Send my card (contact + picture)</button>
    <a class="btn block sec" href="#/card/edit" style="margin-top:8px">✏️ Edit my details</a>
    <p class="small" style="text-align:center;margin-top:10px">${page ? "Their camera opens your digital card, with a button to save you to their contacts, your card as the contact's photo. Needs signal on their phone." : "Their camera saves you straight to their contacts (works with no signal)."} Turn your brightness up so it scans first time.</p>`;
  const flip = $("#bcFlip"), setSide = back => { flip.classList.toggle("back", back); $("#bcQr").textContent = back ? "🪪 Show the front" : "🔳 Show the QR to scan";
    $("#bcHint").textContent = back ? "Point their camera at the code" : "Tap the card to turn it over for the QR code"; };
  setSide(!!qrFirst);
  flip.onclick = () => setSide(!flip.classList.contains("back"));
  $("#bcQr").onclick = () => setSide(!flip.classList.contains("back"));
  $("#shareCard").onclick = async () => {
    const met = localDate(), vcf = new File([vcardText(c, {photo: drawCard(c, "square"), note: cardNote(c, met)})], cardFileName(c, "vcf"), {type: "text/vcard"});
    const png = dataUriToFile(drawCard(c, "card"), cardFileName(c, "png"), "image/png");
    const files = [vcf, png];
    if (navigator.canShare && navigator.canShare({files})) { try { await navigator.share({files, text: page ? cardPageUrl(c) : undefined}); return; } catch (e) { if (e.name === "AbortError") return; } }
    shareFile(vcf);
  };
});
route(/^#\/card\/edit$/, () => {
  const c = myCard();
  const f = (k, l, type = "text", ph = "") => `<label class="f">${l}</label><input class="f" name="${k}" type="${type}" value="${esc(c[k])}" placeholder="${esc(ph)}" ${type === "email" ? 'autocapitalize="off"' : ""}>`;
  form("My card details", "#/card", `<p class="small">These go on the QR code people scan to save you as a contact. They stay on this phone.</p>
    ${f("name", "Full name")}${f("title", "Job title", "text", "e.g. Area Sales Manager")}
    <div class="two"><div>${f("mobile", "Mobile", "tel")}</div><div>${f("office", "Office phone", "tel")}</div></div>
    ${f("email", "Work email", "email")}${f("website", "Website")}${f("company", "Company")}
    <label class="f">When someone scans the QR</label><select class="f" name="qr"><option value="page" ${(META.cardQr || "page") !== "vcard" ? "selected" : ""}>Show my digital card, with Save to contacts (recommended)</option><option value="vcard" ${META.cardQr === "vcard" ? "selected" : ""}>Save me straight to contacts (works without signal)</option></select>
    <details class="more"><summary>Address</summary>${f("street", "Street")}<div class="two"><div>${f("town", "Town")}</div><div>${f("postcode", "Postcode")}</div></div>${f("county", "County")}</details>`,
    "Save card", async fd => { if (!fd.name) throw new Error("add your name"); if (!fd.mobile && !fd.email) throw new Error("add a mobile or an email");
      META.cardQr = fd.qr === "vcard" ? "vcard" : "page"; delete fd.qr;
      META.card = Object.assign({}, CARD_DEFAULTS, fd); await saveMeta(); location.replace("#/card"); return false; }, "home");
});
