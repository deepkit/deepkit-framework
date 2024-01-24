// GET /user/34
router.get('/user/:id', async (id: integer & Positive, database: Database): Promise<User> => {
    return await database.query(User).filter({ id }).findOne();
});

// GET /user?limit=5
router.get('/user', async (limit: HttpQuery<integer> & Maximum<100> = 10, database: Database): Promise<User[]> => {
    return await database.query(User).limit(limit).find();
});
