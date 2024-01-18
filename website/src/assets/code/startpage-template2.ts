function User(
    props: {user: number, children: any},
    database: Database)
{
    const user = await database.query(User)
        .filter({id: props.user})
        .findOne();
    return <>
        {html('<!DOCTYPE html>')}
    <html>
        <head>
            <title>{this.props.title}</title>
    <link rel="stylesheet" href="/style.css"/>
        </head>
        <body>
        <h1>User {user.username}</h1>
    // ...
    </body>
    </html>
    </>;
}
