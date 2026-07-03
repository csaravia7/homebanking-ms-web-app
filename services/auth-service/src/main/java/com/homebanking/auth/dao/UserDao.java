package com.homebanking.auth.dao;

import jakarta.annotation.PostConstruct;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Repository;

import java.io.File;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.Optional;

@Repository
public class UserDao {

    private static final Logger logger = LogManager.getLogger(UserDao.class);

    private final String jdbcUrl;

    public UserDao(@Value("${auth.db.path}") String dbPath) {
        File dbFile = new File(dbPath);
        File parent = dbFile.getParentFile();
        if (parent != null && !parent.exists()) {
            parent.mkdirs();
        }
        this.jdbcUrl = "jdbc:sqlite:" + dbPath;
    }

    @PostConstruct
    void initializeDatabase() {
        try (Connection conn = getConnection(); Statement stmt = conn.createStatement()) {
            stmt.execute("""
                    CREATE TABLE IF NOT EXISTS users (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        email TEXT UNIQUE NOT NULL,
                        password TEXT NOT NULL,
                        first_name TEXT,
                        last_name TEXT,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                    """);
            stmt.execute("CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)");
            logger.info("Database initialized successfully");

            try (ResultSet rs = stmt.executeQuery("SELECT COUNT(*) as count FROM users")) {
                rs.next();
                if (rs.getInt("count") == 0) {
                    seedDemoUsers(conn);
                    logger.info("Demo users created");
                }
            }
        } catch (SQLException e) {
            logger.error("Failed to initialize database", e);
        }
    }

    private void seedDemoUsers(Connection conn) throws SQLException {
        String hash = "$2a$10$6cXMWu83yT2W5nIFPJH7POtmDADfyPyd9bitrgMBv3oQqHmx2TsbK"; // password123
        String sql = "INSERT INTO users (email, password, first_name, last_name) VALUES (?, ?, ?, ?)";
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            insertDemoUser(ps, "test@example.com", hash, "Test", "User");
            insertDemoUser(ps, "alice@example.com", hash, "Alice", "Johnson");
            insertDemoUser(ps, "bob@example.com", hash, "Bob", "Smith");
        }
    }

    private void insertDemoUser(PreparedStatement ps, String email, String hash, String first, String last) throws SQLException {
        ps.setString(1, email);
        ps.setString(2, hash);
        ps.setString(3, first);
        ps.setString(4, last);
        ps.executeUpdate();
    }

    private Connection getConnection() throws SQLException {
        Connection conn = DriverManager.getConnection(jdbcUrl);
        try (Statement stmt = conn.createStatement()) {
            stmt.execute("PRAGMA foreign_keys = ON");
        }
        return conn;
    }

    public record User(long id, String email, String password, String firstName, String lastName) {}

    public Optional<User> findByEmail(String email) {
        String sql = "SELECT * FROM users WHERE email = ?";
        try (Connection conn = getConnection(); PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, email);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    return Optional.of(new User(
                            rs.getLong("id"), rs.getString("email"), rs.getString("password"),
                            rs.getString("first_name"), rs.getString("last_name")));
                }
                return Optional.empty();
            }
        } catch (SQLException e) {
            logger.error("Failed to query user by email={}", email, e);
            throw new RuntimeException(e);
        }
    }

    public long insertUser(String email, String hashedPassword, String firstName, String lastName) {
        String sql = "INSERT INTO users (email, password, first_name, last_name) VALUES (?, ?, ?, ?)";
        try (Connection conn = getConnection();
             PreparedStatement ps = conn.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)) {
            ps.setString(1, email);
            ps.setString(2, hashedPassword);
            ps.setString(3, firstName);
            ps.setString(4, lastName);
            ps.executeUpdate();
            try (ResultSet keys = ps.getGeneratedKeys()) {
                keys.next();
                return keys.getLong(1);
            }
        } catch (SQLException e) {
            if (e.getMessage() != null && e.getMessage().contains("UNIQUE")) {
                throw new UniqueConstraintException("Email already exists: " + email);
            }
            logger.error("Failed to insert user email={}", email, e);
            throw new RuntimeException(e);
        }
    }

    public static class UniqueConstraintException extends RuntimeException {
        public UniqueConstraintException(String message) {
            super(message);
        }
    }
}
