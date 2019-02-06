import {Injectable} from "injection-js";
import {ClassType} from "@marcj/marshal";

export class Session {
    constructor(
        public readonly username: string,
        public readonly token: any,
    ) {
    }
}

@Injectable()
export class Application {
    public readonly controllers: { [path: string]: ClassType<any> } = {};

    public async bootstrap() {
    }

    /**
     *
     */
    public async hasAccess<T>(session: Session | undefined, controller: ClassType<T>, action: string): Promise<boolean> {
        return true;
    }

    public async getControllerForPath(path: string): Promise<ClassType<any> | undefined> {
        return this.controllers[path];
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
        return false;
    }
}
