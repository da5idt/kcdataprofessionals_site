// Offline tests for Code.gs, with Google's services replaced by fakes.
// Run from the repo root:  node --test apps-script/code.test.js

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const SOURCE = fs.readFileSync(path.join(__dirname, "Code.gs"), "utf8");

function load({ props = {}, mailThrows = false } = {}) {
  const sent = [];
  const sheets = {};
  const cache = {};
  const properties = { TEAM_EMAILS: "a@kcdp.org, b@kcdp.org,c@kcdp.org", ...props };

  const makeSheet = (name) => {
    const rows = [];
    return {
      name, rows,
      getLastRow: () => rows.length,
      appendRow: (row) => rows.push(row.slice()),
      setFrozenRows() {},
      getRange: (r, c) => ({
        setFontWeight() { return this; },
        setValue: (v) => { rows[r - 1][c - 1] = v; },
      }),
    };
  };

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
      getActiveSpreadsheet: () => ({
        getSheetByName: (n) => sheets[n] || null,
        insertSheet: (n) => (sheets[n] = makeSheet(n)),
      }),
    },
    DriveApp: {
      getFileById: (id) => ({
        getAs: (mime) => ({ id, mime, setName(n) { this.name = n; return this; } }),
      }),
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
  return { post, sent, sheets, properties };
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

test("speaker submission is stored and emailed to the speaker with the team copied", () => {
  const { post, sent, sheets } = load();
  assert.deepEqual(post(speaker()), { ok: true });

  const rows = sheets.Speakers.rows;
  assert.equal(rows[0][0], "Submitted");
  assert.equal(rows[0].at(-1), "Team notes");
  assert.equal(rows[1][1], "New");
  assert.equal(rows[1][6], "Engines");

  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, "ada@example.com");
  assert.equal(sent[0].cc, "a@kcdp.org,b@kcdp.org,c@kcdp.org");
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

test("unknown forms and a missing TEAM_EMAILS fail safely", () => {
  assert.equal(load().post({ form: "other", _js: "1" }).ok, false);
  const { post, sent } = load({ props: { TEAM_EMAILS: "" } });
  assert.deepEqual(post(speaker()), { ok: false });
  assert.equal(sent.length, 0);
});

test("plain (no-JavaScript) posts get an HTML confirmation page", () => {
  const { post } = load();
  const page = post({ ...speaker(), _js: undefined, _elapsed: undefined });
  assert.match(page.html, /Thanks!/);
});
