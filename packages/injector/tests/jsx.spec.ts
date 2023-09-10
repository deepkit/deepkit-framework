import { expect, test } from '@jest/globals';
import { wrapComponent } from '../src/lib/jsx.js';
import { InjectorContext } from '../src/lib/injector.js';
import { InjectorModule } from '../src/lib/module.js';

test('jsx basic', () => {
    class User {
        constructor(public name: string) {
        }
    }

    function MyComponent(props: {}, user: User) {
        expect(user).toBeInstanceOf(User);
    }

    const container = InjectorContext.forProviders([
        { provide: User, useValue: new User('Peter') }
    ]);
    const wrapped = wrapComponent(MyComponent, container);

    wrapped({});
});

test('jsx basic state', () => {
    class User {
        constructor(public name: string) {
        }
    }

    class AppState {
        count: number = 0;
    }

    function MyComponent(props: {}, state: AppState) {
        expect(state).toBeInstanceOf(AppState);
    }

    const module = new InjectorModule([
        { provide: User, useValue: new User('Peter') }
    ]);
    module.setConfigDefinition(AppState);
    const container = new InjectorContext(module);
    const wrapped = wrapComponent(MyComponent, container);

    wrapped({});
});
