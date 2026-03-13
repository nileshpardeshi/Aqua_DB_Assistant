package com.example.banking.repository;

import com.example.banking.entity.Transaction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface TransactionRepository extends JpaRepository<Transaction, Long> {

    // Full table scan — no index on transactionDate typically
    @Query("SELECT t FROM Transaction t WHERE t.transactionDate BETWEEN :start AND :end ORDER BY t.transactionDate DESC")
    List<Transaction> findByDateRange(
            @Param("start") LocalDateTime start,
            @Param("end") LocalDateTime end);

    // N+1: fetches transactions, then lazy-loads account for each
    @Query("SELECT t FROM Transaction t WHERE t.amount > :threshold AND t.type = :type")
    List<Transaction> findLargeTransactions(
            @Param("threshold") BigDecimal threshold,
            @Param("type") String type);

    // Optimized version with JOIN FETCH
    @Query("SELECT t FROM Transaction t " +
           "JOIN FETCH t.account a " +
           "JOIN FETCH a.customer c " +
           "WHERE t.amount > :threshold AND t.type = :type")
    List<Transaction> findLargeTransactionsWithDetails(
            @Param("threshold") BigDecimal threshold,
            @Param("type") String type);

    // Heavy aggregation — daily summary across millions of rows
    @Query("SELECT FUNCTION('DATE', t.transactionDate), t.type, " +
           "COUNT(t), SUM(t.amount), AVG(t.amount), MAX(t.amount) " +
           "FROM Transaction t " +
           "WHERE t.transactionDate >= :since " +
           "GROUP BY FUNCTION('DATE', t.transactionDate), t.type " +
           "ORDER BY FUNCTION('DATE', t.transactionDate) DESC")
    List<Object[]> getDailyTransactionSummary(@Param("since") LocalDateTime since);

    // Correlated subquery — very expensive at scale
    @Query("SELECT t FROM Transaction t WHERE t.amount > " +
           "(SELECT AVG(t2.amount) FROM Transaction t2 WHERE t2.account.id = t.account.id) " +
           "AND t.transactionDate >= :since")
    List<Transaction> findAboveAverageTransactions(@Param("since") LocalDateTime since);

    // Missing pagination — returns unbounded results
    @Query("SELECT t FROM Transaction t " +
           "JOIN t.account a " +
           "WHERE a.customer.id = :customerId " +
           "ORDER BY t.transactionDate DESC")
    List<Transaction> findAllByCustomer(@Param("customerId") Long customerId);

    // Window function simulation — complex
    @Query("SELECT t.account.id, t.transactionDate, t.amount, " +
           "(SELECT SUM(t2.amount) FROM Transaction t2 " +
           " WHERE t2.account.id = t.account.id " +
           " AND t2.transactionDate <= t.transactionDate) as runningBalance " +
           "FROM Transaction t " +
           "WHERE t.account.id = :accountId " +
           "ORDER BY t.transactionDate")
    List<Object[]> getRunningBalance(@Param("accountId") Long accountId);

    // Batch status update
    @Modifying
    @Query("UPDATE Transaction t SET t.status = :newStatus " +
           "WHERE t.status = :oldStatus AND t.transactionDate < :before")
    int batchUpdateStatus(
            @Param("oldStatus") String oldStatus,
            @Param("newStatus") String newStatus,
            @Param("before") LocalDateTime before);

    // Count by type — lightweight
    @Query("SELECT t.type, COUNT(t) FROM Transaction t " +
           "WHERE t.transactionDate >= :since GROUP BY t.type")
    List<Object[]> countByTypeSince(@Param("since") LocalDateTime since);
}
