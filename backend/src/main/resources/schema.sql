CREATE TABLE IF NOT EXISTS excel_imports (
    id TEXT PRIMARY KEY,
    imported_at TEXT NOT NULL,
    source_filename TEXT NOT NULL,
    row_count INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS excel_import_rows (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    import_id TEXT NOT NULL REFERENCES excel_imports(id) ON DELETE CASCADE,
    row_number INTEGER NOT NULL,
    author_nickname TEXT NOT NULL,
    author_id TEXT NOT NULL,
    video_info TEXT NOT NULL,
    video_id TEXT NOT NULL,
    publish_time TEXT NOT NULL,
    vv TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_excel_import_rows_import_id
    ON excel_import_rows(import_id);
