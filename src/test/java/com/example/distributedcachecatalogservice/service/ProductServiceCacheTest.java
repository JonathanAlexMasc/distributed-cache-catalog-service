package com.example.distributedcachecatalogservice.service;

import com.example.distributedcachecatalogservice.dto.ProductRequest;
import com.example.distributedcachecatalogservice.model.Product;
import com.example.distributedcachecatalogservice.repository.ProductRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.CacheManager;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@ActiveProfiles("test")
class ProductServiceCacheTest {
    @Autowired
    private ProductService service;

    @Autowired
    private ProductRepository repository;

    @Autowired
    private CacheManager cacheManager;

    @BeforeEach
    void clearState() {
        repository.deleteAll();
        cacheManager.getCache("products").clear();
        cacheManager.getCache("productsByCategory").clear();
    }

    @Test
    void cachesProductReads() {
        repository.save(product("keyboard-1", "Keyboard", "electronics", "49.99"));

        Product firstRead = service.getById("keyboard-1");
        repository.save(product("keyboard-1", "Updated Keyboard", "electronics", "79.99"));

        Product cachedRead = service.getById("keyboard-1");

        assertThat(firstRead.getName()).isEqualTo("Keyboard");
        assertThat(cachedRead.getName()).isEqualTo("Keyboard");
        assertThat(cacheManager.getCache("products").get("keyboard-1")).isNotNull();
    }

    @Test
    void invalidatesProductCacheAfterUpdate() {
        repository.save(product("keyboard-1", "Keyboard", "electronics", "49.99"));
        service.getById("keyboard-1");

        service.update("keyboard-1", new ProductRequest(
                "Premium Keyboard", "electronics", new BigDecimal("79.99"), "Updated keyboard"));

        assertThat(service.getById("keyboard-1").getName()).isEqualTo("Premium Keyboard");
        assertThat(service.getById("keyboard-1").getPrice()).isEqualByComparingTo("79.99");
    }

    @Test
    void cachesCategoryReads() {
        repository.save(product("keyboard-1", "Keyboard", "electronics", "49.99"));

        service.findByCategory("ELECTRONICS");
        repository.save(product("mouse-1", "Mouse", "electronics", "24.99"));

        assertThat(service.findByCategory("electronics"))
                .extracting(Product::getId)
                .containsExactly("keyboard-1");
    }

    private Product product(String id, String name, String category, String price) {
        return new Product(id, name, category, new BigDecimal(price), "Test product");
    }
}
