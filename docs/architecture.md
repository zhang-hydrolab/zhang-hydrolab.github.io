# Architecture

## The boundary

The front end and back end share one thing: the versioned JSON API at `/api/v1/`. The front end
never reads the database, and the back end knows nothing about HTML.

| Part | Responsibility | Runs |
| --- | --- | --- |
| `backend/` | Validation, storage, revisions, snapshots, media, admin UI | On a maintainer's machine or a lab server |
| `frontend/` | Turns the API and media into static pages | At build time only |
| `scripts/publish.mjs` | Export, snapshot, build, verify, copy to the repository root | At publish time |

The API has nine files: `meta`, `site`, `people`, `publications`, `news`, `datasets`, `research`,
`collaborators` and `media`. `meta.json` carries `schemaVersion`. Add fields freely; change or
remove one only with a new version.

GitHub Pages deploys this repository's root from `main`, so generated files have to be committed
there. `.published.json` lists them, which lets a publish remove stale files without touching
anything else. To stop committing generated output, switch Settings -> Pages to GitHub Actions and
add a deploy workflow.

The live site is static. The back end is not hosted, so the admin only runs where someone starts it.

## Storage

There are three layers, each for a different job.

| Layer | Location | In git | Role |
| --- | --- | --- | --- |
| SQLite | `backend/var/lab.sqlite` | No | Working database. Rebuilt whenever it is missing or stale |
| Content | `backend/content/*.ndjson` | Yes | Source of truth. One sorted record per line, so diffs and merges stay readable |
| Archive | `backend/archive/` | Yes | History, snapshots and original files |

Every write goes to SQLite and the NDJSON files together. After a `git pull`, the content hash no
longer matches and the database rebuilds itself, so it never needs syncing by hand.

SQLite runs with `journal_mode=DELETE` because WAL files do not survive OneDrive sync well. If the
repository lives in a synced folder and the database causes trouble, set `LAB_DB_PATH` to move it.

## The archive

- **Soft archive.** Every record is `draft`, `published` or `archived`. Only `published` reaches the
  API. Deleting requires archiving first.
- **Revisions.** `archive/revisions.ndjson` is an append-only log of each change with before and
  after values, so any change can be rolled back, including a deletion.
- **Snapshots.** `archive/releases/<id>.json.gz` holds a full checksummed copy of the content, and
  each publish saves one if anything changed. `release:verify` checks them all.
- **Media.** `archive/media/<ab>/<sha256>.<ext>` keeps originals, addressed by content hash, so
  uploading a file twice stores it once and nothing is ever overwritten.

## Adding a field

`backend/src/entities.mjs` defines every content type. The validator and the admin forms are both
generated from it, so a new field takes three steps:

1. Add a migration in `backend/migrations/`.
2. Add one line to the entity in `entities.mjs`.
3. Expose it in `backend/src/export.mjs` and use it in `frontend/src/views/`.

## Security

The admin has no public deployment. It binds to loopback and refuses to bind elsewhere without
`LAB_ADMIN_TOKEN`. Because any website can reach a loopback address from a visitor's browser, a
local bind alone is not enough, so the server also:

- allow-lists the `Host` header, which blocks DNS rebinding;
- checks `Origin` and `Sec-Fetch-Site` on every write, and requires a JSON content type;
- serves the admin under a strict CSP with no inline script or style;
- sniffs uploads by magic bytes and rejects SVG, which can carry script;
- accepts only `http`, `https` and `mailto` links, because links render into public pages.

The admin builds its DOM with `textContent`, and the generator escapes every interpolated value.

To run the admin on a shared server, set `LAB_HOST`, `LAB_ADMIN_TOKEN` and `LAB_ALLOWED_HOSTS`, and
put it behind HTTPS.

## Front end

There are no runtime dependencies and no third-party requests, partly because CDNs and Google Fonts
are unreliable from mainland China. Mona Sans and JetBrains Mono are self-hosted; Chinese text uses
system fonts, since a CJK webfont would add megabytes. The build needs only esbuild and sharp.

Pages are complete HTML with both languages present. `html[data-lang]` picks one, so content works
without JavaScript. Behaviour lives in `src/client/modules/`, one file for each `data-module` value,
loaded as the element nears the viewport.

The design treats the water cycle as the system: cobalt is liquid water, lime is vapour, coral is
warming. It is flat by rule, with no shadows or gradients. Things you press are round; things you
read are square. All motion honours `prefers-reduced-motion`.

`lib/budget.mjs` computes the water-budget chart. It is pure, so the static page and the browser
draw the same geometry. Land-cover and flow-partition detail is published for the historical period
only, so that column fades out for the future scenario rather than showing invented values.

## Checks

`frontend/test/check-site.mjs` runs on every publish and blocks it on broken links or anchors,
missing assets, missing alt text or descriptions, third-party scripts, markup leaked into
attributes, and banned strings from the old template. CI runs the back-end tests and a full build.
