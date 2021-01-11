/*
 * Deepkit Framework
 * Copyright (C) 2020 Deepkit UG
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

import { DefaultPlatform } from './default-platform';
import { Pool } from 'mariadb';
import { mySqlSerializer } from '../serializer/mysql-serializer';
import { Column } from '../schema/table';
import { MySQLOptions, PropertySchema } from '@deepkit/type';
import { parseType } from '../reverse/schema-parser';
import { MysqlSchemaParser } from '../reverse/mysql-schema-parser';

export class MySQLPlatform extends DefaultPlatform {
    protected defaultSqlType = 'longtext';
    schemaParserType = MysqlSchemaParser;

    public readonly serializer = mySqlSerializer;

    constructor(protected pool: Pool) {
        super();

        this.nativeTypeInformation.set('blob', { needsIndexPrefix: true, defaultIndexSize: 767 });
        this.nativeTypeInformation.set('longtext', { needsIndexPrefix: true, defaultIndexSize: 767 });
        this.nativeTypeInformation.set('longblob', { needsIndexPrefix: true, defaultIndexSize: 767 });

        this.addType('number', 'double');
        this.addType('date', 'datetime');
        this.addType('boolean', 'tinyint', 1);
        this.addType('uuid', 'binary', 16);
        this.addBinaryType('longblob');
    }

    protected setColumnType(column: Column, typeProperty: PropertySchema) {
        const db = (typeProperty.data['mysql'] || {}) as MySQLOptions;
        if (db.type) {
            parseType(column, db.type);
            return;
        }

        super.setColumnType(column, typeProperty);
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
