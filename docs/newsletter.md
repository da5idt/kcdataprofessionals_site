# Newsletter (Data Profession Weekly)

[Parent page: README](../README.md)

Each weekly issue is one file in `_newsletter/`, named by its Monday date (`_newsletter/2026-10-26.md`). It is published at `/newsletter/2026-10-26/`, and `/newsletter/` lists every issue with the newest first. The issue is pure front matter: the layout (`_layouts/newsletter.html`) renders it, so a new issue needs no HTML.

Issues are drafted by a scheduled Claude task each Monday, which opens a pull request. The issue goes live when the PR is merged.

## Reader form

Each issue sits behind a short form asking for name, email, company and title. It posts to the forms endpoint in `_config.yml` (see [forms.md](forms.md)), which saves a row to the `Newsletter readers` tab. A checkbox (ticked by default) asks whether they want meetup invitations; the `Meetup invites` column records Yes or No, so only email the Yes rows. Once a reader fills it in, their browser remembers them and every issue opens. This is a soft gate: GitHub Pages is static, so the issue is still in the page source and visitors without JavaScript see it directly. If the endpoint fails or takes more than 5 seconds, the issue opens anyway so readers are never locked out; only a blank field or an invalid email sends them back to fix it. Story links that aren't http or https are shown as plain text.

After changing `apps-script/Code.gs`, redeploy the web app (Deploy > Manage deployments > edit > New version) so the live endpoint accepts the `newsletter` form.

## File format

```yaml
---
title: "Iceberg v4 takes shape and Fabric opens up"   # headline for the issue
date: 2026-10-26                                      # issue date
intro: "Two sentences on the theme of the week."
top_stories:                                          # exactly 3
  - title: "Story headline"
    url: "https://example.com/specific-article"
    source: "Databricks blog"
    published: "Oct 22, 2026"
    summary: "2 to 3 plain-language sentences."
    why: "One sentence on what it changes for people doing the work."
sections:                                             # all sections, in order
  - name: "Data Engineering"
    items:                                            # 0 to 4 items
      - title: "..."
        url: "..."
        source: "..."
        published: "..."
        summary: "..."
  - name: "Streaming and Real-Time"
    items: []                                         # empty shows "Quiet week here."
talking_points:                                       # 1 or 2 meetup discussion prompts
  - "..."
---
```

All text is plain text (it is HTML-escaped when rendered), so do not put Markdown or HTML in the values. Quote any value that contains a colon.
