# Editing Guide

## Table of contents

- [Add a new section to the homepage](#add-a-new-section-to-the-homepage)
- [Add a new page](#add-a-new-page)
- [Modify header (masthead)](#modify-header-masthead)
- [Modify footer](#modify-footer)
- [Update social links](#update-social-links)
- [Styling changes](#styling-changes)
- [Safe editing checklist](#safe-editing-checklist)

## Add a new section to the homepage

1. Open `_pages/index.html`.
2. Add a new `<section ... id="your-section-id">...</section>` block where you want it to appear.
3. If the section should appear in the top navigation, add a matching entry in `_data/navigation.yml`:
   ```yaml
   - title: "Your Section"
     url: /#your-section-id
     blank: false
   ```
4. Run local preview and verify anchor scrolling and mobile nav behavior.

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
4. Add a link in `_data/navigation.yml` if it should be in the masthead.

## Modify header (masthead)

- Navigation entries: `_data/navigation.yml`
- Header template markup/behavior: `_includes/masthead.html`
- Site logo/title/subtitle/sticky settings: `_config.yml` (`logo`, `masthead_title`, `subtitle`, `sticky-masthead`, `masthead-opacity`)

If you are only changing labels/links, prefer `_data/navigation.yml` over editing `_includes/masthead.html`.

## Modify footer

- Footer component markup: `_includes/footer.html`
- Footer social links and labels/icons: `_config.yml` under `footer.links`
- Footer copyright text: `_config.yml` under `footer.copyright`

## Update social links

Edit `_config.yml`:

```yaml
footer:
  links:
    - label: "LinkedIn"
      icon: "fab fa-linkedin"
      url: "https://..."
```

The icons render through `_includes/footer.html`.

## Styling changes

- Theme imports and skin selection: `assets/css/main.scss`
- Site-specific style overrides: `assets/css/custom-styles.css`

Prefer adding customizations to `assets/css/custom-styles.css` for predictable upgrades.

## Safe editing checklist

1. Keep content edits in `_pages/` and configuration edits in `_config.yml`.
2. Do not edit `_site/` output directly.
3. Preview locally before opening a PR.
