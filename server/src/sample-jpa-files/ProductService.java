package com.example.ecommerce.service;

import com.example.ecommerce.entity.Product;
import com.example.ecommerce.entity.Category;
import javax.persistence.EntityManager;
import javax.persistence.PersistenceContext;
import javax.persistence.TypedQuery;
import javax.persistence.criteria.CriteriaBuilder;
import javax.persistence.criteria.CriteriaQuery;
import javax.persistence.criteria.Root;
import javax.persistence.criteria.Join;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;

@Service
@Transactional(readOnly = true)
public class ProductService {

    @PersistenceContext
    private EntityManager em;

    // TypedQuery with JPQL — good practice but missing pagination
    public List<Product> findProductsByCategory(String categoryName) {
        TypedQuery<Product> query = em.createQuery(
            "SELECT p FROM Product p " +
            "JOIN p.category c " +
            "WHERE c.name = :categoryName " +
            "AND p.active = true " +
            "ORDER BY p.price ASC",
            Product.class
        );
        query.setParameter("categoryName", categoryName);
        return query.getResultList();
    }

    // Named query reference — defined in entity
    public List<Product> findDiscountedProducts() {
        return em.createNamedQuery("Product.findDiscounted", Product.class)
                 .setParameter("minDiscount", 10)
                 .getResultList();
    }

    // JPQL with multiple joins — potential performance issue
    public List<Object[]> getProductSalesReport() {
        return em.createQuery(
            "SELECT p.name, p.sku, c.name, " +
            "SUM(oi.quantity), SUM(oi.quantity * oi.unitPrice), " +
            "AVG(r.rating) " +
            "FROM Product p " +
            "JOIN p.category c " +
            "LEFT JOIN p.orderItems oi " +
            "LEFT JOIN p.reviews r " +
            "GROUP BY p.id, p.name, p.sku, c.name " +
            "HAVING SUM(oi.quantity) > 0 " +
            "ORDER BY SUM(oi.quantity * oi.unitPrice) DESC",
            Object[].class
        ).setMaxResults(50).getResultList();
    }

    // Criteria API — equivalent of JPQL but type-safe
    public List<Product> findExpensiveProducts(BigDecimal minPrice) {
        CriteriaBuilder cb = em.getCriteriaBuilder();
        CriteriaQuery<Product> cq = cb.createQuery(Product.class);
        Root<Product> product = cq.from(Product.class);
        Join<Product, Category> category = product.join("category");

        cq.select(product)
          .where(
              cb.and(
                  cb.greaterThanOrEqualTo(product.get("price"), minPrice),
                  cb.equal(product.get("active"), true),
                  cb.isNotNull(category.get("name"))
              )
          )
          .orderBy(cb.desc(product.get("price")));

        return em.createQuery(cq).setMaxResults(100).getResultList();
    }

    // HQL with subquery — inventory check
    public List<Product> findLowStockProducts() {
        return em.createQuery(
            "SELECT p FROM Product p " +
            "WHERE p.stockQuantity < p.reorderLevel " +
            "AND p.active = true " +
            "AND p.id NOT IN " +
            "(SELECT po.product.id FROM PurchaseOrder po " +
            " WHERE po.status IN ('PENDING', 'SHIPPED') " +
            " AND po.expectedDelivery > CURRENT_DATE) " +
            "ORDER BY (p.reorderLevel - p.stockQuantity) DESC",
            Product.class
        ).getResultList();
    }

    // Full-text search simulation — LIKE with leading wildcard
    public List<Product> searchProducts(String keyword) {
        return em.createQuery(
            "SELECT p FROM Product p " +
            "WHERE LOWER(p.name) LIKE :keyword " +
            "OR LOWER(p.description) LIKE :keyword " +
            "OR p.sku = :exactKeyword " +
            "ORDER BY CASE WHEN p.sku = :exactKeyword THEN 0 " +
            "WHEN LOWER(p.name) LIKE :startsWith THEN 1 ELSE 2 END, p.name",
            Product.class
        )
        .setParameter("keyword", "%" + keyword.toLowerCase() + "%")
        .setParameter("exactKeyword", keyword)
        .setParameter("startsWith", keyword.toLowerCase() + "%")
        .setMaxResults(50)
        .getResultList();
    }
}
