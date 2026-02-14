# Local Setup Instructions

[Parent pages: Contributing](contributing.md) | [README](../README.md)

## Table of contents

- [Overview](#overview)
- [Requirements](#requirements)
- [Install dependencies](#install-dependencies)
- [Run local preview (Ruby + Bundler)](#run-local-preview-ruby--bundler)
- [Run local preview (Docker)](#run-local-preview-docker)
- [Optional: JavaScript tooling](#optional-javascript-tooling)

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

## Run local preview (Docker)

This repo includes `docker-compose.yml` with a Jekyll service.

```bash
docker compose up
```

Open `http://127.0.0.1:4000`.

## Optional: JavaScript tooling

Node.js and npm are only needed if you need to rebuild minified JavaScript from `package.json` scripts.
