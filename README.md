# kcdataprofessionals_site

This repository contains the Kansas City Data Professionals public website at [kcdataprofessionals.org](https://kcdataprofessionals.org), built with Jekyll (originally based on the OneFlow theme structure). Site settings and shared metadata are defined in `_config.yml`, page content is stored in `_pages/`, reusable UI building blocks are in `_includes/`, layout templates live in `_layouts/`, and all styling is in `assets/css/main.scss`.

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
- Sponsorship page content: `_pages/sponsorship.md`
- Sponsorship logos/assets: `assets/images/`
- Navigation links in masthead: `_data/navigation.yml`
- Header (masthead) markup/behavior: `_includes/masthead.html`
- Footer markup: `_includes/footer.html`
- Social links shown in footer: `_config.yml` under `footer.links`
- Site-wide settings (title, URL, logo, footer metadata): `_config.yml`
- Layout wrappers: `_layouts/default.html`, `_layouts/page.html`
- Next event card and hero: `_data/next_event.yml` (update it with `scripts/update_next_event.py`) and `_includes/page__hero.html`
- Styling: `assets/css/main.scss` (colours and fonts are CSS variables at the top)

## Contributor docs

- [Contributing hub](docs/contributing.md)
- [Local Setup Instructions](docs/local-setup-instructions.md)
- [Editing Content](docs/editing-content.md)
- [Contribution Workflow](docs/contribution-workflow.md)
- [Architecture](docs/architecture.md)
- [Troubleshooting](docs/troubleshooting.md)
