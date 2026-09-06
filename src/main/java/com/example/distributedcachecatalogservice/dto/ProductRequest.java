package com.example.distributedcachecatalogservice.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record ProductRequest(
        @NotBlank String name,
        @NotBlank String category,
        @NotNull @DecimalMin("0.0") Double price,
        String description
) {}
