import { expect, test } from '@jest/globals';
import { extractMethodBody, extractParameters, removeStrings } from '../src/reflection';


test('removeStrings', () => {
    expect(removeStrings(`'test'`)).toBe(``);
    expect(removeStrings(`'te\\'st'`)).toBe(``);
    expect(removeStrings(`"te\\'st"`)).toBe(``);
    expect(removeStrings(`"te\\"st"`)).toBe(``);
    expect(removeStrings(`function(peter = 'asd') {}`)).toBe(`function(peter = ) {}`);
    expect(removeStrings(`function(peter = '') {}`)).toBe(`function(peter = ) {}`);
    expect(removeStrings(`function(peter = '') {}`)).toBe(`function(peter = ) {}`);
    expect(removeStrings(`function(peter = '"') {}`)).toBe(`function(peter = ) {}`);
    expect(removeStrings(`function(peter = '\\"') {}`)).toBe(`function(peter = ) {}`);
    expect(removeStrings(`function(peter = 'Ca\\'nt do that') {}`)).toBe(`function(peter = ) {}`);
});

test('simple', () => {
    function uuid() {
        return 'asd';
    }

    class User {
        id: string = uuid();

        username?: string;

        bla = 'constructor()';

        static test = uuid();

        constructor(nothing: string = '{') {
        }

        doSomething(): void {
            this.username = 'asd';
        }
    }

    const code = extractMethodBody(User.toString(), 'constructor');
    expect(code.trim()).toBe('this.id=uuid();this.bla=;');
});


test('class signature', function () {
    class Clazz {
        constructor(protected foo: string, protected bar: string) {}
    }

    expect(extractParameters(Clazz)).toEqual(['foo', 'bar']);
});

test('class es5', function () {
    var Clazz = /** @class */ (function () {
        function Clazz(this: any, foo: any, bar: any) {
            this.foo = foo;
            this.bar = bar;
        }
        return Clazz;
    }());

    expect(extractParameters(Clazz)).toEqual(['foo', 'bar']);
});

test('function signature', function () {
    function myFunc(foo: string, bar: string) {}

    expect(extractParameters(myFunc)).toEqual(['foo', 'bar']);
});

test('class mixing', function () {

    function mixin(...a: any) {
        return class {}
    }

    class Clazz2 {}

    class Clazz extends mixin(Clazz2) {
        constructor(protected foo: string, protected bar: string) {
            super();
        }
    }

    expect(extractParameters(Clazz)).toEqual(['foo', 'bar']);
});

test('test1', function () {
    function /* (no parenthesis like this) */ test1(a: any, b: any, c: any) {
        return true
    }

    expect(extractParameters(test1)).toEqual(['a', 'b', 'c']);
});

test('test2', function () {
    function test2(a: any, b: any, c: any) /*(why do people do this??)*/ {
        return true
    }

    expect(extractParameters(test2)).toEqual(['a', 'b', 'c']);
});

test('test3', function () {
    function test3(a: any, /* (jewiofewjf,wo, ewoi, werp)*/ b: any, c: any) {
        return true
    }

    expect(extractParameters(test3)).toEqual(['a', 'b', 'c']);
});

test('test4', function () {
    function test4(a: any/* a*/, /* b */b: any, /*c*/c: any, d: any/*d*/) {
        return function (one: any, two: any, three: any) {
        }
    }

    expect(extractParameters(test4)).toEqual(['a', 'b', 'c', 'd']);
});

test('test5', function () {
    function test5(
        a: any,
        b: any,
        c: any
    ) {
        return false;
    }

    expect(extractParameters(test5)).toEqual(['a', 'b', 'c']);
});

test('test6', function () {
    function test6(a: any) { return function f6(a: any, b: any) { } }

    expect(extractParameters(test6)).toEqual(['a']);
});

test('test7', function () {
    function test7(
        /*
         function test5(
           a,
           b,
           c
         ) {
           return false;
         }
         function test5(
           a,
           b,
           c
         ) {
           return false;
         }
         function test5(
           a,
           b,
           c
         ) {
           return false;
         }
         */
        a: any, b: any, c: any) { return true }

    expect(extractParameters(test7)).toEqual(['a', 'b', 'c']);
});

test('test8', function () {
    function test8
        (a: any, b: any, c: any) { }

    expect(extractParameters(test8)).toEqual(['a', 'b', 'c']);
});

test('test9', function () {
    var a: any, b: any, c: any;

    function π9(ƒ: any, µ: any) { (a + 2 + b + 2 + c) }

    expect(extractParameters(π9)).toEqual(['ƒ', 'µ']);
});

test('supports ES2015 fat arrow functions with parens', function () {
    var f = '(a,b) => a + b'

    expect(extractParameters(f)).toEqual(['a', 'b']);
})

test('supports ES2015 fat arrow functions without parens', function () {
    var f = 'a => a + 2'
    expect(extractParameters(f)).toEqual(['a']);
})

test('ignores ES2015 default params', function () {
    // default params supported in node.js ES6
    var f11 = '(a, b = 20) => a + b'

    expect(extractParameters(f11)).toEqual(['a', 'b']);
})

test('supports function created using the Function constructor', function () {
    var f = new Function('a', 'b', 'return a + b');

    expect(extractParameters(f)).toEqual(['a', 'b']);
})
