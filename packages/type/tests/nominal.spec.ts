import { expect, test } from '@jest/globals';
import { getNominalId, typeOf } from '../src/reflection/reflection.js';
import { assertType, ReflectionKind } from '../src/reflection/type.js';

test('nominal alias', () => {
    class Channel {
        constructor(public name: string) {
        }
    }

    //A1.type.id == Channel.id
    type A1 = [Channel];

    //A2.id != Channel.id. A2 is nominal type
    type A2 = Channel;

    const a1 = typeOf<A1>();
    assertType(a1, ReflectionKind.tuple);

    const TChannel = typeOf<Channel>();
    assertType(TChannel, ReflectionKind.class);

    const a2 = typeOf<A2>();
    assertType(a2, ReflectionKind.class);

    expect(a2.id).toBeGreaterThan(0);
    expect(TChannel.id).toBeGreaterThan(0);
    expect(TChannel.id).not.toBe(a2.id);

    const tuple1 = a1.types[0].type;
    assertType(tuple1, ReflectionKind.class);
    expect(tuple1.id).toBe(TChannel.id);

    expect(getNominalId<Channel>()).toBe(getNominalId<Channel>());
});

test('nominal alias generic', () => {
    class User<T> {
        constructor(public type: T) {
        }
    }

    type A = User<string>;
    type B = User<number>;

    const a = typeOf<A>();
    const b = typeOf<B>();

    expect(getNominalId<A>()).toBe(getNominalId<A>());
    expect(getNominalId<A>()).not.toBe(getNominalId<B>());

    expect(a === b).toBe(false);
    expect(a === typeOf<A>()).toBe(true);
});
