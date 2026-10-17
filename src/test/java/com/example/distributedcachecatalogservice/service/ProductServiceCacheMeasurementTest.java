package com.example.distributedcachecatalogservice.service;

import com.example.distributedcachecatalogservice.model.Product;
import com.example.distributedcachecatalogservice.repository.ProductRepository;
import com.github.benmanes.caffeine.cache.Cache;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.CacheManager;
import org.springframework.cache.caffeine.CaffeineCache;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@ActiveProfiles("test")
class ProductServiceCacheMeasurementTest {
    private static final String PRODUCT_ID = "measurement-product";
    private static final int WARMUP_READS = 100;
    private static final int MEASURED_READS = 1_000;

    @Autowired
    private ProductService service;

    @Autowired
    private ProductRepository repository;

    @Autowired
    private CacheManager cacheManager;

    @BeforeEach
    void setUp() {
        repository.deleteAll();
        cache().invalidateAll();
        repository.save(new Product(
                PRODUCT_ID, "Measurement Product", "electronics", new BigDecimal("49.99"), "Benchmark data"));
    }

    @Test
    void measuresCachedAndUncachedReads() {
        warmUpUncachedReads();
        long uncachedNanos = measureUncachedReads();

        cache().invalidateAll();
        service.getById(PRODUCT_ID);
        warmUpCachedReads();
        long cachedNanos = measureCachedReads();

        assertThat(cache().stats().missCount()).isGreaterThanOrEqualTo(MEASURED_READS);
        assertThat(cache().stats().hitCount()).isGreaterThanOrEqualTo(MEASURED_READS);

        System.out.printf(
                "Cache measurement: uncached avg=%d ns/read, cached avg=%d ns/read, speedup=%.2fx%n",
                uncachedNanos / MEASURED_READS,
                cachedNanos / MEASURED_READS,
                (double) uncachedNanos / cachedNanos);
    }

    private void warmUpUncachedReads() {
        for (int i = 0; i < WARMUP_READS; i++) {
            cache().invalidate(PRODUCT_ID);
            service.getById(PRODUCT_ID);
        }
    }

    private long measureUncachedReads() {
        long totalNanos = 0;
        for (int i = 0; i < MEASURED_READS; i++) {
            cache().invalidate(PRODUCT_ID);
            long start = System.nanoTime();
            service.getById(PRODUCT_ID);
            totalNanos += System.nanoTime() - start;
        }
        return totalNanos;
    }

    private void warmUpCachedReads() {
        for (int i = 0; i < WARMUP_READS; i++) {
            service.getById(PRODUCT_ID);
        }
    }

    private long measureCachedReads() {
        long start = System.nanoTime();
        for (int i = 0; i < MEASURED_READS; i++) {
            service.getById(PRODUCT_ID);
        }
        return System.nanoTime() - start;
    }

    @SuppressWarnings("unchecked")
    private Cache<Object, Object> cache() {
        return (Cache<Object, Object>) ((CaffeineCache) cacheManager.getCache("products")).getNativeCache();
    }
}
