# Local Setup Instructions

[Parent pages: Contributing](contributing.md) | [README](../README.md)

## Table of contents

- [Overview](#overview)
- [Requirements](#requirements)
- [Install dependencies](#install-dependencies)
- [Run local preview (Ruby + Bundler)](#run-local-preview-ruby--bundler)
- [Run local preview (Docker)](#run-local-preview-docker)
- [Test the forms locally](#test-the-forms-locally)

## Overview

Use this page to set up your machine and run the site locally before making changes.

## Requirements

Install the following:

- Git
- Ruby
- Bundler
- Docker Desktop (optional, for containerized preview)

## Install dependencies

From the repository root:

```bash
bundle install
```

## Run local preview (Ruby + Bundler)

```bash
bundle exec jekyll serve --livereload
```

Open `http://127.0.0.1:4000`.

If the build fails with ``undefined method `tainted?'``, Bundler resolved an older `github-pages` release whose Liquid version doesn't support Ruby 3.2 or later. Use Ruby 3.1 (for example with `rbenv` or `asdf`), or use the Docker option below.

## Run local preview (Docker)

This repo includes `docker-compose.yml` with a Jekyll service.

```bash
docker compose up
```

Open `http://127.0.0.1:4000`.

## Test the forms locally

The sponsorship (`/sponsorship`) and speaker (`/speak`) forms are switched off until `forms.endpoint` is set, so locally they show a notice and a disabled Send button. To try them for real:

1. Deploy the Apps Script web app as described in [forms.md](forms.md) and copy its `/exec` URL.
2. Create `_config.local.yml` in the repo root (it is git-ignored, so the URL stays out of commits):

   ```yaml
   forms:
     endpoint: "https://script.google.com/macros/s/YOUR-DEPLOYMENT-ID/exec"
     fallback_url: "https://www.linkedin.com/company/kcdataprofessionals"
   ```

3. Serve with both config files:

   ```bash
   bundle exec jekyll serve --livereload --config _config.yml,_config.local.yml
   ```

4. Submit each form with your own email address, then check the Google Sheet and your inbox.

To test the Apps Script logic without a Google account, run its offline tests (needs Node.js 18 or later):

```bash
node --test apps-script/code.test.js
```
