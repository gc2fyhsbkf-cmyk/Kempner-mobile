"use strict";
/* Kempner Mobile — signature pad, Kempner-letterhead PDFs, sharing */

let _jspdfP;
function loadJsPDF() {
  if (window.jspdf) return Promise.resolve();
  return _jspdfP || (_jspdfP = new Promise((res, rej) => { const s = document.createElement("script"); s.src = "jspdf.umd.min.js";
    s.onload = res; s.onerror = () => { _jspdfP = null; rej(new Error("PDF maker not downloaded yet – open the app once with signal")); }; document.head.appendChild(s); }));
}
const pdfSafe = t => String(t ?? "").replace(/[—–]/g, "-").replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/…/g, "...").replace(/[^\x0A\x20-\x7E -ÿ]/g, "");
function longDate(d = new Date()) { return `${d.getDate()} ${["January","February","March","April","May","June","July","August","September","October","November","December"][d.getMonth()]} ${d.getFullYear()}`; }

function sigPad(canvas) {
  const ctx = canvas.getContext("2d"); let drawing = false, dirty = false, last = null;
  const fit = () => { const r = canvas.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, r.width * dpr); canvas.height = Math.max(1, r.height * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineWidth = 2.4; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = "#0b1f4b"; dirty = false; };
  fit();
  const pos = e => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  canvas.addEventListener("pointerdown", e => { drawing = true; last = pos(e); try { canvas.setPointerCapture(e.pointerId); } catch (_) {} e.preventDefault(); });
  canvas.addEventListener("pointermove", e => { if (!drawing) return; const p = pos(e);
    ctx.beginPath(); ctx.moveTo(last[0], last[1]); ctx.lineTo(p[0], p[1]); ctx.stroke(); last = p; dirty = true; e.preventDefault(); });
  const end = () => { drawing = false; };
  canvas.addEventListener("pointerup", end); canvas.addEventListener("pointercancel", end);
  return {clear: fit, isEmpty: () => !dirty, png: () => canvas.toDataURL("image/png")};
}

function makeSignoffPdf(o) {
  const {jsPDF} = window.jspdf, doc = new jsPDF({unit: "pt", format: "a4"});
  const W = 595.28, L = 65, R = W - 65, CW = R - L; let y = 89;
  // letterhead — same layout as the CRM's quote PDFs
  doc.setFont("times", "bold"); doc.setFontSize(48); doc.setTextColor(255, 0, 0); doc.text("KEMPNER", W / 2, y, {align: "center"}); y += 26;
  doc.setTextColor(0, 0, 0); doc.setFontSize(10);
  for (const l of ["S. Kempner Limited", "498-500 Honeypot Lane, Stanmore, Middlesex, HA7 1JZ.", "Telephone: 020 8952 5262  Facsimile: 020 8952 8061", "www.kempner.co.uk"]) { doc.text(l, W / 2, y, {align: "center"}); y += 13; }
  y += 6; doc.setFont("times", "bolditalic"); doc.setFontSize(11);
  for (const l of ["THE COUNTRY'S LARGEST DISTRIBUTORS OF", "DISPLAY SHRINK MATERIALS AND MACHINERY.", "AND", "CERTIFICATED TO ISO 9001:2015"]) { doc.text(l, W / 2, y, {align: "center"}); y += 13; }
  y += 24;
  doc.setFont("times", "bold"); doc.setFontSize(12);
  const top = y; doc.text(pdfSafe(o.company), L, y); y += 15;
  doc.setFont("times", "normal"); doc.setFontSize(11);
  for (const l of o.addressLines) if (l.trim()) { doc.text(pdfSafe(l), L, y); y += 13; }
  doc.text(pdfSafe(o.dateText), R, top, {align: "right"});
  y += 10; doc.setFont("times", "bold"); doc.text(pdfSafe(`For the attention of ${o.person}${o.position ? ", " + o.position : ""}`), L, y); y += 26;
  const title = pdfSafe(o.title || "Customer Acknowledgement");
  doc.setFontSize(14); doc.text(title, L, y); doc.setLineWidth(0.6); doc.line(L, y + 3, L + doc.getTextWidth(title), y + 3); y += 24;
  if (o.lines && o.lines.length) {
    const cols = [L, R - 190, R - 110, R];
    doc.setFontSize(11); doc.setFont("times", "bold");
    doc.text("Item", cols[0], y); doc.text("Qty", cols[1], y, {align: "right"}); doc.text("Unit price", cols[2], y, {align: "right"}); doc.text("Line total", cols[3], y, {align: "right"});
    y += 5; doc.line(L, y, R, y); y += 14; doc.setFont("times", "normal");
    for (const l of o.lines) { const w = doc.splitTextToSize(pdfSafe(l.description), cols[1] - cols[0] - 50);
      doc.text(w, cols[0], y); doc.text(num(l.quantity), cols[1], y, {align: "right"}); doc.text(gbp(l.price), cols[2], y, {align: "right"}); doc.text(gbp(l.quantity * l.price), cols[3], y, {align: "right"});
      y += 14 * w.length + 2; }
    doc.line(L, y - 6, R, y - 6); y += 8;
    const tot = (a, b, bold) => { doc.setFont("times", bold ? "bold" : "normal"); doc.text(a, cols[2], y, {align: "right"}); doc.text(b, cols[3], y, {align: "right"}); y += 15; };
    tot("Goods", gbp(o.calc.subtotal)); if (o.calc.shipping_cost) tot("Shipping", gbp(o.calc.shipping_cost));
    tot(`VAT (${num(o.vatRate * 100)}%)`, gbp(o.calc.vat_amount)); tot("Total", gbp(o.calc.grand_total), true); y += 14;
  }
  doc.setFont("times", "normal"); doc.setFontSize(12);
  const st = doc.splitTextToSize(pdfSafe(o.statement), CW); doc.text(st, L, y); y += 16 * st.length + 10;
  doc.setFontSize(11); doc.setFont("times", "italic");
  const conf = doc.splitTextToSize(pdfSafe(o.confirm || "I confirm the above."), CW); doc.text(conf, L, y); y += 14 * conf.length + 8;
  if (y > 640) { doc.addPage(); y = 80; }
  doc.setFont("times", "bold"); doc.text("Signed:", L, y + 40);
  const img = doc.getImageProperties(o.sig), sw = 230, sh = Math.min(90, sw * img.height / img.width);
  doc.addImage(o.sig, "PNG", L + 55, y, sw, sh); y += Math.max(sh, 50) + 6;
  doc.setLineWidth(0.5); doc.line(L + 55, y, L + 55 + sw, y); y += 18;
  doc.setFont("times", "normal");
  doc.text(pdfSafe(`Name: ${o.person}${o.position ? "   Position: " + o.position : ""}`), L, y); y += 15;
  doc.text(pdfSafe(`Date & time signed: ${o.dateText}, ${o.timeText}`), L, y); y += 15;
  doc.text(pdfSafe(`For S. Kempner Limited: ${o.rep || "________________"}`), L, y);
  doc.setFontSize(8); doc.setTextColor(120); doc.text(pdfSafe(`Ref ${o.ref} - signed electronically on a mobile device`), L, 810);
  return doc.output("datauristring");
}

function dataUriToFile(uri, name, type) {
  const b64 = uri.split(",")[1], bin = atob(b64), arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new File([arr], name, {type: type || (uri.slice(5, uri.indexOf(";")) || "application/octet-stream")});
}
async function shareFile(f) {
  if (navigator.canShare && navigator.canShare({files: [f]})) { try { await navigator.share({files: [f], title: f.name}); return; } catch (e) { if (e.name === "AbortError") return; } }
  const a = document.createElement("a"); a.href = URL.createObjectURL(f); a.download = f.name; a.target = "_blank"; document.body.appendChild(a); a.click(); a.remove();
}
const sharePdf = (uri, name) => shareFile(dataUriToFile(uri, name, "application/pdf"));
