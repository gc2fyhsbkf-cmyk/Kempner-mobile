"use strict";
/* Kempner Mobile — 🎬 videos to show customers. The list comes from the PC (titles, machine, links); you keep offline
   copies of the ones you want, stored inside the app on this phone. Files never go through sync. */

const vidKey = id => "vid:" + id;
// PC list + videos added on this phone (META.videos)
function videoList() {
  const pc = ((SNAP && SNAP.videos) || []).map(v => Object.assign({}, v, {key: "pc" + v.id}));
  const pcPhoneIds = new Set(pc.map(v => v.phone_id).filter(Boolean));
  const mine = (META.videos || []).filter(v => !pcPhoneIds.has(v.id)).map(v => Object.assign({}, v, {key: v.id, mine: true}));
  // a phone-added video that the PC now lists keeps its offline copy under the phone id
  for (const v of pc) if (v.phone_id) v.key = v.phone_id;
  return pc.concat(mine);
}
const isYouTube = u => /youtu\.?be/i.test(u || "");
let VID_HAVE = new Set();
async function refreshVidHave() { VID_HAVE = new Set((await KV.get("vid_index")) || []); }
async function setVidHave(key, on) { const s = new Set((await KV.get("vid_index")) || []); on ? s.add(key) : s.delete(key); await KV.set("vid_index", [...s]); VID_HAVE = s; }

route(/^#\/videos$/, async () => {
  setHeader("Videos", "#/home", "home");
  await refreshVidHave();
  const list = videoList(), groups = new Map();
  for (const v of list) { const g = (v.tags || "Other").split(",")[0].trim() || "Other"; if (!groups.has(g)) groups.set(g, []); groups.get(g).push(v); }
  let est = ""; try { const e = await navigator.storage.estimate(); if (e && e.usage) est = `Using ${(e.usage / 1e6).toFixed(0)} MB on this phone.`; } catch (e) {}
  $("#view").innerHTML = `<input class="search" id="vq" type="search" placeholder="Find a video…" autocomplete="off">
    <div id="vlist">${[...groups.entries()].map(([g, vs]) => `<h2>${esc(g)}</h2><div class="list">${vs.map(v => {
      const have = VID_HAVE.has(v.key);
      return `<div class="row" data-vrow="${esc((v.title + " " + (v.tags || "")).toLowerCase())}"><button class="btn sm" data-vplay="${esc(v.key)}" style="flex:none">▶</button>
        <div class="m"><div class="t" style="white-space:normal">${esc(v.title)}</div><div class="s">${have ? "📥 on this phone" : v.url ? (isYouTube(v.url) ? "▶ YouTube (needs signal)" : "🔗 link (needs signal)") : v.pc_file ? "💻 file is on the PC — add a copy here" : "no copy here yet"}${v.mine ? " · added here" : ""}</div></div>
        <button class="btn sm sec" data-vmore="${esc(v.key)}" style="flex:none">⋯</button></div>`; }).join("")}</div>`).join("") || '<div class="empty">No videos yet. Add them on the PC (🎬 Videos) or here.</div>'}</div>
    <button class="btn block" id="vAdd" style="margin-top:12px">＋ Add a video from this phone</button>
    <p class="small" style="margin:8px 4px">Offline copies are kept inside this app, so they play with no signal. ${est} Big videos use a lot of space — keep the ones you actually show.</p>`;
  const v = $("#view");
  $("#vq").oninput = e => { const q = e.target.value.toLowerCase().trim(); v.querySelectorAll("[data-vrow]").forEach(r => r.style.display = !q || r.dataset.vrow.includes(q) ? "" : "none"); };
  v.querySelectorAll("[data-vplay]").forEach(b => b.onclick = () => playVideo(list.find(x => x.key === b.dataset.vplay)));
  v.querySelectorAll("[data-vmore]").forEach(b => b.onclick = () => videoMenu(list.find(x => x.key === b.dataset.vmore)));
  $("#vAdd").onclick = () => addPhoneVideo();
});

async function playVideo(vd) {
  if (!vd) return;
  const blob = VID_HAVE.has(vd.key) ? await KV.get(vidKey(vd.key)) : null;
  if (!blob && vd.url && isYouTube(vd.url)) { location.href = vd.url; return; }   // opens the YouTube app
  const src = blob ? URL.createObjectURL(blob) : vd.url;
  if (!src) return videoMenu(vd);
  openSheet(`<b style="font-size:16px">${esc(vd.title)}</b><video src="${esc(src)}" controls playsinline autoplay style="width:100%;max-height:62vh;margin-top:10px;border-radius:10px;background:#000"></video>
    <div class="small" style="margin-top:6px">Tap ⤢ for full screen. ${blob ? "Playing the copy on this phone." : "Streaming — needs signal."}</div>`, el => {
    const vv = el.querySelector("video"); vv.onerror = () => toast(blob ? "Couldn't play that file" : "Couldn't stream it — no signal? Keep a copy on the phone for next time.", 4500);
  });
}
function videoMenu(vd) {
  if (!vd) return;
  const have = VID_HAVE.has(vd.key), direct = vd.url && !isYouTube(vd.url);
  openSheet(`<b style="font-size:16px">${esc(vd.title)}</b>${vd.notes ? `<div class="small">${esc(vd.notes)}</div>` : ""}
    ${have ? `<button class="btn block sec" id="vmDel" style="margin-top:10px;color:var(--red)">🗑 Remove the copy on this phone</button>` : `
      <button class="btn block" id="vmPick" style="margin-top:10px">📎 Keep a copy — choose it from Photos / Files</button>
      ${direct ? `<button class="btn block sec" id="vmDl" style="margin-top:8px">⬇ Download it from the link (needs signal)</button>` : ""}`}
    ${vd.url ? `<a class="btn block sec" href="${esc(vd.url)}" target="_blank" style="margin-top:8px">🔗 Open the link</a>` : ""}
    ${vd.mine ? `<button class="btn block sec" id="vmForget" style="margin-top:8px;color:var(--red)">Remove from the list</button>` : ""}
    <div class="small" id="vmMsg" style="margin-top:8px"></div>`, el => {
    const msg = el.querySelector("#vmMsg");
    const store = async blob => { msg.textContent = "Saving…"; try { await KV.set(vidKey(vd.key), blob); await setVidHave(vd.key, true); closeSheet(); toast("📥 Kept on this phone"); render(); }
      catch (e) { msg.textContent = "Couldn't store it (phone storage full?) " + (e.message || ""); } };
    const pick = el.querySelector("#vmPick"); if (pick) pick.onclick = () => pickVideoFile(f => store(f));
    const dl = el.querySelector("#vmDl"); if (dl) dl.onclick = async () => { msg.textContent = "Downloading…";
      try { const r = await fetch(vd.url); if (!r.ok) throw new Error(r.status); store(await r.blob()); }
      catch (e) { msg.textContent = "Couldn't download it here (no signal, or the site doesn't allow it). Use 📎 instead."; } };
    const del = el.querySelector("#vmDel"); if (del) del.onclick = async () => { await KV.del(vidKey(vd.key)); await setVidHave(vd.key, false); closeSheet(); toast("Removed from the phone"); render(); };
    const fg = el.querySelector("#vmForget"); if (fg) fg.onclick = async () => { META.videos = (META.videos || []).filter(x => x.id !== vd.key); await saveMeta();
      await KV.del(vidKey(vd.key)); await setVidHave(vd.key, false); closeSheet(); render(); };
  });
}
function pickVideoFile(cb) {
  const i = document.createElement("input"); i.type = "file"; i.accept = "video/*";
  i.onchange = () => { const f = i.files && i.files[0]; if (f) cb(f); }; i.click();
}
function addPhoneVideo() {
  openSheet(`<b style="font-size:16px">＋ Add a video</b>
    <label class="f">Title</label><input class="f" id="avT" placeholder="e.g. L-sealer running ready meals">
    <label class="f">Machine / group</label><input class="f" id="avG" placeholder="e.g. L-sealer">
    <button class="btn block" id="avPick" style="margin-top:12px">📎 Choose the video (Photos / Files)</button>
    <div class="small" style="margin-top:6px">It's kept in this app on this phone. Its title goes to the PC's video list at the next sync.</div>`, el => {
    el.querySelector("#avPick").onclick = () => { const title = el.querySelector("#avT").value.trim(); if (!title) return toast("Give it a title first");
      const tags = el.querySelector("#avG").value.trim();
      pickVideoFile(async f => { const id = "pv" + Date.now().toString(36);
        try { await KV.set(vidKey(id), f); } catch (e) { return toast("Couldn't store it (phone storage full?)", 4000); }
        META.videos = (META.videos || []).concat([{id, title, tags}]); await saveMeta(); await setVidHave(id, true);
        await addEvent("video_new", null, {phone_id: id, title, tags}); closeSheet(); toast("🎬 Added"); render(); }); };
  });
}
