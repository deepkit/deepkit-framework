import {DefaultPlatform} from './default-platform';
import {Pool} from 'mariadb';
import {mySqlSerializer} from '../serializer/mysql-serializer';

export class MySQLPlatform extends DefaultPlatform {
    protected defaultSqlType = 'longtext';
    public readonly serializer = mySqlSerializer;

    constructor(protected pool: Pool) {
        super();

        this.addType('number', 'double');
        this.addType('date', 'datetime');
        this.addType('moment', 'datetime');
        this.addType('boolean', 'tinyint');
        this.addType('uuid', 'blob');
        this.addBinaryType('longblob');
    }

    quoteValue(value: any): string {
        return this.pool.escape(value);
    }

    quoteIdentifier(id: string): string {
        return this.pool.escapeId(id);
    }

    getAutoIncrement() {
        return 'AUTO_INCREMENT';
    }

    getBeginDDL(): string {
        return `
# This is a fix for InnoDB in MySQL >= 4.1.x
# It "suspends judgement" for foreign key relationships until all tables are set.
SET FOREIGN_KEY_CHECKS = 0;`;
    }

    getEndDDL(): string {
        return `
# This restores the foreign key checks, after having unset them earlier
SET FOREIGN_KEY_CHECKS = 1;`;
    }
}
