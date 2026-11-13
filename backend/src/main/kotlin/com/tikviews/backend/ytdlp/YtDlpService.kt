package com.tikviews.backend.ytdlp

import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Service
import tools.jackson.databind.json.JsonMapper
import java.util.concurrent.TimeUnit

data class YtDlpTestResult(
    val success: Boolean,
    val videoId: String?,
    val viewCount: Long?,
    val likeCount: Long?,
    val commentCount: Long?,
    val title: String?,
    val uploaderId: String?,
    val uploadDate: String?,
    val errorMessage: String?,
    val durationMs: Long,
)

@Service
class YtDlpService(
    @Value("\${ytdlp.executable-path:yt-dlp}") private val executablePath: String,
    @Value("\${ytdlp.timeout-seconds:30}") private val timeoutSeconds: Long,
) {
    private val objectMapper = JsonMapper.builder().build()

    fun fetchVideoInfo(url: String): YtDlpTestResult {
        val start = System.currentTimeMillis()
        val process = try {
            ProcessBuilder(executablePath, "-j", "--skip-download", "--no-warnings", url).start()
        } catch (e: Exception) {
            return failure(
                "无法启动 yt-dlp（路径：$executablePath）：${e.message}",
                System.currentTimeMillis() - start,
            )
        }

        // 并行读取 stdout/stderr，避免管道缓冲区写满导致死锁
        val stdoutBuilder = StringBuilder()
        val stderrBuilder = StringBuilder()
        val stdoutThread = Thread { process.inputStream.bufferedReader().forEachLine { stdoutBuilder.appendLine(it) } }
        val stderrThread = Thread { process.errorStream.bufferedReader().forEachLine { stderrBuilder.appendLine(it) } }
        stdoutThread.start()
        stderrThread.start()

        val finished = process.waitFor(timeoutSeconds, TimeUnit.SECONDS)
        if (!finished) {
            process.destroyForcibly()
            stdoutThread.join(2000)
            stderrThread.join(2000)
            return failure(
                "yt-dlp 执行超时（超过 ${timeoutSeconds}s）",
                System.currentTimeMillis() - start,
            )
        }

        stdoutThread.join(2000)
        stderrThread.join(2000)
        val durationMs = System.currentTimeMillis() - start
        val stdout = stdoutBuilder.toString()
        val stderr = stderrBuilder.toString()

        if (process.exitValue() != 0 || stdout.isBlank()) {
            return failure(
                stderr.ifBlank { "yt-dlp 返回空结果（exit code ${process.exitValue()}）" }.trim(),
                durationMs,
            )
        }

        return try {
            val node = objectMapper.readTree(stdout)
            YtDlpTestResult(
                success = true,
                videoId = node.get("id")?.takeIf { it.isValueNode }?.asString(),
                viewCount = node.get("view_count")?.takeIf { it.isValueNode }?.asLong(),
                likeCount = node.get("like_count")?.takeIf { it.isValueNode }?.asLong(),
                commentCount = node.get("comment_count")?.takeIf { it.isValueNode }?.asLong(),
                title = (node.get("title") ?: node.get("description"))?.takeIf { it.isValueNode }?.asString(),
                uploaderId = (node.get("uploader_id") ?: node.get("uploader"))?.takeIf { it.isValueNode }?.asString(),
                uploadDate = node.get("upload_date")?.takeIf { it.isValueNode }?.asString(),
                errorMessage = null,
                durationMs = durationMs,
            )
        } catch (e: Exception) {
            failure("解析 yt-dlp 输出失败：${e.message}", durationMs)
        }
    }

    private fun failure(message: String, durationMs: Long) = YtDlpTestResult(
        success = false,
        videoId = null,
        viewCount = null,
        likeCount = null,
        commentCount = null,
        title = null,
        uploaderId = null,
        uploadDate = null,
        errorMessage = message,
        durationMs = durationMs,
    )
}
