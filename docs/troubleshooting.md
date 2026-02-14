# Troubleshooting

## Table of contents

- [Site does not reflect `_config.yml` changes](#site-does-not-reflect-_configyml-changes)
- [`bundle exec jekyll serve` fails](#bundle-exec-jekyll-serve-fails)
- [Docker preview not loading](#docker-preview-not-loading)
- [Navigation link does not scroll to section](#navigation-link-does-not-scroll-to-section)
- [Footer social icon/link not updating](#footer-social-iconlink-not-updating)
- [Styling update not visible](#styling-update-not-visible)
- [New page returns 404 locally](#new-page-returns-404-locally)

## Site does not reflect `_config.yml` changes

Symptom: You changed `_config.yml`, but local preview still shows old values.

Fix: Stop and restart Jekyll. Config changes are not fully hot-reloaded.

## `bundle exec jekyll serve` fails

1. Run `bundle install`.
2. Re-run `bundle exec jekyll serve --livereload`.
3. If dependency issues persist, check Ruby/Bundler versions and remove stale local gems as needed.

## Docker preview not loading

1. Confirm Docker is running.
2. Run `docker compose up` from repo root.
3. Verify port `4000` is free.
4. Open `http://127.0.0.1:4000`.

## Navigation link does not scroll to section

1. Check `_data/navigation.yml` entry points to the exact section id (for example `/#mission`).
2. Check `_pages/index.html` contains a matching section id (for example `id="mission"`).

## Footer social icon/link not updating

1. Update `footer.links` in `_config.yml`.
2. Ensure each item includes `label`, `icon`, and `url`.
3. Confirm `_includes/footer.html` is still rendering `site.footer.links`.

## Styling update not visible

1. Edit `assets/css/custom-styles.css` for site overrides.
2. Hard-refresh browser cache.
3. Verify `assets/css/custom-styles.css` is linked in `_includes/head.html`.

## New page returns 404 locally

1. Confirm file exists in `_pages/`.
2. Confirm front matter has `layout: page` and a valid `permalink`.
3. Restart local server if you changed config defaults.
