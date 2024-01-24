# Events

Events are a way to hook into Deepkit ORM and allow you to write powerful plugins. There are two
categories of events: Query events and Unit-of-Work events. Plugin authors typically use both to
support both ways of manipulating data.

Events are registered via `Database.listen` un an event token. Short-lived event listeners can also
be registered on sessions.

```typescript
import { Query, Database } from '@deepkit/orm';

const database = new Database(...);
database.listen(Query.onFetch, async (event) => {
});

const session = database.createSession();

//will only be executed for this particular session
session.eventDispatcher.listen(Query.onFetch, async (event) => {
});
```

## Query Events

Query events are triggered when a query is executed via `Database.query()` or `Session.query()`.

Each event has its own additional properties such as the type of entity, the query itself and the
database session. You can override the query by setting a new query to `Event.query`.

```typescript
import { Query, Database } from '@deepkit/orm';

const database = new Database(...);

const unsubscribe = database.listen(Query.onFetch, async event => {
    //overwrite the query of the user, so something else is executed.
    event.query = event.query.filterField('fieldName', 123);
});

//to delete the hook call unsubscribe
unsubscribe();
```

"Query" has several event tokens:

| Event-Token        | Description                                                 |
| ------------------ | ----------------------------------------------------------- |
| Query.onFetch      | When objects where fetched via find()/findOne()/etc         |
| Query.onDeletePre  | Before objects are deleted via deleteMany/deleteOne()       |
| Query.onDeletePost | After objects are deleted via deleteMany/deleteOne()        |
| Query.onPatchPre   | Before objects are patched/updated via patchMany/patchOne() |
| Query.onPatchPost  | After objects are patched/updated via patchMany/patchOne()  |

## Unit Of Work Events

Unit-of-work events are triggered when a new session submits changes.

| Event-Token                  | Description                                                                                                       |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| DatabaseSession.onUpdatePre  | Triggered just before the `DatabaseSession` object initiates an update operation on the database records.         |
| DatabaseSession.onUpdatePost | Triggered immediately after the `DatabaseSession` object has successfully completed the update operation.         |
| DatabaseSession.onInsertPre  | Triggered just before the `DatabaseSession` object starts the insertion of new records into the database.         |
| DatabaseSession.onInsertPost | Triggered immediately after the `DatabaseSession` object has successfully inserted the new records.               |
| DatabaseSession.onDeletePre  | Triggered just before the `DatabaseSession` object begins a delete operation to remove records from the database. |
| DatabaseSession.onDeletePost | Triggered immediately after the `DatabaseSession` object has completed the delete operation.                      |
| DatabaseSession.onCommitPre  | Triggered just before the `DatabaseSession` object commits any changes made during the session to the database.   |
