# Composite Primary Key

Composite Primary-Key means, an entity has several primary keys, which are automatically combined to a "composite primary key". This way of modeling the database has advantages and disadvantages. We believe that composite primary keys have huge practical disadvantages that do not justify their advantages, so they should be considered bad practice and therefore avoided. Deepkit ORM does not support composite primary keys. In this chapter we explain why and show (better) alternatives.

## Disadvantages

Joins are not trivial. Although they are highly optimized in RDBMS, they represent a constant complexity in applications that can easily get out of hand and lead to performance problems. Performance not only in terms of query execution time, but also in terms of development time.

## Joins

Each individual join becomes more complicated as more fields are involved. While many databases have implemented optimizations to make joins with multiple fields not slower per se, it requires the developer to constantly think through these joins in detail, since forgetting keys, for example, can lead to subtle errors (since the join will work even without specifying all keys) and the developer therefore needs to know the full composite primary key structure.

## Indizes

Indexes with multiple fields (which are composite primary keys) suffer from the problem of field ordering in queries. While database systems can optimize certain queries, complex structures make it difficult to write efficient operations that correctly use all defined indexes. For an index with multiple fields (such as a composite primary key), it is usually necessary to define the fields in the correct order for the database to actually use the index. If the order is not specified correctly (for example, in a WHERE clause), this can easily result in the database not using the index at all and instead performing a full table scan. Knowing which database query optimizes in which way is advanced knowledge that new developers don't usually have, but is necessary once you start working with composite primary keys so that you get the most out of your database and don't waste resources.

## Migrationen

Once you decide that a particular entity needs an additional field to uniquely identify it (and thus become the Composite Primary Key), this will result in the adjustment of all entities in your database that have relationships to that entity.

For example, suppose you have an entity `user` with composite primary key and decide to use a foreign key to this `user` in different tables, e.g. in a pivot table `audit_log`, `groups` and `posts`. Once you change the primary key of `user`, all these tables need to be adjusted in a migration as well.

Not only does this make migration files much more complex, but it can also cause major downtime when running migration files, since schema changes usually require either a full database lock or at least a table lock. The more tables affected by a large change like an index change, the longer the migration will take. And the larger a table is, the longer the migration takes.
Consider the `audit_log` table. Such tables usually have many records (millions or so), and you have to touch them during a schema change only because you decided to use a composite primary key and add an extra field to the primary key of `user`. Depending on the size of all these tables, this either makes migration changes unnecessarily more expensive or, in some cases, so expensive that changing the primary key of `User` is no longer financially justifiable. This usually leads to workarounds (e.g. adding a unique index to the user table) that result in technical debt and sooner or later end up on the legacy list.

For large projects, this can lead to huge downtime (from minutes to hours) and sometimes even the introduction of an entirely new migration abstraction system that essentially copies tables, inserts records into ghost tables, and moves tables back and forth after migration. This added complexity is in turn imposed on any entity that has a relationship to another entity with a composite primary key, and becomes greater the larger your database structure becomes. The problem gets worse with no way to solve it (except by removing the composite primary key entirely).

## Findability

If you are a database administrator or Data Engineer/Scientist, you usually work directly on the database and explore the data when you need it. With composite primary keys, any user writing SQL directly must know the correct primary key of all tables involved (and the column order to get correct index optimizations). This added overhead not only complicates data exploration, report generation, etc., but can also lead to errors in older SQL if a composite primary key is suddenly changed. The old SQL is probably still valid and running fine, but suddenly returns incorrect results because the new field in the composite primary key is missing from the join. It is much easier here to have only one primary key. This makes it easier to find data and ensures that old SQL queries will still work correctly if you decide to change the way a user object is uniquely identified, for example.

## Revision

Once a composite primary key is used in an entity, refactoring the key can result in significant additional refactoring. Because an entity with a composite primary key typically does not have a single unique field, all filters and links must contain all values of the composite key. This usually means that the code relies on knowing the composite primary key, so all fields must be retrieved (e.g., for URLs like user:key1:key2). Once this key is changed, all places where this knowledge is explicitly used, such as URLs, custom SQL queries, and other places, must be rewritten.

While ORMs typically create joins automatically without manually specifying the values, they cannot automatically cover refactoring for all other use cases such as URL structures or custom SQL queries, and especially not for places where the ORM is not used at all, such as in reporting systems and all external systems.

## ORM complexity

With the support of composite primary keys, the complexity of the code of a powerful ORM like Deepkit ORM increases tremendously. Not only will the code and maintenance become more complex and therefore more expensive, but there will be more edge cases from users that need to be fixed and maintained. The complexity of the query layer, change detection, migration system, internal relationship tracking, etc. increases significantly. The overall cost associated with building and supporting an ORM with composite primary keys is too high, all things considered, and cannot be justified, which is why Deepkit does not support it.

## Advantages

Apart from this, composite primary keys also have advantages, albeit very superficial ones. By using as few indexes as possible for each table, writing (inserting/updating) data becomes more efficient, since fewer indexes need to be maintained. It also makes the structure of the model a bit cleaner (since it usually has one less column). However, the difference between a sequentially ordered, automatically incrementing primary key and a non-incrementing primary key is completely negligible these days, since disk space is cheap and the operation is usually just an "append-only" operation, which is very fast.

There may certainly be a few edge cases (and for a few very specific database systems) where it is initially better to work with composite primary keys. But even in these systems, it might make more sense overall (considering all the costs) not to use them and to switch to another strategy.

## Alternative

An alternative to composite primary keys is to use a single automatically incrementing numeric primary key, usually called "id", and move the composite primary key to a unique index with multiple fields. Depending on the primary key used (depending on the expected number of rows), the "id" uses either 4 or 8 bytes per record.

By using this strategy, you are no longer forced to think about the problems described above and find a solution, which enormously reduces the cost of ever-growing projects.

The strategy specifically means that each entity has an "id" field, usually at the very beginning, and this field is then used to identify unique rows by default and in joins.

```typescript
class User {
  id: number & PrimaryKey & AutoIncrement = 0;

  constructor(public username: string) {}
}
```

As an alternative to a composite primary key, you would use a unique multi-field index instead.

```typescript
@entity.index(['tenancyId', 'username'], { unique: true })
class User {
  id: number & PrimaryKey & AutoIncrement = 0;

  constructor(
    public tenancyId: number,
    public username: string,
  ) {}
}
```

Deepkit ORM automatically supports incremental primary keys, including for MongoDB. This is the preferred method for identifying records in your database. However, for MongoDB you can use the ObjectId (`_id: MongoId & PrimaryKey = ''`) as a simple primary key. An alternative to the numeric, auto-incrementing primary key is a UUID, which works just as well (but has slightly different performance characteristics, since indexing is more expensive).

## Summary

Composite primary keys essentially mean that once they are in place, all future changes and practical use come at a much higher cost. While it looks like a clean architecture at the beginning (because you have one less column), it leads to significant practical costs once the project is actually developed, and the costs continue to increase as the project gets larger.

Looking at the asymmetries between benefits and drawbacks, it is clear that composite primary keys cannot be justified in most cases. The costs are much greater than the benefits. Not only for you as a user, but also for us as the author and maintainer of the ORM code. For this reason, Deepkit ORM does not support composite primary keys.
