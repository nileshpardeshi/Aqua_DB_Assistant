package com.example.banking.repository;

import com.example.banking.entity.Order;
import com.example.banking.entity.OrderStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface OrderRepository extends JpaRepository<Order, Long> {

    // N+1 problem: loads all orders then lazily fetches customer for each
    @Query("SELECT o FROM Order o WHERE o.status = :status")
    List<Order> findByStatus(@Param("status") OrderStatus status);

    // Optimized: fetch join eliminates N+1
    @Query("SELECT o FROM Order o JOIN FETCH o.customer c WHERE o.status = :status")
    List<Order> findByStatusWithCustomer(@Param("status") OrderStatus status);

    // Complex aggregation query — potential full table scan
    @Query("SELECT NEW com.example.banking.dto.OrderSummaryDTO(" +
           "o.customer.id, o.customer.name, COUNT(o), SUM(o.totalAmount)) " +
           "FROM Order o WHERE o.createdAt BETWEEN :startDate AND :endDate " +
           "GROUP BY o.customer.id, o.customer.name " +
           "HAVING SUM(o.totalAmount) > :minAmount " +
           "ORDER BY SUM(o.totalAmount) DESC")
    List<Object[]> findTopCustomersByRevenue(
            @Param("startDate") LocalDateTime startDate,
            @Param("endDate") LocalDateTime endDate,
            @Param("minAmount") BigDecimal minAmount);

    // Cartesian product risk: multiple collection joins
    @Query("SELECT DISTINCT o FROM Order o " +
           "LEFT JOIN FETCH o.items i " +
           "LEFT JOIN FETCH o.payments p " +
           "WHERE o.customer.id = :customerId")
    List<Order> findOrdersWithItemsAndPayments(@Param("customerId") Long customerId);

    // Subquery with IN clause — can be slow at scale
    @Query("SELECT o FROM Order o WHERE o.customer.id IN " +
           "(SELECT c.id FROM Customer c WHERE c.region = :region AND c.tier = 'PREMIUM')")
    List<Order> findOrdersByPremiumCustomersInRegion(@Param("region") String region);

    // Pagination without proper indexing
    @Query("SELECT o FROM Order o WHERE o.status <> 'CANCELLED' " +
           "ORDER BY o.createdAt DESC")
    List<Order> findRecentActiveOrders();

    // Bulk update — missing index on status + createdAt
    @Modifying
    @Query("UPDATE Order o SET o.status = 'ARCHIVED' " +
           "WHERE o.status = 'DELIVERED' AND o.createdAt < :cutoffDate")
    int archiveOldDeliveredOrders(@Param("cutoffDate") LocalDateTime cutoffDate);

    // Native query with potential SQL injection if not parameterized
    @Query(value = "SELECT o.* FROM orders o " +
                   "INNER JOIN customers c ON o.customer_id = c.id " +
                   "WHERE c.email LIKE %:email% " +
                   "ORDER BY o.created_at DESC LIMIT 100",
           nativeQuery = true)
    List<Order> findByCustomerEmailNative(@Param("email") String email);
}
