/*
 * Deepkit Framework
 * Copyright (C) 2020 Deepkit UG
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

import {eachPair, isPromise} from '@deepkit/core';
import {getClassSchema, jitValidateProperty, jsonSerializer, PropertySchema, ValidationFailedItem} from '@deepkit/type';
import {ValidationErrorItem, ValidationParameterError} from './core';

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

        const errors: ValidationFailedItem[] = [];

        jitValidateProperty(p)(args[i], methodName + '#' + String(i), errors);

        if (errors.length > 0) {
            throw new ValidationParameterError(
                controllerName,
                methodName,
                i,
                errors.map(error => new ValidationErrorItem(error.path, error.message, error.code)));
        }

        args[i] = jsonSerializer.deserializeProperty(p, args[i]);
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
