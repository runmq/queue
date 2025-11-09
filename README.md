<div align="center">
  <img width="1479" height="612" alt="RunMQ-logo (4)" src="https://github.com/user-attachments/assets/50dc9187-26f9-4073-979b-31601c652e1f" />
   <a href="https://www.npmjs.com/package/runmq">
     <img src="https://badge.fury.io/js/runmq.svg?icon=si%3Anpm" alt="npm version" height="18">
   </a>
    <a href="https://github.com/semantic-release/semantic-release">
      <img src="https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg"/>
    </a>
</div>


<b>RunMQ</b> is a high-performance message queue library for <b>Node.js</b>, built on top of <b>RabbitMQ</b>’s rock-solid messaging guarantees.

It combines RabbitMQ’s proven reliability with a modern developer experience — offering simple APIs, built-in fault tolerance, and seamless scaling for distributed systems.

Whether you’re running <b>background jobs</b>, designing an <b>event-driven architecture</b>, or managing a <b>pub/sub event bus</b>, RunMQ provides everything you need — all in a <b>lightweight package</b> with a <b>simple DX</b>, <b>without the hassle of managing everything on your own</b>.


## Features

- **Reliable Message Processing with Retries**: Automatically retries failed messages with configurable delays and retry limits.
- **Dead Letter Queue (DLQ) Support**: Failed messages are seamlessly routed to a DLQ after all retry attempts are exhausted.
- **Pub/Sub with Atomic Delivery**: Publish a message once, and all subscribed consumers receive it atomically, without the need to publish multiple times.
- **Isolated Queues per Processor**: Each processor gets its own dedicated queue and DLQ, ensuring full isolation and predictable behavior across services.
- **Schema Validation**: Optional JSON Schema validation powered by AJV for safer message handling and data integrity.
- **Concurrent Consumers**: Scale either horizontally (multiple instances) or vertically (multiple consumers per queue, leveraging RabbitMQ prefetch) to maximize throughput and efficiency.
- **RabbitMQ Durability & Acknowledgements**: Leverages RabbitMQ’s persistent storage and acknowledgment model to guarantee at-least-once delivery, even across restarts and failures.
- **Custom Logging**: Plug in your own logger or use the default console logger for full control over message visibility.

## Installation

```bash
npm install runmq
```

## Quick Start

### Initialize RunMQ
The first step is to connect to RabbitMQ

```typescript
const runMQ = await RunMQ.start({
    url: 'amqp://localhost:5672',
    reconnectDelay: 5000,        // Optional, default: 5000ms
    maxReconnectAttempts: 5,     // Optional, default: 5
    management: {
        url: "http://localhost:15673",
        username: "guest",
        password: "guest"
    };
});
```

#### Notes: 
- `reconnectDelay` defines the wait time between reconnection attempts.
- `maxReconnectAttempts` limits the number of retries when RabbitMQ is unavailable.
- Management configuration is optional but **highly recommended** to enables dynamic TTL via RabbitMQ policies; otherwise, RunMQ uses queue-based TTL.

### Processing side

It’s important that processors run before publishing messages, because queues are created internally when a consumer starts for the first time.

```typescript
import { RunMQ } from 'runmq';

// Processor 1: Email Service
await runMQ.process('user.created', {
    name: 'emailService',        // Unique processor name (creates an isolated queue)
    consumersCount: 2,           // Process up to 2 messages concurrently
    attempts: 3,                 // Retry failed messages up to 3 times
    attemptsDelay: 2000,         // Wait 2 seconds between retries
    usePoliciesForDelay: true    // highly recommended, default is false
}, async (message) => {
    console.log('EmailService received:', message.message);
    await sendEmail(message.message);
});

// Processor 2: SMS Service
await runMQ.process('user.created', {
    name: 'smsService',          // Unique processor name (separate queue)
    consumersCount: 1,           // Process 1 message at a time
    attempts: 5,                 // Retry failed messages up to 5 times
    attemptsDelay: 1000,          // Wait 1 second between retries,
    usePoliciesForDelay: true    // highly recommended, default is false
}, async (message) => {
    console.log('SMSService received:', message.message);
    await sendSMS(message.message);
});
```

#### Notes:
- `name` is the unique identifier for each processor.
- RunMQ supports <b>Pub/Sub</b> out-of-the-box: multiple processors can consume the same message independently.
  - Example: When a user is created, one processor can send an email verification while another sends an SMS. 
- Each processor can have its own configuration for:
  - `attempts` How many the message will be retried
  - `attemptsDelay` The delay between attempts, and if management config is provided, it can be changed anytime!
  - `consumersCount` The concurrency level, how many messages can be processed in the same time.
  - `usePoliciesForDelay` Enable this to let RunMQ use policies for defining delay queue TTL. Highly recommended, as it allows you to adjust delay times dynamically without re-declaring queues.

### Publishing side

```typescript
runMQ.publish('user.created', {
    userId: '123',
    email: 'user@example.com',
    name: 'John Doe'
});
```

✅ Each processor receives the message independently without needing multiple publishes.

<br>

## Patterns in details 

RunMQ can be used to implement various messaging patterns. Two common architectures are:

### 1. Event-Driven Architecture (Event Bus Pattern)

The Event Bus pattern allows multiple services (or processors) to react independently to the same events. Each service has its own queue and DLQ, ensuring full isolation and autonomy.

```
Publisher → Topic (user.created)
              ├→ Queue: emailService       → DLQ: emailService_dlq
              ├→ Queue: analyticsService   → DLQ: analyticsService_dlq
              └→ Queue: notificationService → DLQ: notificationService_dlq
```

**Key insights:**
- Publishing a single message delivers it to all processors subscribed to the topic.
- Each processor can have its own retry policy, consumer count, and delay configuration.
- Easily add new services by subscribing to existing topics.
- Dead Letter Queues allow failed messages to be captured without affecting other services.
- This architecture ensures microservices autonomy, reliability, and scalability.
- Schema validation ensures that only valid messages are processed; invalid messages can be routed to the DLQ automatically.

### 2. Background Processing Pattern

RunMQ can also act as a job queue for background tasks. A worker service processes jobs from a dedicated queue with retries and DLQ support.

```
Publisher → Topic (email.send) → Queue: emailWorker → DLQ: emailWorker_dlq
```

**Key insights:**
- Dead Letter Queues allow failed messages to be captured without affecting other services.
- Schema validation ensures that only valid messages are processed; invalid messages can be routed to the DLQ automatically.
- Multiple concurrent workers can process jobs in parallel for high throughput.
- at anytime could be transformed into Event-Driven Architecture by adding more processors to the same topic.

<br>

## Advanced Features

### Schema Validation

RunMQ supports JSON Schema validation to ensure message integrity, so only valid messages are passed to your processors.
- Currently, AJV is supported for schema validation.
- Invalid messages are sent directly to the DLQ without being sent to the processor.

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
**Key insights:**
- Schema validation enforces message correctness before processing, reducing runtime errors.
- Only messages matching the schema reach your business logic.
- DLQ ensures that invalid messages are captured and can be inspected later.

### Policies for attempts delay

RunMQ can leverage RabbitMQ policies to manage the delay between attempts, it's not used by default, however it's <b>highly recommended</b> to enable it. 

- When `usePoliciesForDelay` is enabled in consumer config, RunMQ creates delay queues with TTL configured via RabbitMQ policies rather than hard-coding TTL in the queue itself.
- Hard-coding the TTL requires manual queue re-declaration to change delays, which can involve deleting queues - making it cumbersome and error-prone.
- Policies allow dynamic updates to the TTL without recreating queues — you can change attempts delay anytime, and RunMQ will take care of the rest.

#### Benefits
- Flexible and easy management of retry delays
- Reduces operational overhead
- Fully compatible with RunMQ’s retry and DLQ mechanisms

### Custom Logger

RunMQ uses a default console logger, but you can provide a custom logger by implementing the RunMQLogger interface:

```typescript
import { RunMQLogger } from 'runmq';

class CustomLogger implements RunMQLogger {
  log(message: string): void {
    // Custom info logging
  }
  
  error(message: string, error?: any): void {
    // Custom error logging
  }
}

// Pass the custom logger when starting RunMQ
const runMQ = await RunMQ.start(config, new CustomLogger());
```

**Key insights:**
- Custom loggers allow integration with centralized logging systems (e.g., Winston, Bunyan, Datadog).
- Both info and error methods can be customized to suit your monitoring strategy.

<br>

## ⚙️ Types

### Connection Configuration

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `url` | `string` | — | The URL of the RabbitMQ server. |
| `reconnectDelay` | `number` | `5000` | Delay in milliseconds before attempting to reconnect after a disconnection. |
| `maxReconnectAttempts` | `number` | `5` | Maximum number of reconnection attempts. |
| `management` | `ManagementConfiguration` | — | RabbitMQ management API configuration. |

---

### Management configuration

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `url` | `string` | - | The URL of the RabbitMQ management API. |
| `username` | `string` | - | Username for management API authentication. |
| `password` | `string` | - | Password for management API authentication. |

---

### Processor Configuration

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `name` | `string` | — | Unique name of the processor, used to create isolated queues. |
| `consumersCount` | `number` | — | Number of concurrent consumers for this processor. |
| `attempts` | `number` | `1` | Maximum attempts to process a message. |
| `attemptsDelay` | `number` | `1000` | Delay in milliseconds between attempts. |
| `messageSchema` | `MessageSchema` | — | Optional schema configuration for message validation. |
| `usePoliciesForDelay` | `boolean` | false | Optional configuration to use Policies for attempts delay, highly recommended. |


---

### Message Schema Configuration

| Property | Type | Description |
|----------|------|-------------|
| `type` | `'ajv'` | Type of schema used for validation (currently only AJV supported). |
| `schema` | `any` | Schema definition for validating messages. |
| `failureStrategy` | `'dlq'` | Strategy applied when schema validation fails (e.g., move to DLQ). |

---

### 📦 Message Structure

| Property | Type | Description |
|----------|------|-------------|
| `message` | `T` | Your message payload. |
| `meta.id` | `string` | Unique identifier of the message. |
| `meta.publishedAt` | `number` | Timestamp when the message was published. |
| `meta.correlationId` | `string` | Correlation identifier for tracing. |


## License

MIT
