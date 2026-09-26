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
The configured language-model provider used only to turn conversational text into an editable search or annual planning proposal. It does not choose vacation windows or start a calculation.
_Avoid_: Recommendation engine, search provider

**Annual plan**:
A coordinated set of vacation windows within one calendar year, assessed together against one effective calendar and one shared leave budget. It does not book, deduct, or approve leave.
_Avoid_: Saved option, annual entitlement, approved schedule

**Shared leave budget**:
The vacation days the person makes available for all future breaks included in an annual plan, including its locked breaks.
_Avoid_: Full-year entitlement, forecast balance

**Leave reserve**:
The part of the shared leave budget protected from allocation to planned breaks. It remains part of the plan's remaining balance.
_Avoid_: Extra allowance, spent leave

**Requested mix**:
The person's requested set of breaks and their length ranges, including any locked breaks.
_Avoid_: Additional trips, independent search results

**Break slot**:
One requested break within a mix, filled by a generated vacation window or exact locked dates.
_Avoid_: Recommendation rank, saved option

**Locked break**:
A break whose exact start and end dates the person has chosen to preserve during annual recalculation. Its vacation-day cost still follows the plan's current effective calendar.
_Avoid_: Approved leave, fixed leave cost, personal day off

**Reduced plan**:
A feasible annual plan that explicitly omits one or more requested unlocked breaks while preserving every lock and the leave reserve.
_Avoid_: Full plan, best effort result, partially calculated plan

**Unallocated leave**:
The remaining vacation days above the protected reserve after all breaks in an annual plan are counted.
_Avoid_: Remaining balance, entitlement

**Annual planning proposal**:
Editable annual planning fields inferred from optional conversational text, with unresolved references left for the person to resolve.
_Avoid_: Annual plan, executed request
