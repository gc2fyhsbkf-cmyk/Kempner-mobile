"use strict";
/* Kempner business card — shared by the app (index.html) and the page your QR opens (card.html).
   Your details live only on your phone; the QR carries them in the link itself (after the #),
   so nothing personal is stored in the public website files. */

const CARD_DEFAULTS = {name: "", title: "", mobile: "", office: "020 8952 5262", email: "", website: "www.kempner.co.uk",
  company: "S. Kempner Limited", street: "498-500 Honeypot Lane", town: "Stanmore", county: "Middlesex", postcode: "HA7 1JZ"};
const CARD_KEYS = {n: "name", t: "title", m: "mobile", o: "office", e: "email", w: "website", c: "company", s: "street", tn: "town", cy: "county", pc: "postcode"};
const CARD_LINE = "Display shrink materials & machinery";

const _esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
const fmtUkPhone = n => { const d = String(n || "").replace(/[^\d+]/g, "");
  return /^07\d{9}$/.test(d) ? d.slice(0, 5) + " " + d.slice(5) : /^0[12]0\d{8}$/.test(d) ? `${d.slice(0, 3)} ${d.slice(3, 7)} ${d.slice(7)}` : String(n || ""); };
const cardWeb = c => String(c.website || "").replace(/^https?:\/\//i, "").replace(/\/$/, "");

// Only what differs from the Kempner defaults goes in the link, so the QR stays small and easy to scan.
function cardToHash(c, metDate) {
  const p = new URLSearchParams();
  for (const [k, f] of Object.entries(CARD_KEYS)) if ((c[f] || "") !== (CARD_DEFAULTS[f] || "")) p.set(k, c[f] || "");
  if (metDate) p.set("d", metDate);
  return p.toString();
}
function cardFromHash(h) {
  const p = new URLSearchParams(String(h || "").replace(/^#/, "")), c = Object.assign({}, CARD_DEFAULTS);
  for (const [k, f] of Object.entries(CARD_KEYS)) if (p.has(k)) c[f] = p.get(k);
  c._met = p.get("d") || "";
  return c;
}

// The card face (front) as HTML — the same markup on your phone and on theirs.
function cardFrontHtml(c) {
  const web = cardWeb(c), addr = [c.street, c.town, [c.county, c.postcode].filter(Boolean).join(" ")].filter(Boolean).join(" · ");
  return `<div class="bc-k">KEMPNER</div><div class="bc-co">${_esc(c.company || "S. Kempner Limited")}</div><div class="bc-tag">${_esc(CARD_LINE)}</div>
    <div class="bc-nm">${_esc(c.name)}</div>${c.title ? `<div class="bc-ti">${_esc(c.title)}</div>` : ""}
    <div class="bc-ft"><div>${c.mobile ? `M. ${_esc(fmtUkPhone(c.mobile))}<br>` : ""}${c.email ? `E. ${_esc(c.email)}` : ""}</div>
      <div class="r">${c.office ? `T. ${_esc(fmtUkPhone(c.office))}<br>` : ""}${_esc(web)}</div></div>
    <div class="bc-ad">${_esc(addr)}</div>`;
}

// ---- the card as a picture (for Photos, and as the contact's photo) ----
function _paper(ctx, w, h) {
  const g = ctx.createLinearGradient(0, 0, w, h); g.addColorStop(0, "#f5f0e5"); g.addColorStop(1, "#e6dfcf");
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  const r = ctx.createRadialGradient(w * .3, h * .2, 0, w * .3, h * .2, w * .8); r.addColorStop(0, "rgba(255,255,255,.45)"); r.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = r; ctx.fillRect(0, 0, w, h);
  const img = ctx.getImageData(0, 0, w, h), px = img.data;
  for (let i = 0; i < px.length; i += 4) { const n = (Math.random() - .5) * 16; px[i] += n; px[i + 1] += n; px[i + 2] += n * .9; }
  ctx.putImageData(img, 0, 0);
}
function _spaced(ctx, text, x, y, spacing, align = "center") {
  const chars = [...String(text)], widths = chars.map(ch => ctx.measureText(ch).width);
  const total = widths.reduce((a, b) => a + b, 0) + spacing * Math.max(0, chars.length - 1);
  let cx = align === "center" ? x - total / 2 : align === "right" ? x - total : x;
  const prev = ctx.textAlign; ctx.textAlign = "left";
  chars.forEach((ch, i) => { ctx.fillText(ch, cx, y); cx += widths[i] + spacing; });
  ctx.textAlign = prev;
}
const _cp = px => `${px}px Copperplate, "Copperplate Gothic Light", "Times New Roman", serif`;
// kind: "card" (85×55 landscape) or "square" (for the contact photo, which iPhones show in a circle)
function drawCard(c, kind = "card") {
  const cv = document.createElement("canvas"), sq = kind === "square";
  const W = sq ? 640 : 1275, H = sq ? 640 : 825; cv.width = W; cv.height = H;
  const ctx = cv.getContext("2d"); _paper(ctx, W, H); ctx.textBaseline = "alphabetic";
  const ink = "#2a2620", soft = "#5a5246";
  if (sq) {
    // iPhones show contact photos in a circle, so everything sits well inside it
    ctx.fillStyle = "#d7182a"; ctx.font = 'bold 92px "Times New Roman", Times, serif'; ctx.textAlign = "center"; ctx.fillText("KEMPNER", W / 2, 300);
    ctx.fillStyle = ink; ctx.font = _cp(34); _spaced(ctx, (c.name || "").toUpperCase(), W / 2, 372, 4);
    ctx.fillStyle = soft; ctx.font = 'italic bold 19px "Times New Roman", serif'; _spaced(ctx, "SHRINK FILM & MACHINERY", W / 2, 414, 2);
    const sm = document.createElement("canvas"); sm.width = sm.height = 360; sm.getContext("2d").drawImage(cv, 0, 0, 360, 360);
    return sm.toDataURL("image/jpeg", .82);
  }
  ctx.textAlign = "center";
  ctx.fillStyle = "#d7182a"; ctx.font = 'bold 138px "Times New Roman", Times, serif'; ctx.fillText("KEMPNER", W / 2, 190);
  ctx.fillStyle = ink; ctx.font = '600 30px "Times New Roman", serif'; _spaced(ctx, (c.company || "S. Kempner Limited").toUpperCase(), W / 2, 240, 9);
  ctx.fillStyle = soft; ctx.font = 'italic bold 21px "Times New Roman", serif'; _spaced(ctx, CARD_LINE.toUpperCase(), W / 2, 274, 2);
  ctx.fillStyle = ink; ctx.font = _cp(54); _spaced(ctx, (c.name || "").toUpperCase(), W / 2, 450, 8);
  if (c.title) { ctx.fillStyle = soft; ctx.font = _cp(26); _spaced(ctx, c.title.toUpperCase(), W / 2, 495, 5); }
  ctx.fillStyle = ink; ctx.font = _cp(28);
  const L = [c.mobile ? "M. " + fmtUkPhone(c.mobile) : "", c.email ? "E. " + c.email : ""].filter(Boolean);
  const R = [c.office ? "T. " + fmtUkPhone(c.office) : "", cardWeb(c)].filter(Boolean);
  L.forEach((t, i) => _spaced(ctx, t, 80, 680 + i * 42 - (L.length - 1) * 42 + 42, 2, "left"));
  R.forEach((t, i) => _spaced(ctx, t, W - 80, 680 + i * 42 - (R.length - 1) * 42 + 42, 2, "right"));
  ctx.fillStyle = "#6b6252"; ctx.font = '19px "Times New Roman", serif';
  _spaced(ctx, [c.street, c.town, [c.county, c.postcode].filter(Boolean).join(" ")].filter(Boolean).join(" · ").toUpperCase(), W / 2, 795, 3);
  return cv.toDataURL("image/png");
}

// vCard. With `photo` (a data: URI) the contact gets your card as its picture; `note` helps them remember you.
function vcardText(c, opt = {}) {
  const e = s => String(s || "").replace(/\\/g, "\\\\").replace(/([,;])/g, "\\$1").replace(/\n/g, "\\n");
  const parts = String(c.name || "").trim().split(/\s+/), last = parts.length > 1 ? parts.pop() : "", first = parts.join(" ");
  const web = c.website ? (/^https?:/i.test(c.website) ? c.website : "https://" + c.website) : "";
  const fold = line => { const out = []; for (let i = 0; i < line.length; i += 74) out.push((i ? " " : "") + line.slice(i, i + 74)); return out.join("\r\n"); };
  const lines = ["BEGIN:VCARD", "VERSION:3.0", `N:${e(last)};${e(first)};;;`, `FN:${e(c.name)}`, c.company ? `ORG:${e(c.company)}` : "",
    `TITLE:${e(c.title || "Shrink film & packaging machinery")}`,
    c.mobile ? `TEL;TYPE=CELL:${c.mobile}` : "", c.office ? `TEL;TYPE=WORK:${c.office}` : "", c.email ? `EMAIL;TYPE=WORK:${c.email}` : "", web ? `URL:${web}` : "",
    (c.street || c.town || c.postcode) ? `ADR;TYPE=WORK:;;${e(c.street)};${e(c.town)};${e(c.county)};${e(c.postcode)};United Kingdom` : "",
    opt.note ? `NOTE:${e(opt.note)}` : "", "CATEGORIES:Kempner,Shrink film"];
  if (opt.photo) { const m = /^data:image\/(\w+);base64,(.+)$/.exec(opt.photo); if (m) lines.push(fold(`PHOTO;ENCODING=b;TYPE=${m[1].toUpperCase()}:${m[2]}`)); }
  lines.push("END:VCARD");
  return lines.filter(Boolean).join("\r\n");
}
function cardNote(c, met) {
  const when = met ? new Date(met + "T12:00:00").toLocaleDateString("en-GB", {day: "numeric", month: "long", year: "numeric"}) : "";
  return `${c.name}${c.company ? " at " + c.company : ""} (Kempner) — display shrink film, wrapping and packaging machinery.${when ? " Card received " + when + "." : ""}`;
}
function cardFileName(c, ext) { return `${String(c.name || "Kempner").replace(/[\\/:*?"<>|]/g, "-")} - Kempner.${ext}`; }
