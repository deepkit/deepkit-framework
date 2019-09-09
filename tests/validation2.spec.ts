import 'reflect-metadata';
import 'jest-extended'
import {Field, getEntitySchema, IDField, UUIDField} from "../src/decorators";

test('test minimized code', async () => {
    expect(() => {
        class ClusterNodeCredentials {
            @Field()
            sshPort: number = 22;

            constructor(
                @UUIDField().asName('nodeId')
                @IDField()
                public e: string
            ) {
            }
        }
    }).toThrow('Defining multiple Marshal decorators with different names')

    expect(() => {
        class ClusterNodeCredentials {
            @Field()
            sshPort: number = 22;

            constructor(
                @IDField()
                @UUIDField().asName('nodeId')
                public e: string
            ) {
            }
        }
    }).toThrow('Mixing named and not-named constructor parameter is not possible')

    expect(() => {
        class ClusterNodeCredentials {
            @Field()
            sshPort: number = 22;

            constructor(
                @UUIDField().asName('nodeId')
                @IDField().asName('asd')
                public e: string
            ) {
            }
        }
    }).toThrow('Defining multiple Marshal decorators with different names')

    class ClusterNodeCredentials {
        @Field()
        sshPort: number = 22;

        constructor(
            @UUIDField().asName('nodeId')
            @IDField().asName('nodeId')
            public e: string
        ) {
        }
    }
    expect(getEntitySchema(ClusterNodeCredentials).properties['e']).toBeUndefined();
});
