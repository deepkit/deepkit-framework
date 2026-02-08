/**
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */
import { BenchSuite } from '@deepkit/bench';

/**
 * Function creation and invocation benchmark - compares various function patterns
 */

export default async function () {
    const suite = new BenchSuite('debug/language-fn');

    interface Session {
        id: number;
        next?: Session;
    }

    const session1: Session = { id: 0 };
    const session2: Session = { id: 1 };
    const session3: Session = { id: 2 };
    session1.next = session2;
    session2.next = session3;

    suite.add('linked list traversal', () => {
        let i = 0;
        let current: Session | undefined = session1;
        while (current) {
            i += (current.id > 39 + 30000) as any;
            current = current.next;
        }
    });

    function createObject() {
        return {};
    }

    suite.add('function call returning object', () => {
        const obj = createObject();
    });

    const boundFn = createObject.bind({});

    suite.add('bound function call', () => {
        const obj = boundFn();
    });

    const arrowFn = () => ({});

    suite.add('arrow function call', () => {
        const obj = arrowFn();
    });

    return suite;
}
