import 'reflect-metadata';
import 'jest-extended'
import {getClassSchema, f} from "../src/decorators";

test('test minimized code', async () => {
    expect(() => {
        class ClusterNodeCredentials {
            @f
            sshPort: number = 22;

            constructor(
                @f.id().uuid().asName('nodeId')
                @f.id()
                public e: string
            ) {
            }
        }
    }).toThrow('Defining multiple Marshal decorators with different names')

    expect(() => {
        class ClusterNodeCredentials {
            @f
            sshPort: number = 22;

            constructor(
                @f.id().uuid().asName('nodeId')
                @f.id().uuid().asName('asd')
                public e: string
            ) {
            }
        }
    }).toThrow('Defining multiple Marshal decorators with different names')

    class ClusterNodeCredentials {
        @f
        sshPort: number = 22;

        constructor(
            @f.id().uuid().asName('nodeId')
            @f.id().uuid().asName('nodeId')
            public e: string
        ) {
        }
    }
    expect(getClassSchema(ClusterNodeCredentials).classProperties['e']).toBeUndefined();
});
