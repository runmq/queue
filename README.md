# RunMQ

RunMQ is a reliable message queue library for Node.js built on top of RabbitMQ. Supports async background processing and event-driven messaging for microservices, with automatic retries, schema validation, and DLQ.

RunMQ can be used to implement two main patterns:
- **Event Bus** for event-driven microservices architectures, where multiple services independently react to the same events
- **Job Queue** for async background task processing, with retries and dead letter queues

## Features

- **Automatic Connection Management**: Built-in retry logic with configurable attempts and delays
- **Message Processing with Retries**: Automatic retry mechanism for failed messages with configurable retry delays
- **Dead Letter Queue (DLQ) Support**: Failed messages automatically move to DLQ after exhausting retry attempts
- **Isolated Queues**: Each processor maintains its own queue and DLQ, ensuring complete isolation between services
- **Schema Validation**: Optional message validation using JSON Schema (AJV)
- **Concurrent Processing**: Support for multiple concurrent consumers per queue
- **Correlation ID Support**: Built-in correlation ID generation and tracking for distributed tracing
- **Custom Logging**: Pluggable logging interface with default console logger

## Installation

```bash
npm install runmq
```

## Architecture Overview

RunMQ can be used to implement various messaging patterns. Here are two common architectures:

### 1. Event-Driven Architecture (Event Bus Pattern)

In this pattern, multiple processors (or services) subscribe to the same event topic. Each processor gets its own isolated queue and DLQ, enabling true microservices autonomy.

```
Publisher → Topic (user.created)
              ├→ Queue: emailService      → DLQ: emailService_dlq
              ├→ Queue: analyticsService  → DLQ: analyticsService_dlq
              └→ Queue: notificationService → DLQ: notificationService_dlq
```

**Key Benefits:**
- Services remain independent and isolated
- Each service can fail/retry without affecting others
- Easy to add new services by subscribing to existing events
- Natural implementation of CQRS and event sourcing patterns

### 2. Background Processing Pattern

RunMQ can also be used as a job queue for background processing tasks. A single worker service processes jobs from a dedicated queue with retries and DLQ support.

```
Publisher → Topic (email.send) → Queue: emailWorker → DLQ: emailWorker_dlq
```

**Key Benefits:**
- Simple async job processing
- Automatic retries for failed jobs
- Scalable with multiple concurrent workers
- Dead letter queue for failed job analysis

## Quick Start

### Basic Setup

```typescript
import { RunMQ } from 'runmq';

// 1. Initialize RunMQ
const runMQ = await RunMQ.start({
    url: 'amqp://localhost:5672',
    reconnectDelay: 5000,        // optional, default: 5000ms
    maxReconnectAttempts: 5      // optional, default: 5
});

// 2. Process messages (create a consumer)
await runMQ.process('user.created', {
    name: 'emailService',        // Unique processor name (creates isolated queue)
    consumersCount: 2,           // Number of concurrent workers
    attempts: 3,                 // Try processing a message up to 3 times
    attemptsDelay: 2000            // Wait 2 seconds between retries
}, async (message) => {
    // Your processing logic here
    console.log('Received:', message.message);
    await sendEmail(message.message);
});

// 3. Publish messages
runMQ.publish('user.created', {
    userId: '123',
    email: 'user@example.com',
    name: 'John Doe'
});

// That's it! The message will be delivered to all processors subscribed to 'user.created'
```

## Event-Driven Architecture Example

One of the most powerful patterns with RunMQ is the Event Bus pattern, where multiple services independently react to the same events.
The main advantage is that each service has its own isolated queue and dead letter queue, allowing for true microservices autonomy
Publishing a single message (event) results in multiple services receiving and processing it independently.

### Scenario: User Registration System

When a user registers, multiple services need to react independently.

```typescript
import { RunMQ, RunMQMessage } from 'runmq';

interface UserCreatedEvent {
  userId: string;
  email: string;
  name: string;
  createdAt: string;
}

// Initialize RunMQ in each service
const runMQ = await RunMQ.start({
  url: 'amqp://localhost:5672'
});

// ============================================
// SERVICE 1: Email Service
// ============================================
await runMQ.process<UserCreatedEvent>('user.created', {
  name: 'emailService',        // Creates queue: emailService
  consumersCount: 2,
  attempts: 3,
  attemptsDelay: 2000
}, async (message: RunMQMessage<UserCreatedEvent>) => {
  console.log(`[Email Service] Sending welcome email to ${message.message.email}`);
  await sendWelcomeEmail(message.message);
});

// ============================================
// SERVICE 2: Analytics Service
// ============================================
await runMQ.process<UserCreatedEvent>('user.created', {
  name: 'analyticsService',    // Creates queue: analyticsService
  consumersCount: 1,
  attempts: 3
}, async (message: RunMQMessage<UserCreatedEvent>) => {
  console.log(`[Analytics] Recording user registration for ${message.message.userId}`);
  await trackUserRegistration(message.message);
});

// ============================================
// SERVICE 3: Notification Service
// ============================================
await runMQ.process<UserCreatedEvent>('user.created', {
  name: 'notificationService', // Creates queue: notificationService
  consumersCount: 3,
  attempts: 5,
  attemptsDelay: 1000
}, async (message: RunMQMessage<UserCreatedEvent>) => {
  console.log(`[Notifications] Sending push notification to ${message.message.userId}`);
  await sendPushNotification(message.message);
});

// ============================================
// PUBLISHER: User Registration Handler
// ============================================
// When a user registers, publish one event
runMQ.publish('user.created', {
  userId: 'user-123',
  email: 'john@example.com',
  name: 'John Doe',
  createdAt: new Date().toISOString()
});

// All three services receive the event independently!
```

### Adding a New Processor

Want to add a new service? Just subscribe to existing events:

```typescript
// NEW SERVICE 4: CRM Sync Service
await runMQ.process<UserCreatedEvent>('user.created', {
  name: 'crmSyncService',      // Creates new isolated queue
  consumersCount: 1,
  attempts: 3
}, async (message: RunMQMessage<UserCreatedEvent>) => {
  console.log(`[CRM] Syncing user to CRM: ${message.message.userId}`);
  await syncToCRM(message.message);
});

// This new service automatically receives all future user.created events
// No changes needed to existing services!
```

## Job Queue Pattern Example

### Scenario: Background Email Processing

Use RunMQ for async job processing with a single worker service.

```typescript
import { RunMQ, RunMQMessage } from 'runmq';

interface EmailJob {
  to: string;
  subject: string;
  body: string;
  attachments?: string[];
}

const runMQ = await RunMQ.start({
  url: 'amqp://localhost:5672'
});

// ============================================
// WORKER: Email Processing Service
// ============================================
await runMQ.process<EmailJob>('email.send', {
  name: 'emailWorker',         // Single queue for job processing
  consumersCount: 5,           // 5 concurrent workers
  attempts: 3,
  attemptsDelay: 5000,
  messageSchema: {
    type: 'ajv',
    schema: {
      type: 'object',
      properties: {
        to: { type: 'string', format: 'email' },
        subject: { type: 'string' },
        body: { type: 'string' },
        attachments: { 
          type: 'array', 
          items: { type: 'string' } 
        }
      },
      required: ['to', 'subject', 'body']
    },
    failureStrategy: 'dlq'
  }
}, async (message: RunMQMessage<EmailJob>) => {
  console.log(`[Worker] Sending email to ${message.message.to}`);
  
  await sendEmail({
    to: message.message.to,
    subject: message.message.subject,
    body: message.message.body,
    attachments: message.message.attachments
  });
  
  console.log(`[Worker] Email sent successfully to ${message.message.to}`);
});

// ============================================
// PUBLISHER: API Endpoint
// ============================================
// Your API can now queue emails for background processing
app.post('/api/send-email', async (req, res) => {
  const { to, subject, body } = req.body;
  
  // Queue the job - returns immediately
  runMQ.publish('email.send', {
    to,
    subject,
    body,
    attachments: []
  });
  
  res.json({ status: 'queued' });
});
```

### Job Processing Flow

```
API Request → Publish Job → Queue (emailWorker)
                              ↓
                         5 Concurrent Workers
                              ↓
                      [Success] or [Try processing for 3 times]
                              ↓
                      [Final Failure] → DLQ (emailWorker_dlq)
```

## Advanced Examples

### Event Choreography with Multiple Events

Build complex workflows by publishing new events from processors:

```typescript
// Order Service - publishes order.placed
await runMQ.process('order.placed', {
  name: 'paymentService',
  consumersCount: 2,
  attempts: 3
}, async (message) => {
  const payment = await processPayment(message.message);
  
  if (payment.success) {
    // Trigger next event in the workflow
    runMQ.publish('payment.completed', {
      orderId: message.message.orderId,
      paymentId: payment.id,
      amount: payment.amount
    }, message.meta.correlationId);  // Preserve correlation ID
  }
});

// Inventory Service - reacts to payment.completed
await runMQ.process('payment.completed', {
  name: 'inventoryService',
  consumersCount: 3,
  attempts: 5
}, async (message) => {
  await reserveInventory(message.message.orderId);
  
  // Trigger next step
  runMQ.publish('inventory.reserved', {
    orderId: message.message.orderId
  }, message.meta.correlationId);
});

// Shipping Service - reacts to inventory.reserved
await runMQ.process('inventory.reserved', {
  name: 'shippingService',
  consumersCount: 2,
  attempts: 3
}, async (message) => {
  await scheduleShipment(message.message.orderId);
  
  runMQ.publish('order.fulfilled', {
    orderId: message.message.orderId,
    fulfilledAt: new Date().toISOString()
  }, message.meta.correlationId);
});
```

### Schema Validation

RunMQ supports JSON schema validation to ensure message integrity, so only valid messages are passed to your processors
Currently, only AJV is supported for schema validation, with a single failure strategy of sending invalid messages to the DLQ in the meantime.
if the schema validation fails, the message is sent directly to the DLQ without being processed.

```typescript
const orderSchema = {
  type: 'object',
  properties: {
    orderId: { type: 'string', pattern: '^ORD-[0-9]+$' },
    customerId: { type: 'string' },
    items: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        properties: {
          sku: { type: 'string' },
          quantity: { type: 'number', minimum: 1 },
          price: { type: 'number', minimum: 0 }
        },
        required: ['sku', 'quantity', 'price']
      }
    },
    total: { type: 'number', minimum: 0 }
  },
  required: ['orderId', 'customerId', 'items', 'total']
};

await runMQ.process('order.placed', {
  name: 'orderProcessor',
  consumersCount: 3,
  attempts: 3,
  messageSchema: {
    type: 'ajv',
    schema: orderSchema,
    failureStrategy: 'dlq'  // Invalid messages go straight to DLQ
  }
}, async (message) => {
  // Message is guaranteed to be valid
  await processOrder(message.message);
});
```

## Configuration

### Connection Configuration

```typescript
interface RunMQConnectionConfig {
  url: string;                    // The URL of the RabbitMQ server.
  reconnectDelay?: number;        // The delay in milliseconds before attempting to reconnect after a disconnection (default: 5000)
  maxReconnectAttempts?: number;  // Maximum reconnection attempts (default: 5)
}
```

### Processor Configuration

```typescript
interface RunMQProcessorConfiguration {
  name: string;                   //  The name of the processor, used to create isolated queues for each processor.
  consumersCount: number;         // The number of concurrent consumers to run for this processor.
  attempts?: number;             // The maximum number attempts processing a message, default is 1 attempt.
  attemptsDelay?: number;           // The delay in milliseconds between attempts.
  messageSchema?: MessageSchema; // The schema configuration for message validation.
}
```

### Message Schema Configuration

```typescript
interface MessageSchema {
  type: 'ajv';                   // The type of schema used for validation (Currently only 'ajv').
  schema: any;                   // The schema definition of the chosen schemaType, used for validating messages.
  failureStrategy: 'dlq';        // The strategy to apply when schema validation fails (e.g., 'dlq').
}
```

## Message Structure

```typescript
interface RunMQMessageContent<T> {
  message: T;                    // Your message payload
  meta: {
    id: string;                  // The unique identifier of the message.
    publishedAt: number;         // The timestamp when the message was published.
    correlationId: string;       // The correlation identifier.
  }
}
```

## Queue Isolation and Naming

**Important:** Each processor creates an isolated queue based on its `name` parameter:

- Queue name: `{processor.name}`
- DLQ name: `{processor.name}_dlq`

This ensures:
- ✅ Processors can't interfere with each other
- ✅ Each processor controls its own retry logic
- ✅ Failed messages are isolated per processor
- ✅ Easy to monitor and debug per-processor queues

Example:
```typescript
// Creates queue: userEmailService and userEmailService_dlq
await runMQ.process('user.created', { name: 'userEmailService', ... }, handler);

// Creates queue: userAnalytics and userAnalytics_dlq
await runMQ.process('user.created', { name: 'userAnalytics', ... }, handler);
```

## Custom Logger

```typescript
import { RunMQLogger } from 'runmq';

class CustomLogger implements RunMQLogger {
  log(message: string): void {
    // Your logging implementation
  }
  
  error(message: string, error?: any): void {
    // Your error logging implementation
  }
}

const runMQ = await RunMQ.start(config, new CustomLogger());
```

## License

MIT