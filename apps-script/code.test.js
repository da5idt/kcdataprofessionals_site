// Offline tests for Code.gs, with Google's services replaced by fakes.
// Run from the repo root:  node --test apps-script/code.test.js

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const SOURCE = fs.readFileSync(path.join(__dirname, "Code.gs"), "utf8");

function load({ props = {}, mailThrows = false, answer = "YES", slackStatus = 200, slackThrows = false } = {}) {
  const sent = [];
  const posts = [];
  const sheets = {};
  const cache = {};
  const properties = { KCDP_EMAILS: "a@kcdp.org, b@kcdp.org", KCDD_EMAILS: "aaron@kcdd.org,jim@kcdd.org", ...props };

  const makeSheet = (name) => {
    const rows = [];
    return {
      name, rows,
      getLastRow: () => rows.length,
      appendRow: (row) => rows.push(row.slice()),
      setFrozenRows() {},
      getName: () => name,
      getSheetId: () => (name === "Sponsorship" ? 111 : 222),
      getRange: (r, c, nr = 1, nc = 1) => ({
        setFontWeight() { return this; },
        setValue: (v) => { rows[r - 1][c - 1] = v; },
        getValue: () => rows[r - 1][c - 1],
        getValues: () => rows.slice(r - 1, r - 1 + nr).map((row) => row.slice(c - 1, c - 1 + nc)),
      }),
    };
  };
  const ui = {
    alerts: [],
    dialogs: [],
    showModalDialog(output, title) { ui.dialogs.push({ html: output.html, title }); },
    alert(...args) { ui.alerts.push(args); return args.length > 1 ? answer : "OK"; },
  };
  const selection = { sheet: null, row: 0 };

  const context = {
    console: { error() {} },
    ContentService: {
      MimeType: { JSON: "json" },
      createTextOutput: (text) => ({ text, setMimeType() { return this; } }),
    },
    HtmlService: {
      createHtmlOutput: (html) => ({
        html,
        setTitle() { return this; },
        setWidth() { return this; },
        setHeight() { return this; },
      }),
    },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    CacheService: {
      getScriptCache: () => ({ get: (k) => cache[k] || null, put: (k, v) => { cache[k] = v; } }),
    },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (k) => (k in properties ? properties[k] : null),
        setProperty: (k, v) => { properties[k] = v; },
        getKeys: () => Object.keys(properties),
        deleteProperty: (k) => { delete properties[k]; },
      }),
    },
    Utilities: {
      formatDate: (date, tz, pattern) =>
        pattern === "yyyy-MM-dd"
          ? "2026-10-14"
          : date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }),
    },
    SpreadsheetApp: {
      getUi: () => ui,
      getActiveSheet: () => selection.sheet,
      getActiveSpreadsheet: () => ({
        getUrl: () => "https://docs.google.com/spreadsheets/d/SHEET/edit",
        getSheetByName: (n) => sheets[n] || null,
        insertSheet: (n) => (sheets[n] = makeSheet(n)),
      }),
    },
    DriveApp: {
      getFileById: (id) => ({
        getAs: (mime) => ({ id, mime, setName(n) { this.name = n; return this; } }),
      }),
    },
    UrlFetchApp: {
      fetch: (url, options) => {
        if (slackThrows) throw new Error("DNS error");
        posts.push({ url, ...options, body: JSON.parse(options.payload) });
        return { getResponseCode: () => slackStatus, getContentText: () => "ok" };
      },
    },
    MailApp: {
      sendEmail: (msg) => {
        if (mailThrows) throw new Error("quota");
        sent.push(msg);
      },
    },
  };
  vm.createContext(context);
  vm.runInContext(SOURCE, context);
  const post = (params, multi = {}) => {
    const out = context.doPost({ parameter: params, parameters: multi });
    return out.text !== undefined ? JSON.parse(out.text) : out;
  };
  const select = (sheetName, row) => {
    selection.sheet = sheets[sheetName];
    selection.sheet.getActiveRange = () => ({ getRow: () => row });
  };
  return { post, sent, posts, sheets, properties, context, ui, select };
}

const speaker = (extra = {}) => ({
  form: "speaker", _js: "1", _elapsed: "9000",
  name: "Ada Lovelace", email: "ada@example.com",
  talk_title: "Engines", abstract: "About engines.", ...extra,
});

const sponsor = (extra = {}) => ({
  form: "sponsorship", _js: "1", _elapsed: "9000",
  name: "Grace Hopper", email: "grace@example.com", organization: "Navy", ...extra,
});

test("speaker submission is stored and emailed to the speaker with KCDP copied, not KCDD", () => {
  const { post, sent, sheets } = load();
  assert.deepEqual(post(speaker()), { ok: true });

  const rows = sheets.Speakers.rows;
  assert.equal(rows[0][0], "Submitted");
  assert.equal(rows[0].at(-1), "Team notes");
  assert.equal(rows[1][1], "New");
  assert.equal(rows[1][6], "Engines");

  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, "ada@example.com");
  assert.equal(sent[0].cc, "a@kcdp.org,b@kcdp.org");
  assert.equal(sent[0].replyTo, "a@kcdp.org");
  assert.match(sent[0].subject, /Engines/);
  assert.equal(sent[0].attachments.length, 0);
});

test("sponsorship email attaches the levels document as a PDF and joins checkbox answers", () => {
  const { post, sent, sheets } = load({ props: { SPONSOR_DOC_ID: "doc123" } });
  const result = post(sponsor(), { interest: ["Gold (10 events)", "Could host an event"] });
  assert.deepEqual(result, { ok: true });
  assert.equal(sent[0].attachments[0].id, "doc123");
  assert.equal(sent[0].attachments[0].mime, "application/pdf");
  assert.equal(sheets.Sponsorship.rows[1][7], "Gold (10 events), Could host an event");
  assert.match(sent[0].htmlBody, /attached/);
});

test("sponsorship email still sends when no levels document is configured", () => {
  const { post, sent } = load();
  assert.deepEqual(post(sponsor()), { ok: true });
  assert.equal(sent[0].attachments.length, 0);
  assert.match(sent[0].body, /shortly/);
});

test("missing required fields and bad emails are rejected with a readable message", () => {
  const { post, sent } = load();
  assert.deepEqual(post(speaker({ abstract: "  " })), { ok: false, error: "Abstract is required." });
  assert.deepEqual(post(speaker({ email: "nope" })), { ok: false, error: "Please enter a valid email address." });
  assert.deepEqual(post(speaker({ email: "a@b.com, victim@x.com" })), { ok: false, error: "Please enter a valid email address." });
  assert.equal(post(speaker({ profile_url: "javascript:alert(1)" })).ok, false);
  assert.equal(sent.length, 0);
});

test("honeypot and too-fast submissions get a silent fake success", () => {
  const { post, sent, sheets } = load();
  assert.deepEqual(post(speaker({ _company_url: "http://spam" })), { ok: true });
  assert.deepEqual(post(speaker({ _elapsed: "500" })), { ok: true });
  assert.deepEqual(post(speaker({ _elapsed: undefined })), { ok: true });
  assert.equal(sent.length, 0);
  assert.equal(sheets.Speakers, undefined);
});

test("the same address can't submit the same form twice in a row", () => {
  const { post, sent } = load();
  assert.equal(post(speaker()).ok, true);
  const second = post(speaker({ email: "ADA@example.com" }));
  assert.equal(second.ok, false);
  assert.match(second.error, /recent submission/);
  assert.equal(sent.length, 1);
});

test("the daily limit stops further submissions", () => {
  const { post } = load({ props: { DAILY_LIMIT: "2" } });
  assert.equal(post(speaker({ email: "one@example.com" })).ok, true);
  assert.equal(post(speaker({ email: "two@example.com" })).ok, true);
  assert.match(post(speaker({ email: "three@example.com" })).error, /a lot of submissions/);
});

test("values that look like formulas are stored as text", () => {
  const { post, sheets } = load();
  post(speaker({ talk_title: "=IMPORTXML(\"http://x\")" }));
  assert.equal(sheets.Speakers.rows[1][6], "'=IMPORTXML(\"http://x\")");
});

test("submitted text is escaped in the HTML email", () => {
  const { post, sent } = load();
  post(speaker({ talk_title: "<script>x</script>" }));
  assert.ok(!sent[0].htmlBody.includes("<script>"));
  assert.ok(sent[0].htmlBody.includes("&lt;script&gt;"));
});

test("a mail failure keeps the row and flags it for the team", () => {
  const { post, sheets } = load({ mailThrows: true });
  assert.deepEqual(post(speaker()), { ok: true });
  assert.match(sheets.Speakers.rows[1][1], /email failed/);
});

test("unknown forms and a missing KCDP_EMAILS fail safely", () => {
  assert.equal(load().post({ form: "other", _js: "1" }).ok, false);
  const { post, sent } = load({ props: { KCDP_EMAILS: "" } });
  assert.deepEqual(post(speaker()), { ok: false });
  assert.equal(sent.length, 0);
});

test("plain (no-JavaScript) posts get an HTML confirmation page", () => {
  const { post } = load();
  const page = post({ ...speaker(), _js: undefined, _elapsed: undefined });
  assert.match(page.html, /Thanks!/);
});

test("new sponsor inquiries copy KCDP but not KC Digital Drive", () => {
  const { post, sent } = load();
  post(sponsor());
  assert.equal(sent[0].cc, "a@kcdp.org,b@kcdp.org");
  assert.equal(sent[0].replyTo, "a@kcdp.org");
});

const LEVELS = { SPONSOR_LEVELS: "Bronze $250; Silver $500; Gold $1,000" }; // sample prices only

test("the invoicing menu opens a dialog with a date picker, the levels and the CC list", () => {
  const { post, context, select, ui } = load({ props: LEVELS });
  post(sponsor({ organization: "<Navy>" }));
  select("Sponsorship", 2);
  context.confirmSelectedSponsor();

  assert.equal(ui.dialogs.length, 1);
  const { html, title } = ui.dialogs[0];
  assert.equal(title, "Confirm sponsor & request invoice");
  assert.match(html, /<input type="date" id="date" required>/);
  assert.match(html, /<option>Bronze \$250<\/option><option>Silver \$500<\/option><option>Gold \$1,000<\/option>/);
  assert.match(html, /a@kcdp\.org, b@kcdp\.org, aaron@kcdd\.org, jim@kcdd\.org/);
  assert.match(html, /&lt;Navy&gt;/);
  assert.ok(!html.includes("<Navy>"));
  assert.match(html, /submitInvoiceRequest\(2,/);
});

test("levels default to Bronze, Silver and Gold with their event counts", () => {
  const { post, context, select, ui } = load();
  post(sponsor());
  select("Sponsorship", 2);
  context.confirmSelectedSponsor();
  assert.match(ui.dialogs[0].html, /<option>Bronze \(1 event\)<\/option><option>Silver \(5 events\)<\/option><option>Gold \(10 events\)<\/option>/);
});

test("sending from the dialog emails KCDP and KC Digital Drive and updates Status", () => {
  const { post, sent, sheets, context } = load({ props: LEVELS });
  post(sponsor({ organization: "=Navy", website: "https://navy.example" }));
  const status = context.submitInvoiceRequest(2, "2026-11-19", "Silver $500");

  assert.equal(sent.length, 2);
  const invoice = sent[1];
  assert.equal(invoice.to, "grace@example.com");
  assert.equal(invoice.cc, "a@kcdp.org,b@kcdp.org,aaron@kcdd.org,jim@kcdd.org");
  assert.equal(invoice.replyTo, "a@kcdp.org");
  assert.equal(invoice.subject, "=Navy sponsorship of KCDP (Thursday, November 19, 2026): invoicing");
  assert.match(invoice.body, /KC Digital Drive, who handle invoicing/);
  assert.match(invoice.body, /- First event: Thursday, November 19, 2026/);
  assert.match(invoice.body, /- Sponsorship: Silver \$500/);
  assert.match(invoice.body, /- Website: https:\/\/navy.example/);
  const expected = "Invoice requested 2026-10-14 · Thursday, November 19, 2026 · Silver $500";
  assert.equal(sheets.Sponsorship.rows[1][1], expected);
  assert.equal(status, expected);
});

test("the dialog's request is checked again on the server", () => {
  const { post, sent, context } = load({ props: LEVELS });
  post(sponsor());
  assert.throws(() => context.submitInvoiceRequest(2, "", "Gold $1,000"), /Choose the event date/);
  assert.throws(() => context.submitInvoiceRequest(2, "11/19/2026", "Gold $1,000"), /Choose the event date/);
  assert.throws(() => context.submitInvoiceRequest(2, "2026-11-19", "Platinum $5,000"), /Choose a sponsorship level/);
  assert.throws(() => context.submitInvoiceRequest(1, "2026-11-19", "Gold $1,000"), /not the header/);
  assert.throws(() => context.submitInvoiceRequest(9, "2026-11-19", "Gold $1,000"), /not the header/);
  assert.equal(sent.length, 1);
});

test("the invoicing menu refuses the header row and other tabs", () => {
  const { post, context, select, ui } = load();
  post(sponsor());
  post(speaker());
  select("Sponsorship", 1);
  context.confirmSelectedSponsor();
  select("Speakers", 2);
  context.confirmSelectedSponsor();
  assert.equal(ui.dialogs.length, 0);
  assert.match(ui.alerts[0][0], /not the header/);
  assert.match(ui.alerts[1][0], /Sponsorship tab/);
});

test("the dialog warns when the invoicing email was already sent", () => {
  const { post, context, select, ui } = load({ props: LEVELS });
  post(sponsor());
  context.submitInvoiceRequest(2, "2026-11-19", "Gold $1,000");
  select("Sponsorship", 2);
  context.confirmSelectedSponsor();
  assert.match(ui.dialogs[0].html, /Already marked “Invoice requested 2026-10-14/);
});

test("invoicing without KCDD_EMAILS stops and says what to set", () => {
  const { post, sent, context, select, ui } = load({ props: { KCDD_EMAILS: "" } });
  post(sponsor());
  select("Sponsorship", 2);
  context.confirmSelectedSponsor();
  assert.equal(ui.dialogs.length, 0);
  assert.match(ui.alerts[0][0], /KCDD_EMAILS/);
  assert.throws(() => context.submitInvoiceRequest(2, "2026-11-19", "Gold"), /KCDD_EMAILS/);
  assert.equal(sent.length, 1);
});

test("an address in both groups is copied once", () => {
  const { post, sent, context } = load({ props: { KCDD_EMAILS: "A@kcdp.org, jim@kcdd.org" } });
  post(sponsor());
  context.submitInvoiceRequest(2, "2026-11-19", "Gold (10 events)");
  assert.equal(sent[1].cc, "a@kcdp.org,b@kcdp.org,jim@kcdd.org");
});

const SLACK = {
  SLACK_SPONSORSHIP_WEBHOOK_URL: "https://hooks.slack.com/services/SPONSOR",
  SLACK_SPEAKERS_WEBHOOK_URL: "https://hooks.slack.com/services/SPEAKERS",
};

test("each form posts to its own Slack channel", () => {
  const { post, posts } = load({ props: SLACK });
  post(sponsor({ role: "CTO", message: "Line one\nLine two" }), { interest: ["Silver (5 events)", "Could host an event"] });
  post(speaker({ format: "Lightning talk" }));

  assert.equal(posts.length, 2);
  assert.equal(posts[0].url, SLACK.SLACK_SPONSORSHIP_WEBHOOK_URL);
  assert.equal(posts[0].method, "post");
  assert.equal(posts[0].body.text, [
    ":handshake: *New sponsor inquiry:* Navy",
    "Grace Hopper (grace@example.com) \u00b7 CTO",
    "Interested in: Silver (5 events), Could host an event",
    "> Line one\n> Line two",
    "<https://docs.google.com/spreadsheets/d/SHEET/edit#gid=111|Open the Sponsorship tab>",
  ].join("\n"));

  assert.equal(posts[1].url, SLACK.SLACK_SPEAKERS_WEBHOOK_URL);
  assert.match(posts[1].body.text, /^:microphone: \*New talk proposal:\* \u201cEngines\u201d/);
  assert.match(posts[1].body.text, /Format: Lightning talk/);
  assert.match(posts[1].body.text, /#gid=222\|Open the Speakers tab>$/);
});

test("the invoicing step posts to the sponsorship channel", () => {
  const { post, posts, context } = load({ props: { ...SLACK, ...LEVELS } });
  post(sponsor());
  context.submitInvoiceRequest(2, "2026-11-19", "Silver $500");
  assert.equal(posts.length, 2);
  assert.equal(posts[1].url, SLACK.SLACK_SPONSORSHIP_WEBHOOK_URL);
  assert.match(posts[1].body.text, /^:receipt: \*Invoice requested:\* Navy starting with the Thursday, November 19, 2026 event \(Silver \$500\)/);
});

test("without webhook properties nothing is posted", () => {
  const { post, posts } = load();
  post(sponsor());
  post(speaker());
  assert.equal(posts.length, 0);
});

test("Slack markup in submissions is escaped and long text is trimmed", () => {
  const { post, posts } = load({ props: SLACK });
  post(speaker({ talk_title: "<!channel> & <https://evil|click>", abstract: "x".repeat(400) }));
  const text = posts[0].body.text;
  assert.match(text, /&lt;!channel&gt; &amp; &lt;https:\/\/evil\|click&gt;/);
  assert.ok(!text.includes("<!channel>"));
  assert.match(text, /> x{300}\u2026/);
});

test("a failed email is flagged in the Slack post", () => {
  const { post, posts } = load({ props: SLACK, mailThrows: true });
  post(speaker());
  assert.match(posts[0].body.text, /:warning: The confirmation email failed/);
});

test("Slack errors never break a submission", () => {
  for (const opts of [{ slackStatus: 404 }, { slackThrows: true }]) {
    const { post, sent, sheets } = load({ ...opts, props: SLACK });
    assert.deepEqual(post(speaker()), { ok: true });
    assert.equal(sent.length, 1);
    assert.equal(sheets.Speakers.rows[1][1], "New");
  }
});

test("the daily counter keeps only today's count property", () => {
  const { post, properties } = load({ props: { "count:2026-10-12": "7", "count:2026-10-13": "3" } });
  post(speaker());
  post(speaker({ email: "second@example.com" }));
  const counters = Object.keys(properties).filter((k) => k.startsWith("count:"));
  assert.deepEqual(counters, ["count:2026-10-14"]);
  assert.equal(properties["count:2026-10-14"], "2");
  assert.equal(properties.KCDP_EMAILS, "a@kcdp.org, b@kcdp.org");
});

test("newsletter readers are saved without email, Slack or the form daily limit", () => {
  const { post, sent, posts, sheets } = load({
    props: { DAILY_LIMIT: "1", SLACK_SPEAKERS_WEBHOOK_URL: "https://hooks.slack.com/x" },
  });
  const reader = (extra = {}) => ({
    form: "newsletter", _js: "1", _elapsed: "9000",
    first_name: "Ada", last_name: "Lovelace", email: "ada@example.com", company: "Analytical Engines", meetup_invites: "Yes", title: "Data Engineer", issue: "2026-10-26", ...extra,
  });
  assert.deepEqual(post(reader()), { ok: true });
  assert.deepEqual(post(reader()), { ok: true });

  const rows = sheets["Newsletter readers"].rows;
  assert.deepEqual([...rows[0]], ["Submitted", "Status", "First name", "Last name", "Email", "Company", "Title", "Meetup invites", "Share with sponsors", "Issue", "Team notes"]);
  assert.equal(rows[1][1], "New");
  assert.equal(rows[1][2], "Ada");
  assert.equal(rows[1][3], "Lovelace");
  assert.equal(rows[1][4], "ada@example.com");
  assert.equal(rows[1][6], "Data Engineer");
  assert.equal(rows[1][7], "Yes");
  assert.equal(rows[1][8], "No");
  assert.equal(sent.length, 0);
  assert.equal(posts.length, 0);

  post(reader({ meetup_invites: undefined }));
  assert.equal(rows.at(-1)[7], "No");
  assert.deepEqual(post(reader({ company: "" })), { ok: false, error: "Company is required." });
  assert.deepEqual(post(reader({ last_name: "" })), { ok: false, error: "Last name is required." });
  assert.deepEqual(post(reader({ email: "not-an-email" })), { ok: false, error: "Please enter a valid email address." });
});

test("newsletter readers have their own daily cap and a shorter fill timer", () => {
  const { post, sheets, properties } = load({ props: { READER_DAILY_LIMIT: "1" } });
  const reader = (extra = {}) => ({
    form: "newsletter", _js: "1", _elapsed: "1500",
    first_name: "Ada", last_name: "Lovelace", email: "ada@example.com", company: "Acme", title: "Engineer", ...extra,
  });
  assert.deepEqual(post(reader()), { ok: true });
  assert.equal(post(reader()).ok, false);
  assert.equal(sheets["Newsletter readers"].rows.length, 2);
  assert.equal(properties["readers:2026-10-14"], "1");

  assert.deepEqual(post(reader({ _elapsed: "500" })), { ok: true });
  assert.equal(sheets["Newsletter readers"].rows.length, 2);
  assert.deepEqual(post(speaker({ _elapsed: "1500" })), { ok: true });
  assert.equal(sheets.Speakers, undefined);
});
