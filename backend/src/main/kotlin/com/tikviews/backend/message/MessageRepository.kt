package com.tikviews.backend.message

import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.stereotype.Repository
import java.time.Instant

data class Message(val id: Long, val level: String, val content: String, val createdAt: String, val read: Boolean)

@Repository
class MessageRepository(private val jdbcTemplate: JdbcTemplate) {
    fun save(level: String, content: String): Message {
        val createdAt = Instant.now().toString()
        jdbcTemplate.update(
            "INSERT INTO messages (level, content, created_at, is_read) VALUES (?, ?, ?, 0)",
            level, content, createdAt,
        )
        val id = jdbcTemplate.queryForObject("SELECT last_insert_rowid()", Long::class.java)!!
        return Message(id, level, content, createdAt, read = false)
    }

    fun findAll(): List<Message> =
        jdbcTemplate.query("SELECT id, level, content, created_at, is_read FROM messages ORDER BY id DESC") { rs, _ ->
            Message(
                id = rs.getLong("id"),
                level = rs.getString("level"),
                content = rs.getString("content"),
                createdAt = rs.getString("created_at"),
                read = rs.getInt("is_read") != 0,
            )
        }

    fun markRead(id: Long): Boolean =
        jdbcTemplate.update("UPDATE messages SET is_read = 1 WHERE id = ?", id) > 0

    fun markAllRead() {
        jdbcTemplate.update("UPDATE messages SET is_read = 1 WHERE is_read = 0")
    }

    fun deleteAll() {
        jdbcTemplate.update("DELETE FROM messages")
    }
}
