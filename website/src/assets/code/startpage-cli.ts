new App({
    providers: [Database]
})
.command('user:find', async (
    name: string & MinLength<3>,
    withDeleted: boolean & Flag = false,
    database: Database
) => {

    let query = database.query(User)
        .filter({name: {$like: name + '%'});

    if (!withDeleted) {
        query = query.filter({deleted: false});
    }

    const users = await query.find();
})
.run();

// $ ./app.ts user:find Pete --with-deleted
