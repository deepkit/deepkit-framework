import 'reflect-metadata';
import { ApiRoute } from '../api';
import { ClassSchema, classToPlain, plainToClass, PropertySchema, t } from '@deepkit/type';

export class DataStructure {
    @t active: boolean = false;
    @t asReference: boolean = false;

    @t templateIndex: number = -1; //for unions

    constructor(
        @t.any.name('value') public value: any,
    ) {
    }

    @t.array(DataStructure) children: DataStructure[] = [];

    @t.map(DataStructure) properties: { [propertyName: string]: DataStructure } = {};

    getProperty(name: string | number): DataStructure {
        if (!this.properties[name]) this.properties[name] = new DataStructure(undefined);
        return this.properties[name];
    }
}

export function extractDataStructure(ds: DataStructure, property: PropertySchema): any {
    if (property.type === 'class' || property.type === 'partial') {
        if ((property.isReference || property.backReference) && ds.asReference) {
            const primary = property.getResolvedClassSchema().getPrimaryField();
            return extractDataStructure(ds.properties[primary.name], primary);
        }

        return extractDataStructureFromSchema(ds, property.getResolvedClassSchema());
    } else if (property.type === 'map') {
        const v: any = {};
        const keyProperty = property.templateArgs[0];
        const valueProperty = property.templateArgs[1];

        for (const childDs of ds.children) {
            if (!childDs.properties[keyProperty.name]) continue;
            if (!childDs.properties[valueProperty.name]) continue;
            v[extractDataStructure(childDs.properties[keyProperty.name], keyProperty)] = extractDataStructure(childDs.properties[valueProperty.name], valueProperty)
        }

        return v;
    } else if (property.type === 'union') {
        if (ds.templateIndex >= 0) {
            if (!ds.properties[ds.templateIndex]) return undefined;
            if (!property.templateArgs[ds.templateIndex]) return undefined;
            return extractDataStructure(ds.properties[ds.templateIndex], property.templateArgs[ds.templateIndex]);
        }
        return ds.value;
    } else if (property.type === 'array') {
        const list: any = [];
        const valueProperty = property.templateArgs[0];
        if (!valueProperty) return list;

        for (const childDs of ds.children) {
            if (!childDs.properties[valueProperty.name]) continue;
            const v = extractDataStructure(childDs.properties[valueProperty.name], valueProperty);
            if (v === undefined && valueProperty.isValueRequired) continue;
            list.push(v);
        }

        return list;
    } else {
        return ds.value;
    }
}

export function extractDataStructureFromSchema(ds: DataStructure, schema: ClassSchema): any {
    const data: any = {};

    for (const property of schema.getProperties()) {
        const pds = ds.properties[property.name];
        if (!pds) continue;
        if (!property.isValueRequired && !pds.active) continue;
        const v = extractDataStructure(pds, property);
        if (v === undefined && property.isValueRequired) continue;
        data[property.name] = v;
    }

    return data;
}

export class RouteState {
    constructor(
        @t.name('id') public id: string,
        @t.name('fullUrl') public fullUrl: string,
        @t.name('method') public method: string = 'GET',
    ) {
    }

    @t.array(t.any) headers: { name: string, value: string }[] = [];

    @t.array(t.any) fullHeaders: { name: string, value: string }[] = [];

    @t urls: DataStructure = new DataStructure(undefined);
    @t params: DataStructure = new DataStructure(undefined);
    @t body: DataStructure = new DataStructure(undefined);

    resolvedBody?: any;
}

export class Request {

    private loadedJson?: string;
    private loadedResult?: string;

    get result() {
        if (this.loadedResult === undefined) {
            this.loadedResult = localStorage.getItem('@deepkit/api-console/request/result/' + this.bodyStoreId) || undefined;
        }
        return this.loadedResult || undefined;
    }

    set result(v: string | undefined) {
        this.loadedResult = v;
        if (v) localStorage.setItem('@deepkit/api-console/request/result/' + this.bodyStoreId, v);
    }

    get json() {
        if (this.loadedJson === undefined) {
            this.loadedJson = localStorage.getItem('@deepkit/api-console/request/json/' + this.bodyStoreId) || undefined;
        }
        return this.loadedJson || undefined;
    }

    set json(v: string | undefined) {
        this.loadedJson = v;
        if (v) localStorage.setItem('@deepkit/api-console/request/json/' + this.bodyStoreId, v);
    }

    @t.any headers: { name: string, value: string }[] = [];

    @t took: number = 0;
    @t error: string = '';
    @t status: number = 0;
    @t statusText: string = '';

    @t tab: string = 'body';

    @t open?: boolean;

    @t created: Date = new Date();

    getHeader(name: string): string {
        for (const h of this.headers) if (h.name === name) return h.value;
        return '';
    }

    get bodyStoreId(): string {
        return this.id + '_' + this.created.getTime();
    }

    constructor(
        @t.name('id') public id: string,
        @t.name('method') public method: string,
        @t.name('url') public url: string) {
    }
}

export class ViewHttp {
    @t showDescription: boolean = false;
    @t filterCategory: string = '';
    @t filterGroup: string = '';
    @t filterMethod: string = '';
    @t filterPath: string = '';

    @t codeGenerationType: string = 'curl';
    @t codeGenerationVisible: boolean = true;

    @t serverStatsVisible: boolean = false;

    @t viewRequests: 'all' | 'selected' = 'selected';

    @t groupBy: 'none' | 'controller' | 'method' = 'controller';
}

export class Environment {
    @t.array(t.any) headers: { name: string, value: string }[] = [];

    constructor(@t.name('name') public name: string) {
    }
}

export class StoreValue {
    @t.map(RouteState) routeStates: { [name: string]: RouteState } = {};

    @t.array(Request) requests: Request[] = [];

    @t selectedRoute?: string;

    @t viewHttp: ViewHttp = new ViewHttp;

    @t.array(Environment) environments: Environment[] = [new Environment('default')];
    @t activeEnvironmentIndex: number = 0;

    get activeEnvironment(): Environment | undefined {
        return this.environments[this.activeEnvironmentIndex];
    }

    set activeEnvironment(e: Environment | undefined) {
        this.activeEnvironmentIndex = e ? this.environments.indexOf(e) : -1;
    }

    route?: ApiRoute;
}

export class Store {
    public state = new StoreValue;

    constructor() {
        this.restore();
    }

    restore() {
        const t = localStorage.getItem('@deepkit/api-console');
        if (!t) return;
        try {
            this.state = plainToClass(StoreValue, JSON.parse(t));
            console.log('this.state', this.state);
        } catch {
        }

    }

    store() {
        localStorage.setItem('@deepkit/api-console', JSON.stringify(classToPlain(StoreValue, this.state)));
    }

    set(cb: (store: StoreValue) => void) {
        cb(this.state);
        this.store();
    }
}
