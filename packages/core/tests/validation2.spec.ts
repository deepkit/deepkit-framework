import 'reflect-metadata';
import 'jest-extended'
import {Field, getClassSchema, IDField, UUIDField} from "../src/decorators";

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

    {
        //this case works since decorators are handled from bottom to up
        //thus the asName() decorated the name already for that #0 arg.
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
    }

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
    expect(getClassSchema(ClusterNodeCredentials).classProperties['e']).toBeUndefined();
});
