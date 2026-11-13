package com.tikviews.backend

import org.slf4j.LoggerFactory
import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.context.event.ApplicationReadyEvent
import org.springframework.boot.runApplication
import org.springframework.context.event.EventListener
import org.springframework.stereotype.Component

@SpringBootApplication
class BackendApplication

@Component
class StartupLogger {
	private val log = LoggerFactory.getLogger(StartupLogger::class.java)

	@EventListener(ApplicationReadyEvent::class)
	fun onApplicationReady() {
		log.info("==========[success]===========")
	}
}

fun main(args: Array<String>) {
	// Conductor 等运行环境会注入 SERVER_PORT（指向前端开发服务器的端口，如 3000）。
	// 若让 Spring Boot 直接读取 SERVER_PORT，环境变量的高优先级会覆盖 application.properties
	// 里的 server.port=3001，导致后端与前端抢占同一端口，进而触发 vite ws proxy 的 write EPIPE。
	// 因此后端改用独立的 BACKEND_PORT（默认 3001），通过系统属性显式指定（优先级高于环境变量），
	// 不随 SERVER_PORT 变化。
	val backendPort = System.getenv("BACKEND_PORT") ?: "3001"
	System.setProperty("server.port", backendPort)
	runApplication<BackendApplication>(*args)
}
