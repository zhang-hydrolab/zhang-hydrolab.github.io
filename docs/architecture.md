# Architecture

## The boundary

The front end and back end share one thing: the versioned JSON API at `/api/v1/`. The front end
never reads the database, and the back end knows nothing about HTML.

| Part | Responsibility | Runs |
| --- | --- | --- |
| `backend/` | Validation, storage, revisions, snapshots, media, admin UI | On a maintainer's machine or a lab server |
| `frontend/` | Turns the API and media into static pages | At build time only |
| `scripts/publish.mjs` | Export, snapshot, build, verify, copy to the repository root | At publish time |

The API has ten files: `meta`, `site`, `people`, `publications`, `news`, `datasets`, `models`, `research`,
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
are unreliable from mainland China. Source Serif 4 and Source Sans 3 are self-hosted; Chinese text
uses system fonts, since a CJK webfont would add megabytes. The build needs only esbuild and sharp.

Pages are complete HTML with both languages present. `html[data-lang]` picks one, so content works
without JavaScript. The language is one choice for the whole site: a visit starts in English, and the
EN / 中文 switch in the header, or `?lang=zh|en` in a link, sets a session cookie `lab-lang` that an
inline script reads before the page is drawn (`LANG_BOOT` in `src/views/layout.mjs`). Dialogs clone
bilingual markup, so they follow the page. Other open tabs follow through a `BroadcastChannel`, and
`document.title` switches with `data-title-en` / `data-title-zh` on `<html>`.

`src/lib/scholarly.mjs` works out at build time what the publication list shows: journal metrics and
flagship order from `site.journal_metrics`, group papers (two or more author slots matching current
members or alumni, by family name and first initial, plus each person's `author_names`), and each
collaborator's joint papers (by `author_name`). Behaviour lives in `src/client/modules/`, one file for each `data-module` value.
A press that lands before its module has arrived is repeated once the module is running.
`src/client/motion.js` runs on every page and handles scroll entrances.

The design follows the conventions of a journal page: white paper, dark ink, hairline rules, one
institutional blue, and a serif for headings. Green appears only in charts, for green water. Tables
use horizontal rules only.

Page motion lives in `src/styles/motion.css` and `src/client/motion.js`. Every effect plays once and
ends within about a second. The first screen animates in plain CSS. Scroll entrances hide only what
is still below the window when the script runs, so a slow connection never shows a blank page. All
of it honours `prefers-reduced-motion`.

### 3D views

The Earth on the home page, the contour band behind the group's figures, the research views, the
water-cycle block in the budget section, the evapotranspiration globe on the data page and the
terrain block on the research page are raw WebGL2, with no library. `src/client/gl/core.js` holds the
shared parts, `globe.js` and `terrain.js` the two scene types, `drops.js` the rain and vapour, and
each view is a lazy module in `src/client/modules/`:

| Module | Where | What moves |
| --- | --- | --- |
| `earth` | Home hero | The globe turns; rivers pulse downstream |
| `contours` | Home metrics band | Contours of the 1 km relief drift east; offshore lines move seaward |
| `theme` (`flow`) | Home card, research page | Hengduan Mountains: rain, rising vapour, river pulses |
| `theme` (`flood`) | Home card, research page | Middle Yangtze in three acts: storm rain and lightning over the upper catchment; a water level over HAND rising to 24 m, with the share of land under water read from the same grid; a drought that dries the smaller streams first. A gauge near Shashi shows the level against flood and low-flow warning lines |
| `theme` (`scan`) | Home card, research page | Loess Plateau in three acts: a satellite reveals PML-V2.2 ET cell by cell; a neural network takes in values from the map; its forecast runs down the rivers |
| `watercycle` | Home, featured research | The budget's rain and vapour, scaled to the period shown |
| `etglobe` | Data page head | PML-V2.2 ET month by month on a turning globe |
| `pubring` | Publications page head | SVG: an arm turns round every paper and names it |
| `newsring` | News page head | CSS 3D: the latest twelve items as cards on a ring over a dial of water; it turns one card at a time and names the card in front |

`terrain.js` draws rivers with pulses of light water that travel towards the mouth, at a spacing of
about a seventh of the block. A view can draw over the ground with `scene.ground(program)`, which
redraws the same mesh; the flood and scan layers use it. In its `before` pass a view can set
`state.dry`, which dries the land towards pale sand and removes streams from the smallest up, and
`state.boost`, which brightens the river pulses. The research views draw their gauge, clouds,
lightning, satellite and network on a second, 2D canvas (`tv__overlay`), placed with
`scene.project`; their numbered acts are HTML, so they follow the language switch. The SVG views
and the news ring are complete without scripts; their modules only animate them.

The site's only continuous motion is in these views, and it follows these rules:

- Each WebGL view sits on a still image of itself, `<name>-still.webp` (the contour band, being
  decoration, sits on its gradient). No JavaScript, no WebGL, a software renderer, reduced motion
  and print all end on that image. The SVG views are their own still.
- The loop runs only while the view is on screen, the tab is visible and it is not paused. Every view
  has a pause button.
- A view starts when it comes within 500 px of the window, and resolution steps down if frames run
  slow. A machine that is still too slow at the lowest setting rests on the current frame.
- Scenes are drawn in white and blue. Red and amber mark only the gauge's warning lines, and pale
  sand only a drought. No view hides or recolours a photograph or a figure; the news ring turns its
  cards but never fades them, and shows each cover whole.

Everything drawn is measured or computed, or the caption says it is an illustration: rain, the
flood stage, the drought, the satellite, the network and the forecast are. Stills are made by `frontend/tools/render_stills.py`,
which needs the preview server running and Playwright with Edge. The data comes from
`frontend/tools/build_earth.py`:

| File in `src/public/earth/` | Source |
| --- | --- |
| `relief.webp` | Land elevation from a 1 km DEM, Antarctica from GEBCO 2023, sea shade from distance to the coast |
| `rivers.bin` | Priority-flood routing at 0.1° over the filled 1 km DEM; size is P − ET accumulated downstream |
| `<scene>.webp`, `<scene>.bin` | Elevation and routed rivers for one region, routed past its edges and cut there |
| `gorges-hand.webp` | Height above the nearest drainage (Nobre et al., 2011) for the flood view, as √(HAND / 120 m) |
| `loess-et.webp` | PML-V2.2 mean ET, 2001–2020, on 0.1° cells, for the scan view, as ET / 900 mm |
| `et-months.webp` | PML-V2.2 mean ET of each calendar month, 2001–2020, at 0.5°, four maps across and three down |
| `layer-*.webp` | The inputs on the home page: DEM, CRU TS 4.09 precipitation, PML-V2.2 ET, river flow |

Precipitation (CRU TS 4.09) and ET (PML-V2.2c, the official copy under
`M:/Public/Public/Data/Global/PML-V2.2/V2.2c`) are 2001–2020 means. PML-V2.2 file names for 1980,
1981 and 2025 repeat other years, so the script selects by the time axis. Terminal basins are a
curated list, `CLOSED_BASINS`, because pit detection also finds false ones on the main stems.

No coastline, lake or river dataset is used. Land and sea come from the DEM: the sea is where it has
no value, which inland is only the Caspian, and large lakes are their surface. Taking the lowest 1 km
cell of each 0.1° cell closes narrow gorges, such as the lower Congo and the Danube's Iron Gates,
because the channel zig-zags between coarse cells. So the 1 km DEM is first filled with a priority
flood (Barnes et al., 2014; `priority_fill`), and only then reduced to the lowest cell of each block
(`routing_surface`). Every cell then has a path to the sea that never climbs, and the network follows
the real valleys.

River size is an estimate, not gauged discharge, and the page says so. Global P − ET comes to
46.5 × 10³ km³/yr, against 39.1 ± 5.4 in the group's own budget. Mouth flows against published
values, km³/yr: Congo 1386 / 1300, Danube 243 / 210, Yangtze 933 / 900, Yenisei 623 / 620, Orinoco
1050 / 1100. They are low for the Amazon (5324 / 6600), Ganges–Brahmaputra (781 / 1100), Lena
(363 / 530) and Mekong (337 / 470), and high for the Paraná (1077 / 570), Mississippi (800 / 610) and
Ob (557 / 410). The Nile is far too high (541 against about 40), since P − ET is clipped at zero, so
evaporation from the Sudd and the reservoirs, channel losses and abstraction are not subtracted.

The collaboration map is flat and static: an Equal Earth projection centred on 150° E
(`src/lib/equal-earth.mjs`), so that every line from Beijing stays inside the frame. Land is Natural
Earth 1:110 m, cut at 30° W by `frontend/tools/build_worldmap.py` into `src/data/land.json`.
Coastlines only; the map draws no country borders.

Natural Earth, public domain, is used only for the collaboration map. CRU TS is credited with Harris
et al. (2020, Sci. Data 7, 109) in the figure caption on the home page. The inputs are large and local, so the outputs are committed;
rerun the scripts only to change them.

Images always show their true colours. CSS filters and blend modes are not used on anything, and
images are never faded: motion uncovers them with `clip-path` or moves them.
Scientific figures go through `fig()` in `views/parts.mjs`, which shows them whole with a zoom; only
photographs may be framed by `object-fit: cover`.

`lib/budget.mjs` computes the water-budget chart. It is pure, so the static page and the browser
draw the same geometry. Land-cover and flow-partition detail is published for the historical period
only, so that column fades out for the future scenario rather than showing invented values.

## Checks

`frontend/test/check-site.mjs` runs on every publish and blocks it on broken links or anchors,
missing assets, missing alt text or descriptions, third-party scripts, markup leaked into
attributes, CSS that changes image colour or runs an animation forever, a 3D view without its still
image, and banned strings from the old template. CI runs the back-end tests and a full build.
