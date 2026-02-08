import { expect, test } from '@jest/globals';

import { HttpKernel, HttpRequest } from '@deepkit/http';
import { AutoIncrement, PrimaryKey, Unique, entity } from '@deepkit/type';

import { createCrudRoutes } from '../src/crud.js';
import { FrameworkModule } from '../src/module.js';
import { createTestingApp } from '../src/testing.js';

/**
 * Tests for CRUD routes with custom identifiers.
 * Related to GitHub issue #395: custom identifier support in createCrudRoutes.
 */

@entity.name('user')
class User {
    id: number & PrimaryKey & AutoIncrement = 0;
    username: string & Unique = '';
    name: string = '';
}

test('CRUD routes with default identifier (primary key)', async () => {
    const testing = createTestingApp(
        {
            imports: [new FrameworkModule(), createCrudRoutes([User])],
        },
        [User],
    );

    const httpKernel = testing.app.get(HttpKernel);

    // Create a user
    const createRequest = HttpRequest.POST('/entity/user');
    createRequest.header('content-type', 'application/json');
    createRequest.body(JSON.stringify({ id: 1, username: 'john', name: 'John Doe' }));
    const createResponse = await httpKernel.request(createRequest);
    expect(createResponse.statusCode).toBe(201);
    expect(createResponse.json).toMatchObject({ id: 1, username: 'john', name: 'John Doe' });

    // Read by primary key (id)
    const readResponse = await httpKernel.request(HttpRequest.GET('/entity/user/1'));
    expect(readResponse.statusCode).toBe(200);
    expect(readResponse.json).toMatchObject({ id: 1, username: 'john', name: 'John Doe' });

    // Update by primary key (id)
    const updateRequest = HttpRequest.PUT('/entity/user/1');
    updateRequest.header('content-type', 'application/json');
    updateRequest.body(JSON.stringify({ name: 'John Updated' }));
    const updateResponse = await httpKernel.request(updateRequest);
    expect(updateResponse.statusCode).toBe(200);
    expect(updateResponse.json).toMatchObject({ id: 1, username: 'john', name: 'John Updated' });

    // Delete by primary key (id)
    const deleteResponse = await httpKernel.request(HttpRequest.DELETE('/entity/user/1'));
    expect(deleteResponse.statusCode).toBe(200);
    expect(deleteResponse.json).toMatchObject({ deleted: 1 });

    // Verify deletion - should return 404
    const readAfterDelete = await httpKernel.request(HttpRequest.GET('/entity/user/1'));
    expect(readAfterDelete.statusCode).toBe(404);
});

@entity.name('userWithCustomId')
class UserWithCustomIdentifier {
    id: number & PrimaryKey & AutoIncrement = 0;
    username: string & Unique = '';
    name: string = '';
}

test('CRUD routes with custom string identifier', async () => {
    const testing = createTestingApp(
        {
            imports: [new FrameworkModule(), createCrudRoutes([UserWithCustomIdentifier], { identifier: 'username' })],
        },
        [UserWithCustomIdentifier],
    );

    const httpKernel = testing.app.get(HttpKernel);

    // Create a user
    const createRequest = HttpRequest.POST('/entity/userWithCustomId');
    createRequest.header('content-type', 'application/json');
    createRequest.body(JSON.stringify({ id: 1, username: 'alice', name: 'Alice Smith' }));
    const createResponse = await httpKernel.request(createRequest);
    expect(createResponse.statusCode).toBe(201);
    expect(createResponse.json).toMatchObject({ id: 1, username: 'alice', name: 'Alice Smith' });

    // Read by custom identifier (username)
    const readResponse = await httpKernel.request(HttpRequest.GET('/entity/userWithCustomId/alice'));
    expect(readResponse.statusCode).toBe(200);
    expect(readResponse.json).toMatchObject({ id: 1, username: 'alice', name: 'Alice Smith' });

    // Update by custom identifier (username)
    const updateRequest = HttpRequest.PUT('/entity/userWithCustomId/alice');
    updateRequest.header('content-type', 'application/json');
    updateRequest.body(JSON.stringify({ name: 'Alice Updated' }));
    const updateResponse = await httpKernel.request(updateRequest);
    expect(updateResponse.statusCode).toBe(200);
    expect(updateResponse.json).toMatchObject({ id: 1, username: 'alice', name: 'Alice Updated' });

    // Delete by custom identifier (username)
    const deleteResponse = await httpKernel.request(HttpRequest.DELETE('/entity/userWithCustomId/alice'));
    expect(deleteResponse.statusCode).toBe(200);
    expect(deleteResponse.json).toMatchObject({ deleted: 1 });

    // Verify deletion - should return 404
    const readAfterDelete = await httpKernel.request(HttpRequest.GET('/entity/userWithCustomId/alice'));
    expect(readAfterDelete.statusCode).toBe(404);
});

@entity.name('userMultiple')
class UserMultiple {
    id: number & PrimaryKey & AutoIncrement = 0;
    username: string & Unique = '';
    email: string & Unique = '';
    name: string = '';
}

test('CRUD routes with custom identifier - multiple users', async () => {
    const testing = createTestingApp(
        {
            imports: [new FrameworkModule(), createCrudRoutes([UserMultiple], { identifier: 'username' })],
        },
        [UserMultiple],
    );

    const httpKernel = testing.app.get(HttpKernel);

    // Create multiple users
    const createRequest1 = HttpRequest.POST('/entity/userMultiple');
    createRequest1.header('content-type', 'application/json');
    createRequest1.body(JSON.stringify({ id: 1, username: 'user1', email: 'user1@test.com', name: 'User One' }));
    await httpKernel.request(createRequest1);

    const createRequest2 = HttpRequest.POST('/entity/userMultiple');
    createRequest2.header('content-type', 'application/json');
    createRequest2.body(JSON.stringify({ id: 2, username: 'user2', email: 'user2@test.com', name: 'User Two' }));
    await httpKernel.request(createRequest2);

    // Read each user by their username
    const readResponse1 = await httpKernel.request(HttpRequest.GET('/entity/userMultiple/user1'));
    expect(readResponse1.statusCode).toBe(200);
    expect(readResponse1.json).toMatchObject({ username: 'user1', name: 'User One' });

    const readResponse2 = await httpKernel.request(HttpRequest.GET('/entity/userMultiple/user2'));
    expect(readResponse2.statusCode).toBe(200);
    expect(readResponse2.json).toMatchObject({ username: 'user2', name: 'User Two' });

    // Update user1 via username identifier
    const updateRequest = HttpRequest.PUT('/entity/userMultiple/user1');
    updateRequest.header('content-type', 'application/json');
    updateRequest.body(JSON.stringify({ name: 'User One Updated' }));
    const updateResponse = await httpKernel.request(updateRequest);
    expect(updateResponse.statusCode).toBe(200);
    expect(updateResponse.json).toMatchObject({ username: 'user1', name: 'User One Updated' });

    // Verify user2 is unchanged
    const readResponse2After = await httpKernel.request(HttpRequest.GET('/entity/userMultiple/user2'));
    expect(readResponse2After.json).toMatchObject({ username: 'user2', name: 'User Two' });

    // Delete user1 via username
    const deleteResponse = await httpKernel.request(HttpRequest.DELETE('/entity/userMultiple/user1'));
    expect(deleteResponse.statusCode).toBe(200);
    expect(deleteResponse.json).toMatchObject({ deleted: 1 });

    // Verify user1 is deleted but user2 still exists
    const readResponse1After = await httpKernel.request(HttpRequest.GET('/entity/userMultiple/user1'));
    expect(readResponse1After.statusCode).toBe(404);

    const readResponse2Final = await httpKernel.request(HttpRequest.GET('/entity/userMultiple/user2'));
    expect(readResponse2Final.statusCode).toBe(200);
});

test('CRUD routes with custom identifier - non-existent entity returns 404', async () => {
    const testing = createTestingApp(
        {
            imports: [new FrameworkModule(), createCrudRoutes([UserWithCustomIdentifier], { identifier: 'username' })],
        },
        [UserWithCustomIdentifier],
    );

    const httpKernel = testing.app.get(HttpKernel);

    // Try to read non-existent user
    const readResponse = await httpKernel.request(HttpRequest.GET('/entity/userWithCustomId/nonexistent'));
    expect(readResponse.statusCode).toBe(404);
    expect(readResponse.json).toMatchObject({ message: 'userWithCustomId not found' });

    // Try to update non-existent user
    const updateRequest = HttpRequest.PUT('/entity/userWithCustomId/nonexistent');
    updateRequest.header('content-type', 'application/json');
    updateRequest.body(JSON.stringify({ name: 'Should Fail' }));
    const updateResponse = await httpKernel.request(updateRequest);
    expect(updateResponse.statusCode).toBe(404);

    // Try to delete non-existent user
    const deleteResponse = await httpKernel.request(HttpRequest.DELETE('/entity/userWithCustomId/nonexistent'));
    expect(deleteResponse.statusCode).toBe(200);
    expect(deleteResponse.json).toMatchObject({ deleted: 0 });
});

test('CRUD routes list all entities works with custom identifier', async () => {
    const testing = createTestingApp(
        {
            imports: [new FrameworkModule(), createCrudRoutes([UserWithCustomIdentifier], { identifier: 'username' })],
        },
        [UserWithCustomIdentifier],
    );

    const httpKernel = testing.app.get(HttpKernel);

    // Create some users
    const createRequest1 = HttpRequest.POST('/entity/userWithCustomId');
    createRequest1.header('content-type', 'application/json');
    createRequest1.body(JSON.stringify({ id: 1, username: 'bob', name: 'Bob' }));
    await httpKernel.request(createRequest1);

    const createRequest2 = HttpRequest.POST('/entity/userWithCustomId');
    createRequest2.header('content-type', 'application/json');
    createRequest2.body(JSON.stringify({ id: 2, username: 'charlie', name: 'Charlie' }));
    await httpKernel.request(createRequest2);

    // List all users (readMany)
    const listResponse = await httpKernel.request(HttpRequest.GET('/entity/userWithCustomId'));
    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json).toHaveLength(2);
    expect(listResponse.json).toEqual(expect.arrayContaining([expect.objectContaining({ username: 'bob', name: 'Bob' }), expect.objectContaining({ username: 'charlie', name: 'Charlie' })]));
});
