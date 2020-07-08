import {injectable} from "@super-hornet/framework-server-common";

export class Session {
    constructor(
        public readonly username: string,
        public readonly token: any,
    ) {
    }

    public isAnonymouse(): boolean {
        return undefined === this.token;
    }
}

@injectable()
export class SessionStack {
    protected session?: Session;

    public setSession(session: Session | undefined) {
        this.session = session;
    }

    public isSet(): boolean {
        return this.session !== undefined;
    }

    public getSessionOrUndefined(): Session | undefined {
        return this.session;
    }

    public getSession(): Session {
        if (!this.session) {
            throw new Error('No session given.');
        }

        return this.session;
    }
}
