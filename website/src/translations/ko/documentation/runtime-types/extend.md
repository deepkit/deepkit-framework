# 확장

## 사용자 정의 Serialization

타입의 serialization을 확장하려면 직접 `Serializer`를 작성하거나 기본 `serializer`를 확장할 수 있습니다.

이 예제는 `Point` class를 튜플 `[number, number]`로 serialize/deserialize하는 방법을 보여줍니다.

```typescript
import { serializer, SerializationError } from '@deepkit/type';

class Point {
  constructor(public x: number, public y: number) {
  }
}

// deserialize는 JSON에서 (class) instance로의 변환을 의미합니다.
serializer.deserializeRegistry.registerClass(Point, (type, state) => {
  state.convert((v: any) => {
    // 이미 Point 인스턴스라면 완료입니다
    if (v instanceof Point) return v;

    // 이 시점에서 `v`는 (undefined를 제외하고) 어떤 값도 될 수 있으므로 검사가 필요합니다
    if (!Array.isArray(v)) throw new SerializationError('Expected array');
    if (v.length !== 2) throw new SerializationError('Expected array with two elements');
    if (typeof v[0] !== 'number' || typeof v[1] !== 'number') throw new SerializationError('Expected array with two numbers');
    return new Point(v[0], v[1]);
  });
});

serializer.serializeRegistry.registerClass(Point, (type, state) => {
  state.convert((v: Point) => {
    // 이 시점에서 `v`는 항상 Point 인스턴스입니다
    return [v.x, v.y];
  });
});

// cast와 deserialize는 기본적으로 `serializer`를 사용합니다
const point = cast<Point>([1, 2], undefined, serializer);
expect(point).toBeInstanceOf(Point);
expect(point.x).toBe(1);
expect(point.y).toBe(2);

{
  expect(() => deserialize<Point>(['vbb'])).toThrowError(SerializationError);
  expect(() => deserialize<Point>(['vbb'])).toThrow('Expected array with two elements')
}

// serialize는 기본적으로 `serializer`를 사용합니다
const json = serialize<Point>(point);
expect(json).toEqual([1, 2]);
```

이는 `cast`, `deserialize`, `serialize`와 같은 일반 `@deepkit/type` Function에만 동작합니다.

이는 database layer로 전달되지 않습니다. database layer는 migration과 serialization을 위해 Entity class에 정의된 type을 사용하기 때문입니다(예: BSON serialization).