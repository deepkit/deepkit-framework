export class Config {
    dbPath: string = '/tmp/myapp.sqlite';

    /**
     * @description In development we enable FrameworkModule debugger.
     *              In production we enable JSON logger.
     */
    environment: 'development' | 'production' = 'development';
}
