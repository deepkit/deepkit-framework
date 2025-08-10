# 拡張

## カスタムシリアライズ

独自の `Serializer` を作成するか、既定の `serializer` を拡張することで、型のシリアライズを拡張できます。

この例では、Class `Point` をタプル `[number, number]` にシリアライズ/デシリアライズする方法を示します。

```typescript
import { serializer, SerializationError } from '@deepkit/type';

class Point {
  constructor(public x: number, public y: number) {
  }
}

// deserialize は JSON から（Class）インスタンスへの変換を意味します。
serializer.deserializeRegistry.registerClass(Point, (type, state) => {
  state.convert((v: any) => {
    // すでに Point インスタンスであれば、処理は完了です
    if (v instanceof Point) return v;

    // この時点で `v` は（undefined 以外の）任意の値であり得るため、検証が必要です
    if (!Array.isArray(v)) throw new SerializationError('Expected array');
    if (v.length !== 2) throw new SerializationError('Expected array with two elements');
    if (typeof v[0] !== 'number' || typeof v[1] !== 'number') throw new SerializationError('Expected array with two numbers');
    return new Point(v[0], v[1]);
  });
});

serializer.serializeRegistry.registerClass(Point, (type, state) => {
  state.convert((v: Point) => {
    // この時点では `v` は常に Point インスタンスです
    return [v.x, v.y];
  });
});

// cast と deserialize は既定で `serializer` を使用します
const point = cast<Point>([1, 2], undefined, serializer);
expect(point).toBeInstanceOf(Point);
expect(point.x).toBe(1);
expect(point.y).toBe(2);

{
  expect(() => deserialize<Point>(['vbb'])).toThrowError(SerializationError);
  expect(() => deserialize<Point>(['vbb'])).toThrow('Expected array with two elements')
}

// serialize は既定で `serializer` を使用します
const json = serialize<Point>(point);
expect(json).toEqual([1, 2]);
```

これは `cast`、`deserialize`、`serialize` など、通常の `@deepkit/type` の Function に対してのみ機能する点に注意してください。

これはデータベース層には適用されません。データベース層は、マイグレーションやシリアライズ（例: BSON のシリアライズ）のために、Entity Class で定義された Type を使用するためです。