package com.tikviews.backend.message

import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

data class CreateMessageRequest(val level: String, val message: String)
data class MessageListResponse(val messages: List<Message>, val unreadCount: Int)

@RestController
@RequestMapping("/api/messages")
class MessageController(private val messageRepository: MessageRepository) {

    @GetMapping
    fun list(): MessageListResponse {
        val messages = messageRepository.findAll()
        return MessageListResponse(messages, messages.count { !it.read })
    }

    @PostMapping
    fun create(@RequestBody request: CreateMessageRequest): ResponseEntity<Message> {
        val level = request.level.ifBlank { "info" }
        return ResponseEntity.ok(messageRepository.save(level, request.message))
    }

    @PostMapping("/{id}/read")
    fun markRead(@PathVariable id: Long): ResponseEntity<Any> =
        if (messageRepository.markRead(id)) ResponseEntity.ok().build() else ResponseEntity.notFound().build()

    @PostMapping("/read-all")
    fun markAllRead(): ResponseEntity<Any> {
        messageRepository.markAllRead()
        return ResponseEntity.ok().build()
    }

    @DeleteMapping
    fun clearAll(): ResponseEntity<Any> {
        messageRepository.deleteAll()
        return ResponseEntity.ok().build()
    }
}
