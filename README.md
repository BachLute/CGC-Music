# Venue Contact Info Finder

Adds a follow-up "find the venue's official website, then check its
Contact/About/Staff pages for a phone and email" step to a Next.js App
Router + Postgres venue outreach app — as a manual per-venue button, a bulk
button, and an automatic step during discovery search runs.

## Assumptions this package makes

Since this was built without access to your actual codebase, it assumes:

- **`lib/db.ts`** exports a `query(text, params) => Promise<{ rows: T[] }>`
  function (the common `pg`-Pool-wrapper pattern).
- Your **`venues` table** has at least these columns: `id`, `name`,
  `address`, `website`, `phone`, `email`.
- Import paths use relative paths (no `@/` alias assumed), so everything
  works regardless of your `tsconfig` path setup.

If any of these don't match your project, the fix is localized — see
"If your assumptions are wrong" below.

## New files (copy these in as-is)

```
lib/webSearch.ts                                    # web search helper (Google CSE)
lib/contactInfo.ts                                   # core lookup: website -> Contact/About/Staff -> phone/email
lib/venueContactService.ts                            # DB-integrated wrapper used by both API routes
lib/enrichVenueContact.ts                             # call this on new venues before INSERT (see edit #1 below)
app/api/venues/[id]/find-contact/route.ts             # POST: run lookup for one venue, save result
app/api/venues/find-missing-contact/route.ts          # POST: run lookup for every venue missing phone/email
components/FindContactButton.tsx                      # per-row button
components/FindMissingContactButton.tsx                # bulk button
```

Merge these into your existing `lib/`, `app/api/`, and `components/`
folders.

## New dependency

```
npm install cheerio
```

(Used to parse venue homepages and find Contact/About/Staff links reliably.
Skip this if `cheerio` is already a dependency.)

## New environment variables

See `.env.local.additions.example`. Only needed if you keep
`lib/webSearch.ts`'s default Google Custom Search implementation — if your
app already has a search helper used by venue discovery, see below.

## Existing files that need a small edit

### Edit 1 — your "Run now" discovery search flow (requirement 4)

Find wherever your app currently loops over newly-discovered venues and
`INSERT`s them into the `venues` table (likely inside the API route your
"Run now" button calls, or a `lib/discoverVenues.ts`-style module). Add one
import and wrap each venue in `enrichVenueContact` right before the insert:

```ts
import { enrichVenueContact } from "../../../lib/enrichVenueContact"; // adjust the relative path

for (const venue of newlyFoundVenues) {
  const enriched = await enrichVenueContact(venue);
  await query(
    `INSERT INTO venues (name, address, website, phone, email, ...)
     VALUES ($1, $2, $3, $4, $5, ...)`,
    [enriched.name, enriched.address, enriched.website, enriched.phone, enriched.email /* ... */]
  );
}
```

`enrichVenueContact` is a no-op (returns the venue unchanged) if it already
has both a phone and email, so this only adds latency for venues that
actually need the follow-up search.

### Edit 2 — dashboard: per-row button (requirement 2)

In whatever component renders each venue's table row, add the button to
the row's action cell and use its callback to update that row's phone/email
in your local state:

```tsx
import { FindContactButton } from "../components/FindContactButton"; // adjust path

// inside the row:
<FindContactButton
  venueId={venue.id}
  onResult={(result) => {
    setVenues((prev) =>
      prev.map((v) =>
        v.id === venue.id
          ? { ...v, phone: v.phone || result.phone, email: v.email || result.email, website: v.website || result.website }
          : v
      )
    );
  }}
/>
```

### Edit 3 — dashboard: bulk button above the table (requirement 3)

Near your existing "Run now" button, add:

```tsx
import { FindMissingContactButton } from "../components/FindMissingContactButton"; // adjust path

<FindMissingContactButton onComplete={() => refetchVenues()} />
```

`refetchVenues` should be whatever function your dashboard already uses to
reload the venue list after a search run (or call `router.refresh()` if
that's how the page re-fetches server data).

## If your assumptions are wrong

- **Different `db.ts` shape** (Prisma, `@vercel/postgres` sql-tag, etc.): only
  `lib/venueContactService.ts` touches the database — its four queries are
  the only thing to rewrite.
- **Different column names**: same file, same four queries.
- **You already have a search helper**: delete `lib/webSearch.ts`, and in
  `lib/contactInfo.ts` change the import at the top:
  ```ts
  import { searchWeb } from "./webSearch";
  ```
  to point at your existing helper instead — it just needs to return
  `{ title, url, snippet }[]` for a query string.

## How the lookup works

1. If the venue already has a `website`, skip straight to step 2. Otherwise
   search `"<venue name>" <address> wedding venue official website` and
   take the first result that isn't a known aggregator/directory domain
   (Facebook, Yelp, WeddingWire, The Knot, Google, etc.).
2. Fetch that site's homepage, and find any links whose URL or link text
   matches "contact", "about", "staff", "team", "reach us", or "get in
   touch" (up to 3 such pages).
3. Scan the homepage and those subpages for `mailto:`/`tel:` links and
   phone/email patterns in the page text, filtering out obvious false
   positives (image-file "emails," tracking/CDN domains).
4. Save the first valid phone and email found, along with the URL they came
   from, without overwriting any phone/email the venue already has.

## Notes / things to consider

- The bulk endpoint runs sequentially with a short delay between venues to
  avoid hammering many different sites back-to-back. For a large venue
  list this can be slow and may exceed your hosting platform's request
  time limit (`maxDuration` is set generously but Vercel's Hobby plan caps
  at 60s regardless) — if that becomes a problem, move it to a background
  job/queue instead of a single request/response.
- Phone extraction assumes US-style numbers.
- This adds load to venues' own websites; the lookup is intentionally
  scoped to a handful of pages per venue rather than crawling the whole
  site.
