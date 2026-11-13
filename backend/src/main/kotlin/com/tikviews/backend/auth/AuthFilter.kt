package com.tikviews.backend.auth

import jakarta.servlet.FilterChain
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Component
import org.springframework.web.filter.OncePerRequestFilter

// 简单的密码门禁：除登录/检查接口与 ping 外，所有 /api 请求都需要携带登录时发放的 cookie。
@Component
class AuthFilter(
    @Value("\${app.password}") private val appPassword: String,
) : OncePerRequestFilter() {

    override fun doFilterInternal(request: HttpServletRequest, response: HttpServletResponse, filterChain: FilterChain) {
        val path = request.requestURI
        val isPublic = !path.startsWith("/api/") || path.startsWith("/api/auth/") || path == "/api/ping"
        if (isPublic || AuthController.isAuthenticated(request, appPassword)) {
            filterChain.doFilter(request, response)
            return
        }
        response.status = HttpServletResponse.SC_UNAUTHORIZED
        response.contentType = "application/json"
        response.characterEncoding = "UTF-8"
        response.writer.write("""{"error":"unauthorized"}""")
    }
}
