/**
 * A message of exchange-server has a very simple frame:
 *
 * <message-id>.<type>:<arg>\0<payload>
 */
export function decodeMessage(array: ArrayBuffer | string): {id: number, type: string, arg: string, payload: Uint8Array} {
    if ('string' === typeof array) {
        const posDot = array.indexOf('.');
        const id = parseInt(array.slice(0, posDot), 10);

        const posColon = array.indexOf(':');
        const type = array.slice(posDot + 1, posColon);

        const posNull = array.indexOf('\0');
        const arg = JSON.parse(array.slice(posColon + 1, posNull));

        return {
            id, type, arg, payload: new Uint8Array(str2ab(array.slice(posNull + 1)))
        };
    } else {
        const uintArray = new Uint8Array(array);

        const posDot = uintArray.indexOf(46); //46=.
        const id = parseInt(String.fromCharCode.apply(null, uintArray.slice(0, posDot) as any), 10);

        const posColon = uintArray.indexOf(58); //58=:
        const type = String.fromCharCode.apply(null, uintArray.slice(posDot + 1, posColon) as any);

        const posNull = uintArray.indexOf(0); //0=\0
        const arg = JSON.parse(String.fromCharCode.apply(null, uintArray.slice(posColon + 1, posNull) as any));

        return {
            id, type, arg, payload: uintArray.slice(posNull + 1)
        };
    }
}

export function encodeMessage(messageId: number, type: string, arg: any, payload?: string | ArrayBuffer | Uint8Array | object): Uint8Array {
    const message = new Uint8Array((messageId + '.' + type + ':' + JSON.stringify(arg) + '\0').split('').map(v => v.charCodeAt(0)));
    let payloadBuffer = new Uint8Array(0);

    if (payload instanceof ArrayBuffer) {
        payloadBuffer = new Uint8Array(payload);
    } else if (payload instanceof Uint8Array) {
        payloadBuffer = payload;
    } else if ('string' === typeof payload) {
        payloadBuffer = new Uint8Array(str2ab(payload));
    } else if (payload) {
        payloadBuffer = new Uint8Array(str2ab(JSON.stringify(payload)));
    }

    const m = new Uint8Array(message.length + payloadBuffer.length);
    m.set(message);
    m.set(payloadBuffer, message.length);

    return m;
}

export function uintToString(array: Uint8Array): string {
    return String.fromCharCode.apply(null, array as any);
}

export function str2ab(str: string): ArrayBuffer {
    const array = new Uint8Array(str.length);

    for (let i = 0; i < str.length; i++) {
        array[i] = str.charCodeAt(i);
    }
    return array.buffer;
}
