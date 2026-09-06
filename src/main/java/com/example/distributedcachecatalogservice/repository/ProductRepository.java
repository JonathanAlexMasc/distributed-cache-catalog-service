package com.example.distributedcachecatalogservice.repository;

import com.example.distributedcachecatalogservice.model.Product;
import java.util.List;
import java.util.Optional;

public interface ProductRepository {
    Product save(Product product);
    Optional<Product> findById(String id);
    List<Product> findByCategory(String category);
}
