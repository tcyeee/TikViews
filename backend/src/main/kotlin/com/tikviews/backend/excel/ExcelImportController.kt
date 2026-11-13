package com.tikviews.backend.excel

import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.multipart.MultipartFile

data class ExcelImportResponse(val rows: List<ExcelRow>, val totalCount: Int, val importId: String)
data class ExcelImportError(val message: String)
data class ExcelVideoListResponse(val rows: List<ExcelRow>)

@RestController
@RequestMapping("/api/excel")
class ExcelImportController(
    private val excelImportService: ExcelImportService,
    private val excelImportRepository: ExcelImportRepository,
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

    @GetMapping("/videos")
    fun listVideos(): ResponseEntity<Any> {
        return try {
            ResponseEntity.ok(ExcelVideoListResponse(excelImportRepository.findAllRows()))
        } catch (e: Exception) {
            ResponseEntity.internalServerError().body(ExcelImportError("读取视频列表失败：${e.message ?: "未知错误"}"))
        }
    }
}
