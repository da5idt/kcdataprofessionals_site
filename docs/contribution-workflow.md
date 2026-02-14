# Contribution Workflow

[Parent pages: Contributing](contributing.md) | [README](../README.md)

## Table of contents

- [Overview](#overview)
- [Create a branch from `main`](#create-a-branch-from-main)
- [Make and preview changes locally](#make-and-preview-changes-locally)
- [Commit and push changes](#commit-and-push-changes)
- [Open a pull request to `main`](#open-a-pull-request-to-main)
- [Important fork/upstream warnings](#important-forkupstream-warnings)

## Overview

This page covers the expected Git workflow for this repository: branch from `main`, make local changes, preview locally, then open a PR to merge back into `main`.

## Create a branch from `main`

1. Switch to `main`.
2. Pull latest changes from `origin/main`.
3. Create your feature branch from `main`.

Example:

```bash
git checkout main
git pull origin main
git checkout -b your-feature-branch
```

## Make and preview changes locally

1. Edit files in your branch.
2. Run local preview:
   - `bundle exec jekyll serve --livereload`, or
   - `docker compose up`
3. Confirm content, links, and layout look correct before committing.

## Commit and push changes

1. Review your changes.
2. Commit with a clear message.
3. Push your branch to `origin`.

Example:

```bash
git add .
git commit -m "Update documentation for contributors"
git push -u origin your-feature-branch
```

## Open a pull request to `main`

1. Open a PR from your branch into `da5idt/kcdataprofessionals_site` `main`.
2. Include a short summary of what changed and why.
3. Address review feedback, then merge once approved.

## Important fork/upstream warnings

- This repository was originally forked from `https://github.com/perstarke-webdev/oneflow-jekyll-theme`.
- Do not open PRs to `perstarke-webdev/oneflow-jekyll-theme`.
- Do not add/use an `upstream` remote to that repository for routine contributions.
- Do not fetch, pull, merge, or rebase from `https://github.com/perstarke-webdev/oneflow-jekyll-theme` unless a maintainer explicitly requests that sync.
- Always push branches to `origin` (`https://github.com/da5idt/kcdataprofessionals_site.git`) and target PRs to this repository's `main`.
