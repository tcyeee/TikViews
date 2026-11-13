package com.tikviews.backend.excel

import org.springframework.http.HttpHeaders
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.multipart.MultipartFile
import com.tikviews.backend.ytdlp.ScrapeFailureReason
import com.tikviews.backend.ytdlp.YtDlpService
import com.tikviews.backend.ytdlp.toStatusLabel
import java.net.URLEncoder
import java.nio.charset.StandardCharsets
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter

data class ExcelImportResponse(val rows: List<ExcelRow>, val totalCount: Int, val importId: String)
data class ExcelImportError(val message: String)
data class ExcelVideoListResponse(val rows: List<ExcelRow>)
data class VideoTableSetting(val key: String, val visible: Boolean, val width: Int)
data class ScrapeResponse(val success: Boolean, val message: String?, val row: ExcelRow, val blocked: Boolean = false)

@RestController
@RequestMapping("/api/excel")
class ExcelImportController(
    private val excelImportService: ExcelImportService,
    private val excelExportService: ExcelExportService,
    private val excelImportRepository: ExcelImportRepository,
    private val ytDlpService: YtDlpService,
) {

    @PostMapping("/import")
    fun import(@RequestParam("file") file: MultipartFile): ResponseEntity<Any> {
        val rows = try {
            excelImportService.parse(file)
        } catch (e: ExcelFormatException) {
            return ResponseEntity.badRequest().body(ExcelImportError(e.message ?: "导入失败"))
        } catch (e: Exception) {
            return ResponseEntity.internalServerError().body(ExcelImportError("Excel 导入处理失败：${e.message ?: "未知错误"}"))
        }
        return try {
            val stored = excelImportRepository.save(file.originalFilename ?: "upload.xlsx", rows)
            ResponseEntity.ok(ExcelImportResponse(rows, rows.size, stored.id))
        } catch (e: Exception) {
            ResponseEntity.internalServerError().body(ExcelImportError("Excel 数据保存失败：${e.message ?: "未知错误"}"))
        }
    }

    @GetMapping("/export")
    fun export(): ResponseEntity<ByteArray> {
        val rows = excelImportRepository.findAllRows()
        val bytes = excelExportService.export(rows)
        val filename = "视频数据_${LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss"))}.xlsx"
        val encodedFilename = URLEncoder.encode(filename, StandardCharsets.UTF_8).replace("+", "%20")
        val headers = HttpHeaders()
        headers.contentType = MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        headers.add(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename*=UTF-8''$encodedFilename")
        return ResponseEntity.ok().headers(headers).body(bytes)
    }

    @GetMapping("/videos")
    fun listVideos(): ResponseEntity<Any> {
        return try {
            ResponseEntity.ok(ExcelVideoListResponse(excelImportRepository.findAllRows()))
        } catch (e: Exception) {
            ResponseEntity.internalServerError().body(ExcelImportError("读取视频列表失败：${e.message ?: "未知错误"}"))
        }
    }

    @DeleteMapping("/videos")
    fun clearVideos(): ResponseEntity<Any> {
        return try {
            excelImportRepository.deleteAll()
            ResponseEntity.ok(ExcelVideoListResponse(emptyList()))
        } catch (e: Exception) {
            ResponseEntity.internalServerError().body(ExcelImportError("清空视频列表失败：${e.message ?: "未知错误"}"))
        }
    }

    @DeleteMapping("/videos/{id}")
    fun deleteVideo(@PathVariable id: Long): ResponseEntity<Any> {
        return try {
            val deleted = excelImportRepository.deleteRow(id)
            if (!deleted) {
                return ResponseEntity.notFound().build()
            }
            ResponseEntity.ok(ExcelVideoListResponse(excelImportRepository.findAllRows()))
        } catch (e: Exception) {
            ResponseEntity.internalServerError().body(ExcelImportError("删除视频失败：${e.message ?: "未知错误"}"))
        }
    }

    @PostMapping("/videos/{id}/scrape")
    fun scrapeVideo(@PathVariable id: Long): ResponseEntity<Any> {
        val row = excelImportRepository.findAllRows().firstOrNull { it.id == id } ?: return ResponseEntity.notFound().build()
        val result = ytDlpService.fetchVideoInfo(row.videoId)

        if (result.success && excelImportRepository.updateScrapedRow(id, result.title, result.videoId, result.uploadDate, result.viewCount)) {
            val updated = excelImportRepository.findAllRows().first { it.id == id }
            return ResponseEntity.ok(ScrapeResponse(success = true, message = null, row = updated))
        }

        // 已下架/私密/已删除是 yt-dlp 实际确认过的内容状态，值得记录覆盖；
        // IP 被限流和其余失败（网络、超时等）都不可信，不改动该行原有的抓取状态
        val reason = result.failureReason ?: ScrapeFailureReason.OTHER
        if (reason == ScrapeFailureReason.REMOVED || reason == ScrapeFailureReason.PRIVATE || reason == ScrapeFailureReason.DELETED) {
            excelImportRepository.updateScrapeStatus(id, reason.toStatusLabel())
        }
        val updated = excelImportRepository.findAllRows().first { it.id == id }
        return ResponseEntity.ok(
            ScrapeResponse(
                success = false,
                message = result.errorMessage ?: "抓取失败",
                row = updated,
                blocked = reason == ScrapeFailureReason.BLOCKED,
            ),
        )
    }

    @GetMapping("/videos/settings")
    fun tableSettings() = excelImportRepository.findTableSettings()

    @org.springframework.web.bind.annotation.PutMapping("/videos/settings")
    fun saveTableSettings(@org.springframework.web.bind.annotation.RequestBody settings: List<VideoTableSetting>) {
        excelImportRepository.saveTableSettings(settings)
    }
}
