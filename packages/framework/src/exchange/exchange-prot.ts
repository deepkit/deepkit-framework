/*
 * Deepkit Framework
 * Copyright (C) 2020 Deepkit UG
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

/**
 * A message of exchange-server has a very simple frame:
 *
 * <length><message-id>.<type>:<arg>\0<payload>
 */
export function decodeMessage(array: ArrayBuffer): {id: number, type: string, arg: any, payload: ArrayBuffer} {
    const uintArray = new Uint8Array(array);

    const posDot = uintArray.indexOf(46); //46=.
    const id = parseInt(String.fromCharCode.apply(null, uintArray.slice(0, posDot) as any), 10);

    const posColon = uintArray.indexOf(58); //58=:
    const type = String.fromCharCode.apply(null, uintArray.slice(posDot + 1, posColon) as any);

    const posNull = uintArray.indexOf(0); //0=\0
    const arg = decodePayloadAsJson(uintArray.slice(posColon + 1, posNull));

    return {
        id, type, arg, payload: uintArray.slice(posNull + 1).buffer
    };
}

export function encodeMessage(messageId: number, type: string, arg: any, payload?: ArrayBuffer | Uint8Array): ArrayBuffer {
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
    try {
        return JSON.parse(arrayBufferToString(payload));
    } catch (e) {
        console.error('Could not parse JSON payload', e, arrayBufferToString(payload));
        throw e;
    }
}

export function encodePayloadAsJSONArrayBuffer(data: object): ArrayBuffer {
    return str2ab(JSON.stringify(data));
}

export function arrayBufferToString(arrayBuffer: ArrayBuffer): string {
    return Buffer.from(arrayBuffer).toString('utf8');
}

export function str2ab(str: string): ArrayBuffer {
    return Buffer.from(str, 'utf8');
}
