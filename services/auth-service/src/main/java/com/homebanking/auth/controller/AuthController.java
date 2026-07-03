package com.homebanking.auth.controller;

import com.homebanking.auth.dao.UserDao;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.mindrot.jbcrypt.BCrypt;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Date;
import java.util.Map;
import java.util.Optional;

@RestController
@CrossOrigin(origins = "*")
public class AuthController {

    private static final Logger logger = LogManager.getLogger(AuthController.class);
    private static final int MIN_HS256_KEY_BYTES = 32;

    private final UserDao userDao;
    private final SecretKey signingKey;
    private final long expirationHours;

    public AuthController(UserDao userDao,
                           @Value("${jwt.secret}") String jwtSecret,
                           @Value("${jwt.expiration-hours}") long expirationHours) {
        this.userDao = userDao;
        this.signingKey = Keys.hmacShaKeyFor(padToMinimumKeyLength(jwtSecret).getBytes(StandardCharsets.UTF_8));
        this.expirationHours = expirationHours;
    }

    // HS256 requires a key of at least 256 bits (32 bytes). Short secrets (e.g. local/dev
    // defaults) are tiled deterministically so signing/verification stay self-consistent
    // without weakening whatever entropy the original secret had.
    private static String padToMinimumKeyLength(String secret) {
        StringBuilder sb = new StringBuilder(secret);
        while (sb.toString().getBytes(StandardCharsets.UTF_8).length < MIN_HS256_KEY_BYTES) {
            sb.append(secret);
        }
        return sb.toString();
    }

    @GetMapping("/health")
    public ResponseEntity<?> health() {
        return ResponseEntity.ok(Map.of("status", "OK", "service", "auth-service"));
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody Map<String, String> body) {
        String email = body.get("email");
        String password = body.get("password");
        String firstName = body.get("firstName");
        String lastName = body.get("lastName");

        if (isBlank(email) || isBlank(password)) {
            return ResponseEntity.badRequest().body(Map.of("error", "Email and password are required"));
        }

        try {
            String hashed = BCrypt.hashpw(password, BCrypt.gensalt(10));
            long id = userDao.insertUser(email, hashed, firstName, lastName);
            logger.info("User registered: {}", email);
            return ResponseEntity.status(HttpStatus.CREATED).body(Map.of(
                    "message", "User created successfully",
                    "user", Map.of("id", id, "email", email)
            ));
        } catch (UserDao.UniqueConstraintException e) {
            logger.warn("Registration rejected, email already exists: {}", email);
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", "Email already exists"));
        } catch (Exception e) {
            logger.error("Registration error", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", "Registration failed"));
        }
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String, String> body) {
        String email = body.get("email");
        String password = body.get("password");

        if (isBlank(email) || isBlank(password)) {
            return ResponseEntity.badRequest().body(Map.of("error", "Email and password are required"));
        }

        try {
            Optional<UserDao.User> userOpt = userDao.findByEmail(email);
            if (userOpt.isEmpty()) {
                logger.warn("Login failed, unknown email: {}", email);
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Invalid email or password"));
            }

            UserDao.User user = userOpt.get();
            if (!BCrypt.checkpw(password, user.password())) {
                logger.warn("Login failed, wrong password for: {}", email);
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Invalid email or password"));
            }

            String token = Jwts.builder()
                    .claim("id", user.id())
                    .claim("email", user.email())
                    .issuedAt(Date.from(Instant.now()))
                    .expiration(Date.from(Instant.now().plus(expirationHours, ChronoUnit.HOURS)))
                    .signWith(signingKey)
                    .compact();

            logger.info("Login successful: {}", email);
            return ResponseEntity.ok(Map.of(
                    "message", "Login successful",
                    "token", token,
                    "user", Map.of(
                            "id", user.id(),
                            "email", user.email(),
                            "firstName", user.firstName() == null ? "" : user.firstName(),
                            "lastName", user.lastName() == null ? "" : user.lastName()
                    )
            ));
        } catch (Exception e) {
            logger.error("Login error", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", "Login failed"));
        }
    }

    @PostMapping("/verify")
    public ResponseEntity<?> verify(@RequestHeader(value = "Authorization", required = false) String authHeader) {
        if (isBlank(authHeader)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "No token provided"));
        }
        String token = authHeader.startsWith("Bearer ") ? authHeader.substring(7) : authHeader;
        try {
            var claims = Jwts.parser().verifyWith(signingKey).build().parseSignedClaims(token).getPayload();
            return ResponseEntity.ok(Map.of("valid", true, "user", claims));
        } catch (Exception e) {
            logger.warn("Token verification failed: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Invalid token"));
        }
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
