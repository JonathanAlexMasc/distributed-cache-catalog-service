package com.example.distributedcachecatalogservice.repository;

import com.example.distributedcachecatalogservice.model.Product;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ProductRepository extends JpaRepository<Product, String> {
    List<Product> findByCategoryIgnoreCase(String category);
}
