import 'jest';
import {
    Action,
    Controller,
    getActionParameters,
    getActionReturnType,
    getActions,
    getControllerOptions,
    ParamType,
    PartialEntityReturnType, PartialParamType,
    ReturnType
} from "../src/decorators";
import {Entity} from "@marcj/marshal";
import {Observable} from "rxjs";

test('decorators class', () => {
    @Controller('peter')
    class MyController {

    }

    const options = getControllerOptions(MyController);
    expect(options!.name).toBe('peter');
});

test('decorators actions', () => {
    class MyController {
        @Action()
        methodA() {

        }

        @Action()
        methodB() {

        }
    }

    const actions = getActions(MyController);
    expect(actions['methodA']).not.toBeUndefined();
    expect(actions['methodB']).not.toBeUndefined();
    expect(actions['methodC']).toBeUndefined();
});


test('decorators actions parameters', () => {
    @Entity('page')
    class Page {
    }

    @Entity('user')
    class User {
    }

    class MyController {
        @Action()
        nada() {
        }

        @Action()
        methodA(page: Page): Page {
            return page;
        }

        @Action()
        methodB(user: User, n: number): number {
            return n;
        }

        @Action()
        createUser(@PartialParamType(User) user: Partial<User>): string {
            return '123';
        }

        @Action()
        @PartialEntityReturnType(User)
        createUserByName(name: string): Partial<User> {
            return new User;
        }
    }

    {
        expect(getActionReturnType(MyController, 'nada')).toEqual({array: false, partial: false, type: 'undefined'});
        const parameters = getActionParameters(MyController, 'nada');
        expect(parameters.length).toBe(0);
    }

    {
        expect(getActionReturnType(MyController, 'methodA')).toEqual({array: false, partial: false, entityName: 'page', type: 'Entity'});
        const parameters = getActionParameters(MyController, 'methodA');
        expect(parameters.length).toBe(1);
        expect(parameters[0]).toEqual({array: false, partial: false, type: 'Entity', entityName: 'page'});
    }

    {
        expect(getActionReturnType(MyController, 'methodB')).toEqual({array: false, partial: false, type: 'Number'});
        const parameters = getActionParameters(MyController, 'methodB');
        expect(parameters.length).toBe(2);
        expect(parameters[0]).toEqual({array: false, partial: false, type: 'Entity', entityName: 'user'});
        expect(parameters[1]).toEqual({array: false, partial: false, type: 'Number'});
    }

    {
        expect(getActionReturnType(MyController, 'createUser')).toEqual({array: false, partial: false, type: 'String'});
        const parameters = getActionParameters(MyController, 'createUser');
        expect(parameters.length).toBe(1);
        expect(parameters[0]).toEqual({array: false, partial: true, entityName: 'user', type: 'Entity'});
    }

    {
        expect(getActionReturnType(MyController, 'createUserByName')).toEqual({array: false, partial: true, entityName: 'user', type: 'Entity'});

        const parameters = getActionParameters(MyController, 'createUserByName');
        expect(parameters).toEqual([{array: false, partial: false, type: 'String'}]);
    }
});

test('decorators actions invalid returnType entity', () => {
    class User {
    }

    class MyController {
        @Action()
        createUser(): User {
            return new User;
        }
    }

    {
        expect(() => {
            getActionReturnType(MyController, 'createUser');
        }).toThrowError('Error in parsing returnType of MyController::createUser: Error: No @Entity() defined for class');
    }
});


test('decorators actions invalid parameterType array', () => {
    class MyController {
        @Action()
        createUser(names: string[]) {
        }
    }

    {
        expect(() => {
            getActionParameters(MyController, 'createUser');
        }).toThrowError('MyController::createUser argument 0 is an Array. You need to specify it\'s content using e.g. @ParamType(String)');
    }

    class MyController2 {
        @Action()
        createUser(@ParamType(String) names: string[]) {
        }
    }

    expect(getActionParameters(MyController2, 'createUser')[0].type).toBe('String');
});

test('decorators actions valid uncomplete returnType', () => {
    class MyController {
        @Action()
        stringArray(): string[] {
            return [];
        }

        @Action()
        numberArray(): number[] {
            return [];
        }

        @Action()
        async promise(): Promise<number[]> {
            return [];
        }

        @Action()
        observable(): Observable<number[]> {
            return new Observable<number[]>(() => {

            });
        }
    }
    expect(getActionReturnType(MyController, 'stringArray').type).toBe('undefined');
    expect(getActionReturnType(MyController, 'numberArray').type).toBe('undefined');
    expect(getActionReturnType(MyController, 'promise').type).toBe('undefined');
    expect(getActionReturnType(MyController, 'observable').type).toBe('undefined');
});


test('decorators actions valid defined returnType', () => {
    class MyController {
        @Action()
        @ReturnType(String)
        stringArray(): string[] {
            return [];
        }

        @Action()
        @ReturnType(Number)
        numberArray(): number[] {
            return [];
        }

        @Action()
        obj(): object {
            return {};
        }

        @Action()
        @ReturnType(Number)
        async promise(): Promise<number[]> {
            return [];
        }

        @Action()
        @ReturnType(Number)
        observable(): Observable<number[]> {
            return new Observable<number[]>(() => {

            });
        }
    }

    expect(getActionReturnType(MyController, 'stringArray').array).toBe(true);
    expect(getActionReturnType(MyController, 'stringArray').type).toBe('String');

    expect(getActionReturnType(MyController, 'obj').type).toBe('Object');

    expect(getActionReturnType(MyController, 'numberArray').array).toBe(true);
    expect(getActionReturnType(MyController, 'numberArray').type).toBe('Number');

    expect(getActionReturnType(MyController, 'promise').type).toBe('Number');
    expect(getActionReturnType(MyController, 'observable').type).toBe('Number');
});

