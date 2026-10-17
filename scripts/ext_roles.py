"""EXTNAMES1 · the only private-names roles ever filtered from calendar rows (partner, coparent, household and school
never are). One constant for the Python side (text_law.py, cal-months.py, scripts/qa/away-pages.py); the JS twin is
EXT_ROLES in scripts/private-dir.mjs. Kept import-safe: no names are read here."""
EXT_ROLES = ("external", "otherfamily")
