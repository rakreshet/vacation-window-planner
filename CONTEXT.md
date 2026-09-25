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

**Search proposal**:
Editable vacation-search fields inferred from optional conversational text before the user confirms a search.
_Avoid_: Search result, recommendation
