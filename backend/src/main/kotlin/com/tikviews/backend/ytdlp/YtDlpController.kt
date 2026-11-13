package com.tikviews.backend.ytdlp

import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.server.ResponseStatusException

data class YtDlpTestRequest(val input: String, val proxy: String? = null)

@RestController
@RequestMapping("/api/ytdlp")
class YtDlpController(private val ytDlpService: YtDlpService) {

    @PostMapping("/test")
    fun test(@RequestBody request: YtDlpTestRequest): YtDlpTestResult {
        val input = request.input.trim()
        if (input.isBlank()) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "请输入视频 ID 或完整链接")
        }
        return ytDlpService.fetchVideoInfo(resolveUrl(input), request.proxy)
    }

    private fun resolveUrl(input: String): String {
        if (input.startsWith("http://") || input.startsWith("https://")) {
            return input
        }
        // 仅有视频 ID 时拼接一个占位账号链接，yt-dlp 按视频 ID 本身解析，不依赖账号名
        return "https://www.tiktok.com/@_/video/$input"
    }
}
