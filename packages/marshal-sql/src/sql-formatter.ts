import {Formatter} from '@super-hornet/marshal-orm';

export class SqlFormatter extends Formatter {
    // constructor(
    //     rootClassSchema: ClassSchema,
    //     serializerSourceName: string,
    //     hydrator: HydratorFn | undefined,
    //     identityMap: IdentityMap | undefined,
    //     protected sqlBuilder: SqlBuilder,
    // ) {
    //     super(rootClassSchema, serializerSourceName, hydrator, identityMap);
    // }

    // protected hydrateModel(model: DatabaseQueryModel<any, any, any>, classSchema: ClassSchema, dbRecord: any): any {
    //
    //     // dbRecord =
    //     return super.hydrateModel(model, classSchema, dbRecord);
    // }
    //
    // protected assignJoins(model: DatabaseQueryModel<any, any, any>, classSchema: ClassSchema, dbRecord: any, item: any): { [p: string]: true } {
    //     const handledRelation: { [name: string]: true } = {};
    //
    //     for (const join of model.joins) {
    //         handledRelation[join.propertySchema.name] = true;
    //         // const refName = join.as || join.propertySchema.name;
    //
    //         //When the item is NOT from the database or property was overwritten, we don't overwrite it again.
    //         if (item.hasOwnProperty(join.propertySchema.symbol)) {
    //             continue;
    //         }
    //     }
    //
    //     return handledRelation;
    // }
}