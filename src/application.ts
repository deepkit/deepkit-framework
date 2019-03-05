import {Injectable} from "injection-js";
import {ClassType} from "@marcj/marshal";

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

@Injectable()
export class SessionStack {
    protected session?: Session;

    public setSession(session: Session | undefined) {
        this.session = session;
    }

    public isSet(): boolean {
        return this.session !== undefined;
    }

    public getSession(): Session | undefined {
        return this.session;
    }
}

@Injectable()
export class Application {
    public readonly controllers: { [name: string]: ClassType<any> } = {};
    public readonly entityChangeFeeds: ClassType<any>[] = [];

    /**
     * Method executed in the master process, right before workers are forked.
     */
    public async bootstrap() {
    }

    /**
     * Method to check whether given session (created by authenticate) has access to controller::action.
     */
    public async hasAccess<T>(session: Session | undefined, controller: ClassType<T>, action: string): Promise<boolean> {
        return true;
    }

    /**
     * Resolves a name to a controller.
     */
    public async getController(name: string): Promise<ClassType<any> | undefined> {
        return this.controllers[name];
    }

    /**
     * Authenticates the current connection.
     */
    public async authenticate(token: any): Promise<Session> {
        return new Session('anon', undefined);
    }

    /**
     * Whether changes to that entity should be broadcasted to all subscribers.
     */
    notifyChanges<T>(classType: ClassType<T>): boolean {
        return -1 !== this.entityChangeFeeds.indexOf(classType);
    }
}
