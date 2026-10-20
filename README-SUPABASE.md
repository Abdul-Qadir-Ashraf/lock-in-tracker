# Lock-In Tracker — Supabase sync

## What changed
- Keeps the existing GitHub Pages static site.
- Uses Supabase Auth for the two profiles instead of the insecure local `123` password check.
- Saves daily entries, books, and monthly goals to Supabase under the signed-in account.
- Each account can read both profiles so the comparison dashboard works.
- Existing local browser entries are merged into the cloud on that profile's first login; the app does not clear local storage.
- Export data now includes daily entries, books, and goals.

## Before deploying
1. In Supabase Auth, ensure these users exist and their emails are exactly `vishwajeet@roll.com` and `qadirashrafabdul@gmail.com`.
2. Set a strong password for each account. The old browser-only password `123` is no longer used.
3. In Supabase SQL Editor, run `SUPABASE_SETUP.sql`. If you already created policies with the same names, remove those policies or rename these policies before running.
4. In Supabase Auth URL Configuration, set Site URL to your GitHub Pages site and add that site URL to Redirect URLs if needed.
5. Push the `site` folder and `.github` workflow to the repository's `main` branch. GitHub Actions will redeploy Pages.

## First migration on each device
1. Before deploying, open the existing tracker on each device and use **Export data** to save a backup JSON file. The updated export contains daily entries, books, and goals.
2. Deploy the new version.
3. Open the GitHub Pages URL, select the matching profile, and log in with that profile's Supabase email/password.
4. The app merges local entries with cloud entries and uploads the selected profile's data. Do this on the phone and computer for each profile that has local records on that device.
5. Confirm entries from the phone appear on the computer before deleting any browser data. Do not clear site data during migration.

## Important limitations
- This first integration uses profile-level snapshots. Avoid editing the same date/profile on two devices simultaneously during initial migration; sign in again to refresh after another device saves.
- Supabase RLS permits access only to the two allowlisted email addresses. Do not expose a secret/service-role key in this static frontend.
- If a local and cloud record have the same field/date, the local value is retained during initial merge so migration does not silently discard local values. Review overlapping dates after first sync.
