package com.homebanking.transaction.controller;

import com.homebanking.transaction.entity.Transaction;
import com.homebanking.transaction.dto.TransactionDTO;
import com.homebanking.transaction.repository.TransactionRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Arrays;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/transactions")
@CrossOrigin(origins = "*")
public class TransactionController {
    
    @Autowired
    private TransactionRepository transactionRepository;
    
    @GetMapping("/health")
    public ResponseEntity<?> health() {
        return ResponseEntity.ok().body("{\"status\": \"OK\", \"service\": \"transaction-service\"}");
    }
    
    @PostMapping
    public ResponseEntity<?> createTransaction(@RequestBody Transaction transaction) {
        try {
            // Validate required fields
            if (transaction.getAccountId() == null || transaction.getAccountId().isBlank()) {
                return ResponseEntity.badRequest().body("{\"error\": \"accountId is required\"}");
            }
            if (transaction.getAmount() == null || transaction.getAmount().compareTo(java.math.BigDecimal.ZERO) <= 0) {
                return ResponseEntity.badRequest().body("{\"error\": \"amount must be greater than 0\"}");
            }
            if (transaction.getType() == null || transaction.getType().isBlank()) {
                return ResponseEntity.badRequest().body("{\"error\": \"type is required\"}");
            }
            transaction.setStatus("COMPLETED");
            Transaction saved = transactionRepository.save(transaction);
            return ResponseEntity.status(HttpStatus.CREATED).body(convertToDTO(saved));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("{\"error\": \"" + e.getMessage() + "\"}");
        }
    }
    
    @GetMapping
    public ResponseEntity<?> listTransactions(
            @RequestParam(required = false) String accountId,
            @RequestParam(required = false) String accountIds) {
        try {
            List<Transaction> transactions;
            if (accountIds != null && !accountIds.isBlank()) {
                // Filter by comma-separated list of account IDs (user isolation)
                List<String> ids = Arrays.stream(accountIds.split(","))
                    .map(String::trim)
                    .filter(s -> !s.isEmpty())
                    .collect(Collectors.toList());
                transactions = ids.isEmpty()
                    ? List.of()
                    : transactionRepository.findByAccountIdInOrderByCreatedAtDesc(ids);
            } else if (accountId != null) {
                transactions = transactionRepository.findByAccountIdOrderByCreatedAtDesc(accountId);
            } else {
                transactions = transactionRepository.findAll();
            }
            return ResponseEntity.ok(transactions.stream().map(this::convertToDTO).collect(Collectors.toList()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("{\"error\": \"" + e.getMessage() + "\"}");
        }
    }
    
    @GetMapping("/{transactionId}")
    public ResponseEntity<?> getTransaction(@PathVariable Long transactionId) {
        try {
            return transactionRepository.findById(transactionId)
                    .map(t -> ResponseEntity.ok(convertToDTO(t)))
                    .orElse(ResponseEntity.notFound().build());
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("{\"error\": \"" + e.getMessage() + "\"}");
        }
    }
    
    private TransactionDTO convertToDTO(Transaction transaction) {
        return new TransactionDTO(
                transaction.getId(),
                transaction.getAccountId(),
                transaction.getAmount(),
                transaction.getType(),
                transaction.getStatus(),
                transaction.getDescription(),
                transaction.getCreatedAt(),
                transaction.getUpdatedAt()
        );
    }
}
