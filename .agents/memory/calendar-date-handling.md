---
name: Calendar date handling
description: Date-range rules for Google Calendar events used by the Casa Juquehy booking calendar.
---

Calendar events can be all-day or timed. The booking calendar represents one selectable night per date, so a timed event whose start and end fall on the same local calendar day must occupy that day rather than producing an empty range.

**Why:** Google Calendar owners may create confirmed blocks with a time range instead of an all-day event; treating the end date as exclusive without a same-day guard creates false availability.

**How to apply:** Whenever availability is derived from Calendar event timestamps, convert them to the property's local date first and ensure a same-day timed event gets a one-day exclusive end.