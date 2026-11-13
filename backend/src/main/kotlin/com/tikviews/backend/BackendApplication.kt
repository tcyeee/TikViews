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
	runApplication<BackendApplication>(*args)
}
