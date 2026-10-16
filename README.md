# Kempner Mobile

An offline phone companion to the Kempner CRM. It's free: no App Store and no hosting bill. Your data stays on your phone and only moves when you send a file.

## Files (all at the top level on GitHub, no folders)
`index.html`, `reorder.html`, `card.html`, `qrcode.js`, `card.js`, `home.js`, `core.js`, `views.js`, `forms.js`, `pdf.js`, `road.js`, `tools.js`, `sw.js`, `manifest.webmanifest`, `jspdf.umd.min.js`, `icon-192.png`, `icon-512.png`, `apple-touch-icon.png`, `README.md`

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
  - **Plan my day**: days you plan on the PC (**🗓 Plan visits**) arrive with the next snapshot, marked 🖥 from PC with any note you wrote. Changes you make on the phone are kept. Or add the customers you're seeing here, tap ✨ Best order, then open the whole route in Google Maps. It also suggests nearby customers who are due a reorder or a nudge.
  - **Nearby**: your customers sorted by distance from where you are.
  - **Mileage**: your miles are built automatically from visits, check-ins and signed sheets, starting and ending at your home postcode. Road miles need signal. You can correct any leg, see month totals × your pence per mile, export a CSV for your claim, and mark a month as claimed.
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
- **Actions** with quick dates and priorities. **✓** marks one done and records the outcome, with a "same again next week" option. **⏭** moves it to tomorrow, next Monday, next week and so on, or a date you pick, with an optional reason. It's moved in the CRM at the next sync.
- **Visits / meetings** by type (film trial, commission, service, machine demo, check-up).
  - Films and machines you saw are added to the equipment list.
  - A meeting already booked in the CRM can be logged as done.
- **Photos** are attached to the company in the CRM, with a note.
- **Quotes** and **orders** use your product catalogue and the price that customer last paid, with VAT and shipping totals. A quote can also add a "chase quote" action.
- **Sign-off sheets**: a PDF on the Kempner letterhead with the customer's finger signature. There are five kinds:
  - goods left on site
  - delivery note
  - film trial agreement
  - collection
  - work completed.
- **📅 Add to Calendar** on meetings and actions puts them in the iPhone Calendar with a reminder.

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

## Safety nets
- A banner warns when items have been on the phone too long without being sent, and when the CRM copy is a week old.
- Importing the same file twice is harmless, because already-imported items are skipped.
- The phone never edits or deletes CRM records. It only adds.
