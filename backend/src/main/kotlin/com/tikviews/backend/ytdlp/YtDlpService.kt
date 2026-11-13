package com.tikviews.backend.ytdlp

import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Service
import tools.jackson.databind.json.JsonMapper
import java.time.LocalTime
import java.time.format.DateTimeFormatter
import java.util.concurrent.TimeUnit

// 视频在抓取时可能已经被下架/设为私密/删除；这三类属于「内容状态确认」失败，
// 可信地反映抓取对象当前状态，值得持久化。其余失败（网络、超时、代理等）归为 OTHER，
// 不代表内容真的发生了变化，不应覆盖此前已记录的抓取状态。
enum class ScrapeFailureReason {
    REMOVED,
    PRIVATE,
    DELETED,
    // TikTok 对发起请求的 IP 做了限流/封禁，与视频内容状态无关，批量抓取应立即停止退避
    BLOCKED,
    OTHER,
}

fun ScrapeFailureReason.toStatusLabel(): String = when (this) {
    ScrapeFailureReason.REMOVED -> "已下架"
    ScrapeFailureReason.PRIVATE -> "私密"
    ScrapeFailureReason.DELETED -> "已删除"
    ScrapeFailureReason.BLOCKED -> "抓取失败"
    ScrapeFailureReason.OTHER -> "抓取失败"
}

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
    val failureReason: ScrapeFailureReason?,
    val durationMs: Long,
    val logs: List<String>,
)

@Service
class YtDlpService(
    @Value("\${ytdlp.executable-path:yt-dlp}") private val executablePath: String,
    @Value("\${ytdlp.timeout-seconds:30}") private val timeoutSeconds: Long,
    @Value("\${ytdlp.proxy:}") private val defaultProxy: String,
) {
    private val objectMapper = JsonMapper.builder().build()
    private val logger = LoggerFactory.getLogger(YtDlpService::class.java)
    private val timeFormatter = DateTimeFormatter.ofPattern("HH:mm:ss.SSS")

    fun fetchVideoInfo(url: String): YtDlpTestResult {
        val targetUrl = resolveUrl(url.trim())
        val start = System.currentTimeMillis()
        val logs = mutableListOf<String>()
        fun log(message: String) {
            val line = "[${LocalTime.now().format(timeFormatter)}] $message"
            logs.add(line)
            logger.info(line)
        }

        val effectiveProxy = defaultProxy.trim().takeIf { it.isNotEmpty() }
        log("开始抓取，目标 URL：$targetUrl")
        log(if (effectiveProxy != null) "使用代理：$effectiveProxy" else "未配置代理，直连抓取")

        // --verbose 会把 yt-dlp 内部请求、重定向、代理连接、HTTP 状态码等调试信息输出到 stderr，
        // 用于区分“网络/代理不可达”还是“接口被拒绝（如 403/429）”等问题
        val command = mutableListOf(executablePath, "-j", "--skip-download", "--no-warnings", "--verbose")
        if (effectiveProxy != null) {
            command.add("--proxy")
            command.add(effectiveProxy)
        }
        command.add(targetUrl)
        log("执行命令：${command.joinToString(" ")}")

        val process = try {
            ProcessBuilder(command).apply {
                // Do not let machine-wide proxy environment variables affect yt-dlp implicitly.
                listOf("HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "http_proxy", "https_proxy", "all_proxy").forEach {
                    environment().remove(it)
                }
            }.start()
        } catch (e: Exception) {
            log("启动 yt-dlp 进程失败：${e.message}")
            return failure(
                "无法启动 yt-dlp（路径：$executablePath）：${e.message}",
                System.currentTimeMillis() - start,
                logs,
            )
        }
        log("yt-dlp 进程已启动（pid=${process.pid()}），等待最长 ${timeoutSeconds}s")

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
            log("yt-dlp 执行超时（超过 ${timeoutSeconds}s），已强制终止进程")
            log("超时前 stderr 输出：\n${stderrBuilder.toString().trim().ifBlank { "（空）" }}")
            return failure(
                "yt-dlp 执行超时（超过 ${timeoutSeconds}s）",
                System.currentTimeMillis() - start,
                logs,
            )
        }

        stdoutThread.join(2000)
        stderrThread.join(2000)
        val durationMs = System.currentTimeMillis() - start
        val stdout = stdoutBuilder.toString()
        val stderr = stderrBuilder.toString()
        val exitCode = process.exitValue()
        log("yt-dlp 进程退出，exitCode=$exitCode，耗时=${durationMs}ms")
        log("stdout 长度=${stdout.length} 字符，stderr 长度=${stderr.length} 字符")
        if (stderr.isNotBlank()) {
            log("stderr 输出：\n${stderr.trim()}")
        }

        if (exitCode != 0 || stdout.isBlank()) {
            val message = stderr.ifBlank { "yt-dlp 返回空结果（exit code $exitCode）" }.trim()
            val reason = classifyFailure(message)
            log("判定为失败：$message（分类：$reason）")
            return failure(message, durationMs, logs, reason)
        }

        return try {
            val node = objectMapper.readTree(stdout)
            log("JSON 解析成功，video id=${node.get("id")?.takeIf { it.isValueNode }?.asString()}")
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
                failureReason = null,
                durationMs = durationMs,
                logs = logs,
            )
        } catch (e: Exception) {
            log("解析 yt-dlp 输出失败：${e.message}")
            failure("解析 yt-dlp 输出失败：${e.message}", durationMs, logs)
        }
    }

    private fun resolveUrl(input: String): String =
        if (input.startsWith("http://") || input.startsWith("https://")) input
        else "https://www.tiktok.com/@_/video/$input"

    // yt-dlp/TikTok 对不同下线原因的措辞并不统一，这里按常见关键词做best-effort归类；
    // 遇到新的措辞时再补充关键词即可。
    private fun classifyFailure(message: String): ScrapeFailureReason {
        val lower = message.lowercase()
        return when {
            "blocked" in lower -> ScrapeFailureReason.BLOCKED
            "private" in lower -> ScrapeFailureReason.PRIVATE
            "not found" in lower || "404" in lower || "doesn't exist" in lower || "does not exist" in lower -> ScrapeFailureReason.DELETED
            "unavailable" in lower || "removed" in lower || "violat" in lower || "no longer available" in lower -> ScrapeFailureReason.REMOVED
            else -> ScrapeFailureReason.OTHER
        }
    }

    private fun failure(
        message: String,
        durationMs: Long,
        logs: List<String>,
        reason: ScrapeFailureReason = ScrapeFailureReason.OTHER,
    ) = YtDlpTestResult(
        success = false,
        videoId = null,
        viewCount = null,
        likeCount = null,
        commentCount = null,
        title = null,
        uploaderId = null,
        uploadDate = null,
        errorMessage = message,
        failureReason = reason,
        durationMs = durationMs,
        logs = logs,
    )
}
