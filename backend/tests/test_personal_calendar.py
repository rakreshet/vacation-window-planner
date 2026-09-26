from datetime import date

import pytest
from hypothesis import given
from hypothesis import strategies as st
from pydantic import ValidationError

from vacation_window_planner.domain.personal_calendar import PersonalCalendar


def test_adjacent_personal_days_are_one_canonical_range() -> None:
    calendar = PersonalCalendar.model_validate(
        {
            "date_overrides": [
                {"start_date": "2027-01-07", "end_date": "2027-01-08", "kind": "personal_day_off"},
                {"start_date": "2027-01-06", "end_date": "2027-01-07", "kind": "personal_day_off"},
            ]
        }
    )
    assert len(calendar.date_overrides) == 1
    assert calendar.date_overrides[0].start_date == date(2027, 1, 6)
    assert calendar.date_overrides[0].end_date == date(2027, 1, 8)
    assert PersonalCalendar.model_validate_json(calendar.model_dump_json()) == calendar


def test_opposing_overrides_report_the_conflicting_field() -> None:
    import pytest
    from pydantic import ValidationError

    with pytest.raises(ValidationError) as error:
        PersonalCalendar.model_validate(
            {
                "date_overrides": [
                    {
                        "start_date": "2027-01-07",
                        "end_date": "2027-01-08",
                        "kind": "personal_day_off",
                    },
                    {
                        "start_date": "2027-01-08",
                        "end_date": "2027-01-09",
                        "kind": "extra_working_day",
                    },
                ]
            }
        )
    assert error.value.errors()[0]["loc"] == ("date_overrides",)


def test_merged_long_ranges_remain_bounded_and_round_trip() -> None:
    calendar = PersonalCalendar.model_validate(
        {
            "date_overrides": [
                {"start_date": "2027-01-01", "end_date": "2027-12-31", "kind": "personal_day_off"},
                {"start_date": "2028-01-01", "end_date": "2028-12-31", "kind": "personal_day_off"},
            ],
            "unavailable_ranges": [
                {"start_date": "2027-01-01", "end_date": "2027-12-31"},
                {"start_date": "2028-01-01", "end_date": "2028-12-31"},
            ],
        }
    )
    assert [(r.start_date, r.end_date) for r in calendar.date_overrides] == [
        (date(2027, 1, 1), date(2028, 1, 1)),
        (date(2028, 1, 2), date(2028, 12, 31)),
    ]
    assert [(r.start_date, r.end_date) for r in calendar.unavailable_ranges] == [
        (date(2027, 1, 1), date(2028, 1, 1)),
        (date(2028, 1, 2), date(2028, 12, 31)),
    ]
    assert PersonalCalendar.model_validate_json(calendar.model_dump_json()) == calendar


@pytest.mark.parametrize(
    "start,end",
    [
        ("2027-01-02", "2027-01-01"),
        ("2027-01-01", "2028-01-02"),
        (1700000000, "2027-01-01"),
        ("2027-01-01T00:00:00", "2027-01-02"),
    ],
)
def test_invalid_date_ranges_are_rejected(start: object, end: object) -> None:
    with pytest.raises(ValidationError):
        PersonalCalendar.model_validate(
            {"unavailable_ranges": [{"start_date": start, "end_date": end}]}
        )


@pytest.mark.parametrize(
    "field,value",
    [
        ("schema_version", True),
        ("schema_version", 1.0),
        ("minimum_notice_days", True),
        ("minimum_notice_days", 1.5),
        ("minimum_notice_days", -1),
        ("minimum_notice_days", 91),
    ],
)
def test_calendar_version_and_notice_require_bounded_whole_numbers(
    field: str, value: object
) -> None:
    with pytest.raises(ValidationError):
        PersonalCalendar.model_validate({field: value})


@given(st.lists(st.tuples(st.integers(1, 300), st.integers(0, 65)), max_size=100))
def test_canonical_calendar_round_trips_without_losing_dates(ranges: list[tuple[int, int]]) -> None:
    from datetime import timedelta

    first = date(2027, 1, 1)
    submitted = [
        {
            "start_date": first + timedelta(days=start),
            "end_date": first + timedelta(days=start + length),
        }
        for start, length in ranges
    ]
    calendar = PersonalCalendar.model_validate({"unavailable_ranges": submitted})
    assert PersonalCalendar.model_validate_json(calendar.model_dump_json()) == calendar
    for offset in range(1, 366):
        day = first + timedelta(days=offset)
        assert any(start <= offset <= start + length for start, length in ranges) == any(
            rule.start_date <= day <= rule.end_date for rule in calendar.unavailable_ranges
        )
