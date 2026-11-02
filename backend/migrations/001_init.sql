-- Content schema for the Large Scale Hydrology website.
-- Every content table shares: status (draft | published | archived), created_at,
-- updated_at, archived_at. Only `published` rows reach the public API.

CREATE TABLE media (
  id          TEXT PRIMARY KEY,               -- first 16 hex characters of sha256
  sha256      TEXT NOT NULL UNIQUE,
  ext         TEXT NOT NULL,
  mime        TEXT NOT NULL,
  bytes       INTEGER NOT NULL,
  filename    TEXT NOT NULL,
  alt_en      TEXT NOT NULL DEFAULT '',
  alt_zh      TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft','published','archived')),
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  archived_at TEXT
);

CREATE TABLE people (
  id             TEXT PRIMARY KEY,
  name_en        TEXT NOT NULL,
  name_zh        TEXT NOT NULL DEFAULT '',
  honorific      TEXT NOT NULL DEFAULT '',
  role           TEXT NOT NULL CHECK (role IN ('pi','co_pi','postdoc','phd','master','assistant','visiting','alumni')),
  research_field TEXT NOT NULL DEFAULT '',
  bio_en         TEXT NOT NULL DEFAULT '',
  bio_zh         TEXT NOT NULL DEFAULT '',
  email          TEXT NOT NULL DEFAULT '',
  links          TEXT NOT NULL DEFAULT '[]',     -- JSON: [{label, url}]
  photo_id       TEXT REFERENCES media(id),
  photo_focus    TEXT NOT NULL DEFAULT '50% 25%',
  sort_order     INTEGER NOT NULL DEFAULT 100,
  status         TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft','published','archived')),
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL,
  archived_at    TEXT
);
CREATE INDEX idx_people_role ON people(role, sort_order);

CREATE TABLE publications (
  id         TEXT PRIMARY KEY,
  year       INTEGER NOT NULL,
  title      TEXT NOT NULL,
  authors    TEXT NOT NULL,
  venue      TEXT NOT NULL DEFAULT '',
  volume     TEXT NOT NULL DEFAULT '',
  issue      TEXT NOT NULL DEFAULT '',
  pages      TEXT NOT NULL DEFAULT '',
  doi        TEXT NOT NULL DEFAULT '',
  url        TEXT NOT NULL DEFAULT '',
  pdf_id     TEXT REFERENCES media(id),
  topics     TEXT NOT NULL DEFAULT '[]',         -- JSON: [string]
  featured   INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 100,
  status     TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft','published','archived')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  archived_at TEXT
);
CREATE INDEX idx_publications_year ON publications(year DESC, sort_order);
CREATE UNIQUE INDEX idx_publications_doi ON publications(doi) WHERE doi <> '';

CREATE TABLE news (
  id         TEXT PRIMARY KEY,
  year       INTEGER NOT NULL,
  date       TEXT NOT NULL DEFAULT '',           -- YYYY-MM-DD when known
  category   TEXT NOT NULL DEFAULT 'news' CHECK (category IN ('news','publication','award','event')),
  title_en   TEXT NOT NULL DEFAULT '',
  title_zh   TEXT NOT NULL DEFAULT '',
  summary_en TEXT NOT NULL DEFAULT '',
  summary_zh TEXT NOT NULL DEFAULT '',
  body_md    TEXT NOT NULL DEFAULT '',
  source_url TEXT NOT NULL DEFAULT '',
  cover_id   TEXT REFERENCES media(id),
  featured   INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 100,
  status     TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft','published','archived')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  archived_at TEXT
);
CREATE INDEX idx_news_year ON news(year DESC, sort_order);

CREATE TABLE datasets (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  summary_en     TEXT NOT NULL DEFAULT '',
  summary_zh     TEXT NOT NULL DEFAULT '',
  scope          TEXT NOT NULL DEFAULT '',       -- Global, China, ...
  variables      TEXT NOT NULL DEFAULT '',
  temporal       TEXT NOT NULL DEFAULT '',
  spatial        TEXT NOT NULL DEFAULT '',
  start_year     INTEGER,
  end_year       INTEGER,                        -- NULL means ongoing
  coverage_label TEXT NOT NULL DEFAULT '',
  downloads      TEXT NOT NULL DEFAULT '[]',     -- JSON: [{label, url}]
  citations      TEXT NOT NULL DEFAULT '[]',     -- JSON: [string]
  image_id       TEXT REFERENCES media(id),
  sort_order     INTEGER NOT NULL DEFAULT 100,
  status         TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft','published','archived')),
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL,
  archived_at    TEXT
);

CREATE TABLE research_themes (
  id         TEXT PRIMARY KEY,
  title_en   TEXT NOT NULL,
  title_zh   TEXT NOT NULL DEFAULT '',
  heading_en TEXT NOT NULL DEFAULT '',
  summary_en TEXT NOT NULL DEFAULT '',
  summary_zh TEXT NOT NULL DEFAULT '',
  image_id   TEXT REFERENCES media(id),
  accent     TEXT NOT NULL DEFAULT 'blue' CHECK (accent IN ('blue','lime','coral')),
  sort_order INTEGER NOT NULL DEFAULT 100,
  status     TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft','published','archived')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  archived_at TEXT
);

CREATE TABLE research_projects (
  id          TEXT PRIMARY KEY,
  theme_id    TEXT NOT NULL REFERENCES research_themes(id),
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  image_id    TEXT REFERENCES media(id),
  related     TEXT NOT NULL DEFAULT '[]',        -- JSON: [string]
  sort_order  INTEGER NOT NULL DEFAULT 100,
  status      TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft','published','archived')),
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  archived_at TEXT
);
CREATE INDEX idx_projects_theme ON research_projects(theme_id, sort_order);

CREATE TABLE collaborators (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  institute  TEXT NOT NULL DEFAULT '',
  city       TEXT NOT NULL DEFAULT '',
  lat        REAL,
  lon        REAL,
  bio        TEXT NOT NULL DEFAULT '',
  photo_id   TEXT REFERENCES media(id),
  sort_order INTEGER NOT NULL DEFAULT 100,
  status     TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft','published','archived')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  archived_at TEXT
);

-- Free-form site settings stored as JSON values (profile, contact, water budget ...).
CREATE TABLE settings (
  id         TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Append-only audit trail: every change stores the row before and after.
CREATE TABLE revisions (
  id         TEXT PRIMARY KEY,
  entity     TEXT NOT NULL,
  entity_id  TEXT NOT NULL,
  action     TEXT NOT NULL,
  before     TEXT,
  after      TEXT,
  author     TEXT NOT NULL DEFAULT 'admin',
  note       TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE INDEX idx_revisions_entity ON revisions(entity, entity_id, created_at DESC);

-- Index of immutable, checksummed snapshots held in archive/releases/.
CREATE TABLE releases (
  id           TEXT PRIMARY KEY,
  created_at   TEXT NOT NULL,
  note         TEXT NOT NULL DEFAULT '',
  content_hash TEXT NOT NULL,
  counts       TEXT NOT NULL DEFAULT '{}',
  file         TEXT NOT NULL,
  bytes        INTEGER NOT NULL,
  sha256       TEXT NOT NULL
);
