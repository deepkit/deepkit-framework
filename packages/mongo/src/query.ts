/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { DatabaseQueryModel, OrmEntity, Query, Sort } from '@deepkit/orm';
import { CommandOptions } from './client/options.js';
import { FilterQuery, MongoQueryModel } from './query.model.js';

export class MongoDatabaseQuery<T extends OrmEntity> extends Query<T> {
    public model!: MongoQueryModel<T>;

    protected createModel<T extends OrmEntity>(): DatabaseQueryModel<T, FilterQuery<T>, Sort<T, any>> {
        return new MongoQueryModel<T>();
    }

    with(options: CommandOptions): this {
        this.model = this.model.clone();
        Object.assign(this.model.options, options);
        return this;
    }
}
