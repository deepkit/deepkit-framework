# MySQL Package Errors

## DK-MY001: Transaction Ended Already

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

## DK-MY002: Could Not Start Transaction

**Message:** Could not start transaction: (original error)

**Causes:**
- MySQL server connection was lost
- Connection pool exhausted and no connections available
- MySQL server rejected the START TRANSACTION command
- Network timeout during transaction start
- MySQL server is in read-only mode

**Solution:**
1. Check MySQL server status and connectivity
2. Review the original error message (included after the colon) for specifics
3. Ensure your connection pool size is adequate for your workload
4. Check MySQL server logs for rejection reasons
5. Verify the database user has permission to start transactions
6. Check if the server is in read-only mode: `SHOW VARIABLES LIKE 'read_only';`

---

## DK-MY003: No lastBatchResult Found

**Message:** No lastBatchResult found

**Causes:**
- Internal error when retrieving auto-increment values after a batch insert
- The insert operation did not return expected result metadata
- Connection state was corrupted or reset between insert and ID retrieval

**Solution:**
This is typically an internal error indicating a problem with the insert operation flow. Steps to investigate:

1. Ensure the table has an AUTO_INCREMENT primary key column
2. Verify the insert operation completed successfully before this error
3. Check for connection pooling issues that might cause connection state inconsistency
4. If the problem persists, try inserting records individually instead of in batch
5. Report the issue with reproduction steps if this occurs consistently

---
