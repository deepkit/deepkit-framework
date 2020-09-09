import {DefaultPlatform} from './default-platform';
import {Pool} from 'mariadb';
import {mySqlSerializer} from '../serializer/mysql-serializer';

export class MySQLPlatform extends DefaultPlatform {
    protected defaultSqlType = 'LONGTEXT';
    public readonly serializer = mySqlSerializer;

    constructor(protected pool: Pool) {
        super();

        this.addType('number', 'DOUBLE');
        this.addType('date', 'DATETIME');
        this.addType('moment', 'INT');
        this.addType('boolean', ' TINYINT');
        this.addType('uuid', 'BLOB');
        this.addBinaryType('LONGBLOB');
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