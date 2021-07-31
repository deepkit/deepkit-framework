const gtRegex = />/g;
const ltRegex = /</g;
const qRegex = /"/g;

export function escape(html: string | any): string {
    return 'string' === typeof html ? html.replace(ltRegex, '&lt;').replace(gtRegex, '&gt;') : escape(String(html));
}

export function escapeAttribute(attribute: string | any): string {
    return 'string' === typeof attribute ? attribute.replace(qRegex, '\"') : escape(String(attribute));
}
