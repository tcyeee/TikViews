package com.tikviews.backend

import org.springframework.context.annotation.Configuration
import org.springframework.stereotype.Component
import org.springframework.web.socket.CloseStatus
import org.springframework.web.socket.TextMessage
import org.springframework.web.socket.WebSocketSession
import org.springframework.web.socket.handler.TextWebSocketHandler
import org.springframework.web.socket.config.annotation.EnableWebSocket
import org.springframework.web.socket.config.annotation.WebSocketConfigurer
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry

@Configuration
@EnableWebSocket
class WebSocketConfig(private val heartbeatHandler: HeartbeatWebSocketHandler) : WebSocketConfigurer {
    override fun registerWebSocketHandlers(registry: WebSocketHandlerRegistry) {
        registry.addHandler(heartbeatHandler, "/ws/heartbeat").setAllowedOriginPatterns("*")
    }
}

@Component
class HeartbeatWebSocketHandler : TextWebSocketHandler() {
    override fun handleTextMessage(session: WebSocketSession, message: TextMessage) {
        if (message.payload == "ping" && session.isOpen) {
            session.sendMessage(TextMessage("pong"))
        }
    }

    override fun afterConnectionEstablished(session: WebSocketSession) {
        if (session.isOpen) session.sendMessage(TextMessage("connected"))
    }

    override fun handleTransportError(session: WebSocketSession, exception: Throwable) {
        if (session.isOpen) session.close(CloseStatus.SERVER_ERROR)
    }
}
