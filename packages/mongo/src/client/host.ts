import {MongoConnection} from './connection';

export const enum HostType {
    unknown,
    standalone,
    primary,
    secondary,
    mongos,
    arbiter,
    other,
    ghost,
}

export class Host {
    protected type: HostType = HostType.unknown;

    protected typeSetAt?: Date;

    /**
     * Round Trip Times of the `ismaster` command, for `nearest`
     */
    protected rrt?: number;

    public readonly connections: MongoConnection[] = [];

    constructor(
        public readonly hostname: string,
        public readonly port: number = 27017,
    ) {
    }

    get id() {
        return `${this.hostname}:${this.port}`;
    }

    isWritable(): boolean {
        return this.type === HostType.primary || this.type === HostType.standalone || this.type === HostType.mongos;
    }

    isSecondary(): boolean {
        return this.type === HostType.secondary;
    }

    isReadable(): boolean {
        return this.type === HostType.primary || this.type === HostType.standalone
            || this.type === HostType.mongos || this.type === HostType.secondary;
    }

    setType(type: HostType) {
        if (this.type !== type) {
            //type changed. Should we do anything special?
        }
        this.type = type;
        this.typeSetAt = new Date;
    }

    getType() {
        return this.type;
    }

    getTypeFromIsMasterResult(isMasterCmdResult: any): HostType {
        if (!isMasterCmdResult || !isMasterCmdResult.ok) return HostType.unknown;
        if (isMasterCmdResult.isreplicaset) return HostType.ghost;
        if (isMasterCmdResult.ismaster && isMasterCmdResult.msg === 'isdbgrid') return HostType.mongos;
        if (isMasterCmdResult.setName) {
            if (isMasterCmdResult.hidden) return HostType.other;
            if (isMasterCmdResult.ismaster) return HostType.primary;
            if (isMasterCmdResult.secondary) return HostType.secondary;
            if (isMasterCmdResult.arbiterOnly) return HostType.arbiter;
            return HostType.other;
        }

        return HostType.standalone;
    }
}