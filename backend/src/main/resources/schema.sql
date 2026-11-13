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
    vv TEXT NOT NULL,
    scrape_status TEXT NOT NULL DEFAULT '未抓取',
    scraped_at TEXT
);

CREATE TABLE IF NOT EXISTS video_table_settings (
    column_key TEXT PRIMARY KEY,
    visible INTEGER NOT NULL DEFAULT 1,
    width INTEGER NOT NULL DEFAULT 150
);


CREATE INDEX IF NOT EXISTS idx_excel_import_rows_import_id
    ON excel_import_rows(import_id);

CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    level TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL,
    is_read INTEGER NOT NULL DEFAULT 0
);
