# Annual interpretation

AP 07 adds `POST /annual-plans/interpret`, separate from calculation and Search
interpretation. It accepts text (1–4,000 characters), the selected year and captured
local date. The configured Gemini or xAI provider returns a strict proposal. Missing
scalar/mix/month values are omitted from the wire response; explicit zero and empty
months remain present. Calendar settings and saved records are never sent as part of
this request. The endpoint does not create an annual run or call the planner.

Proposals can include year, available leave, reserve, start months, gap, labeled slot
ranges and explicit dates. Unresolved references and disclosed preset assumptions
remain separate. Invalid provider output gives a sanitized error; no configured key
leaves all structured fields usable.

The browser shows before/after values before Apply. Applying changes edits the draft,
marks prior results stale and never calculates. A changed draft invalidates the review.
A replacement mix requires explicit mapping of every existing lock; unmapped or duplicate
assignments cannot apply. Reference resolution reads saved vacations locally, requires
explicit date selection and slot assignment even for a single item, and also allows
manual dates. The original bookmark is unchanged. Dates must fit the target range;
users can discard the proposal and edit the structured range when needed.

Verification: six backend tests at the interpreter/HTTP seams, five rendered browser
journeys, full PostgreSQL backend suite (269 tests), full frontend suite (99 tests),
Ruff, formatting, mypy, ESLint, TypeScript and production build. Model tests use the
provider test adapter; they do not call a live model or establish extraction quality
for arbitrary language.
