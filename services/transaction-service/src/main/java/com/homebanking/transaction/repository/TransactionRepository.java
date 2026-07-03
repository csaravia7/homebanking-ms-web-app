package com.homebanking.transaction.repository;

import com.homebanking.transaction.entity.Transaction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface TransactionRepository extends JpaRepository<Transaction, Long> {
    List<Transaction> findByAccountIdOrderByCreatedAtDesc(String accountId);
    List<Transaction> findByAccountIdAndTypeOrderByCreatedAtDesc(String accountId, String type);
    List<Transaction> findByAccountIdInOrderByCreatedAtDesc(List<String> accountIds);
}
