/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { OrmEntity, Query } from '@deepkit/orm';
import { MongoQueryModel } from './query.model.js';

export class MongoDatabaseQuery<T extends OrmEntity,
    MODEL extends MongoQueryModel<T> = MongoQueryModel<T>> extends Query<T> {
}
