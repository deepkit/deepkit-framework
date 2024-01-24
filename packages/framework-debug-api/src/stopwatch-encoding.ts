import {
    Parser,
    Writer,
    deserializeBSONWithoutOptimiser,
    getBSONDeserializer,
    getBSONSerializer,
    getBSONSizer,
    stringByteLength,
} from '@deepkit/bson';
import { AnalyticData, FrameData, FrameEnd, FrameStart, FrameType, getTypeOfCategory } from '@deepkit/stopwatch';

export function encodeFrames(frames: (FrameStart | FrameEnd)[]): Uint8Array {
    //cid = id and worker, as compound key
    //<cid uint32><type uint8><timestamp uint64><context uint32><category uint8><labelSize uint8><label utf8string>.
    let size = 0;
    for (const frame of frames) {
        size +=
            frame.type === FrameType.end
                ? (32 + 8 + 64) / 8
                : (32 + 8 + 64 + 32 + 8 + 8) / 8 + Math.min(255, stringByteLength(frame.label));
    }

    const buffer = Buffer.allocUnsafe(size);
    const writer = new Writer(buffer);

    for (const frame of frames) {
        writer.writeUint32(frame.cid);
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

export function encodeFrameData(dataItems: FrameData[]) {
    //<cid uint32><bson document>
    let size = 0;
    for (const data of dataItems) {
        let dataSize = 4; //always has uint32
        const type = getTypeOfCategory(data.category);
        if (type) dataSize = getBSONSizer(undefined, type)(data.data);
        size += (32 + 8) / 8 + dataSize;
    }

    const buffer = Buffer.allocUnsafe(size);
    const writer = new Writer(buffer);

    for (const data of dataItems) {
        writer.writeUint32(data.cid);
        writer.writeByte(data.category);
        const type = getTypeOfCategory(data.category);
        if (type) {
            getBSONSerializer(undefined, type)(data.data, { writer });
        } else {
            writer.writeUint32(0);
        }
    }

    return buffer;
}

export function encodeAnalytic(data: AnalyticData[]) {
    //<timestamp uint64><cpu uint8><memory uint8><loopBlocked uint8>
    const buffer = Buffer.allocUnsafe(data.length * (4 + 1 + 1 + 4));
    const writer = new Writer(buffer);

    for (const item of data) {
        writer.writeUint32(item.timestamp);
        writer.writeByte(item.cpu);
        writer.writeByte(item.memory);
        writer.writeUint32(item.loopBlocked);
    }

    return buffer;
}

export function decodeAnalytic(buffer: Uint8Array, callback: (data: AnalyticData) => void) {
    const parser = new Parser(buffer);

    while (parser.offset < buffer.byteLength) {
        const timestamp = parser.eatUInt32();
        const cpu = parser.eatByte();
        const memory = parser.eatByte();
        const loopBlocked = parser.eatUInt32();
        callback({ timestamp, cpu, memory, loopBlocked });
    }
}

export function decodeFrameData(
    buffer: Uint8Array,
    callback: (data: { cid: number; category: number; data: Uint8Array }) => void,
) {
    const parser = new Parser(buffer);

    while (parser.offset < buffer.byteLength) {
        const cid = parser.eatUInt32();
        const category = parser.eatByte();
        const end = parser.peekUInt32() + parser.offset;
        callback({
            cid,
            category,
            data: parser.buffer.slice(parser.offset, end),
        });
        parser.offset = end;
    }
}

export function deserializeFrameData(data: { cid: number; category: number; data: Uint8Array }): any {
    const classType = getTypeOfCategory(data.category);
    const deserializer = classType ? getBSONDeserializer(undefined, classType) : deserializeBSONWithoutOptimiser;
    return deserializer(data.data);
}

export function decodeFrames(buffer: Uint8Array, callback: (frame: FrameStart | FrameEnd) => void): void {
    const parser = new Parser(buffer);

    while (parser.offset < buffer.byteLength) {
        const cid = parser.eatUInt32();
        const type = parser.eatByte();
        const timestamp = parser.eatDouble();

        if (type === FrameType.start) {
            const context = parser.eatUInt32();
            const category = parser.eatByte();
            const stringSize = parser.eatByte();
            const label = parser.eatString(stringSize);
            callback({
                cid,
                type: FrameType.start,
                timestamp,
                context,
                category,
                label,
            });
        } else {
            callback({ cid, type: FrameType.end, timestamp });
        }
    }
}
