/**
 * Kansas City Data Professionals: website form handler.
 *
 * Receives the sponsorship and speaker forms from kcdataprofessionals.org,
 * saves each submission as a row in this spreadsheet, and emails the person
 * who submitted it with the organizers copied. Sponsorship emails attach the
 * sponsorship levels document from Google Drive.
 *
 * Setup and deployment: docs/forms.md in the website repository.
 *
 * Script properties (Project Settings > Script properties):
 *   TEAM_EMAILS     required  Comma-separated organizer addresses to CC.
 *   SPONSOR_DOC_ID  optional  Drive file ID of the sponsorship levels
 *                             document (a Google Doc or a PDF). Attached
 *                             to sponsorship emails as a PDF.
 *   SITE_URL        optional  Defaults to https://kcdataprofessionals.org
 *   DAILY_LIMIT     optional  Most submissions accepted per day across both
 *                             forms. Defaults to 20. Each email counts once
 *                             per recipient (submitter plus every CC)
 *                             against Gmail's daily sending quota.
 */

var FORMS = {
  sponsorship: {
    sheet: "Sponsorship",
    fields: [
      { name: "name", label: "Name", required: true, max: 120 },
      { name: "email", label: "Email", required: true, max: 200, type: "email" },
      { name: "organization", label: "Organization", required: true, max: 200 },
      { name: "role", label: "Role", max: 200 },
      { name: "website", label: "Website", max: 300, type: "url" },
      { name: "interest", label: "Interested in", max: 300, multiple: true },
      { name: "message", label: "Message", max: 4000 }
    ]
  },
  speaker: {
    sheet: "Speakers",
    fields: [
      { name: "name", label: "Name", required: true, max: 120 },
      { name: "email", label: "Email", required: true, max: 200, type: "email" },
      { name: "role", label: "Role and organization", max: 200 },
      { name: "profile_url", label: "LinkedIn or website", max: 300, type: "url" },
      { name: "talk_title", label: "Talk title", required: true, max: 200 },
      { name: "abstract", label: "Abstract", required: true, max: 4000 },
      { name: "format", label: "Format", max: 100 },
      { name: "level", label: "Audience level", max: 100 },
      { name: "availability", label: "Availability", max: 300 },
      { name: "experience", label: "Speaking experience", max: 2000 },
      { name: "notes", label: "Notes", max: 2000 }
    ]
  }
};

var SENDER_NAME = "Kansas City Data Professionals";
var MIN_FILL_MS = 2500;            // faster than this is a bot
var REPEAT_WINDOW_SECONDS = 600;   // one submission per address per 10 minutes

function doGet() {
  return ContentService.createTextOutput("KCDP forms endpoint is running.");
}

function doPost(e) {
  var params = (e && e.parameter) || {};
  var viaJs = params._js === "1";
  try {
    var result = handleSubmission_(params, (e && e.parameters) || {});
    return respond_(viaJs, result);
  } catch (err) {
    console.error(err && err.stack ? err.stack : err);
    return respond_(viaJs, { ok: false });
  }
}

/** Validates, stores and emails one submission. Returns {ok, error?}. */
function handleSubmission_(params, multiParams) {
  var form = FORMS[params.form];
  if (!form) return { ok: false, error: "Unknown form." };

  // Spam: a filled honeypot or an instant submit gets a fake success, so
  // bots learn nothing. Only JS submissions report how long the page was open.
  if (params._company_url) return { ok: true };
  if (params._js === "1") {
    var elapsed = Number(params._elapsed);
    if (!(elapsed >= MIN_FILL_MS)) return { ok: true };
  }

  var values = readValues_(form, params, multiParams);
  var problem = validate_(form, values);
  if (problem) return { ok: false, error: problem };

  var config = config_();
  var email = values.email.toLowerCase();

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  var row;
  try {
    var cache = CacheService.getScriptCache();
    if (cache.get("recent:" + params.form + ":" + email)) {
      return { ok: false, error: "We already have a recent submission from this address, so check your inbox for our reply." };
    }
    if (!takeDailySlot_(config.dailyLimit)) {
      return { ok: false, error: "We've had a lot of submissions today. Please try again tomorrow." };
    }
    row = appendRow_(form, values);
    cache.put("recent:" + params.form + ":" + email, "1", REPEAT_WINDOW_SECONDS);
  } finally {
    lock.releaseLock();
  }

  try {
    sendEmail_(params.form, form, values, config);
    row.sheet.getRange(row.index, 2).setValue("New");
  } catch (err) {
    // The submission is saved either way; flag it so the team follows up.
    console.error(err && err.stack ? err.stack : err);
    row.sheet.getRange(row.index, 2).setValue("New: email failed, follow up by hand");
  }
  return { ok: true };
}

function readValues_(form, params, multiParams) {
  var values = {};
  form.fields.forEach(function (field) {
    var raw = field.multiple ? (multiParams[field.name] || []).join(", ") : params[field.name];
    values[field.name] = clean_(raw, field.max);
  });
  return values;
}

/** Trims, drops control characters (keeping newlines and tabs) and caps length. */
function clean_(value, max) {
  var text = String(value == null ? "" : value)
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim();
  return text.length > max ? text.slice(0, max) : text;
}

function validate_(form, values) {
  for (var i = 0; i < form.fields.length; i++) {
    var field = form.fields[i];
    var value = values[field.name];
    if (field.required && !value) return field.label + " is required.";
    if (!value) continue;
    if (field.type === "email" && !/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(value)) {
      return "Please enter a valid email address.";
    }
    if (field.type === "url" && !/^https?:\/\/\S+$/i.test(value)) {
      return field.label + " should start with http:// or https://.";
    }
  }
  return null;
}

function config_() {
  var props = PropertiesService.getScriptProperties();
  var team = String(props.getProperty("TEAM_EMAILS") || "")
    .split(",")
    .map(function (address) { return address.trim(); })
    .filter(Boolean);
  if (!team.length) throw new Error("Script property TEAM_EMAILS is not set.");
  return {
    team: team,
    sponsorDocId: props.getProperty("SPONSOR_DOC_ID") || "",
    siteUrl: props.getProperty("SITE_URL") || "https://kcdataprofessionals.org",
    dailyLimit: Number(props.getProperty("DAILY_LIMIT")) || 20
  };
}

/** Counts today's submissions; false once the limit is reached. Call under the lock. */
function takeDailySlot_(limit) {
  var props = PropertiesService.getScriptProperties();
  var key = "count:" + Utilities.formatDate(new Date(), "America/Chicago", "yyyy-MM-dd");
  var count = Number(props.getProperty(key)) || 0;
  if (count >= limit) return false;
  props.setProperty(key, String(count + 1));
  return true;
}

/** Appends a row, creating the tab and its header the first time. */
function appendRow_(form, values) {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = spreadsheet.getSheetByName(form.sheet) || spreadsheet.insertSheet(form.sheet);
  if (sheet.getLastRow() === 0) {
    var header = ["Submitted", "Status"]
      .concat(form.fields.map(function (field) { return field.label; }))
      .concat(["Team notes"]);
    sheet.appendRow(header);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, header.length).setFontWeight("bold");
  }
  var row = [new Date(), "Sending email"]
    .concat(form.fields.map(function (field) { return asText_(values[field.name]); }))
    .concat([""]);
  sheet.appendRow(row);
  return { sheet: sheet, index: sheet.getLastRow() };
}

/** Stops a submitted "=SUM(...)" or "+1" from becoming a spreadsheet formula. */
function asText_(value) {
  return /^[=+\-@]/.test(value) ? "'" + value : value;
}

function sendEmail_(formName, form, values, config) {
  var message = formName === "sponsorship"
    ? sponsorshipEmail_(form, values, config)
    : speakerEmail_(form, values, config);
  MailApp.sendEmail({
    to: values.email,
    cc: config.team.join(","),
    replyTo: config.team[0],
    name: SENDER_NAME,
    subject: message.subject,
    htmlBody: message.html,
    body: message.text,
    attachments: message.attachments || []
  });
}

function sponsorshipEmail_(form, values, config) {
  var attachments = [];
  if (config.sponsorDocId) {
    var file = DriveApp.getFileById(config.sponsorDocId);
    attachments.push(file.getAs("application/pdf").setName("KCDP sponsorship levels.pdf"));
  }
  var intro = [
    "Hi " + firstName_(values.name) + ",",
    "Thanks for your interest in supporting Kansas City Data Professionals. " +
      (attachments.length
        ? "Our sponsorship levels are attached."
        : "We'll send over our sponsorship levels shortly."),
    "The KCDP organizers are copied on this email. Reply all with any questions and we'll find a time to talk.",
    "As a reminder, KCDP is practitioner-led and vendor-neutral: sponsors support the community, but don't choose topics or speakers, and there are no sales pitches from the stage."
  ];
  return compose_(
    "KCDP sponsorship levels for " + values.organization,
    intro,
    form,
    values,
    attachments
  );
}

function speakerEmail_(form, values, config) {
  var intro = [
    "Hi " + firstName_(values.name) + ",",
    "Thanks for offering to speak at Kansas City Data Professionals! We've received your proposal, “" + values.talk_title + ".”",
    "The KCDP organizers are copied on this email. We'll review it and reply all to talk through fit, format and dates. In the meantime, reply all with anything you'd like to add."
  ];
  return compose_("Your KCDP talk proposal: " + values.talk_title, intro, form, values, []);
}

/** Builds matching HTML and plain-text bodies: intro paragraphs, then the answers. */
function compose_(subject, paragraphs, form, values, attachments) {
  var answered = form.fields.filter(function (field) { return values[field.name]; });

  var html = paragraphs.map(function (p) { return "<p>" + escape_(p) + "</p>"; }).join("") +
    '<p style="margin-top:24px"><strong>What you sent us</strong></p>' +
    '<table cellpadding="6" style="border-collapse:collapse">' +
    answered.map(function (field) {
      return '<tr><td style="vertical-align:top;color:#4f5d68;white-space:nowrap">' + escape_(field.label) +
        '</td><td style="vertical-align:top">' + escape_(values[field.name]).replace(/\n/g, "<br>") + "</td></tr>";
    }).join("") +
    "</table>" +
    '<p style="margin-top:24px;color:#4f5d68">Kansas City Data Professionals<br>Connecting Kansas City’s data community.</p>';

  var text = paragraphs.join("\n\n") + "\n\nWhat you sent us\n" +
    answered.map(function (field) { return "- " + field.label + ": " + values[field.name]; }).join("\n") +
    "\n\nKansas City Data Professionals";

  return { subject: subject, html: html, text: text, attachments: attachments };
}

function firstName_(name) {
  return String(name).split(/\s+/)[0] || "there";
}

function escape_(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** JSON for the site's fetch(); a small HTML page for plain form posts. */
function respond_(viaJs, result) {
  if (viaJs) {
    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  }
  var siteUrl = "https://kcdataprofessionals.org";
  try { siteUrl = config_().siteUrl; } catch (ignored) {}
  var message = result.ok
    ? "Thanks! Check your inbox for a copy. The KCDP organizers are copied and will follow up."
    : (result.error || "Something went wrong sending the form.") + " Please go back and try again.";
  return HtmlService.createHtmlOutput(
    '<div style="font-family:system-ui,sans-serif;max-width:32rem;margin:3rem auto;line-height:1.6">' +
    "<p>" + escape_(message) + "</p>" +
    '<p><a href="' + escape_(siteUrl) + '" target="_top">Back to kcdataprofessionals.org</a></p></div>'
  ).setTitle("Kansas City Data Professionals");
}
