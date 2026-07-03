package com.homebanking.gateway.controller;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.math.BigDecimal;
import java.util.Map;
import java.util.Set;

@RestController
@CrossOrigin(origins = "*")
public class GatewayController {

    private static final Logger logger = LogManager.getLogger(GatewayController.class);

    // Transaction types that credit the account (increase balance)
    private static final Set<String> CREDIT_TYPES = Set.of("DEPOSIT", "INTEREST");
    // Transaction types that debit the account (decrease balance)
    private static final Set<String> DEBIT_TYPES = Set.of(
            "WITHDRAWAL", "INTERNAL_TRANSFER", "CARD_PAYMENT",
            "SERVICE_PAYMENT", "INTERBANK_TRANSFER", "INTERNATIONAL_TRANSFER",
            "ATM_WITHDRAWAL", "FEE");

    private final RestTemplate restTemplate;

    @Value("${service.auth-url}")
    private String authServiceUrl;
    @Value("${service.account-url}")
    private String accountServiceUrl;
    @Value("${service.transaction-url}")
    private String transactionServiceUrl;
    @Value("${service.notification-url}")
    private String notificationServiceUrl;

    public GatewayController(RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    @GetMapping("/health")
    public ResponseEntity<?> health() {
        return ResponseEntity.ok(Map.of("status", "OK", "service", "api-gateway"));
    }

    // ── Auth endpoints ──────────────────────────────────────────────────────
    @PostMapping("/api/auth/login")
    public ResponseEntity<?> login(@RequestBody Object body, @RequestHeader HttpHeaders headers) {
        return forward(HttpMethod.POST, authServiceUrl + "/login", body, headers, null);
    }

    @PostMapping("/api/auth/register")
    public ResponseEntity<?> register(@RequestBody Object body, @RequestHeader HttpHeaders headers) {
        return forward(HttpMethod.POST, authServiceUrl + "/register", body, headers, null);
    }

    // ── Account endpoints ───────────────────────────────────────────────────
    @PostMapping("/api/accounts")
    public ResponseEntity<?> createAccount(@RequestBody Object body, @RequestHeader HttpHeaders headers) {
        return forward(HttpMethod.POST, accountServiceUrl + "/api/accounts", body, headers, null);
    }

    @PostMapping("/api/accounts/with-card")
    public ResponseEntity<?> createAccountWithCard(@RequestBody Object body, @RequestHeader HttpHeaders headers) {
        return forward(HttpMethod.POST, accountServiceUrl + "/api/accounts/with-card", body, headers, null);
    }

    @GetMapping("/api/accounts/{accountId}")
    public ResponseEntity<?> getAccount(@PathVariable String accountId, @RequestHeader HttpHeaders headers) {
        return forward(HttpMethod.GET, accountServiceUrl + "/api/accounts/" + accountId, null, headers, null);
    }

    @GetMapping("/api/accounts")
    public ResponseEntity<?> listAccounts(@RequestParam Map<String, String> query, @RequestHeader HttpHeaders headers) {
        return forward(HttpMethod.GET, accountServiceUrl + "/api/accounts", null, headers, query);
    }

    @PutMapping("/api/accounts/{accountId}")
    public ResponseEntity<?> updateAccount(@PathVariable String accountId, @RequestBody Object body, @RequestHeader HttpHeaders headers) {
        return forward(HttpMethod.PUT, accountServiceUrl + "/api/accounts/" + accountId, body, headers, null);
    }

    @DeleteMapping("/api/accounts/{accountId}")
    public ResponseEntity<?> deleteAccount(@PathVariable String accountId, @RequestHeader HttpHeaders headers) {
        return forward(HttpMethod.DELETE, accountServiceUrl + "/api/accounts/" + accountId, null, headers, null);
    }

    @GetMapping("/api/accounts/{accountId}/cards")
    public ResponseEntity<?> getAccountCards(@PathVariable String accountId, @RequestHeader HttpHeaders headers) {
        return forward(HttpMethod.GET, accountServiceUrl + "/api/accounts/" + accountId + "/cards", null, headers, null);
    }

    // ── Card endpoints ──────────────────────────────────────────────────────
    @PostMapping("/api/cards")
    public ResponseEntity<?> createCard(@RequestBody Object body, @RequestHeader HttpHeaders headers) {
        return forward(HttpMethod.POST, accountServiceUrl + "/api/cards", body, headers, null);
    }

    @GetMapping("/api/cards")
    public ResponseEntity<?> listCards(@RequestParam Map<String, String> query, @RequestHeader HttpHeaders headers) {
        return forward(HttpMethod.GET, accountServiceUrl + "/api/cards", null, headers, query);
    }

    @GetMapping("/api/cards/{cardId}")
    public ResponseEntity<?> getCard(@PathVariable String cardId, @RequestHeader HttpHeaders headers) {
        return forward(HttpMethod.GET, accountServiceUrl + "/api/cards/" + cardId, null, headers, null);
    }

    @PutMapping("/api/cards/{cardId}")
    public ResponseEntity<?> updateCard(@PathVariable String cardId, @RequestBody Object body, @RequestHeader HttpHeaders headers) {
        return forward(HttpMethod.PUT, accountServiceUrl + "/api/cards/" + cardId, body, headers, null);
    }

    @PatchMapping("/api/cards/{cardId}/block")
    public ResponseEntity<?> blockCard(@PathVariable String cardId, @RequestHeader HttpHeaders headers) {
        return forward(HttpMethod.PATCH, accountServiceUrl + "/api/cards/" + cardId + "/block", Map.of(), headers, null);
    }

    @PatchMapping("/api/cards/{cardId}/activate")
    public ResponseEntity<?> activateCard(@PathVariable String cardId, @RequestHeader HttpHeaders headers) {
        return forward(HttpMethod.PATCH, accountServiceUrl + "/api/cards/" + cardId + "/activate", Map.of(), headers, null);
    }

    @DeleteMapping("/api/cards/{cardId}")
    public ResponseEntity<?> deleteCard(@PathVariable String cardId, @RequestHeader HttpHeaders headers) {
        return forward(HttpMethod.DELETE, accountServiceUrl + "/api/cards/" + cardId, null, headers, null);
    }

    // ── Transaction endpoints ───────────────────────────────────────────────
    @PostMapping("/api/transactions")
    public ResponseEntity<?> createTransaction(@RequestBody Object body, @RequestHeader HttpHeaders headers) {
        ResponseEntity<?> txResponse;
        try {
            txResponse = forwardOrThrow(HttpMethod.POST, transactionServiceUrl + "/transactions", body, headers, null);
        } catch (HttpStatusCodeException e) {
            return errorResponse(e);
        } catch (Exception e) {
            logger.error("Proxy call failed for POST /transactions: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", e.getMessage()));
        }

        Object txBody = txResponse.getBody();
        if (txBody instanceof Map<?, ?> txMap) {
            updateAccountBalanceAfterTransaction(txMap, headers);
        }
        return ResponseEntity.status(txResponse.getStatusCode()).body(txBody);
    }

    // Update account balance after a successful transaction. Failure here is non-fatal —
    // the transaction is already recorded upstream — so it's logged and swallowed.
    private void updateAccountBalanceAfterTransaction(Map<?, ?> tx, HttpHeaders headers) {
        Object accountId = tx.get("accountId");
        Object amountObj = tx.get("amount");
        Object type = tx.get("type");
        if (accountId == null || amountObj == null) {
            return;
        }
        try {
            HttpHeaders internalHeaders = new HttpHeaders();
            internalHeaders.setContentType(MediaType.APPLICATION_JSON);
            String authHeader = headers.getFirst(HttpHeaders.AUTHORIZATION);
            if (authHeader != null) {
                internalHeaders.set(HttpHeaders.AUTHORIZATION, authHeader);
            }

            ResponseEntity<Map> accResponse = restTemplate.exchange(
                    accountServiceUrl + "/api/accounts/" + accountId, HttpMethod.GET,
                    new HttpEntity<>(internalHeaders), Map.class);
            Map<?, ?> account = accResponse.getBody();
            double currentBalance = account != null && account.get("balance") != null
                    ? ((Number) account.get("balance")).doubleValue() : 0;
            double amount = new BigDecimal(amountObj.toString()).doubleValue();

            double newBalance = currentBalance;
            if (CREDIT_TYPES.contains(type)) {
                newBalance = currentBalance + amount;
            } else if (DEBIT_TYPES.contains(type)) {
                newBalance = currentBalance - amount;
            }

            if (newBalance != currentBalance) {
                restTemplate.exchange(
                        accountServiceUrl + "/api/accounts/" + accountId, HttpMethod.PUT,
                        new HttpEntity<>(Map.of("balance", newBalance), internalHeaders), Void.class);
            }
        } catch (Exception balanceError) {
            logger.error("Balance update failed for accountId={}: {}", accountId, balanceError.getMessage());
        }
    }

    @GetMapping("/api/transactions")
    public ResponseEntity<?> listTransactions(@RequestParam Map<String, String> query, @RequestHeader HttpHeaders headers) {
        return forward(HttpMethod.GET, transactionServiceUrl + "/transactions", null, headers, query);
    }

    @GetMapping("/api/transactions/{transactionId}")
    public ResponseEntity<?> getTransaction(@PathVariable String transactionId, @RequestHeader HttpHeaders headers) {
        return forward(HttpMethod.GET, transactionServiceUrl + "/transactions/" + transactionId, null, headers, null);
    }

    // ── Notification endpoints ──────────────────────────────────────────────
    @PostMapping("/api/notifications")
    public ResponseEntity<?> createNotification(@RequestBody Object body, @RequestHeader HttpHeaders headers) {
        return forward(HttpMethod.POST, notificationServiceUrl + "/notifications", body, headers, null);
    }

    @GetMapping("/api/notifications")
    public ResponseEntity<?> listNotifications(@RequestParam Map<String, String> query, @RequestHeader HttpHeaders headers) {
        return forward(HttpMethod.GET, notificationServiceUrl + "/notifications", null, headers, query);
    }

    @GetMapping("/api/notifications/{notificationId}")
    public ResponseEntity<?> getNotification(@PathVariable String notificationId, @RequestHeader HttpHeaders headers) {
        return forward(HttpMethod.GET, notificationServiceUrl + "/notifications/" + notificationId, null, headers, null);
    }

    @PutMapping("/api/notifications/{notificationId}/read")
    public ResponseEntity<?> markNotificationRead(@PathVariable String notificationId, @RequestHeader HttpHeaders headers) {
        return forward(HttpMethod.PUT, notificationServiceUrl + "/notifications/" + notificationId + "/read", Map.of(), headers, null);
    }

    @DeleteMapping("/api/notifications/{notificationId}")
    public ResponseEntity<?> deleteNotification(@PathVariable String notificationId, @RequestHeader HttpHeaders headers) {
        return forward(HttpMethod.DELETE, notificationServiceUrl + "/notifications/" + notificationId, null, headers, null);
    }

    // ── Proxy helpers ───────────────────────────────────────────────────────
    private ResponseEntity<?> forward(HttpMethod method, String url, Object body, HttpHeaders headers, Map<String, String> query) {
        try {
            return forwardOrThrow(method, url, body, headers, query);
        } catch (HttpStatusCodeException e) {
            return errorResponse(e);
        } catch (Exception e) {
            logger.error("Proxy call failed for {} {}: {}", method, url, e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", e.getMessage()));
        }
    }

    private ResponseEntity<?> forwardOrThrow(HttpMethod method, String url, Object body, HttpHeaders headers, Map<String, String> query) {
        HttpHeaders forwardHeaders = new HttpHeaders();
        forwardHeaders.putAll(headers);
        forwardHeaders.remove(HttpHeaders.HOST);
        forwardHeaders.remove(HttpHeaders.CONTENT_LENGTH);

        String finalUrl = url;
        if (query != null && !query.isEmpty()) {
            UriComponentsBuilder builder = UriComponentsBuilder.fromHttpUrl(url);
            query.forEach(builder::queryParam);
            finalUrl = builder.toUriString();
        }

        ResponseEntity<Object> upstream = restTemplate.exchange(finalUrl, method, new HttpEntity<>(body, forwardHeaders), Object.class);
        // Only the status + parsed body are forwarded — upstream transport headers
        // (Content-Length, Transfer-Encoding, Connection, ...) do not apply to the
        // freshly re-serialized response we send to the client.
        return ResponseEntity.status(upstream.getStatusCode()).body(upstream.getBody());
    }

    private ResponseEntity<?> errorResponse(HttpStatusCodeException e) {
        logger.error("Proxy call failed with upstream status {}: {}", e.getStatusCode(), e.getResponseBodyAsString());
        MediaType contentType = e.getResponseHeaders() != null ? e.getResponseHeaders().getContentType() : null;
        if (contentType != null && contentType.isCompatibleWith(MediaType.APPLICATION_JSON)) {
            return ResponseEntity.status(e.getStatusCode())
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(e.getResponseBodyAsString());
        }
        return ResponseEntity.status(e.getStatusCode()).body(Map.of("error", e.getMessage()));
    }
}
