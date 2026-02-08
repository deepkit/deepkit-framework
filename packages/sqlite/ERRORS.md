# SQLite Package Errors

## DK-SQ001: Transaction Ended Already

**Message:** Transaction ended already

**Causes:**
- Calling `commit()` or `rollback()` on a transaction that has already been committed
- Calling `commit()` or `rollback()` on a transaction that has already been rolled back
- Attempting to use a transaction after it was automatically ended due to an error

**Solution:**
Ensure you only call `commit()` or `rollback()` once per transaction. Structure your code to track transaction state:

```typescript
const session = database.createSession();
await session.useTransaction(async () => {
    // Your operations here
    // Transaction is automatically committed on success
    // or rolled back on error
});
```

If managing transactions manually, ensure proper control flow so commit/rollback is called exactly once.

---

## DK-SQ002: Could Not Start Transaction

**Message:** Could not start transaction: (original error)

**Causes:**
- SQLite database file is locked by another process
- The database is in read-only mode
- Disk is full or filesystem errors
- SQLite database file corruption
- Connection pool exhausted

**Solution:**
1. Check if another process has a lock on the SQLite database file
2. Review the original error message (included after the colon) for specifics
3. Verify the database file is writable and the directory has write permissions
4. Check available disk space
5. If database may be corrupted, try running `PRAGMA integrity_check;`
6. For concurrent access issues, consider using WAL mode: `PRAGMA journal_mode=WAL;`

---

## DK-SQ003: Active Connections on Disconnect

**Message:** There are still active connections. Please release() any fetched connection first.

**Causes:**
- Calling `disconnect()` while connections from the pool are still in use
- Forgetting to call `release()` on a connection after use
- An error occurred that prevented connection cleanup
- Async operations still running that hold connections

**Solution:**
1. Ensure all connections are released before disconnecting:
   ```typescript
   const connection = await database.adapter.connectionPool.getConnection();
   try {
       // Use connection
   } finally {
       connection.release(); // Always release in finally block
   }
   ```
2. Wait for all pending database operations to complete before disconnecting
3. Use `disconnect(true)` to force disconnect if you're certain it's safe to close connections
4. Check for unhandled promise rejections that might skip connection cleanup

---
