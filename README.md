<div align="center">
  <img width="1479" height="612" alt="RunMQ-logo (4)" src="https://github.com/user-attachments/assets/50dc9187-26f9-4073-979b-31601c652e1f" />
   <a href="https://www.npmjs.com/package/runmq">
     <img src="https://badge.fury.io/js/runmq.svg?icon=si%3Anpm" alt="npm version" height="18">
   </a>
    <a href="https://github.com/semantic-release/semantic-release">
      <img src="https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg"/>
    </a>
</div>


**RunMQ** is a high-performance message queue library for **Node.js**, built on top of **RabbitMQ**'s rock-solid messaging guarantees.

It pairs RabbitMQ's proven reliability with the kind of developer experience you actually want to work with — clean APIs, fault tolerance baked in, and scaling that just works. No hand-rolled boilerplate, no leaky abstractions.

Whether you're running **background jobs**, designing an **event-driven architecture**, or wiring up a **pub/sub event bus**, RunMQ has you covered — in a lightweight package, with a simple DX, and without the operational headaches you usually sign up for.

> Using NestJS? Check out [`nestjs-runmq`](https://github.com/runmq/nestjs) — the official module with decorators, an injectable publisher, and full lifecycle integration.

## Features

- **Reliable retries** — failed messages are retried with configurable delays and limits, so transient errors don't take you down.
- **Dead Letter Queues (DLQ)** — once retries are exhausted, the message lands safely in a DLQ where you can inspect or replay it.
- **Pub/Sub with atomic delivery** — publish a message once, and every subscribed consumer gets it. No fan-out logic on your side.
- **Isolated queues per processor** — each processor has its own queue and its own DLQ, so one slow consumer can't drag the rest down.
- **Schema validation** — optional JSON Schema validation (powered by AJV) catches bad messages before they reach your business logic.
- **Concurrent consumers** — scale horizontally (more instances) or vertically (more consumers per queue, via RabbitMQ prefetch) — your choice.
- **RabbitMQ durability & acks** — built on RabbitMQ's persistent storage and acknowledgment model, so you get at-least-once delivery even across restarts.
- **Custom logging** — bring your own logger, or stick with the default. Either way, you stay in control of visibility.
- **Real-time dashboard** — pair RunMQ with [RunMQ Pulse](https://github.com/runmq/pulse) to monitor queues, DLQs, and message flow at a glance.

## Installation

```bash
npm install runmq
```

## Quick Start

### Connect to RabbitMQ

```typescript
const runMQ = await RunMQ.start({
    url: 'amqp://localhost:5672',
    reconnectDelay: 5000,        // Optional, default: 5000ms
    maxReconnectAttempts: 5,     // Optional, default: 5
    management: {
        url: "http://localhost:15673",
        username: "guest",
        password: "guest"
    }
});
```

A few quick notes:
- `reconnectDelay` is the wait time between reconnection attempts.
- `maxReconnectAttempts` caps how many times RunMQ will retry before giving up.
- `management` is optional, but **highly recommended** — it unlocks dynamic TTL via RabbitMQ policies. Without it, RunMQ falls back to queue-based TTL (which works fine, just less flexible).

### Set up your processors

A small but important detail: **start your processors before you publish.** Queues are created the first time a consumer subscribes, so a processor needs to be up for its queue to exist.

```typescript
import { RunMQ } from 'runmq';

// Processor 1: Email Service
await runMQ.process('user.created', {
    name: 'emailService',        // Unique name → isolated queue + DLQ
    consumersCount: 2,           // 2 channels; each holds its own prefetch window
    prefetch: 20,                // Per-channel prefetch (default 20). Total in-flight = consumersCount × prefetch
    attempts: 3,                 // Retry up to 3 times before DLQ
    attemptsDelay: 2000,         // Wait 2s between retries
    usePoliciesForDelay: true    // Recommended (default: false)
}, async (message) => {
    console.log('EmailService received:', message.message);
    await sendEmail(message.message);
});

// Processor 2: SMS Service — same topic, separate queue
await runMQ.process('user.created', {
    name: 'smsService',
    consumersCount: 1,
    attempts: 5,
    attemptsDelay: 1000,
    usePoliciesForDelay: true
}, async (message) => {
    console.log('SMSService received:', message.message);
    await sendSMS(message.message);
});
```

What's happening here:
- **`name`** uniquely identifies the processor and gives it a dedicated queue + DLQ.
- **Pub/Sub is built in** — both processors subscribe to `user.created` and each receive every message. One sends an email, the other sends an SMS, and they don't interfere with each other.
- Every processor gets its **own retry policy, concurrency level, and delay configuration**. Tune them per workload.
- With `management` configured, you can change `attemptsDelay` later without re-declaring queues — RunMQ handles the rest.

### Publish a message

```typescript
await runMQ.publish('user.created', {
    userId: '123',
    email: 'user@example.com',
    name: 'John Doe'
});
```

✅ One publish, every subscribed processor receives the message — independently and atomically.

✅ **Confirmed delivery by default.** `runMQ.publish()` returns a promise that resolves only after RabbitMQ has accepted the message; if the broker rejects it (alarm state, mandatory routing failure, etc.), the promise rejects so your code can handle it. Set `usePublisherConfirms: false` in the connection config to opt out and fall back to fire-and-forget publishing if per-publish round-trip latency matters more to you than detecting silent drops.

<br>

## Patterns RunMQ fits naturally

### 1. Event-Driven Architecture (Event Bus)

Multiple services react to the same event independently. Each one owns its queue and its DLQ — full isolation, full autonomy.

```
Publisher → Topic (user.created)
              ├→ Queue: emailService        → DLQ: emailService_dlq
              ├→ Queue: analyticsService    → DLQ: analyticsService_dlq
              └→ Queue: notificationService → DLQ: notificationService_dlq
```

Why teams reach for this pattern:
- One publish reaches every interested service — no fan-out logic in your app.
- Each service tunes its own retries, concurrency, and delays.
- Adding a new service is just subscribing to an existing topic — no upstream changes.
- A failing consumer doesn't drag the others down; bad messages land in *its* DLQ.
- Schema validation can stop invalid payloads before they ever reach your handlers.

### 2. Background Processing

A worker drains jobs from a dedicated queue, with retries and a DLQ for the ones that fail.

```
Publisher → Topic (email.send) → Queue: emailWorker → DLQ: emailWorker_dlq
```

Why this works well:
- Run multiple workers in parallel for high throughput.
- Failures are captured in the DLQ where you can inspect or replay them.
- Schema validation keeps malformed jobs from breaking your worker.
- If your needs grow, this pattern transforms into an Event Bus by simply adding more processors to the same topic — no migration required.

<br>

## Advanced Features

### Schema Validation

Validate messages before they hit your handler, so your business logic only ever sees well-formed data. Currently powered by [AJV](https://ajv.js.org/); invalid messages can be routed straight to the DLQ for later inspection.

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
  // message.message is guaranteed to match the schema
  await processOrder(message.message);
});
```

A few things to call out:
- Validation runs *before* your handler, so runtime errors from bad payloads are kept out of your code paths.
- Only schema-conformant messages reach your business logic — everything else is captured in the DLQ for inspection.

### Policy-based retry delays

RunMQ can use RabbitMQ policies to manage the delay between attempts. It's off by default, but **highly recommended** to turn on.

- With `usePoliciesForDelay: true`, the delay TTL is set via a RabbitMQ policy instead of being hard-coded into the queue.
- Without it, changing the delay later means re-declaring (and sometimes deleting) queues — cumbersome and error-prone.
- With policies, you can update `attemptsDelay` on the fly. RunMQ takes care of applying it.

> 💡 **Pair it with [RunMQ Pulse](https://github.com/runmq/pulse).** Once policy-based delays are on, Pulse becomes your control panel: tweak retry delays **live from the dashboard**, no redeploys and no queue surgery. Production getting noisy? Bump the delay, watch the queues breathe, and dial it back when things settle — all from the UI.

**Why it matters:**
- Flexible, low-friction retry tuning — from code or from Pulse.
- Less operational overhead during incidents (change delays without touching infra).
- Fully compatible with the rest of RunMQ's retry and DLQ machinery.

### Queue Metadata Storage

RunMQ automatically stores queue metadata (max retries, creation timestamp, etc.) using RabbitMQ's parameters API. External tools and dashboards can read this to understand what's running — without ever touching your application code.

When a processor is configured, RunMQ stores:
- **Version** — schema version for future-proof migrations.
- **Max Retries** — the retry limit configured for the queue.
- **Created At** — ISO 8601 timestamp from when the queue was first configured.
- **Updated At** — ISO 8601 timestamp from the most recent configuration change.

**Why it matters:**
- **Dashboard-friendly** — tools can pull this from RabbitMQ's management API and surface topology info like "10 retries with 5s delay, then to DLQ" automatically.
- **Self-documenting queues** — your queue configuration is discoverable straight from RabbitMQ, no source code required.
- **Auto-updating** — config changes update the metadata, while preserving the original `createdAt` so you keep a clean timeline.

> **Note:** This feature requires the RabbitMQ Management Plugin to be enabled — that's how the parameters get written and read.

### Custom Logger

RunMQ ships with a default console logger, but you can plug in your own by implementing the `RunMQLogger` interface:

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

This is the hook you want when you're piping logs into Winston, Bunyan, Datadog, or any centralized logging stack — both `log` and `error` are yours to shape.

<br>

## ⚙️ Types

### Connection Configuration

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `url` | `string` | — | The URL of the RabbitMQ server. |
| `reconnectDelay` | `number` | `5000` | Delay in milliseconds before attempting to reconnect after a disconnection. |
| `maxReconnectAttempts` | `number` | `5` | Maximum number of reconnection attempts. |
| `usePublisherConfirms` | `boolean` | `true` | Enable RabbitMQ publisher confirms on the user publish channel. When `true`, `publish()` resolves only after the broker acks the message and rejects on broker error. Set to `false` for fire-and-forget publishing. _Available in 2.x._ |
| `management` | `ManagementConfiguration` | — | RabbitMQ management API configuration. |

---

### Management Configuration

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `url` | `string` | — | The URL of the RabbitMQ management API. |
| `username` | `string` | — | Username for management API authentication. |
| `password` | `string` | — | Password for management API authentication. |

---

### Processor Configuration

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `name` | `string` | — | Unique name of the processor, used to create isolated queues. |
| `consumersCount` | `number` | — | Number of concurrent consumers (independent AMQP channels) for this processor. Each consumer keeps its own `prefetch` window, so total in-flight = `consumersCount × prefetch`. |
| `prefetch` | `number` | `20` | Per-consumer prefetch count. This is **per channel**, not per processor — total unacked messages held by the processor is `consumersCount × prefetch`. Lower it if memory footprint or crash redelivery surface matters. |
| `attempts` | `number` | `1` | Maximum attempts to process a message. |
| `attemptsDelay` | `number` | `1000` | Delay in milliseconds between attempts. |
| `messageSchema` | `MessageSchema` | — | Optional schema configuration for message validation. |
| `usePoliciesForDelay` | `boolean` | `false` | Use RabbitMQ policies for the retry delay. Highly recommended. |

---

### Message Schema Configuration

| Property | Type | Description |
|----------|------|-------------|
| `type` | `'ajv'` | Type of schema used for validation (currently only AJV is supported). |
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
