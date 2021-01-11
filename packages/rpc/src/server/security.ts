import { ClassType } from "@deepkit/core";

export class Session {
    constructor(
        public readonly username: string,
        public readonly token: any,
    ) {
    }

    public isAnonymous(): boolean {
        return undefined === this.token;
    }
}

export class RpcKernelSecurity<T extends Session> {
    async hasControllerAccess(session: T, classType: ClassType, method: string): Promise<boolean> {
        return true;
    }

    async isAllowedToRegisterAsPeer(session: T, peerId: string): Promise<boolean> {
        return true;
    }

    async isAllowedToSendToPeer(session: T, peerId: string): Promise<boolean> {
        return true;
    }

    async authenticate(token: any): Promise<T> {
        throw new Error('Authentication not implemented');
    }
}


export class SessionState<T extends Session> {
    protected session: T = new Session('anon', undefined) as T;

    public setSession(session: T) {
        this.session = session;
    }

    public getSession(): T {
        return this.session;
    }
}