import { expect, test } from '@jest/globals';

import { getClassTypeFromInstance } from '@deepkit/core';
import { PrimaryKey, Reference, ReflectionClass, isReferenceInstance, resolveForeignReflectionClass, serializer } from '@deepkit/type';

import { BaseQuery, Formatter, IdentityMap, getInstanceStateFromItem, getNormalizedPrimaryKey } from '../index.js';
import { getReference } from '../src/reference.js';

test('getNormalizedPrimaryKey', () => {
    class User {
        id: string & PrimaryKey = '';
        name: string = 'Foo';
    }

    expect(getNormalizedPrimaryKey(ReflectionClass.from(User), '123')).toEqual({ id: '123' });
    expect(getNormalizedPrimaryKey(ReflectionClass.from(User), { id: '124' })).toEqual({ id: '124' });

    class User2 {
        id: string & PrimaryKey = '';
        id2: string & PrimaryKey = '';
        name: string = 'Foo';
    }

    expect(() => getNormalizedPrimaryKey(ReflectionClass.from(User2), '123')).toThrow('Entity User2 has composite primary key');
    expect(getNormalizedPrimaryKey(ReflectionClass.from(User2), { id: '124', id2: '444' })).toEqual({ id: '124', id2: '444' });
});

test('original schema', () => {
    class User {
        id!: number & PrimaryKey;

        constructor(public username: string) {}
    }

    const ref = getReference(ReflectionClass.from(User), { id: 2 });
    expect(ref.id).toBe(2);

    expect(ReflectionClass.from(getClassTypeFromInstance(ref)) === ReflectionClass.from(User)).toBe(true);
});

test('snapshot correct state', () => {
    class Image {
        id!: number & PrimaryKey;
    }

    class User {
        id!: number & PrimaryKey;
        username!: string;
        image?: Image & Reference;
        image2?: Image & Reference;
    }

    const formatter = new Formatter(ReflectionClass.from(User), serializer);

    {
        const query = new BaseQuery(ReflectionClass.from(User));
        const user1 = formatter.hydrate(query.model, { username: 'Peter', id: '2', image: '1' });
        const snapshot = getInstanceStateFromItem(user1).getSnapshot();
        expect(snapshot.hasOwnProperty('image2')).toBe(true);
        //when schema changes we get from mongodb `undefined` for new fields, but our snapshot converts that to `null`
        // since all databases use `null` as `not defined`. this means we basically ignore `undefined` where possible.
        expect(snapshot).toEqual({ username: 'Peter', id: 2, image: { id: 1 }, image2: null });

        user1.image2 = getReference(ReflectionClass.from(Image), { id: 2 });
        expect(user1.image2.id).toBe(2);
        getInstanceStateFromItem(user1).markAsPersisted();
        expect(getInstanceStateFromItem(user1).getSnapshot()).toEqual({ username: 'Peter', id: 2, image: { id: 1 }, image2: { id: 2 } });

        user1.image = undefined;
        getInstanceStateFromItem(user1).markAsPersisted();
        expect(getInstanceStateFromItem(user1).getSnapshot()).toEqual({ username: 'Peter', id: 2, image: null, image2: { id: 2 } });
    }

    {
        const query = new BaseQuery(ReflectionClass.from(User));
        const user1 = formatter.hydrate(query.model, { username: 'Peter2', id: '3', image: '1', image2: null });
        const snapshot = getInstanceStateFromItem(user1).getSnapshot();
        expect(snapshot.hasOwnProperty('image2')).toBe(true);
        expect(snapshot).toEqual({ username: 'Peter2', id: 3, image: { id: 1 }, image2: null });

        user1.image2 = getReference(ReflectionClass.from(Image), { id: 2 });
        expect(user1.image2.id).toBe(2);
        getInstanceStateFromItem(user1).markAsPersisted();
        expect(getInstanceStateFromItem(user1).getSnapshot()).toEqual({ username: 'Peter2', id: 3, image: { id: 1 }, image2: { id: 2 } });
    }
});

test('identity map hydrates references when full object is loaded via join', () => {
    // Issue #636: When the same entity appears via different paths in a query result,
    // they should share the same hydrated instance.
    //
    // Example: review.book.author and review.user both reference the same User.
    // When user is joined (fully loaded), book.author should also become hydrated.

    class User {
        id!: number & PrimaryKey;
        name!: string;
    }

    class Book {
        id!: number & PrimaryKey;
        title!: string;
        author!: User & Reference;
    }

    class Review {
        id!: number & PrimaryKey;
        content!: string;
        book!: Book & Reference;
        user!: User & Reference;
    }

    const identityMap = new IdentityMap();
    const formatter = new Formatter(ReflectionClass.from(Review), serializer, undefined, identityMap);

    // Build query with joins for book and user (but not book.author)
    const query = new BaseQuery(ReflectionClass.from(Review));

    // Add join for 'book' field
    const bookProperty = ReflectionClass.from(Review).getProperty('book');
    const bookSchema = resolveForeignReflectionClass(bookProperty);
    const bookQuery = new BaseQuery(bookSchema);
    query.model.joins.push({
        propertySchema: bookProperty,
        query: bookQuery,
        populate: true,
        type: 'inner',
        foreignPrimaryKey: bookSchema.getPrimary(),
        classSchema: ReflectionClass.from(Review),
    });

    // Add join for 'user' field
    const userProperty = ReflectionClass.from(Review).getProperty('user');
    const userSchema = resolveForeignReflectionClass(userProperty);
    const userQuery = new BaseQuery(userSchema);
    query.model.joins.push({
        propertySchema: userProperty,
        query: userQuery,
        populate: true,
        type: 'inner',
        foreignPrimaryKey: userSchema.getPrimary(),
        classSchema: ReflectionClass.from(Review),
    });

    // Simulate database result where book.author and user are the same person (id=1)
    const dbRecord = {
        id: 1,
        content: 'Great book!',
        // book data (author is user id=1, same as review.user)
        book: {
            id: 1,
            title: 'TypeScript Patterns',
            author: 1, // FK to user with id=1
        },
        // user data (fully joined)
        user: {
            id: 1,
            name: 'Peter',
        },
    };

    const review = formatter.hydrate(query.model, dbRecord);

    // Basic checks
    expect(review.id).toBe(1);
    expect(review.content).toBe('Great book!');
    expect(review.book.id).toBe(1);
    expect(review.book.title).toBe('TypeScript Patterns');

    // The user was joined, so it should be fully hydrated with accessible properties
    expect(review.user.id).toBe(1);
    expect(review.user.name).toBe('Peter');

    // After upgrade, the reference is no longer a reference instance - it's been
    // converted to a full object by changing its prototype. This makes
    // isReferenceInstance return false, while preserving object identity.
    expect(isReferenceInstance(review.user)).toBe(false); // Upgraded to full object

    // The critical test: book.author references the same user (id=1)
    // It was NOT explicitly joined, so it started as a reference.
    // But since we loaded the full user via review.user, the reference was upgraded.
    expect(review.book.author.id).toBe(1);
    expect(review.book.author.name).toBe('Peter');

    // Both should be the SAME object (identity preserved during upgrade)
    expect(review.user).toBe(review.book.author);
});

test('identity map reference upgrade with multiple overlapping references', () => {
    // More complex case: multiple entities reference the same User
    // All should see the hydrated version once one loads the full object.

    class User {
        id!: number & PrimaryKey;
        name!: string;
    }

    class Comment {
        id!: number & PrimaryKey;
        text!: string;
        author!: User & Reference;
    }

    class Post {
        id!: number & PrimaryKey;
        title!: string;
        author!: User & Reference;
        reviewer?: User & Reference;
    }

    const identityMap = new IdentityMap();
    const formatter = new Formatter(ReflectionClass.from(Post), serializer, undefined, identityMap);

    // First, create a reference via getReference (simulating how non-joined fields work)
    const userSchema = ReflectionClass.from(User);
    const ref = getReference(userSchema, { id: 1 }, identityMap);

    // Verify it's stored in identity map as a reference
    expect(isReferenceInstance(ref)).toBe(true);
    expect(ref.id).toBe(1);
    expect(() => ref.name).toThrow(); // Should throw "not loaded" error

    // Now hydrate a Post where author is joined (fully loaded) with same user id=1
    const query = new BaseQuery(ReflectionClass.from(Post));
    const authorProperty = ReflectionClass.from(Post).getProperty('author');
    const authorSchema = resolveForeignReflectionClass(authorProperty);
    query.model.joins.push({
        propertySchema: authorProperty,
        query: new BaseQuery(authorSchema),
        populate: true,
        type: 'inner',
        foreignPrimaryKey: authorSchema.getPrimary(),
        classSchema: ReflectionClass.from(Post),
    });

    const dbRecord = {
        id: 1,
        title: 'Hello World',
        author: {
            id: 1,
            name: 'Peter',
        },
        reviewer: 1, // Same user, but not joined
    };

    const post = formatter.hydrate(query.model, dbRecord);

    // post.author should be fully hydrated (it was joined)
    expect(post.author.id).toBe(1);
    expect(post.author.name).toBe('Peter');

    // The reference we created earlier should now be hydrated
    // because the identity map saw the full object with the same PK
    expect(ref.name).toBe('Peter');

    // post.reviewer is also the same user (not joined, so it's a reference)
    // but it should return the same hydrated object from identity map
    expect(post.reviewer!.id).toBe(1);
    expect(post.reviewer!.name).toBe('Peter');
});

test('self-referencing entity: FK references are upgraded when entity appears in same query', () => {
    // When an entity references itself (e.g., linked list, tree structure),
    // and the referenced entity also appears as a root result in the same query,
    // the FK reference is upgraded to preserve object identity. This ensures
    // there's only ONE object representation per entity within a query.

    class Block {
        id!: number & PrimaryKey;
        level!: number;
        previous?: Block & Reference;
    }

    const identityMap = new IdentityMap();
    const formatter = new Formatter(ReflectionClass.from(Block), serializer, undefined, identityMap);
    const query = new BaseQuery(ReflectionClass.from(Block));

    // Simulate database results: two blocks where block1 references block2
    // This is what happens when querying without joins
    const dbRecords = [
        { id: 1, level: 100, previous: 2 }, // Block 1 references Block 2
        { id: 2, level: 200, previous: null },
    ];

    // Hydrate both blocks (simulating multiple rows returned from query)
    const block1 = formatter.hydrate(query.model, dbRecords[0]);
    const block2 = formatter.hydrate(query.model, dbRecords[1]);

    // Main results should be full objects, not references
    expect(isReferenceInstance(block1)).toBe(false);
    expect(isReferenceInstance(block2)).toBe(false);

    // Both should have accessible properties
    expect(block1.id).toBe(1);
    expect(block1.level).toBe(100);
    expect(block2.id).toBe(2);
    expect(block2.level).toBe(200);

    // block1.previous was initially created as a reference proxy (FK field),
    // but when block2 was hydrated as a root entity, the reference was upgraded
    // to preserve object identity within the query.
    expect(block1.previous).toBeDefined();
    expect(block1.previous!.id).toBe(2);

    // The reference was upgraded to a full object - object identity is preserved
    expect(isReferenceInstance(block1.previous)).toBe(false);

    // Properties are now accessible (reference was upgraded)
    expect(block1.previous!.level).toBe(200);

    // IMPORTANT: block1.previous and block2 ARE the same object - object identity
    // is always preserved within a query to avoid having multiple representations
    // of the same entity.
    expect(block1.previous).toBe(block2);
});

test('self-referencing entity: FK references ARE upgraded when joined', () => {
    // When a self-referencing field is explicitly joined, references should
    // be upgraded to full objects.

    class Block {
        id!: number & PrimaryKey;
        level!: number;
        previous?: Block & Reference;
    }

    const identityMap = new IdentityMap();
    const formatter = new Formatter(ReflectionClass.from(Block), serializer, undefined, identityMap);

    // Build query WITH join for 'previous'
    const query = new BaseQuery(ReflectionClass.from(Block));
    const previousProperty = ReflectionClass.from(Block).getProperty('previous');
    const blockSchema = resolveForeignReflectionClass(previousProperty);
    query.model.joins.push({
        propertySchema: previousProperty,
        query: new BaseQuery(blockSchema),
        populate: true,
        type: 'left',
        foreignPrimaryKey: blockSchema.getPrimary(),
        classSchema: ReflectionClass.from(Block),
    });

    // Database result with nested join data
    const dbRecord = {
        id: 1,
        level: 100,
        previous: { id: 2, level: 200, previous: null }, // Fully joined
    };

    const block1 = formatter.hydrate(query.model, dbRecord);

    // Main result should be a full object
    expect(isReferenceInstance(block1)).toBe(false);
    expect(block1.id).toBe(1);
    expect(block1.level).toBe(100);

    // previous was joined, so it should be a full object (not a reference)
    expect(block1.previous).toBeDefined();
    expect(block1.previous!.id).toBe(2);
    expect(block1.previous!.level).toBe(200); // Should be accessible
    expect(isReferenceInstance(block1.previous)).toBe(false); // Upgraded
});

test('edge case: multiple FK fields referencing same entity', () => {
    // When an entity has multiple FK fields pointing to the same entity,
    // and one path is joined, all paths should see the upgraded object.

    class User {
        id!: number & PrimaryKey;
        name!: string;
    }

    class Document {
        id!: number & PrimaryKey;
        title!: string;
        author!: User & Reference;
        reviewer!: User & Reference;
        approver?: User & Reference;
    }

    const identityMap = new IdentityMap();
    const formatter = new Formatter(ReflectionClass.from(Document), serializer, undefined, identityMap);

    // Build query with only 'author' joined
    const query = new BaseQuery(ReflectionClass.from(Document));
    const authorProperty = ReflectionClass.from(Document).getProperty('author');
    const userSchema = resolveForeignReflectionClass(authorProperty);
    query.model.joins.push({
        propertySchema: authorProperty,
        query: new BaseQuery(userSchema),
        populate: true,
        type: 'inner',
        foreignPrimaryKey: userSchema.getPrimary(),
        classSchema: ReflectionClass.from(Document),
    });

    // All three user fields reference the same user (id=1)
    const dbRecord = {
        id: 1,
        title: 'Report',
        author: { id: 1, name: 'Alice' }, // Joined with full data
        reviewer: 1, // Same user, not joined
        approver: 1, // Same user, not joined
    };

    const doc = formatter.hydrate(query.model, dbRecord);

    // Author was joined - should be fully accessible
    expect(doc.author.id).toBe(1);
    expect(doc.author.name).toBe('Alice');
    expect(isReferenceInstance(doc.author)).toBe(false); // Upgraded

    // Reviewer and approver are the same user - should also be upgraded
    // because they share the pool entry with author
    expect(doc.reviewer.id).toBe(1);
    expect(doc.reviewer.name).toBe('Alice'); // Should work!
    expect(doc.approver!.id).toBe(1);
    expect(doc.approver!.name).toBe('Alice'); // Should work!

    // All three should be the SAME object
    expect(doc.author).toBe(doc.reviewer);
    expect(doc.author).toBe(doc.approver);
});

test('edge case: nested joins with shared references', () => {
    // A -> B -> C where A also references C directly
    // When C is joined through B, A.c should also be upgraded

    class Category {
        id!: number & PrimaryKey;
        name!: string;
    }

    class Product {
        id!: number & PrimaryKey;
        name!: string;
        category!: Category & Reference;
    }

    class Order {
        id!: number & PrimaryKey;
        product!: Product & Reference;
        shippingCategory!: Category & Reference; // Same category as product.category
    }

    const identityMap = new IdentityMap();
    const formatter = new Formatter(ReflectionClass.from(Order), serializer, undefined, identityMap);

    // Build query: join product, and nest-join product.category
    const query = new BaseQuery(ReflectionClass.from(Order));

    // Join product
    const productProperty = ReflectionClass.from(Order).getProperty('product');
    const productSchema = resolveForeignReflectionClass(productProperty);
    const productQuery = new BaseQuery(productSchema);

    // Nested join: product.category
    const categoryProperty = productSchema.getProperty('category');
    const categorySchema = resolveForeignReflectionClass(categoryProperty);
    productQuery.model.joins.push({
        propertySchema: categoryProperty,
        query: new BaseQuery(categorySchema),
        populate: true,
        type: 'inner',
        foreignPrimaryKey: categorySchema.getPrimary(),
        classSchema: productSchema,
    });

    query.model.joins.push({
        propertySchema: productProperty,
        query: productQuery,
        populate: true,
        type: 'inner',
        foreignPrimaryKey: productSchema.getPrimary(),
        classSchema: ReflectionClass.from(Order),
    });

    // Database result with nested join and shared category
    const dbRecord = {
        id: 1,
        product: {
            id: 1,
            name: 'Widget',
            category: { id: 1, name: 'Electronics' }, // Nested join data
        },
        shippingCategory: 1, // Same category, not joined directly
    };

    const order = formatter.hydrate(query.model, dbRecord);

    // product.category was joined - should be fully accessible
    expect(order.product.category.id).toBe(1);
    expect(order.product.category.name).toBe('Electronics');
    expect(isReferenceInstance(order.product.category)).toBe(false);

    // shippingCategory references the same category - should be upgraded
    expect(order.shippingCategory.id).toBe(1);
    expect(order.shippingCategory.name).toBe('Electronics');
    expect(isReferenceInstance(order.shippingCategory)).toBe(false);

    // Both should be the SAME object
    expect(order.product.category).toBe(order.shippingCategory);
});

test('edge case: reference created first, then joined via different path', () => {
    // Simulates processing order where reference is created before join data arrives
    // Scenario: Order has product (joined) and product has category.
    // Order also has a directCategory field pointing to same category.

    class Category {
        id!: number & PrimaryKey;
        name!: string;
    }

    class Product {
        id!: number & PrimaryKey;
        name!: string;
        category!: Category & Reference;
    }

    class Order {
        id!: number & PrimaryKey;
        product!: Product & Reference;
        directCategory!: Category & Reference; // Same as product.category
    }

    const identityMap = new IdentityMap();
    const formatter = new Formatter(ReflectionClass.from(Order), serializer, undefined, identityMap);

    // Build query: join product (with nested category join)
    const query = new BaseQuery(ReflectionClass.from(Order));

    // Join product
    const productProperty = ReflectionClass.from(Order).getProperty('product');
    const productSchema = resolveForeignReflectionClass(productProperty);
    const productQuery = new BaseQuery(productSchema);

    // Nested: join product.category
    const categoryProperty = productSchema.getProperty('category');
    const categorySchema = resolveForeignReflectionClass(categoryProperty);
    productQuery.model.joins.push({
        propertySchema: categoryProperty,
        query: new BaseQuery(categorySchema),
        populate: true,
        type: 'inner',
        foreignPrimaryKey: categorySchema.getPrimary(),
        classSchema: productSchema,
    });

    query.model.joins.push({
        propertySchema: productProperty,
        query: productQuery,
        populate: true,
        type: 'inner',
        foreignPrimaryKey: productSchema.getPrimary(),
        classSchema: ReflectionClass.from(Order),
    });

    // Order references same category through both paths
    const dbRecord = {
        id: 1,
        product: {
            id: 1,
            name: 'Widget',
            category: { id: 1, name: 'Electronics' }, // Joined
        },
        directCategory: 1, // Same category, not joined directly
    };

    const order = formatter.hydrate(query.model, dbRecord);

    // Product.category was joined
    expect(order.product.category.id).toBe(1);
    expect(order.product.category.name).toBe('Electronics');
    expect(isReferenceInstance(order.product.category)).toBe(false);

    // directCategory references same category - should be upgraded
    expect(order.directCategory.id).toBe(1);
    expect(order.directCategory.name).toBe('Electronics');

    // Same object identity
    expect(order.product.category).toBe(order.directCategory);
});

test('edge case: deeply nested joins preserve identity', () => {
    // A -> B -> C -> D where multiple levels reference same entity

    class Tag {
        id!: number & PrimaryKey;
        name!: string;
    }

    class SubCategory {
        id!: number & PrimaryKey;
        name!: string;
        tag!: Tag & Reference;
    }

    class Category {
        id!: number & PrimaryKey;
        name!: string;
        sub!: SubCategory & Reference;
        mainTag!: Tag & Reference; // Same tag as sub.tag
    }

    class Item {
        id!: number & PrimaryKey;
        category!: Category & Reference;
    }

    const identityMap = new IdentityMap();
    const formatter = new Formatter(ReflectionClass.from(Item), serializer, undefined, identityMap);

    // Build deeply nested query
    const query = new BaseQuery(ReflectionClass.from(Item));

    // Level 1: Join category
    const categoryProperty = ReflectionClass.from(Item).getProperty('category');
    const categorySchema = resolveForeignReflectionClass(categoryProperty);
    const categoryQuery = new BaseQuery(categorySchema);

    // Level 2: Join category.sub
    const subProperty = categorySchema.getProperty('sub');
    const subSchema = resolveForeignReflectionClass(subProperty);
    const subQuery = new BaseQuery(subSchema);

    // Level 3: Join category.sub.tag
    const tagProperty = subSchema.getProperty('tag');
    const tagSchema = resolveForeignReflectionClass(tagProperty);
    subQuery.model.joins.push({
        propertySchema: tagProperty,
        query: new BaseQuery(tagSchema),
        populate: true,
        type: 'inner',
        foreignPrimaryKey: tagSchema.getPrimary(),
        classSchema: subSchema,
    });

    categoryQuery.model.joins.push({
        propertySchema: subProperty,
        query: subQuery,
        populate: true,
        type: 'inner',
        foreignPrimaryKey: subSchema.getPrimary(),
        classSchema: categorySchema,
    });

    query.model.joins.push({
        propertySchema: categoryProperty,
        query: categoryQuery,
        populate: true,
        type: 'inner',
        foreignPrimaryKey: categorySchema.getPrimary(),
        classSchema: ReflectionClass.from(Item),
    });

    // Deeply nested data with shared tag
    const dbRecord = {
        id: 1,
        category: {
            id: 1,
            name: 'Electronics',
            sub: {
                id: 1,
                name: 'Phones',
                tag: { id: 1, name: 'tech' }, // Deep nested join
            },
            mainTag: 1, // Same tag, not directly joined
        },
    };

    const item = formatter.hydrate(query.model, dbRecord);

    // Verify deep nesting works
    expect(item.category.sub.tag.id).toBe(1);
    expect(item.category.sub.tag.name).toBe('tech');
    expect(isReferenceInstance(item.category.sub.tag)).toBe(false);

    // mainTag should be upgraded (same tag)
    expect(item.category.mainTag.id).toBe(1);
    expect(item.category.mainTag.name).toBe('tech');
    expect(isReferenceInstance(item.category.mainTag)).toBe(false);

    // Same object identity across deep nesting
    expect(item.category.sub.tag).toBe(item.category.mainTag);
});

test('edge case: three-way shared reference', () => {
    // Three different FK fields all reference the same entity
    // When any one is joined, all should be upgraded

    class User {
        id!: number & PrimaryKey;
        name!: string;
    }

    class Task {
        id!: number & PrimaryKey;
        title!: string;
        creator!: User & Reference;
        assignee!: User & Reference;
        reviewer!: User & Reference;
    }

    const identityMap = new IdentityMap();
    const formatter = new Formatter(ReflectionClass.from(Task), serializer, undefined, identityMap);

    const query = new BaseQuery(ReflectionClass.from(Task));

    // Only join 'assignee'
    const assigneeProperty = ReflectionClass.from(Task).getProperty('assignee');
    const userSchema = resolveForeignReflectionClass(assigneeProperty);
    query.model.joins.push({
        propertySchema: assigneeProperty,
        query: new BaseQuery(userSchema),
        populate: true,
        type: 'inner',
        foreignPrimaryKey: userSchema.getPrimary(),
        classSchema: ReflectionClass.from(Task),
    });

    // All three fields reference the same user
    const dbRecord = {
        id: 1,
        title: 'Fix bug',
        creator: 1, // Not joined
        assignee: { id: 1, name: 'Alice' }, // Joined
        reviewer: 1, // Not joined
    };

    const task = formatter.hydrate(query.model, dbRecord);

    // Assignee was joined - fully accessible
    expect(task.assignee.id).toBe(1);
    expect(task.assignee.name).toBe('Alice');
    expect(isReferenceInstance(task.assignee)).toBe(false);

    // Creator and reviewer should be upgraded too (same user)
    expect(task.creator.id).toBe(1);
    expect(task.creator.name).toBe('Alice');
    expect(isReferenceInstance(task.creator)).toBe(false);

    expect(task.reviewer.id).toBe(1);
    expect(task.reviewer.name).toBe('Alice');
    expect(isReferenceInstance(task.reviewer)).toBe(false);

    // All three should be the SAME object
    expect(task.assignee).toBe(task.creator);
    expect(task.assignee).toBe(task.reviewer);
});
