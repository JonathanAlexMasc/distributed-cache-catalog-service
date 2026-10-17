package com.example.distributedcachecatalogservice.repository;

import com.example.distributedcachecatalogservice.model.Product;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface ProductRepository extends JpaRepository<Product, String> {
    List<Product> findByCategoryIgnoreCase(String category);

    @Query("select distinct p.category from Product p order by p.category")
    List<String> findDistinctCategories();
}
