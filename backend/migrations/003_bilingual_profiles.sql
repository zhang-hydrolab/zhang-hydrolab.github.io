-- Collaborator profiles in both languages, with the details their profile sheet shows:
-- a title line, links, a gallery of visits (media ids) and the author name used to find
-- co-authored papers.
ALTER TABLE collaborators ADD COLUMN institute_zh TEXT NOT NULL DEFAULT '';
ALTER TABLE collaborators ADD COLUMN title_en TEXT NOT NULL DEFAULT '';
ALTER TABLE collaborators ADD COLUMN title_zh TEXT NOT NULL DEFAULT '';
ALTER TABLE collaborators ADD COLUMN bio_zh TEXT NOT NULL DEFAULT '';
ALTER TABLE collaborators ADD COLUMN author_name TEXT NOT NULL DEFAULT '';
ALTER TABLE collaborators ADD COLUMN links TEXT NOT NULL DEFAULT '[]';    -- JSON: [{label, url}]
ALTER TABLE collaborators ADD COLUMN gallery TEXT NOT NULL DEFAULT '[]';  -- JSON: [media id]

-- Research projects in Chinese as well, so the language switch covers the research page.
ALTER TABLE research_projects ADD COLUMN name_zh TEXT NOT NULL DEFAULT '';
ALTER TABLE research_projects ADD COLUMN description_zh TEXT NOT NULL DEFAULT '';

-- Other spellings of a member's name in author lists, e.g. "Eshete, D. G.".
ALTER TABLE people ADD COLUMN author_names TEXT NOT NULL DEFAULT '[]';    -- JSON: [string]
