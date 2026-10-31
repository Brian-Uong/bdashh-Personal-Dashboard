# Workbook schema

Preserve exact tab names. Row positions below are **1-based spreadsheet rows**. Coordinates are decimal degrees. Dates should be YYYY-MM-DD; the parser also accepts MM/DD/YYYY. No real records are included.

Download a blank XLSX from Setup, or have your agent create a workbook from dist/blank-workbook.json. Columns beyond the listed ones are ignored unless a parser explicitly looks them up by name.

## Networking Tracker

Headers: row 4. Records start: row 5.

| Column | Header |
|---|---|
| 1 | Date |
| 2 | Source / Event |
| 3 | Contact |
| 4 | Role |
| 5 | Organization |
| 6 | Status |
| 7 | Outreach Sent |
| 8 | Follow-Up Sent |
| 9 | Info Interview Scheduled |
| 10 | Notes |
| 11 | Relationship Next Steps |
| 12 | Added by |
| 13 | Connection priority |
| 14 | Why connect / fit assessment |
| 15 | Suggested connection message |
| 16 | Follow-up draft — after acceptance |
| 17 | Follow-up personalisation / sources |
| 18 | LinkedIn URL |
| 19 | Career / education overlap |
| 20 | Public activity / date / source |
| 21 | Profile sources / checked |
| 22 | Research limitations |
| 23 | Employer sponsorship evidence |
| 24 | Location / evidence |
| 25 | Last verified |
| 26 | Follow-up draft status |
| 27 | Outreach review status |
| 28 | Latitude |
| 29 | Longitude |
| 30 | Office address |

## Application Tracker

Headers: row 4. Records start: row 5.

| Column | Header |
|---|---|
| 1 | Date |
| 2 | Source |
| 3 | Company |
| 4 | Role |
| 5 | Location |
| 6 | Job Link |
| 7 | Contact |
| 8 | Deadline |
| 9 | Status |
| 10 | Notes |
| 11 | Next Step |
| 12 | Outcome |

## Interview Practice Tracker

Headers: row 4. Records start: row 5.

| Column | Header |
|---|---|
| 1 | Date |
| 2 | Session |
| 3 | Format |
| 4 | Partner |
| 5 | Topic |
| 6 | Minutes |
| 7 | Feedback |
| 8 | Next Step |

## Monthly Check-In

Headers: row 6. Records start: row 7.

| Column | Header |
|---|---|
| 1 | Month |
| 2 | Goal |
| 3 | Progress |
| 4 | Contacts |
| 5 | Applications |
| 6 | Practice |
| 7 | Notes |
| 8 | Events |
| 9 | Outreach |
| 10 | Follow-Ups |
| 11 | Next Steps |

## Potential Events

Headers: row 4. Records start: row 5.

| Column | Header |
|---|---|
| 1 | Event |
| 2 | Date |
| 3 | Time |
| 4 | Location |
| 5 | Organiser |
| 6 | Category |
| 7 | Registration Link |
| 8 | Free |
| 9 | Cost |
| 10 | Audience |
| 11 | Status |
| 12 | Registration Notes |
| 13 | Preparation |
| 14 | Contact |
| 15 | Source Notes |
| 16 | Follow-Up |
| 17 | Objective |
| 18 | Notes |
| 19 | Outcome |
| 20 | Deadline |
| 21 | Event Type |
| 22 | Target Company |
| 23 | Industry |
| 24 | Format |
| 25 | Capacity |
| 26 | Eligibility |
| 27 | Beginner Friendly |
| 28 | Checked |
| 29 | Event Summary |
| 30 | How it helps you |
| 31 | Latitude |
| 32 | Longitude |

## Start Here

Displayed as a raw table. See the JSON template for example structure. Dashboard target labels are read from column B and numeric targets from column D.

## Dashboard

Displayed as a raw table. See the JSON template for example structure. Dashboard target labels are read from column B and numeric targets from column D.

## Rubric Reference

Displayed as a raw table. See the JSON template for example structure. Dashboard target labels are read from column B and numeric targets from column D.

## Mapping rules

Networking contact fields use named headers, but activity counters also depend on the first columns. Keep both position and name intact. Company pins use optional Latitude, Longitude and Office address. Event filters use fixed positions, while event pins use optional Latitude/Longitude headers. Invalid coordinates do not map a record. Grouping contacts by company does not confirm that a person works at that particular office.

Spreadsheet connection is read-only. A displayed draft or copied message does not mean it was saved to Google Sheets or sent to anyone.

---

# Brian's Dash new personal tabs

Added to the blank workbook created from **Data & connections**. The original eight career/event tabs and their parser row positions are retained unchanged for backward compatibility. Unlike the original career tabs, the following four new tabs use **headers in spreadsheet row 1 and records starting row 2**. Their names are exact and case-sensitive.

| Sheet name | Headers, in order | Use |
|---|---|---|
| `Coursework` | Course, Assignment, Due Date, Status, Link, Notes | Assignments and due-date queue for the School workspace |
| `Daily Planner` | Date, Time, Task, Category, Status, Link, Notes | Planner entries and today counts |
| `Holdings` | Ticker, Company, Shares, Average Cost, Last Price, Price As Of, Notes | Imported position summaries, ticker news search links and as-of valuations |
| `Stock Research` | Date, Ticker, Thesis, Risks, Source URL | Optional **manually researched** daily idea; today-matching row overrides the static educational spotlight |

Dates should use `YYYY-MM-DD` or `MM/DD/YYYY` (Pacific Time for "today"). For `Coursework`, statuses `Done`, `Completed` and `Submitted` are excluded from upcoming deadline counts. For `Daily Planner`, `Done`, `Completed` and `Cancelled` are excluded from today's active count.

The `Holdings` sheet does **not** pull market data. If a row has a valid number of `Shares` and an imported `Last Price`, value = shares × price. A total is not displayed unless all imported positions have numeric quantities and prices. `Price As Of` is a user-provided date and should be checked for freshness. A dated research row is not treated as a real-time algorithmic recommendation.

**Holdings CSV import:** in the Investments workspace, select a positions export with `Ticker` or `Symbol` and `Shares`, `Quantity` or `Qty`. Optional `Name`, `Description`, `Average Cost`, `Current Price` are recognized. A transaction/activity CSV with `Action` and `Amount` but no share quantity is rejected, not converted to a holdings snapshot. CSV import replaces only the local `Holdings` tab after confirmation and requires Export to save a workbook copy. No brokerage session or API sync.
