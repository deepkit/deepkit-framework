# PostgreSQL Package Errors

## DK-PG001: Transaction Ended Already

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

## DK-PG002: Could Not Start Transaction

**Message:** Could not start transaction: (original error)

**Causes:**
- PostgreSQL server connection was lost
- Connection pool exhausted and no connections available
- PostgreSQL server rejected the BEGIN command
- Network timeout during transaction start
- PostgreSQL server is in recovery mode

**Solution:**
1. Check PostgreSQL server status and connectivity
2. Review the original error message (included after the colon) for specifics
3. Ensure your connection pool size is adequate for your workload
4. Check PostgreSQL server logs for rejection reasons
5. Verify the database user has permission to start transactions
6. If using connection pooling (e.g., PgBouncer), ensure it's configured for transaction mode

---
