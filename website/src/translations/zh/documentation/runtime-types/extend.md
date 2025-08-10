# 扩展

## 自定义序列化

你可以通过编写你自己的 `Serializer` 或扩展默认的 `serializer` 来扩展某个类型的序列化。

下面的示例展示了如何将类 `Point` 序列化/反序列化为元组 `[number, number]`。

```typescript
import { serializer, SerializationError } from '@deepkit/type';

class Point {
  constructor(public x: number, public y: number) {
  }
}

// 反序列化表示从 JSON 到（类）实例。
serializer.deserializeRegistry.registerClass(Point, (type, state) => {
  state.convert((v: any) => {
    // 如果它已经是 Point 实例，那就完成了
    if (v instanceof Point) return v;

    // 此时 `v` 可能是任意值（除了 undefined），因此需要进行检查
    if (!Array.isArray(v)) throw new SerializationError('Expected array');
    if (v.length !== 2) throw new SerializationError('Expected array with two elements');
    if (typeof v[0] !== 'number' || typeof v[1] !== 'number') throw new SerializationError('Expected array with two numbers');
    return new Point(v[0], v[1]);
  });
});

serializer.serializeRegistry.registerClass(Point, (type, state) => {
  state.convert((v: Point) => {
    // 此时 `v` 一定是 Point 实例
    return [v.x, v.y];
  });
});

// cast 和 deserialize 默认使用 `serializer`
const point = cast<Point>([1, 2], undefined, serializer);
expect(point).toBeInstanceOf(Point);
expect(point.x).toBe(1);
expect(point.y).toBe(2);

{
  expect(() => deserialize<Point>(['vbb'])).toThrowError(SerializationError);
  expect(() => deserialize<Point>(['vbb'])).toThrow('Expected array with two elements')
}

// serialize 默认使用 `serializer`
const json = serialize<Point>(point);
expect(json).toEqual([1, 2]);
```

请注意，这仅适用于常规的 `@deepkit/type` 函数，例如 `cast`、`deserialize` 和 `serialize`。

这不会被传递到数据库层，因为数据库层在迁移和序列化时使用实体类中定义的类型（例如 BSON 序列化）。