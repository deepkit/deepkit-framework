import {
    createRpcMessage,
    readBinaryRpcMessage,
    RpcBinaryMessageReader,
    RpcMessage,
    RpcMessageDefinition,
    serializeBinaryRpcMessage,
} from './protocol.js';
import { SingleProgress } from './progress.js';
import { rpcChunk, RpcTypes } from './model.js';

export class TransportOptions {
    /**
     * Stores big buffers to the file system and stream it from there.
     * In bytes.
     * note: not implemented yet
     */
    public cacheOnFileSystemWhenSizeIsAtLeast: number = 100_000_000;

    /**
     * When back-pressure is bigger than this value, we wait with sending new data.
     * In bytes.
     * note: not implemented yet
     */
    public stepBackWhenBackPressureBiggerThan: number = 5_000_000;

    /**
     * Chunk size.
     * In bytes.
     */
    public chunkSize: number = 100_000;
}

export interface TransportMessageWriter {
    (message: RpcMessageDefinition, options: TransportOptions, progress?: SingleProgress): void;
}

export interface TransportConnection {
    /**
     * Write is used either by Client->Server, or Server->Client.
     * The method is responsible to serialize the message and send it over the wire.
     */
    write?: TransportMessageWriter;

    /**
     * Same as write, but sends binary directly. This enables chunking automatically.
     */
    writeBinary?(message: Uint8Array): void;

    bufferedAmount?(): number;

    clientAddress?(): string;

    close(): void;
}

export interface TransportClientConnection {
    token?: any;

    onConnected(established: TransportConnection): void;

    onClose(reason: string): void;

    onError(error: Error): void;

    /**
     * Called when data is received from the other side.
     * The method is responsible to deserialize the message.
     */
    read(message: RpcMessage): void;

    readBinary(message: Uint8Array, bytes?: number): void;
}

export type RpcBinaryWriter = (buffer: Uint8Array) => void;

/**
 * This class acts as a layer between kernel/client and a connection writer.
 * It automatically chunks long messages into multiple smaller one using the RpcType.Chunks type.
 *
 * todo:
 * It keeps track of the back-pressure and sends only when the pressure is not too big.
 * It automatically saves big buffer to the file system and streams data from there to not
 * block valuable memory.
 */
export class TransportBinaryMessageChunkWriter {
    protected chunkId = 0;

    constructor(
        protected reader: RpcBinaryMessageReader,
        protected options: TransportOptions,
    ) {
    }

    /**
     * Writes a message buffer to the connection and chunks if necessary.
     */
    write(writer: RpcBinaryWriter, message: Uint8Array, progress?: SingleProgress): void {
        this.writeFull(writer, message, progress)
            .catch(error => console.log('TransportBinaryMessageChunkWriter writeAsync error', error));
    }

    async writeFull(writer: RpcBinaryWriter, buffer: Uint8Array, progress?: SingleProgress): Promise<void> {
        if (this.options.chunkSize && buffer.byteLength >= this.options.chunkSize) {
            //split up
            const chunkId = this.chunkId++;
            const message = readBinaryRpcMessage(buffer); //we need the original message-id, so the chunks are correctly assigned in Progress tracker
            let offset = 0;
            while (offset < buffer.byteLength) {
                //todo: check back-pressure and wait if necessary
                const slice = buffer.slice(offset, offset + this.options.chunkSize);
                const chunkMessage = createRpcMessage<rpcChunk>(message.id, RpcTypes.Chunk, {
                    id: chunkId,
                    total: buffer.byteLength,
                    v: slice,
                });
                offset += slice.byteLength;
                const promise = new Promise((resolve) => {
                    this.reader.onChunkAck(message.id, resolve);
                });
                writer(serializeBinaryRpcMessage(chunkMessage));
                await promise;
                progress?.set(buffer.byteLength, offset);
            }
        } else {
            writer(buffer);
            progress?.set(buffer.byteLength, buffer.byteLength);
        }
    }
}

export function createWriter(transport: TransportConnection, options: TransportOptions, reader: RpcBinaryMessageReader): TransportMessageWriter {
    if (transport.writeBinary) {
        const chunkWriter = new TransportBinaryMessageChunkWriter(reader, options);
        return (message, options, progress) => {
            const buffer = serializeBinaryRpcMessage(message);
            chunkWriter.write(transport.writeBinary!, buffer, progress);
        };
    }

    if (transport.write) {
        return transport.write;
    }

    throw new Error('No write method found on transport');
}
