# Vacation Window Planning

This glossary names the date and leave concepts used by the vacation recommendation product.

## Language

**Vacation window**:
A continuous interval of local calendar dates, including both its start and end date, proposed as time away from work.
_Avoid_: Trip dates, PTO window

**Total days off**:
The count of consecutive local calendar dates in a vacation window, including weekends and observed holidays at either edge.
_Avoid_: Vacation days used, PTO days

**Vacation days used**:
The count of effective working dates within a vacation window that are charged against the user's vacation balance.
_Avoid_: Total days off, trip length

**Allowed negative balance**:
The maximum number of whole vacation days the user explicitly permits a recommendation to exceed the current balance.
_Avoid_: Overdraft, borrowed PTO

**Selected month**:
A month in which the user permits a recommended vacation window to start; its end may fall in a later month.
_Avoid_: Search boundary, travel month

**Zero-PTO window**:
A vacation window that uses no vacation days because none of its dates are effective working dates.
_Avoid_: Free vacation

**Effective calendar**:
The working and nonworking dates applicable to a vacation calculation after observed holidays, the user's weekend pattern, and any personal date overrides are applied.
_Avoid_: Provider calendar, public-holiday list

**Personal day off**:
A date the user says is nonworking without consuming vacation balance, regardless of the normal workweek or public-holiday calendar.
_Avoid_: Vacation day, mandatory leave

**Extra working day**:
A date the user says is working even when the normal workweek or public-holiday calendar would make it nonworking. Including it in a vacation window consumes one vacation day.
_Avoid_: Removed holiday, exception day

**Unavailable range**:
An inclusive range of local dates that a recommended vacation window must not intersect. Unavailability does not change whether a date consumes vacation balance.
_Avoid_: Company closure, paid day off

**Minimum notice**:
The number of whole calendar days required between the user's local today and the start of a recommended vacation window.
_Avoid_: Working-day notice, approval deadline

**Vacation opportunity**:
A qualifying future vacation window outside the explicit search's selected months or full preferred-length tolerance, shown separately with its own score and explanation.
_Avoid_: Search result, flight deal

**Saved option**:
A retained snapshot of one exact vacation window, its calculation context, and its accounting. Saving an option does not reserve, deduct, or approve vacation days.
_Avoid_: Booked vacation, annual plan, approved leave

**Default workweek**:
The temporary country-based weekday rule used when proposing weekend days: Israel works Sunday through Thursday (Friday/Saturday weekend); all other countries work Monday through Friday (Saturday/Sunday weekend). This default is separate from observed public holidays and can be overridden by the user's editable weekday selection.
_Avoid_: Holiday calendar, immutable country rule

**Search proposal**:
Editable vacation-search fields inferred from optional conversational text before the user confirms a search.
_Avoid_: Search result, recommendation

**Interpretation provider**:
The configured language-model provider used only to turn conversational text into a search proposal. It does not choose vacation windows or start a search.
_Avoid_: Recommendation engine, search provider
