# Transactions

A transaction is a sequential group of statements, queries, or operations such as select, insert, update, or delete that are executed as a single unit of work that can be committed or rolled back.

Deepkit supports transactions for all officially supported databases. By default, no transactions are used for any query or database session. To enable transactions, there are two main methods: sessions and callback.

## Session Transactions

You can start and assign a new transaction for each session you create. This is the preferred way of interacting with the database, as you can easily pass on the Session object and all queries instantiated by this session will be automatically assigned to its transaction.

A typical pattern is to wrap all operations in a try-catch block and execute `commit()` on the very last line (which is only executed if all previous commands succeeded) and `rollback()` in the catch block to roll back all changes as soon as an error occurs.

Although there is an alternative API (see below), all transactions work only with database session objects. To commit open changes from the unit-of-work in a database session to the database, `commit()` is normally called. In a transactional session, `commit()` not only commits all pending changes to the database, but also completes ("commits") the transaction, thus closing the transaction. Alternatively, you can call `session.flush()` to commit all pending changes without `commit` and thus without closing the transaction. To commit a transaction without flushing the unit-of-work, use `session.commitTransaction()`.

```typescript
const session = database.createSession();

//this assigns a new transaction, and starts it with the very next database operation.
session.useTransaction();

try {
    //this query is executed in the transaction
    const users = await session.query(User).find();

    await moreDatabaseOperations(session);

    await session.commit();
} catch (error) {
    await session.rollback();
}
```

Once `commit()` or `rollback()` is executed in a session, the transaction is released. You must then call `useTransaction()` again if you want to continue in a new transaction.

Please note that once the first database operation is executed in a transactional session, the assigned database connection becomes fixed and exclusive to the current session object (sticky). Thus, all subsequent operations will be performed on the same connection (and thus, in most databases, on the same database server). Only when either the transactional session is terminated (commit or rollback), the database connection is released again. It is therefore recommended to keep a transaction only as short as necessary.

If a session is already connected to a transaction, a call to `session.useTransaction()` always returns the same object. Use `session.isTransaction()` to check if a transaction is associated with the session.

Nested transactions are not supported.

## Transaction Callback

An alternative to transactional sessions is `database.transaction(callback)`.

```typescript
await database.transaction(async (session) => {
    //this query is executed in the transaction
    const users = await session.query(User).find();

    await moreDatabaseOperations(session);
});
```

The `database.transaction(callback)` method performs an asynchronous callback within a new transactional session. If the callback succeeds (that is, no error is thrown), the session is automatically committed (and thus its transaction committed and all changes flushed). If the callback fails, the session automatically executes `rollback()` and the error is propagated.

## Isolations

Many databases support different types of transactions. To change the transaction behavior, you can call different methods for the returned transaction object from `useTransaction()`. The interface of this transaction object depends on the database adapter used. For example, the transaction object returned from a MySQL database has different options than the one returned from a MongoDB database. Use code completion or view the database adapter's interface to get a list of possible options.

```typescript
const database = new Database(new MySQLDatabaseAdapter());

const session = database.createSession();
session.useTransaction().readUncommitted();

try {
    //...operations
    await session.commit();
} catch (error) {
    await session.rollback();
}

//or
await database.transaction(async (session) => {
    //this works as long as no database operation has been exuected.
    session.useTransaction().readUncommitted();

    //...operations
});
```

While transactions for MySQL, PostgreSQL, and SQLite work by default, you must first set up MongoDB as a "replica set".

To convert a standard MongoDB instance to a replica set, please refer to the official documentation link:https://docs.mongodb.com/manual/tutorial/convert-standalone-to-replica-set/[Convert a Standalone to a Replica Set].
