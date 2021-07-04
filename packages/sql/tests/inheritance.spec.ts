import { entity, t } from '@deepkit/type';
import { SchemaParser } from '../src/reverse/schema-parser';
import { DatabaseModel } from '../src/schema/table';
import { DefaultPlatform } from '../src/platform/default-platform';
import { expect, test } from '@jest/globals';

@entity.name('person').collectionName('persons')
abstract class Person {
    @t.primary.autoIncrement id: number = 0;
    @t firstName?: string;
    @t lastName?: string;
    @t abstract type: string;
}

@entity.name('employee').singleTableInheritance()
class Employee extends Person {
    @t email?: string;

    @t.literal('employee') type: 'employee' = 'employee';
}

@entity.name('freelancer').singleTableInheritance()
class Freelance extends Person {
    @t token?: string;

    @t.literal('freelancer') type: 'freelancer' = 'freelancer';
}

class MySchemaParser extends SchemaParser {
    parse(database: DatabaseModel, limitTableNames?: string[]): void {
    }
}

class MyPlatform extends DefaultPlatform {
    schemaParserType = MySchemaParser;

    constructor() {
        super();
        this.addType('number', 'integer');
    }
}

test('tables', () => {
    const platform = new MyPlatform();
    const tables = platform.createTables([Employee, Freelance]);

    expect(tables.length).toBe(1);
    const table = tables[0];

    expect(table.columns.length).toBe(6);
    expect(table.getColumn('type').type).toBe('text');
    expect(table.getColumn('type').isNotNull).toBe(true);
});
