// import {existsSync, readFileSync} from 'fs';
// import {IncomingMessage} from 'http';
//
// const indexPath = __dirname + '/../../../dist/browser/index.html'
// const indexHtml = readFileSync(indexPath).toString();

/**
 * This is an experiment to support rendering Angular in JIT mode.
 */

// async function renderAngular(req: IncomingMessage) {
//     console.log('renderAngular', req.url);
//
//     return new Promise<string>(async (resolve, reject) => {
//         const compilerFactory: CompilerFactory = platformDynamicServer().injector.get(CompilerFactory);
//
//         /** ResourceLoader implementation for loading files */
//         class FileLoader implements ResourceLoader {
//             async get(url: string): Promise<string> {
//                 if (existsSync(url + '.scss')) url += '.scss';
//                 if (existsSync(url + '.css')) url += '.css';
//
//                 if (url.endsWith('.scss')) {
//                     return require('sass').renderSync({file: url});
//                 }
//
//                 return readFileSync(url).toString('utf8');
//             }
//         }
//
//         @Injectable()
//         class MyDirectiveNormalizer extends DirectiveNormalizer {
//             constructor(
//                 _resourceLoader: ResourceLoader, _urlResolver: UrlResolver,
//                 _htmlParser: HtmlParser, _config: CompilerConfig) {
//                 super(_resourceLoader, _urlResolver, _htmlParser, _config)
//             }
//
//             normalizeTemplate(prenormData: PrenormalizedTemplateMetadata): SyncAsync<CompileTemplateMetadata> {
//                 const componentClassName = getClassName(prenormData.componentType);
//                 for (const i in require.cache) {
//                     if (require.cache[i].exports[componentClassName] === prenormData.componentType) {
//                         prenormData.moduleUrl = i;
//                     }
//                 }
//
//                 return super.normalizeTemplate(prenormData);
//             }
//         }
//
//         const compiler = compilerFactory.createCompiler([
//             {providers: [{provide: ResourceLoader, useClass: FileLoader, deps: []}]},
//             // {providers: [{provide: UrlResolver, useClass: MyUrlResolver, deps: []}]},
//             {providers: [{provide: DirectiveNormalizer, useClass: MyDirectiveNormalizer, deps: [ResourceLoader, UrlResolver, HtmlParser, CompilerConfig]}]},
//         ]);
//
//         const factory = await compiler.compileModuleAsync(AppServerModule);
//         // this.factoryCacheMap.set(AppServerModule, factory);
//         console.log('renderModuleFactory');
//         const html = await renderModuleFactory(factory, {extraProviders: [
//                 {
//                     provide: INITIAL_CONFIG,
//                     useValue: {
//                         document: indexHtml,
//                         url: req.url
//                     }
//                 }
//             ]});
//         console.log('res', html);
//
//         resolve(html);
//
//         // (req as any).originalUrl = req.url;
//         // (req as any).get = function(name: string) {
//         //     if (name === 'host') return 'localhost';
//         //     throw new Error(`Unknown option ${name}`);
//         // }
//         //
//         // ngExpressEngine({bootstrap: AppServerModule})(indexPath, {req}, (err, html) => {
//         //     if (err) reject(err); else resolve(html);
//         // });
//     });
//     // return await renderModule(AppServerModule, {
//     //     // return await renderModule(AppServerModule, {
//     //     url: req.url, document: indexHtml, extraProviders: []
//     // });
// }
