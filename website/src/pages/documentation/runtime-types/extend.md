# Extend

## Custom Serialization

You can extend the serialization of a type by defining either write your own `Serializer` or extend the default `serializer`.

This example shows how to serialize and deserialize a class `Point` to a tuple `[number, number]`.

```typescript
import { serializer, SerializationError } from '@deepkit/type';

class Point {
  constructor(public x: number, public y: number) {
  }
}

// deserialize means from JSON to (class) instance.
serializer.deserializeRegistry.registerClass(Point, (type, state) => {
  state.convert((v: any) => {
    // if it's already a Point instance, we are done
    if (v instanceof Point) return v;

    // at this point `v` could be anything (except undefined), so we need to check
    if (!Array.isArray(v)) throw new SerializationError('Expected array');
    if (v.length !== 2) throw new SerializationError('Expected array with two elements');
    if (typeof v[0] !== 'number' || typeof v[1] !== 'number') throw new SerializationError('Expected array with two numbers');
    return new Point(v[0], v[1]);
  });
});

serializer.serializeRegistry.registerClass(Point, (type, state) => {
  state.convert((v: Point) => {
    // at this point `v` is always a Point instance
    return [v.x, v.y];
  });
});

// cast and deserialize use `serializer` by default
const point = cast<Point>([1, 2], undefined, serializer);
expect(point).toBeInstanceOf(Point);
expect(point.x).toBe(1);
expect(point.y).toBe(2);

{
  expect(() => deserialize<Point>(['vbb'])).toThrowError(SerializationError);
  expect(() => deserialize<Point>(['vbb'])).toThrow('Expected array with two elements')
}

// serialize uses `serializer` by default
const json = serialize<Point>(point);
expect(json).toEqual([1, 2]);
```

Please note that this is only working for the regular `@deepkit/type` functions like `cast`, `deserialize`, and `serialize`.

This won't be transferred to the database layer, since the database layer uses the types as defined in the Entity class for migration and serialization (e.g. BSON serialization).
