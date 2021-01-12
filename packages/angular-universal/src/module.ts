/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { createModule } from '@deepkit/framework';
import { AngularUniversalListener } from './listener';
import { config } from './config';

export const AngularUniversalModule = createModule({
    name: 'angular-universal',
    config: config,
    listeners: [
        AngularUniversalListener
    ]
}).forRoot();
