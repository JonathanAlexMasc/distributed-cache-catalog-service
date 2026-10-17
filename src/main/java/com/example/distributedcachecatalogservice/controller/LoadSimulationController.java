package com.example.distributedcachecatalogservice.controller;

import com.example.distributedcachecatalogservice.model.Product;
import com.example.distributedcachecatalogservice.service.ProductNotFoundException;
import com.example.distributedcachecatalogservice.service.ProductService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api/load-simulation")
public class LoadSimulationController {
    private final ProductService service;
    private final boolean enabled;

    public LoadSimulationController(ProductService service,
            @Value("${catalog.load-simulation.enabled:false}") boolean enabled) {
        this.service = service;
        this.enabled = enabled;
    }

    @GetMapping
    public Capabilities capabilities() {
        return new Capabilities(enabled);
    }

    @GetMapping("/products/{id}")
    public ResponseEntity<Product> product(@PathVariable String id,
            @RequestParam(defaultValue = "true") boolean useCache) {
        requireEnabled();
        Product product;
        try {
            product = useCache ? service.getById(id) : service.getByIdUncached(id);
        } catch (ProductNotFoundException exception) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Product not found");
        }
        return ResponseEntity.ok().header("Cache-Control", "no-store").body(product);
    }

    @GetMapping("/category")
    public ResponseEntity<List<Product>> category(@RequestParam String category,
            @RequestParam(defaultValue = "true") boolean useCache) {
        requireEnabled();
        if (category.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Category is required");
        }
        List<Product> products = useCache ? service.findByCategory(category) : service.findByCategoryUncached(category);
        return ResponseEntity.ok().header("Cache-Control", "no-store").body(products);
    }

    private void requireEnabled() {
        if (!enabled) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Load simulation is disabled");
        }
    }

    public record Capabilities(boolean enabled) {}
}
