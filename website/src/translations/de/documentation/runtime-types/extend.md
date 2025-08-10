# Erweitern

## Benutzerdefinierte Serialisierung

Sie können die Serialisierung für einen Type erweitern, indem Sie entweder Ihren eigenen `Serializer` schreiben oder den Standard-`serializer` erweitern.

Dieses Beispiel zeigt, wie man eine Class `Point` in ein Tuple `[number, number]` serialisiert und deserialisiert.

```typescript
import { serializer, SerializationError } from '@deepkit/type';

class Point {
  constructor(public x: number, public y: number) {
  }
}

// Deserialisieren bedeutet von JSON zu einer (Class-)Instanz.
serializer.deserializeRegistry.registerClass(Point, (type, state) => {
  state.convert((v: any) => {
    // wenn es bereits eine Point-Instanz ist, sind wir fertig
    if (v instanceof Point) return v;

    // an diesem Punkt könnte `v` alles Mögliche sein (außer undefined), daher müssen wir prüfen
    if (!Array.isArray(v)) throw new SerializationError('Expected array');
    if (v.length !== 2) throw new SerializationError('Expected array with two elements');
    if (typeof v[0] !== 'number' || typeof v[1] !== 'number') throw new SerializationError('Expected array with two numbers');
    return new Point(v[0], v[1]);
  });
});

serializer.serializeRegistry.registerClass(Point, (type, state) => {
  state.convert((v: Point) => {
    // an diesem Punkt ist `v` immer eine Point-Instanz
    return [v.x, v.y];
  });
});

// cast und deserialize verwenden standardmäßig den `serializer`
const point = cast<Point>([1, 2], undefined, serializer);
expect(point).toBeInstanceOf(Point);
expect(point.x).toBe(1);
expect(point.y).toBe(2);

{
  expect(() => deserialize<Point>(['vbb'])).toThrowError(SerializationError);
  expect(() => deserialize<Point>(['vbb'])).toThrow('Expected array with two elements')
}

// serialize verwendet standardmäßig den `serializer`
const json = serialize<Point>(point);
expect(json).toEqual([1, 2]);
```

Bitte beachten Sie, dass dies nur für die regulären `@deepkit/type` Functions wie `cast`, `deserialize` und `serialize` funktioniert.

Dies wird nicht in die Datenbankschicht übernommen, da die Datenbankschicht die Types verwendet, wie sie in der Entity Class für Migration und Serialisierung definiert sind (z. B. BSON-Serialisierung).