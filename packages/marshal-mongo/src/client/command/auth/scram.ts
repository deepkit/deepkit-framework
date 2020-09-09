import {createHash, createHmac, pbkdf2Sync, randomBytes, timingSafeEqual} from 'crypto';
import {MongoAuth} from './auth';
import {t} from '@super-hornet/marshal';
import {MongoClientConfig} from '../../client';
import {BaseResponse, Command} from '../command';
import {MongoError} from '../../error';
import * as saslprep from 'saslprep';

class SaslStartCommand extends t.class({
    saslStart: t.literal(1),
    $db: t.string,
    mechanism: t.string,
    payload: t.type(Uint8Array),
    autoAuthorize: t.literal(1),
    options: {
        skipEmptyExchange: t.literal(true)
    }
}) {
}

class SaslStartResponse extends t.class({
    conversationId: t.number,
    payload: t.type(Uint8Array),
    done: t.boolean,
}, {extend: BaseResponse}) {
}


class SaslContinueCommand extends t.class({
    saslContinue: t.literal(1),
    $db: t.string,
    conversationId: t.number,
    payload: t.type(Buffer),
}) {
}

class SaslContinueResponse extends t.class({
    conversationId: t.literal(1),
    payload: t.type(Uint8Array),
    done: t.boolean,
}, {extend: BaseResponse}) {
}

function H(method: string, text: Buffer) {
    return createHash(method).update(text).digest();
}

function HMAC(method: string, key: Buffer, text: Buffer | string) {
    return createHmac(method, key).update(text).digest();
}

function cleanUsername(username: string) {
    return username.replace('=', '=3D').replace(',', '=2C');
}

function passwordDigest(u: string, p: string) {
    if (p.length === 0) throw new MongoError('password cannot be empty');

    const md5 = createHash('md5');
    md5.update(`${u}:mongo:${p}`, 'utf8'); //lgtm[js/weak-cryptographic-algorithm] lgtm[js/insufficient-password-hash]
    return md5.digest('hex');
}

function HI(data: string, salt: Buffer, iterations: number, cryptoAlgorithm: string) {
    if (cryptoAlgorithm !== 'sha1' && cryptoAlgorithm !== 'sha256') {
        throw new MongoError(`Invalid crypto algorithm ${cryptoAlgorithm}`);
    }

    //should we implement a cache like the original driver?
    return pbkdf2Sync(
        data,
        salt,
        iterations,
        cryptoAlgorithm === 'sha1' ? 20 : 32,
        cryptoAlgorithm
    );
}

function xor(a: Buffer, b: Buffer) {
    const length = Math.max(a.length, b.length);
    const buffer = Buffer.alloc(length);
    for (let i = 0; i < length; i++) buffer[i] = a[i] ^ b[i];
    return buffer;
}

export abstract class ScramAuth implements MongoAuth {
    protected nonce = randomBytes(24);
    protected cryptoMethod: string;

    protected constructor(protected mechanism: 'SCRAM-SHA-1' | 'SCRAM-SHA-256') {
        this.cryptoMethod = this.mechanism === 'SCRAM-SHA-1' ? 'sha1' : 'sha256';
    }

    async auth(command: Command, config: MongoClientConfig): Promise<void> {
        const username = cleanUsername(config.authUser || '');
        const password = config.authPassword || '';

        const startResponse = await command.sendAndWait(SaslStartCommand, {
            saslStart: 1,
            $db: config.getAuthSource(),
            mechanism: this.mechanism,
            payload: Buffer.concat([Buffer.from('n,,', 'utf8'), this.clientFirstMessageBare(username, this.nonce)]),
            autoAuthorize: 1,
            options: {skipEmptyExchange: true}
        }, SaslStartResponse);

        const processedPassword = this.mechanism === 'SCRAM-SHA-256' ? saslprep(password) : passwordDigest(username, password);

        const payloadAsString = Buffer.from(startResponse.payload).toString('utf8');
        const payloadStart = this.parseStartPayload(payloadAsString);
        const withoutProof = `c=biws,r=${payloadStart.r}`;
        const saltedPassword = HI(
            processedPassword,
            Buffer.from(payloadStart.s, 'base64'),
            payloadStart.i,
            this.cryptoMethod
        );

        const clientKey = HMAC(this.cryptoMethod, saltedPassword, 'Client Key');
        const serverKey = HMAC(this.cryptoMethod, saltedPassword, 'Server Key');
        const storedKey = H(this.cryptoMethod, clientKey);
        const authMessage = [
            this.clientFirstMessageBare(username, this.nonce),
            payloadAsString,
            withoutProof
        ].join(',');

        const clientSignature = HMAC(this.cryptoMethod, storedKey, authMessage);
        const clientProof = `p=${xor(clientKey, clientSignature).toString('base64')}`;
        const clientFinal = [withoutProof, clientProof].join(',');

        const serverSignature = HMAC(this.cryptoMethod, serverKey, authMessage);
        const continueResponse = await command.sendAndWait(SaslContinueCommand, {
            saslContinue: 1,
            $db: config.getAuthSource(),
            conversationId: startResponse.conversationId,
            payload: Buffer.from(clientFinal)
        }, SaslContinueResponse);

        const payloadContinueString = Buffer.from(continueResponse.payload).toString('utf8');
        const payloadContinue = this.parseContinuePayload(payloadContinueString);

        if (!timingSafeEqual(Buffer.from(payloadContinue.v, 'base64'), serverSignature)) {
            throw new MongoError('Server returned an invalid signature');
        }

        if (continueResponse.done) return;

        //not done yet, fire an empty round
        const continueResponse2 = await command.sendAndWait(SaslContinueCommand, {
            saslContinue: 1,
            $db: config.getAuthSource(),
            conversationId: startResponse.conversationId,
            payload: Buffer.alloc(0)
        }, SaslContinueResponse);

        if (continueResponse2.done) return;

        throw new MongoError('Sasl reached end and never never acknowledged a done.');
    }

    //e.g. "r=fyko+d2lbbFgONRv9qkxdawLHo+Vgk7qvUOKUwuWLIWg4l/9SraGMHEE,s=rQ9ZY3MntBeuP3E1TDVC4w==,i=10000"
    protected parseStartPayload(payload: string) {
        const result = {r: '', s: '', i: 0};
        for (const pair of payload.split(',')) {
            const firstSign = pair.indexOf('=');
            const name = pair.substr(0, firstSign);
            const value = pair.substr(firstSign + 1);
            result[name] = name === 'i' ? parseInt(value, 10) : value;
        }
        if (result.i < 4096) throw new MongoError(`Server returned an invalid iteration count ${result.i}`);
        if (result.r.startsWith('nonce')) throw new MongoError(`Server returned an invalid nonce: ${result.r}`);
        return result;
    }

    //e.g. "v=UMWeI25JD1yNYZRMpZ4VHvhZ9e0="
    protected parseContinuePayload(payload: string) {
        const result = {v: ''};
        for (const pair of payload.split(',')) {
            const firstSign = pair.indexOf('=');
            const name = pair.substr(0, firstSign);
            result[name] = pair.substr(firstSign + 1);
        }
        return result;
    }

    protected clientFirstMessageBare(username: string, nonce: Buffer) {
        // NOTE: This is done b/c Javascript uses UTF-16, but the server is hashing in UTF-8.
        // Since the username is not sasl-prep-d, we need to do this here.
        return Buffer.from(`n=${username},r=${nonce.toString('base64')}`, 'utf8');
    }
}

export class Sha1ScramAuth extends ScramAuth {
    constructor() {
        super('SCRAM-SHA-1');
    }
}

export class Sha256ScramAuth extends ScramAuth {
    constructor() {
        super('SCRAM-SHA-256');
    }
}