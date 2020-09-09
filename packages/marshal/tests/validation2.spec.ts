import 'jest-extended';
import 'reflect-metadata';
import {getClassSchema, t} from '../src/decorators';

test('test minimized code', async () => {
    expect(() => {
        class ClusterNodeCredentials {
            @t
            sshPort: number = 22;

            constructor(
                @t.primary.uuid.name('nodeId')
                @t.primary
                public e: string
            ) {
            }
        }
    }).toThrow('Defining multiple Marshal decorators with different names')

    expect(() => {
        class ClusterNodeCredentials {
            @t
            sshPort: number = 22;

            constructor(
                @t.primary.uuid.name('nodeId')
                @t.primary.uuid.name('asd')
                public e: string
            ) {
            }
        }
    }).toThrow('Defining multiple Marshal decorators with different names')

    class ClusterNodeCredentials {
        @t
        sshPort: number = 22;

        constructor(
            @t.primary.uuid.name('nodeId')
            @t.primary.uuid.name('nodeId')
            public e: string
        ) {
        }
    }
    expect(getClassSchema(ClusterNodeCredentials).getClassProperties().get('e')).toBeUndefined();
});
