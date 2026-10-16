# Kempner Mobile

An offline phone companion to the Kempner CRM. It's free: no App Store and no hosting bill. Your data stays on your phone and only moves when you send a file.

## Files (all at the top level on GitHub, no folders)
`index.html`, `core.js`, `views.js`, `forms.js`, `pdf.js`, `sw.js`, `manifest.webmanifest`, `jspdf.umd.min.js`, `icon-192.png`, `icon-512.png`, `apple-touch-icon.png`, `README.md`

To update: on GitHub, **Add file → Upload files**, drag in all the files and **Commit**. Then open the app twice with signal.

## The tabs
- **Today**: overdue and due actions (tick ✓ to complete), meetings for the next 7 days with directions, plus the CRM's film reorders to chase and accounts that need a nudge.
- **Companies**: search by name, person, phone number, postcode or tag. Filter by Mine/Everyone and status, and sort by A–Z, most overdue, health score or recently updated.
- **Company page**: Call / Text / Email / Directions, a big **＋ Add** button, and tabs for Overview · Notes · Actions · Meetings · People · Commercial · Equipment · Files.
- **Nearby**: your customers sorted by distance from where you are. Needs signal the first time only, to look up postcodes.
- **Prices**: what each product last sold for, and to whom, plus the CRM's calculators (GP, VAT, price per m², thickness).
- **Sync**: send changes to the CRM and load the latest snapshot.

## Adding things (all go into the CRM when you sync)
- **Notes** using the CRM's own templates, with an optional status change (Urgent / Warm / OK / Cold).
- **Call logging**:
  - after you call from the app, it asks how it went
  - uses the same "Asked / noted" questions as Live Call
  - you can add a follow-up action.
- **Actions** with quick dates and priorities. **Mark done** records the outcome, with a "same again next week" option.
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

## Safety nets
- A banner warns when items have been on the phone too long without being sent, and when the CRM copy is a week old.
- Importing the same file twice is harmless, because already-imported items are skipped.
- The phone never edits or deletes CRM records. It only adds.
