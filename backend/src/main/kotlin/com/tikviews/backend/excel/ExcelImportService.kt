package com.tikviews.backend.excel

import org.apache.poi.ss.usermodel.Cell
import org.apache.poi.ss.usermodel.CellType
import org.apache.poi.ss.usermodel.DataFormatter
import org.apache.poi.ss.usermodel.Row
import org.apache.poi.ss.usermodel.WorkbookFactory
import org.springframework.stereotype.Service
import org.springframework.web.multipart.MultipartFile
import java.math.BigDecimal
import java.util.Locale

data class ExcelRow(
    val authorNickname: String,
    val authorId: String,
    val videoInfo: String,
    val videoId: String,
    val publishTime: String,
    val vv: String,
)

class ExcelFormatException(message: String) : RuntimeException(message)

private val REQUIRED_HEADERS = listOf("达人昵称", "达人ID", "视频信息", "视频ID", "发布时间", "VV")

@Service
class ExcelImportService {
    private val dataFormatter = DataFormatter(Locale.CHINA)

    fun parse(file: MultipartFile): List<ExcelRow> {
        if (file.isEmpty) {
            throw ExcelFormatException("上传文件为空")
        }

        val workbook = try {
            WorkbookFactory.create(file.inputStream)
        } catch (e: Exception) {
            throw ExcelFormatException("无法解析 Excel 文件：${e.message}")
        }

        workbook.use { wb ->
            val sheet = wb.getSheet("Sheet1") ?: wb.getSheetAt(0)
            ?: throw ExcelFormatException("未找到可用的工作表")

            val headerRow = sheet.getRow(sheet.firstRowNum)
                ?: throw ExcelFormatException("未找到表头行")

            val columnIndex = mutableMapOf<String, Int>()
            for (cell in headerRow) {
                val text = dataFormatter.formatCellValue(cell).trim()
                if (text in REQUIRED_HEADERS) {
                    columnIndex[text] = cell.columnIndex
                }
            }
            val missing = REQUIRED_HEADERS.filterNot { columnIndex.containsKey(it) }
            if (missing.isNotEmpty()) {
                throw ExcelFormatException("Excel 表头缺少以下列：${missing.joinToString("、")}，请使用固定表头格式：${REQUIRED_HEADERS.joinToString("\t")}")
            }

            val rows = mutableListOf<ExcelRow>()
            for (rowIndex in (sheet.firstRowNum + 1)..sheet.lastRowNum) {
                val row = sheet.getRow(rowIndex) ?: continue
                val authorNickname = textOf(row, columnIndex["达人昵称"]!!)
                val authorId = idOf(row, columnIndex["达人ID"]!!)
                val videoInfo = textOf(row, columnIndex["视频信息"]!!)
                val videoId = idOf(row, columnIndex["视频ID"]!!)
                val publishTime = textOf(row, columnIndex["发布时间"]!!)
                val vv = textOf(row, columnIndex["VV"]!!)

                val allBlank = authorNickname.isBlank() && authorId.isBlank() && videoInfo.isBlank() &&
                    videoId.isBlank() && publishTime.isBlank() && vv.isBlank()
                if (allBlank) {
                    continue
                }

                rows.add(ExcelRow(authorNickname, authorId, videoInfo, videoId, publishTime, vv))
            }
            return rows
        }
    }

    private fun cellAt(row: Row, columnIndex: Int): Cell? =
        row.getCell(columnIndex, Row.MissingCellPolicy.RETURN_BLANK_AS_NULL)

    private fun textOf(row: Row, columnIndex: Int): String {
        val cell = cellAt(row, columnIndex) ?: return ""
        return when (cell.cellType) {
            CellType.STRING -> cell.stringCellValue.trim()
            CellType.NUMERIC -> formatNumeric(cell.numericCellValue)
            else -> dataFormatter.formatCellValue(cell).trim()
        }
    }

    // 达人ID、视频ID 均为 19 位标识，必须以完整数字字符串呈现，不能变成科学计数法或丢失精度
    private fun idOf(row: Row, columnIndex: Int): String {
        val cell = cellAt(row, columnIndex) ?: return ""
        return when (cell.cellType) {
            CellType.STRING -> cell.stringCellValue.trim()
            CellType.NUMERIC -> BigDecimal(cell.numericCellValue).toBigInteger().toString()
            else -> dataFormatter.formatCellValue(cell).trim()
        }
    }

    private fun formatNumeric(value: Double): String {
        val decimal = BigDecimal(value)
        return if (value == Math.floor(value) && !value.isInfinite()) {
            decimal.toBigInteger().toString()
        } else {
            decimal.toPlainString()
        }
    }
}
