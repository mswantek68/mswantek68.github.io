---
title: Enriching list data with Flow and a public API
subtitle: A short walkthrough of adding value from external data sources.
date: 2019-11-20 08:00:00 -0700
---

When you have a list of records (addresses, companies, assets), it is often useful to enrich those rows with outside data. The basic idea is simple: take a key field from the list, call a public API, then write the returned fields back to the list.

Here is a compact outline of the approach I like:

1. Start with a clean list schema that separates address fields into distinct columns.
2. Pick an API that can return useful enrichment data for your key field.
3. Validate the API response in a tool like Postman before wiring it into Flow.
4. Build a Flow that triggers on new list items, calls the API, and parses the JSON.
5. Map the parsed values back into your list and update the item.

The main win is speed and consistency. Once this is set up, every new row can be enriched automatically, and you can easily pivot on those new fields later for reporting or search.

If you want me to expand this into a step-by-step example with a specific API, tell me which data source you want to enrich.
