import { OpenAPICoreConfig } from './document.js';

export class OpenAPIConfig extends OpenAPICoreConfig {
    title = 'OpenAPI';
    description = '';
    version = '1.0.0';
    // Prefix for all OpenAPI related controllers
    prefix = '/openapi/';
}
