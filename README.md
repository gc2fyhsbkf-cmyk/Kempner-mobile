# Kempner Mobile — set-up & daily use

An offline phone app for your Kempner CRM. It's free: no App Store, no hosting bill, no subscription.

- **What's hosted online:** only the app's code (these files). That's a blank shell with no customer data in it.
- **Where your data lives:** only on your phone, and it only moves when you send a file yourself.

---

## 1. One-time: put the app online (free, about 10 minutes)

You can use GitHub Pages, which is free. Any free static host works the same way, for example Netlify Drop or Cloudflare Pages.

1. Make a free account at **github.com**.
2. Click **+** (top right) and choose **New repository**.
   - Name it `kempner-mobile`.
   - Set it to **Public**. Free Pages needs public, but these files contain no customer data.
   - Click **Create repository**.
3. On the new repo page, click **uploading an existing file**.
   - Drag in **everything from this folder**: `index.html`, `sw.js`, `manifest.webmanifest`, and the `icons` folder.
   - Click **Commit changes**.
4. Go to **Settings → Pages**.
   - Under "Branch", pick **main** and **/(root)**, then click **Save**.
   - After a minute the page shows your address, e.g. `https://yourname.github.io/kempner-mobile/`.

## 2. One-time: install it on the iPhone

1. Open that address in **Safari**. It must be Safari, not Chrome, for Home Screen install on iPhone.
2. Tap the **Share** button, then **Add to Home Screen**, then **Add**.
3. From now on, always open it from the **Home Screen icon**. It works with no signal.

> Data saved inside the Home Screen app is kept separately from Safari. Always use the icon, and iOS won't clear it.

## 3. One-time: the CRM side

Replace your CRM `.py` with the updated one, keeping a copy of the old file just in case.

There's a new **📱 Phone sync** button on the Today page, next to "📲 Import visits". You can also set a **sync folder** there, such as your Google Drive folder or Downloads. Changes files you drop into it are then listed automatically.

---

## Daily use

**On the road (no signal needed)**

- Search by company, person, phone number or postcode.
- Open a company to see everything:
  - actions, notes, meetings and people
  - equipment, film specs, quotes, orders and call-offs
- Tap **Call / Text / Email / Map** to contact them or get directions.
- Add things with **Note · Action · Visit · Contact**, tick actions **Done**, or add a **new company** with **+**.
- New items show a yellow **not synced** tag until they're in the CRM.

**Back at the office: the round trip**

1. **Phone → CRM**
   - On the phone, tap **Sync → Export changes**.
   - Send the file however is easiest: email it to yourself, AirDrop, Google Drive, or Save to Files.
   - In the CRM, go to **📱 Phone sync → Choose changes file**.
   - Review the list (untick anything you don't want), then click **Import ticked items**.
2. **CRM → Phone**
   - The CRM then offers to **export a fresh snapshot**.
   - Get that file onto the phone, then tap **Sync → Load snapshot from CRM**.
   - The phone's "waiting to sync" list clears itself.

You don't have to do both every day. Sync whenever it suits you.

**Safety nets**

- **Importing the same changes file twice is harmless.** Anything already imported is skipped.
- **Loading a snapshot never loses unsynced phone items.** Only items the CRM has confirmed are cleared.
- **Nothing on the phone edits or deletes CRM records.** It's add-only, as agreed: notes, actions, ticks, meetings, contacts and companies.
  - A new contact with an existing name only *adds* new numbers or emails.
  - A new company whose name matches an existing one gets merged into it, so you don't end up with a duplicate.
- **Booked meetings.** "Log as done" on a booked meeting ticks that meeting off in the CRM rather than creating a second one.
- **Mistakes.** Delete an unsynced item from the **Sync** screen with the ✕ button.

## Updating the app later

1. Upload the changed files to the GitHub repo.
2. In `sw.js`, bump `kempner-mobile-v1` to `-v2`.
3. Open the app twice. The first open fetches the update, and the second uses it.

## Quotes, orders and signed sheets (added)

- **💷 Quote** and **🛒 Order** on a company page work like the CRM's editors: pick products from your catalogue (or type a new one), set qty and price, and the VAT and shipping totals update as you go. They go into the CRM's Commercial tab when you sync.
- **✍️ Sign-off** makes a Kempner-letterhead PDF covering the items, price and payment wording, with the customer's finger signature, name and the date.
  - Afterwards, tap **Email / share the PDF** to send them a copy.
  - When you sync, the PDF is attached to the company in the CRM and a note is added.
  - It can also log the order and add a "raise invoice" action for today.
