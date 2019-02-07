import { Binary, ObjectID } from 'mongodb';
import {
  classToPlain,
  ClassType,
  deleteExcludedPropertiesFor,
  getClassName,
  getClassPropertyName,
  getDecorator,
  getEnumKeys,
  getParentReferenceClass,
  getRegisteredProperties,
  getResolvedReflection,
  getValidEnumValue,
  isArray,
  isEnumAllowLabelsAsValue,
  isObject,
  isOptional,
  isUndefined,
  isValidEnumValue,
  toClass,
  ToClassState,
} from '@marcj/marshal';
import * as clone from 'clone';
import * as mongoUuid from 'mongo-uuid';

export function uuid4Binary(u?: string): Binary {
  return mongoUuid(Binary, u);
}

export function uuid4Stringify(u: Binary | string): string {
  return 'string' === typeof u ? u : mongoUuid.stringify(u);
}

export function partialClassToMongo<T, K extends keyof T>(
  classType: ClassType<T>,
  target?: { [path: string]: any }
): { [path: string]: any } {
  if (!target) return {};

  const result = {};
  for (const i in target) {
    if (!target.hasOwnProperty(i)) continue;

    if ((target[i] as any) instanceof RegExp) {
      continue;
    }

    result[i] = propertyClassToMongo(classType, i, target[i]);
  }

  return result;
}

export function partialPlainToMongo<T, K extends keyof T>(
  classType: ClassType<T>,
  target?: { [path: string]: any }
): { [path: string]: any } {
  if (!target) return {};

  const result = {};
  for (const i in target) {
    if (!target.hasOwnProperty(i)) continue;

    result[i] = propertyPlainToMongo(classType, i, target[i]);
  }

  return result;
}

export function partialMongoToPlain<T, K extends keyof T>(
  classType: ClassType<T>,
  target?: { [path: string]: any }
): { [path: string]: any } {
  if (!target) return {};

  const result = {};
  for (const i in target) {
    if (!target.hasOwnProperty(i)) continue;

    result[i] = propertyMongoToPlain(classType, i, target[i]);
  }

  return result;
}

export function propertyMongoToPlain<T>(
  classType: ClassType<T>,
  propertyName: string,
  propertyValue: any
) {
  const reflection = getResolvedReflection(classType, propertyName);
  if (!reflection) return propertyValue;

  const { type } = reflection;

  if (isUndefined(propertyValue)) {
    return undefined;
  }

  if (null === propertyValue) {
    return null;
  }

  function convert(value: any) {
    if (value && 'uuid' === type && 'string' !== typeof value) {
      return uuid4Stringify(value);
    }

    if (
      'objectId' === type &&
      'string' !== typeof value &&
      value.toHexString()
    ) {
      return (<ObjectID>value).toHexString();
    }

    if ('date' === type && value instanceof Date) {
      return value.toJSON();
    }

    return value;
  }

  return convert(propertyValue);
}

export function propertyClassToMongo<T>(
  classType: ClassType<T>,
  propertyName: string,
  propertyValue: any
) {
  const reflection = getResolvedReflection(classType, propertyName);
  if (!reflection) return propertyValue;

  const {
    resolvedClassType,
    resolvedPropertyName,
    type,
    typeValue,
    array,
    map,
  } = reflection;

  if (isUndefined(propertyValue)) {
    return undefined;
  }

  if (null === propertyValue) {
    return null;
  }

  function convert(value: any) {
    if (value && 'objectId' === type && 'string' === typeof value) {
      try {
        return new ObjectID(value);
      } catch (e) {
        throw new Error(
          `Invalid ObjectID given in property ${getClassPropertyName(
            resolvedClassType,
            resolvedPropertyName
          )}: '${value}'`
        );
      }
    }

    if (value && 'uuid' === type && 'string' === typeof value) {
      try {
        return uuid4Binary(value);
      } catch (e) {
        throw new Error(
          `Invalid UUID given in property ${getClassPropertyName(
            resolvedClassType,
            resolvedPropertyName
          )}: '${value}'`
        );
      }
    }

    if ('string' === type) {
      return String(value);
    }

    if ('number' === type) {
      return Number(value);
    }

    if ('enum' === type) {
      //the class instance itself can only have the actual value which can be used in plain as well
      return value;
    }

    if ('binary' === type) {
      return new Binary(value);
    }

    if (type === 'class') {
      return classToMongo(typeValue, value);
    }

    return value;
  }

  if (array) {
    if (isArray(propertyValue)) {
      return propertyValue.map((v) => convert(v));
    }
    return [];
  }

  if (map) {
    const result: { [name: string]: any } = {};
    if (isObject(propertyValue)) {
      for (const i in propertyValue) {
        if (!propertyValue.hasOwnProperty(i)) continue;
        result[i] = convert((<any>propertyValue)[i]);
      }
    }
    return result;
  }

  return convert(propertyValue);
}

export function propertyPlainToMongo<T>(
  classType: ClassType<T>,
  propertyName: string,
  propertyValue: any
) {
  const reflection = getResolvedReflection(classType, propertyName);
  if (!reflection) return propertyValue;

  const {
    resolvedClassType,
    resolvedPropertyName,
    type,
    typeValue,
    array,
    map,
  } = reflection;

  if (isUndefined(propertyValue)) {
    return undefined;
  }

  if (null === propertyValue) {
    return null;
  }

  function convert(value: any) {
    if (value && 'objectId' === type && 'string' === typeof value) {
      try {
        return new ObjectID(value);
      } catch (e) {
        throw new Error(
          `Invalid ObjectID given in property ${getClassPropertyName(
            resolvedClassType,
            resolvedPropertyName
          )}: '${value}'`
        );
      }
    }

    if (value && 'uuid' === type && 'string' === typeof value) {
      try {
        return uuid4Binary(value);
      } catch (e) {
        throw new Error(
          `Invalid UUID given in property ${getClassPropertyName(
            resolvedClassType,
            resolvedPropertyName
          )}: '${value}'`
        );
      }
    }
    if (
      'date' === type &&
      ('string' === typeof value || 'number' === typeof value)
    ) {
      return new Date(value);
    }

    if ('string' === type && 'string' !== typeof value) {
      return String(value);
    }

    if ('number' === type && 'number' !== typeof value) {
      return +value;
    }

    if ('binary' === type && 'string' === typeof value) {
      return new Buffer(value, 'base64');
    }

    if ('boolean' === type && 'boolean' !== typeof value) {
      if ('true' === value || '1' === value || 1 === value) return true;
      if ('false' === value || '0' === value || 0 === value) return false;

      return true === value;
    }

    if ('any' === type) {
      return clone(value, false);
    }

    if ('binary' === type && 'string' === typeof value) {
      return new Binary(new Buffer(value, 'base64'));
    }

    if (type === 'class') {
      //we need to check if value has all properties set, if one not-optional is missing, we throw an error
      for (const property of getRegisteredProperties(typeValue)) {
        if (value[property] === undefined) {
          if (isOptional(typeValue, propertyName)) {
            continue;
          }
          throw new Error(
            `Missing value for ${getClassPropertyName(
              typeValue,
              propertyName
            )}. Can not convert to mongo.`
          );
        }

        value[property] = propertyPlainToMongo(
          typeValue,
          property,
          value[property]
        );
      }
    }

    return value;
  }

  if (array) {
    if (isArray(propertyValue)) {
      return propertyValue.map((v) => convert(v));
    }
    return [];
  }

  if (map) {
    const result: { [name: string]: any } = {};
    if (isObject(propertyValue)) {
      for (const i in propertyValue) {
        if (!propertyValue.hasOwnProperty(i)) continue;
        result[i] = convert((<any>propertyValue)[i]);
      }
    }
    return result;
  }

  return convert(propertyValue);
}

export function propertyMongoToClass<T>(
  classType: ClassType<T>,
  propertyName: string,
  propertyValue: any,
  parents: any[],
  incomingLevel: number,
  state: ToClassState
) {
  if (isUndefined(propertyValue)) {
    return undefined;
  }

  if (null === propertyValue) {
    return null;
  }

  const reflection = getResolvedReflection(classType, propertyName);
  if (!reflection) return propertyValue;

  const {
    resolvedClassType,
    resolvedPropertyName,
    type,
    typeValue,
    array,
    map,
  } = reflection;

  function convert(value: any) {
    if (value && 'uuid' === type && 'string' !== typeof value) {
      return uuid4Stringify(value);
    }

    if (
      'objectId' === type &&
      'string' !== typeof value &&
      value.toHexString()
    ) {
      return (<ObjectID>value).toHexString();
    }

    if ('date' === type && !(value instanceof Date)) {
      return new Date(value);
    }

    if ('binary' === type && value instanceof Binary) {
      return value.buffer;
    }

    if ('any' === type) {
      return clone(value, false);
    }

    if ('string' === type && 'string' !== typeof value) {
      return String(value);
    }

    if ('number' === type && 'number' !== typeof value) {
      return +value;
    }

    if ('boolean' === type && 'boolean' !== typeof value) {
      if ('true' === value || '1' === value || 1 === value) return true;
      if ('false' === value || '0' === value || 0 === value) return false;

      return true === value;
    }

    if ('enum' === type) {
      const allowLabelsAsValue = isEnumAllowLabelsAsValue(
        resolvedClassType,
        resolvedPropertyName
      );
      if (
        undefined !== value &&
        !isValidEnumValue(typeValue, value, allowLabelsAsValue)
      ) {
        throw new Error(
          `Invalid ENUM given in property ${resolvedPropertyName}: ${value}, valid: ${getEnumKeys(
            typeValue
          ).join(',')}`
        );
      }

      return getValidEnumValue(typeValue, value, allowLabelsAsValue);
    }

    if (type === 'class') {
      if (value instanceof typeValue) {
        //already the target type, this is an error
        throw new Error(
          `${getClassPropertyName(
            resolvedClassType,
            resolvedPropertyName
          )} is already in target format. Are you calling plainToClass() with an class instance?`
        );
      }

      return toClass(
        typeValue,
        clone(value, false, 1),
        propertyMongoToClass,
        parents,
        incomingLevel,
        state
      );
    }

    return value;
  }

  if (array) {
    if (isArray(propertyValue)) {
      return propertyValue.map((v) => convert(v));
    }
    return [];
  }

  if (map) {
    const result: any = {};
    if (isObject(propertyValue)) {
      for (const i in propertyValue) {
        if (!propertyValue.hasOwnProperty(i)) continue;
        result[i] = convert((propertyValue as any)[i]);
      }
    }
    return result;
  }

  return convert(propertyValue);
}

export function mongoToClass<T>(
  classType: ClassType<T>,
  target: any,
  parents?: any[]
): T {
  const state = new ToClassState();
  const item = toClass(
    classType,
    clone(target, false, 1),
    propertyMongoToClass,
    parents || [],
    1,
    state
  );

  for (const callback of state.onFullLoadCallbacks) {
    callback();
  }

  return item;
}

export function mongoToPlain<T>(classType: ClassType<T>, target: any) {
  return classToPlain(classType, mongoToClass(classType, target));
}

export function plainToMongo<T>(
  classType: ClassType<T>,
  target: { [k: string]: any }
): any {
  const result: any = {};

  if (target instanceof classType) {
    throw new Error(
      `Could not plainToMongo since target is a class instance of ${getClassName(
        classType
      )}`
    );
  }

  for (const propertyName of getRegisteredProperties(classType)) {
    if (undefined === (target as any)[propertyName]) {
      continue;
    }

    if (getParentReferenceClass(classType, propertyName)) {
      //we do not export parent references, as this would lead to an circular reference
      continue;
    }

    result[propertyName] = propertyPlainToMongo(
      classType,
      propertyName,
      (target as any)[propertyName]
    );
  }

  deleteExcludedPropertiesFor(classType, result, 'mongo');
  return result;
}

export function classToMongo<T>(classType: ClassType<T>, target: T): any {
  const result: any = {};

  if (!(target instanceof classType)) {
    throw new Error(
      `Could not classToMongo since target is not a class instance of ${getClassName(
        classType
      )}`
    );
  }

  const decoratorName = getDecorator(classType);
  if (decoratorName) {
    return propertyClassToMongo(
      classType,
      decoratorName,
      (target as any)[decoratorName]
    );
  }

  for (const propertyName of getRegisteredProperties(classType)) {
    if (undefined === (target as any)[propertyName]) {
      continue;
    }

    if (getParentReferenceClass(classType, propertyName)) {
      //we do not export parent references, as this would lead to an circular reference
      continue;
    }

    result[propertyName] = propertyClassToMongo(
      classType,
      propertyName,
      (target as any)[propertyName]
    );
  }

  deleteExcludedPropertiesFor(classType, result, 'mongo');
  return result;
}

/**
 * Takes a mongo filter query and converts its plain values to classType's mongo types, so you
 * can use it to send it to mongo.
 */
export function convertPlainQueryToMongo<T, K extends keyof T>(
  classType: ClassType<T>,
  target: { [path: string]: any },
  fieldNamesMap: { [name: string]: boolean } = {}
): { [path: string]: any } {
  const result: { [i: string]: any } = {};

  for (const i in target) {
    if (!target.hasOwnProperty(i)) continue;

    const fieldValue: any = target[i];

    if (i[0] === '$') {
      result[i] = (fieldValue as any[]).map((v) =>
        convertPlainQueryToMongo(classType, v, fieldNamesMap)
      );
      continue;
    }

    if (isObject(fieldValue)) {
      for (const j in fieldValue) {
        if (!fieldValue.hasOwnProperty(j)) continue;

        const queryValue: any = (fieldValue as any)[j];

        if (j[0] !== '$') {
          result[i] = propertyClassToMongo(classType, i, fieldValue);
          break;
        } else {
          if (j === '$and' || j === '$or' || j === '$nor' || j === '$not') {
            (fieldValue as any)[j] = (queryValue as any[]).map((v) =>
              convertPlainQueryToMongo(classType, v, fieldNamesMap)
            );
          } else if (j === '$in' || j === '$nin' || j === '$all') {
            fieldNamesMap[i] = true;
            (fieldValue as any)[j] = (queryValue as any[]).map((v) =>
              propertyClassToMongo(classType, i, v)
            );
          } else if (
            j === '$text' ||
            j === '$exists' ||
            j === '$mod' ||
            j === '$size' ||
            j === '$type' ||
            j === '$regex' ||
            j === '$where'
          ) {
            //don't transform
          } else {
            fieldNamesMap[i] = true;
            (fieldValue as any)[j] = propertyClassToMongo(
              classType,
              i,
              queryValue
            );
          }
        }
      }

      result[i] = fieldValue;
    } else {
      fieldNamesMap[i] = true;
      result[i] = propertyClassToMongo(classType, i, fieldValue);
    }
  }

  return result;
}
