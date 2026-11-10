# Kempner Mobile

An offline phone companion to the Kempner CRM. It's free: no App Store and no hosting bill. Your data stays on your phone and only moves when you send a file.

## Files (all at the top level on GitHub, no folders)
`index.html`, `reorder.html`, `card.html`, `qrcode.js`, `card.js`, `home.js`, `videos.js`, `core.js`, `views.js`, `forms.js`, `pdf.js`, `road.js`, `tools.js`, `sw.js`, `manifest.webmanifest`, `jspdf.umd.min.js`, `icon-192.png`, `icon-512.png`, `apple-touch-icon.png`, `README.md`

To update: on GitHub, **Add file → Upload files**, drag in all the files and **Commit**. Then open the app twice with signal.

`reorder.json` is not in this zip on purpose. The CRM makes it (see QR reorder stickers below), so uploading an app update never overwrites your customers' film lists.

## The tabs
- **Home** (where the app opens):
  - your business card (tap it for the QR)
  - **Up next**: the next stop on today's plan or your next meeting, with Directions / Brief / Check in / Call
  - quick buttons for a note, call, action, visit, photo, new lead, Nearby and cost per pack
  - links to Today and your day's plan.
- **Today**: overdue and due actions (tick ✓ to complete), meetings for the next 7 days with directions, plus the CRM's film reorders to chase and accounts that need a nudge.
- **Companies**: search by name, person, phone number, postcode or tag. Filter by Mine/Everyone and status, and sort by A–Z, most overdue, health score or recently updated.
  - Tabs match the PC's: **Main**, **🛋 Lobby**, and any you add on the PC. A search looks across every tab.
  - Lobby leads show no health score or warnings, just the town and why they're worth a try. Tap **⬆ Promote** on one to move it to your main list (the PC follows at the next sync).
  - Making a new company? Tick "Just a lead" to put it in the Lobby.
  - Plan my day suggests up to three Lobby leads within 3 miles of your stops.
- **Company page**: Call / Text / Email / Directions, a big **＋ Add** button, and tabs for Overview · Notes · Actions · Meetings · People · Commercial · Equipment · Files.
- **Road**, which has three parts:
  - **Plan my day**: meetings booked for the day (on the PC or phone) appear as stops automatically, with ⏰ their time. **✨ Best order** offers *Shortest route* (ignores times, and warns which timed visit would move), *Keep my times* (timed visits stay in order; the rest fit around them) or *Lock the first stop*, each with its estimated miles. 💤 on a suggestion stops it being suggested for a while. Days you plan on the PC (**🗓 Plan visits**) arrive with the next snapshot, marked 🖥 from PC with any note you wrote. Changes you make on the phone are kept. Or add the customers you're seeing here, tap ✨ Best order, then open the whole route in Google Maps. It also suggests nearby customers who are due a reorder or a nudge.
  - **Nearby**: your customers sorted by distance from where you are.
  - **Mileage**: your miles are built automatically from visits, check-ins and signed sheets. Each day can **start** and **end** at Home, the Office or the first/last stop. **＋ Stop** adds the office mid-day, a customer, or somewhere not on your list. ✕ takes a stop off, e.g. a mis-tapped check-in. The rate takes 45, 45p or 0.45. Road miles need signal. You can correct any leg, see month totals × your pence per mile, export a CSV for your claim, and mark a month as claimed.
- **📋 Brief** on every company: who you'll meet, the last conversations, open actions and quotes, recent orders, what they run, and trials. **🔊 Read aloud** reads it to you in the car, and **📍 Check in** logs you at the customer.
- **Prices**: what each product last sold for, and to whom, plus the CRM's calculators (GP, VAT, price per m², thickness).
- **🧮 Cost per pack** (Prices → Calculators, a company's ＋ Add, or tap a pack profile on Equipment):
  - uses the CRM's L-sealer formula: film width = height + width + 30 mm overlap, rounded up to 50 mm; cut length = length + height + overlap + scrap; packs per roll less one for threading
  - the roll price fills itself in from the customer's known film specs, then their last order for that film, and follows the film when you change thickness. Type your own to override it
  - **↻ 90°** turns the pack, and the result shows how the turned version compares
  - **💾 Save to this pack** (or **Save as a pack profile**) updates the CRM's pack profile at the next sync. Unsaved changes are kept on the phone, so you can leave and come back
  - Share or save as a note too

## Adding things (all go into the CRM when you sync)
- **Notes** using the CRM's own templates, with an optional status change (Urgent / Warm / OK / Cold).
- **Call logging**:
  - after you call from the app, it asks how it went
  - uses the same "Asked / noted" questions as Live Call
  - you can add a follow-up action.
- **Today** keeps busy action lists calm:
  - **📌 Pinned** actions are shown in full at the top, whatever their date. Pin them on the PC before you head out, or on the phone (⏭ → Pin it); a pin made on the phone goes to the PC too
  - everything else sits under **Other actions**, with tabs for Overdue, Today, This week and All
  - each action is a compact one-line row, grouped by customer, with the first 8 shown and "Show all" for the rest
  - **⏭ Move all overdue** pushes the overdue ones to tomorrow, next Monday or next week, unticking any you want to leave
- **Actions** with quick dates and priorities. **✓** marks one done and records the outcome, with a "same again next week" option. **⏭** moves it to tomorrow, next Monday, next week and so on, or a date you pick, with an optional reason. It's moved in the CRM at the next sync.
- **Visits / meetings** by type (film trial, commission, service, machine demo, check-up).
  - Films and machines you saw are added to the equipment list.
  - A meeting already booked in the CRM can be logged as done.
- **Addresses**: on a company's Overview, or ＋ Add → 📍 Address. **📍 I'm here** fills in the postcode and town from where you're standing; you add the street. The CRM adds it alongside any existing address, never replacing one.
- **Photos** are attached to the company in the CRM, with a note.
- **Quotes** and **orders** use your product catalogue and the price that customer last paid, with VAT and shipping totals. A quote can also add a "chase quote" action.
- **🛒 Convert to order** on any open quote (on the Commercial tab) copies every item, quantity and agreed price into a new order. Change what they've altered, add the PO number, and it marks the quote Won. In the CRM the order is linked to the quote, just like the PC's own Convert to order.
- **Sign-off sheets**: a PDF on the Kempner letterhead with the customer's finger signature. There are five kinds:
  - goods left on site
  - delivery note
  - film trial agreement
  - collection
  - work completed.
- **📅 Add to Calendar** on meetings and actions puts them in the iPhone Calendar with a reminder.

## 📍 Drop-ins and check-ins
- **Drop-in** (Home, Plan my day, or Mileage → ＋ Stop): somewhere you popped into that isn't on your list. Fill in a name, a postcode (📍 I'm here does it for you) and a time. Save it as just a mileage stop, a 🛋 Lobby lead or a customer. A mileage stop can be added to your customers later (＋🏢 on its mileage line).
- **Mis-tapped check-in?** Use ↩ Undo on the check-in screen, ↩ on the stop in Plan my day, or ✕ on its line in Mileage. Any note or visit you logged stays in the CRM.

## 🩺 Missing info
- From Home (or Sync → Settings): your customers missing a postcode, a contact, a phone number or an email, with a button to fix each one there and then. Lobby leads are left out. Duplicates and untagged products stay on the PC's Data health.

## Your business card
- **🪪 My card** (top right of Today, or Sync → Settings) is your card on the Kempner letterhead. Tap it to turn it over to the QR code. Scanning it opens your **digital card** (card.html) on their phone: they see the card, then **Save to my contacts**, which saves you with the card as your contact photo and a note saying where you're from, or save the card to their Photos. If they'll have no signal, switch the QR to plain contact in Edit my details. People scan it with their camera to save your details. **Send my contact card** shares it as a contact file by AirDrop or text. Set your details once and they stay on the phone.

## QR reorder stickers
- Set up on the PC: **📱 Phone sync → 🔖 QR reorder stickers**. Enter the app's web address and the orders email, add customers and their film(s), then:
  1. **Save reorder.json** and upload it to GitHub next to `reorder.html`
  2. **Print stickers**: an A4 page opens in your browser.
- The customer scans the sticker and picks the film, number of rolls, PO number and their name. Their email app opens with the order, addressed to you.
- After an intro roll, change their film on the PC and upload reorder.json again. The printed sticker keeps working. Untick "switched on" to stop a sticker taking orders.
- The public reorder.json holds only random codes and film names, never customer names.
- On the phone, a company's **＋ Add → 🔖 Reorder QR** shows the code for them to scan.

## Colours
- The app follows the PC's colours, so it's light unless you tick Dark mode in the CRM. Sync → Settings → **Colours** can force Light or Dark, or follow the iPhone.

## 💾 Backup and reminders (Sync → Settings)
- **Back up this phone's data** saves your mileage, visits, day plans, card details and anything unsent as one file (save it to Drive). To restore, pick that file with 📥 Load snapshot. Home reminds you if it's been a week.
- **Weekday 5pm reminder** adds a repeating "send today's changes" event to your iPhone Calendar, which does the notifying.
- **✏️ Edit** an unsent note, action, visit, address or new company from the Sync list (or ✏️ on an unsent note) before it goes to the CRM.
- Company search also looks **inside notes** ("📝 In their notes").

## 🎬 Videos (Home → Videos)
- The list comes from the CRM (🎬 Videos pill on Today): title, machine and a link if it has one. **Only the list syncs, never the video files**, so syncing stays instant.
- To show one with no signal: ⋯ → **📎 Keep a copy**, pick it from Photos/Files. It's stored inside the app on this phone. Remove copies you no longer show; videos are big.
- YouTube links (unlisted is fine) open in the YouTube app. **＋ Add a video** on the phone keeps the file here and sends its title to the CRM list.
- Avoid putting videos in this GitHub repo: it's public and slow for big files.

## 🏠 Working from home (occasional)
1. Phone: Sync → Settings → **📦 Export the full CRM copy**. Get the file to the laptop (AirDrop, Drive or email).
2. Laptop CRM: Phone sync → **🏠 Open a phone copy…**. It builds a separate home copy (your normal data on the laptop isn't touched) and shows an orange HOME COPY bar.
3. Make your tweaks. Then **📤 Export home changes** (the CRM also offers this when you close it).
4. Phone: Sync → 📥 Load and pick that file. The changes join your unsent items and go to work with the next Export changes. (Or import the file straight into the CRM at work.)
- Carried: new companies, contacts, addresses, notes, meetings and actions; actions done, moved or pinned; deleted companies (the work PC asks first).
- Not carried (redo at work): edits to existing details and older notes, new quotes and orders. The home copy tells you if there are any.
- **↩ Back to my normal data** switches the laptop back.

## Version 20: in step with the latest CRM
- **Orders:** ↻ Repeat last order, a separate 🔖 PO / ref box, the price shows ▲/▼ against what they last paid, machines fall back to their list price, a duplicate warning, and lines for a spec with an in-stock call-off are costed off it (📦 tick) and drawn down on the PC.
- **Equipment tab:** each machine shows installed date, serial, last service, max roll and packs/min (from its data sheet), spares bought, and its videos. **🔧 Log a service** and **🔩 Log spares** go to that machine on the PC. A 🔧 Service visit asks which machine was serviced.
- **📌 Notice board** (Home): see the PC's stickies and pin new ones from the road.
- **Companies:** 🆕 Added filter (this week / last week / 30 days) and a Newest added sort.
- **Prices:** tap a machine to see its data sheet facts (list price, max film, seal, packs/min, lead time, warranty).
- Contacts marked as left on the PC drop off the phone's contact lists.

## Version 26 — new look
- **New tab bar:** Home · Today · **＋** · Customers · Road, floating at the bottom with clean line icons.
- **The big ＋ in the middle** adds anything from anywhere. On a customer's page it goes straight to their options (note, call, action, visit, photo, quote, order, sign-off, contact…). Anywhere else it shows your recent customers as one-tap icons, a search, and New lead / Drop-in / Sticky.
- **⋯ (top right)** opens **More**: Prices & tools, Cost per pack, My business card, Videos, Nearby, Mileage, Wrap up the day, Drop-in, Notice board, Missing info, Sync and Meetings → Calendar. It also shows whether anything is waiting to sync (the ⋯ gets a badge when it is).
- Softer cards, bigger titles, quieter banners. Everything that was there before is still there.

## Version 25
- 📇 **Contacts from a business card.** On *Add contact*, open **📇 From a business card**. On the iPhone, point the Camera at the card, tap the text button (bottom-right), **Copy All**, paste it in, and tap **Fill in the details**. Name, job title, mobile, other number and email are picked out for you to check before saving. Nothing leaves the phone.

## Version 24
- 📄 **Quote PDFs on the phone.** On a customer's Commercial tab, any quote with a machine on it has a **📄 Quote PDF** button. Pick who it's for, the opening, price, carriage, and (optionally) film details with pack costings, then **Make the PDF**. It's built on the phone to the same layout as the CRM (classic letterhead or modern), with the machine's photo, description and service requirements from its data sheet. Then email/share it.
- Quote PDFs you made on the PC are listed under **Quote PDFs** on the same tab. Tap **📄 Open** to rebuild an identical copy (dated today) to send on.
- Machine photos and wording come over in the sync file, so make sure the data sheet is filled in on the PC first.

## Version 23
- **📅 Put upcoming meetings in Calendar** (Home): one tap adds every booked meeting to your phone's calendar. Each meeting keeps the same ID, so doing it again updates them rather than adding doubles.
- **Booking a meeting** offers to add it to your calendar straight away (with a 30-minute reminder).
- **⏭ Move** uses the same choices as the PC: Today, Tomorrow, +2/+3/+4 days, +1/+2 weeks, +1 month, and next week's Mon–Fri. A weekend asks first.

## Version 22
- **📞 Snapshot** (company page → "On a call?"): heads-up, who's who, the film they use with the last price paid, recent quotes, last bought, what you last talked about, and what's coming up.
- **🌡 Temperature buttons** on the company page (Hot / Warm / Cold / OK / To contact / Dead / Not set); the customer list shows it as a coloured left edge.
- **⭐ Interested in** on a company's Equipment tab — note a machine they've asked about; it shows on the PC's Product Catalogue.
- **Search a phone number** to see whose it is.
- **Worth a visit while you're there** — choose 3 / 6 / 10 / 20 / 30 miles.

## Version 21
- **Checking in** somewhere asks how the last stop went if you haven't written it up: 👍 Fine (one tap, optional one-liner) or 📝 Write it up.
- **🌙 Wrap up the day** (Home, after 3pm or once you've checked in somewhere; the 5pm calendar reminder opens it): stops and miles, visits not written up, what's waiting to send with Export now, and tomorrow at a glance.
- **🧪 Samples** (company → ＋): what film, how many, who with and a chase date. On the PC it becomes a film trial, a note and a chase action.

## Safety nets
- **Entries found on the phone that aren't in the PC file.** When you load a PC file, anything on the phone the PC file doesn't know about is listed (unsent items made before the PC file, items saved against a company the PC doesn't have or that now has a different name, mileage stops for missing companies). **Continue** removes just those and loads. **Wait** changes nothing. Anything added after the PC file was made is kept and not listed.
- **🧹 Clear this phone's data** (Sync → Settings) starts fresh: unsent items, mileage stops, plans and map points go; the CRM copy, settings and card stay.
- **🗑 Delete this company** (company → ＋ sheet): it vanishes from the phone. At the next import the CRM lists what the company has and asks: Continue deletes it there too (bin, 7 days), Wait imports everything else and asks again next time.
- A banner warns when items have been on the phone too long without being sent, and when the CRM copy is a week old.
- Importing the same file twice is harmless, because already-imported items are skipped.
- The phone never edits CRM records, and it only deletes a company when you say Continue on the PC.
