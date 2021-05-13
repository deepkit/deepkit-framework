
export enum FrameCategory {
    none,
    http, rpc, cli, job, function, lock,
    workflow, event, database, email, template,
}

export enum FrameType {
    start, end
}

export type FrameCategoryModel = {
    [FrameCategory.none]: never;
    [FrameCategory.http]: {
        url: string,
        method: string,
        clientIp: string,

        responseStatus?: number,

        //these are stored externally, and fetched from the GUI via a custom RPC action
        // requestBody: string,
        // responseBody: string,
    };
    [FrameCategory.rpc]: {
        controller: string,
        action: string,
        // parameter: any[],
    };
    [FrameCategory.database]: {
        name: string,
        entity: string,
        sql: string,
        // parameter: any[],
    };
    [FrameCategory.template]: {
        path: string;
        name: string;
    };
    [FrameCategory.lock]: {
        name: string;
    },
    [FrameCategory.workflow]: {
        name: string;
    },
    [FrameCategory.event]: {
        name: string;
    },
    [FrameCategory.email]: {
        name: string;
    },
    [FrameCategory.cli]: {
        name: string;
        //where are parameters stored?
    },
    [FrameCategory.function]: {
        name: string;
        //where is the stack trace stored?
    };
}

export interface FrameStart {
    id: number;
    worker: number;
    type: FrameType.start;
    timestamp: number;
    context: number;
    label: string;
    category: FrameCategory;
}

export interface FrameEnd {
    id: number;
    worker: number;
    type: FrameType.end;
    timestamp: number;
}

export interface FrameData {
    id: number;
    worker: number;
    category: FrameCategory;
    data: any
}
