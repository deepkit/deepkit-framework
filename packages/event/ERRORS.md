# @deepkit/event Errors

## DK-E001: Event Error

**Message:** Various event-related error messages

**Causes:**
- Using `@eventDispatcher.listen()` without an event token
- Using `@eventDispatcher.listen(eventToken)` on something other than a class property
- No event dispatched for a given token

**Solution:**
Ensure you use the correct decorator syntax on class properties:

```typescript
class MyListener {
    @eventDispatcher.listen(MyEvent)
    onMyEvent(event: MyEvent) {
        // handle event
    }
}
```

When dispatching events, make sure the event token exists and has been properly registered with the event dispatcher.

---
