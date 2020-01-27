
/**
 * A message of exchange-server has a very simple frame:
 *
 * <message-id>.<type>:<arg>\0<payload>
 */
export function decodeMessage(array: ArrayBuffer): {id: number, type: string, arg: any, payload: ArrayBuffer} {
    const uintArray = new Uint8Array(array);

    const posDot = uintArray.indexOf(46); //46=.
    const id = parseInt(String.fromCharCode.apply(null, uintArray.slice(0, posDot) as any), 10);

    const posColon = uintArray.indexOf(58); //58=:
    const type = String.fromCharCode.apply(null, uintArray.slice(posDot + 1, posColon) as any);

    const posNull = uintArray.indexOf(0); //0=\0
    const arg = JSON.parse(String.fromCharCode.apply(null, uintArray.slice(posColon + 1, posNull) as any));

    return {
        id, type, arg, payload: uintArray.slice(posNull + 1).buffer
    };
}

export function encodeMessage(messageId: number, type: string, arg: any, payload?: ArrayBuffer): ArrayBuffer {
    const header = messageId + '.' + type + ':' + JSON.stringify(arg) + '\0';
    const headerBuffer = new Uint8Array(str2ab(header));

    if (!payload) {
        return headerBuffer;
    }

    const m = new Uint8Array(headerBuffer.length + new Uint8Array(payload).length);
    m.set(headerBuffer);
    m.set(new Uint8Array(payload), headerBuffer.length);

    return m.buffer;
}

export function decodePayloadAsJson(payload?: ArrayBuffer): any {
    if (!payload) return undefined;
    if (!payload.byteLength) return undefined;
    return JSON.parse(arrayBufferToString(payload));
}

export function encodePayloadAsJSONArrayBuffer(data: object): ArrayBuffer {
    return str2ab(JSON.stringify(data));
}

export function arrayBufferToString(arrayBuffer: ArrayBuffer): string {
    //see https://jsperf.com/converting-a-uint8array-to-a-string/13
    return String.fromCharCode.apply(null, new Uint8Array(arrayBuffer) as any);
}

export function str2ab(str: string): ArrayBuffer {
    const array = new Uint8Array(str.length);
    for (let i = 0; i < str.length; i++) {
        array[i] = str.charCodeAt(i);
    }
    return array.buffer;
}
