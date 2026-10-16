"use strict";
/* Kempner Mobile — cost-per-pack calculator (the CRM's L-sealer film formula) and the customer's QR reorder sticker. */

// ---------- COST PER PACK ----------
const DEFAULT_ROLL_LENGTHS = {"25": 800, "19": 1067, "15": 1332, "12": 1667};
const rollLengths = () => Object.assign({}, DEFAULT_ROLL_LENGTHS, (SNAP && SNAP.film_roll_lengths) || {});
// Same maths as the CRM's calc_lsealer_film_requirement + _pack_geometry_and_price.
function packFilm(L, W, H, overlap, scrap, rollLen) {
  const reqW = H + W + overlap, recW = Math.ceil(reqW / 50) * 50, cut = L + H + overlap + scrap, cutM = cut / 1000;
  const raw = rollLen > 0 ? rollLen / cutM : 0;
  const packs = raw >= 2 ? Math.max(1, Math.floor(raw) - 1) : Math.floor(raw);
  return {reqW, recW, cut, cutM, raw, packs, area: 2 * (recW / 1000) * cutM};
}
const perPack = x => x < 1 ? `${(x * 100).toFixed(2)}p` : gbp(x);
const sameN = (a, b) => a != null && b != null && a !== "" && b !== "" && Math.abs(parseFloat(a) - parseFloat(b)) < 0.01;

// Pack profiles = the CRM's, plus anything saved on this phone and not yet synced.
function packProfiles(key) {
  const list = rows("company_pack_profiles", key).map(p => Object.assign({}, p));
  for (const ev of pend(key, "pack_save")) {
    const d = ev.data, hit = list.find(p => (d.profile_id && String(p.id) === String(d.profile_id)) || (d.temp_id && p._temp === d.temp_id));
    const fields = Object.fromEntries(Object.entries(d).filter(([k]) => !["profile_id", "temp_id", "summary"].includes(k)));
    if (hit) Object.assign(hit, fields, {_pending: true});
    else list.push(Object.assign({id: d.temp_id, _temp: d.temp_id, _pending: true}, fields));
  }
  return list;
}
const knownSpecs = key => key ? rows("company_known_film_specs", key) : [];
// Best known roll price for a width × thickness: their known spec → their last order. Returns {price, src} or null.
function knownPrice(key, widthMm, micron) {
  if (!key || !micron) return null;
  const ks = knownSpecs(key).filter(s => s.roll_price && sameN(s.width_mm, widthMm) && sameN(s.thickness_micron, micron))
    .sort((a, b) => (b.is_ours || 0) - (a.is_ours || 0));
  if (ks.length) return {price: +ks[0].roll_price, src: `their known spec${ks[0].supplier ? ` (${ks[0].supplier})` : ks[0].is_ours ? " (ours)" : ""}`, len: ks[0].roll_length_m};
  if (typeof theirUsual === "function") {
    const hit = theirUsual(key).find(u => u.p && u.p.t && u.price && sameN(u.p.t.width, widthMm) && sameN(u.p.t.thickness, micron));
    if (hit) return {price: +hit.price, src: `their last order${hit.date ? " · " + niceDate(String(hit.date).slice(0, 10)) : ""}`};
  }
  return null;
}
// One line for a saved pack: film, packs per roll and (if a price is known) cost per pack.
function packSummary(key, p) {
  if (!(p.length_mm > 0 && p.width_mm > 0 && p.height_mm > 0)) return "";
  const t = p.thickness_micron ? Math.round(p.thickness_micron) : null, rl = +p.roll_length_m || (t && rollLengths()[t]) || 0;
  const a = packFilm(+p.length_mm, +p.width_mm, +p.height_mm, p.overlap_mm == null ? 30 : +p.overlap_mm, +p.scrap_pull_mm || 0, rl);
  const price = +p.roll_price || (knownPrice(key, a.recW, t) || {}).price;
  return `${a.recW}mm${t ? ` · ${t}µm` : ""}${a.packs ? ` · ${a.packs.toLocaleString("en-GB")} packs/roll` : ""}${price && a.packs ? ` · <b>${perPack(price / a.packs)}</b>/pack` : ""}`;
}

// Unsaved work is kept per company + pack, so leaving and coming back doesn't lose it.
const cpDraftKey = (key, pid) => `${key || "-"}|${pid || "new"}`;
function cpDraft(key, pid) { return ((META.cpDrafts || {})[cpDraftKey(key, pid)]) || null; }
let _cpSaveT;
function cpKeepDraft(key, pid, st) { META.cpDrafts = META.cpDrafts || {}; META.cpDrafts[cpDraftKey(key, pid)] = st; clearTimeout(_cpSaveT); _cpSaveT = setTimeout(saveMeta, 400); }
function cpDropDraft(key, pid) { if (META.cpDrafts) { delete META.cpDrafts[cpDraftKey(key, pid)]; saveMeta(); } }
function cpFromProfile(p) {
  const t = p && p.thickness_micron ? String(Math.round(p.thickness_micron)) : "19";
  return p ? {name: p.name || "", L: p.length_mm ?? "", W: p.width_mm ?? "", H: p.height_mm ?? "", T: rollLengths()[t] ? t : "other",
    RL: rollLengths()[t] ? "" : (p.roll_length_m || ""), O: p.overlap_mm ?? 30, S: p.scrap_pull_mm ?? 0,
    P: p.roll_price || "", priceTyped: !!p.roll_price, rot: !!p.allows_reorientation}
    : {name: "", L: "", W: "", H: "", T: "19", RL: "", O: 30, S: 0, P: "", priceTyped: false, rot: false};
}

route(/^#\/pack(?:\/([^/]+))?(?:\/([^/]+))?$/, (keyArg, pidArg) => {
  const key = keyArg && keyArg !== "-" ? keyArg : "", c = key ? IDX.co.get(key) : null;
  setHeader("Cost per pack", c ? coHref(key) + "/equipment" : "#/prices", c ? "companies" : "prices");
  const profiles = key ? packProfiles(key) : [];
  const p0 = pidArg && pidArg !== "new" ? profiles.find(p => String(p.id) === String(pidArg)) : null;
  const pid = p0 ? String(p0.id) : "new", saved = cpFromProfile(p0), draft = cpDraft(key, pid);
  const st = Object.assign({}, saved, draft || {});
  const ths = Object.keys(rollLengths()).map(Number).sort((a, b) => a - b);
  const f = (id, label, val, ph = "") => `<div><label class="f">${label}</label><input class="f" id="${id}" type="number" inputmode="decimal" step="any" value="${esc(val ?? "")}" placeholder="${ph}"></div>`;
  $("#view").innerHTML = `
    ${c ? `<div class="small" style="margin:2px 4px 8px">For <b>${esc(c.name)}</b></div>` : ""}
    ${key ? `<div class="scrollx" style="padding-top:0">${profiles.map(p => `<button class="fchip ${p0 && String(p0.id) === String(p.id) ? "on" : ""}" data-prof="${esc(p.id)}">📦 ${esc(p.name)}${p._pending ? " •" : ""}</button>`).join("")}<button class="fchip ${p0 ? "" : "on"}" data-prof="new">＋ New pack</button></div>` : ""}
    <div id="cpOut"></div>
    <div class="card">
      ${key ? `<label class="f" style="margin-top:0">Pack name</label><input class="f" id="pName" value="${esc(st.name)}" placeholder="e.g. Ready meal tray">` : ""}
      <div style="display:flex;align-items:flex-end;gap:8px"><div style="flex:1"><div class="two">${f("pL", "Length mm", st.L)}${f("pW", "Width mm", st.W)}</div></div>
        <button class="btn sm sec" id="rotBtn" title="Turn the pack 90° (swap length and width)" style="margin-bottom:2px">↻ 90°</button></div>
      <div class="two">${f("pH", "Height mm", st.H)}<div><label class="f">Film thickness</label><select class="f" id="pT">${ths.map(t => `<option value="${t}" ${+st.T === t ? "selected" : ""}>${t}µm · ${(+rollLengths()[t]).toLocaleString("en-GB")} m roll</option>`).join("")}<option value="other" ${st.T === "other" ? "selected" : ""}>Other…</option></select></div></div>
      <div class="two ${st.T === "other" ? "" : "hidden"}" id="rlRow">${f("pRL", "Roll length m", st.RL)}<div></div></div>
      <div id="specChips"></div>
      <label class="f">Roll price £ <span class="muted" style="font-weight:400">(blank = film per pack only)</span></label>
      <input class="f" id="pP" type="number" inputmode="decimal" step="any" value="${esc(st.P ?? "")}" placeholder="e.g. 42.50">
      <div class="small" id="pSrc" style="margin-top:4px"></div>
      <details style="margin-top:8px"><summary class="small" style="cursor:pointer">Seal overlap & machine scrap (<span id="osSum">${esc(st.O)} / ${esc(st.S)} mm</span>)</summary>
        <div class="two">${f("pO", "Seal / shrink overlap mm", st.O)}${f("pS", "Machine scrap pull mm", st.S)}</div>
        <div class="small">30 mm overlap is the CRM's starting point; scrap pull is per machine (0 unless you know it).</div></details>
      ${key ? `<label class="check" style="margin-top:8px"><input type="checkbox" id="pRot" ${st.rot ? "checked" : ""}> This product can be turned on its side / rotated</label>` : ""}
    </div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin:8px 0 4px">
      ${key ? `<button class="btn green" id="cpSave" style="flex:1">💾 ${p0 ? "Save to this pack" : "Save as a pack profile"}</button>` : ""}
      <button class="btn sec" id="cpShare">⤴ Share</button>${key ? '<button class="btn sec" id="cpNote">📝 Note</button>' : ""}</div>
    ${draft ? `<div class="small" style="margin:4px">Unsaved changes are kept on this phone. <a href="#" id="cpReset">Go back to ${p0 ? "the saved pack" : "blank"}</a></div>` : ""}
    <div class="small" style="margin:6px 4px 20px">Same formula as the CRM: width = height + width + overlap, rounded up to 50 mm; cut length = length + height + overlap + scrap; packs per roll less 1 for threading.${p0 && p0._pending ? " This pack has changes waiting to sync." : ""}</div>`;
  const v = $("#view"), q = id => v.querySelector("#" + id), val = id => parseFloat(q(id) ? q(id).value : "");
  v.querySelectorAll("[data-prof]").forEach(b => b.onclick = () => go(`#/pack/${encodeURIComponent(key)}/${encodeURIComponent(b.dataset.prof)}`));
  let priceTyped = !!st.priceTyped, lastAuto = null, cur = null;
  const read = () => { const T = q("pT").value;
    return {name: q("pName") ? q("pName").value.trim() : "", L: val("pL"), W: val("pW"), H: val("pH"), T, RL: T === "other" ? val("pRL") : +rollLengths()[T],
      O: isNaN(val("pO")) ? 30 : val("pO"), S: isNaN(val("pS")) ? 0 : val("pS"), P: val("pP"), rot: q("pRot") ? q("pRot").checked : false}; };
  const calc = (fromUser) => {
    const r = read(); q("rlRow").classList.toggle("hidden", r.T !== "other"); q("osSum").textContent = `${num(r.O)} / ${num(r.S)} mm`;
    const mic = r.T === "other" ? null : +r.T, out = q("cpOut");
    // film chips: their known specs at the width this pack needs (thickness + roll length first)
    const need = r.L > 0 && r.W > 0 && r.H > 0 ? packFilm(r.L, r.W, r.H, r.O, r.S, r.RL || 1).recW : null;
    const ks = knownSpecs(key).filter(s => s.thickness_micron).sort((a, b) => (sameN(b.width_mm, need) - sameN(a.width_mm, need)) || (+a.thickness_micron - +b.thickness_micron));
    q("specChips").innerHTML = ks.length ? `<div class="small" style="font-weight:700;margin:10px 2px 4px">Their known films${need ? ` · needs ${need}mm` : ""}</div><div class="scrollx" style="padding-top:0">${ks.map((s, i) =>
      `<button class="fchip ${mic && sameN(s.thickness_micron, mic) && sameN(s.width_mm, need) ? "on" : ""}" data-ks="${i}" style="${need && !sameN(s.width_mm, need) ? "opacity:.55" : ""}">${num(s.thickness_micron)}µm · ${s.roll_length_m ? (+s.roll_length_m).toLocaleString("en-GB") + " m" : "std length"} · ${num(s.width_mm)}mm${s.roll_price ? " · " + gbp(s.roll_price) : ""}</button>`).join("")}</div>` : "";
    q("specChips").querySelectorAll("[data-ks]").forEach(b => b.onclick = () => { const s = ks[+b.dataset.ks], t = String(Math.round(s.thickness_micron));
      if (rollLengths()[t] && (!s.roll_length_m || sameN(s.roll_length_m, rollLengths()[t]))) q("pT").value = t; else { q("pT").value = "other"; q("pRL").value = s.roll_length_m || ""; }
      if (s.roll_price) { q("pP").value = s.roll_price; priceTyped = false; } calc(true); });
    if (!(r.L > 0 && r.W > 0 && r.H > 0)) { out.innerHTML = '<div class="card small">Enter the pack\'s length, width and height to see the film and cost.</div>'; q("pSrc").textContent = ""; cur = null; keep(); return; }
    if (!(r.RL > 0)) { out.innerHTML = '<div class="card small">Enter the roll length.</div>'; cur = null; keep(); return; }
    const a = packFilm(r.L, r.W, r.H, r.O, r.S, r.RL), b = packFilm(r.W, r.L, r.H, r.O, r.S, r.RL);
    // roll price follows the film unless you typed your own
    const kp = knownPrice(key, a.recW, mic);
    if (!priceTyped) { q("pP").value = kp ? kp.price : ""; lastAuto = kp; }
    const P = val("pP");
    q("pSrc").innerHTML = P > 0 ? (priceTyped ? `Typed by you${kp && !sameN(kp.price, P) ? ` · <a href="#" id="useKp">use ${esc(kp.src)}: ${gbp(kp.price)}</a>` : ""}` : `From ${esc(kp ? kp.src : "")}`)
      : (key ? "No price on file for this film — type one in to see cost per pack." : "");
    const useKp = q("useKp"); if (useKp) useKp.onclick = e => { e.preventDefault(); priceTyped = false; calc(true); };
    const priceB = P > 0 ? (b.recW === a.recW ? P : ((knownPrice(key, b.recW, mic) || {}).price || P * b.recW / a.recW)) : 0;
    const bExact = P > 0 && (b.recW === a.recW || knownPrice(key, b.recW, mic));
    const row = (x, y, big) => `<div class="${big ? "gt" : ""}"><span>${x}</span><span>${y}</span></div>`;
    const better = b.packs && a.packs && (P > 0 ? priceB / b.packs < P / a.packs - 1e-9 : b.area < a.area - 1e-9);
    cur = {r, a, b, P, priceB, mic};
    out.innerHTML = `<div class="card" style="border-color:var(--green)">
      <div style="display:flex;align-items:baseline;gap:8px"><span style="font-size:30px;font-weight:800">${P > 0 && a.packs ? perPack(P / a.packs) : "—"}</span><span class="small">${P > 0 && a.packs ? "per pack" : "add a roll price for cost per pack"}</span></div>
      <div class="totals" style="margin-bottom:0">
        ${row("Film to order", `${a.recW}mm centrefold${mic ? ` · ${mic}µm` : ""} · ${num(r.RL)} m`)}
        ${row("Packs per roll", a.packs ? a.packs.toLocaleString("en-GB") : "under 1")}
        ${row("Film per pack", `${a.cutM.toFixed(3)} m · ${a.area.toFixed(3)} m²`)}
        ${P > 0 && a.packs ? row("Per 1,000 packs", gbp(P / a.packs * 1000)) : ""}
        ${P > 0 ? row("Roll price", gbp(P)) : ""}</div>
      <div class="small" style="margin-top:8px;display:flex;align-items:center;gap:8px"><span style="flex:1">↻ Turned 90°: ${b.recW}mm · ${b.packs.toLocaleString("en-GB")} packs${P > 0 && b.packs ? ` · ${bExact ? "" : "≈"}${perPack(priceB / b.packs)}` : ""}${better ? ' <b class="t-green">better</b>' : ""}</span><button class="btn sm sec" id="useRot">Use</button></div></div>`;
    q("useRot").onclick = () => q("rotBtn").click();
    keep(fromUser);
  };
  const keep = (fromUser) => { if (!fromUser) return; const r = read();
    cpKeepDraft(key, pid, {name: r.name, L: q("pL").value, W: q("pW").value, H: q("pH").value, T: r.T, RL: q("pRL").value, O: q("pO").value, S: q("pS").value, P: q("pP").value, priceTyped, rot: r.rot}); };
  v.querySelectorAll("input,select").forEach(i => i.addEventListener("input", () => { if (i.id === "pP") priceTyped = q("pP").value !== ""; calc(true); }));
  q("rotBtn").onclick = () => { const l = q("pL").value; q("pL").value = q("pW").value; q("pW").value = l; calc(true); toast("Turned 90° — length and width swapped"); };
  const rs = q("cpReset"); if (rs) rs.onclick = e => { e.preventDefault(); cpDropDraft(key, pid); render(); };
  const summary = () => { if (!cur) return ""; const {r, a, b, P, priceB, mic} = cur;
    return [`Cost per pack — ${r.name || (p0 && p0.name) || "pack"}: ${num(r.L)} × ${num(r.W)} × ${num(r.H)} mm`,
      `Film: ${a.recW}mm centrefold${mic ? ` ${mic}µm` : ""}, ${num(r.RL)} m roll · ${a.cutM.toFixed(3)} m per pack · ${a.packs.toLocaleString("en-GB")} packs per roll`,
      P > 0 && a.packs ? `At ${gbp(P)} a roll: ${perPack(P / a.packs)} per pack (${gbp(P / a.packs * 1000)} per 1,000)` : "",
      `Turned 90°: ${b.recW}mm, ${b.packs.toLocaleString("en-GB")} packs per roll${P > 0 && b.packs ? `, ${perPack(priceB / b.packs)} per pack` : ""}`,
      `(overlap ${num(r.O)} mm, scrap ${num(r.S)} mm)`].filter(Boolean).join("\n"); };
  if (q("cpSave")) q("cpSave").onclick = async () => {
    const r = read();
    if (!(r.L > 0 && r.W > 0 && r.H > 0)) return toast("Add the length, width and height first");
    let name = r.name || (p0 && p0.name) || ""; if (!name) { name = (prompt("Name this pack (e.g. Ready meal tray):") || "").trim(); if (!name) return; }
    const tempId = p0 && p0._temp ? p0._temp : (p0 ? null : "pk" + Date.now().toString(36));
    const data = {profile_id: p0 && !p0._temp ? p0.id : null, temp_id: tempId, name, length_mm: r.L, width_mm: r.W, height_mm: r.H,
      overlap_mm: r.O, scrap_pull_mm: r.S, thickness_micron: r.T === "other" ? (p0 && p0.thickness_micron) || null : +r.T, roll_length_m: r.RL,
      roll_price: priceTyped && !isNaN(r.P) ? r.P : null, allows_reorientation: r.rot ? 1 : 0, summary: summary()};
    await addEvent("pack_save", key, data); cpDropDraft(key, pid);
    toast(p0 ? "Pack saved — goes to the CRM next sync" : "Pack profile saved — goes to the CRM next sync");
    location.replace(`#/pack/${encodeURIComponent(key)}/${encodeURIComponent(p0 ? p0.id : tempId)}`);
  };
  if (q("cpNote")) q("cpNote").onclick = async () => { const t = summary(); if (!t) return toast("Fill in the pack first");
    await addEvent("note", key, {content: "🧮 " + t, customer: "", reference: "Cost per pack", tags: "", flag: "4NONE"}); toast("Saved as a note"); };
  q("cpShare").onclick = async () => { const t = summary(); if (!t) return toast("Fill in the pack first");
    if (navigator.share) { try { await navigator.share({text: t}); return; } catch (e) { if (e.name === "AbortError") return; } }
    try { await navigator.clipboard.writeText(t); toast("Copied"); } catch (e) { toast("Couldn't share"); } };
  calc(false);
});

// ---------- QR REORDER STICKER (made on the PC; shown here so you can test it or let a customer scan it) ----------
function reorderUrl(key) {
  const link = SNAP && SNAP.reorder_links && SNAP.reorder_links[String(key)], c = IDX.co.get(String(key));
  if (!link || !c) return "";
  return new URL("reorder.html", location.href).href.split("#")[0] + `#c=${encodeURIComponent(link.code)}&n=${encodeURIComponent(c.name)}`;
}
function reorderSheet(key) {
  const link = SNAP && SNAP.reorder_links && SNAP.reorder_links[String(key)], url = reorderUrl(key);
  if (!link) return openSheet(`<b style="font-size:17px">🔖 QR reorder sticker</b><p class="small">This customer hasn't got one yet. Set it up on the PC: <b>📱 Phone sync → 🔖 QR reorder stickers</b>. It prints a sticker for their machine; scanning it opens a page where they pick the film, quantity and PO number, and it emails the order to you.</p>`);
  openSheet(`<b style="font-size:17px">🔖 Reorder QR</b>${link.active ? "" : ' <span class="chip c-red">switched off</span>'}
    <div style="background:#fff;border-radius:12px;padding:10px;margin:10px auto;max-width:260px">${qrSvg(url)}</div>
    <div class="small" style="text-align:center">${esc((link.films || []).join(" / ") || "They type the film they need")}</div>
    <div style="display:flex;gap:6px;justify-content:center;margin-top:12px"><a class="btn sm" href="${esc(url)}" target="_blank">Open the page</a><button class="btn sm sec" id="roShare">⤴ Send link</button></div>
    <p class="small" style="margin-top:10px">Changed their film? Edit it on the PC and upload the new reorder.json to GitHub — the printed sticker keeps working.</p>`, el => {
    el.querySelector("#roShare").onclick = async () => { if (navigator.share) { try { await navigator.share({title: "Reorder film from Kempner", url}); return; } catch (e) { if (e.name === "AbortError") return; } }
      try { await navigator.clipboard.writeText(url); toast("Link copied"); } catch (e) {} };
  });
}
