import { asyncOperation, ClassType, CompilerContext, getClassName, isObject } from '@deepkit/core';
import { InjectorModule } from '@deepkit/injector';
import {
    assertType,
    findMember,
    getSerializeFunction,
    getValidatorFunction,
    hasDefaultValue,
    isOptional,
    metaAnnotation,
    ReflectionKind,
    ReflectionParameter,
    resolveReceiveType,
    serializer,
    stringifyType,
    Type,
    typeToObject,
    ValidationError,
} from '@deepkit/type';
import { BodyValidationError, createRequestWithCachedBody, getRegExp, HttpRequest, ValidatedBody } from './model.js';
import { getRouteActionLabel, RouteConfig, UploadedFile, UploadedFileSymbol } from './router.js';

//@ts-ignore
import qs from 'qs';

// @ts-ignore
import formidable from 'formidable';
import { HttpParserOptions } from './module.config.js';


function parseBody(
    options: HttpParserOptions,
    req: HttpRequest, foundFiles: { [name: string]: UploadedFile }) {
    const form = formidable(Object.assign(options, {
        multiples: true,
    }));
    return asyncOperation((resolve, reject) => {
        function parseData(err: any, fields: any, files: any) {
            if (err) {
                reject(err);
            } else {
                for (const [name, file] of Object.entries(files) as any) {
                    if (file.size === 0) continue;
                    foundFiles[name] = {
                        validator: UploadedFileSymbol,
                        size: file.size,
                        path: file.filepath,
                        name: file.originalFilename,
                        type: file.mimetype,
                        lastModifiedDate: file.lastModifiedDate,
                    };
                }
                const body = { ...fields, ...foundFiles };
                resolve(body);
            }
        }

        if (req.body) {
            form.parse(createRequestWithCachedBody(req, req.body), parseData);
            return;
        }

        const chunks: Buffer[] = [];

        function read(chunk: Buffer) {
            chunks.push(chunk);
        }

        req.on('data', read);
        req.once('end', () => {
            req.body = Buffer.concat(chunks);
            req.off('data', read);
        });
        req.once('error', () => req.off('data', read));

        form.parse(req, parseData);
    });
}

export class ParameterForRequestParser {
    regexPosition?: number;

    constructor(
        public parameter: ReflectionParameter,
    ) {
    }

    get body() {
        return metaAnnotation.getForName(this.parameter.type, 'httpBody') !== undefined;
    }

    get bodyValidation() {
        return metaAnnotation.getForName(this.parameter.type, 'httpBodyValidation') !== undefined;
    }

    getType(): Type {
        if (this.bodyValidation) {
            assertType(this.parameter.type, ReflectionKind.class);
            const valueType = findMember('value', this.parameter.type.types);
            if (!valueType || valueType.kind !== ReflectionKind.property) throw new Error(`No property value found at ${stringifyType(this.parameter.type)}`);
            return valueType.type as Type;
        }
        return this.parameter.type;
    }

    get header() {
        return metaAnnotation.getForName(this.parameter.type, 'httpHeader') !== undefined;
    }

    get query() {
        return metaAnnotation.getForName(this.parameter.type, 'httpQuery') !== undefined;
    }

    get queries() {
        return metaAnnotation.getForName(this.parameter.type, 'httpQueries') !== undefined;
    }

    get typePath(): string | undefined {
        const typeOptions = metaAnnotation.getForName(this.parameter.type, 'httpQueries') || metaAnnotation.getForName(this.parameter.type, 'httpQuery')
            || metaAnnotation.getForName(this.parameter.type, 'httpPath') || metaAnnotation.getForName(this.parameter.type, 'httpHeader');
        if (!typeOptions) return;
        const options = typeToObject(typeOptions[0]);
        if (isObject(options)) return options.name;
        return;
    }

    getName() {
        return this.parameter.name;
    }

    isPartOfPath(): boolean {
        return metaAnnotation.getForName(this.parameter.type, 'httpPath') !== undefined || this.regexPosition !== undefined;
    }
}

export function parseRoutePathToRegex(path: string, params: ReflectionParameter[]): { regex: string, parameterNames: { [name: string]: number } } {
    const parameterNames: { [name: string]: number } = {};

    let argumentIndex = 0;
    path = path.replace(/:(\w+)/g, (a, name) => {
        parameterNames[name] = argumentIndex;
        argumentIndex++;
        const parameter = params.find(v => v.name === name);
        if (parameter) {
            const regExp = getRegExp(parameter.type);
            if (regExp instanceof RegExp) {
                return '(' + regExp.source + ')';
            } else if (regExp) {
                return '(' + regExp + ')';
            }
        }
        return String.raw`([^/]+)`;
    });

    return { regex: path, parameterNames };
}

function isTypeUnknown(type: Type): boolean {
    if (type.id) return false; //if is has an id we treat it as nominal type
    return type.kind === ReflectionKind.unknown || type.kind === ReflectionKind.any
        || type.kind === ReflectionKind.never;
}

export function buildRequestParser(parseOptions: HttpParserOptions, parameters: ReflectionParameter[], path?: string): (request: HttpRequest) => any[] {
    const compiler = new CompilerContext();
    const params = parameters.map(v => new ParameterForRequestParser(v));

    //todo: parse path
    let pathRegex = '';
    if (path) {
        const parsedPath = parseRoutePathToRegex(path, parameters);
        pathRegex = parsedPath.regex;

        for (const param of params) {
            param.regexPosition = parsedPath.parameterNames[param.parameter.name];
        }
    }

    const code = getRequestParserCodeForParameters(compiler, parseOptions, params, {});
    compiler.context.set('ValidationError', ValidationError);
    compiler.context.set('qs', qs);

    let needsQueryString = !!params.find(v => v.query || v.queries);
    const query = needsQueryString ? '_qPosition === -1 ? {} : qs.parse(_url.substr(_qPosition + 1))' : '{}';

    const regexVar = compiler.reserveVariable('regex', new RegExp('^' + pathRegex + '$'));

    return compiler.build(`
        const _method = request.method || 'GET';
        const _url = request.url || '/';
        const _headers = request.headers || {};
        const _qPosition = _url.indexOf('?');
        let uploadedFiles = {};
        const _path = _qPosition === -1 ? _url : _url.substr(0, _qPosition);
        const _match = _path.match(${regexVar}) || [];
        const _query = ${query};
        return ${code}
    `, 'request');
}

export function getRequestParserCodeForParameters(
    compiler: CompilerContext,
    parseOptions: HttpParserOptions,
    parameters: ParameterForRequestParser[],
    config: {
        module?: InjectorModule<any>,
        resolverForParameterName?: Map<string, ClassType>,
        resolverForToken?: Map<any, ClassType>,
        pathParameterNames?: { [name: string]: number },
        routeConfig?: RouteConfig,
    },
) {
    let enableParseBody = false;
    let requiresAsyncParameters = false;
    const setParameters: string[] = [];
    const parameterNames: string[] = [];
    const parameterValidator: string[] = [];
    let setParametersFromPath = '';
    let bodyValidationErrorHandling = `if (bodyErrors.length) throw ValidationError.from(bodyErrors);`;

    for (const parameter of parameters) {
        if (parameter.body || parameter.bodyValidation) {
            const type = parameter.getType();
            const validatorVar = compiler.reserveVariable('argumentValidator', getValidatorFunction(undefined, type));
            const converterVar = compiler.reserveVariable('argumentConverter', getSerializeFunction(type, serializer.deserializeRegistry));

            enableParseBody = true;
            setParameters.push(`parameters.${parameter.parameter.name} = ${converterVar}(bodyFields, {loosely: true});`);
            parameterValidator.push(`${validatorVar}(parameters.${parameter.parameter.name}, {errors: bodyErrors});`);
            if (parameter.bodyValidation) {
                compiler.context.set('BodyValidation', ValidatedBody);
                compiler.context.set('BodyValidationError', BodyValidationError);
                parameterNames.push(`new BodyValidation(new BodyValidationError(bodyErrors), bodyErrors.length === 0 ? parameters.${parameter.parameter.name} : undefined)`);
                bodyValidationErrorHandling = '';
            } else {
                parameterNames.push(`parameters.${parameter.parameter.name}`);
            }
        } else if (parameter.query || parameter.queries || parameter.header) {
            const converted = getSerializeFunction(parameter.parameter.parameter, serializer.deserializeRegistry, undefined, parameter.getName());
            const validator = getValidatorFunction(undefined, parameter.parameter.parameter);
            const converterVar = compiler.reserveVariable('argumentConverter', converted);
            const validatorVar = compiler.reserveVariable('argumentValidator', validator);

            const queryPath = parameter.typePath === undefined && !parameter.queries ? parameter.parameter.name : parameter.typePath;
            const accessor = queryPath ? `['` + (queryPath.replace(/\./g, `']['`)) + `']` : '';
            const queryAccessor = parameter.header ? `_headers${accessor}` : queryPath ? `_query${accessor}` : '_query';

            if (isOptional(parameter.parameter.parameter) || hasDefaultValue(parameter.parameter.parameter)) {
                setParameters.push(`parameters.${parameter.parameter.name} = ${queryAccessor} === undefined ? undefined : ${converterVar}(${queryAccessor}, {loosely: true});`);
            } else {
                setParameters.push(`parameters.${parameter.parameter.name} = ${converterVar}(${queryAccessor}, {loosely: true});`);
            }

            parameterNames.push(`parameters.${parameter.parameter.name}`);
            parameterValidator.push(`${validatorVar}(parameters.${parameter.parameter.name}, {errors: validationErrors}, ${JSON.stringify(parameter.typePath || parameter.getName())});`);
        } else {
            parameterNames.push(`parameters.${parameter.parameter.name}`);

            if (parameter.isPartOfPath()) {
                if (parameter.parameter.type.kind !== ReflectionKind.class) {
                    const converted = getSerializeFunction(parameter.parameter.parameter, serializer.deserializeRegistry, undefined, parameter.getName());
                    const converterVar = compiler.reserveVariable('argumentConverter', converted);
                    setParameters.push(`parameters.${parameter.parameter.name} = ${converterVar}(_match[${1 + (parameter.regexPosition || 0)}], {loosely: true});`);

                    const validator = getValidatorFunction(undefined, parameter.parameter.parameter);
                    const validatorVar = compiler.reserveVariable('argumentValidator', validator);
                    parameterValidator.push(`${validatorVar}(parameters.${parameter.parameter.name}, {errors: validationErrors}, ${JSON.stringify(parameter.getName())});`);
                } else {
                    setParameters.push(`parameters.${parameter.parameter.name} = _match[${1 + (parameter.regexPosition || 0)}];`);
                }
            }

            const injectorTokenVar = compiler.reserveVariable('type', parameter.parameter.type);
            const parameterResolverFoundVar = compiler.reserveVariable('parameterResolverFound', false);

            setParameters.push(`${parameterResolverFoundVar} = false;`);

            const resolverType = config.resolverForParameterName?.get(parameter.getName())
                || config.resolverForToken?.get(parameter.parameter.type.kind === ReflectionKind.class ? parameter.parameter.type.classType : undefined);

            //make sure all parameter values from the path are available, important for parameter resolver
            if (resolverType && !setParametersFromPath && config.pathParameterNames) {
                for (const i in config.pathParameterNames) {
                    setParametersFromPath += `parameters.${i} = _match[${1 + config.pathParameterNames[i]}];`;
                }
            }

            if (!resolverType && !parameter.isPartOfPath() && isTypeUnknown(parameter.parameter.type)) {
                const label = config.routeConfig ? getRouteActionLabel(config.routeConfig?.action) + ' ' : '';
                throw new Error(`Parameter ${label}${JSON.stringify(parameter.parameter.name)} has no runtime type. Runtime types disabled or circular dependencies?`);
            }

            let injector = '_injector';
            const moduleVar = config.module ? ', ' + compiler.reserveConst(config.module, 'module') : '';

            if (resolverType) {
                requiresAsyncParameters = true;
                let instanceFetcher = '';
                if (config.module && config.module.injector) {
                    const resolverResolverVar = compiler.reserveVariable('resolverProvideToken', config.module.injector.createResolver(resolveReceiveType(resolverType)));
                    instanceFetcher = `${resolverResolverVar}(${injector}.scope)`;
                } else {
                    const resolverProvideTokenVar = compiler.reserveVariable('resolverProvideToken', resolverType);
                    instanceFetcher = `${injector}.get(${resolverProvideTokenVar}${moduleVar})`;
                }
                const instance = compiler.reserveVariable('resolverInstance');

                const routeConfigVar = compiler.reserveVariable('routeConfigVar', config.routeConfig);
                const classTypeToken = parameter.parameter.type.kind === ReflectionKind.class ? parameter.parameter.type.classType : undefined;
                const classTypeTokenVar = compiler.reserveVariable('classType', classTypeToken);
                setParameters.push(`
                    //resolver ${getClassName(resolverType)} for ${parameter.getName()}
                    ${instance} = ${instanceFetcher};
                    if (!${parameterResolverFoundVar}) {
                        ${parameterResolverFoundVar} = true;
                        parameters.${parameter.parameter.name} = await ${instance}.resolve({
                            token: ${classTypeTokenVar},
                            route: ${routeConfigVar},
                            request: request,
                            name: ${JSON.stringify(parameter.parameter.name)},
                            value: parameters.${parameter.parameter.name},
                            query: _query,
                            parameters: parameters,
                            type: ${compiler.reserveVariable('parameterType', parameter.parameter)}
                        });
                    }`);
            }

            if (!parameter.isPartOfPath()) {
                //todo: if injectorToken is a Type, then this will be very slow since Injector.createResolver is used all the time.
                let injectorGet = `parameters.${parameter.parameter.name} = ${injector}.get(${injectorTokenVar});`;
                if (parameter.parameter.isOptional()) {
                    injectorGet = `try {parameters.${parameter.parameter.name} = ${injector}.get(${injectorTokenVar}); } catch (e) {}`;
                }
                setParameters.push(`if (!${parameterResolverFoundVar}) ${injectorGet}`);
            }
        }
    }


    let parseBodyLoading = '';
    if (enableParseBody) {
        const parseOptionsVar = compiler.reserveVariable('parseOptions', parseOptions);
        const parseBodyVar = compiler.reserveVariable('parseBody', parseBody);
        parseBodyLoading = `
            const bodyFields = (await ${parseBodyVar}(${parseOptionsVar}, request, uploadedFiles));`;
        requiresAsyncParameters = true;
    }

    let parametersLoader = '() => {}';

    if (setParameters.length) {
        parametersLoader = `${requiresAsyncParameters ? 'async' : ''} function parse(_injector){
                const validationErrors = [];
                const bodyErrors = [];
                const parameters = {};
                ${setParametersFromPath}
                ${parseBodyLoading}
                ${setParameters.join('\n')}
                ${parameterValidator.join('\n')}
                ${bodyValidationErrorHandling}
                if (validationErrors.length) throw new ValidationError(validationErrors);
                return {arguments: [${parameterNames.join(',')}], parameters: parameters};
            }`;
    }
    return parametersLoader;
}
