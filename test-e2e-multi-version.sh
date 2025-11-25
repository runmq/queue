#!/bin/bash

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

print_version() {
    echo -e "${BLUE}[VERSION]${NC} $1"
}

cleanup() {
    print_status "Cleaning up..."
    $DOCKER_COMPOSE down -v
    exit $1
}

trap 'cleanup $?' EXIT

if ! command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE="docker compose"
else
    DOCKER_COMPOSE="docker-compose"
fi

# RabbitMQ versions to test (minor versions from 3.9 to latest 4.x)
RABBITMQ_VERSIONS=(
    "3.9-management"
    "3.10-management"
    "3.11-management"
    "3.12-management"
    "3.13-management"
    "4.0-management"
    "4.1-management"
)

print_status "Starting RunMQ Multi-Version E2E Test Suite"

if ! docker info >/dev/null 2>&1; then
    print_error "Docker is not running. Please start Docker and try again."
    exit 1
fi

if ! command -v $DOCKER_COMPOSE &> /dev/null; then
    print_error "$DOCKER_COMPOSE is not installed or not in PATH."
    exit 1
fi

# Track test results
FAILED_VERSIONS=()
PASSED_VERSIONS=()

# Run tests for each version
for VERSION in "${RABBITMQ_VERSIONS[@]}"; do
    print_version "Testing with RabbitMQ $VERSION"
    
    # Export version for docker-compose
    export RABBITMQ_VERSION="$VERSION"
    
    print_status "Stopping any existing test containers..."
    $DOCKER_COMPOSE down -v
    
    print_status "Starting RabbitMQ container (version: $VERSION)..."
    $DOCKER_COMPOSE up -d rabbitmq
    
    print_status "Waiting for RabbitMQ to be ready..."
    RETRY_COUNT=0
    MAX_RETRIES=30
    
    while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
        # Check if container is running
        CONTAINER_STATUS=$($DOCKER_COMPOSE ps -q rabbitmq | xargs docker inspect -f '{{.State.Status}}' 2>/dev/null || echo "not_found")
        print_warning "RabbitMQ container status: $CONTAINER_STATUS"
        if [ "$CONTAINER_STATUS" = "exited" ] || [ "$CONTAINER_STATUS" = "" ]; then
            print_warning "RabbitMQ container exited or not found. Restarting..."
            $DOCKER_COMPOSE up -d rabbitmq
            sleep 5
        fi
        
        if $DOCKER_COMPOSE exec -T rabbitmq rabbitmq-diagnostics -q ping >/dev/null 2>&1; then
            print_status "RabbitMQ is ready!"
            break
        fi
        
        RETRY_COUNT=$((RETRY_COUNT + 1))
        print_status "Waiting for RabbitMQ... (attempt $RETRY_COUNT/$MAX_RETRIES)"
        sleep 2
    done
    
    if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
        print_error "RabbitMQ $VERSION failed to start within expected time"
        $DOCKER_COMPOSE logs rabbitmq
        FAILED_VERSIONS+=("$VERSION")
        continue
    fi
    
    print_status "Waiting additional 5 seconds for RabbitMQ to fully initialize..."
    sleep 5
    
    print_status "Verifying RabbitMQ connection..."
    if ! nc -z localhost 5673; then
        print_error "Cannot connect to RabbitMQ $VERSION on port 5673"
        print_status "RabbitMQ container logs:"
        $DOCKER_COMPOSE logs rabbitmq
        FAILED_VERSIONS+=("$VERSION")
        continue
    fi
    
    print_status "RabbitMQ is accessible on port 5673"
    
    print_status "Running unit tests..."
    if ! npm run test:unit; then
        print_error "Unit tests failed for RabbitMQ $VERSION"
        FAILED_VERSIONS+=("$VERSION")
        continue
    fi
    
    print_status "Unit tests passed!"
    
    print_status "Running E2E tests..."
    if ! npm run test:e2e; then
        print_error "E2E tests failed for RabbitMQ $VERSION"
        print_status "RabbitMQ container logs:"
        $DOCKER_COMPOSE logs rabbitmq
        FAILED_VERSIONS+=("$VERSION")
        continue
    fi
    
    print_status "All tests passed for RabbitMQ $VERSION!"
    PASSED_VERSIONS+=("$VERSION")
    
    # Clean up before next version
    $DOCKER_COMPOSE down -v
    sleep 2
done

# Summary
echo
echo -e "${BLUE}====== Test Summary ======${NC}"
echo

if [ ${#PASSED_VERSIONS[@]} -gt 0 ]; then
    echo -e "${GREEN}Passed versions (${#PASSED_VERSIONS[@]}):${NC}"
    for VERSION in "${PASSED_VERSIONS[@]}"; do
        echo -e "  ✓ $VERSION"
    done
fi

if [ ${#FAILED_VERSIONS[@]} -gt 0 ]; then
    echo
    echo -e "${RED}Failed versions (${#FAILED_VERSIONS[@]}):${NC}"
    for VERSION in "${FAILED_VERSIONS[@]}"; do
        echo -e "  ✗ $VERSION"
    done
fi

echo
echo -e "${BLUE}=========================${NC}"

# Exit with error if any version failed
if [ ${#FAILED_VERSIONS[@]} -gt 0 ]; then
    print_error "Some versions failed. Please check the logs above."
    exit 1
else
    print_status "All versions passed successfully!"
fi