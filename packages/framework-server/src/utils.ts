import sift, {SiftQuery} from "sift";
import {FilterQuery} from "@marcj/glut-core";

export function findQuerySatisfied<T extends { [index: string]: any }>(target: { [index: string]: any }, query: FilterQuery<T>): boolean {
    return sift(query as SiftQuery<T[]>, [target]).length > 0;
}
