class DefaultDatabase extends Database {
    constructor(
        databaseUrl: AppConfig['databaseUrl']
    ) {
        super(new MongoDatabaseAdapter(databaseUrl));
    }
}

function Website(
    props: {page: string, children: any},
    title: AppConfig['pageTitle'],
) {
    return <>
        <h1>{this.title}</h1>
    <h2>{props.page}</h2>
    <div>{props.children}</div>
    </>;
}

class PageController {
    constructor(
        protected debug: AppConfig['debug']
    ) {
}
