#!/usr/bin/env python3
"""Offline tests for scripts/update_next_event.py.

Run with: python3 scripts/test_update_next_event.py
"""

import datetime as dt
import unittest

import update_next_event as u


def when(hour, minute=0, month=8, day=27, offset=-5):
    return dt.datetime(
        2026, month, day, hour, minute,
        tzinfo=dt.timezone(dt.timedelta(hours=offset)),
    )


class FormatDate(unittest.TestCase):
    def test_weekday_month_and_day_without_padding(self):
        self.assertEqual(u.format_date(when(17, 30)), "Thursday, August 27")

    def test_single_digit_day_is_not_zero_padded(self):
        self.assertEqual(u.format_date(when(9, 0, month=9, day=3)), "Thursday, September 3")


class FormatTime(unittest.TestCase):
    def test_shared_meridiem_is_written_once(self):
        self.assertEqual(u.format_time(when(17, 30), when(19, 0), "CT"), "5:30–7:00 PM CT")

    def test_crossing_meridiem_labels_both_ends(self):
        self.assertEqual(u.format_time(when(11, 30), when(13, 0), "CT"), "11:30 AM–1:00 PM CT")

    def test_noon_and_midnight_are_twelve_not_zero(self):
        self.assertEqual(u.format_time(when(12, 0), None, "CT"), "12:00 PM CT")
        self.assertEqual(u.format_time(when(0, 15), None, "CT"), "12:15 AM CT")

    def test_missing_end_time_shows_only_the_start(self):
        self.assertEqual(u.format_time(when(17, 30), None, "CT"), "5:30 PM CT")


class TimezoneLabel(unittest.TestCase):
    def test_central_is_ct_in_and_out_of_daylight_saving(self):
        self.assertEqual(u.timezone_label(when(17, offset=-5), None), "CT")
        self.assertEqual(u.timezone_label(when(17, offset=-6), None), "CT")

    def test_override_wins(self):
        self.assertEqual(u.timezone_label(when(17), "ET"), "ET")


class FormatVenue(unittest.TestCase):
    def test_meetup_shape_keeps_the_venue_name(self):
        event = {
            "location": {
                "name": "KC Digital Drive",
                "address": {
                    "streetAddress": "710 Central St, Kansas City, MO",
                    "addressLocality": "Kansas City",
                    "addressRegion": "MO",
                },
            }
        }
        self.assertEqual(u.format_venue(event), "KC Digital Drive, Kansas City, MO")

    def test_luma_shape_does_not_repeat_the_street_as_a_name(self):
        event = {
            "location": {
                "name": "710 Central St",
                "address": {
                    "streetAddress": "710 Central St",
                    "addressLocality": "Kansas City",
                    "addressRegion": "Missouri",
                },
            }
        }
        self.assertEqual(u.format_venue(event), "Kansas City, MO")

    def test_missing_location_is_empty_rather_than_an_error(self):
        self.assertEqual(u.format_venue({}), "")


class DetectSpeaker(unittest.TestCase):
    def test_finds_the_name_that_opens_a_bio(self):
        text = (
            "In this presentation you'll learn a lot.\n"
            "Ryan Day is the author of O'Reilly's Hands-on APIs for AI."
        )
        self.assertEqual(u.detect_speaker(text), "Ryan Day")

    def test_returns_empty_when_no_bio_pattern_is_present(self):
        self.assertEqual(u.detect_speaker("Come learn about APIs with us."), "")


class HeroButton(unittest.TestCase):
    front_matter = (
        '        - label: "Join on Meetup"\n'
        "          url: https://www.meetup.com/kcdataprofessionals/\n"
        '        - label: "Register for Next Event"\n'
        "          url: https://luma.com/oldoldold\n"
        "          blank: true\n"
    )

    def test_replaces_only_the_next_event_url(self):
        result = u.update_hero_button(self.front_matter, "https://luma.com/newnewnew")
        self.assertIn("url: https://luma.com/newnewnew", result)
        self.assertNotIn("oldoldold", result)
        self.assertIn("url: https://www.meetup.com/kcdataprofessionals/", result)

    def test_missing_anchor_fails_loudly(self):
        with self.assertRaises(u.EventError):
            u.update_hero_button('- label: "Something Else"\n  url: https://x/\n', "https://luma.com/a")


class YamlRoundTrip(unittest.TestCase):
    def test_values_survive_a_write_and_read(self):
        fields = {
            "title": 'A "quoted" title: with punctuation',
            "speaker": "Ryan Day",
            "date": "Thursday, August 27",
            "time": "5:30–7:00 PM CT",
            "venue": "KC Digital Drive, Kansas City, MO",
            "luma_url": "https://luma.com/z3mkfooe",
            "meetup_url": "https://www.meetup.com/kcdataprofessionals/events/1/",
            "starts_at": "2026-08-27T17:30:00-05:00",
        }
        text = u.render_yaml(fields)
        import pathlib, tempfile

        with tempfile.TemporaryDirectory() as tmp:
            path = pathlib.Path(tmp) / "next_event.yml"
            path.write_text(text, encoding="utf-8")
            self.assertEqual(u.read_yaml(path), fields)


class JsonLd(unittest.TestCase):
    def test_picks_the_event_out_of_several_blocks(self):
        html = (
            '<script type="application/ld+json">{"@type":"Organization"}</script>'
            '<script type="application/ld+json">[{"@type":"Event","name":"Talk"}]</script>'
        )
        self.assertEqual(u.json_ld_event(html, "x")["name"], "Talk")

    def test_page_without_event_data_explains_itself(self):
        with self.assertRaises(u.EventError):
            u.json_ld_event("<html></html>", "https://example.test/e")


if __name__ == "__main__":
    unittest.main(verbosity=2)
