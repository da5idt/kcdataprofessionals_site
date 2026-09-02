#!/usr/bin/env python3
"""Update the site's "Next Event" details from the Luma and Meetup event pages.

Both Luma and Meetup publish schema.org Event data as JSON-LD, so the title,
date, time and venue can be read straight off the event pages instead of being
retyped by hand each month.

Typical monthly use:

    python3 scripts/update_next_event.py \
        --luma https://luma.com/xxxxxxxx \
        --meetup https://www.meetup.com/kcdataprofessionals/events/000000000/

The script writes _data/next_event.yml (the single source of truth for the
"Next Event" card) and updates the hero "Register for Next Event" button in
_pages/index.html, which cannot read site data because Jekyll does not render
Liquid inside front matter.

Only the standard library is used, so there is nothing to install.
"""

from __future__ import annotations

import argparse
import datetime as dt
import gzip
import json
import re
import ssl
import sys
import urllib.error
import urllib.request
import zlib
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
DATA_FILE = REPO_ROOT / "_data" / "next_event.yml"
INDEX_FILE = REPO_ROOT / "_pages" / "index.html"

# The hero button lives in front matter, where Liquid does not run, so its URL
# is rewritten in place. Anchored on the label so the other buttons are safe.
HERO_ACTION_RE = re.compile(
    r'(- label: "Register for Next Event"\n\s+url: )(\S+)',
)

USER_AGENT = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)

# Zero-width spaces, bidi marks and the byte-order mark: invisible in the
# rendered page, but they travel with text pasted between apps.
INVISIBLE_RE = re.compile(r"[\u200b-\u200f\u202a-\u202e\u2060\ufeff]")

# "Ryan Day is the author of ..." — how speaker bios are written on the event
# pages. Neither site exposes the speaker as structured data, so this is a
# best-effort guess that is always printed for review and can be overridden.
SPEAKER_RE = re.compile(
    r"^([A-Z][a-zA-Z.'’-]+(?: [A-Z][a-zA-Z.'’-]+){1,2}) "
    r"(?:is|was) (?:a|an|the) ",
    re.MULTILINE,
)


class EventError(Exception):
    """Anything that should stop the run with a readable message."""


# --------------------------------------------------------------------------- #
# Fetching
# --------------------------------------------------------------------------- #

def fetch(url: str, timeout: int = 30) -> str:
    """Fetch a URL and return its decoded body."""
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": USER_AGENT,
            "Accept": "text/html,application/xhtml+xml",
            "Accept-Language": "en-US,en;q=0.9",
        },
    )
    try:
        with urllib.request.urlopen(
            request, timeout=timeout, context=ssl.create_default_context()
        ) as response:
            body = response.read()
            encoding = (response.headers.get("Content-Encoding") or "").lower()
    except urllib.error.HTTPError as exc:
        raise EventError(f"{url} returned HTTP {exc.code} {exc.reason}") from exc
    except urllib.error.URLError as exc:
        raise EventError(f"could not reach {url}: {exc.reason}") from exc

    if encoding == "gzip":
        body = gzip.decompress(body)
    elif encoding == "deflate":
        body = zlib.decompress(body)
    return body.decode("utf-8", "replace")


def json_ld_event(html: str, url: str) -> dict:
    """Pull the schema.org Event object out of a page's JSON-LD blocks."""
    blocks = re.findall(
        r'<script[^>]*type="application/ld\+json"[^>]*>(.*?)</script>',
        html,
        re.S,
    )
    for block in blocks:
        try:
            parsed = json.loads(block.strip())
        except json.JSONDecodeError:
            continue
        for item in parsed if isinstance(parsed, list) else [parsed]:
            if isinstance(item, dict) and item.get("@type") == "Event":
                return item
    raise EventError(
        f"no schema.org Event data found on {url} — the page layout may have "
        f"changed, or the event may be private. Pass the details explicitly "
        f"(see --help)."
    )


# --------------------------------------------------------------------------- #
# Formatting
# --------------------------------------------------------------------------- #

def parse_timestamp(value: str, source: str) -> dt.datetime:
    """Parse an ISO 8601 timestamp, tolerating Z and fractional seconds."""
    try:
        return dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise EventError(f"unreadable {source} timestamp {value!r}") from exc


def format_date(start: dt.datetime) -> str:
    """Thursday, August 27"""
    return f"{start:%A}, {start:%B} {start.day}"


def format_clock(moment: dt.datetime, with_meridiem: bool) -> str:
    hour = moment.hour % 12 or 12
    text = f"{hour}:{moment:%M}"
    return f"{text} {moment:%p}" if with_meridiem else text


def format_time(start: dt.datetime, end: dt.datetime | None, tz_label: str) -> str:
    """5:30-7:00 PM CT, or 11:30 AM-1:00 PM CT when the meridiem changes."""
    if end is None:
        return f"{format_clock(start, True)} {tz_label}"
    same_meridiem = start.strftime("%p") == end.strftime("%p")
    start_text = format_clock(start, not same_meridiem)
    return f"{start_text}–{format_clock(end, True)} {tz_label}"


def timezone_label(start: dt.datetime, override: str | None) -> str:
    """The site writes times as CT, so daylight saving needs no special case."""
    if override:
        return override
    offset = start.utcoffset()
    if offset is None:
        return "CT"
    hours = offset.total_seconds() / 3600
    return {-5.0: "CT", -6.0: "CT", -4.0: "ET", -7.0: "MT", -8.0: "PT"}.get(hours, "CT")


def format_venue(event: dict) -> str:
    """KC Digital Drive, Kansas City, MO"""
    location = event.get("location") or {}
    if isinstance(location, list):
        location = location[0] if location else {}
    if not isinstance(location, dict):
        return ""

    address = location.get("address") or {}
    if not isinstance(address, dict):
        address = {}

    parts = []
    name = (location.get("name") or "").strip()
    street = (address.get("streetAddress") or "").strip()
    # Luma often names the place after its street address; don't say it twice.
    if name and not (street and street.startswith(name)):
        parts.append(name)

    city = (address.get("addressLocality") or "").strip()
    region = (address.get("addressRegion") or "").strip()
    if len(region) > 2:  # Luma writes "Missouri" where the site writes "MO".
        region = {"missouri": "MO", "kansas": "KS"}.get(region.lower(), region)
    if city:
        parts.append(city)
    if region:
        parts.append(region)
    return ", ".join(parts)


def detect_speaker(*descriptions: str) -> str:
    for description in descriptions:
        if not description:
            continue
        match = SPEAKER_RE.search(description)
        if match:
            return match.group(1)
    return ""


def clean_text(value: str) -> str:
    """Tidy a value copied off an event page for display on the site.

    Organizers paste titles in from elsewhere, so they arrive carrying
    zero-width and bidi characters that are invisible here but would show up
    as stray marks in the page source. Python's \\s does not match them, so
    they are removed by name. Capitalisation is left alone.
    """
    value = INVISIBLE_RE.sub("", value).replace("\u00a0", " ")
    return re.sub(r"\s+", " ", value).strip()


# --------------------------------------------------------------------------- #
# Files
# --------------------------------------------------------------------------- #

def render_yaml(fields: dict) -> str:
    lines = [
        "# Next Event details shown on the home page.",
        "#",
        "# Generated by scripts/update_next_event.py — run that instead of",
        "# editing by hand so the hero button and this file stay in sync:",
        "#",
        "#   python3 scripts/update_next_event.py --luma <url> --meetup <url>",
        "",
    ]
    for key, value in fields.items():
        lines.append(f"{key}: {json.dumps(value, ensure_ascii=False)}")
    return "\n".join(lines) + "\n"


def read_yaml(path: Path) -> dict:
    """Read the flat key/value file this script writes."""
    if not path.exists():
        return {}
    fields = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        match = re.match(r'^([a-z_]+): (.*)$', line)
        if not match:
            continue
        key, raw = match.group(1), match.group(2).strip()
        try:
            fields[key] = json.loads(raw) if raw.startswith('"') else raw
        except json.JSONDecodeError:
            fields[key] = raw.strip('"')
    return fields


def update_hero_button(text: str, luma_url: str) -> str:
    matches = HERO_ACTION_RE.findall(text)
    if len(matches) != 1:
        raise EventError(
            f'expected exactly one "Register for Next Event" action in '
            f"{INDEX_FILE.relative_to(REPO_ROOT)}, found {len(matches)}. "
            f"Update the hero button by hand, or restore the front matter."
        )
    return HERO_ACTION_RE.sub(lambda m: m.group(1) + luma_url, text, count=1)


# --------------------------------------------------------------------------- #
# Commands
# --------------------------------------------------------------------------- #

def gather(args: argparse.Namespace) -> dict:
    """Build the event fields from the event pages plus any overrides."""
    meetup_event: dict = {}
    luma_event: dict = {}

    if args.meetup:
        meetup_event = json_ld_event(fetch(args.meetup), args.meetup)
    if args.luma:
        luma_event = json_ld_event(fetch(args.luma), args.luma)

    # Meetup carries the talk title and the venue's name; Luma titles its pages
    # after the month ("Kansas City Data Professionals (August 2026)") and puts
    # the talk title on the first line of the description.
    luma_first_line = (luma_event.get("description") or "").strip().split("\n")[0]
    title = args.title or clean_text(
        meetup_event.get("name") or luma_first_line or ""
    )
    if not title:
        raise EventError("could not determine the event title; pass --title")

    start_raw = meetup_event.get("startDate") or luma_event.get("startDate")
    end_raw = meetup_event.get("endDate") or luma_event.get("endDate")
    if not start_raw:
        raise EventError("could not determine the start time; pass --date and --time")
    start = parse_timestamp(start_raw, "start")
    end = parse_timestamp(end_raw, "end") if end_raw else None

    # A mismatch means one of the two listings was not updated.
    other_start = luma_event.get("startDate") if meetup_event else None
    if other_start and parse_timestamp(other_start, "start") != start:
        print(
            f"  ! warning: Meetup starts {start_raw} but Luma starts {other_start}",
            file=sys.stderr,
        )

    venue = args.venue or format_venue(meetup_event) or format_venue(luma_event)
    venue = clean_text(venue)
    if not venue:
        raise EventError("could not determine the venue; pass --venue")

    speaker = args.speaker
    speaker_detected = False
    if speaker is None:
        speaker = clean_text(
            detect_speaker(
                luma_event.get("description") or "",
                meetup_event.get("description") or "",
            )
        )
        speaker_detected = bool(speaker)

    fields = {
        "title": title,
        "speaker": speaker,
        "date": args.date or format_date(start),
        "time": args.time or format_time(start, end, timezone_label(start, args.timezone)),
        "venue": venue,
        "luma_url": args.luma or "",
        "meetup_url": args.meetup or "",
        "starts_at": start.isoformat(),
    }
    fields["_speaker_detected"] = speaker_detected
    return fields


def command_update(args: argparse.Namespace) -> int:
    if not args.luma and not args.meetup:
        raise EventError("pass --luma and/or --meetup (see --help)")

    fields = gather(args)
    speaker_detected = fields.pop("_speaker_detected")

    print("Next event")
    print(f"  title   {fields['title']}")
    print(
        f"  speaker {fields['speaker'] or '(none)'}"
        + ("   <- auto-detected, check this" if speaker_detected else "")
    )
    print(f"  when    {fields['date']} · {fields['time']}")
    print(f"  where   {fields['venue']}")
    print(f"  luma    {fields['luma_url'] or '(unchanged/none)'}")
    print(f"  meetup  {fields['meetup_url'] or '(unchanged/none)'}")

    previous = read_yaml(DATA_FILE)
    if previous.get("starts_at"):
        previous_start = parse_timestamp(previous["starts_at"], "stored start")
        new_start = parse_timestamp(fields["starts_at"], "start")
        if new_start < previous_start:
            print(
                f"  ! warning: this event ({fields['date']}) is earlier than the "
                f"one already on the site ({previous.get('date')})",
                file=sys.stderr,
            )

    yaml_text = render_yaml(fields)
    index_text = INDEX_FILE.read_text(encoding="utf-8")
    new_index_text = (
        update_hero_button(index_text, fields["luma_url"])
        if fields["luma_url"]
        else index_text
    )

    if args.dry_run:
        print("\n--- would write _data/next_event.yml ---")
        print(yaml_text, end="")
        if new_index_text != index_text:
            print("--- would update the hero button in _pages/index.html ---")
        print("\nDry run: nothing written.")
        return 0

    DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    DATA_FILE.write_text(yaml_text, encoding="utf-8")
    if new_index_text != index_text:
        INDEX_FILE.write_text(new_index_text, encoding="utf-8")

    # Confirm both edit points agree, so a half-applied update can't ship.
    if fields["luma_url"]:
        written = INDEX_FILE.read_text(encoding="utf-8")
        if fields["luma_url"] not in written:
            raise EventError("the hero button was not updated; check _pages/index.html")

    print("\nWrote _data/next_event.yml and updated the hero button.")
    print("Review with: git diff")
    return 0


def command_check(_args: argparse.Namespace) -> int:
    """Report whether the event on the site has already happened."""
    fields = read_yaml(DATA_FILE)
    if not fields.get("starts_at"):
        print("No event recorded in _data/next_event.yml.")
        return 1

    start = parse_timestamp(fields["starts_at"], "stored start")
    now = dt.datetime.now(tz=start.tzinfo)
    print(f"{fields.get('title', '(untitled)')}")
    print(f"  {fields.get('date')} · {fields.get('time')}")
    if start < now:
        days = (now - start).days
        print(f"  STALE: this event was {days} day(s) ago. Time to update the site.")
        return 1
    print(f"  Upcoming in {(start - now).days} day(s).")
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--luma", help="Luma event URL, e.g. https://luma.com/abc12345")
    parser.add_argument("--meetup", help="Meetup event URL")
    parser.add_argument(
        "--check",
        action="store_true",
        help="report whether the event on the site has already passed, and exit",
    )
    parser.add_argument("--dry-run", action="store_true", help="show changes without writing")

    overrides = parser.add_argument_group(
        "overrides",
        "Use these when a page is private, its layout changed, or the scraped "
        "value reads badly on the site.",
    )
    overrides.add_argument("--title", help='e.g. "Designing APIs for Real Users"')
    overrides.add_argument(
        "--speaker",
        help='e.g. "Ryan Day"; pass "" to leave the speaker line off entirely',
    )
    overrides.add_argument("--date", help='e.g. "Thursday, August 27"')
    overrides.add_argument("--time", help='e.g. "5:30–7:00 PM CT"')
    overrides.add_argument("--venue", help='e.g. "KC Digital Drive, Kansas City, MO"')
    overrides.add_argument("--timezone", help='time zone label, default "CT"')

    args = parser.parse_args(argv)
    try:
        return command_check(args) if args.check else command_update(args)
    except EventError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
