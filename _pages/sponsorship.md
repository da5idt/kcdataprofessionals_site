---
layout: page
title: Support Kansas City Data Professionals
eyebrow: Sponsorship
lead: "KCDP is a practitioner-led, vendor-neutral community focused on real-world data leadership, engineering, analytics, and platform design. Sponsorship enables the community. It does not influence content."
cta_url: "#sponsorship-form"
cta_label: "Request sponsorship levels"
permalink: /sponsorship
classes:
  - sponsorship-page
---

## Current sponsors

<div class="sponsor-card">
  <a class="sponsor-card__logo" href="https://www.kcdigitaldrive.org" rel="noopener noreferrer" target="_blank">
    <img src="/assets/images/kcdd-logo-480.png" alt="KC Digital Drive" width="480" height="143">
  </a>
  <div>
    <h3>KC Digital Drive</h3>
    <p class="sponsor-card__type">Community Partner</p>
    <p>KC Digital Drive is a regional nonprofit founded in 2012 to improve quality of life across the Kansas City region through digital leadership. By brokering ideas and solutions through trusted relationships, KC Digital Drive strengthens the region’s tech innovation and digital inclusion ecosystems to expand opportunity and drive economic growth.</p>
  </div>
</div>

## What sponsorship supports

We welcome sponsorships that help us:

- Provide high-quality venues
- Offer food and refreshments
- Keep events accessible
- Grow the regional data ecosystem

## Our commitment to independence

KCDP is built on a simple foundation:

<ul class="principles">
  <li>We do not endorse products or services.</li>
  <li>Sponsors do not control topics or speakers.</li>
  <li>Events prioritize education, not marketing.</li>
  <li>No sales pitches from the stage.</li>
</ul>

We believe long-term trust is more valuable than short-term funding.

## Ways to support

<div class="support-options">
  <div class="support-option">
    <h3>Venue hosts</h3>
    <p>Provide space and hospitality for an event.</p>
  </div>
  <div class="support-option">
    <h3>Event sponsors</h3>
    <p>Support food, beverages, or event logistics.</p>
  </div>
  <div class="support-option">
    <h3>Community partners</h3>
    <p>Collaborate on strengthening the Kansas City data ecosystem.</p>
  </div>
</div>

{% include form-open.html name="sponsorship" title="Start a sponsorship conversation" %}
  <p class="form__intro">Tell us a little about your organization. We'll email you our sponsorship levels right away, with the KCDP organizers copied so we can follow up quickly.</p>
  <fieldset class="form__group">
    <legend>Contact</legend>
    <div class="form__row">
      <label class="field">
        <span class="field__label">Name <span class="field__req">required</span></span>
        <input type="text" name="name" autocomplete="name" required maxlength="120">
      </label>
      <label class="field">
        <span class="field__label">Work email <span class="field__req">required</span></span>
        <input type="email" name="email" autocomplete="email" required maxlength="200">
      </label>
    </div>
    <div class="form__row">
      <label class="field">
        <span class="field__label">Organization <span class="field__req">required</span></span>
        <input type="text" name="organization" autocomplete="organization" required maxlength="200">
      </label>
      <label class="field">
        <span class="field__label">Your role</span>
        <input type="text" name="role" autocomplete="organization-title" maxlength="200">
      </label>
    </div>
    <label class="field">
      <span class="field__label">Website</span>
      <input type="url" name="website" autocomplete="url" maxlength="300" placeholder="https://">
    </label>
  </fieldset>

  <fieldset class="form__group">
    <legend>Interested in</legend>
    <div class="choices">
      <label class="choice"><input type="checkbox" name="interest" value="Venue host"> Hosting an event</label>
      <label class="choice"><input type="checkbox" name="interest" value="Event sponsor"> Sponsoring food or logistics</label>
      <label class="choice"><input type="checkbox" name="interest" value="Community partner"> Community partnership</label>
      <label class="choice"><input type="checkbox" name="interest" value="Not sure yet"> Not sure yet</label>
    </div>
    <label class="field">
      <span class="field__label">Anything we should know?</span>
      <span class="field__hint">Timing, budget, audiences you want to support, or questions for us.</span>
      <textarea name="message" rows="4" maxlength="4000"></textarea>
    </label>
  </fieldset>
{% include form-close.html submit="Email me the sponsorship levels" %}
