# kcdataprofessionals_site

This repository contains the Kansas City Data Professionals public website at [kcdataprofessionals.org](https://kcdataprofessionals.org), built with Jekyll and based on the OneFlow theme structure. Site settings and shared metadata are defined in `_config.yml`, page content is stored in `_pages/`, reusable UI building blocks are in `_includes/`, and theme/layout templates live in `_layouts/` and `_sass/`.

## Table of contents

- [Quick start](#quick-start)
- [Option A: Local Ruby + Bundler](#option-a-local-ruby--bundler)
- [Option B: Docker](#option-b-docker)
- [Where do I change X?](#where-do-i-change-x)
- [Contributor docs](#contributor-docs)

## Quick start

### Option A: Local Ruby + Bundler
1. Install Ruby and Bundler.
2. Install dependencies:
   ```bash
   bundle install
   ```
3. Run the site locally:
   ```bash
   bundle exec jekyll serve --livereload
   ```
4. Open `http://127.0.0.1:4000`.

### Option B: Docker
This repo includes `docker-compose.yml` with a `bretfisher/jekyll-serve` service.

1. Run:
   ```bash
   docker compose up
   ```
2. Open `http://127.0.0.1:4000`.

## Where do I change X?

- Homepage sections/content: `_pages/index.html`
- Add or edit pages: `_pages/*.md` or `_pages/*.html`
- Navigation links in masthead: `_data/navigation.yml`
- Header (masthead) markup/behavior: `_includes/masthead.html`
- Footer markup: `_includes/footer.html`
- Social links shown in footer: `_config.yml` under `footer.links`
- Site-wide settings (title, URL, logo, background, footer metadata): `_config.yml`
- Layout wrappers: `_layouts/default.html`, `_layouts/page.html`
- Styling:
  - Theme imports/skin: `assets/css/main.scss`
  - Site-specific overrides: `assets/css/custom-styles.css`

## Contributor docs

- Architecture: `docs/architecture.md`
- Editing guide: `docs/editing-guide.md`
- Contributing workflow: `docs/contributing.md`
- Troubleshooting: `docs/troubleshooting.md`
