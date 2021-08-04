const gtRegex = />/g;
const ltRegex = /</g;
const qRegex = /"/g;

export function escape(html: string | any): { htmlString: string } {
    return 'string' === typeof html ? { htmlString: escapeHtml(html) } : escape(String(html));
}

export function escapeHtml(html: string | any): string {
    return 'string' === typeof html ? html.replace(ltRegex, '&lt;').replace(gtRegex, '&gt;') : escapeHtml(String(html));
}

export function escapeAttribute(attribute: string | any): string {
    return 'string' === typeof attribute ? attribute.replace(qRegex, '\"') : escapeAttribute(String(attribute));
}

/**
 * Marks a value as safe. You know it does not contain html.
 */
export function safe(html: string) {
    return { htmlString: html };
}

export const safeString = Symbol('safe');
