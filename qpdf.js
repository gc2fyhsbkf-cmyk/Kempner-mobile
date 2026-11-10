"use strict";
/* Kempner Mobile — machine quote PDFs, built on the phone to the same layout as the CRM's
   (classic Word-style letterhead, or the modern one). Needs jspdf.umd.min.js (loadJsPDF in pdf.js). */

const MM = 72 / 25.4;
const QP_TERMS_ORDER = ["payment", "commissioning", "iso", "conditions", "closing"];

function qpOrdinal(d = new Date()) {
  const n = d.getDate(), suf = (n % 100 >= 11 && n % 100 <= 13) ? "th" : ({1: "st", 2: "nd", 3: "rd"}[n % 10] || "th");
  return {n: String(n), suf, rest: ` ${["January","February","March","April","May","June","July","August","September","October","November","December"][d.getMonth()]} ${d.getFullYear()}`};
}
function qpPackWords(cost) {
  const p = cost * 100, tenths = Math.max(1, Math.round(p * 10));
  const words = tenths < 10 ? `${tenths} tenth${tenths !== 1 ? "s" : ""} of a penny.` : `${p.toFixed(1)}p`;
  return `£${cost < 0.1 ? cost.toFixed(3) : cost.toFixed(2)} per pack (${words})`;
}
function qpTidy(t) {
  return String(t || "").replace(/\r/g, "").trim().split(/\n\s*\n/).map(p => p.replace(/\s+/g, " ").trim()).filter(Boolean).join("\n\n");
}
const qpFixIso = t => String(t || "").replace(/ISO\s*9002\s*:?\s*2015/g, "ISO 9001:2015");

/* q: {company_lines[], contact_full, contact_first, salutation_title, opening, heading, product_name, description,
       image (dataURI), image_caption, price_text, carriage_text, availability, warranty, specs[[a,b]],
       service_groups[[unit,[reqs]]], max_film_width, film {name, spec_line, packs_line} | null,
       terms {key:[head, body]}, me, my_email, quote_ref}
   returns a data URI. Always two pages: tightens page 1, then the terms, if anything would spill over. */
function makeMachineQuotePdf(q, style) {
  let out = null;
  for (let p1 = 0, tr = 0, i = 0; i < 14; i++) {
    const r = qpBuild(q, style, tr, p1);
    out = r.uri;
    if (r.pages <= 2) break;
    if (r.pricePage > 1 && p1 > -3) p1 -= 0.5; else if (tr > -3) tr -= 0.5; else break;
  }
  return out;
}

function qpBuild(q, style, termsShrink, p1Shrink) {
  const {jsPDF} = window.jspdf, doc = new jsPDF({unit: "pt", format: "a4"});
  const classic = style !== "modern";
  const W = 595.28, H = 841.89;
  const ML = (classic ? 22 : 18) * MM, CW = W - 2 * ML;
  const BODY = classic ? "times" : "helvetica";
  const RED = classic ? [255, 0, 0] : [215, 25, 45], INK = classic ? [0, 0, 0] : [31, 41, 51], GREY = [107, 114, 128];
  const sz = classic ? 12 : 9.5, lead = s => s * 1.3;
  const top1 = (classic ? 74 : 34) * MM, top2 = (classic ? 20 : 34) * MM, bot = (classic ? 18 : 20) * MM;
  const me = q.me || "", email = q.my_email || "";
  let y = top1, page = 1, pricePage = 1;

  const ink = c => doc.setTextColor(c[0], c[1], c[2]);
  const font = (st, size) => { doc.setFont(BODY, st); doc.setFontSize(size); };
  const S = pdfSafe;
  const alpha = a => { try { doc.setGState(new doc.GState({opacity: a})); } catch (_) {} };

  function letterhead() {
    if (classic) {
      const yy0 = 21.5 * MM;
      doc.setFont("times", "bold"); doc.setFontSize(47);
      ink([0, 0, 0]);
      for (const [dx, dy, a] of [[3.2, 3.2, .04], [2.6, 2.6, .05], [2.2, 2.2, .06], [1.8, 1.8, .06], [2.6, 2, .05], [2, 2.6, .05], [3.6, 3, .04], [3, 3.6, .04]]) {
        alpha(a); doc.text("KEMPNER", W / 2 + dx, yy0 + dy, {align: "center"}); }
      alpha(1); ink(RED); doc.text("KEMPNER", W / 2, yy0, {align: "center"});
      ink([0, 0, 0]); doc.setFontSize(9.5);
      let yy = yy0 + 24;
      for (const l of ["S Kempner Limited", "498-500 Honeypot Lane, Stanmore, Middlesex, HA7 1JZ.", "Telephone: 020 8952 5262 Facsimile: 020 8952 8061", `Email ${email}`]) {
        doc.text(S(l), W / 2, yy, {align: "center"}); yy += 11.5; }
      yy += 13; doc.setFont("times", "bolditalic"); doc.setFontSize(10.5);
      for (const l of ["THE COUNTRY'S LARGEST DISTRIBUTORS OF", "DISPLAY SHRINK MATERIALS AND MACHINERY.", "AND", "CERTIFICATED TO ISO 9001:2015."]) {
        doc.text(l, W / 2, yy, {align: "center"}); yy += 12; }
    } else band();
  }
  function band() {
    doc.setFillColor(RED[0], RED[1], RED[2]); doc.rect(0, 0, W, 6, "F");
    doc.setFont("times", "bold"); doc.setFontSize(30); ink(RED); doc.text("KEMPNER", ML, 22 * MM);
    doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); ink(GREY);
    ["S. Kempner Limited", "498-500 Honeypot Lane, Stanmore, Middlesex, HA7 1JZ", `020 8952 5262  ·  ${email}`]
      .forEach((l, i) => doc.text(S(l).replace(/·/g, "·"), W - ML, 13 * MM + i * 9, {align: "right"}));
    doc.setFont("helvetica", "italic"); doc.setFontSize(7);
    doc.text("The country's largest distributors of display shrink materials and machinery  ·  ISO 9001:2015", ML, 27 * MM);
    doc.setDrawColor(227, 230, 234); doc.setLineWidth(0.6); doc.line(ML, 30 * MM, W - ML, 30 * MM); doc.line(ML, H - 16 * MM, W - ML, H - 16 * MM);
    doc.setFont("helvetica", "normal"); doc.setFontSize(7);
    doc.text("S. Kempner Limited  ·  Certificated to ISO 9001:2015  ·  Prices exclude VAT", ML, H - 11 * MM);
    doc.text(`Page ${page}`, W - ML, H - 11 * MM, {align: "right"});
  }
  function newPage() {
    doc.addPage(); page++; y = top2;
    if (classic) { doc.setFont("times", "normal"); doc.setFontSize(8); ink(GREY); doc.text(`Page ${page}`, W - ML, H - 12 * MM, {align: "right"}); }
    else band();
  }
  const room = h => { if (y + h > H - bot) newPage(); };

  // paragraph: wraps, optional justify / indent / underline / bold lead-in ("HEAD – body")
  function para(text, o = {}) {
    const size = o.size || sz, L = lead(size), x0 = ML + (o.indL || 0), w = CW - (o.indL || 0) - (o.indR || 0);
    font(o.bold ? "bold" : "normal", size); ink(o.color || INK);
    let head = o.head ? S(o.head) + " - " : "";
    const full = head + S(text);
    const lines = doc.splitTextToSize(full, w - (head ? 6 : 0));
    for (let i = 0; i < lines.length; i++) {
      if (!o.keep) room(L);
      const ln = lines[i], last = i === lines.length - 1;
      const ax = o.align === "center" ? W / 2 : o.align === "right" ? ML + CW : x0;
      if (i === 0 && head && ln.startsWith(head.trim())) {
        const hs = head.trimEnd(); font("bold", size); doc.text(hs, x0, y);
        const hw = doc.getTextWidth(hs); font("normal", size); const sp = doc.getTextWidth(" ");
        doc.text(ln.slice(head.length).trimStart(), x0 + hw + sp, y);
      } else if (o.justify && !last) {
        const words = ln.trim().split(/\s+/);
        if (words.length < 2) doc.text(ln, x0, y);
        else {
          const ww = words.map(t => doc.getTextWidth(t)), extra = (w - ww.reduce((a, b) => a + b, 0)) / (words.length - 1);
          let xx = x0; words.forEach((t, k) => { doc.text(t, xx, y); xx += ww[k] + extra; });
        }
      } else {
        doc.text(ln, ax, y, {align: o.align || "left"});
      }
      if (o.underline) {
        const tw = doc.getTextWidth(ln), sx = o.align === "center" ? W / 2 - tw / 2 : o.align === "right" ? ML + CW - tw : x0;
        doc.setDrawColor(o.color ? o.color[0] : 0, o.color ? o.color[1] : 0, o.color ? o.color[2] : 0); doc.setLineWidth(0.6);
        doc.line(sx, y + 1.5, sx + tw, y + 1.5);
      }
      y += L;
    }
    return lines.length;
  }
  const gap = mm => { y += mm * MM; };

  letterhead();
  const addr = (q.company_lines || []).filter(l => String(l).trim());
  const fao = `${q.salutation_title || ""} ${q.contact_full || ""}`.trim();
  const desc = qpTidy(q.description);

  if (classic) {
    y = top1 + sz;
    for (const l of addr) para(l, {bold: true});
    gap(4);
    // date, with the st/nd/rd/th raised
    const od = q.date_parts || qpOrdinal(); font("normal", sz); ink(INK);
    const wr = doc.getTextWidth(od.rest); font("normal", sz * 0.6); const ws = doc.getTextWidth(od.suf); font("normal", sz); const wn = doc.getTextWidth(od.n);
    const xr = ML + CW; doc.text(od.rest, xr, y, {align: "right"}); font("normal", sz * 0.6); doc.text(od.suf, xr - wr - ws, y - sz * 0.35);
    font("normal", sz); doc.text(od.n, xr - wr - ws - wn, y); y += lead(sz); gap(1);
    para(`For the attention of ${fao},`, {bold: true, underline: true}); gap(4);
    para(`Dear ${q.contact_first || ""},`); gap(4);
    para(q.opening || "", {size: 13}); gap(5);
    if (q.heading) { para(String(q.heading).toUpperCase(), {bold: true, size: 13, align: "center", underline: true}); gap(4); }
    if (desc) { for (const pp of desc.split("\n\n")) { para(pp, {bold: true, size: 12 + p1Shrink * 0.4, justify: true, indL: 14 * MM, indR: 14 * MM}); } gap(4); }
  } else {
    y = top1 + 20;
    font("bold", 20); ink(INK); doc.text("Quotation", ML, y);
    const meta = [["DATE", q.date_text || ""], ["QUOTE REF", q.quote_ref || "-"], ["VALID FOR", "30 days"]];
    meta.forEach(([a, b], i) => { font("bold", 7); ink(GREY); doc.text(a, W - ML - 64 * MM, y - 8 + i * 14); font("normal", 9); ink(INK); doc.text(S(b), W - ML, y - 8 + i * 14, {align: "right"}); });
    y += 34;
    // prepared for / by
    const boxTop = y, colW = CW * 0.58;
    font("normal", sz); const forLines = [fao, ...addr];
    const bh = 22 + Math.max(forLines.length, 3) * lead(sz) + 6;
    doc.setFillColor(246, 247, 249); doc.rect(ML, boxTop, CW, bh, "F");
    doc.setDrawColor(227, 230, 234); doc.line(ML + colW, boxTop, ML + colW, boxTop + bh);
    font("bold", 7); ink(GREY); doc.text("PREPARED FOR", ML + 10, boxTop + 14); doc.text("PREPARED BY", ML + colW + 10, boxTop + 14);
    let yy = boxTop + 28; forLines.forEach((l, i) => { font(i === 0 ? "bold" : "normal", sz); ink(INK); doc.text(S(l), ML + 10, yy); yy += lead(sz); });
    yy = boxTop + 28; [me, email, "020 8952 5262"].forEach((l, i) => { font(i === 0 ? "bold" : "normal", sz); ink(INK); doc.text(S(l), ML + colW + 10, yy); yy += lead(sz); });
    y = boxTop + bh + 5 * MM + sz;
    para(`Dear ${q.contact_first || ""},`); para(q.opening || ""); gap(5);
    para(q.heading || q.product_name || "", {bold: true, size: 13});
    if (desc) for (const pp of desc.split("\n\n")) para(pp, {justify: true});
    gap(4);
  }

  // photo
  if (q.image) {
    try {
      const pr = doc.getImageProperties(q.image), k = Math.max(0.6, 1 + p1Shrink * 0.12);
      const mw = (classic ? 130 : 105) * MM * k, mh = (classic ? 70 : 56) * MM * k, s = Math.min(mw / pr.width, mh / pr.height);
      const iw = pr.width * s, ih = pr.height * s;
      room(ih + 10);
      doc.addImage(q.image, pr.fileType || "JPEG", W / 2 - iw / 2, y - sz * 0.7, iw, ih);
      y += ih + 2 * MM;
      if (q.image_caption) para(q.image_caption, {size: sz - 3.5, align: "center"});
      gap(4);
    } catch (_) {}
  }

  const priceLine = (q.price_text || "") + (q.carriage_text ? " " + q.carriage_text : "");
  if (classic) {
    room(20); pricePage = page;
    para(`Price :  ${priceLine}`, {bold: true, size: 14, align: "right", color: RED});
    if (q.availability) para(q.availability, {size: 10, align: "right"});
  } else {
    const notes = [q.carriage_text, q.warranty, q.availability].filter(Boolean);
    const ph = 60; room(ph); pricePage = page;
    const pt = y - sz;
    doc.setFillColor(251, 241, 242); doc.setDrawColor(RED[0], RED[1], RED[2]); doc.setLineWidth(0.8); doc.rect(ML, pt, CW, ph, "FD");
    doc.setDrawColor(240, 201, 206); doc.line(ML + 62 * MM, pt, ML + 62 * MM, pt + ph);
    font("bold", 7); ink(RED); doc.text("PRICE", ML + 12, pt + 16);
    font("bold", 22); doc.text(S((q.price_text || "").replace(/ excl\.? VAT/, "")), ML + 12, pt + 40);
    font("normal", 8.5); ink(GREY); doc.text("excluding VAT", ML + 12, pt + 52);
    font("normal", 9); ink(INK); notes.forEach((n, i) => doc.text("•  " + S(n), ML + 62 * MM + 12, pt + ph / 2 - (notes.length - 1) * 7 + i * 14 + 3));
    y = pt + ph + sz;
  }
  newPage(); y = top2 + sz;

  // page 2
  const hd = t => classic ? para(t, {bold: true, underline: true}) : para(t.toUpperCase(), {bold: true, size: 8, color: GREY});
  if (!classic) {
    const specs = (q.specs || []).filter(s => String(s[1] || "").trim());
    if (specs.length) {
      font("bold", 7); ink(GREY); doc.text("SPECIFICATION", ML + 4, y); y += 4;
      doc.setDrawColor(RED[0], RED[1], RED[2]); doc.setLineWidth(0.8); doc.line(ML, y, ML + CW, y); y += 12;
      specs.forEach(([a, b], i) => {
        if (i % 2 === 1) { doc.setFillColor(246, 247, 249); doc.rect(ML, y - 10, CW, 15, "F"); }
        font("normal", 9); ink(GREY); doc.text(S(a), ML + 4, y); ink(INK); doc.text(S(String(b)), ML + 52 * MM, y); y += 15;
      });
      gap(6);
    }
  }
  const groups = q.service_groups || [];
  if (groups.length) {
    hd("SERVICE REQUIREMENTS (customer's responsibility):"); gap(2);
    const anyUnit = groups.some(g => g[0]);
    for (const [u, reqs] of groups) {
      if (anyUnit) {
        font("bold", sz); ink(INK); const ul = doc.splitTextToSize(S(u), CW * 0.36 - 6);
        font("normal", sz); const rl = [].concat(...reqs.map(r => doc.splitTextToSize(S(r), CW * 0.64)));
        font("bold", sz); doc.text(ul, ML, y); font("normal", sz); doc.text(rl, ML + CW * 0.36, y);
        y += Math.max(ul.length, rl.length) * lead(sz) + 6;
      } else for (const r of reqs) para(r);
    }
  }
  if (q.max_film_width) {
    if (classic) para(`Maximum film width for this machine is ${q.max_film_width}`, {underline: true});
    else para(`Maximum film width for this machine is ${q.max_film_width}`);
  }
  // film details: a fixed space, filled or not
  const filmStart = y;
  const reserve = 5 * MM + lead(sz) * 5 + 3 * MM + 6 * MM + (classic ? 0 : 2);
  const f = q.film;
  if (f && (f.spec_line || f.name)) {
    gap(5); hd("Film Details:");
    if (f.name) para(f.name);
    if (f.spec_line) para(f.spec_line);
    if (f.packs_line) { gap(3); para("Based on approximate pack calculations one roll should achieve:"); para(f.packs_line); }
  }
  y = Math.max(y, filmStart + reserve);

  const tsz = sz + termsShrink, terms = q.terms || {};
  for (const k of QP_TERMS_ORDER) {
    const t = terms[k]; if (!t || !t[1]) continue;
    para(qpFixIso(t[1]), {size: tsz, head: t[0] || ""}); y += 3.5 * MM * (tsz / sz);
  }
  // sign-off kept together
  const signH = lead(tsz) * 6 + 11 * MM;
  room(signH);
  gap(2); para("With best regards", {size: tsz}); gap(3); para("Yours sincerely", {size: tsz}); gap(6);
  para(me.toUpperCase(), {size: tsz});
  para(classic ? "S. KEMPNER LIMITED" : "S. Kempner Limited", {size: tsz, bold: true, underline: classic});
  para(`Email: ${email}`, {size: tsz});

  return {uri: doc.output("datauristring"), pages: doc.getNumberOfPages(), pricePage};
}

// ---------- the sheet: make a quote PDF for a machine on this customer's quote ----------
function qpAddressLines(key, c) {
  const a = rows("addresses", key)[0];
  let parts = [];
  if (a) {
    parts = ["line1", "line2", "city", "county", "postcode"].map(k => String(a[k] || "").trim()).filter(Boolean);
    if (!parts.length) parts = String(a.lines || "").split("\n").map(s => s.trim()).filter(Boolean);
  }
  return [c.name, ...parts];
}

function qpFromSnapshotRecord(rec, kit) {
  // an earlier PC quote PDF: same choices, today's date, photo from the kit
  let d = {};
  try { d = JSON.parse(rec.data || "{}"); } catch (_) {}
  const m = (kit.machines || {})[rec.product_name] || {};
  return Object.assign({}, d, {image: m.image || "", terms: kit.terms, me: d.me || kit.me, my_email: d.my_email || kit.my_email,
    date_text: longDate(), date_parts: qpOrdinal()});
}

async function qpMakeAndShow(q, style, filename, key) {
  try { await loadJsPDF(); } catch (e) { toast(e.message); return; }
  let uri;
  try { uri = makeMachineQuotePdf(q, style); } catch (e) { toast("Couldn't make the PDF: " + e.message); return; }
  const file = () => dataUriToFile(uri, filename, "application/pdf");
  openSheet(`<b style="font-size:17px">📄 Quote ready</b><div class="small" style="margin:4px 0 12px">${esc(filename)}</div>
    <button class="btn block red" id="qpShare">📤 Email / share</button>
    <button class="btn block sec" id="qpView" style="margin-top:8px">👁 View</button>`, el => {
    el.querySelector("#qpShare").onclick = () => shareFile(file());
    el.querySelector("#qpView").onclick = () => { const w = window.open(URL.createObjectURL(file()), "_blank"); if (!w) shareFile(file()); };
  });
}

function quotePdfSheet(key, qkey) {
  const c = IDX.co.get(key), kit = (SNAP && SNAP.quote_kit) || {};
  const machines = kit.machines || {};
  const v = view(key) || {};
  const g = (v.quote_groups || []).find(x => quoteKeyOf(x) === qkey) || {};
  const prodName = l => (l.product_id && SNAP.products && SNAP.products[String(l.product_id)] ? SNAP.products[String(l.product_id)].name : l.description);
  const kitName = l => { const n = prodName(l); if (machines[n]) return n;
    const lo = String(n).toLowerCase(); return Object.keys(machines).find(k => k.toLowerCase() === lo || lo.includes(k.toLowerCase())) || n; };
  const lines = (g.lines || []).filter(l => l.section === "Machines");
  if (!lines.length) { toast("No machine on this quote"); return; }
  const ppl = people(key), mc = mainContact(key);
  const films = theirUsual(key).filter(u => u.p && u.p.section === "Film" || (u.p && u.p.t && u.p.t.thickness));
  const packs = packProfiles(key);
  const opt = (v, t, sel) => `<option value="${esc(v)}"${sel ? " selected" : ""}>${esc(t)}</option>`;
  openSheet(`<b style="font-size:17px">📄 Quote PDF</b><div class="small" style="margin:2px 0 8px">Same layout as the CRM's. ${esc(c.name)}</div>
    <label class="f">Machine</label><select class="f" id="qpM">${lines.map((l, i) => opt(i, `${prodName(l)} — ${gbp(l.agreed_price || l.quoted_price)}`, i === 0)).join("")}</select>
    <div id="qpWarn" class="small" style="color:#b45309"></div>
    <label class="f">For the attention of</label><div class="two"><select class="f" id="qpT">${["Mr", "Mrs", "Ms", "Miss", "Dr", ""].map(t => opt(t, t || "(none)", t === (META.qpTitle || "Mr"))).join("")}</select>
      <select class="f" id="qpP">${ppl.map(p => opt(p.name, p.name, mc && p.name === mc.name)).join("") || opt("", "Sir/Madam", true)}</select></div>
    <label class="f">Opening</label><select class="f" id="qpO">${["Following our call", "Following your email", "Following your visit to our site", "Following my visit to your site", "Further to our recent conversation", "As promised"].map(o => opt(o, o, o === (META.qpOpen || "Following our call"))).join("")}</select>
    <div class="two"><div><label class="f">Price £</label><input class="f" id="qpPr" type="number" inputmode="decimal" step="0.01"></div>
      <div><label class="f">Carriage</label><select class="f" id="qpC">${["Ex works", "Free carriage", "Delivered", ""].map(o => opt(o, o || "Don't say", o === (META.qpCarr ?? "Ex works"))).join("")}</select></div></div>
    <label class="f">Availability</label><select class="f" id="qpA">${opt("", "Don't mention", true)}${opt("Currently this machine is generally available direct from our stock.", "From stock")}</select>
    <label class="f" style="display:flex;gap:8px;align-items:center;margin-top:10px"><input type="checkbox" id="qpF"> Include film details</label>
    <div id="qpFbox" style="display:none">
      <select class="f" id="qpFs">${films.map((u, i) => opt(i, `${u.name}${u.price ? " — " + gbp(u.price) : ""}`)).join("")}${opt("x", "(type it in)")}</select>
      <input class="f" id="qpFn" placeholder="First line, e.g. Kempner ULTRA Polyolefin" value="${esc(kit.film_name || "Kempner ULTRA Polyolefin")}">
      <div class="two"><input class="f" id="qpFd" placeholder="15 Micron 250/500mm 1332M"><input class="f" id="qpFp" type="number" inputmode="decimal" step="0.01" placeholder="£ per roll"></div>
      <select class="f" id="qpPk">${opt("", "No pack costings", true)}${packs.map((p, i) => opt(i, `${p.name || "Pack"} — ${num(p.length_mm)}×${num(p.width_mm)}×${num(p.height_mm)}mm`)).join("")}</select>
      <div class="small" id="qpCalc" style="color:#15803d;font-weight:700"></div>
    </div>
    <label class="f">Layout</label><select class="f" id="qpL">${opt("classic", "Classic letterhead", (kit.layout || "classic") === "classic")}${opt("modern", "Modern", kit.layout === "modern")}</select>
    <button class="btn block red" id="qpGo" style="margin-top:12px">📄 Make the PDF</button>`, el => {
    const $$ = s => el.querySelector(s);
    const setM = () => { const l = lines[+$$("#qpM").value], m = machines[kitName(l)];
      $$("#qpPr").value = (+(l.agreed_price || l.quoted_price) || 0).toFixed(2);
      $$("#qpWarn").textContent = !m ? "⚠ This machine's data sheet hasn't come over from the PC yet — fill it in there (📋 Data sheet) and sync."
        : !m.image ? "No photo on this machine's data sheet — the quote will go without one." : ""; };
    $$("#qpM").onchange = setM; setM();
    const roll = () => { const u = films[+$$("#qpFs").value]; if (!u || !u.p) return 0; const t = u.p.t || {};
      return +(u.p.roll_length_m || rollLengths()[String(parseFloat(t.thickness))] || 0); };
    const setFilm = () => { const u = films[+$$("#qpFs").value]; if (!u) return; const t = (u.p && u.p.t) || {};
      const w = parseFloat(t.width), fold = String(t.fold || "").toLowerCase(), rl = roll();
      const wt = w ? (/centre|center|^cf$|c\/f/.test(fold) ? `${num(w / 2)}/${num(w)}mm` : `${num(w)}mm`) : "";
      $$("#qpFd").value = [t.thickness ? `${parseFloat(t.thickness)} Micron` : "", wt, rl ? `${num(rl)}M` : ""].filter(Boolean).join(" ") || u.name;
      if (u.price) $$("#qpFp").value = (+u.price).toFixed(2); calc(); };
    const calc = () => { const pk = packs[+$$("#qpPk").value]; $$("#qpCalc").textContent = ""; el._packs = "";
      if ($$("#qpPk").value === "" || !pk) return;
      let rl = roll() || +pk.roll_length_m || 0; if (!rl) { $$("#qpCalc").textContent = "Roll length unknown for this film"; return; }
      const r = packFilm(+pk.length_mm, +pk.width_mm, +pk.height_mm, +(pk.overlap_mm || 30), +(pk.scrap_pull_mm || 0), rl);
      if (!r.packs) return; const pr = +$$("#qpFp").value || +pk.roll_price || 0;
      el._packs = `${r.packs.toLocaleString("en-GB")} packs per roll` + (pr ? ", " + qpPackWords(pr / r.packs) : "");
      $$("#qpCalc").textContent = "→ " + el._packs; };
    $$("#qpF").onchange = () => { $$("#qpFbox").style.display = $$("#qpF").checked ? "" : "none"; if ($$("#qpF").checked) setFilm(); };
    $$("#qpFs").onchange = setFilm; $$("#qpPk").onchange = calc; $$("#qpFp").oninput = calc;
    $$("#qpGo").onclick = async () => {
      const l = lines[+$$("#qpM").value], nm = kitName(l), m = machines[nm] || {};
      const who = $$("#qpP").value || "", title = who ? $$("#qpT").value : "";
      META.qpTitle = $$("#qpT").value; META.qpOpen = $$("#qpO").value; META.qpCarr = $$("#qpC").value; saveMeta();
      const pr = +$$("#qpPr").value || 0;
      let film = null;
      if ($$("#qpF").checked) { const fp = +$$("#qpFp").value || 0, fd = $$("#qpFd").value.trim();
        film = {name: $$("#qpFn").value.trim(), spec_line: (fd ? fd + (fp ? ": " : "") : "") + (fp ? `${gbp(fp)} excl. VAT Per roll` : ""), packs_line: el._packs || ""}; }
      const q = {company_lines: qpAddressLines(key, c), contact_full: who || "Sir/Madam", contact_first: who ? who.split(" ")[0] : "Sir/Madam",
        salutation_title: title, date_text: longDate(), date_parts: qpOrdinal(),
        opening: `${$$("#qpO").value}, I have pleasure in submitting this quotation for the ${m.phrase || nm} that we discussed.`,
        heading: m.heading || nm, product_name: nm, description: m.description || "", image: m.image || "", image_caption: m.caption || "",
        price_text: `£ ${pr.toLocaleString("en-GB", {minimumFractionDigits: 2, maximumFractionDigits: 2})} excl. VAT`,
        carriage_text: $$("#qpC").value, availability: $$("#qpA").value, warranty: m.warranty || "", specs: m.specs || [],
        service_groups: m.service_groups || [], max_film_width: m.max_film_width || "", film, terms: kit.terms || {},
        me: kit.me || "", my_email: kit.my_email || "", quote_ref: g.quote_number || ""};
      await qpMakeAndShow(q, $$("#qpL").value, `${nm} Quote - ${c.name}.pdf`.replace(/[\\/:*?"<>|]/g, ""), key);
    };
  });
}

function quotePdfsMadeHtml(key) {
  const recs = rows("quote_pdfs", key).slice().sort((a, b) => String(b.created).localeCompare(String(a.created)));
  if (!recs.length) return "";
  return `<h2>Quote PDFs <span class="r small">made on the PC</span></h2><div class="list">${recs.slice(0, 6).map(r => {
    let pt = ""; try { pt = (JSON.parse(r.data || "{}").price_text || "").replace(/\s*excl.*$/, ""); } catch (_) {}
    return `<div class="item" style="display:flex;align-items:center;gap:8px"><div style="flex:1"><b>${esc(r.product_name)}</b><div class="small">${niceDate(String(r.created).slice(0, 10))}${pt ? " · " + esc(pt) : ""}</div></div>
      <button class="btn sm sec" data-qrec="${esc(r.id)}">📄 Open</button></div>`; }).join("")}</div>`;
}
function openQuoteRecord(key, id) {
  const c = IDX.co.get(key), kit = (SNAP && SNAP.quote_kit) || {};
  const rec = rows("quote_pdfs", key).find(r => String(r.id) === String(id)); if (!rec) return;
  qpMakeAndShow(qpFromSnapshotRecord(rec, kit), rec.style || kit.layout || "classic", `${rec.product_name} Quote - ${c.name}.pdf`.replace(/[\\/:*?"<>|]/g, ""), key);
}
