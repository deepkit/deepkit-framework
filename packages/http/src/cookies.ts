import { HttpRequest } from './model.js';

export type ParsedCookies = Record<string, string>;

export function createLazyCookiesAccessor(requestHeaders: HttpRequest['headers']): ParsedCookies {
    const cookieHeaderContents = requestHeaders['cookie'];
    if (cookieHeaderContents === undefined) {
        return {};
    }

    const parsedCookies: ParsedCookies = {};

    let wasParsingPerformed = false;
    function parseCookies() {
        Object.assign(parsedCookies, parseCookiesFromCookieHeader(cookieHeaderContents as string))
        wasParsingPerformed = true;
    }

    return new Proxy(parsedCookies, {
        get(target, prop, receiver) {
            if (!wasParsingPerformed) { parseCookies(); }
            return Reflect.get(target, prop, receiver);
        },

        has(target, prop) {
            if (!wasParsingPerformed) { parseCookies(); }
            return Reflect.has(target, prop);
        }
    });
}


const validCookieNameRegExp = /^[\w!#$%&'*.^`|~+-]+$/;
const validCookieValueRegExp = /^[ !#-:<-[\]-~]*$/;

export function parseCookiesFromCookieHeader(cookieHeaderValue: string): ParsedCookies {
    const pairs = cookieHeaderValue.trim().split(';');

    return pairs.reduce<ParsedCookies>((parsedCookie, pairStr) => {
        pairStr = pairStr.trim();

        const valueStartPos = pairStr.indexOf('=');
        if (valueStartPos === -1) {
            return parsedCookie;
        }

        const cookieName = pairStr.substring(0, valueStartPos).trim();
        if (!validCookieNameRegExp.test(cookieName)) {
            return parsedCookie;
        }

        let cookieValue = pairStr.substring(valueStartPos + 1).trim();
        if (cookieValue.startsWith('"') && cookieValue.endsWith('"')) {
            cookieValue = cookieValue.slice(1, -1);
        }
        if (validCookieValueRegExp.test(cookieValue)) {
            parsedCookie[cookieName] = decodeURIComponent(cookieValue);
        }

        return parsedCookie;
    }, {});
}
