import {eachPair, isPromise} from "@super-hornet/core";
import {createJITConverterFromPropertySchema, getClassSchema, jitValidateProperty, PropertySchema, ValidationError} from "@super-hornet/marshal";
import {ValidationErrorItem, ValidationParameterError} from "./core";

export type ActionTypes = { parameters: PropertySchema[] };

export async function executeAction(
    actionTypes: ActionTypes,
    controllerName: any,
    controllerInstance: any,
    methodName: string,
    args: any[]): Promise<{ value: any, encoding: PropertySchema }> {

    for (const [i, p] of eachPair(actionTypes.parameters)) {
        if (!p.typeSet && p.type === 'any' && args[i] && args[i].constructor === Object) {
            throw new Error(
                `${controllerName}::${methodName} argument ${i} is an Object with unknown structure. Please declare the type using the @f decorator.`
            );
        }

        const errors: ValidationError[] = [];

        jitValidateProperty(p)(args[i], methodName + '#' + String(i), errors);

        if (errors.length > 0) {
            throw new ValidationParameterError(
                controllerName,
                methodName,
                i,
                errors.map(error => new ValidationErrorItem(error.path, error.message, error.code)));
        }

        args[i] = createJITConverterFromPropertySchema('plain', 'class', p)(args[i]);
    }

    let result = (controllerInstance as any)[methodName](...args);

    if (isPromise(result)) {
        result = await result;
    }

    const schema = getClassSchema(controllerInstance.constructor);

    if (schema.hasMethod(methodName)) {
        return {
            value: result,
            encoding: schema.getMethod(methodName),
        };
    }

    const p = new PropertySchema(methodName);
    if (result) {
        p.setFromJSValue(result);
    }

    return {
        value: result,
        encoding: p,
    };
}
