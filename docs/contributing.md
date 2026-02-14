# Contributing

## Table of contents

- [Local setup requirements](#local-setup-requirements)
- [Local setup steps](#local-setup-steps)
- [Editing guides by task](#editing-guides-by-task)
- [Branch and PR workflow](#branch-and-pr-workflow)
- [Important fork/upstream warnings](#important-forkupstream-warnings)
- [Preview expectations](#preview-expectations)
- [Conventions used in this repo](#conventions-used-in-this-repo)
- [Suggested PR checklist](#suggested-pr-checklist)

## Local setup requirements

Install these tools on your machine before contributing:

- Git (clone, branch, push, PR workflow)
- Ruby and Bundler (for native Jekyll workflow used by this repo's `Gemfile`)
- Docker Desktop (optional, for containerized preview using `docker-compose.yml`)

Optional but useful:

- Node.js + npm (only needed if you need to rebuild minified JS via `package.json` scripts)

## Local setup steps

1. Clone this repository.
2. Install Ruby gems:
   ```bash
   bundle install
   ```
3. Start a local preview using one of:
   - Ruby/Bundler:
     ```bash
     bundle exec jekyll serve --livereload
     ```
   - Docker:
     ```bash
     docker compose up
     ```
4. Open `http://127.0.0.1:4000`.

## Editing guides by task

Use these docs for specific contribution tasks:

- Site architecture and file responsibilities:
  - `docs/architecture.md`
- Add/edit homepage sections:
  - `docs/editing-guide.md#add-a-new-section-to-the-homepage`
- Add a new page:
  - `docs/editing-guide.md#add-a-new-page`
- Edit navigation:
  - `docs/editing-guide.md#modify-header-masthead`
  - `docs/editing-guide.md#add-a-new-section-to-the-homepage`
- Edit header:
  - `docs/editing-guide.md#modify-header-masthead`
- Edit footer:
  - `docs/editing-guide.md#modify-footer`
- Add/update social links:
  - `docs/editing-guide.md#update-social-links`
- Styling and visual changes:
  - `docs/editing-guide.md#styling-changes`
- Common contributor issues:
  - `docs/troubleshooting.md`
- Repo front-door overview and quick map:
  - `README.md`

## Branch and PR workflow

1. Sync your local `main` with this repository's `origin/main`.
2. Create a feature branch from `main`.
3. Make focused changes.
4. Preview locally (`bundle exec jekyll serve --livereload` or `docker compose up`).
5. Commit with clear messages.
6. Push your branch to this repository.
7. Open a PR targeting this repository's `main` branch.

## Important fork/upstream warnings

- This repo's configured remote is `origin` -> `https://github.com/da5idt/kcdataprofessionals_site.git`.
- Do not open PRs against the theme's upstream repository.
- This repository was originally forked from `https://github.com/perstarke-webdev/oneflow-jekyll-theme`.
- Do not add or use an `upstream` remote that points to `https://github.com/perstarke-webdev/oneflow-jekyll-theme` for normal contribution work.
- Do not fetch, pull, merge, or rebase from `https://github.com/perstarke-webdev/oneflow-jekyll-theme` unless a maintainer explicitly asks for that sync.
- Before pushing, verify your remote/branch targets are this repo (`da5idt/kcdataprofessionals_site`) to avoid accidentally syncing theme-upstream changes.
- Keep your PR target as `da5idt/kcdataprofessionals_site`.

## Preview expectations

- Local preview is required before PR review.
- As of this documentation update, `.github/workflows/` contains maintenance/reporting workflows and does not contain a dedicated pull request preview/deploy workflow for site previews.
- If online preview is needed, coordinate with maintainers before changing deployment workflows.

## Conventions used in this repo

- Keep changes minimal and scoped.
- Prefer Markdown for documentation and page content where possible.
- Use `_pages/` for page content and `_includes/` for reusable fragments.
- Update `_data/navigation.yml` for navigation changes instead of hardcoding links in templates.
- Keep header/footer component changes in `_includes/masthead.html` and `_includes/footer.html`.
- Keep social links in `_config.yml` under `footer.links`.
- Do not edit generated `_site/` output.

## Suggested PR checklist

1. Confirm links and anchors work locally.
2. Confirm no unintended layout/style regressions.
3. Include a short PR description with changed files and user-facing impact.
4. If changing `_config.yml`, restart local server and re-test.
