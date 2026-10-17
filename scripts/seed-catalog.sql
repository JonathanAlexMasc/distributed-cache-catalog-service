BEGIN;

WITH categories(category_number, category, label, base_price) AS (
    VALUES
        (0, 'keyboards', 'Mechanical Keyboard', 39.99),
        (1, 'mice', 'Wireless Mouse', 14.99),
        (2, 'monitors', 'Desktop Monitor', 149.99),
        (3, 'laptops', 'Laptop', 499.99),
        (4, 'desktops', 'Desktop Computer', 399.99),
        (5, 'headphones', 'Headphones', 29.99),
        (6, 'speakers', 'Speaker Set', 24.99),
        (7, 'webcams', 'Webcam', 19.99),
        (8, 'microphones', 'USB Microphone', 34.99),
        (9, 'storage', 'Portable SSD', 49.99),
        (10, 'memory', 'Memory Kit', 29.99),
        (11, 'graphics-cards', 'Graphics Card', 199.99),
        (12, 'processors', 'Processor', 99.99),
        (13, 'motherboards', 'Motherboard', 79.99),
        (14, 'power-supplies', 'Power Supply', 44.99),
        (15, 'computer-cases', 'Computer Case', 39.99),
        (16, 'cooling', 'Cooling Kit', 19.99),
        (17, 'networking', 'Network Router', 34.99),
        (18, 'cables', 'Cable Pack', 4.99),
        (19, 'adapters', 'USB Adapter', 9.99),
        (20, 'docking-stations', 'Docking Station', 59.99),
        (21, 'printers', 'Office Printer', 89.99),
        (22, 'tablets', 'Tablet', 129.99),
        (23, 'desks', 'Office Desk', 99.99),
        (24, 'chairs', 'Office Chair', 79.99)
), inserted AS (
    INSERT INTO products(id, name, category, price, description, version)
    SELECT
        'cache-lab-v1-' || lpad(n::text, 7, '0'),
        (ARRAY['Atlas', 'Nova', 'Vertex', 'Orbit', 'Summit'])[((n / 25) % 5 + 1)::int]
            || ' ' || label || ' ' || lpad(n::text, 7, '0'),
        category,
        base_price + ((n * 7919) % 50000)::numeric / 100,
        format('Synthetic cache experiment product %s. Category: %s. Finish: %s. ',
            n, category, (ARRAY['black', 'white', 'silver', 'green'])[(n % 4 + 1)::int])
            || repeat('Generated catalog data for repeatable read and cache experiments. ', (n % 8 + 1)::int),
        0
    FROM generate_series(1, :seed_count) AS series(n)
    JOIN categories ON category_number = (n - 1) % 25
    ON CONFLICT (id) DO NOTHING
    RETURNING id
)
SELECT count(*) AS products_added FROM inserted;

COMMIT;
ANALYZE products;

SELECT count(*) AS total_products,
       count(*) FILTER (WHERE id LIKE 'cache-lab-v1-%') AS generated_products,
       count(DISTINCT category) AS total_categories
FROM products;

SELECT category, count(*) AS generated_products, min(price) AS min_price, max(price) AS max_price
FROM products
WHERE id LIKE 'cache-lab-v1-%'
GROUP BY category
ORDER BY category;
