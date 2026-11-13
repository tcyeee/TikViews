package com.tikviews.backend

import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RestController
import java.time.Instant

@RestController
class PingController {

    @GetMapping("/api/ping")
    fun ping(): Map<String, Any> = mapOf(
        "message" to "pong from backend",
        "timestamp" to Instant.now().toString(),
    )
}
