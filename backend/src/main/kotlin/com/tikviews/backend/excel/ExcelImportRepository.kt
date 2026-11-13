package com.tikviews.backend.excel

import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.stereotype.Repository
import org.springframework.transaction.annotation.Transactional
import java.time.Instant
import java.util.UUID

 data class StoredExcelImport(val id: String, val importedAt: String, val rowCount: Int)

@Repository
class ExcelImportRepository(private val jdbcTemplate: JdbcTemplate) {
    init {
        val columns = jdbcTemplate.queryForList("PRAGMA table_info(excel_import_rows)").map { it["name"].toString() }.toSet()
        if ("scrape_status" !in columns) jdbcTemplate.execute("ALTER TABLE excel_import_rows ADD COLUMN scrape_status TEXT NOT NULL DEFAULT '未抓取'")
        if ("scraped_at" !in columns) jdbcTemplate.execute("ALTER TABLE excel_import_rows ADD COLUMN scraped_at TEXT")
        listOf("authorNickname", "authorId", "videoInfo", "videoId", "publishTime", "vv", "scrapeStatus", "scrapedAt").forEach {
            jdbcTemplate.update("INSERT OR IGNORE INTO video_table_settings (column_key, visible, width) VALUES (?, 1, 150)", it)
        }
    }
    @Transactional
    fun save(sourceFilename: String, rows: List<ExcelRow>): StoredExcelImport {
        val id = UUID.randomUUID().toString()
        val importedAt = Instant.now().toString()
        jdbcTemplate.update(
            "INSERT INTO excel_imports (id, imported_at, source_filename, row_count) VALUES (?, ?, ?, ?)",
            id, importedAt, sourceFilename, rows.size,
        )
        jdbcTemplate.batchUpdate(
            """INSERT INTO excel_import_rows
                (import_id, row_number, author_nickname, author_id, video_info, video_id, publish_time, vv)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            rows.mapIndexed { index, row ->
                arrayOf<Any>(id, index + 2, row.authorNickname, row.authorId, row.videoInfo, row.videoId, row.publishTime, row.vv)
            },
        )
        return StoredExcelImport(id, importedAt, rows.size)
    }

    fun findAllRows(): List<ExcelRow> =
        jdbcTemplate.query(
            """SELECT r.id, r.author_nickname, r.author_id, r.video_info, r.video_id, r.publish_time, r.vv, r.scrape_status, r.scraped_at
                FROM excel_import_rows r
                JOIN excel_imports i ON i.id = r.import_id
                ORDER BY i.imported_at DESC, r.row_number ASC""",
        ) { rs, _ ->
            ExcelRow(
                id = rs.getLong("id"),
                authorNickname = rs.getString("author_nickname"),
                authorId = rs.getString("author_id"),
                videoInfo = rs.getString("video_info"),
                videoId = rs.getString("video_id"),
                publishTime = rs.getString("publish_time"),
                vv = rs.getString("vv"),
                scrapeStatus = rs.getString("scrape_status"),
                scrapedAt = rs.getString("scraped_at"),
            )
        }

    fun updateScrapedRow(id: Long, title: String?, videoId: String?, uploadDate: String?, views: Long?): Boolean =
        jdbcTemplate.update("""UPDATE excel_import_rows SET video_info = COALESCE(?, video_info), video_id = COALESCE(?, video_id),
            publish_time = COALESCE(?, publish_time), vv = COALESCE(?, vv), scrape_status = '已抓取', scraped_at = ? WHERE id = ?""",
            title, videoId, uploadDate, views?.toString(), Instant.now().toString(), id) > 0

    fun findTableSettings(): List<Map<String, Any>> = jdbcTemplate.queryForList("SELECT column_key AS key, visible, width FROM video_table_settings")

    @Transactional
    fun saveTableSettings(settings: List<VideoTableSetting>) {
        settings.forEach { jdbcTemplate.update("UPDATE video_table_settings SET visible = ?, width = ? WHERE column_key = ?", if (it.visible) 1 else 0, it.width.coerceIn(60, 800), it.key) }
    }

    @Transactional
    fun deleteRow(rowId: Long): Boolean =
        jdbcTemplate.update("DELETE FROM excel_import_rows WHERE id = ?", rowId) > 0

    @Transactional
    fun deleteAll() {
        jdbcTemplate.update("DELETE FROM excel_import_rows")
        jdbcTemplate.update("DELETE FROM excel_imports")
    }
}
