package com.tikviews.backend.excel

import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.stereotype.Repository
import org.springframework.transaction.annotation.Transactional
import java.time.Instant
import java.util.UUID

 data class StoredExcelImport(val id: String, val importedAt: String, val rowCount: Int)

@Repository
class ExcelImportRepository(private val jdbcTemplate: JdbcTemplate) {
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
            """SELECT r.author_nickname, r.author_id, r.video_info, r.video_id, r.publish_time, r.vv
                FROM excel_import_rows r
                JOIN excel_imports i ON i.id = r.import_id
                ORDER BY i.imported_at DESC, r.row_number ASC""",
        ) { rs, _ ->
            ExcelRow(
                authorNickname = rs.getString("author_nickname"),
                authorId = rs.getString("author_id"),
                videoInfo = rs.getString("video_info"),
                videoId = rs.getString("video_id"),
                publishTime = rs.getString("publish_time"),
                vv = rs.getString("vv"),
            )
        }
}
