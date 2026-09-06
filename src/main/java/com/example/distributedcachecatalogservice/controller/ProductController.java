package com.example.distributedcachecatalogservice.controller;

import com.example.distributedcachecatalogservice.dto.ProductRequest;
import com.example.distributedcachecatalogservice.model.Product;
import com.example.distributedcachecatalogservice.service.ProductNotFoundException;
import com.example.distributedcachecatalogservice.service.ProductService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/products")
public class ProductController {
    private final ProductService service;

    public ProductController(ProductService service) {
        this.service = service;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Product create(@Valid @RequestBody ProductRequest request) {
        return service.create(request);
    }

    @GetMapping("/{id}")
    public Product getById(@PathVariable String id) {
        return service.getById(id);
    }

    @GetMapping
    public List<Product> find(@RequestParam(required = false) String category) {
        return category == null ? List.of() : service.findByCategory(category);
    }

    @PutMapping("/{id}")
    public Product update(@PathVariable String id, @Valid @RequestBody ProductRequest request) {
        return service.update(id, request);
    }

    @ResponseStatus(HttpStatus.NOT_FOUND)
    @ExceptionHandler(ProductNotFoundException.class)
    public void productNotFound() {}
}
