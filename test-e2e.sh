#!/bin/bash

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

cleanup() {
    print_status "Cleaning up..."
    docker compose down -v
    exit $1
}

trap 'cleanup $?' EXIT

print_status "Starting RunMQ E2E Test Suite"

if ! docker info >/dev/null 2>&1; then
    print_error "Docker is not running. Please start Docker and try again."
    exit 1
fi

if ! command -v docker compose &> /dev/null; then
    print_error "docker compose is not installed or not in PATH."
    exit 1
fi

print_status "Stopping any existing test containers..."
docker compose down -v

sleep 2

print_status "Starting RabbitMQ container..."
docker compose up -d rabbitmq

sleep 3

print_status "Waiting for RabbitMQ to be ready..."
RETRY_COUNT=0
MAX_RETRIES=30

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if docker compose exec -T rabbitmq rabbitmq-diagnostics -q ping >/dev/null 2>&1; then
        print_status "RabbitMQ is ready!"
        break
    fi

    if ! docker compose ps rabbitmq | grep -q "Up"; then
        print_error "RabbitMQ container is not running"
        print_status "Container status:"
        docker compose ps rabbitmq
        print_status "RabbitMQ container logs:"
        docker compose logs rabbitmq
        exit 1
    fi

    RETRY_COUNT=$((RETRY_COUNT + 1))
    print_status "Waiting for RabbitMQ... (attempt $RETRY_COUNT/$MAX_RETRIES)"
    sleep 2
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    print_error "RabbitMQ failed to start within expected time"
    docker compose logs rabbitmq
    exit 1
fi

print_status "Waiting additional 5 seconds for RabbitMQ to fully initialize..."
sleep 5

print_status "Verifying RabbitMQ connection..."
if ! nc -z localhost 5673; then
    print_error "Cannot connect to RabbitMQ on port 5673"
    print_status "RabbitMQ container logs:"
    docker compose logs rabbitmq
    exit 1
fi

print_status "RabbitMQ is accessible on port 5673"

print_status "Running unit tests..."
if ! npm run test:unit; then
    print_error "Unit tests failed"
    exit 1
fi

print_status "Unit tests passed!"

print_status "Running E2E tests..."
if ! npm run test:e2e; then
    print_error "E2E tests failed"
    print_status "RabbitMQ container logs:"
    docker compose logs rabbitmq
    exit 1
fi

print_status "All tests passed successfully!"

print_status "RabbitMQ Management UI is available at: http://localhost:15673"
print_status "Username: test, Password: test"

print_status "Test suite completed successfully!"