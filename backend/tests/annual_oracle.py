from datetime import date, timedelta
from itertools import product

from vacation_window_planner.domain.annual import AnnualRequest


def exhaustive_plan(
    request: AnnualRequest,
    working: set[date],
    unavailable: set[date],
    spendable: int,
    earliest: date,
    horizon_end: date,
    *,
    fewest_leave: bool = False,
    previous: tuple[tuple[tuple[date, date], ...], ...] = (),
) -> tuple[tuple[date, date], ...] | None:
    choices: list[list[tuple[date, date, set[date]]]] = []
    for slot in request.slots:
        options: list[tuple[date, date, set[date]]] = []
        if slot.locked_dates:
            starts = [slot.locked_dates.start_date]
            lengths = [(slot.locked_dates.end_date - slot.locked_dates.start_date).days + 1]
        else:
            starts = [
                earliest + timedelta(days=offset)
                for offset in range((horizon_end - earliest).days + 1)
            ]
            lengths = list(range(slot.min_days, slot.max_days + 1))
        for start in starts:
            if slot.locked_dates is None and start.month not in request.allowed_start_months:
                continue
            for length in lengths:
                end = start + timedelta(days=length - 1)
                covered = {start + timedelta(days=offset) for offset in range(length)}
                if end <= horizon_end and not covered & unavailable:
                    options.append((start, end, covered))
        choices.append(options)
    ranked: list[tuple[int, int, tuple[tuple[date, date], ...], tuple[int, ...]]] = []
    for combination in product(*choices):
        ordered = sorted(enumerate(combination), key=lambda entry: entry[1][0])
        valid = True
        for (_, left), (_, right) in zip(ordered, ordered[1:], strict=False):
            if (right[0] - left[1]).days - 1 < request.minimum_gap_days:
                valid = False
            if not any(left[1] < day < right[0] for day in working):
                valid = False
        if not valid:
            continue
        covered = set().union(*(item[2] for item in combination))
        spent = len(covered & working)
        candidate_dates = tuple((item[0], item[1]) for _, item in ordered)
        novel = all(
            any(
                all(
                    2
                    * len(
                        set(range(start.toordinal(), end.toordinal() + 1))
                        & set(range(old_start.toordinal(), old_end.toordinal() + 1))
                    )
                    < min((end - start).days + 1, (old_end - old_start).days + 1)
                    for old_start, old_end in earlier
                )
                for start, end in candidate_dates
            )
            for earlier in previous
        )
        if spent <= spendable and novel:
            ranked.append(
                (
                    spent if fewest_leave else -len(covered),
                    -len(covered) if fewest_leave else spent,
                    tuple((item[0], item[1]) for _, item in ordered),
                    tuple(index for index, _ in ordered),
                )
            )
    if not ranked:
        return None
    return min(ranked)[2]


def exhaustive_alternatives(
    request: AnnualRequest,
    working: set[date],
    unavailable: set[date],
    spendable: int,
    earliest: date,
    horizon_end: date,
) -> tuple[tuple[tuple[tuple[date, date], ...], ...], tuple[str, ...]]:
    from itertools import combinations

    for count in range(len(request.slots), 0, -1):
        for indices in combinations(range(len(request.slots)), count):
            if any(
                slot.locked_dates and index not in indices
                for index, slot in enumerate(request.slots)
            ):
                continue
            subset = request.model_copy(
                update={"slots": tuple(request.slots[index] for index in indices)}
            )
            first = exhaustive_plan(subset, working, unavailable, spendable, earliest, horizon_end)
            if first is None:
                continue
            plans = [first]
            for fewest in (True, False):
                additional = exhaustive_plan(
                    subset,
                    working,
                    unavailable,
                    spendable,
                    earliest,
                    horizon_end,
                    fewest_leave=fewest,
                    previous=tuple(plans),
                )
                if additional is None:
                    break
                plans.append(additional)
            return tuple(plans), tuple(slot.slot_id for slot in subset.slots)
    return (), ()
