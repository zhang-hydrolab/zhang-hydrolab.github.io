# Large Scale Hydrology

Website of the group led by Prof. Yongqiang Zhang (张永强) at IGSNRR, Chinese Academy of Sciences.

Live at <https://zhang-hydrolab.github.io/>.

## How it fits together

```text
backend/   Database, archive and admin. The only place content is edited.
frontend/  Static site generator. Reads the public JSON API, never the database.
scripts/   publish.mjs connects the two and writes the finished site here.
```

```text
admin UI -> SQLite -> backend/content/*.ndjson -> /api/v1/*.json -> frontend -> repository root -> GitHub Pages
```

The HTML, `assets/`, `media/`, `news/` and `api/` at the repository root are generated. GitHub Pages
serves this repository's root, so they have to live here, but do not edit them by hand: the next
publish overwrites them.

## Common tasks

Needs Node.js 22.13 or newer.

```bash
npm run setup      # once: install the front-end build tools
npm run backend    # admin at http://127.0.0.1:8787/admin/
npm run dev        # preview the site at http://127.0.0.1:4173/
npm run publish -- --note "Added a 2026 paper"
npm test
```

After `npm run publish`, commit and push to `main`. The site updates within a few minutes.

## Documentation

- [内容维护指南](docs/content-guide.md): how to add papers, news and people.
- [Architecture](docs/architecture.md): how the parts work and why.
