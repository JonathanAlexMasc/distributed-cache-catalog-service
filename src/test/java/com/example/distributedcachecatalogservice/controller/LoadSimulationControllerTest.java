package com.example.distributedcachecatalogservice.controller;

import com.example.distributedcachecatalogservice.model.Product;
import com.example.distributedcachecatalogservice.repository.ProductRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.cache.CacheManager;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;

import static org.mockito.Mockito.clearInvocations;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
        "catalog.load-simulation.enabled=true",
        "spring.datasource.url=jdbc:h2:mem:load-simulation-test;MODE=PostgreSQL;DB_CLOSE_DELAY=-1"
})
@AutoConfigureMockMvc
@ActiveProfiles("test")
class LoadSimulationControllerTest {
    @Autowired
    private MockMvc mvc;

    @MockitoSpyBean
    private ProductRepository repository;

    @Autowired
    private CacheManager cacheManager;

    @BeforeEach
    void setUp() {
        repository.deleteAll();
        cacheManager.getCache("products").clear();
        cacheManager.getCache("productsByCategory").clear();
        repository.save(new Product("load-test", "Keyboard", "keyboards", new BigDecimal("49.99"), "Test"));
        clearInvocations(repository);
    }

    @Test
    void cachedProductReadsReuseEntryAndBypassReadsAlwaysQueryRepository() throws Exception {
        for (int i = 0; i < 2; i++) {
            mvc.perform(get("/api/load-simulation/products/load-test"))
                    .andExpect(status().isOk())
                    .andExpect(header().string("Cache-Control", "no-store"))
                    .andExpect(jsonPath("$.id").value("load-test"));
        }
        verify(repository, times(1)).findById("load-test");
        for (int i = 0; i < 3; i++) {
            mvc.perform(get("/api/load-simulation/products/load-test").param("useCache", "false"))
                    .andExpect(status().isOk());
        }
        verify(repository, times(4)).findById("load-test");
    }

    @Test
    void categoryBypassDoesNotReadOrPopulateCache() throws Exception {
        for (int i = 0; i < 2; i++) {
            mvc.perform(get("/api/load-simulation/category").param("category", "keyboards").param("useCache", "false"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$[0].id").value("load-test"));
        }
        verify(repository, times(2)).findByCategoryIgnoreCase("keyboards");
        for (int i = 0; i < 2; i++) {
            mvc.perform(get("/api/load-simulation/category").param("category", "keyboards"))
                    .andExpect(status().isOk());
        }
        verify(repository, times(3)).findByCategoryIgnoreCase("keyboards");
    }

    @Test
    void reportsMissingProductAndRejectsInvalidParameters() throws Exception {
        mvc.perform(get("/api/load-simulation/products/missing")).andExpect(status().isNotFound());
        mvc.perform(get("/api/load-simulation/category").param("category", " ")).andExpect(status().isBadRequest());
        mvc.perform(get("/api/load-simulation/category")).andExpect(status().isBadRequest());
        mvc.perform(get("/api/load-simulation/products/load-test").param("useCache", "invalid"))
                .andExpect(status().isBadRequest());
    }
}
