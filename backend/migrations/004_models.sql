-- Models: process models and their downloadable products (same shape as datasets).
CREATE TABLE models (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  summary_en     TEXT NOT NULL DEFAULT '',
  summary_zh     TEXT NOT NULL DEFAULT '',
  scope          TEXT NOT NULL DEFAULT '',
  variables      TEXT NOT NULL DEFAULT '',
  temporal       TEXT NOT NULL DEFAULT '',
  spatial        TEXT NOT NULL DEFAULT '',
  start_year     INTEGER,
  end_year       INTEGER,
  coverage_label TEXT NOT NULL DEFAULT '',
  downloads      TEXT NOT NULL DEFAULT '[]',
  citations      TEXT NOT NULL DEFAULT '[]',
  image_id       TEXT REFERENCES media(id),
  sort_order     INTEGER NOT NULL DEFAULT 100,
  status         TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft','published','archived')),
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL,
  archived_at    TEXT
);
