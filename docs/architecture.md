# Architecture

[Parent page: README](../README.md)

## Table of contents

- [Overview](#overview)
- [Platform references](#platform-references)
- [Directory map](#directory-map)
- [How rendering is wired](#how-rendering-is-wired)
- [Key file roles requested](#key-file-roles-requested)
- [Automation workflows](#automation-workflows)
- [Notes for contributors](#notes-for-contributors)

## Overview

This is a Jekyll site that renders pages from source files and templates into `_site/` for serving/deployment. The core content and structure in this repository are centered around `_pages/`, `_layouts/`, `_includes/`, `_data/`, and `_config.yml`.

## Platform references

- GitHub Pages documentation: [https://docs.github.com/en/pages](https://docs.github.com/en/pages)
- Jekyll documentation: [https://jekyllrb.com/docs/](https://jekyllrb.com/docs/)
- Original OneFlow theme repository: [https://github.com/perstarke-webdev/oneflow-jekyll-theme](https://github.com/perstarke-webdev/oneflow-jekyll-theme)

## Directory map

- `_config.yml`: global site configuration (site identity, URL, logo, background, footer links, plugins, defaults)
- `_pages/`: page source files with front matter and content (for this repo, includes `index.html`, `imprint.md`, and `sponsorship.md`)
- `_layouts/`: page templates (`default.html` and `page.html`)
- `_includes/`: reusable components included by layouts (for example `masthead.html`, `footer.html`, `head.html`, `page__hero.html`)
- `_data/navigation.yml`: main navigation items rendered in the masthead
- `assets/css/main.scss`: theme and skin imports
- `assets/css/custom-styles.css`: custom visual overrides for this site

## How rendering is wired

1. `_layouts/default.html` is the outer shell and includes:
   - `_includes/head.html`
   - `_includes/masthead.html`
   - page content (`{{ content }}`)
   - `_includes/footer/custom.html` and `_includes/footer.html`
2. `_layouts/page.html` uses `layout: default` and optionally injects `_includes/page__hero.html` when page header front matter exists.
3. `_pages/index.html` uses `layout: page` and provides the homepage sections.
4. `_includes/masthead.html` reads links from `_data/navigation.yml`.
5. `_includes/footer.html` reads social/footer links from `_config.yml` at `footer.links`.

## Key file roles requested

### `_config.yml`

`_config.yml` is the source of site-wide settings, including:
- title/tagline/url/repository metadata
- masthead options (`logo`, `masthead_title`, `sticky-masthead`, opacity)
- background image settings
- footer link definitions (`footer.links`)
- plugin and build settings
- defaults for files in `_pages/`

Important: changes to `_config.yml` usually require restarting `jekyll serve` because config is not hot-reloaded.

### `_pages`

`_pages/` contains routable content files. In this repo:
- `_pages/index.html` is the homepage (`permalink: /`) and contains section markup (`id="purpose"`, `id="mission"`, etc.)
- `_pages/imprint.md` is a standalone page
- `_pages/sponsorship.md` is the sponsorship page (`permalink: /sponsorship`)

Routes are controlled by front matter values like `permalink`.

### `_layouts`

`_layouts/` provides template wrappers:
- `_layouts/default.html` handles shared page chrome and includes head/masthead/footer
- `_layouts/page.html` is the content-page layout used by `_pages/*`

### `_includes`

`_includes/` contains reusable components used by layouts/pages. In this repo, key files include:
- `_includes/masthead.html` (top navigation/header)
- `_includes/footer.html` (footer branding and social icons)
- `_includes/head.html` + `_includes/head/custom.html` (head assets/meta)
- `_includes/page__hero.html` (hero block driven by page front matter)

## Automation workflows

The repository includes automated maintenance workflows in `.github/workflows/`:

- `daily-doc-updater.md` reviews recent changes and updates documentation.
- `daily-repo-status.md` generates a daily repository status report.

Do not edit the corresponding `.lock.yml` files directly. Update the `.md` sources and regenerate the locked workflow if needed.

## Notes for contributors

- Do not edit generated output in `_site/`; edit source files and rebuild.
- Keep content changes in `_pages/` and component changes in `_includes/` or `_layouts/`.
