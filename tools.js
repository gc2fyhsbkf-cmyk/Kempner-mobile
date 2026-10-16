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
function usualFilmPrice(key, widthMm, micron) {
  if (!key || typeof theirUsual !== "function") return null;
  const hit = theirUsual(key).find(u => u.p && u.p.t && u.price && parseFloat(u.p.t.width) === widthMm && parseFloat(u.p.t.thickness) === micron);
  return hit ? {price: +hit.price, name: hit.name, date: hit.date} : null;
}
route(/^#\/pack(?:\/([^/]+))?(?:\/(\d+))?$/, (keyArg, pidArg) => {
  const key = keyArg && keyArg !== "-" ? keyArg : "", c = key ? IDX.co.get(key) : null;
  setHeader("Cost per pack", c ? coHref(key) : "#/prices", c ? "companies" : "prices");
  const profiles = key ? rows("company_pack_profiles", key) : [];
  const p0 = profiles.find(p => String(p.id) === String(pidArg)) || (pidArg ? null : null);
  const st = cpState(key, p0);
  const f = (id, label, val, ph = "") => `<div><label class="f">${label}</label><input class="f" id="${id}" type="number" inputmode="decimal" step="any" value="${val ?? ""}" placeholder="${ph}"></div>`;
  const ths = Object.keys(rollLengths()).map(Number).sort((a, b) => a - b);
  $("#view").innerHTML = `
    ${c ? `<div class="small" style="margin:2px 4px 8px">For <b>${esc(c.name)}</b></div>` : ""}
    ${profiles.length ? `<div class="scrollx" style="padding-top:0">${profiles.map(p => `<button class="fchip ${p0 && p0.id === p.id ? "on" : ""}" data-prof="${p.id}">📦 ${esc(p.name)}</button>`).join("")}</div>` : ""}
    <div class="card"><b>📦 Pack size (mm)</b>
      <div class="two">${f("pL", "Length", st.L)}${f("pW", "Width", st.W)}</div>
      <div class="two">${f("pH", "Height", st.H)}<div><label class="f">Film thickness</label><select class="f" id="pT">${ths.map(t => `<option value="${t}" ${+st.T === t ? "selected" : ""}>${t}µm · ${rollLengths()[t].toLocaleString("en-GB")} m roll</option>`).join("")}<option value="other" ${st.T === "other" ? "selected" : ""}>Other roll length…</option></select></div></div>
      <div class="two ${st.T === "other" ? "" : "hidden"}" id="rlRow">${f("pRL", "Roll length m", st.RL)}<div></div></div>
      <details style="margin-top:6px"><summary class="small" style="cursor:pointer">Seal allowance & scrap (${st.O} mm / ${st.S} mm)</summary>
        <div class="two">${f("pO", "Seal / shrink overlap mm", st.O)}${f("pS", "Machine scrap pull mm", st.S)}</div>
        <div class="small">30 mm overlap is the CRM's starting point; scrap pull is per machine (0 unless you know it).</div></details>
      <label class="f">Roll price £ <span class="muted">(optional — leave blank for film per pack only)</span></label>
      <input class="f" id="pP" type="number" inputmode="decimal" step="any" value="${st.P ?? ""}" placeholder="e.g. 42.50">
      <div id="usualP"></div>
    </div>
    <div id="cpOut"></div>`;
  const v = $("#view"), val = id => parseFloat(v.querySelector("#" + id).value);
  v.querySelectorAll("[data-prof]").forEach(b => b.onclick = () => go(`#/pack/${encodeURIComponent(key)}/${b.dataset.prof}`));
  const calc = () => {
    const T = v.querySelector("#pT").value; v.querySelector("#rlRow").classList.toggle("hidden", T !== "other");
    const L = val("pL"), W = val("pW"), H = val("pH"), O = isNaN(val("pO")) ? 30 : val("pO"), S = isNaN(val("pS")) ? 0 : val("pS"), P = val("pP");
    const RL = T === "other" ? val("pRL") : rollLengths()[T];
    Object.assign(cpSaved, {L, W, H, T, RL: T === "other" ? RL : "", O, S, P: isNaN(P) ? "" : P});
    const out = v.querySelector("#cpOut"), up = v.querySelector("#usualP");
    if (!(L > 0 && W > 0 && H > 0)) { out.innerHTML = '<div class="card small">Enter the pack\'s length, width and height.</div>'; up.innerHTML = ""; return; }
    if (!(RL > 0)) { out.innerHTML = '<div class="card small">Enter the roll length.</div>'; return; }
    const a = packFilm(L, W, H, O, S, RL), b = packFilm(W, L, H, O, S, RL), mic = T === "other" ? null : +T;
    const u = mic ? usualFilmPrice(key, a.recW, mic) : null;
    up.innerHTML = u && !(P > 0) ? `<button class="fchip" id="useUsual" style="margin-top:6px">⭐ Their last price for ${a.recW}mm ${mic}µm: ${gbp(u.price)} — use it</button>` : "";
    if (u && v.querySelector("#useUsual")) v.querySelector("#useUsual").onclick = () => { v.querySelector("#pP").value = u.price; calc(); };
    const row = (x, y, big) => `<div class="${big ? "gt" : ""}"><span>${x}</span><span>${y}</span></div>`;
    // a rotated pack can need a different roll width; price that one at the same £/m² as an estimate
    const priceFor = r => P > 0 ? (r.recW === a.recW ? P : P * r.recW / a.recW) : 0;
    const block = (r, title, best) => `<div class="card ${best ? "" : ""}" style="${best ? "border-color:var(--green)" : ""}"><b>${title}</b>${best ? ` <span class="chip c-green">${P > 0 ? "cheaper per pack" : "less film"}</span>` : ""}<div class="totals">
      ${P > 0 && r.packs ? row(r.recW === a.recW ? "Cost per pack" : `≈ Cost per pack <span class="muted">(${r.recW}mm roll ≈ ${gbp(priceFor(r))} at the same £/m²)</span>`, perPack(priceFor(r) / r.packs), true) : ""}
      ${row("Film to order", `${r.recW} mm centrefold${mic ? ` · ${mic}µm` : ""}`, !(P > 0))}
      ${row("Needed width", `${num(r.reqW)} mm (H + W + overlap)`)}
      ${row("Film per pack", `${r.cutM.toFixed(3)} m (≈ ${r.area.toFixed(3)} m² both layers)`)}
      ${row("Packs per roll", r.packs ? `${r.packs.toLocaleString("en-GB")} <span class="muted">(${Math.floor(r.raw).toLocaleString("en-GB")} less 1 for threading)</span>` : "under 1")}
      ${P > 0 && r.packs ? row("Per 1,000 packs", gbp(priceFor(r) / r.packs * 1000)) : ""}</div></div>`;
    const rotBetter = b.packs && a.packs && (P > 0 ? priceFor(b) / b.packs < priceFor(a) / a.packs : b.area < a.area);
    out.innerHTML = block(a, "As it sits", false) + `<h2>Turned 90° on its base</h2>` + block(b, `Rotated (${num(W)} × ${num(L)} × ${num(H)})`, rotBetter)
      + `<div class="small" style="margin:6px 4px">Same formula as the CRM's pack profiles. ${p0 && !p0.allows_reorientation ? "This pack is marked as not rotatable in the CRM." : "Only rotate if the product can be packed that way."}</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin:8px 0">${key ? '<button class="btn sm" id="cpNote">📝 Save as a note</button>' : ""}<button class="btn sm sec" id="cpShare">⤴ Share</button></div>`;
    const summary = () => [`Cost per pack — ${num(L)} × ${num(W)} × ${num(H)} mm pack${p0 ? ` (${p0.name})` : ""}`,
      `Film: ${a.recW}mm centrefold${mic ? ` ${mic}µm` : ""}, ${a.cutM.toFixed(3)} m per pack, ${a.packs.toLocaleString("en-GB")} packs per ${num(RL)} m roll`,
      P > 0 && a.packs ? `At ${gbp(P)} a roll: ${perPack(P / a.packs)} per pack (${gbp(P / a.packs * 1000)} per 1,000)` : "",
      `Rotated: ${b.recW}mm, ${b.packs.toLocaleString("en-GB")} packs per roll${P > 0 && b.packs ? `, ${b.recW === a.recW ? "" : "≈"}${perPack(priceFor(b) / b.packs)} per pack` : ""}`,
      `(overlap ${num(O)} mm, scrap ${num(S)} mm)`].filter(Boolean).join("\n");
    if (key) v.querySelector("#cpNote").onclick = async () => { await addEvent("note", key, {content: "🧮 " + summary(), customer: "", reference: "Cost per pack", tags: "", flag: "4NONE"}); toast("Saved as a note — goes to the CRM next sync"); };
    v.querySelector("#cpShare").onclick = async () => { const t = summary();
      if (navigator.share) { try { await navigator.share({text: t}); return; } catch (e) { if (e.name === "AbortError") return; } }
      try { await navigator.clipboard.writeText(t); toast("Copied"); } catch (e) { toast("Couldn't share"); } };
  };
  v.querySelectorAll("input,select").forEach(i => i.addEventListener("input", calc));
  calc();
});
let cpSaved = {};
const perPack = x => x < 1 ? `${(x * 100).toFixed(2)}p` : gbp(x);
function cpState(key, p) {
  const d = {L: "", W: "", H: "", T: "19", RL: "", O: 30, S: 0, P: ""};
  if (p) {
    const t = p.thickness_micron ? String(Math.round(p.thickness_micron)) : "19";
    return Object.assign(d, {L: p.length_mm ?? "", W: p.width_mm ?? "", H: p.height_mm ?? "", T: rollLengths()[t] ? t : "other",
      O: p.overlap_mm ?? 30, S: p.scrap_pull_mm ?? 0, P: cpSaved._key === key ? cpSaved.P : ""});
  }
  if (cpSaved._key !== key) cpSaved = {_key: key};
  return Object.assign(d, Object.fromEntries(Object.entries(cpSaved).filter(([k, x]) => k !== "_key" && x !== "" && x != null && !(typeof x === "number" && isNaN(x)))));
}

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
