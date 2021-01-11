import { convertQueryFilter, DatabaseQueryModel } from "@deepkit/orm";
import { ClassSchema, Serializer } from "@deepkit/type";

export function getSqlFilter<T>(classSchema: ClassSchema<T>, model: DatabaseQueryModel<T>, serializer: Serializer): any {
    const scope = serializer.for(classSchema);

    return convertQueryFilter(classSchema.classType, (model.filter || {}), (convertClassType: ClassSchema, path: string, value: any) => {
        return scope.serializeProperty(path, value);
    }, {}, {
        $parameter: (name, value) => {
            if (undefined === model.parameters[value]) {
                throw new Error(`Parameter ${value} not defined in ${classSchema.getClassName()} query.`);
            }
            return model.parameters[value];
        }
    });
}