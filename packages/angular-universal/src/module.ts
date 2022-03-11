/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { createModule } from '@deepkit/app';
import { AngularUniversalListener } from './listener';
import { Config } from './config';
import '@deepkit/type';

export class AngularUniversalModule extends createModule({
    config: Config,
}) {
    process() {
        this.addListener(AngularUniversalListener);
    }
}
