/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

export class Config {
    /**
     * @description The path to the built dist file for the browser (with all the assets), usually something like ../../dist/browser.
     */
    browserPath!: string

    /**
     * @description The path to the built dist file for the server, usually something like ../../dist/server
     */
    serverPath!: string;

    /**
     * @description The exported server module name, usually AppServerModule
     */
    serverModuleName: string = 'AppServerModule';
}
