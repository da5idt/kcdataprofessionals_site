---
name: kcdp-next-event
description: Update the "Next Event" details on the Kansas City Data Professionals site (kcdataprofessionals.com) from a Luma and/or Meetup event link. Use whenever David provides new event links and wants the site updated, or asks whether the site's event is out of date. Trigger on "update the next event", "new event info for the site", "here are the Luma and Meetup links", "is the site's event stale", or any time KCDP event links appear alongside the website. Always use this skill for site event updates — the script does the editing, so do not hand-edit the event markup.
---

# Update the KCDP next event

A script does the work. Read the event pages, edit files, and verify by
running it — do not fetch the event pages or edit the markup yourself.

## Steps

1. Run the script from the repo root with whichever links David gave you:

   ```bash
   python3 scripts/update_next_event.py --luma <luma-url> --meetup <meetup-url>
   ```

   It reads the schema.org data both sites publish, writes
   `_data/next_event.yml`, and repoints the hero "Register for Next Event"
   button. Add `--dry-run` first if you want to preview.

2. Read the summary it prints and sanity-check it:
   - The **speaker** is a guess taken from the bio paragraph and is flagged
     `<- auto-detected`. If it looks wrong or is missing, re-run with
     `--speaker "Full Name"` (or `--speaker ""` to drop the line).
   - Any `! warning` line matters — a Luma/Meetup date mismatch means one
     listing was not updated, and is David's to resolve. Tell him.
   - Other values can be corrected with `--title`, `--date`, `--time`,
     `--venue`. Run `--help` for the full list.

3. Check the diff with `git diff`. Only `_data/next_event.yml` and the one
   hero `url:` line in `_pages/index.html` should change.

4. Commit on a branch, push, and open a **draft** PR. GitHub Pages publishes
   from `main`, so the site updates when the PR merges.

## Notes

- `python3 scripts/update_next_event.py --check` reports whether the event
  currently on the site has already happened. Exit code 1 means stale.
- `python3 scripts/test_update_next_event.py` runs offline tests for the
  date, venue, and rewrite logic. Run it if you change the script.
- The card renders from `_data/next_event.yml` via Liquid in
  `_pages/index.html`. An empty `speaker` or `luma_url` drops that line or
  button. Front matter cannot read site data, which is why the hero button
  is rewritten separately.
- If a page stops yielding data (private event, layout change), pass the
  details explicitly with the override flags rather than editing files.
