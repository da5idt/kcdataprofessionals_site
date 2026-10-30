/**
 * Kansas City Data Professionals: website form handler.
 *
 * Receives the sponsorship and speaker forms from kcdataprofessionals.org,
 * saves each submission as a row in this spreadsheet, and emails the person
 * who submitted it with organizers copied.
 *
 * Sponsorship runs in two stages:
 *   1. Inquiry: the sponsor gets the sponsorship levels PDF, with the KCDP
 *      organizers (KCDP_EMAILS) copied. KCDP reviews and approves the
 *      sponsor in that email thread and agrees an event date.
 *   2. Invoicing: an organizer selects the sponsor's row and chooses
 *      KCDP > Confirm sponsor & request invoice, picking the event date and
 *      level. That emails the sponsor with KCDP and KC Digital Drive
 *      (KCDD_EMAILS) copied so KCDD can invoice them, and updates the row's
 *      Status.
 * Speaker proposals copy the KCDP organizers only.
 * Newsletter readers (the short form in front of each Data Profession Weekly
 * issue: name, email, company, title) are only saved to the "Newsletter readers" tab: no email, no Slack.
 *
 * Setup and deployment: docs/forms.md in the website repository.
 *
 * Script properties (Project Settings > Script properties):
 *   KCDP_EMAILS     required  Comma-separated KCDP organizer addresses.
 *                             Copied on every email; the first one is the
 *                             Reply-To address.
 *   KCDD_EMAILS     optional  Comma-separated KC Digital Drive addresses.
 *                             Copied only on the invoicing email; needed
 *                             before that menu item will run.
 *   SPONSOR_DOC_ID  optional  Drive file ID of the sponsorship levels
 *                             document (a Google Doc or a PDF). Attached
 *                             to sponsorship emails as a PDF.
 *   SPONSOR_LEVELS  optional  Choices for the invoicing dropdown, separated
 *                             by semicolons, e.g.
 *                             Bronze (1 event) $X; Silver (5 events) $Y;
 *                             Gold (10 events) $Z
 *                             Defaults to the three levels without prices.
 *   SITE_URL        optional  Defaults to https://kcdataprofessionals.org
 *   SLACK_SPONSORSHIP_WEBHOOK_URL
 *                   optional  Slack incoming webhook for the sponsorship
 *                             channel: new inquiries and invoice requests.
 *   SLACK_SPEAKERS_WEBHOOK_URL
 *                   optional  Slack incoming webhook for the speakers
 *                             channel: new talk proposals.
 *   READER_DAILY_LIMIT
 *                   optional  Most newsletter reader rows saved per day.
 *                             Defaults to 500.
 *   DAILY_LIMIT     optional  Most submissions accepted per day across both
 *                             forms. Defaults to 20. Each email counts once
 *                             per recipient (submitter plus every CC)
 *                             against Gmail's daily sending quota.
 */

var FORMS = {
  sponsorship: {
    sheet: "Sponsorship",
    slackProperty: "SLACK_SPONSORSHIP_WEBHOOK_URL",
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
    slackProperty: "SLACK_SPEAKERS_WEBHOOK_URL",
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
  },
  newsletter: {
    sheet: "Newsletter readers",
    saveOnly: true,
    minFillMs: 1000,   // three short fields that browsers autofill
    fields: [
      { name: "first_name", label: "First name", required: true, max: 80 },
      { name: "last_name", label: "Last name", required: true, max: 80 },
      { name: "email", label: "Email", required: true, max: 200, type: "email" },
      { name: "company", label: "Company", required: true, max: 200 },
      { name: "title", label: "Title", required: true, max: 200 },
      { name: "meetup_invites", label: "Meetup invites", max: 10, checkbox: true },
      { name: "share_with_sponsors", label: "Share with sponsors", max: 10, checkbox: true },
      { name: "issue", label: "Issue", max: 200 }
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
    if (!(elapsed >= (form.minFillMs || MIN_FILL_MS))) return { ok: true };
  }

  var values = readValues_(form, params, multiParams);
  var problem = validate_(form, values);
  if (problem) return { ok: false, error: problem };

  if (form.saveOnly) return saveOnly_(form, values);

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

  var emailed = true;
  try {
    sendEmail_(params.form, form, values, config);
    row.sheet.getRange(row.index, 2).setValue("New");
  } catch (err) {
    // The submission is saved either way; flag it so the team follows up.
    console.error(err && err.stack ? err.stack : err);
    row.sheet.getRange(row.index, 2).setValue("New: email failed, follow up by hand");
    emailed = false;
  }
  postToSlack_(form.slackProperty, submissionSlackText_(params.form, values, row.sheet, emailed));
  return { ok: true };
}

/**
 * Forms that only record a row. No email is sent, so there is no repeat
 * check; a separate daily cap keeps scripted posts from flooding the sheet.
 */
function saveOnly_(form, values) {
  var limit = Number(PropertiesService.getScriptProperties().getProperty("READER_DAILY_LIMIT")) || 500;
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    if (!takeDailySlot_(limit, "readers:")) {
      return { ok: false, error: "We've had a lot of readers today. Please try again tomorrow." };
    }
    appendRow_(form, values, "New");
  } finally {
    lock.releaseLock();
  }
  return { ok: true };
}

function readValues_(form, params, multiParams) {
  var values = {};
  form.fields.forEach(function (field) {
    var raw = field.multiple ? (multiParams[field.name] || []).join(", ") : params[field.name];
    if (field.checkbox) raw = raw ? "Yes" : "No";   // unticked boxes aren't sent
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
  var kcdp = addresses_(props.getProperty("KCDP_EMAILS"));
  if (!kcdp.length) throw new Error("Script property KCDP_EMAILS is not set.");
  return {
    kcdp: kcdp,
    kcdd: addresses_(props.getProperty("KCDD_EMAILS")),
    levels: levels_(props.getProperty("SPONSOR_LEVELS")),
    sponsorDocId: props.getProperty("SPONSOR_DOC_ID") || "",
    siteUrl: props.getProperty("SITE_URL") || "https://kcdataprofessionals.org",
    dailyLimit: Number(props.getProperty("DAILY_LIMIT")) || 20
  };
}

/** Sponsorship levels for the invoicing dropdown, one per semicolon. */
function levels_(value) {
  var levels = String(value || "")
    .split(/[;\n]/)
    .map(function (level) { return level.trim(); })
    .filter(Boolean);
  return levels.length ? levels : ["Bronze (1 event)", "Silver (5 events)", "Gold (10 events)"];
}

/** Splits a comma-separated property into trimmed, non-empty addresses. */
function addresses_(value) {
  return String(value || "")
    .split(",")
    .map(function (address) { return address.trim(); })
    .filter(Boolean);
}

/**
 * Counts today's submissions in a "<prefix><date>" script property (prefix
 * defaults to "count:"); false once the limit is reached. Earlier days'
 * counters with the same prefix are removed. Call under the lock.
 */
function takeDailySlot_(limit, prefix) {
  prefix = prefix || "count:";
  var props = PropertiesService.getScriptProperties();
  var key = prefix + Utilities.formatDate(new Date(), "America/Chicago", "yyyy-MM-dd");
  var count = Number(props.getProperty(key)) || 0;
  if (count >= limit) return false;
  if (count === 0) {
    props.getKeys().forEach(function (other) {
      if (other.indexOf(prefix) === 0 && other !== key) props.deleteProperty(other);
    });
  }
  props.setProperty(key, String(count + 1));
  return true;
}

/** Appends a row, creating the tab and its header the first time. */
function appendRow_(form, values, status) {
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
  var row = [new Date(), status || "Sending email"]
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
    cc: config.kcdp.join(","),
    replyTo: config.kcdp[0],
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
    "Reply to this email with any questions and we'll find a time to talk.",
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
    ? "Thanks! Check your inbox for a copy. We'll follow up soon."
    : (result.error || "Something went wrong sending the form.") + " Please go back and try again.";
  return HtmlService.createHtmlOutput(
    '<div style="font-family:system-ui,sans-serif;max-width:32rem;margin:3rem auto;line-height:1.6">' +
    "<p>" + escape_(message) + "</p>" +
    '<p><a href="' + escape_(siteUrl) + '" target="_top">Back to kcdataprofessionals.org</a></p></div>'
  ).setTitle("Kansas City Data Professionals");
}

// ---------------------------------------------------------------------------
// Sponsor invoicing (run from the spreadsheet's KCDP menu)
//
// KCDP reviews and approves sponsors in the inquiry email thread. Once a
// sponsor is approved and their event date is set, an organizer uses this to
// email the sponsor with KC Digital Drive copied so KCDD can invoice them.
// ---------------------------------------------------------------------------

var INVOICE_PREFIX = "Invoice requested";

/** Adds the KCDP menu whenever an organizer opens the spreadsheet. */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("KCDP")
    .addItem("Confirm sponsor & request invoice", "confirmSelectedSponsor")
    .addToUi();
}

/**
 * Menu action: checks the selected row, then opens a dialog with a date
 * picker and a sponsorship level dropdown. The dialog calls
 * submitInvoiceRequest() when the organizer clicks Send.
 */
function confirmSelectedSponsor() {
  var ui = SpreadsheetApp.getUi();
  var sheet = SpreadsheetApp.getActiveSheet();
  if (sheet.getName() !== FORMS.sponsorship.sheet) {
    ui.alert("Open the " + FORMS.sponsorship.sheet + " tab and click a cell in the sponsor's row first.");
    return;
  }
  var rowIndex = sheet.getActiveRange().getRow();
  var config = config_();
  var problem = sponsorRowProblem_(sheet, rowIndex, config);
  if (problem) {
    ui.alert(problem);
    return;
  }
  var sponsor = readSponsorRow_(sheet, rowIndex);
  var html = HtmlService.createHtmlOutput(invoiceDialogHtml_(sponsor, rowIndex, config))
    .setWidth(460)
    .setHeight(420);
  ui.showModalDialog(html, "Confirm sponsor & request invoice");
}

/**
 * Called from the dialog. isoDate comes from the date picker (yyyy-mm-dd);
 * level must be one of SPONSOR_LEVELS. Returns the row's new Status.
 */
function submitInvoiceRequest(rowIndex, isoDate, level) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(FORMS.sponsorship.sheet);
  var config = config_();
  var problem = sponsorRowProblem_(sheet, rowIndex, config);
  if (problem) throw new Error(problem);

  var match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(isoDate || ""));
  if (!match) throw new Error("Choose the event date.");
  if (config.levels.indexOf(level) === -1) throw new Error("Choose a sponsorship level.");

  var date = Utilities.formatDate(
    new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12),
    "America/Chicago",
    "EEEE, MMMM d, yyyy"
  );
  confirmSponsorRow_(sheet, rowIndex, config, { date: date, level: level });
  return sheet.getRange(rowIndex, 2).getValue();
}

/** Why a row can't be invoiced, or null if it can. */
function sponsorRowProblem_(sheet, rowIndex, config) {
  if (!sheet) return "There is no " + FORMS.sponsorship.sheet + " tab yet.";
  if (!(rowIndex >= 2) || rowIndex > sheet.getLastRow()) {
    return "Click a cell in the sponsor's row (not the header) first.";
  }
  if (!config.kcdd.length) return "Add KC Digital Drive's addresses to the KCDD_EMAILS script property first.";
  if (!readSponsorRow_(sheet, rowIndex).email) return "Row " + rowIndex + " has no email address.";
  return null;
}

function invoiceDialogHtml_(sponsor, rowIndex, config) {
  var already = String(sponsor.status).indexOf(INVOICE_PREFIX) === 0
    ? '<p class="warn">Already marked “' + escape_(sponsor.status) + '.” Sending again emails the sponsor and KC Digital Drive a second time.</p>'
    : "";
  var options = config.levels.map(function (level) {
    return "<option>" + escape_(level) + "</option>";
  }).join("");
  return [
    "<!doctype html><html><head><base target=\"_top\"><style>",
    "body{font:14px/1.5 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#15232e;margin:0}",
    "label{display:block;font-weight:600;margin:14px 0 4px}",
    "input,select{width:100%;box-sizing:border-box;padding:8px;font:inherit;border:1px solid #cfcabd;border-radius:6px}",
    ".who{background:#f2f0ea;border-radius:6px;padding:10px 12px;margin:0 0 4px}",
    ".cc{color:#4f5d68;font-size:13px;word-break:break-word}",
    ".warn{background:#fdf3e2;border:1px solid #f3d9a8;border-radius:6px;padding:8px 10px;color:#6b4a12}",
    ".actions{display:flex;gap:8px;justify-content:flex-end;margin-top:20px}",
    "button{font:600 14px system-ui,sans-serif;padding:8px 16px;border-radius:6px;cursor:pointer;border:1px solid #244c66}",
    "#send{background:#244c66;color:#fff}#cancel{background:#fff;color:#244c66}",
    "button[disabled]{opacity:.5;cursor:default}#error{color:#a33a26;font-weight:600}",
    "</style></head><body>",
    '<p class="who"><strong>' + escape_(sponsor.organization) + "</strong><br>" +
      escape_(sponsor.name) + " &lt;" + escape_(sponsor.email) + "&gt;</p>",
    already,
    '<form id="f">',
    '<label for="date">First sponsored event</label><input type="date" id="date" required>',
    '<label for="level">Sponsorship level</label>',
    '<select id="level" required><option value="">Choose a level…</option>' + options + "</select>",
    '<p class="cc">The sponsor is emailed with these people copied, so KC Digital Drive can send the invoice:<br>' +
      escape_(invoiceCc_(config).join(", ")) + "</p>",
    '<p id="error"></p>',
    '<div class="actions"><button type="button" id="cancel">Cancel</button>',
    '<button type="submit" id="send">Send</button></div>',
    "</form><script>",
    "var f=document.getElementById('f'),send=document.getElementById('send'),err=document.getElementById('error');",
    "document.getElementById('cancel').onclick=function(){google.script.host.close();};",
    "f.onsubmit=function(e){e.preventDefault();if(!f.reportValidity())return;send.disabled=true;send.textContent='Sending…';err.textContent='';",
    "google.script.run.withSuccessHandler(function(){google.script.host.close();})",
    ".withFailureHandler(function(x){send.disabled=false;send.textContent='Send';err.textContent=x.message||String(x);})",
    ".submitInvoiceRequest(" + Number(rowIndex) + ",document.getElementById('date').value,document.getElementById('level').value);};",
    "</script></body></html>"
  ].join("");
}

/** Sends the invoicing email for one Sponsorship row and updates its Status. */
function confirmSponsorRow_(sheet, rowIndex, config, details) {
  var sponsor = readSponsorRow_(sheet, rowIndex);
  var message = invoiceEmail_(sponsor, details);
  MailApp.sendEmail({
    to: sponsor.email,
    cc: invoiceCc_(config).join(","),
    replyTo: config.kcdp[0],
    name: SENDER_NAME,
    subject: message.subject,
    htmlBody: message.html,
    body: message.text
  });
  var stamp = Utilities.formatDate(new Date(), "America/Chicago", "yyyy-MM-dd");
  sheet.getRange(rowIndex, 2).setValue(
    asText_(INVOICE_PREFIX + " " + stamp + " · " + details.date + (details.level ? " · " + details.level : ""))
  );
  postToSlack_(FORMS.sponsorship.slackProperty,
    ":receipt: *Invoice requested:* " + slackEscape_(sponsor.organization) +
    " starting with the " + slackEscape_(details.date) + " event" +
    (details.level ? " (" + slackEscape_(details.level) + ")" : "") +
    ". Sponsor emailed with KC Digital Drive copied.\n" + sheetLink_(sheet));
}

/** KCDP organizers plus KC Digital Drive, without duplicates. */
function invoiceCc_(config) {
  var seen = {};
  return config.kcdp.concat(config.kcdd).filter(function (address) {
    var key = address.toLowerCase();
    if (seen[key]) return false;
    seen[key] = true;
    return true;
  });
}

/** Reads a Sponsorship row by the same column order appendRow_ writes. */
function readSponsorRow_(sheet, rowIndex) {
  var fields = FORMS.sponsorship.fields;
  var cells = sheet.getRange(rowIndex, 1, 1, fields.length + 3).getValues()[0];
  var sponsor = { status: cells[1] };
  fields.forEach(function (field, i) {
    sponsor[field.name] = String(cells[i + 2] == null ? "" : cells[i + 2]).replace(/^'/, "").trim();
  });
  return sponsor;
}

function invoiceEmail_(sponsor, details) {
  var paragraphs = [
    "Hi " + firstName_(sponsor.name) + ",",
    "Thank you for sponsoring Kansas City Data Professionals! " + sponsor.organization +
      " is confirmed as a KCDP sponsor, starting with our " + details.date + " event.",
    "I've copied our partners at KC Digital Drive, who handle invoicing for KCDP sponsorships. They'll send your invoice and are the best contact for billing questions. Reply all if anything changes on your side."
  ];
  var summary = [
    ["Organization", sponsor.organization],
    ["Contact", sponsor.name + " <" + sponsor.email + ">"],
    ["First event", details.date],
    ["Sponsorship", details.level],
    ["Website", sponsor.website]
  ].filter(function (row) { return row[1]; });

  var html = paragraphs.map(function (p) { return "<p>" + escape_(p) + "</p>"; }).join("") +
    '<p style="margin-top:24px"><strong>Sponsorship details</strong></p>' +
    '<table cellpadding="6" style="border-collapse:collapse">' +
    summary.map(function (row) {
      return '<tr><td style="vertical-align:top;color:#4f5d68;white-space:nowrap">' + escape_(row[0]) +
        '</td><td style="vertical-align:top">' + escape_(row[1]) + "</td></tr>";
    }).join("") +
    "</table>" +
    '<p style="margin-top:24px;color:#4f5d68">Kansas City Data Professionals<br>Connecting Kansas City’s data community.</p>';
  var text = paragraphs.join("\n\n") + "\n\nSponsorship details\n" +
    summary.map(function (row) { return "- " + row[0] + ": " + row[1]; }).join("\n") +
    "\n\nKansas City Data Professionals";

  return {
    subject: sponsor.organization + " sponsorship of KCDP (" + details.date + "): invoicing",
    html: html,
    text: text
  };
}

// ---------------------------------------------------------------------------
// Slack (optional): one incoming webhook per channel, set in Script properties
// ---------------------------------------------------------------------------

/** Posts to the webhook in the named property. Never throws: Slack is a nice-to-have. */
function postToSlack_(property, text) {
  var url = PropertiesService.getScriptProperties().getProperty(property);
  if (!url) return;
  try {
    var response = UrlFetchApp.fetch(url, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify({ text: text }),
      muteHttpExceptions: true
    });
    if (response.getResponseCode() !== 200) {
      console.error("Slack (" + property + ") returned " + response.getResponseCode() + ": " + response.getContentText());
    }
  } catch (err) {
    console.error(err && err.stack ? err.stack : err);
  }
}

function submissionSlackText_(formName, values, sheet, emailed) {
  var who = slackEscape_(values.name) + " (" + slackEscape_(values.email) + ")" +
    (values.role ? " · " + slackEscape_(values.role) : "");
  var lines = formName === "sponsorship"
    ? [
        ":handshake: *New sponsor inquiry:* " + slackEscape_(values.organization),
        who,
        values.interest ? "Interested in: " + slackEscape_(values.interest) : "",
        quote_(values.message)
      ]
    : [
        ":microphone: *New talk proposal:* “" + slackEscape_(values.talk_title) + "”",
        who,
        [values.format && "Format: " + slackEscape_(values.format),
         values.level && "Level: " + slackEscape_(values.level)].filter(Boolean).join(" · "),
        quote_(values.abstract)
      ];
  if (!emailed) lines.push(":warning: The confirmation email failed. Follow up by hand.");
  lines.push(sheetLink_(sheet));
  return lines.filter(Boolean).join("\n");
}

/** A Slack block quote of the first 300 characters. */
function quote_(text) {
  if (!text) return "";
  var short = text.length > 300 ? text.slice(0, 300).trim() + "…" : text;
  return slackEscape_(short).split("\n").map(function (line) { return "> " + line; }).join("\n");
}

function sheetLink_(sheet) {
  var url = SpreadsheetApp.getActiveSpreadsheet().getUrl() + "#gid=" + sheet.getSheetId();
  return "<" + url + "|Open the " + sheet.getName() + " tab>";
}

/** Slack treats &, < and > as markup; everything else is plain text. */
function slackEscape_(text) {
  return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
