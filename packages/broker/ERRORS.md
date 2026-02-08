# Broker Errors

## DK-BR001: Broker Lock Error

**Message:** Lock already acquired. Call release first.

**Causes:**
- Calling `acquire()` or `try()` on a lock that is already held
- Not releasing a lock before attempting to re-acquire it
- Missing `release()` call in error handling paths

**Solution:**
Release the lock before acquiring it again:
```typescript
const lock = broker.lock.item('my-resource');
await lock.acquire();
// do work
await lock.release();

// Now you can acquire again
await lock.acquire();
```

Or use the disposable pattern for automatic cleanup:
```typescript
async using hold = await lock.hold();
// lock is automatically released when scope exits
```

---

## DK-BR002: Broker Cache Error

**Message:** Various cache-related error messages

**Causes:**
- Cache operation failed due to broker connectivity issues
- Serialization/deserialization errors for cached values
- Cache adapter not properly configured
- Type mismatch when retrieving cached values

**Solution:**
Verify the broker adapter is properly connected and configured. Ensure cached values can be serialized to BSON. Check that the type parameter matches the stored data type.

---

## DK-BR003: Missing Deduplication Interval

**Message:** Missing message deduplication interval

**Causes:**
- Using `exactlyOnce` message processing without specifying a deduplication interval
- Queue message configuration is incomplete

**Solution:**
When using exactly-once message processing, provide a deduplication interval:
```typescript
await queue.produce(message, {
    processing: QueueMessageProcessing.exactlyOnce,
    deduplicationInterval: 60000, // 60 seconds
    hash: 'unique-message-hash'
});
```
The deduplication interval determines how long the broker remembers processed message hashes to prevent duplicates.

---

## DK-BR004: Missing Message Hash

**Message:** Missing message hash

**Causes:**
- Using `exactlyOnce` message processing without providing a message hash
- Incomplete message configuration for deduplication

**Solution:**
Provide a unique hash for exactly-once message processing:
```typescript
await queue.produce(message, {
    processing: QueueMessageProcessing.exactlyOnce,
    deduplicationInterval: 60000,
    hash: computeHash(message) // unique identifier for this message
});
```
The hash should uniquely identify the message content so duplicates can be detected.

---

## DK-BR005: No Servers Defined

**Message:** No servers defined

**Causes:**
- BrokerDeepkitAdapter initialized without any server configuration
- Empty `servers` array in adapter options
- Missing broker server URL configuration

**Solution:**
Configure at least one server when creating the broker adapter:
```typescript
const adapter = new BrokerDeepkitAdapter({
    servers: [
        { url: 'ws://localhost:8080' }
    ]
});
```
Ensure the server URL is correct and the broker server is running.

---
