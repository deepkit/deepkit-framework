import { getBSONSerializer, getBSONSizer, ParserV2, stringByteLength, Writer } from '@deepkit/bson';
import { FrameCategory, FrameData, FrameEnd, FrameStart, FrameType } from '@deepkit/stopwatch';
import { ClassSchema, t } from '@deepkit/type';

export function encodeFrames(frames: (FrameStart | FrameEnd)[]): Uint8Array {
    //<id uint32><worker uint8><type uint8><timestamp uint64><context uint32><category uint8><labelSize uint8><label utf8string>.
    let size = 0;
    for (const frame of frames) {
        size += frame.type === FrameType.end ? (32 + 8 + 8 + 64) / 8 : (((32 + 8 + 8 + 64 + 32 + 8 + 8) / 8) + Math.min(255, stringByteLength(frame.label)));
    }

    const buffer = Buffer.allocUnsafe(size);
    const writer = new Writer(buffer);

    for (const frame of frames) {
        writer.writeUint32(frame.id);
        writer.writeByte(frame.worker);
        writer.writeByte(frame.type);

        //up to 2⁵³=9,007,199,254,740,992 the representable numbers are exactly the integers
        //so we have no precision loss when using timestamp=Math.floor(performance.timeOrigin * 1_000 + performance.now() * 1_000)
        //timestamp current output vs max precise integers:
        //1613654358960142
        //9007199254740992
        writer.writeDouble(frame.timestamp);

        if (frame.type === FrameType.start) {
            writer.writeUint32(frame.context);
            writer.writeByte(frame.category);
            let size = stringByteLength(frame.label);
            for (let i = 0; size > 255; i++) {
                frame.label = frame.label.substr(0, 255 - i);
                size = stringByteLength(frame.label);
            }
            writer.writeByte(size);
            writer.writeString(frame.label);
        }
    }

    return buffer;
}

export const categorySchemas: { [name in FrameCategory]?: ClassSchema } = {
    [FrameCategory.http]: t.schema({
        url: t.string.optional,
        method: t.string.optional,
        clientIp: t.string.optional,
        responseStatus: t.number.optional,
    })
};

export function encodeFrameData(dataItems: FrameData[]) {
    //<id uint32><worker uint8><bson document>
    let size = 0;
    for (const data of dataItems) {
        const schema = categorySchemas[data.category];
        if (!schema) throw new Error(`Frame category ${FrameCategory[data.category]} has no schema declared.`);
        size += ((32 + 8) / 8) + getBSONSizer(schema)(data.data);
    }

    const buffer = Buffer.allocUnsafe(size);
    const writer = new Writer(buffer);

    for (const data of dataItems) {
        writer.writeUint32(data.id);
        writer.writeByte(data.worker);
        const schema = categorySchemas[data.category]!;
        getBSONSerializer(schema)(data.data, writer);
    }

    return buffer;
}

export function decodeFrameData(buffer: Uint8Array): { id: number, worker: number, bson: Uint8Array }[] {
    const parser = new ParserV2(buffer);
    const data: { id: number, worker: number, bson: Uint8Array }[] = [];

    while (parser.offset < buffer.byteLength) {
        const id = parser.eatUInt32();
        const worker = parser.eatByte();
        const end = parser.peekUInt32() + parser.offset;
        data.push({ id, worker, bson: parser.buffer.slice(parser.offset, end) });
        parser.offset = end;
    }
    return data;
}

export function decodeFrames(buffer: Uint8Array): (FrameStart | FrameEnd)[] {
    const parser = new ParserV2(buffer);
    const frames: (FrameStart | FrameEnd)[] = [];

    while (parser.offset < buffer.byteLength) {
        const id = parser.eatUInt32();
        const worker = parser.eatByte();
        const type = parser.eatByte();
        const timestamp = parser.eatDouble();

        if (type === FrameType.start) {
            const context = parser.eatUInt32();
            const category = parser.eatByte();
            const stringSize = parser.eatByte();
            const label = parser.eatString(stringSize);
            frames.push({ id, worker, type: FrameType.start, timestamp, context, category, label });
        } else {
            frames.push({ id, worker, type: FrameType.end, timestamp });
        }
    }
    return frames;
}
