import {join} from "path";
import {pathExistsSync} from "fs-extra";
import {readFileSync} from "fs";

class ConfigOptionNotFound extends Error {
}

export class Configuration {
    protected container: { [name: string]: any } = {};
    public basePath: string = process.cwd();

    constructor() {
    }

    /**
     * Reads a .env file from given path, based to basePath.
     */
    public loadEnvFile(path: string) {
        path = join(this.basePath, path);
        if (pathExistsSync(path)) {
            const RE_INI_KEY_VAL = /^\s*([\w.-]+)\s*=\s*(.*)?\s*$/;

            const content = readFileSync(path);
            for (const line of content.toString('utf8').split('\n')) {
                const keyValueArr = line.match(RE_INI_KEY_VAL)
                if (!keyValueArr) continue;

                const key = keyValueArr[1];
                let value = keyValueArr[2] || '';
                const end = value.length - 1;

                const isDoubleQuoted = value[0] === '"' && value[end] === '"'
                const isSingleQuoted = value[0] === "'" && value[end] === "'"

                // if single or double quoted, remove quotes
                if (isSingleQuoted) {
                    value = value.substring(1, end)
                } else if (isDoubleQuoted) {
                    value = JSON.parse(value)
                } else {
                    value = value.trim()
                }

                this.container[key] = value;
            }
        }
    }

    /**
     * Returns the value for a configuration option.
     *
     * Priority is first process.env, then manually set options, then values from the loaded env file.
     */
    public get<T = any>(name: string): T {
        if (process.env[name] !== undefined) return process.env[name] as any;

        if (this.container[name] !== undefined) return this.container[name];

        throw new ConfigOptionNotFound(`Config option ${name} not found.`);
    }

    /**
     * Sets an option value. If a env file has been read, it will be overwritten.
     */
    public set(name: string, value: any) {
        this.container[name] = value;
    }
}
