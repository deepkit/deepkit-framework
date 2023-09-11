export interface HttpParserOptions {
    /**
     * sets encoding for incoming form fields
     *
     * @default 'utf-8'
     */
    encoding?: BufferEncoding | undefined;

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
}
