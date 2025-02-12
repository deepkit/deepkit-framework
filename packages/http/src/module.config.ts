export interface HttpParserOptions {
    /**
     * sets encoding for incoming form fields
     *
     * @default 'utf-8'
     */
    encoding?: string | undefined;

    /**
     * the directory for placing file uploads in. You can move them later by using fs.rename()
     *
     * @default os.tmpdir()
     */
    uploadDir?: string | undefined;

    /**
     * to include the extensions of the original files or not
     *
     * @default false
     */
    keepExtensions?: boolean | undefined;

    /**
     * allow upload empty files
     *
     * @default true
     */
    allowEmptyFiles?: boolean | undefined;

    /**
     * the minium size of uploaded file
     *
     * @default 1
     */
    minFileSize?: number | undefined;

    /**
     * limit the amount of uploaded files, set Infinity for unlimited
     *
     * @default Infinity
     */
    maxFiles?: number | undefined;

    /**
     * limit the size of uploaded file
     *
     * @default 200 * 1024 * 1024
     */
    maxFileSize?: number | undefined;

    /**
     * limit the size of the batch of uploaded files
     *
     * @default options.maxFileSize
     */
    maxTotalFileSize?: number | undefined;

    /**
     * limit the number of fields, set 0 for unlimited
     *
     * @default 1000
     */
    maxFields?: number | undefined;

    /**
     * limit the amount of memory all fields together (except files) can allocate in bytes
     *
     * @default 20 * 1024 * 1024
     */
    maxFieldsSize?: number | undefined;

    /**
     * include checksums calculated for incoming files, set this to some hash algorithm, see
     * crypto.createHash for available algorithms
     *
     * @default false
     */
    hashAlgorithm?: string | false | undefined;

    /**
     * when you call the .parse method, the files argument (of the callback) will contain arrays of
     * files for inputs which submit multiple files using the HTML5 multiple attribute. Also, the
     * fields argument will contain arrays of values for fields that have names ending with '[]'
     *
     * @default false
     */
    multiples?: boolean | undefined;

    enabledPlugins?: string[] | undefined;
}

export class HttpConfig {

    debug: boolean = false;

    parser: HttpParserOptions = {};

    /**
     * Limits maximum incoming headers count. If set to 0, no limit will be applied.
     */
    maxHeadersCount?: number;

    /**
     * The maximum number of requests socket can handle
     * before closing keep alive connection.
     *
     * A value of `0` will disable the limit.
     *
     * When the limit is reached it will set the `Connection` header value to `close`,
     * but will not actually close the connection, subsequent requests sent
     * after the limit is reached will get `503 Service Unavailable` as a response.
     */
    maxRequestsPerSocket?: number;

    /**
     * The number of milliseconds of inactivity before a socket is presumed
     * to have timed out.
     *
     * A value of `0` will disable the timeout behavior on incoming connections.
     *
     * The socket timeout logic is set up on connection, so changing this
     * value only affects new connections to the server, not any existing connections.
     */
    timeout?: number;

    /**
     * Limit the amount of time the parser will wait to receive the complete HTTP
     * headers.
     *
     * If the timeout expires, the server responds with status 408 without
     * forwarding the request to the request listener and then closes the connection.
     *
     * It must be set to a non-zero value (e.g. 120 seconds) to protect against
     * potential Denial-of-Service attacks in case the server is deployed without a
     * reverse proxy in front.
     */
    headersTimeout?: number;

    /**
     * The number of milliseconds of inactivity a server needs to wait for additional
     * incoming data, after it has finished writing the last response, before a socket
     * will be destroyed. If the server receives new data before the keep-alive
     * timeout has fired, it will reset the regular inactivity timeout, i.e., `server.timeout`.
     *
     * A value of `0` will disable the keep-alive timeout behavior on incoming
     * connections.
     * A value of `0` makes the http server behave similarly to Node.js versions prior
     * to 8.0.0, which did not have a keep-alive timeout.
     *
     * The socket timeout logic is set up on connection, so changing this value only
     * affects new connections to the server, not any existing connections.
     */
    keepAliveTimeout?: number;

    /**
     * Sets the timeout value in milliseconds for receiving the entire request from
     * the client.
     *
     * If the timeout expires, the server responds with status 408 without
     * forwarding the request to the request listener and then closes the connection.
     *
     * It must be set to a non-zero value (e.g. 120 seconds) to protect against
     * potential Denial-of-Service attacks in case the server is deployed without a
     * reverse proxy in front.
     *
     * Default is 5 minutes.
     */
    requestTimeout?: number;
}
