# Editing Content

[Parent pages: Contributing](contributing.md) | [README](../README.md)

## Table of contents

- [Overview](#overview)
- [Add a new section to the homepage](#add-a-new-section-to-the-homepage)
- [Add a new page](#add-a-new-page)
- [Update the sponsorship page](#update-the-sponsorship-page)
- [Edit navigation](#edit-navigation)
- [Modify header (masthead)](#modify-header-masthead)
- [Modify footer](#modify-footer)
- [Update social links](#update-social-links)
- [Update the Slack invite link](#update-the-slack-invite-link)
- [Styling changes](#styling-changes)
- [Safe editing checklist](#safe-editing-checklist)

## Overview

Use this page for content and structure changes in the site source files.

## Add a new section to the homepage

1. Open `_pages/index.html`.
2. Add a new `<section ... id="your-section-id">...</section>` block where you want it to appear.
3. If the section should appear in top navigation, add a matching entry in `_data/navigation.yml` with `url: /#your-section-id`.
4. Preview locally and verify anchor scrolling.

## Add a new page

1. Create a file in `_pages/` (for example `_pages/about.md`).
2. Add front matter:
   ```yaml
   ---
   title: "About"
   layout: page
   permalink: /about/
   ---
   ```
3. Add page content below front matter.
4. Add a link in `_data/navigation.yml` if the page should appear in the masthead.

## Update the sponsorship page

1. Edit content in `_pages/sponsorship.md` (copy, headings, sponsor cards).
2. Add or update sponsor logos in `assets/images/`, then reference them with `<img src="/assets/images/...">`.
3. If you need the link in the top navigation, add or update the entry in `_data/navigation.yml`.
4. Adjust sponsor layout styles in `assets/css/main.scss` (`.sponsor-card`, `.principles`, `.support-options`, `.callout`).

## Edit navigation

Update `_data/navigation.yml` (`main:` list). For homepage sections, use anchors like `/#about`; for standalone pages, use their permalink paths. Set `button: true` on one entry to show it as the header's call-to-action button.

## Modify header (masthead)

- Navigation source: `_data/navigation.yml`
- Header template: `_includes/masthead.html`
- Logo: `_config.yml` (`logo`)

## Modify footer

- Footer markup: `_includes/footer.html`
- Footer links metadata: `_config.yml` under `footer.links`
- Footer copyright: `_config.yml` under `footer.copyright`

## Update social links

Edit `_config.yml`:

```yaml
footer:
  links:
    - label: "LinkedIn"
      icon: "linkedin"
      url: "https://..."
```

These links are rendered by `_includes/footer.html`. `icon` names an icon in `_includes/icon.html`; add a new `when` branch there for a new network.

## Update the Slack invite link

Slack invite links expire. When the current one does, create a new one in Slack (**Invite people > Copy invite link**) and paste it into `_config.yml`:

```yaml
slack:
  invite_url: "https://join.slack.com/t/kcdataprofessionals/shared_invite/..."
```

The homepage "Join on Slack" button and the `/slack` redirect (`_pages/slack.html`) both read this value. Share `kcdataprofessionals.org/slack` on slides, QR codes and posts instead of the raw invite link, so they keep working after the link is replaced.

## Styling changes

All styles live in `assets/css/main.scss`. Colours, fonts, spacing and radii are CSS variables in its `:root` block (for example `--navy-700`, the logo colour, and `--signal`, the accent used for the "live" dot and focus rings), so most visual changes are a one-line edit there.

## Safe editing checklist

1. Keep content edits in `_pages/`, configuration edits in `_config.yml`, and component edits in `_includes/`/`_layouts/`.
2. Do not edit generated output in `_site/`.
3. Preview locally before opening a PR.
