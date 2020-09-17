export interface Migration {
    databaseName: string;
    adapterName: string;
    created: Date;
    name?: string;

    up(): string[];

    down(): string[];
}
