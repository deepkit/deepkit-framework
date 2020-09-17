export interface Migration {
    databaseName: string;
    version: number;
    name?: string;

    up(): string[];

    down(): string[];
}
