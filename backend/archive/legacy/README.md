# Legacy sources

These scripts imported the old static site into the database once, in November 2026.
They are kept as a record of how each value got here and are not part of the running system.

- `source/` holds the Markdown files the old site was hand-edited from.
- `import-legacy.mjs` parsed those files and the old HTML into `backend/content/`.
- `fix-venues.mjs` applied corrections after the import.

The complete old site, including its templates and images, is preserved at the git tag
`pre-redesign-2026-11`. To look at it:

```bash
git checkout pre-redesign-2026-11
```

Content is now edited through the admin (see `docs/content-guide.md`), so do not rerun these scripts:
they would replace newer content.
