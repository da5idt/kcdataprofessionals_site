// Offline tests for Code.gs, with Google's services replaced by fakes.
// Run from the repo root:  node --test apps-script/code.test.js

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const SOURCE = fs.readFileSync(path.join(__dirname, "Code.gs"), "utf8");

function load({ props = {}, mailThrows = false, answer = "YES", replies = [], slackStatus = 200, slackThrows = false } = {}) {
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
    prompts: [],
    replies: replies.slice(),
    ButtonSet: { YES_NO: "YES_NO", OK_CANCEL: "OK_CANCEL" },
    Button: { YES: "YES", NO: "NO", OK: "OK", CANCEL: "CANCEL" },
    alert(...args) { ui.alerts.push(args); return args.length > 1 ? answer : "OK"; },
    // Each reply is a string (typed, then OK) or null (Cancel).
    prompt(title, text) {
      ui.prompts.push(title);
      const reply = ui.replies.length ? ui.replies.shift() : "";
      return {
        getSelectedButton: () => (reply === null ? "CANCEL" : "OK"),
        getResponseText: () => reply || "",
      };
    },
  };
  const selection = { sheet: null, row: 0 };

  const context = {
    console: { error() {} },
    ContentService: {
      MimeType: { JSON: "json" },
      createTextOutput: (text) => ({ text, setMimeType() { return this; } }),
    },
    HtmlService: { createHtmlOutput: (html) => ({ html, setTitle() { return this; } }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    CacheService: {
      getScriptCache: () => ({ get: (k) => cache[k] || null, put: (k, v) => { cache[k] = v; } }),
    },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (k) => (k in properties ? properties[k] : null),
        setProperty: (k, v) => { properties[k] = v; },
      }),
    },
    Utilities: { formatDate: () => "2026-10-14" },
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
  const result = post(sponsor(), { interest: ["Venue host", "Event sponsor"] });
  assert.deepEqual(result, { ok: true });
  assert.equal(sent[0].attachments[0].id, "doc123");
  assert.equal(sent[0].attachments[0].mime, "application/pdf");
  assert.equal(sheets.Sponsorship.rows[1][7], "Venue host, Event sponsor");
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

const INVOICE = { replies: ["Thursday, November 19", "Event sponsor, $500"] };

test("confirming a sponsor copies KCDP and KC Digital Drive for invoicing and updates Status", () => {
  const { post, sent, sheets, context, select, ui } = load(INVOICE);
  post(sponsor({ organization: "=Navy", website: "https://navy.example" }));
  select("Sponsorship", 2);
  context.confirmSelectedSponsor();

  assert.deepEqual(ui.prompts, ["Event date", "Sponsorship level"]);
  assert.equal(sent.length, 2);
  const invoice = sent[1];
  assert.equal(invoice.to, "grace@example.com");
  assert.equal(invoice.cc, "a@kcdp.org,b@kcdp.org,aaron@kcdd.org,jim@kcdd.org");
  assert.equal(invoice.replyTo, "a@kcdp.org");
  assert.equal(invoice.subject, "=Navy sponsorship of KCDP (Thursday, November 19): invoicing");
  assert.match(invoice.body, /KC Digital Drive, who handle invoicing/);
  assert.match(invoice.body, /- Sponsorship: Event sponsor, \$500/);
  assert.match(invoice.body, /- Website: https:\/\/navy.example/);
  assert.equal(sheets.Sponsorship.rows[1][1], "Invoice requested 2026-10-14 \u00b7 Thursday, November 19 \u00b7 Event sponsor, $500");
  assert.match(ui.alerts[0][1], /jim@kcdd.org/);
});

test("the sponsorship level is optional", () => {
  const { post, sent, sheets, context, select } = load({ replies: ["Nov 19", ""] });
  post(sponsor());
  select("Sponsorship", 2);
  context.confirmSelectedSponsor();
  assert.doesNotMatch(sent[1].body, /- Sponsorship:/);
  assert.equal(sheets.Sponsorship.rows[1][1], "Invoice requested 2026-10-14 \u00b7 Nov 19");
});

test("a blank event date is asked again", () => {
  const { post, sent, context, select, ui } = load({ replies: ["  ", "Nov 19", ""] });
  post(sponsor());
  select("Sponsorship", 2);
  context.confirmSelectedSponsor();
  assert.deepEqual(ui.prompts, ["Event date", "Event date", "Sponsorship level"]);
  assert.equal(sent.length, 2);
});

test("cancelling a prompt or answering No sends nothing", () => {
  for (const opts of [{ replies: [null] }, { replies: ["Nov 19", null] }, { ...INVOICE, answer: "NO" }]) {
    const { post, sent, sheets, context, select } = load(opts);
    post(sponsor());
    select("Sponsorship", 2);
    context.confirmSelectedSponsor();
    assert.equal(sent.length, 1);
    assert.equal(sheets.Sponsorship.rows[1][1], "New");
  }
});

test("confirming refuses the header row and other tabs", () => {
  const { post, sent, context, select, ui } = load(INVOICE);
  post(sponsor());
  post(speaker());
  select("Sponsorship", 1);
  context.confirmSelectedSponsor();
  select("Speakers", 2);
  context.confirmSelectedSponsor();
  assert.equal(sent.length, 2);
  assert.match(ui.alerts[0][0], /not the header/);
  assert.match(ui.alerts[1][0], /Sponsorship tab/);
});

test("confirming twice asks before sending the invoicing email again", () => {
  const { post, sent, context, select, ui } = load({ replies: ["Nov 19", "", "Nov 19", ""] });
  post(sponsor());
  select("Sponsorship", 2);
  context.confirmSelectedSponsor();
  context.confirmSelectedSponsor();
  assert.equal(sent.length, 3);
  assert.equal(ui.alerts[2][0], "Already sent");
});

test("confirming without KCDD_EMAILS stops and says what to set", () => {
  const { post, sent, context, select, ui } = load({ ...INVOICE, props: { KCDD_EMAILS: "" } });
  post(sponsor());
  select("Sponsorship", 2);
  context.confirmSelectedSponsor();
  assert.equal(sent.length, 1);
  assert.match(ui.alerts[0][0], /KCDD_EMAILS/);
});

test("an address in both groups is copied once", () => {
  const { post, sent, context, select } = load({ ...INVOICE, props: { KCDD_EMAILS: "A@kcdp.org, jim@kcdd.org" } });
  post(sponsor());
  select("Sponsorship", 2);
  context.confirmSelectedSponsor();
  assert.equal(sent[1].cc, "a@kcdp.org,b@kcdp.org,jim@kcdd.org");
});

const SLACK = {
  SLACK_SPONSORSHIP_WEBHOOK_URL: "https://hooks.slack.com/services/SPONSOR",
  SLACK_SPEAKERS_WEBHOOK_URL: "https://hooks.slack.com/services/SPEAKERS",
};

test("each form posts to its own Slack channel", () => {
  const { post, posts } = load({ props: SLACK });
  post(sponsor({ role: "CTO", message: "Line one\nLine two" }), { interest: ["Venue host"] });
  post(speaker({ format: "Lightning talk" }));

  assert.equal(posts.length, 2);
  assert.equal(posts[0].url, SLACK.SLACK_SPONSORSHIP_WEBHOOK_URL);
  assert.equal(posts[0].method, "post");
  assert.equal(posts[0].body.text, [
    ":handshake: *New sponsor inquiry:* Navy",
    "Grace Hopper (grace@example.com) \u00b7 CTO",
    "Interested in: Venue host",
    "> Line one\n> Line two",
    "<https://docs.google.com/spreadsheets/d/SHEET/edit#gid=111|Open the Sponsorship tab>",
  ].join("\n"));

  assert.equal(posts[1].url, SLACK.SLACK_SPEAKERS_WEBHOOK_URL);
  assert.match(posts[1].body.text, /^:microphone: \*New talk proposal:\* \u201cEngines\u201d/);
  assert.match(posts[1].body.text, /Format: Lightning talk/);
  assert.match(posts[1].body.text, /#gid=222\|Open the Speakers tab>$/);
});

test("the invoicing step posts to the sponsorship channel", () => {
  const { post, posts, context, select } = load({ ...INVOICE, props: SLACK });
  post(sponsor());
  select("Sponsorship", 2);
  context.confirmSelectedSponsor();
  assert.equal(posts.length, 2);
  assert.equal(posts[1].url, SLACK.SLACK_SPONSORSHIP_WEBHOOK_URL);
  assert.match(posts[1].body.text, /^:receipt: \*Invoice requested:\* Navy for the Thursday, November 19 event \(Event sponsor, \$500\)/);
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
