import 'jest';
import '../src/template/template';
import {template} from '../src/template/template';
import {Injector} from '../src/injector/injector';

test('benchmark template', () => {
    const template1 = () => <div>Test</div>;

    function Website({title}: { title: string }, contents: string[]) {
        return <html>
        <head><title>Yes sir</title></head>
        <body><h1>{title}</h1>{contents}</body>
        </html>;
    }

    const template2 = () => <Website title="Test">
        <div>Content</div>
    </Website>;

    const injector = new Injector();

});