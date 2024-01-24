import { expect, test } from '@jest/globals';

import { cast } from '../../src/serializer-facade';
import { is } from '../../src/typeguard.js';

test('complex union', () => {
    type EventTriggerPayloadBase<TName extends string, TData, TOp extends 'INSERT' | 'UPDATE' | 'DELETE'> = {
        event: {
            session_variables: Record<string, string> | null;
            op: TOp;
            data: {
                old: TOp extends 'INSERT' ? null : TData;
                new: TOp extends 'DELETE' ? null : TData;
            };
        };
        created_at: string;
        id: string;
        trigger: {
            name: TName;
        };
        table: {
            schema: string;
            name: string;
        };
    };

    type EventTriggerMap = {
        ['chat-created']: EventTriggerPayloadBase<'chat-created', any, 'INSERT'>;
        ['chat-message-created']: EventTriggerPayloadBase<'chat-message-created', any, 'INSERT'>;
    };

    type EventTriggerType = keyof EventTriggerMap;
    type EventTriggerPayload<T extends EventTriggerType> = EventTriggerMap[T];
    type AnyEventTriggerPayload = {
        [K in EventTriggerType]: EventTriggerPayload<K>;
    }[EventTriggerType];

    const payload: AnyEventTriggerPayload = {
        event: {
            session_variables: null,
            op: 'INSERT',
            data: {
                old: null,
                new: {},
            },
        },
        created_at: '',
        id: '',
        trigger: {
            name: 'chat-created',
        },
        table: {
            schema: '',
            name: '',
        },
    };

    type A = EventTriggerPayload<'chat-created'>;
    type B = EventTriggerPayload<'chat-message-created'>;

    const validA = is<A>(payload);
    expect(validA).toBe(true);

    const validB = is<B>(payload);
    expect(validB).toBe(false);

    const validUnion = is<AnyEventTriggerPayload>(payload);
    expect(validUnion).toBe(true);

    const c = cast<AnyEventTriggerPayload>(payload);
    expect(c).toEqual(payload);

    const payload2 = {
        created_at: '2023-11-02T23:59:39.669998Z',
        event: {
            data: {
                new: {
                    chat_id: 340,
                    created_at: '2023-11-02T23:59:39.669998+00:00',
                    id: 901,
                    retry: 0,
                    role: 'user',
                    state: 'completed',
                    text: 'hey',
                    updated_at: '2023-11-02T23:59:39.669998+00:00',
                },
                old: null,
            },
            op: 'INSERT',
            session_variables: {
                'x-hasura-organization-id': '1',
                'x-hasura-role': 'user',
                'x-hasura-user-id': '4',
            },
        },
        id: '8530e138-6a41-477d-bb55-afa6b3052c56',
        table: { name: 'chat_message', schema: 'public' },
        trigger: { name: 'chat-message-created' },
    };

    const d = cast<AnyEventTriggerPayload>(payload2);
    expect(d).toEqual(payload2);
});
