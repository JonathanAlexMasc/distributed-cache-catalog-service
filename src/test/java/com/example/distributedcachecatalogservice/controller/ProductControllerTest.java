package com.example.distributedcachecatalogservice.controller;

import com.example.distributedcachecatalogservice.model.Product;
import com.example.distributedcachecatalogservice.repository.ProductRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;

import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ProductControllerTest {
    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ProductRepository repository;

    @BeforeEach
    void cleanDatabase() {
        repository.deleteAll();
    }

    @Test
    void createsProduct() throws Exception {
        mockMvc.perform(post("/products")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(productJson("Keyboard", "electronics", "49.99", "Compact keyboard")))
                .andExpect(status().isCreated())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.id").isString())
                .andExpect(jsonPath("$.name").value("Keyboard"))
                .andExpect(jsonPath("$.category").value("electronics"))
                .andExpect(jsonPath("$.price").value(49.99))
                .andExpect(jsonPath("$.description").value("Compact keyboard"));
    }

    @Test
    void getsProductById() throws Exception {
        repository.save(product("keyboard-1", "Keyboard", "electronics", "49.99"));

        mockMvc.perform(get("/products/keyboard-1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("keyboard-1"))
                .andExpect(jsonPath("$.name").value("Keyboard"))
                .andExpect(jsonPath("$.price").value(49.99));
    }

    @Test
    void filtersProductsByCategory() throws Exception {
        repository.save(product("keyboard-1", "Keyboard", "electronics", "49.99"));
        repository.save(product("desk-1", "Desk", "furniture", "199.00"));

        mockMvc.perform(get("/products").queryParam("category", "ELECTRONICS"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value("keyboard-1"))
                .andExpect(jsonPath("$[1]").doesNotExist());
    }

    @Test
    void updatesProduct() throws Exception {
        repository.save(product("keyboard-1", "Keyboard", "electronics", "49.99"));

        mockMvc.perform(put("/products/keyboard-1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(productJson("Premium Keyboard", "electronics", "79.99", "Updated keyboard")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("keyboard-1"))
                .andExpect(jsonPath("$.name").value("Premium Keyboard"))
                .andExpect(jsonPath("$.price").value(79.99));
    }

    @Test
    void returnsNotFoundWhenProductDoesNotExist() throws Exception {
        mockMvc.perform(get("/products/missing"))
                .andExpect(status().isNotFound())
                .andExpect(content().string(""));
    }

    @Test
    void rejectsInvalidProductOnCreate() throws Exception {
        mockMvc.perform(post("/products")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(productJson("", "", "-1.00", null)))
                .andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.detail", containsString("Validation failed")))
                .andExpect(jsonPath("$.errors.name").value("must not be blank"))
                .andExpect(jsonPath("$.errors.category").value("must not be blank"))
                .andExpect(jsonPath("$.errors.price").value("must be greater than or equal to 0.0"));
    }

    @Test
    void rejectsInvalidProductOnUpdate() throws Exception {
        repository.save(product("keyboard-1", "Keyboard", "electronics", "49.99"));

        mockMvc.perform(put("/products/keyboard-1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(productJson("Keyboard", "electronics", null, null)))
                .andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.detail").value("Validation failed"))
                .andExpect(jsonPath("$.errors.price").value("must not be null"));
    }

    private Product product(String id, String name, String category, String price) {
        return new Product(id, name, category, new BigDecimal(price), "Test product");
    }

    private String productJson(String name, String category, String price, String description) {
        return "{\"name\":\"" + name + "\",\"category\":\"" + category + "\","
                + "\"price\":" + (price == null ? "null" : "\"" + price + "\"")
                + (description == null ? "" : ",\"description\":\"" + description + "\"")
                + "}";
    }
}
