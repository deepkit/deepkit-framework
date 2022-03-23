import { ApiAction, ApiRoute } from '@deepkit/api-console-api';
import { RemoteController, RpcClient, RpcClientEventIncomingMessage, RpcClientEventOutgoingMessage } from '@deepkit/rpc';
import { Observable, Subject, Subscription } from 'rxjs';
import {
    deserialize,
    Excluded,
    isBackReferenceType,
    isMapType,
    isOptional,
    isReferenceType,
    isSetType,
    ReflectionClass,
    ReflectionKind,
    serialize,
    Type,
    TypeParameter,
} from '@deepkit/type';

export class DataStructure {
    active: boolean = false;
    asReference: boolean = false;

    typeIndex: number = -1; //for unions

    constructor(
        public value: any,
    ) {
    }

    children: DataStructure[] = [];

    properties: { [propertyName: string]: DataStructure } = {};

    getProperty(name: string | number): DataStructure {
        if (!this.properties[name]) this.properties[name] = new DataStructure(undefined);
        return this.properties[name];
    }
}

export function extractDataStructure(ds: DataStructure, type: Type): any {
    if (type.kind === ReflectionKind.class || type.kind === ReflectionKind.objectLiteral) {
        if ((isReferenceType(type) || isBackReferenceType(type)) && ds.asReference) {
            const primary = ReflectionClass.from(type).getPrimary();
            return extractDataStructure(ds.properties[primary.name], primary.type);
        }

        return extractDataStructureFromSchema(ds, ReflectionClass.from(type));
    } else if (isMapType(type)) {
        const v: any = {};
        if (!type.typeArguments) return;
        const keyProperty = type.typeArguments[0];
        const valueProperty = type.typeArguments[1];

        for (const childDs of ds.children) {
            v[extractDataStructure(childDs.properties['key'], keyProperty)] = extractDataStructure(childDs.properties['value'], valueProperty);
        }

        return v;
    } else if (type.kind === ReflectionKind.union) {
        if (ds.typeIndex >= 0) {
            if (!ds.properties[ds.typeIndex]) return undefined;
            if (!type.types[ds.typeIndex]) return undefined;
            return extractDataStructure(ds.properties[ds.typeIndex], type.types[ds.typeIndex]);
        }
        return ds.value;
    } else if (type.kind === ReflectionKind.array || isSetType(type)) {
        const list: any = [];
        const valueProperty = isSetType(type) ? type.typeArguments![0] : type.kind === ReflectionKind.array ? type.type : undefined;
        if (!valueProperty) return list;

        for (const childDs of ds.children) {
            if (!childDs.properties['value']) continue;
            const v = extractDataStructure(childDs.properties['value'], valueProperty);
            if (v === undefined && !isOptional(valueProperty)) continue;
            list.push(v);
        }

        return list;
    } else {
        return ds.value;
    }
}

export function extractDataStructureFromSchema(ds: DataStructure, schema: ReflectionClass<any>): any {
    const data: any = {};

    for (const property of schema.getProperties()) {
        const pds = ds.properties[property.name];
        if (!pds) continue;
        if (!property.isValueRequired() && !pds.active) continue;
        const v = extractDataStructure(pds, property.type);
        if (v === undefined && property.isValueRequired()) continue;
        data[property.name] = v;
    }

    return data;
}

export function extractDataStructureFromParameters(ds: DataStructure, parameters: TypeParameter[]): any {
    const data: any = {};

    for (const property of parameters) {
        const pds = ds.properties[property.name];
        if (!pds) continue;
        if (property.optional && !pds.active) continue;
        const v = extractDataStructure(pds, property.type);
        if (v === undefined && !property.optional) continue;
        data[property.name] = v;
    }

    return data;
}

export class RouteState {
    constructor(
        public id: string,
        public fullUrl: string,
        public method: string = 'GET',
    ) {
    }

    headers: { name: string, value: string }[] = [];

    fullHeaders: { name: string, value: string }[] = [];

    urls: DataStructure = new DataStructure(undefined);
    params: DataStructure = new DataStructure(undefined);
    body: DataStructure = new DataStructure(undefined);

    resolvedBody?: any & Excluded;

}

export class Request {
    private loadedJson?: string & Excluded;
    private loadedResult?: string & Excluded;

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

    headers: { name: string, value: string }[] = [];

    took: number = 0;
    error: string = '';
    status: number = 0;
    statusText: string = '';

    tab: string = 'body';

    open?: boolean;

    created: Date = new Date();

    getHeader(name: string): string {
        for (const h of this.headers) if (h.name === name) return h.value;
        return '';
    }

    get bodyStoreId(): string {
        return this.id + '_' + this.created.getTime();
    }

    constructor(
        public id: string,
        public method: string,
        public url: string) {
    }
}

export class ViewHttp {
    showDescription: boolean = false;
    filterCategory: string = '';
    filterGroup: string = '';
    filterMethod: string = '';
    filterPath: string = '';

    codeGenerationType: string = 'curl';
    codeGenerationVisible: boolean = true;

    serverStatsVisible: boolean = false;

    viewRequests: 'all' | 'selected' = 'selected';

    groupBy: 'none' | 'controller' | 'method' = 'controller';

    closed: { [name: string]: boolean } = {};
}

export class ViewRpc {
    showDescription: boolean = false;
    filterCategory: string = '';
    filterGroup: string = '';
    filterPath: string = '';

    viewRequests: 'all' | 'selected' = 'selected';
    displayClients: boolean = false;
    displayClientsHeight: number = 170;

    groupBy: 'none' | 'controller' = 'controller';

    closed: { [name: string]: boolean } = {};
}

export class Environment {
    headers: { name: string, value: string }[] = [];

    constructor(public name: string) {
    }
}

export type RpcExecutionSubscription = { id: number, emitted: any[], unsubscribed: boolean, unsubscribe: () => void, completed: boolean, error?: any, sub: Subscription };

export class RpcExecution {
    created: Date = new Date();

    //we don't store a reference because the client could be deleted anytime.
    clientName: string = '';

    open?: boolean;

    address?: string;
    took: number = -1;

    error?: any;

    protected _result?: any & Excluded;

    type: 'subject' | 'observable' | 'static' = 'static';

    isObservable(): boolean {
        return this.type === 'subject' || this.type === 'observable';
    }

    public subject?: Subject<any> & Excluded;
    public observable?: Observable<any> & Excluded;

    public subscriptionsId: number & Excluded = 0;
    public subscriptions: RpcExecutionSubscription[] & Excluded = [];

    get result() {
        if (this._result === undefined) {
            const json = localStorage.getItem('@deepkit/api-console/rpcExecution/result/' + this.bodyStoreId);
            if (json) {
                this._result = JSON.parse(json);
            }
        }
        return this._result || undefined;
    }

    set result(v: any | undefined) {
        this._result = v;
        if (v) localStorage.setItem('@deepkit/api-console/rpcExecution/result/' + this.bodyStoreId, JSON.stringify(v));
    }

    get bodyStoreId(): string {
        return this.controllerPath + '-' + this.method + '_' + this.created.getTime();
    }

    constructor(
        public controllerClassName: string,
        public controllerPath: string,
        public method: string,
        public args: any[],
    ) {
    }

    actionId() {
        return this.controllerPath + '.' + this.method;
    }
}

export class RpcActionState {
    constructor(
        public id: string,
    ) {
    }

    params: DataStructure = new DataStructure(undefined);
}

export class RpcClientConfiguration {
    public client?: RpcClient & Excluded;

    controller: { [path: string]: RemoteController<any> } & Excluded = {};

    incomingMessages: RpcClientEventIncomingMessage[] & Excluded = [];
    outgoingMessages: RpcClientEventOutgoingMessage[] & Excluded = [];

    constructor(
        public name: string,
    ) {
    }
}

export class StoreValue {
    routeStates: { [name: string]: RouteState } = {};
    rpcActionStates: { [name: string]: RpcActionState } = {};

    requests: Request[] = [];
    rpcExecutions: RpcExecution[] = [];

    selectedRoute?: string;

    viewRpc: ViewRpc = new ViewRpc;
    viewHttp: ViewHttp = new ViewHttp;

    environments: Environment[] = [new Environment('default')];
    activeEnvironmentIndex: number = 0;

    rpcClients: RpcClientConfiguration[] = [new RpcClientConfiguration('Client 1')];
    activeRpcClientIndex: number = 0;

    activeDebugRpcClientIndex: number = 0;

    get rpcClient(): RpcClientConfiguration | undefined {
        return this.rpcClients[this.activeRpcClientIndex];
    }

    set rpcClient(v: RpcClientConfiguration | undefined) {
        this.activeRpcClientIndex = v ? this.rpcClients.indexOf(v) : -1;
    }

    get activeEnvironment(): Environment | undefined {
        return this.environments[this.activeEnvironmentIndex];
    }

    set activeEnvironment(e: Environment | undefined) {
        this.activeEnvironmentIndex = e ? this.environments.indexOf(e) : -1;
    }

    getRpcActionState(action: ApiAction): RpcActionState {
        let rpcState: RpcActionState | undefined = this.rpcActionStates[action.id];
        if (!rpcState) {
            rpcState = new RpcActionState(action.id);
            this.rpcActionStates[action.id] = rpcState!;
        }
        return rpcState;
    }

    route?: ApiRoute & Excluded;
    action?: ApiAction & Excluded;
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
            this.state = deserialize<StoreValue>(JSON.parse(t));
            console.log('this.state', this.state);
        } catch {
        }

    }

    store() {
        localStorage.setItem('@deepkit/api-console', JSON.stringify(serialize<StoreValue>(this.state)));
    }

    set(cb: (store: StoreValue) => void) {
        cb(this.state);
        this.store();
    }
}
