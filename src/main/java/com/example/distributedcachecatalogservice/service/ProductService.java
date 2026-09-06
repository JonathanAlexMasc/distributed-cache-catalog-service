package com.example.distributedcachecatalogservice.service;

import com.example.distributedcachecatalogservice.dto.ProductRequest;
import com.example.distributedcachecatalogservice.model.Product;
import com.example.distributedcachecatalogservice.repository.ProductRepository;
import org.springframework.stereotype.Service;
import java.util.List;
import java.util.UUID;

@Service
public class ProductService {
    private final ProductRepository repository;

    public ProductService(ProductRepository repository) {
        this.repository = repository;
    }

    public Product create(ProductRequest request) {
        return repository.save(toProduct(UUID.randomUUID().toString(), request));
    }

    public Product getById(String id) {
        return repository.findById(id).orElseThrow(() -> new ProductNotFoundException(id));
    }

    public List<Product> findByCategory(String category) {
        return repository.findByCategory(category);
    }

    public Product update(String id, ProductRequest request) {
        getById(id);
        return repository.save(toProduct(id, request));
    }

    private Product toProduct(String id, ProductRequest request) {
        return new Product(id, request.name(), request.category(), request.price(), request.description());
    }
}
