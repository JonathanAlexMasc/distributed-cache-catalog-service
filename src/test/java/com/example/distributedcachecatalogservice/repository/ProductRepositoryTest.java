package com.example.distributedcachecatalogservice.repository;

import com.example.distributedcachecatalogservice.model.Product;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@ActiveProfiles("test")
class ProductRepositoryTest {
    @Autowired
    private ProductRepository repository;

    @Test
    void savesAndFindsProductById() {
        Product product = product("keyboard-1", "Keyboard", "electronics", "49.99");

        repository.save(product);

        Product saved = repository.findById("keyboard-1").orElseThrow();

        assertThat(saved.getId()).isEqualTo("keyboard-1");
        assertThat(saved.getName()).isEqualTo("Keyboard");
        assertThat(saved.getCategory()).isEqualTo("electronics");
        assertThat(saved.getPrice()).isEqualByComparingTo("49.99");
    }

    @Test
    void findsProductsByCategoryIgnoringCase() {
        repository.save(product("keyboard-1", "Keyboard", "electronics", "49.99"));
        repository.save(product("desk-1", "Desk", "furniture", "199.00"));

        List<Product> products = repository.findByCategoryIgnoreCase("ELECTRONICS");

        assertThat(products).extracting(Product::getId).containsExactly("keyboard-1");
    }

    @Test
    void returnsEmptyWhenProductDoesNotExist() {
        assertThat(repository.findById("missing")).isEmpty();
    }

    @Test
    void updatesExistingProduct() {
        repository.save(product("keyboard-1", "Keyboard", "electronics", "49.99"));
        repository.save(product("keyboard-1", "Premium Keyboard", "electronics", "79.99"));

        Product saved = repository.findById("keyboard-1").orElseThrow();

        assertThat(saved.getName()).isEqualTo("Premium Keyboard");
        assertThat(saved.getPrice()).isEqualByComparingTo("79.99");
    }

    private Product product(String id, String name, String category, String price) {
        return new Product(id, name, category, new BigDecimal(price), "Test product");
    }
}
