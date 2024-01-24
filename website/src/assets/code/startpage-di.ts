interface DatabaseInterface {
    query<T>(model: Class<T>): Query<T>;
}

class Database implements DatabaseInterface {
    query<T>(model: Class<T>): Query<T> {
        // ...
    }
}

class UserAPI {
    // database is automatically injected
    constructor(private database: DatabaseInterface) {}

    @http.GET('/user/:id')
    async user(id: integer & Positive): Promise<User> {
        return await this.database.query(User).filter({ id }).findOne();
    }
}

router.get('/user/:id', async (id: integer & Positive, database: DatabaseInterface) => {
    return await database.query(User).filter({ id }).findOne();
});
