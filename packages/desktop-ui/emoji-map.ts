import {readFile, writeFile} from "fs-extra";
import {eachPair} from "@marcj/estdlib";

(async () => {
    //this was created by using package `emoji-datasource`
    const file = await readFile('src/components/emoji/emoji_pretty.json', 'utf8');

    const result: {[name: string]: any}  = {};
    const categories: {[name: string]: string[]} = {};

    const fileEmojis: any[] = JSON.parse(file);

    fileEmojis.sort((a, b) => {
        return a.sort_order < b.sort_order ? -1 : +1;
    });

    for (const emoji of fileEmojis) {
        result[emoji['short_name']] = {
            id: emoji['unified'],
            name: emoji['name'] || emoji['short_name'],
            shortName: emoji['short_name'],
            x: emoji['sheet_x'],
            y: emoji['sheet_y'],
        };

         if (!categories[emoji['category']]) {
             categories[emoji['category']] = [emoji['short_name']];
         } else {
             categories[emoji['category']].push(emoji['short_name']);
         }

    }

    const categoriesNormalized = [];
    for (const [name, emojis] of eachPair(categories)) {
        categoriesNormalized.push({
            name: name,
            emojis: emojis,
        })
    }

    const mapTS = `
        export interface Emoji {
            id: string;
            name: string;
            shortName: string;
            x: number;
            y: number;
        }

        export interface EmojiCategory {
            name: string;
            emojis: string[];
        }

        export const emojis: {[id: string]: Emoji} = ${JSON.stringify(result)};
        export const categories: EmojiCategory[] = ${JSON.stringify(categoriesNormalized)};
    `;

    await writeFile('src/components/emoji/emojis.ts', mapTS);

})();
