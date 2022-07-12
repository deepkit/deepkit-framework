/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { MongoClientConfig } from '../../config.js';
import { Command } from '../command.js';

export interface MongoAuth {
    auth(command: Command, config: MongoClientConfig): Promise<void>;
}
