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
