import { ClassType, isArray, isFunction } from '@deepkit/core';
import { binaryTypes, getClassType, ReflectionKind, Type } from './reflection/type.js';

interface RegistryDecorator<T> {
    predicate: (type: Type) => boolean,
    v: T
}

export class TypeRegistry<T> {
    protected results: { [kind in ReflectionKind]?: T } = {};
    public classes = new Map<ClassType, T>();
    protected decorators: RegistryDecorator<T>[] = [];

    clear(): void {
        this.results = {};
        this.classes.clear();
    }

    get(type: Type): T | undefined {
        for (const d of this.decorators) {
            if (d.predicate(type)) return d.v;
        }

        if (type.kind === ReflectionKind.class) {
            const classResult = this.classes.get(getClassType(type));
            if (classResult) return classResult;
            if (type.classType === Set || type.classType === Map || binaryTypes.includes(getClassType(type))) return undefined;
        }
        return this.results[type.kind];
    }

    decorator(predicate: (type: Type) => boolean, v: T): void {
        this.decorators.push({ predicate, v });
    }

    /**
     * Registers a template for all binary classes: ArrayBuffer, Uint8Array, Int8Array, etc.
     */
    setBinary(v: T): void {
        for (const classType of binaryTypes) this.setClass(classType, v);
    }

    setNumeric(v: T): void{
        this.set([ReflectionKind.number, ReflectionKind.bigint], v);
    }

    /**
     * Registers a template for a given class type.
     *
     * As soon as a single template has registered for the given classType the template registry
     * only returns templates for this particular classType and omits all general purpose ReflectionKind.class templates for this particular classType.
     */
    setClass(classType: ClassType, v: T): void {
        this.classes.set(classType, v);
    }

    /**
     * Removes all registered templates.
     */
    remove(kind: ReflectionKind): void {
        this.results[kind] = undefined;
    }

    /**
     * Registers a new template and replaces all existing (added via register,prepend,append).
     */
    set(kind: ReflectionKind | ReflectionKind[] | ((type: Type) => boolean), v: T): void {
        if (isFunction(kind)) return this.decorator(kind, v);
        kind = isArray(kind) ? kind : [kind];
        for (const k of kind) this.results[k] = v;
    }
}
