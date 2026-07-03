# ── Build stage ─────────────────────────────────────────────────────────────
FROM eclipse-temurin:17-jdk-alpine AS builder

RUN apk add --no-cache maven
WORKDIR /app

# Download dependencies first (layer cache)
COPY pom.xml .
RUN mvn dependency:go-offline -B -q

COPY src ./src
RUN mvn clean package -DskipTests -q

# ── Runtime stage (JRE only — ~120 MB smaller) ────────────────────────────
FROM eclipse-temurin:17-jre-alpine

WORKDIR /app
COPY --from=builder /app/target/transaction-service-1.0.0.jar app.jar

EXPOSE 3004
ENTRYPOINT ["java", "-jar", "app.jar"]
