# Stopwatch Errors

## DK-SW001: Stopwatch not active

**Message:** Stopwatch not active

**Causes:**
- The `Stopwatch.start()` method was called when `active` is true but the internal `store` has not been initialized
- The stopwatch is in an inconsistent state where it reports being active but lacks the necessary storage backend

**Solution:**
Ensure the stopwatch is properly initialized before use. The `store` property should be set when the stopwatch is configured. This typically happens automatically when using the stopwatch within the Deepkit framework context. If you're using the stopwatch standalone, make sure to configure the storage backend before calling `start()`.

---
