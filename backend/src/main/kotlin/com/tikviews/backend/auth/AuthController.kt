package com.tikviews.backend.auth

import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.beans.factory.annotation.Value
import org.springframework.http.ResponseCookie
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import java.security.MessageDigest
import java.time.Duration

data class LoginRequest(val password: String)

@RestController
@RequestMapping("/api/auth")
class AuthController(
    @Value("\${app.password}") private val appPassword: String,
) {

    @PostMapping("/login")
    fun login(@RequestBody body: LoginRequest, response: HttpServletResponse): ResponseEntity<Map<String, Any>> {
        if (body.password != appPassword) {
            return ResponseEntity.status(401).body(mapOf("error" to "密码错误"))
        }
        response.addHeader("Set-Cookie", buildCookie(expectedToken(appPassword), Duration.ofDays(30)).toString())
        return ResponseEntity.ok(mapOf("success" to true))
    }

    @GetMapping("/check")
    fun check(request: HttpServletRequest): ResponseEntity<Map<String, Any>> {
        return if (isAuthenticated(request, appPassword)) {
            ResponseEntity.ok(mapOf("authenticated" to true))
        } else {
            ResponseEntity.status(401).body(mapOf("authenticated" to false))
        }
    }

    @PostMapping("/logout")
    fun logout(response: HttpServletResponse): ResponseEntity<Map<String, Any>> {
        response.addHeader("Set-Cookie", buildCookie("", Duration.ZERO).toString())
        return ResponseEntity.ok(mapOf("success" to true))
    }

    companion object {
        const val COOKIE_NAME = "auth_token"

        fun expectedToken(password: String): String {
            val digest = MessageDigest.getInstance("SHA-256").digest("tikviews-auth:$password".toByteArray())
            return digest.joinToString("") { "%02x".format(it) }
        }

        fun isAuthenticated(request: HttpServletRequest, password: String): Boolean {
            val token = request.cookies?.firstOrNull { it.name == COOKIE_NAME }?.value ?: return false
            val expected = expectedToken(password)
            return token.length == expected.length && MessageDigest.isEqual(token.toByteArray(), expected.toByteArray())
        }

        private fun buildCookie(value: String, maxAge: Duration): ResponseCookie =
            ResponseCookie.from(COOKIE_NAME, value)
                .httpOnly(true)
                .path("/")
                .sameSite("Lax")
                .maxAge(maxAge)
                .build()
    }
}
