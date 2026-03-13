package com.example.banking.repository;

import com.example.banking.entity.Customer;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface CustomerRepository extends JpaRepository<Customer, Long> {

    // Simple finder — uses derived query, generally okay
    Optional<Customer> findByEmail(String email);

    // N+1 problem: fetches customer then lazy-loads accounts separately
    @Query("SELECT c FROM Customer c WHERE c.tier = :tier ORDER BY c.name")
    List<Customer> findByTier(@Param("tier") String tier);

    // EntityGraph approach — fetches accounts eagerly in single query
    @EntityGraph(attributePaths = {"accounts", "accounts.transactions"})
    @Query("SELECT c FROM Customer c WHERE c.tier = :tier ORDER BY c.name")
    List<Customer> findByTierWithAccounts(@Param("tier") String tier);

    // Complex join with multiple conditions
    @Query("SELECT c FROM Customer c " +
           "JOIN c.accounts a " +
           "JOIN a.transactions t " +
           "WHERE t.amount > :minAmount " +
           "AND t.transactionDate BETWEEN :startDate AND :endDate " +
           "AND c.status = 'ACTIVE' " +
           "GROUP BY c.id " +
           "HAVING COUNT(DISTINCT a.id) >= :minAccounts")
    List<Customer> findHighValueCustomers(
            @Param("minAmount") double minAmount,
            @Param("startDate") LocalDateTime startDate,
            @Param("endDate") LocalDateTime endDate,
            @Param("minAccounts") long minAccounts);

    // LIKE query without leading wildcard index usage
    @Query("SELECT c FROM Customer c WHERE LOWER(c.name) LIKE LOWER(CONCAT('%', :searchTerm, '%'))")
    List<Customer> searchByName(@Param("searchTerm") String searchTerm);

    // Cross join risk — comparing two entity sets
    @Query("SELECT c1, c2 FROM Customer c1, Customer c2 " +
           "WHERE c1.region = c2.region AND c1.id < c2.id " +
           "AND c1.tier = c2.tier AND c1.signupDate > :since")
    List<Object[]> findCustomerPairsInSameRegion(@Param("since") LocalDateTime since);

    // Counting with unnecessary data fetch
    @Query("SELECT c FROM Customer c WHERE c.region = :region")
    List<Customer> findAllInRegion(@Param("region") String region);

    // Better alternative for counting
    @Query("SELECT COUNT(c) FROM Customer c WHERE c.region = :region")
    long countByRegion(@Param("region") String region);

    // Projection query — good practice
    @Query("SELECT c.id, c.name, c.email, SIZE(c.accounts) " +
           "FROM Customer c WHERE c.createdAt >= :since ORDER BY c.name")
    List<Object[]> findRecentCustomerSummaries(@Param("since") LocalDateTime since);
}
