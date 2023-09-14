import {typeOf} from "@deepkit/type";
import {LoggerInterface} from "@deepkit/logger";

class TestMe {
    constructor(readonly logger: LoggerInterface) {
    }
}

// @ts-ignore
console.log(__ΩLoggerInterface);

typeOf<TestMe>();
