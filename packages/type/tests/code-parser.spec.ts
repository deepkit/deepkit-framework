import 'jest';
import {t} from '../src/decorators';
import {uuid} from '../src/utils';
import {extractMethod, removeStrings} from '../src/code-parser';


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
    class User {
        @t id: string = uuid();

        @t username?: string;

        bla = 'constructor()';

        static test = uuid();

        constructor(nothing: string = '{') {
        }

        doSomething(): void {
            this.username = 'asd';
        }
    }

    const code = extractMethod(User.toString(), 'constructor');
    expect(code.trim()).toBe('this.id=uuid();this.bla=;');
    console.log(code);
});
