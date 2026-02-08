import { CreateUserData } from './shared';

function fn<T>(t?: ReceiveType<T>) {
    return resolveReceiveType(t);
}

fn<CreateUserData>();
