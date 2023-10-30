import { ReflectionKind, Type, typeOf } from '@deepkit/type';

export type AnalyticData = {
    timestamp: number;
    cpu: number;
    memory: number;
    loopBlocked: number;
}

export enum FrameCategory {
    none,
    http, httpController, rpc, rpcAuthenticate, cli, job, function, lock,
    workflow, event, database, databaseQuery, email, template,
}

export enum FrameType {
    start, end
}

export interface FrameCategoryData {
    [FrameCategory.http]: {
        url?: string;
        method?: string;
        clientIp?: string;
        responseStatus?: number;
    };
    [FrameCategory.rpc]: {
        method: string;
        controller: string;
        arguments: any[];
    };
    [FrameCategory.database]: {
        collection?: string;
        className?: string;
    };
    [FrameCategory.databaseQuery]: {
        sql: string;
        sqlParams?: any[];
    };
}

export type TypeOfCategory<C extends FrameCategory> = C extends keyof FrameCategoryData ? Partial<FrameCategoryData[C]> : undefined;

const categorySchemas: { [category in FrameCategory]?: Type } & { _loaded: boolean } = { _loaded: false };

export function getTypeOfCategory(category: FrameCategory): Type | undefined {
    if (!categorySchemas._loaded) {
        const types = typeOf<FrameCategoryData>();
        if (types.kind === ReflectionKind.objectLiteral) {
            for (const member of types.types) {
                if (member.kind !== ReflectionKind.propertySignature) continue;
                categorySchemas[member.name as FrameCategory] = member.type;
            }
        }
        categorySchemas._loaded = true;
    }
    return categorySchemas[category];
}

export interface FrameStart {
    cid: number;
    type: FrameType.start;
    timestamp: number;
    context: number;
    label: string;
    category: FrameCategory;
}

export interface FrameEnd {
    cid: number;
    type: FrameType.end;
    timestamp: number;
}

export interface FrameData {
    cid: number;
    category: FrameCategory;
    data: any;
}

export function encodeCompoundKey(id: number, worker: number): number {
    return (id << 8) + worker;
}

export function incrementCompoundKey(cid: number, id: number): number {
    return cid + (id << 8);
}

export function decodeCompoundKey(cid: number): [id: number, worker: number] {
    const id = cid >> 8;
    const worker = cid & 0xff;
    return [id, worker];
}

export class Frame {
    end?: number;
    data?: any;

    constructor(
        public cid: number,
        public start: number,
        public context: number,
        public label: string,
        public category: FrameCategory,
    ) {
    }
}

//
// function getFrames(frames: (FrameStart | FrameEnd)[], data: FrameData[], filter: (frame: FrameStart) => boolean): Frame[] {
//     const result: Frame[] = [];
//     const idMap = new Map<number, Frame>();
//     const contextMap = new Map<number, Frame>();
//
//     for (const frame of frames) {
//         if (frame.type === FrameType.start) {
//             if (!filter(frame)) continue;
//             const f = new Frame(frame.id, frame.worker, frame.timestamp, frame.context, frame.label, frame.category);
//             idMap.set(frame.id, f);
//             contextMap.set(frame.context, f);
//         }
//     }
//
//     return result;
// }
