# Distributed Cache Catalog Service

A Spring Boot catalog API backed by PostgreSQL for local development and H2 for tests.

## Requirements

- Java 21
- Docker and Docker Compose
- macOS/Linux: use `./gradlew`
- Windows: use `gradlew.bat`

The Gradle wrapper downloads and uses the project-configured Gradle version. You do not need to install Gradle separately.

## Quick Start

Start the PostgreSQL database:

```bash
docker compose up -d
```

Run the application:

```bash
./gradlew bootRun
```

The API is available at `http://localhost:8080`.

Stop PostgreSQL when finished:

```bash
docker compose down
```

The database data is stored in the named Docker volume `catalog-postgres-data`, so it remains available after the container is stopped.

## Cache Experiment Data

Populate the local Compose PostgreSQL database with 100,000 synthetic products:

```bash
docker compose up -d postgres
bash scripts/seed-catalog.sh
```

The generator adds 25 categories with 4,000 products each, varied prices and
descriptions, and version `0`. It preserves existing products. IDs range from
`cache-lab-v1-0000001` to `cache-lab-v1-0100000`. Rerunning skips existing IDs;
passing a larger count extends the dataset without replacing edited products.
Counts from 1 to 1,000,000 are supported:

```bash
bash scripts/seed-catalog.sh 200000
```

This script targets the Compose `postgres` service and `catalog` database directly,
independent of the application's `DB_URL`. It uses bulk SQL instead of HTTP, so
restart the application after seeding to clear cached category results (or wait
for their 10-minute expiry). Refresh the browser to reload category options.

Example requests:

```bash
curl http://localhost:8080/products/cache-lab-v1-0000001
curl 'http://localhost:8080/products?category=monitors'
```

For cache hits, repeatedly read a small set of IDs. For capacity evictions, read
more than 1,000 distinct IDs through one application instance. Large category
responses also let you observe serialization and transfer costs even on hits.

## Cache Load Simulation

Enable the experiment endpoints when starting the local application:

```bash
LOAD_SIMULATION_ENABLED=true ./gradlew bootRun
```

Open [Load simulation](http://localhost:8080/load.html), or use the navigation
from the product UI. Choose a product ID or category, request count, concurrency,
and cache mode. The default compares 10,000 bypass requests with 10,000 cached
requests against `cache-lab-v1-0000001`. Authorize the load, then start the experiment.

Cached runs use the regular Caffeine service methods. Bypass runs call the same
repository queries without reading or populating Caffeine. One bypass preflight
checks the target and response size, and five cached warmup requests precede each
cached phase; these requests are excluded from measurements. No cache is cleared.
Both browser fetches and HTTP responses disable browser caching.

Results include full-response HTTP latency (average and P95 for successful reads),
completed-request throughput, duration, success rate, and bounded error logs.
Compare mode runs bypass first and cached second with identical target/count/
concurrency settings. CSV exports include the target, settings, timestamp, bytes,
errors, and partial/cancelled status. These are client-observed HTTP measurements;
category serialization and transfer time are included, and browser connection
limits can constrain effective concurrency.

The UI permits up to 100,000 product requests at concurrency 20, or 1,000 category
requests at concurrency 4. Category mode defaults to 10 requests because seeded
categories contain thousands of products. A 256 MiB projected response-data budget
applies across comparison phases, with an additional runtime byte cutoff. Each
phase stops after two minutes or 20 errors, and each request times out after ten
seconds. Stop cancels outstanding client requests and retains partial results;
server queries already in progress may finish. Navigating away aborts the runner.

Only one experiment runs at a time in a page. These UI guardrails are not a global
server rate limiter. Experiment reads return 403 unless `LOAD_SIMULATION_ENABLED`
is enabled; leave it disabled on deployed environments. Existing product API
behavior is unchanged. Refresh the page after enabling it and restarting the app.

Run the worker-pool checks with Node.js 20+:

```bash
node --test scripts/load-runner.test.mjs
```

## Configuration

The application connects to PostgreSQL using these environment variables:

| Variable | Default |
| --- | --- |
| `DB_URL` | `jdbc:postgresql://localhost:5432/catalog` |
| `DB_USERNAME` | `catalog` |
| `DB_PASSWORD` | `catalog` |

Example with a custom database:

```bash
DB_URL=jdbc:postgresql://localhost:5432/catalog \
DB_USERNAME=catalog \
DB_PASSWORD=change-me \
./gradlew bootRun
```

The schema is initialized from `src/main/resources/schema.sql` when the application starts.

## Gradle Commands

Run all tests:

```bash
./gradlew test
```

The cache measurement runs as part of the test suite and prints average read
time for uncached and cached product lookups, along with the observed speedup:

```bash
./gradlew test --tests '*ProductServiceCacheMeasurementTest'
```

Tests use the `test` profile and an in-memory H2 database. PostgreSQL does not need to be running for the test suite.

Build, test, and package the application:

```bash
./gradlew build
```

Create the executable Spring Boot JAR:

```bash
./gradlew bootJar
```

The JAR is written to `build/libs/`.

Run the packaged application:

```bash
java -jar build/libs/DistributedCacheCatalogService-0.0.1-SNAPSHOT.jar
```

Remove generated build output:

```bash
./gradlew clean
```

List all available Gradle tasks:

```bash
./gradlew tasks --all
```

Use the Windows wrapper equivalent where applicable:

```bat
gradlew.bat test
gradlew.bat bootRun
gradlew.bat build
```

## API Examples

Create a product:

```bash
curl -i -X POST http://localhost:8080/products \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Mechanical Keyboard",
    "category": "keyboards",
    "price": 99.99,
    "description": "A compact mechanical keyboard"
  }'
```

Retrieve a product by ID:

```bash
curl -i http://localhost:8080/products/{id}
```

Find products by category:

```bash
curl -i 'http://localhost:8080/products?category=keyboards'
```

Update a product:

```bash
curl -i -X PUT http://localhost:8080/products/{id} \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Mechanical Keyboard Pro",
    "category": "keyboards",
    "price": 129.99,
    "description": "An upgraded compact mechanical keyboard"
  }'
```

Product request rules:

- `name` is required and cannot be blank.
- `category` is required and cannot be blank.
- `price` is required and must be at least `0.0`.
- `description` is optional.

## Database Commands

Start PostgreSQL in the background:

```bash
docker compose up -d postgres
```

View PostgreSQL logs:

```bash
docker compose logs -f postgres
```

Open a PostgreSQL shell inside the container:

```bash
docker exec -it catalog-postgres psql -U catalog -d catalog
```

Stop the database without removing its stored data:

```bash
docker compose stop postgres
```

Stop the database and remove the container and network:

```bash
docker compose down
```

To remove the stored database volume as well, use the following command. This permanently deletes local PostgreSQL data:

```bash
docker compose down -v
```

## Deployment Status

The repository currently supports deployment by building and running the executable JAR:

```bash
./gradlew clean build
java -jar build/libs/DistributedCacheCatalogService-0.0.1-SNAPSHOT.jar
```

For a deployed environment, set `DB_URL`, `DB_USERNAME`, and `DB_PASSWORD` before starting the JAR, and ensure the database is reachable from the application host.

The following deployment workflows are not implemented yet:

- Building a Docker image for the API
- Running the API and PostgreSQL together through Docker Compose
- Production-specific environment/configuration files
- VPS provisioning or deployment scripts

## Project Tasks

See [`TASKS.md`](TASKS.md) for planned work, including caching, additional API tests, and production deployment support.
