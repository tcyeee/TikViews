package com.tikviews.backend.excel

import org.apache.poi.ss.usermodel.Cell
import org.apache.poi.xssf.usermodel.XSSFWorkbook
import org.springframework.stereotype.Service
import java.io.ByteArrayOutputStream

private val EXPORT_HEADERS = listOf("达人昵称", "达人ID", "视频信息", "视频ID", "发布时间", "VV", "抓取状态", "抓取时间")

@Service
class ExcelExportService {

    fun export(rows: List<ExcelRow>): ByteArray {
        XSSFWorkbook().use { workbook ->
            val sheet = workbook.createSheet("Sheet1")

            val headerRow = sheet.createRow(0)
            EXPORT_HEADERS.forEachIndexed { index, title -> headerRow.createCell(index).setCellValue(title) }

            rows.forEachIndexed { rowIndex, row ->
                val sheetRow = sheet.createRow(rowIndex + 1)
                setText(sheetRow.createCell(0), row.authorNickname)
                setText(sheetRow.createCell(1), row.authorId)
                setText(sheetRow.createCell(2), row.videoInfo)
                setText(sheetRow.createCell(3), row.videoId)
                setText(sheetRow.createCell(4), row.publishTime)
                setText(sheetRow.createCell(5), row.vv)
                setText(sheetRow.createCell(6), row.scrapeStatus)
                setText(sheetRow.createCell(7), row.scrapedAt ?: "")
            }

            EXPORT_HEADERS.indices.forEach { sheet.autoSizeColumn(it) }

            val output = ByteArrayOutputStream()
            workbook.write(output)
            return output.toByteArray()
        }
    }

    private fun setText(cell: Cell, value: String) {
        cell.setCellValue(value)
    }
}
