# Editing Content

[Parent pages: Contributing](contributing.md) | [README](../README.md)

## Table of contents

- [Overview](#overview)
- [Add a new section to the homepage](#add-a-new-section-to-the-homepage)
- [Add a new page](#add-a-new-page)
- [Edit navigation](#edit-navigation)
- [Modify header (masthead)](#modify-header-masthead)
- [Modify footer](#modify-footer)
- [Update social links](#update-social-links)
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

## Edit navigation

Update `_data/navigation.yml` (`main:` list). For homepage sections, use anchors like `/#purpose`; for standalone pages, use their permalink paths.

## Modify header (masthead)

- Navigation source: `_data/navigation.yml`
- Header template: `_includes/masthead.html`
- Site-level masthead settings: `_config.yml` (`logo`, `masthead_title`, `subtitle`, `sticky-masthead`, `masthead-opacity`)

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
      icon: "fab fa-linkedin"
      url: "https://..."
```

These links are rendered by `_includes/footer.html`.

## Styling changes

- Theme imports/skin: `assets/css/main.scss`
- Site-specific overrides: `assets/css/custom-styles.css`

Prefer `assets/css/custom-styles.css` for local customization changes.

## Safe editing checklist

1. Keep content edits in `_pages/`, configuration edits in `_config.yml`, and component edits in `_includes/`/`_layouts/`.
2. Do not edit generated output in `_site/`.
3. Preview locally before opening a PR.
