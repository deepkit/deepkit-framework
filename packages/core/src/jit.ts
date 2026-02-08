/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

/**
 * JIT2: Unified Expression Tree Architecture
 *
 * This is a complete redesign of the JIT system using a clean expression tree
 * that both JIT compilation and direct execution can use.
 *
 * Key improvements over jit.ts:
 * 1. Single unified tree structure for both modes
 * 2. Clean separation: build tree once, then compile OR interpret
 * 3. No hotfixes needed for recursive types
 * 4. Simpler, more intuitive API
 *
 * @example
 * ```typescript
 * import { fn, arg } from '@deepkit/core/jit2';
 *
 * const serialize = fn(arg<User>(), (b, input) => {
 *     return b.obj({
 *         name: b.get(input, 'name'),
 *         email: b.get(input, 'email'),
 *     });
 * });
 * ```
 */

// ============================================================================
// Expression Tree Types (Tagged Unions)
// ============================================================================

/** Literal value expression */
export interface LitExpr {
    readonly kind: 'lit';
    readonly value: any;
}

/** Input argument reference */
export interface InputExpr {
    readonly kind: 'input';
    readonly index: number;
}

/** Variable reference */
export interface VarExpr {
    readonly kind: 'var';
    readonly id: number;
    readonly name?: string;
}

/** Property access: obj.key or obj[key] */
export interface GetExpr {
    readonly kind: 'get';
    readonly obj: Expr;
    readonly key: string | Expr;
}

/** Array element access: arr[index] */
export interface AtExpr {
    readonly kind: 'at';
    readonly arr: Expr;
    readonly index: number | Expr;
}

/** Function call: fn(args...) */
export interface CallExpr {
    readonly kind: 'call';
    readonly fn: Function;
    readonly args: readonly Expr[];
}

/** Constructor call: new Ctor(args...) */
export interface NewExpr {
    readonly kind: 'new';
    readonly ctor: new (...args: any[]) => any;
    readonly args: readonly Expr[];
}

/** Object literal: { key: value, ... } */
export interface ObjExpr {
    readonly kind: 'obj';
    readonly entries: readonly (readonly [string | Expr, Expr])[];
}

/** Array literal: [elem, ...] */
export interface ArrExpr {
    readonly kind: 'arr';
    readonly elements: readonly Expr[];
}

/** Strict equality: a === b */
export interface EqExpr {
    readonly kind: 'eq';
    readonly a: Expr;
    readonly b: Expr;
}

/** Strict inequality: a !== b */
export interface NeqExpr {
    readonly kind: 'neq';
    readonly a: Expr;
    readonly b: Expr;
}

/** Less than: a < b */
export interface LtExpr {
    readonly kind: 'lt';
    readonly a: Expr;
    readonly b: Expr;
}

/** Greater than: a > b */
export interface GtExpr {
    readonly kind: 'gt';
    readonly a: Expr;
    readonly b: Expr;
}

/** Less than or equal: a <= b */
export interface LteExpr {
    readonly kind: 'lte';
    readonly a: Expr;
    readonly b: Expr;
}

/** Greater than or equal: a >= b */
export interface GteExpr {
    readonly kind: 'gte';
    readonly a: Expr;
    readonly b: Expr;
}

/** Logical NOT: !a */
export interface NotExpr {
    readonly kind: 'not';
    readonly a: Expr;
}

/** Logical AND: a && b */
export interface AndExpr {
    readonly kind: 'and';
    readonly a: Expr;
    readonly b: Expr;
}

/** Logical OR: a || b */
export interface OrExpr {
    readonly kind: 'or';
    readonly a: Expr;
    readonly b: Expr;
}

/** Nullish coalescing: a ?? b */
export interface NullishExpr {
    readonly kind: 'nullish';
    readonly a: Expr;
    readonly b: Expr;
}

/** typeof operator */
export interface TypeofExpr {
    readonly kind: 'typeof';
    readonly value: Expr;
}

/** typeof === type check */
export interface IsTypeExpr {
    readonly kind: 'isType';
    readonly value: Expr;
    readonly type: string;
}

/** value === null */
export interface IsNullExpr {
    readonly kind: 'isNull';
    readonly value: Expr;
}

/** value == null (null or undefined) */
export interface IsNullishExpr {
    readonly kind: 'isNullish';
    readonly value: Expr;
}

/** Property existence: key in obj */
export interface HasExpr {
    readonly kind: 'has';
    readonly obj: Expr;
    readonly key: string | Expr;
}

/** Length access: value.length */
export interface LenExpr {
    readonly kind: 'len';
    readonly value: Expr;
}

/** Ternary: cond ? then : else */
export interface TernaryExpr {
    readonly kind: 'ternary';
    readonly cond: Expr;
    readonly then: Expr;
    readonly else: Expr;
}

/** instanceof check */
export interface InstanceofExpr {
    readonly kind: 'instanceof';
    readonly value: Expr;
    readonly ctor: Function;
}

/** String concatenation: a + b + c */
export interface ConcatExpr {
    readonly kind: 'concat';
    readonly parts: readonly Expr[];
}

/** Addition: a + b (numeric) */
export interface AddExpr {
    readonly kind: 'add';
    readonly a: Expr;
    readonly b: Expr;
}

/** Subtraction: a - b */
export interface SubExpr {
    readonly kind: 'sub';
    readonly a: Expr;
    readonly b: Expr;
}

/** Multiplication: a * b */
export interface MulExpr {
    readonly kind: 'mul';
    readonly a: Expr;
    readonly b: Expr;
}

/** Division: a / b */
export interface DivExpr {
    readonly kind: 'div';
    readonly a: Expr;
    readonly b: Expr;
}

/** Modulo: a % b */
export interface ModExpr {
    readonly kind: 'mod';
    readonly a: Expr;
    readonly b: Expr;
}

/** Bitwise AND: a & b */
export interface BitAndExpr {
    readonly kind: 'bitAnd';
    readonly a: Expr;
    readonly b: Expr;
}

/** Bitwise OR: a | b */
export interface BitOrExpr {
    readonly kind: 'bitOr';
    readonly a: Expr;
    readonly b: Expr;
}

/** Bitwise XOR: a ^ b */
export interface BitXorExpr {
    readonly kind: 'bitXor';
    readonly a: Expr;
    readonly b: Expr;
}

/** Left shift: a << b */
export interface ShlExpr {
    readonly kind: 'shl';
    readonly a: Expr;
    readonly b: Expr;
}

/** Right shift: a >> b */
export interface ShrExpr {
    readonly kind: 'shr';
    readonly a: Expr;
    readonly b: Expr;
}

/** Unsigned right shift: a >>> b */
export interface UshrExpr {
    readonly kind: 'ushr';
    readonly a: Expr;
    readonly b: Expr;
}

/** Method call: obj.method(args...) */
export interface MethodExpr {
    readonly kind: 'method';
    readonly obj: Expr;
    readonly method: string;
    readonly args: readonly Expr[];
}

/** Array map: arr.map((elem, idx) => body) */
export interface MapExpr {
    readonly kind: 'map';
    readonly arr: Expr;
    readonly elemId: number;
    readonly indexId: number;
    readonly body: Block;
}

/**
 * Helper function call: generates a separate helper function for better V8 optimization.
 * This is used to extract nested object checks into separate functions like Typia does.
 *
 * Generated code pattern:
 *   const _fn_N = (v0) => body;
 *   ... _fn_N(arg) ...
 */
export interface SubFnExpr {
    readonly kind: 'subFn';
    /** The argument to pass to the helper function */
    readonly arg: Expr;
    /** The body expression (uses input(0) to refer to the arg) */
    readonly body: Expr;
    /** Unique ID for this helper function */
    readonly fnId: number;
}

/** Union of all expression types */
export type Expr =
    | LitExpr
    | InputExpr
    | VarExpr
    | GetExpr
    | AtExpr
    | CallExpr
    | NewExpr
    | ObjExpr
    | ArrExpr
    | EqExpr
    | NeqExpr
    | LtExpr
    | GtExpr
    | LteExpr
    | GteExpr
    | NotExpr
    | AndExpr
    | OrExpr
    | NullishExpr
    | TypeofExpr
    | IsTypeExpr
    | IsNullExpr
    | IsNullishExpr
    | HasExpr
    | LenExpr
    | TernaryExpr
    | InstanceofExpr
    | ConcatExpr
    | AddExpr
    | SubExpr
    | MulExpr
    | DivExpr
    | ModExpr
    | BitAndExpr
    | BitOrExpr
    | BitXorExpr
    | ShlExpr
    | ShrExpr
    | UshrExpr
    | MethodExpr
    | MapExpr
    | SubFnExpr;

// ============================================================================
// Statement Types
// ============================================================================

/** Variable declaration: let id = expr */
export interface LetStmt {
    readonly kind: 'let';
    readonly id: number;
    readonly expr: Expr;
    readonly name?: string;
}

/** Property assignment: obj.key = value or obj[key] = value */
export interface SetStmt {
    readonly kind: 'set';
    readonly obj: Expr;
    readonly key: string | Expr;
    readonly value: Expr;
}

/** Array push: arr.push(value) */
export interface PushStmt {
    readonly kind: 'push';
    readonly arr: Expr;
    readonly value: Expr;
}

/** Variable assignment: id = value */
export interface SetVarStmt {
    readonly kind: 'setVar';
    readonly id: number;
    readonly value: Expr;
}

/** Execute expression for side effects */
export interface ExecStmt {
    readonly kind: 'exec';
    readonly expr: Expr;
}

/** Early return */
export interface ReturnStmt {
    readonly kind: 'return';
    readonly value?: Expr;
}

/** Throw error */
export interface ThrowStmt {
    readonly kind: 'throw';
    readonly error: Expr;
}

/** If statement with optional else */
export interface IfStmt {
    readonly kind: 'if';
    readonly cond: Expr;
    readonly then: Block;
    readonly else?: Block;
}

/** For loop over array (optionally with custom start/end range) */
export interface LoopStmt {
    readonly kind: 'loop';
    /** Array to iterate over. Required unless start/end are both provided. */
    readonly arr?: Expr;
    readonly elemId: number;
    readonly indexId: number;
    readonly body: Block;
    readonly elemName?: string;
    readonly indexName?: string;
    /** If true, don't generate element variable (only index needed) */
    readonly skipElem?: boolean;
    /** Start index (default: 0) */
    readonly start?: Expr;
    /** End index (default: arr.length) */
    readonly end?: Expr;
}

/** For-in loop over object keys */
export interface ForInStmt {
    readonly kind: 'forIn';
    readonly obj: Expr;
    readonly keyId: number;
    readonly body: Block;
    readonly keyName?: string;
}

/** For-of loop over iterables (Map, Set, etc.) */
export interface ForOfStmt {
    readonly kind: 'forOf';
    /** The iterable expression (Map, Set, array, etc.) */
    readonly iterable: Expr;
    /** Variable ID for the iteration value */
    readonly valueId: number;
    /** Optional variable ID for destructured key (used with Map entries) */
    readonly keyId?: number;
    readonly body: Block;
    readonly valueName?: string;
    readonly keyName?: string;
}

/** Switch statement */
export interface SwitchStmt {
    readonly kind: 'switch';
    readonly value: Expr;
    readonly cases: readonly (readonly [any, Block])[];
    readonly default?: Block;
}

/** While loop */
export interface WhileStmt {
    readonly kind: 'while';
    readonly cond: Expr;
    readonly body: Block;
}

/** Break statement (exits enclosing while loop) */
export interface BreakStmt {
    readonly kind: 'break';
}

/** Continue statement (skips to next iteration of enclosing while loop) */
export interface ContinueStmt {
    readonly kind: 'continue';
}

/** Union of all statement types */
export type Stmt =
    | LetStmt
    | SetStmt
    | PushStmt
    | SetVarStmt
    | ExecStmt
    | ReturnStmt
    | ThrowStmt
    | IfStmt
    | LoopStmt
    | ForInStmt
    | ForOfStmt
    | SwitchStmt
    | WhileStmt
    | BreakStmt
    | ContinueStmt;

/** Block of statements with optional return expression */
/** Nested function definition: a full function body to be emitted inside the parent's compilation unit */
export interface NestedFnDef {
    readonly block: Block;
    readonly inputNames: string[];
}

export interface Block {
    readonly stmts: Stmt[];
    returnExpr?: Expr;
    /** Nested function definitions that should be emitted inside the parent's IIFE */
    nestedFunctions?: Map<number, NestedFnDef>;
}

// ============================================================================
// Runtime Detection
// ============================================================================

export interface RuntimeCapabilities {
    newFunction: boolean;
    runtime: 'node' | 'deno' | 'bun' | 'cloudflare' | 'browser' | 'unknown';
}

let _capabilities: RuntimeCapabilities | undefined;

function detectNewFunction(): boolean {
    try {
        new Function('return true')();
        return true;
    } catch {
        return false;
    }
}

function detectRuntime(): RuntimeCapabilities['runtime'] {
    if (typeof (globalThis as any).process !== 'undefined' && (globalThis as any).process.versions?.node) return 'node';
    if (typeof (globalThis as any).Deno !== 'undefined') return 'deno';
    if (typeof (globalThis as any).Bun !== 'undefined') return 'bun';
    const nav = (globalThis as any).navigator;
    if (typeof nav !== 'undefined') {
        if (nav.userAgent?.includes('Cloudflare-Workers')) return 'cloudflare';
        return 'browser';
    }
    return 'unknown';
}

export function getRuntimeCapabilities(): RuntimeCapabilities {
    if (_capabilities) return _capabilities;
    _capabilities = {
        newFunction: detectNewFunction(),
        runtime: detectRuntime(),
    };
    return _capabilities;
}

export const canJIT = detectNewFunction();

// ============================================================================
// Nested Function Inlining
// ============================================================================

/**
 * Global function ID counter — ensures unique names across all Builder instances
 * for both subFn helpers and nested function definitions.
 */
let _globalFnId = 0;

/**
 * Active parent builder context. When set, fn()/fnJIT() calls register as
 * nested function definitions in the parent instead of creating separate
 * new Function() compilation units. This enables V8 to inline nested functions.
 */
let _activeBuilder: Builder | null = null;

// ============================================================================
// Configuration
// ============================================================================

let jitThreshold = (() => {
    if (typeof process !== 'undefined' && process.env?.DEEPKIT_JIT_THRESHOLD) {
        const val = process.env.DEEPKIT_JIT_THRESHOLD;
        if (val === 'Infinity') return Infinity;
        const num = parseInt(val, 10);
        if (!isNaN(num)) return num;
    }
    return 0;
})();

let jitDebug = false;

export function setJitThreshold(threshold: number): void {
    jitThreshold = threshold;
}

export function setJitDebug(debug: boolean): void {
    jitDebug = debug;
}

export function getJitThreshold(): number {
    return jitThreshold;
}

// ============================================================================
// Code Generator (JIT Mode)
// ============================================================================

const identifierRegex = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;

function isValidIdentifier(key: string): boolean {
    return identifierRegex.test(key);
}

class CodeGenerator {
    private externals: Map<any, string>;
    private reservedNames: Set<string>;
    private argCount: number;
    /** Helper functions collected during code generation: fnId -> code */
    private helperFunctions = new Map<number, string>();
    /** Variable name hints: id -> name */
    private varNames = new Map<number, string>();
    /** Input argument names */
    private inputNames: string[];
    /** Current indentation level */
    private indentLevel = 0;
    /** Indentation string (4 spaces) */
    private readonly indentStr = '    ';

    /** Default values for input arguments (undefined means no default) */
    private inputDefaults: (string | undefined)[];

    constructor(
        argCount: number,
        inputNames?: string[],
        sharedState?: { externals: Map<any, string>; reservedNames: Set<string> },
        inputDefaults?: (string | undefined)[],
    ) {
        this.argCount = argCount;
        // Share externals/reservedNames with parent CodeGenerator if provided
        this.externals = sharedState?.externals || new Map();
        this.reservedNames = sharedState?.reservedNames || new Set();
        // Use provided names or default to v0, v1, ...
        this.inputNames =
            inputNames && inputNames.length === argCount
                ? inputNames
                : Array.from({ length: argCount }, (_, i) => `v${i}`);
        // Store defaults (undefined means no default for that arg)
        this.inputDefaults = inputDefaults || [];
    }

    /** Get current indentation */
    private get indent(): string {
        return this.indentStr.repeat(this.indentLevel);
    }

    /** Get variable name by id */
    private varName(id: number): string {
        const name = this.varNames.get(id);
        return name ? `${name}_${id}` : `v${id}`;
    }

    /** Register a variable name hint */
    registerVarName(id: number, name: string): void {
        this.varNames.set(id, name);
    }

    private reserveName(name: string): string {
        let sanitized = name.replace(/[^a-zA-Z0-9_$]/g, '_');
        if (sanitized.length === 0 || /^[0-9]/.test(sanitized)) {
            sanitized = '_' + sanitized;
        }
        for (let i = 0; i < 10000; i++) {
            const candidate = sanitized + '_' + i;
            if (!this.reservedNames.has(candidate)) {
                this.reservedNames.add(candidate);
                return candidate;
            }
        }
        throw new Error('Too many external references');
    }

    private addExternal(value: any, hint: string = 'ext'): string {
        // Check for nested function marker — use the nested function name directly
        if (value && typeof value === 'function' && typeof (value as any).__nestedFnId === 'number') {
            return `_nfn_${(value as any).__nestedFnId}`;
        }
        // Check if already registered
        for (const [v, name] of this.externals) {
            if (v === value) return name;
        }
        const name = this.reserveName(hint);
        this.externals.set(value, name);
        return name;
    }

    private exprToCode(expr: Expr): string {
        switch (expr.kind) {
            case 'lit':
                return this.litToCode(expr.value);
            case 'input':
                return this.inputNames[expr.index];
            case 'var':
                return this.varName(expr.id);
            case 'get': {
                const obj = this.exprToCode(expr.obj);
                if (typeof expr.key === 'string') {
                    return isValidIdentifier(expr.key) ? `${obj}.${expr.key}` : `${obj}[${JSON.stringify(expr.key)}]`;
                }
                return `${obj}[${this.exprToCode(expr.key)}]`;
            }
            case 'at': {
                const arr = this.exprToCode(expr.arr);
                const idx = typeof expr.index === 'number' ? String(expr.index) : this.exprToCode(expr.index);
                return `${arr}[${idx}]`;
            }
            case 'call': {
                const fnName = this.addExternal(expr.fn, expr.fn.name || 'fn');
                const args = expr.args.map(a => this.exprToCode(a)).join(',');
                return `${fnName}(${args})`;
            }
            case 'new': {
                const ctorName = this.addExternal(expr.ctor, expr.ctor.name || 'Ctor');
                const args = expr.args.map(a => this.exprToCode(a)).join(',');
                return `new ${ctorName}(${args})`;
            }
            case 'obj': {
                const props = expr.entries
                    .map(([k, v]) => {
                        const key =
                            typeof k === 'string'
                                ? isValidIdentifier(k)
                                    ? k
                                    : JSON.stringify(k)
                                : `[${this.exprToCode(k)}]`;
                        return `${key}:${this.exprToCode(v)}`;
                    })
                    .join(',');
                return `{${props}}`;
            }
            case 'arr': {
                const elems = expr.elements.map(e => this.exprToCode(e)).join(',');
                return `[${elems}]`;
            }
            case 'eq':
                return `${this.exprToCode(expr.a)}===${this.exprToCode(expr.b)}`;
            case 'neq':
                return `${this.exprToCode(expr.a)}!==${this.exprToCode(expr.b)}`;
            case 'lt':
                return `${this.exprToCode(expr.a)}<${this.exprToCode(expr.b)}`;
            case 'gt':
                return `${this.exprToCode(expr.a)}>${this.exprToCode(expr.b)}`;
            case 'lte':
                return `${this.exprToCode(expr.a)}<=${this.exprToCode(expr.b)}`;
            case 'gte':
                return `${this.exprToCode(expr.a)}>=${this.exprToCode(expr.b)}`;
            case 'not':
                // Optimize common patterns
                if (expr.a.kind === 'isNull') {
                    // !isNull(x) -> null!==x (operand-first for V8 optimization)
                    return `null!==${this.exprToCode(expr.a.value)}`;
                }
                if (expr.a.kind === 'isNullish') {
                    // !isNullish(x) -> null!=x (intentional != for nullish check)
                    return `null!=${this.exprToCode(expr.a.value)}`;
                }
                // Keep parentheses - !a===b parses as (!a)===b, not !(a===b)
                return `!(${this.exprToCode(expr.a)})`;
            case 'and': {
                // Flatten AND chain for optimal JS engine optimization
                // Generates: a&&b&&c instead of ((a&&b)&&c)
                const operands: Expr[] = [];
                const collect = (e: Expr): void => {
                    if (e.kind === 'and') {
                        collect(e.a);
                        collect(e.b);
                    } else {
                        operands.push(e);
                    }
                };
                collect(expr);
                return operands.map(e => this.exprToCode(e)).join('&&');
            }
            case 'or': {
                // Flatten OR chain for optimal JS engine optimization
                // Wrap in parens since || has lower precedence than &&
                const operands: Expr[] = [];
                const collect = (e: Expr): void => {
                    if (e.kind === 'or') {
                        collect(e.a);
                        collect(e.b);
                    } else {
                        operands.push(e);
                    }
                };
                collect(expr);
                return `(${operands.map(e => this.exprToCode(e)).join('||')})`;
            }
            case 'nullish':
                return `(${this.exprToCode(expr.a)}??${this.exprToCode(expr.b)})`;
            case 'typeof':
                return `typeof ${this.exprToCode(expr.value)}`;
            case 'isType':
                // Operand-first comparison is faster in V8: "string"===typeof x vs typeof x==="string"
                return `${JSON.stringify(expr.type)}===typeof ${this.exprToCode(expr.value)}`;
            case 'isNull':
                // Operand-first for consistency with isType
                return `null===${this.exprToCode(expr.value)}`;
            case 'isNullish':
                return `${this.exprToCode(expr.value)}==null`;
            case 'has': {
                const obj = this.exprToCode(expr.obj);
                const key = typeof expr.key === 'string' ? JSON.stringify(expr.key) : this.exprToCode(expr.key);
                return `(${key} in ${obj})`;
            }
            case 'len':
                return `${this.exprToCode(expr.value)}.length`;
            case 'ternary':
                return `(${this.exprToCode(expr.cond)}?${this.exprToCode(expr.then)}:${this.exprToCode(expr.else)})`;
            case 'instanceof': {
                const ctorName = this.addExternal(expr.ctor, expr.ctor.name || 'Ctor');
                return `(${this.exprToCode(expr.value)} instanceof ${ctorName})`;
            }
            case 'concat': {
                if (expr.parts.length === 0) return '""';
                if (expr.parts.length === 1) return `(${this.exprToCode(expr.parts[0])}+"")`;
                return `(${expr.parts.map(p => this.exprToCode(p)).join('+')})`;
            }
            case 'add':
                return `(${this.exprToCode(expr.a)}+${this.exprToCode(expr.b)})`;
            case 'sub':
                return `(${this.exprToCode(expr.a)}-${this.exprToCode(expr.b)})`;
            case 'mul':
                return `(${this.exprToCode(expr.a)}*${this.exprToCode(expr.b)})`;
            case 'div':
                return `(${this.exprToCode(expr.a)}/${this.exprToCode(expr.b)})`;
            case 'mod':
                return `(${this.exprToCode(expr.a)}%${this.exprToCode(expr.b)})`;
            case 'bitAnd':
                return `(${this.exprToCode(expr.a)}&${this.exprToCode(expr.b)})`;
            case 'bitOr':
                return `(${this.exprToCode(expr.a)}|${this.exprToCode(expr.b)})`;
            case 'bitXor':
                return `(${this.exprToCode(expr.a)}^${this.exprToCode(expr.b)})`;
            case 'shl':
                return `(${this.exprToCode(expr.a)}<<${this.exprToCode(expr.b)})`;
            case 'shr':
                return `(${this.exprToCode(expr.a)}>>${this.exprToCode(expr.b)})`;
            case 'ushr':
                return `(${this.exprToCode(expr.a)}>>>${this.exprToCode(expr.b)})`;
            case 'method': {
                const obj = this.exprToCode(expr.obj);
                const args = expr.args.map(a => this.exprToCode(a)).join(',');
                // Wrap in parens if obj is a literal number (e.g. 0.toString() is invalid, (0).toString() is valid)
                const needsParens = expr.obj.kind === 'lit' && typeof expr.obj.value === 'number';
                return needsParens ? `(${obj}).${expr.method}(${args})` : `${obj}.${expr.method}(${args})`;
            }
            case 'map': {
                const arr = this.exprToCode(expr.arr);
                const body = this.blockToCode(expr.body);
                // Check if body is simple (just a return expression, no statements)
                if (expr.body.stmts.length === 0 && expr.body.returnExpr) {
                    const returnCode = this.exprToCode(expr.body.returnExpr);
                    const needsParens = returnCode.startsWith('{');
                    const wrapped = needsParens ? `(${returnCode})` : returnCode;
                    // Check if index is used
                    const indexUsed = returnCode.includes(`v${expr.indexId}`);
                    const params = indexUsed ? `(v${expr.elemId},v${expr.indexId})` : `v${expr.elemId}`;
                    return `${arr}.map(${params}=>${wrapped})`;
                }
                // Complex body - use function
                const params = `(v${expr.elemId},v${expr.indexId})`;
                return `${arr}.map(function${params}{${body}})`;
            }
            case 'subFn': {
                // Generate a helper function for better V8 optimization
                // This follows the Typia pattern: const _fn_N = (v0) => body;
                const fnName = `_fn_${expr.fnId}`;
                if (!this.helperFunctions.has(expr.fnId)) {
                    // Generate the body code with v0 as the input
                    // Note: body expression uses input(0) to refer to the arg
                    const bodyCode = this.exprToCode(expr.body);
                    this.helperFunctions.set(expr.fnId, `function ${fnName}(v0){return ${bodyCode};}`);
                }
                return `${fnName}(${this.exprToCode(expr.arg)})`;
            }
        }
    }

    private litToCode(value: any): string {
        if (value === null) return 'null';
        if (value === undefined) return 'undefined';
        if (typeof value === 'boolean') return String(value);
        if (typeof value === 'number') {
            if (Number.isNaN(value)) return 'NaN';
            if (value === Infinity) return 'Infinity';
            if (value === -Infinity) return '-Infinity';
            if (Object.is(value, -0)) return '(-0)';
            return String(value);
        }
        if (typeof value === 'bigint') return `${value}n`;
        if (typeof value === 'string') return JSON.stringify(value);
        // Complex values use external reference
        return this.addExternal(value, 'const');
    }

    private stmtToCode(stmt: Stmt): string {
        const ind = this.indent;
        switch (stmt.kind) {
            case 'let': {
                // Register variable name if provided
                if (stmt.name) {
                    this.varNames.set(stmt.id, stmt.name);
                }
                return `${ind}var ${this.varName(stmt.id)}=${this.exprToCode(stmt.expr)};\n`;
            }
            case 'set': {
                const obj = this.exprToCode(stmt.obj);
                const value = this.exprToCode(stmt.value);
                if (typeof stmt.key === 'string') {
                    if (isValidIdentifier(stmt.key)) {
                        return `${ind}${obj}.${stmt.key}=${value};\n`;
                    }
                    return `${ind}${obj}[${JSON.stringify(stmt.key)}]=${value};\n`;
                }
                return `${ind}${obj}[${this.exprToCode(stmt.key)}]=${value};\n`;
            }
            case 'push':
                return `${ind}${this.exprToCode(stmt.arr)}.push(${this.exprToCode(stmt.value)});\n`;
            case 'setVar': {
                const varName = this.varName(stmt.id);
                const value = stmt.value;
                // Detect compound assignment patterns: x = x op y → x op= y
                if (
                    value.kind === 'add' ||
                    value.kind === 'sub' ||
                    value.kind === 'mul' ||
                    value.kind === 'div' ||
                    value.kind === 'mod' ||
                    value.kind === 'bitAnd' ||
                    value.kind === 'bitOr' ||
                    value.kind === 'bitXor' ||
                    value.kind === 'shl' ||
                    value.kind === 'shr' ||
                    value.kind === 'ushr'
                ) {
                    const binOp = value as { a: Expr; b: Expr };
                    // Check if left side is the same variable
                    if (binOp.a.kind === 'var' && binOp.a.id === stmt.id) {
                        // Check for increment/decrement: x = x + 1 → x++ or x = x - 1 → x--
                        if (binOp.b.kind === 'lit' && binOp.b.value === 1) {
                            if (value.kind === 'add') return `${ind}${varName}++;\n`;
                            if (value.kind === 'sub') return `${ind}${varName}--;\n`;
                        }
                        // Compound assignment: x = x + y → x += y
                        const opMap: Record<string, string> = {
                            add: '+=',
                            sub: '-=',
                            mul: '*=',
                            div: '/=',
                            mod: '%=',
                            bitAnd: '&=',
                            bitOr: '|=',
                            bitXor: '^=',
                            shl: '<<=',
                            shr: '>>=',
                            ushr: '>>>=',
                        };
                        const op = opMap[value.kind];
                        if (op) {
                            return `${ind}${varName}${op}${this.exprToCode(binOp.b)};\n`;
                        }
                    }
                }
                return `${ind}${varName}=${this.exprToCode(value)};\n`;
            }
            case 'exec':
                return `${ind}${this.exprToCode(stmt.expr)};\n`;
            case 'return':
                return stmt.value ? `${ind}return ${this.exprToCode(stmt.value)};\n` : `${ind}return;\n`;
            case 'throw':
                return `${ind}throw ${this.exprToCode(stmt.error)};\n`;
            case 'if': {
                this.indentLevel++;
                const thenCode = this.blockToCode(stmt.then);
                let elseCode = '';
                if (stmt.else && (stmt.else.stmts.length > 0 || stmt.else.returnExpr)) {
                    elseCode = this.blockToCode(stmt.else);
                }
                this.indentLevel--;
                let code = `${ind}if(${this.exprToCode(stmt.cond)}){\n${thenCode}${ind}}`;
                if (elseCode) {
                    code += `else{\n${elseCode}${ind}}`;
                }
                return code + '\n';
            }
            case 'loop': {
                // Register variable names if provided
                if (stmt.elemName) this.varNames.set(stmt.elemId, stmt.elemName);
                if (stmt.indexName) this.varNames.set(stmt.indexId, stmt.indexName);
                const indexName = this.varName(stmt.indexId);
                this.indentLevel++;
                const bodyCode = this.blockToCode(stmt.body);
                this.indentLevel--;

                // Determine start expression (default: 0)
                const startCode = stmt.start ? this.exprToCode(stmt.start) : '0';
                // Determine end expression (default: arr.length)
                const endCode = stmt.end ? this.exprToCode(stmt.end) : `${this.exprToCode(stmt.arr!)}.length`;
                const endName = `${indexName}_end`;

                // Generate element access if arr provided and not skipped
                let elemDecl = '';
                if (stmt.arr && !stmt.skipElem) {
                    const arrCode = this.exprToCode(stmt.arr);
                    elemDecl = `${ind}${this.indentStr}var ${this.varName(stmt.elemId)}=${arrCode}[${indexName}];\n`;
                }

                return `${ind}for(var ${indexName}=${startCode},${endName}=${endCode};${indexName}<${endName};${indexName}++){\n${elemDecl}${bodyCode}${ind}}\n`;
            }
            case 'forIn': {
                // Register variable name if provided
                if (stmt.keyName) this.varNames.set(stmt.keyId, stmt.keyName);
                const obj = this.exprToCode(stmt.obj);
                const keyName = this.varName(stmt.keyId);
                this.indentLevel++;
                const bodyCode = this.blockToCode(stmt.body);
                this.indentLevel--;
                return `${ind}for(var ${keyName} in ${obj}){\n${bodyCode}${ind}}\n`;
            }
            case 'forOf': {
                // Register variable names if provided
                if (stmt.valueName) this.varNames.set(stmt.valueId, stmt.valueName);
                if (stmt.keyId !== undefined && stmt.keyName) this.varNames.set(stmt.keyId, stmt.keyName);
                const iterable = this.exprToCode(stmt.iterable);
                this.indentLevel++;
                const bodyCode = this.blockToCode(stmt.body);
                this.indentLevel--;
                // For Map entries with keyId, destructure [key, value]
                if (stmt.keyId !== undefined) {
                    const keyName = this.varName(stmt.keyId);
                    const valueName = this.varName(stmt.valueId);
                    return `${ind}for(var [${keyName},${valueName}] of ${iterable}){\n${bodyCode}${ind}}\n`;
                }
                // For Set or simple iteration
                const valueName = this.varName(stmt.valueId);
                return `${ind}for(var ${valueName} of ${iterable}){\n${bodyCode}${ind}}\n`;
            }
            case 'switch': {
                let code = `${ind}switch(${this.exprToCode(stmt.value)}){\n`;
                this.indentLevel++;
                for (const [literal, block] of stmt.cases) {
                    const litCode = typeof literal === 'string' ? JSON.stringify(literal) : String(literal);
                    this.indentLevel++;
                    const blockCode = this.blockToCode(block);
                    this.indentLevel--;
                    code += `${this.indent}case ${litCode}:{\n${blockCode}${this.indent}break;}\n`;
                }
                if (stmt.default) {
                    this.indentLevel++;
                    const defaultCode = this.blockToCode(stmt.default);
                    this.indentLevel--;
                    code += `${this.indent}default:{\n${defaultCode}${this.indent}break;}\n`;
                }
                this.indentLevel--;
                return code + `${ind}}\n`;
            }
            case 'while': {
                this.indentLevel++;
                const bodyCode = this.blockToCode(stmt.body);
                this.indentLevel--;
                return `${ind}while(${this.exprToCode(stmt.cond)}){\n${bodyCode}${ind}}\n`;
            }
            case 'break':
                return `${ind}break;\n`;
            case 'continue':
                return `${ind}continue;\n`;
        }
    }

    private blockToCode(block: Block): string {
        let code = '';
        for (const stmt of block.stmts) {
            code += this.stmtToCode(stmt);
        }
        if (block.returnExpr) {
            code += `return ${this.exprToCode(block.returnExpr)};\n`;
        }
        return code;
    }

    /**
     * Compile a nested function definition into a code string.
     * Uses a child CodeGenerator that shares externals/reservedNames with the parent.
     */
    private compileNestedFn(id: number, def: NestedFnDef): string {
        const childGen = new CodeGenerator(def.inputNames.length, def.inputNames, {
            externals: this.externals,
            reservedNames: this.reservedNames,
        });

        // Recursively compile any nested functions within this nested function
        let childNestedDefs = '';
        if (def.block.nestedFunctions) {
            for (const [nid, ndef] of def.block.nestedFunctions) {
                childNestedDefs += childGen.compileNestedFn(nid, ndef);
            }
        }

        const innerBody = childGen.blockToCode(def.block);

        // Merge helper functions from child into parent
        for (const [fnId, code] of childGen.helperFunctions) {
            this.helperFunctions.set(fnId, code);
        }

        const argNames = def.inputNames.join(',');
        return `${childNestedDefs}function _nfn_${id}(${argNames}){\n${innerBody}}\n`;
    }

    compile<T>(block: Block): T {
        // Compile nested function definitions first (they may add externals)
        let nestedDefs = '';
        if (block.nestedFunctions) {
            for (const [id, def] of block.nestedFunctions) {
                nestedDefs += this.compileNestedFn(id, def);
            }
        }

        const body = this.blockToCode(block);

        // Build argument list with defaults (e.g., "buffer,offset=0")
        const argNames = this.inputNames
            .map((name, i) => {
                const def = this.inputDefaults[i];
                return def !== undefined ? `${name}=${def}` : name;
            })
            .join(',');

        // Collect externals AFTER generating all code (nested fns may have added externals)
        const externNames = [...this.externals.values()];
        const externValues = [...this.externals.keys()];

        // Place nested functions and helpers at the new Function() scope level (no IIFE).
        // V8 TurboFan generates 2.6x worse machine code when the main function is inside
        // an IIFE closure, even with identical inner functions (168M → 65M for int32x3).
        let fnBody: string;
        if (nestedDefs || this.helperFunctions.size > 0) {
            const helpers = [...this.helperFunctions.values()].join('');
            fnBody = `${nestedDefs}${helpers}return function(${argNames}){\n${body}}`;
        } else {
            fnBody = `return function(${argNames}){\n${body}}`;
        }

        if (jitDebug) {
            console.log('=== JIT2 Generated Code ===');
            console.log('Externs:', externNames);
            console.log('Body:\n' + fnBody);
            console.log('===========================\n');
        }

        const fn = new Function(...externNames, fnBody);
        return fn(...externValues) as T;
    }
}

/**
 * Create an optimized executor for a block.
 * Uses closure-based compilation for best performance.
 * Returns a function that accepts rest parameters and executes the block.
 */
function createExecutor<T>(block: Block): (...args: any[]) => T {
    return createClosureExecutor<T>(block);
}

// ============================================================================
// Builder - Constructs Expression Trees
// ============================================================================

/**
 * Expression reference returned by builder methods.
 * This is a lightweight wrapper that just holds an Expr.
 */
export class Ref<T = any> {
    constructor(public readonly expr: Expr) {}

    /** Get property by key */
    get<K extends keyof T>(key: K): Ref<T[K]>;
    get(key: string | Ref<string>): Ref<any>;
    get(key: string | Ref<string>): Ref<any> {
        const keyExpr = typeof key === 'string' ? key : key.expr;
        return new Ref({ kind: 'get', obj: this.expr, key: keyExpr });
    }

    /** Get array element by index */
    at(index: number | Ref<number>): Ref<any> {
        const indexExpr = typeof index === 'number' ? index : index.expr;
        return new Ref({ kind: 'at', arr: this.expr, index: indexExpr });
    }

    /** Get length */
    len(): Ref<number> {
        return new Ref({ kind: 'len', value: this.expr });
    }
}

/**
 * Mutable variable reference
 */
export class VarRef<T = any> {
    constructor(
        public readonly id: number,
        public readonly name?: string,
    ) {}
}

/**
 * Builder for constructing expression trees.
 * Single unified API for both JIT and Exec modes.
 */
export class Builder {
    private nextId: number;
    private stmts: Stmt[] = [];
    private stmtStack: Stmt[][] = [];
    readonly argCount: number;

    constructor(argCount: number) {
        this.argCount = argCount;
        this.nextId = argCount; // Reserve IDs 0..argCount-1 for inputs
    }

    private allocId(): number {
        return this.nextId++;
    }

    private pushStmt(stmt: Stmt): void {
        this.stmts.push(stmt);
    }

    private saveStmts(): void {
        this.stmtStack.push(this.stmts);
        this.stmts = [];
    }

    private restoreStmts(): Stmt[] {
        const saved = this.stmts;
        this.stmts = this.stmtStack.pop()!;
        return saved;
    }

    // ========== Input Access ==========

    /** Get input argument by index */
    input(index: number): Ref {
        return new Ref({ kind: 'input', index });
    }

    // ========== Literals & Values ==========

    /** Create a literal value */
    lit<T>(value: T): Ref<T> {
        return new Ref({ kind: 'lit', value });
    }

    /** Create an empty object */
    emptyObj<T extends object = any>(): Ref<T> {
        return new Ref({ kind: 'obj', entries: [] });
    }

    /** Create an empty array */
    emptyArr<T = any>(): Ref<T[]> {
        return new Ref({ kind: 'arr', elements: [] });
    }

    /** Create object from entries */
    obj<T extends object = any>(entries: Record<string, Ref> | Array<[string | Ref<string>, Ref]>): Ref<T> {
        const entryList: [string | Expr, Expr][] = Array.isArray(entries)
            ? entries.map(([k, v]) => [typeof k === 'string' ? k : k.expr, v.expr])
            : Object.entries(entries).map(([k, v]) => [k, v.expr]);
        return new Ref({ kind: 'obj', entries: entryList });
    }

    /** Create array from elements */
    arr<T>(...elements: Ref<T>[]): Ref<T[]> {
        return new Ref({ kind: 'arr', elements: elements.map(e => e.expr) });
    }

    // ========== Property Access ==========

    /** Get property */
    get<T>(obj: Ref, key: string | Ref<string>): Ref<T> {
        return obj.get(key) as Ref<T>;
    }

    /** Set property (statement) */
    set(obj: Ref, key: string | Ref<string>, value: Ref): void {
        this.pushStmt({
            kind: 'set',
            obj: obj.expr,
            key: typeof key === 'string' ? key : key.expr,
            value: value.expr,
        });
    }

    /** Check if key exists in object */
    has(obj: Ref, key: string | Ref<string>): Ref<boolean> {
        return new Ref({
            kind: 'has',
            obj: obj.expr,
            key: typeof key === 'string' ? key : key.expr,
        });
    }

    /** Get array element by index */
    at<T>(arr: Ref, index: number | Ref<number>): Ref<T> {
        return arr.at(index) as Ref<T>;
    }

    /** Get length of array or string */
    len(value: Ref): Ref<number> {
        return value.len();
    }

    // ========== Array Operations ==========

    /** Push element to array (statement) */
    push(arr: Ref, value: Ref): void {
        this.pushStmt({ kind: 'push', arr: arr.expr, value: value.expr });
    }

    /** Map over array */
    map<T>(arr: Ref, fn: (elem: Ref, idx: Ref<number>) => Ref<T>): Ref<T[]> {
        const elemId = this.allocId();
        const indexId = this.allocId();

        this.saveStmts();
        const result = fn(new Ref({ kind: 'var', id: elemId }), new Ref({ kind: 'var', id: indexId }));
        const bodyStmts = this.restoreStmts();

        const block: Block = { stmts: bodyStmts, returnExpr: result.expr };
        return new Ref({ kind: 'map', arr: arr.expr, elemId, indexId, body: block });
    }

    // ========== Function Calls ==========

    /** Call a function */
    call<T>(fn: Function, ...args: Ref[]): Ref<T> {
        return new Ref({ kind: 'call', fn, args: args.map(a => a.expr) });
    }

    /** Construct a new instance */
    new_<T>(ctor: new (...args: any[]) => T, ...args: Ref[]): Ref<T> {
        return new Ref({ kind: 'new', ctor, args: args.map(a => a.expr) });
    }

    // ========== Variable Binding ==========

    /** Bind expression to a variable (emits let statement) */
    let<T>(expr: Ref<T>, name?: string): Ref<T> {
        const id = this.allocId();
        this.pushStmt({ kind: 'let', id, expr: expr.expr, name });
        return new Ref({ kind: 'var', id, name });
    }

    /** Create a mutable variable */
    var_<T>(initial: T | Ref<T>, name?: string): VarRef<T> {
        const id = this.allocId();
        const initialExpr = initial instanceof Ref ? initial.expr : { kind: 'lit' as const, value: initial };
        this.pushStmt({ kind: 'let', id, expr: initialExpr, name });
        return new VarRef(id, name);
    }

    /** Set mutable variable value */
    setVar<T>(ref: VarRef<T>, value: Ref<T>): void {
        this.pushStmt({ kind: 'setVar', id: ref.id, value: value.expr });
    }

    /** Get mutable variable value */
    getVar<T>(ref: VarRef<T>): Ref<T> {
        return new Ref({ kind: 'var', id: ref.id, name: ref.name });
    }

    // ========== Comparisons ==========

    /** Strict equality (===) */
    eq(a: Ref, b: Ref): Ref<boolean> {
        return new Ref({ kind: 'eq', a: a.expr, b: b.expr });
    }

    /** Strict inequality (!==) */
    neq(a: Ref, b: Ref): Ref<boolean> {
        return new Ref({ kind: 'neq', a: a.expr, b: b.expr });
    }

    /** Less than (<) */
    lt(a: Ref, b: Ref): Ref<boolean> {
        return new Ref({ kind: 'lt', a: a.expr, b: b.expr });
    }

    /** Greater than (>) */
    gt(a: Ref, b: Ref): Ref<boolean> {
        return new Ref({ kind: 'gt', a: a.expr, b: b.expr });
    }

    /** Less than or equal (<=) */
    lte(a: Ref, b: Ref): Ref<boolean> {
        return new Ref({ kind: 'lte', a: a.expr, b: b.expr });
    }

    /** Greater than or equal (>=) */
    gte(a: Ref, b: Ref): Ref<boolean> {
        return new Ref({ kind: 'gte', a: a.expr, b: b.expr });
    }

    // ========== Arithmetic Operations ==========

    /** Addition (a + b) */
    add(a: Ref<number>, b: Ref<number>): Ref<number> {
        return new Ref({ kind: 'add', a: a.expr, b: b.expr });
    }

    /** Subtraction (a - b) */
    sub(a: Ref<number>, b: Ref<number>): Ref<number> {
        return new Ref({ kind: 'sub', a: a.expr, b: b.expr });
    }

    /** Multiplication (a * b) */
    mul(a: Ref<number>, b: Ref<number>): Ref<number> {
        return new Ref({ kind: 'mul', a: a.expr, b: b.expr });
    }

    /** Division (a / b) */
    div(a: Ref<number>, b: Ref<number>): Ref<number> {
        return new Ref({ kind: 'div', a: a.expr, b: b.expr });
    }

    /** Modulo (a % b) */
    mod(a: Ref<number>, b: Ref<number>): Ref<number> {
        return new Ref({ kind: 'mod', a: a.expr, b: b.expr });
    }

    // ========== Bitwise Operations ==========

    /** Bitwise AND (a & b) */
    bitAnd(a: Ref<number>, b: Ref<number>): Ref<number> {
        return new Ref({ kind: 'bitAnd', a: a.expr, b: b.expr });
    }

    /** Bitwise OR (a | b) */
    bitOr(a: Ref<number>, b: Ref<number>): Ref<number> {
        return new Ref({ kind: 'bitOr', a: a.expr, b: b.expr });
    }

    /** Bitwise XOR (a ^ b) */
    bitXor(a: Ref<number>, b: Ref<number>): Ref<number> {
        return new Ref({ kind: 'bitXor', a: a.expr, b: b.expr });
    }

    /** Left shift (a << b) */
    shl(a: Ref<number>, b: Ref<number>): Ref<number> {
        return new Ref({ kind: 'shl', a: a.expr, b: b.expr });
    }

    /** Right shift (a >> b) */
    shr(a: Ref<number>, b: Ref<number>): Ref<number> {
        return new Ref({ kind: 'shr', a: a.expr, b: b.expr });
    }

    /** Unsigned right shift (a >>> b) */
    ushr(a: Ref<number>, b: Ref<number>): Ref<number> {
        return new Ref({ kind: 'ushr', a: a.expr, b: b.expr });
    }

    // ========== Method Calls ==========

    /** Call method on object: obj.method(args...) */
    method<T>(obj: Ref, method: string, ...args: Ref[]): Ref<T> {
        return new Ref({ kind: 'method', obj: obj.expr, method, args: args.map(a => a.expr) });
    }

    // ========== Logical Operations ==========

    /** Logical NOT (!) */
    not(a: Ref): Ref<boolean> {
        return new Ref({ kind: 'not', a: a.expr });
    }

    /** Logical AND (&&) */
    and(a: Ref, b: Ref): Ref<boolean> {
        return new Ref({ kind: 'and', a: a.expr, b: b.expr });
    }

    /** Logical OR (||) */
    or(a: Ref, b: Ref): Ref<boolean> {
        return new Ref({ kind: 'or', a: a.expr, b: b.expr });
    }

    /** Nullish coalescing (??) */
    nullish<T>(a: Ref<T>, b: Ref<T>): Ref<T> {
        return new Ref({ kind: 'nullish', a: a.expr, b: b.expr });
    }

    // ========== Type Checks ==========

    /** typeof operator */
    typeof_(value: Ref): Ref<string> {
        return new Ref({ kind: 'typeof', value: value.expr });
    }

    /** typeof === type check */
    isType(value: Ref, type: string): Ref<boolean> {
        return new Ref({ kind: 'isType', value: value.expr, type });
    }

    /** value === null */
    isNull(value: Ref): Ref<boolean> {
        return new Ref({ kind: 'isNull', value: value.expr });
    }

    /** value == null (null or undefined) */
    isNullish(value: Ref): Ref<boolean> {
        return new Ref({ kind: 'isNullish', value: value.expr });
    }

    /** value instanceof ctor */
    isInstance(value: Ref, ctor: Function): Ref<boolean> {
        return new Ref({ kind: 'instanceof', value: value.expr, ctor });
    }

    // ========== Control Flow ==========

    /** Conditional (if/else) */
    if_(cond: Ref<boolean>, then: () => Ref | void, else_?: () => Ref | void): void {
        this.saveStmts();
        const thenResult = then();
        const thenStmts = this.restoreStmts();
        const thenBlock: Block = { stmts: thenStmts };
        if (thenResult !== undefined) {
            thenBlock.stmts.push({ kind: 'return', value: thenResult.expr });
        }

        let elseBlock: Block | undefined;
        if (else_) {
            this.saveStmts();
            const elseResult = else_();
            const elseStmts = this.restoreStmts();
            if (elseStmts.length > 0 || elseResult !== undefined) {
                elseBlock = { stmts: elseStmts };
                if (elseResult !== undefined) {
                    elseBlock.stmts.push({ kind: 'return', value: elseResult.expr });
                }
            }
        }

        this.pushStmt({ kind: 'if', cond: cond.expr, then: thenBlock, else: elseBlock });
    }

    /** Ternary expression (cond ? then : else) */
    ternary<T>(cond: Ref<boolean>, then: Ref<T>, else_: Ref<T>): Ref<T> {
        return new Ref({ kind: 'ternary', cond: cond.expr, then: then.expr, else: else_.expr });
    }

    /** Loop over array with element and index */
    loop(arr: Ref, fn: (elem: Ref, idx: Ref<number>) => void, names?: { elem?: string; index?: string }): void {
        const elemId = this.allocId();
        const indexId = this.allocId();

        this.saveStmts();
        fn(
            new Ref({ kind: 'var', id: elemId, name: names?.elem }),
            new Ref({ kind: 'var', id: indexId, name: names?.index }),
        );
        const bodyStmts = this.restoreStmts();

        // Store variable names in LoopStmt for use by code generator
        this.pushStmt({
            kind: 'loop',
            arr: arr.expr,
            elemId,
            indexId,
            body: { stmts: bodyStmts },
            elemName: names?.elem,
            indexName: names?.index,
        });
    }

    /** Loop over array with index only (no element variable generated) */
    loopIdx(arr: Ref, fn: (idx: Ref<number>, arr: Ref) => void, indexName?: string): void {
        const elemId = this.allocId(); // Still allocate but won't be used
        const indexId = this.allocId();

        this.saveStmts();
        fn(new Ref({ kind: 'var', id: indexId, name: indexName }), arr);
        const bodyStmts = this.restoreStmts();

        this.pushStmt({
            kind: 'loop',
            arr: arr.expr,
            elemId,
            indexId,
            body: { stmts: bodyStmts },
            indexName,
            skipElem: true,
        });
    }

    /**
     * Range-based for loop: for(i=start; i<end; i++)
     * Optionally provide an array to access elements from: arr[i]
     */
    forRange(
        start: Ref<number>,
        end: Ref<number>,
        fn: (idx: Ref<number>, elem?: Ref) => void,
        options?: { arr?: Ref; indexName?: string; elemName?: string },
    ): void {
        const indexId = this.allocId();
        const elemId = this.allocId();

        this.saveStmts();
        const idxRef = new Ref<number>({ kind: 'var', id: indexId, name: options?.indexName });
        const elemRef = options?.arr ? new Ref({ kind: 'var', id: elemId, name: options?.elemName }) : undefined;
        fn(idxRef, elemRef);
        const bodyStmts = this.restoreStmts();

        this.pushStmt({
            kind: 'loop',
            start: start.expr,
            end: end.expr,
            indexId,
            elemId,
            body: { stmts: bodyStmts },
            indexName: options?.indexName,
            arr: options?.arr?.expr,
            elemName: options?.elemName,
            skipElem: !options?.arr,
        });
    }

    /** Loop over object keys */
    forIn(obj: Ref, fn: (key: Ref<string>, value: Ref) => void, keyName?: string): void {
        const keyId = this.allocId();

        this.saveStmts();
        const keyRef = new Ref<string>({ kind: 'var', id: keyId, name: keyName });
        fn(keyRef, new Ref({ kind: 'get', obj: obj.expr, key: { kind: 'var', id: keyId, name: keyName } }));
        const bodyStmts = this.restoreStmts();

        this.pushStmt({ kind: 'forIn', obj: obj.expr, keyId, body: { stmts: bodyStmts }, keyName });
    }

    /**
     * Loop over an iterable (Set, Map entries, arrays).
     * For Map iteration, pass iterable as map (not map.entries()) - the callback receives [key, value].
     * For Set iteration, the callback receives just the value.
     */
    forOf<V>(iterable: Ref<Iterable<V>>, fn: (value: Ref<V>) => void, valueName?: string): void;
    forOf<K, V>(
        iterable: Ref<Map<K, V>>,
        fn: (key: Ref<K>, value: Ref<V>) => void,
        keyName?: string,
        valueName?: string,
    ): void;
    forOf(
        iterable: Ref,
        fn: ((value: Ref) => void) | ((key: Ref, value: Ref) => void),
        keyOrValueName?: string,
        valueName?: string,
    ): void {
        const valueId = this.allocId();
        // Check if fn expects 2 arguments (key, value) for Map iteration
        const isMapIteration = fn.length === 2;

        if (isMapIteration) {
            const keyId = this.allocId();
            this.saveStmts();
            const keyRef = new Ref({ kind: 'var', id: keyId, name: keyOrValueName });
            const valueRef = new Ref({ kind: 'var', id: valueId, name: valueName });
            (fn as (key: Ref, value: Ref) => void)(keyRef, valueRef);
            const bodyStmts = this.restoreStmts();
            this.pushStmt({
                kind: 'forOf',
                iterable: iterable.expr,
                valueId,
                keyId,
                body: { stmts: bodyStmts },
                keyName: keyOrValueName,
                valueName,
            });
        } else {
            this.saveStmts();
            const valueRef = new Ref({ kind: 'var', id: valueId, name: keyOrValueName });
            (fn as (value: Ref) => void)(valueRef);
            const bodyStmts = this.restoreStmts();
            this.pushStmt({
                kind: 'forOf',
                iterable: iterable.expr,
                valueId,
                body: { stmts: bodyStmts },
                valueName: keyOrValueName,
            });
        }
    }

    /** Switch statement */
    switch_<T>(value: Ref, cases: Array<[any, () => Ref<T> | void]>, defaultCase?: () => Ref<T> | void): void {
        const caseBlocks: [any, Block][] = [];

        for (const [literal, body] of cases) {
            this.saveStmts();
            const result = body();
            const stmts = this.restoreStmts();
            const block: Block = { stmts };
            if (result !== undefined) {
                block.stmts.push({ kind: 'return', value: result.expr });
            }
            caseBlocks.push([literal, block]);
        }

        let defaultBlock: Block | undefined;
        if (defaultCase) {
            this.saveStmts();
            const result = defaultCase();
            const stmts = this.restoreStmts();
            defaultBlock = { stmts };
            if (result !== undefined) {
                defaultBlock.stmts.push({ kind: 'return', value: result.expr });
            }
        }

        this.pushStmt({ kind: 'switch', value: value.expr, cases: caseBlocks, default: defaultBlock });
    }

    /** While loop */
    while_(cond: Ref<boolean>, body: () => void): void {
        this.saveStmts();
        body();
        const bodyStmts = this.restoreStmts();
        this.pushStmt({ kind: 'while', cond: cond.expr, body: { stmts: bodyStmts } });
    }

    /** Break out of enclosing while loop */
    break_(): void {
        this.pushStmt({ kind: 'break' });
    }

    /** Continue to next iteration of enclosing while loop */
    continue_(): void {
        this.pushStmt({ kind: 'continue' });
    }

    /** Multiple condition chain (if/else if/else) */
    cond(cases: Array<[Ref<boolean>, () => Ref | void]>, else_?: () => Ref | void): void {
        if (cases.length === 0) return;

        // Build from the end - each condition's else is the next condition
        let currentElse: Block | undefined;

        if (else_) {
            this.saveStmts();
            const result = else_();
            const stmts = this.restoreStmts();
            if (stmts.length > 0 || result !== undefined) {
                currentElse = { stmts };
                if (result !== undefined) {
                    currentElse.stmts.push({ kind: 'return', value: result.expr });
                }
            }
        }

        // Process conditions in reverse
        for (let i = cases.length - 1; i >= 0; i--) {
            const [cond, body] = cases[i];
            this.saveStmts();
            const result = body();
            const stmts = this.restoreStmts();
            const thenBlock: Block = { stmts };
            if (result !== undefined) {
                thenBlock.stmts.push({ kind: 'return', value: result.expr });
            }

            if (i === 0) {
                // First condition - emit the if statement
                this.pushStmt({ kind: 'if', cond: cond.expr, then: thenBlock, else: currentElse });
            } else {
                // Middle conditions - wrap in else block
                currentElse = { stmts: [{ kind: 'if', cond: cond.expr, then: thenBlock, else: currentElse }] };
            }
        }
    }

    // ========== Side Effects ==========

    /** Execute expression for side effects */
    exec(expr: Ref): void {
        this.pushStmt({ kind: 'exec', expr: expr.expr });
    }

    /** Return from the current function (void or with value) */
    return_(value?: Ref): void {
        this.pushStmt({ kind: 'return', value: value?.expr });
    }

    /** Throw an error */
    throw_(error: Ref): void {
        this.pushStmt({ kind: 'throw', error: error.expr });
    }

    // ========== String Operations ==========

    /** Concatenate strings */
    concat(...parts: Ref[]): Ref<string> {
        return new Ref({ kind: 'concat', parts: parts.map(p => p.expr) });
    }

    // ========== Nested Function Registration ==========

    /** Nested function definitions registered by child fn()/fnJIT() calls */
    private nestedFnDefs = new Map<number, NestedFnDef>();

    /**
     * Register a nested function definition. Called by fn()/fnJIT() when they detect
     * they're being called inside this Builder's body callback.
     * Returns a marker function that the CodeGenerator will recognize.
     */
    registerNestedFn(block: Block, inputNames: string[]): any {
        const id = _globalFnId++;
        this.nestedFnDefs.set(id, { block, inputNames });
        // Return a callable marker:
        // - In JIT mode, CodeGenerator detects __nestedFnId and emits a call to _nfn_N
        // - In Exec mode, the executor calls this function directly (closure-based fallback)
        const marker = createExecutor(block) as any;
        marker.__nestedFnId = id;
        return marker;
    }

    // ========== Helper Functions ==========

    /**
     * Create a helper function for better V8 optimization.
     * This follows the Typia pattern of extracting nested checks into separate functions.
     *
     * @param arg The argument to pass to the helper function
     * @param bodyFn A function that builds the body using the helper's input (input(0))
     * @returns A reference to the result of calling the helper function
     *
     * @example
     * // Instead of inlining nested object checks:
     * const nestedCheck = b.and(b.isType(input.get('foo'), 'string'), ...);
     *
     * // Use a helper function:
     * const nestedCheck = b.subFn(input.get('nested'), (b2, nestedInput) => {
     *     return b2.and(b2.isType(nestedInput.get('foo'), 'string'), ...);
     * });
     */
    subFn<T>(arg: Ref, bodyFn: (b: Builder, input: Ref) => Ref<T>): Ref<T> {
        const fnId = _globalFnId++;
        // Build the body with a fresh builder (1 arg for the input)
        const innerBuilder = new Builder(1);
        const innerInput = innerBuilder.input(0);
        const bodyResult = bodyFn(innerBuilder, innerInput);
        // Extract just the return expression - we only support simple expression bodies
        const bodyExpr = bodyResult.expr;
        return new Ref({
            kind: 'subFn',
            arg: arg.expr,
            body: bodyExpr,
            fnId,
        });
    }

    // ========== Build ==========

    /** Build the block (for internal use) */
    build(returnExpr?: Ref): Block {
        return {
            stmts: this.stmts,
            returnExpr: returnExpr?.expr,
            nestedFunctions: this.nestedFnDefs.size > 0 ? new Map(this.nestedFnDefs) : undefined,
        };
    }
}

// ============================================================================
// Public API
// ============================================================================

/** Marker type for function arguments */
export type Arg<T> = { __brand: 'arg'; __type?: T; name?: string; defaultValue?: string };

/** Declare a function argument with its type and optional name */
export function arg<T>(name?: string, defaultValue?: T): Arg<T> {
    // Convert default value to code string for JIT generation
    const defaultStr = defaultValue !== undefined ? JSON.stringify(defaultValue) : undefined;
    return { __brand: 'arg', name, defaultValue: defaultStr } as Arg<T>;
}

/**
 * Build a function using the unified expression tree.
 *
 * Uses tiered execution for optimal performance:
 * - First N calls (default 10): Exec mode (fast startup, no compilation)
 * - After N calls: JIT compile and use optimized code
 *
 * In CSP environments where `new Function` is blocked, always uses Exec mode.
 */
export function fn<R>(...args: any[]): (...args: any[]) => R {
    const body = args.pop() as (b: Builder, ...inputs: Ref[]) => Ref<R> | void;
    const argCount = args.length;

    // Extract input names and defaults from arg() declarations
    const inputNames = args.map((a: Arg<any>, i: number) => a.name || `v${i}`);
    const inputDefaults = args.map((a: Arg<any>) => a.defaultValue);

    // Build the expression tree once
    const builder = new Builder(argCount);
    const prevActive = _activeBuilder;
    _activeBuilder = builder;
    const inputs = Array.from({ length: argCount }, (_, i) => builder.input(i));
    const result = body(builder, ...inputs);
    _activeBuilder = prevActive;
    const block = builder.build(result as Ref<R> | undefined);

    // If called inside another fn()/fnJIT(), register as nested function definition
    if (prevActive) {
        return prevActive.registerNestedFn(block, inputNames) as any;
    }

    // CSP environment - always use bytecode VM (or tree-walking fallback)
    if (!canJIT) {
        return createExecutor<R>(block) as any;
    }

    // Immediate JIT if threshold is 0
    if (jitThreshold === 0) {
        const gen = new CodeGenerator(argCount, inputNames, undefined, inputDefaults);
        return gen.compile<(...args: any[]) => R>(block);
    }

    // Tiered execution: bytecode VM first, then JIT compile after threshold
    let callCount = 0;
    let compiledFn: ((...args: any[]) => R) | null = null;
    const executor = createExecutor<R>(block);

    return ((...runtimeArgs: any[]) => {
        if (compiledFn) {
            return compiledFn(...runtimeArgs);
        }

        callCount++;

        if (callCount >= jitThreshold) {
            const gen = new CodeGenerator(argCount, inputNames, undefined, inputDefaults);
            compiledFn = gen.compile<(...args: any[]) => R>(block);
            return compiledFn(...runtimeArgs);
        }

        return executor(...runtimeArgs);
    }) as any;
}

/**
 * Force immediate JIT compilation, bypassing tiered execution.
 *
 * WARNING: This will throw in CSP environments where `new Function()` is blocked.
 */
export function fnJIT<R>(...args: any[]): (...args: any[]) => R {
    const body = args.pop() as (b: Builder, ...inputs: Ref[]) => Ref<R> | void;
    const argCount = args.length;

    // Extract input names and defaults from arg() declarations
    const inputNames = args.map((a: Arg<any>, i: number) => a.name || `v${i}`);
    const inputDefaults = args.map((a: Arg<any>) => a.defaultValue);

    const builder = new Builder(argCount);
    const prevActive = _activeBuilder;
    _activeBuilder = builder;
    const inputs = Array.from({ length: argCount }, (_, i) => builder.input(i));
    const result = body(builder, ...inputs);
    _activeBuilder = prevActive;
    const block = builder.build(result as Ref<R> | undefined);

    // If called inside another fn()/fnJIT(), register as nested function definition
    if (prevActive) {
        return prevActive.registerNestedFn(block, inputNames) as any;
    }

    const gen = new CodeGenerator(argCount, inputNames, undefined, inputDefaults);
    return gen.compile<(...args: any[]) => R>(block);
}

/**
 * Force a separate JIT compilation unit, even when called inside another fn()/fnJIT().
 * Use this when a large function would poison V8 optimization of sibling functions
 * in the same IIFE scope.
 */
export function fnJITTop<R>(...args: any[]): (...args: any[]) => R {
    const body = args.pop() as (b: Builder, ...inputs: Ref[]) => Ref<R> | void;
    const argCount = args.length;
    const inputNames = args.map((a: Arg<any>, i: number) => a.name || `v${i}`);
    const inputDefaults = args.map((a: Arg<any>) => a.defaultValue);

    const builder = new Builder(argCount);
    // Suppress nesting: set _activeBuilder to this builder (not the parent)
    // but don't check prevActive for registration
    const prevActive = _activeBuilder;
    _activeBuilder = builder;
    const inputs = Array.from({ length: argCount }, (_, i) => builder.input(i));
    const result = body(builder, ...inputs);
    _activeBuilder = prevActive;
    const block = builder.build(result as Ref<R> | undefined);

    // Always create a separate compilation unit (never register as nested)
    const gen = new CodeGenerator(argCount, inputNames, undefined, inputDefaults);
    return gen.compile<(...args: any[]) => R>(block);
}

// ============================================================================
// Closure-Based Executor (Optimized Exec Mode)
// ============================================================================

/**
 * Compile an expression to a closure function.
 * The closure captures the structure and returns a function that evaluates it.
 *
 * Optimizations:
 * 1. Pure expressions (no vars) use simplified single-arg signature
 * 2. AND chains are flattened into arrays for fast short-circuit evaluation
 * 3. Common patterns like isType(get(x, key), type) are specialized
 */
type EvalFn = (args: any[], vars: any[]) => any;
type PureEvalFn = (args: any[]) => any;

/**
 * Check if an expression uses variables (needs vars array)
 */
function exprNeedsVars(expr: Expr): boolean {
    switch (expr.kind) {
        case 'var':
            return true;
        case 'lit':
        case 'input':
            return false;
        case 'get':
            return exprNeedsVars(expr.obj) || (typeof expr.key !== 'string' && exprNeedsVars(expr.key));
        case 'at':
            return exprNeedsVars(expr.arr) || (typeof expr.index !== 'number' && exprNeedsVars(expr.index));
        case 'call':
            return expr.args.some(exprNeedsVars);
        case 'new':
            return expr.args.some(exprNeedsVars);
        case 'obj':
            return expr.entries.some(([k, v]) => (typeof k !== 'string' && exprNeedsVars(k)) || exprNeedsVars(v));
        case 'arr':
            return expr.elements.some(exprNeedsVars);
        case 'eq':
        case 'neq':
        case 'lt':
        case 'gt':
        case 'lte':
        case 'gte':
        case 'and':
        case 'or':
        case 'nullish':
            return exprNeedsVars(expr.a) || exprNeedsVars(expr.b);
        case 'not':
            return exprNeedsVars(expr.a);
        case 'typeof':
        case 'isType':
        case 'isNull':
        case 'isNullish':
        case 'len':
        case 'instanceof':
            return exprNeedsVars(expr.value);
        case 'has':
            return exprNeedsVars(expr.obj) || (typeof expr.key !== 'string' && exprNeedsVars(expr.key));
        case 'ternary':
            return exprNeedsVars(expr.cond) || exprNeedsVars(expr.then) || exprNeedsVars(expr.else);
        case 'concat':
            return expr.parts.some(exprNeedsVars);
        case 'add':
        case 'sub':
        case 'mul':
        case 'div':
        case 'mod':
        case 'bitAnd':
        case 'bitOr':
        case 'bitXor':
        case 'shl':
        case 'shr':
        case 'ushr':
            return exprNeedsVars(expr.a) || exprNeedsVars(expr.b);
        case 'method':
            return exprNeedsVars(expr.obj) || expr.args.some(exprNeedsVars);
        case 'map':
            return true; // Map always uses vars
        case 'subFn':
            return exprNeedsVars(expr.arg) || exprNeedsVars(expr.body);
    }
}

/**
 * Flatten AND expressions into an array of operands for fast short-circuit evaluation.
 */
function flattenAnd(expr: Expr): Expr[] {
    if (expr.kind === 'and') {
        return [...flattenAnd(expr.a), ...flattenAnd(expr.b)];
    }
    return [expr];
}

/**
 * Compile a pure expression (no vars) to a single-arg closure.
 */
function compilePureExpr(expr: Expr): PureEvalFn {
    switch (expr.kind) {
        case 'lit': {
            const value = expr.value;
            return () => value;
        }
        case 'input': {
            const index = expr.index;
            return args => args[index];
        }
        case 'get': {
            const objFn = compilePureExpr(expr.obj);
            if (typeof expr.key === 'string') {
                const key = expr.key;
                return args => {
                    const obj = objFn(args);
                    return obj == null ? undefined : obj[key];
                };
            } else {
                const keyFn = compilePureExpr(expr.key);
                return args => {
                    const obj = objFn(args);
                    return obj == null ? undefined : obj[keyFn(args)];
                };
            }
        }
        case 'at': {
            const arrFn = compilePureExpr(expr.arr);
            if (typeof expr.index === 'number') {
                const idx = expr.index;
                return args => {
                    const arr = arrFn(args);
                    return arr == null ? undefined : arr[idx];
                };
            } else {
                const idxFn = compilePureExpr(expr.index);
                return args => {
                    const arr = arrFn(args);
                    return arr == null ? undefined : arr[idxFn(args)];
                };
            }
        }
        case 'call': {
            const fn = expr.fn;
            const argFns = expr.args.map(compilePureExpr);
            const len = argFns.length;
            if (len === 0) return () => fn();
            if (len === 1) {
                const a0 = argFns[0];
                return args => fn(a0(args));
            }
            if (len === 2) {
                const a0 = argFns[0],
                    a1 = argFns[1];
                return args => fn(a0(args), a1(args));
            }
            if (len === 3) {
                const a0 = argFns[0],
                    a1 = argFns[1],
                    a2 = argFns[2];
                return args => fn(a0(args), a1(args), a2(args));
            }
            return args => fn(...argFns.map(f => f(args)));
        }
        case 'new': {
            const ctor = expr.ctor;
            const argFns = expr.args.map(compilePureExpr);
            return args => new ctor(...argFns.map(f => f(args)));
        }
        case 'obj': {
            const entries = expr.entries.map(
                ([k, v]) => [typeof k === 'string' ? k : compilePureExpr(k), compilePureExpr(v)] as const,
            );
            return args => {
                const result: any = {};
                for (const [k, vFn] of entries) {
                    const key = typeof k === 'string' ? k : k(args);
                    result[key] = vFn(args);
                }
                return result;
            };
        }
        case 'arr': {
            const elemFns = expr.elements.map(compilePureExpr);
            return args => elemFns.map(f => f(args));
        }
        case 'eq': {
            const aFn = compilePureExpr(expr.a);
            const bFn = compilePureExpr(expr.b);
            return args => aFn(args) === bFn(args);
        }
        case 'neq': {
            const aFn = compilePureExpr(expr.a);
            const bFn = compilePureExpr(expr.b);
            return args => aFn(args) !== bFn(args);
        }
        case 'lt': {
            const aFn = compilePureExpr(expr.a);
            const bFn = compilePureExpr(expr.b);
            return args => aFn(args) < bFn(args);
        }
        case 'gt': {
            const aFn = compilePureExpr(expr.a);
            const bFn = compilePureExpr(expr.b);
            return args => aFn(args) > bFn(args);
        }
        case 'lte': {
            const aFn = compilePureExpr(expr.a);
            const bFn = compilePureExpr(expr.b);
            return args => aFn(args) <= bFn(args);
        }
        case 'gte': {
            const aFn = compilePureExpr(expr.a);
            const bFn = compilePureExpr(expr.b);
            return args => aFn(args) >= bFn(args);
        }
        case 'not': {
            const aFn = compilePureExpr(expr.a);
            return args => !aFn(args);
        }
        case 'and': {
            // Flatten AND chain for optimal short-circuit evaluation
            const operands = flattenAnd(expr);
            const fns = operands.map(compilePureExpr);
            const len = fns.length;
            // Unroll common cases for speed
            if (len === 2) {
                const f0 = fns[0],
                    f1 = fns[1];
                return args => f0(args) && f1(args);
            }
            if (len === 3) {
                const f0 = fns[0],
                    f1 = fns[1],
                    f2 = fns[2];
                return args => f0(args) && f1(args) && f2(args);
            }
            if (len === 4) {
                const f0 = fns[0],
                    f1 = fns[1],
                    f2 = fns[2],
                    f3 = fns[3];
                return args => f0(args) && f1(args) && f2(args) && f3(args);
            }
            if (len === 5) {
                const f0 = fns[0],
                    f1 = fns[1],
                    f2 = fns[2],
                    f3 = fns[3],
                    f4 = fns[4];
                return args => f0(args) && f1(args) && f2(args) && f3(args) && f4(args);
            }
            if (len === 6) {
                const f0 = fns[0],
                    f1 = fns[1],
                    f2 = fns[2],
                    f3 = fns[3],
                    f4 = fns[4],
                    f5 = fns[5];
                return args => f0(args) && f1(args) && f2(args) && f3(args) && f4(args) && f5(args);
            }
            if (len === 7) {
                const f0 = fns[0],
                    f1 = fns[1],
                    f2 = fns[2],
                    f3 = fns[3],
                    f4 = fns[4],
                    f5 = fns[5],
                    f6 = fns[6];
                return args => f0(args) && f1(args) && f2(args) && f3(args) && f4(args) && f5(args) && f6(args);
            }
            if (len === 8) {
                const f0 = fns[0],
                    f1 = fns[1],
                    f2 = fns[2],
                    f3 = fns[3],
                    f4 = fns[4],
                    f5 = fns[5],
                    f6 = fns[6],
                    f7 = fns[7];
                return args =>
                    f0(args) && f1(args) && f2(args) && f3(args) && f4(args) && f5(args) && f6(args) && f7(args);
            }
            if (len === 9) {
                const f0 = fns[0],
                    f1 = fns[1],
                    f2 = fns[2],
                    f3 = fns[3],
                    f4 = fns[4],
                    f5 = fns[5],
                    f6 = fns[6],
                    f7 = fns[7],
                    f8 = fns[8];
                return args =>
                    f0(args) &&
                    f1(args) &&
                    f2(args) &&
                    f3(args) &&
                    f4(args) &&
                    f5(args) &&
                    f6(args) &&
                    f7(args) &&
                    f8(args);
            }
            if (len === 10) {
                const f0 = fns[0],
                    f1 = fns[1],
                    f2 = fns[2],
                    f3 = fns[3],
                    f4 = fns[4],
                    f5 = fns[5],
                    f6 = fns[6],
                    f7 = fns[7],
                    f8 = fns[8],
                    f9 = fns[9];
                return args =>
                    f0(args) &&
                    f1(args) &&
                    f2(args) &&
                    f3(args) &&
                    f4(args) &&
                    f5(args) &&
                    f6(args) &&
                    f7(args) &&
                    f8(args) &&
                    f9(args);
            }
            // General case for >10 operands
            return args => {
                for (const fn of fns) {
                    if (!fn(args)) return false;
                }
                return true;
            };
        }
        case 'or': {
            const aFn = compilePureExpr(expr.a);
            const bFn = compilePureExpr(expr.b);
            return args => aFn(args) || bFn(args);
        }
        case 'nullish': {
            const aFn = compilePureExpr(expr.a);
            const bFn = compilePureExpr(expr.b);
            return args => aFn(args) ?? bFn(args);
        }
        case 'typeof': {
            const valueFn = compilePureExpr(expr.value);
            return args => typeof valueFn(args);
        }
        case 'isType': {
            const valueFn = compilePureExpr(expr.value);
            const type = expr.type;
            return args => typeof valueFn(args) === type;
        }
        case 'isNull': {
            const valueFn = compilePureExpr(expr.value);
            return args => valueFn(args) === null;
        }
        case 'isNullish': {
            const valueFn = compilePureExpr(expr.value);
            return args => valueFn(args) == null;
        }
        case 'has': {
            const objFn = compilePureExpr(expr.obj);
            if (typeof expr.key === 'string') {
                const key = expr.key;
                return args => key in objFn(args);
            } else {
                const keyFn = compilePureExpr(expr.key);
                return args => keyFn(args) in objFn(args);
            }
        }
        case 'len': {
            const valueFn = compilePureExpr(expr.value);
            return args => {
                const v = valueFn(args);
                return v == null ? 0 : v.length;
            };
        }
        case 'ternary': {
            const condFn = compilePureExpr(expr.cond);
            const thenFn = compilePureExpr(expr.then);
            const elseFn = compilePureExpr(expr.else);
            return args => (condFn(args) ? thenFn(args) : elseFn(args));
        }
        case 'instanceof': {
            const valueFn = compilePureExpr(expr.value);
            const ctor = expr.ctor;
            return args => valueFn(args) instanceof ctor;
        }
        case 'concat': {
            const partFns = expr.parts.map(compilePureExpr);
            return args => {
                let result = '';
                for (const fn of partFns) result += fn(args);
                return result;
            };
        }
        case 'add': {
            const aFn = compilePureExpr(expr.a);
            const bFn = compilePureExpr(expr.b);
            return args => aFn(args) + bFn(args);
        }
        case 'sub': {
            const aFn = compilePureExpr(expr.a);
            const bFn = compilePureExpr(expr.b);
            return args => aFn(args) - bFn(args);
        }
        case 'mul': {
            const aFn = compilePureExpr(expr.a);
            const bFn = compilePureExpr(expr.b);
            return args => aFn(args) * bFn(args);
        }
        case 'div': {
            const aFn = compilePureExpr(expr.a);
            const bFn = compilePureExpr(expr.b);
            return args => aFn(args) / bFn(args);
        }
        case 'mod': {
            const aFn = compilePureExpr(expr.a);
            const bFn = compilePureExpr(expr.b);
            return args => aFn(args) % bFn(args);
        }
        case 'bitAnd': {
            const aFn = compilePureExpr(expr.a);
            const bFn = compilePureExpr(expr.b);
            return args => aFn(args) & bFn(args);
        }
        case 'bitOr': {
            const aFn = compilePureExpr(expr.a);
            const bFn = compilePureExpr(expr.b);
            return args => aFn(args) | bFn(args);
        }
        case 'bitXor': {
            const aFn = compilePureExpr(expr.a);
            const bFn = compilePureExpr(expr.b);
            return args => aFn(args) ^ bFn(args);
        }
        case 'shl': {
            const aFn = compilePureExpr(expr.a);
            const bFn = compilePureExpr(expr.b);
            return args => aFn(args) << bFn(args);
        }
        case 'shr': {
            const aFn = compilePureExpr(expr.a);
            const bFn = compilePureExpr(expr.b);
            return args => aFn(args) >> bFn(args);
        }
        case 'ushr': {
            const aFn = compilePureExpr(expr.a);
            const bFn = compilePureExpr(expr.b);
            return args => aFn(args) >>> bFn(args);
        }
        case 'method': {
            const objFn = compilePureExpr(expr.obj);
            const argFns = expr.args.map(compilePureExpr);
            const method = expr.method;
            return args => {
                const obj = objFn(args);
                const methodArgs = argFns.map(fn => fn(args));
                return obj[method](...methodArgs);
            };
        }
        case 'subFn': {
            // SubFn evaluates the body with the arg as input(0)
            const argFn = compilePureExpr(expr.arg);
            const bodyFn = compilePureExpr(expr.body);
            return args => {
                const argValue = argFn(args);
                return bodyFn([argValue]);
            };
        }
        case 'var':
        case 'map':
            throw new Error(`Expression ${expr.kind} requires vars but compiled as pure`);
    }
}

function compileExprToClosure(expr: Expr): EvalFn {
    // For pure expressions, use optimized single-arg version
    if (!exprNeedsVars(expr)) {
        const pureFn = compilePureExpr(expr);
        return (args, _vars) => pureFn(args);
    }

    switch (expr.kind) {
        case 'lit': {
            const value = expr.value;
            return () => value;
        }
        case 'input': {
            const index = expr.index;
            return args => args[index];
        }
        case 'var': {
            const id = expr.id;
            return (args, vars) => vars[id];
        }
        case 'get': {
            const objFn = compileExprToClosure(expr.obj);
            if (typeof expr.key === 'string') {
                const key = expr.key;
                return (args, vars) => {
                    const obj = objFn(args, vars);
                    return obj == null ? undefined : obj[key];
                };
            } else {
                const keyFn = compileExprToClosure(expr.key);
                return (args, vars) => {
                    const obj = objFn(args, vars);
                    return obj == null ? undefined : obj[keyFn(args, vars)];
                };
            }
        }
        case 'at': {
            const arrFn = compileExprToClosure(expr.arr);
            if (typeof expr.index === 'number') {
                const idx = expr.index;
                return (args, vars) => {
                    const arr = arrFn(args, vars);
                    return arr == null ? undefined : arr[idx];
                };
            } else {
                const idxFn = compileExprToClosure(expr.index);
                return (args, vars) => {
                    const arr = arrFn(args, vars);
                    return arr == null ? undefined : arr[idxFn(args, vars)];
                };
            }
        }
        case 'call': {
            const fn = expr.fn;
            const argFns = expr.args.map(compileExprToClosure);
            const len = argFns.length;
            if (len === 0) return () => fn();
            if (len === 1) {
                const a0 = argFns[0];
                return (args, vars) => fn(a0(args, vars));
            }
            if (len === 2) {
                const a0 = argFns[0],
                    a1 = argFns[1];
                return (args, vars) => fn(a0(args, vars), a1(args, vars));
            }
            if (len === 3) {
                const a0 = argFns[0],
                    a1 = argFns[1],
                    a2 = argFns[2];
                return (args, vars) => fn(a0(args, vars), a1(args, vars), a2(args, vars));
            }
            return (args, vars) => fn(...argFns.map(f => f(args, vars)));
        }
        case 'new': {
            const ctor = expr.ctor;
            const argFns = expr.args.map(compileExprToClosure);
            return (args, vars) => new ctor(...argFns.map(f => f(args, vars)));
        }
        case 'obj': {
            const entries = expr.entries.map(
                ([k, v]) => [typeof k === 'string' ? k : compileExprToClosure(k), compileExprToClosure(v)] as const,
            );
            return (args, vars) => {
                const result: any = {};
                for (const [k, vFn] of entries) {
                    const key = typeof k === 'string' ? k : k(args, vars);
                    result[key] = vFn(args, vars);
                }
                return result;
            };
        }
        case 'arr': {
            const elemFns = expr.elements.map(compileExprToClosure);
            return (args, vars) => elemFns.map(f => f(args, vars));
        }
        case 'eq': {
            const aFn = compileExprToClosure(expr.a);
            const bFn = compileExprToClosure(expr.b);
            return (args, vars) => aFn(args, vars) === bFn(args, vars);
        }
        case 'neq': {
            const aFn = compileExprToClosure(expr.a);
            const bFn = compileExprToClosure(expr.b);
            return (args, vars) => aFn(args, vars) !== bFn(args, vars);
        }
        case 'lt': {
            const aFn = compileExprToClosure(expr.a);
            const bFn = compileExprToClosure(expr.b);
            return (args, vars) => aFn(args, vars) < bFn(args, vars);
        }
        case 'gt': {
            const aFn = compileExprToClosure(expr.a);
            const bFn = compileExprToClosure(expr.b);
            return (args, vars) => aFn(args, vars) > bFn(args, vars);
        }
        case 'lte': {
            const aFn = compileExprToClosure(expr.a);
            const bFn = compileExprToClosure(expr.b);
            return (args, vars) => aFn(args, vars) <= bFn(args, vars);
        }
        case 'gte': {
            const aFn = compileExprToClosure(expr.a);
            const bFn = compileExprToClosure(expr.b);
            return (args, vars) => aFn(args, vars) >= bFn(args, vars);
        }
        case 'not': {
            const aFn = compileExprToClosure(expr.a);
            return (args, vars) => !aFn(args, vars);
        }
        case 'and': {
            const aFn = compileExprToClosure(expr.a);
            const bFn = compileExprToClosure(expr.b);
            return (args, vars) => aFn(args, vars) && bFn(args, vars);
        }
        case 'or': {
            const aFn = compileExprToClosure(expr.a);
            const bFn = compileExprToClosure(expr.b);
            return (args, vars) => aFn(args, vars) || bFn(args, vars);
        }
        case 'nullish': {
            const aFn = compileExprToClosure(expr.a);
            const bFn = compileExprToClosure(expr.b);
            return (args, vars) => aFn(args, vars) ?? bFn(args, vars);
        }
        case 'typeof': {
            const valueFn = compileExprToClosure(expr.value);
            return (args, vars) => typeof valueFn(args, vars);
        }
        case 'isType': {
            const valueFn = compileExprToClosure(expr.value);
            const type = expr.type;
            return (args, vars) => typeof valueFn(args, vars) === type;
        }
        case 'isNull': {
            const valueFn = compileExprToClosure(expr.value);
            return (args, vars) => valueFn(args, vars) === null;
        }
        case 'isNullish': {
            const valueFn = compileExprToClosure(expr.value);
            return (args, vars) => valueFn(args, vars) == null;
        }
        case 'has': {
            const objFn = compileExprToClosure(expr.obj);
            if (typeof expr.key === 'string') {
                const key = expr.key;
                return (args, vars) => key in objFn(args, vars);
            } else {
                const keyFn = compileExprToClosure(expr.key);
                return (args, vars) => keyFn(args, vars) in objFn(args, vars);
            }
        }
        case 'len': {
            const valueFn = compileExprToClosure(expr.value);
            return (args, vars) => {
                const v = valueFn(args, vars);
                return v == null ? 0 : v.length;
            };
        }
        case 'ternary': {
            const condFn = compileExprToClosure(expr.cond);
            const thenFn = compileExprToClosure(expr.then);
            const elseFn = compileExprToClosure(expr.else);
            return (args, vars) => (condFn(args, vars) ? thenFn(args, vars) : elseFn(args, vars));
        }
        case 'instanceof': {
            const valueFn = compileExprToClosure(expr.value);
            const ctor = expr.ctor;
            return (args, vars) => valueFn(args, vars) instanceof ctor;
        }
        case 'concat': {
            const partFns = expr.parts.map(compileExprToClosure);
            return (args, vars) => {
                let result = '';
                for (const fn of partFns) result += fn(args, vars);
                return result;
            };
        }
        case 'add': {
            const aFn = compileExprToClosure(expr.a);
            const bFn = compileExprToClosure(expr.b);
            return (args, vars) => aFn(args, vars) + bFn(args, vars);
        }
        case 'sub': {
            const aFn = compileExprToClosure(expr.a);
            const bFn = compileExprToClosure(expr.b);
            return (args, vars) => aFn(args, vars) - bFn(args, vars);
        }
        case 'mul': {
            const aFn = compileExprToClosure(expr.a);
            const bFn = compileExprToClosure(expr.b);
            return (args, vars) => aFn(args, vars) * bFn(args, vars);
        }
        case 'div': {
            const aFn = compileExprToClosure(expr.a);
            const bFn = compileExprToClosure(expr.b);
            return (args, vars) => aFn(args, vars) / bFn(args, vars);
        }
        case 'mod': {
            const aFn = compileExprToClosure(expr.a);
            const bFn = compileExprToClosure(expr.b);
            return (args, vars) => aFn(args, vars) % bFn(args, vars);
        }
        case 'bitAnd': {
            const aFn = compileExprToClosure(expr.a);
            const bFn = compileExprToClosure(expr.b);
            return (args, vars) => aFn(args, vars) & bFn(args, vars);
        }
        case 'bitOr': {
            const aFn = compileExprToClosure(expr.a);
            const bFn = compileExprToClosure(expr.b);
            return (args, vars) => aFn(args, vars) | bFn(args, vars);
        }
        case 'bitXor': {
            const aFn = compileExprToClosure(expr.a);
            const bFn = compileExprToClosure(expr.b);
            return (args, vars) => aFn(args, vars) ^ bFn(args, vars);
        }
        case 'shl': {
            const aFn = compileExprToClosure(expr.a);
            const bFn = compileExprToClosure(expr.b);
            return (args, vars) => aFn(args, vars) << bFn(args, vars);
        }
        case 'shr': {
            const aFn = compileExprToClosure(expr.a);
            const bFn = compileExprToClosure(expr.b);
            return (args, vars) => aFn(args, vars) >> bFn(args, vars);
        }
        case 'ushr': {
            const aFn = compileExprToClosure(expr.a);
            const bFn = compileExprToClosure(expr.b);
            return (args, vars) => aFn(args, vars) >>> bFn(args, vars);
        }
        case 'method': {
            const objFn = compileExprToClosure(expr.obj);
            const argFns = expr.args.map(compileExprToClosure);
            const method = expr.method;
            return (args, vars) => {
                const obj = objFn(args, vars);
                const methodArgs = argFns.map(fn => fn(args, vars));
                return obj[method](...methodArgs);
            };
        }
        case 'map': {
            const arrFn = compileExprToClosure(expr.arr);
            const elemId = expr.elemId;
            const indexId = expr.indexId;
            const bodyFn = compileBlockToClosure(expr.body);
            return (args, vars) => {
                const arr = arrFn(args, vars);
                const result = new Array(arr.length);
                for (let i = 0; i < arr.length; i++) {
                    vars[elemId] = arr[i];
                    vars[indexId] = i;
                    // bodyFn returns { earlyReturn, value } - extract value
                    result[i] = bodyFn(args, vars)?.value;
                }
                return result;
            };
        }
        case 'subFn': {
            // SubFn evaluates the body with the arg as input(0)
            const argFn = compileExprToClosure(expr.arg);
            const bodyFn = compileExprToClosure(expr.body);
            return (args, vars) => {
                const argValue = argFn(args, vars);
                return bodyFn([argValue], vars);
            };
        }
    }
}

type StmtFn = (
    args: any[],
    vars: any[],
) => { earlyReturn?: boolean; earlyBreak?: boolean; earlyContinue?: boolean; value?: any } | void;

function compileStmtToClosure(stmt: Stmt): StmtFn {
    switch (stmt.kind) {
        case 'let': {
            const id = stmt.id;
            const exprFn = compileExprToClosure(stmt.expr);
            return (args, vars) => {
                vars[id] = exprFn(args, vars);
            };
        }
        case 'set': {
            const objFn = compileExprToClosure(stmt.obj);
            const valueFn = compileExprToClosure(stmt.value);
            if (typeof stmt.key === 'string') {
                const key = stmt.key;
                return (args, vars) => {
                    objFn(args, vars)[key] = valueFn(args, vars);
                };
            } else {
                const keyFn = compileExprToClosure(stmt.key);
                return (args, vars) => {
                    objFn(args, vars)[keyFn(args, vars)] = valueFn(args, vars);
                };
            }
        }
        case 'push': {
            const arrFn = compileExprToClosure(stmt.arr);
            const valueFn = compileExprToClosure(stmt.value);
            return (args, vars) => {
                arrFn(args, vars).push(valueFn(args, vars));
            };
        }
        case 'setVar': {
            const id = stmt.id;
            const valueFn = compileExprToClosure(stmt.value);
            return (args, vars) => {
                vars[id] = valueFn(args, vars);
            };
        }
        case 'exec': {
            const exprFn = compileExprToClosure(stmt.expr);
            return (args, vars) => {
                exprFn(args, vars);
            };
        }
        case 'return': {
            if (stmt.value) {
                const valueFn = compileExprToClosure(stmt.value);
                return (args, vars) => ({ earlyReturn: true, value: valueFn(args, vars) });
            }
            return () => ({ earlyReturn: true, value: undefined });
        }
        case 'throw': {
            const errorFn = compileExprToClosure(stmt.error);
            return (args, vars) => {
                throw errorFn(args, vars);
            };
        }
        case 'if': {
            const condFn = compileExprToClosure(stmt.cond);
            const thenFn = compileBlockToClosure(stmt.then);
            const elseFn = stmt.else ? compileBlockToClosure(stmt.else) : undefined;
            return (args, vars) => {
                if (condFn(args, vars)) {
                    const r = thenFn(args, vars);
                    if (r) return r;
                } else if (elseFn) {
                    const r = elseFn(args, vars);
                    if (r) return r;
                }
            };
        }
        case 'loop': {
            const arrFn = stmt.arr ? compileExprToClosure(stmt.arr) : undefined;
            const startFn = stmt.start ? compileExprToClosure(stmt.start) : undefined;
            const endFn = stmt.end ? compileExprToClosure(stmt.end) : undefined;
            const elemId = stmt.elemId;
            const indexId = stmt.indexId;
            const bodyFn = compileBlockToClosure(stmt.body);
            const skipElem = stmt.skipElem;
            return (args, vars) => {
                const arr = arrFn ? arrFn(args, vars) : undefined;
                const start = startFn ? startFn(args, vars) : 0;
                const end = endFn ? endFn(args, vars) : arr!.length;
                for (let i = start; i < end; i++) {
                    vars[indexId] = i;
                    if (arr && !skipElem) {
                        vars[elemId] = arr[i];
                    }
                    const r = bodyFn(args, vars);
                    if (r) return r;
                }
            };
        }
        case 'forIn': {
            const objFn = compileExprToClosure(stmt.obj);
            const keyId = stmt.keyId;
            const bodyFn = compileBlockToClosure(stmt.body);
            return (args, vars) => {
                const obj = objFn(args, vars);
                for (const key in obj) {
                    vars[keyId] = key;
                    const r = bodyFn(args, vars);
                    if (r) return r;
                }
            };
        }
        case 'forOf': {
            const iterableFn = compileExprToClosure(stmt.iterable);
            const valueId = stmt.valueId;
            const keyId = stmt.keyId;
            const bodyFn = compileBlockToClosure(stmt.body);
            // For Map entries with keyId, destructure [key, value]
            if (keyId !== undefined) {
                return (args, vars) => {
                    const iterable = iterableFn(args, vars);
                    for (const item of iterable) {
                        vars[keyId] = item[0];
                        vars[valueId] = item[1];
                        const r = bodyFn(args, vars);
                        if (r) return r;
                    }
                };
            }
            // For Set or simple iteration
            return (args, vars) => {
                const iterable = iterableFn(args, vars);
                for (const item of iterable) {
                    vars[valueId] = item;
                    const r = bodyFn(args, vars);
                    if (r) return r;
                }
            };
        }
        case 'switch': {
            const valueFn = compileExprToClosure(stmt.value);
            const cases = stmt.cases.map(([lit, block]) => [lit, compileBlockToClosure(block)] as const);
            const defaultFn = stmt.default ? compileBlockToClosure(stmt.default) : undefined;
            return (args, vars) => {
                const value = valueFn(args, vars);
                for (const [lit, blockFn] of cases) {
                    if (value === lit) {
                        const r = blockFn(args, vars);
                        if (r) return r;
                        return;
                    }
                }
                if (defaultFn) {
                    const r = defaultFn(args, vars);
                    if (r) return r;
                }
            };
        }
        case 'while': {
            const condFn = compileExprToClosure(stmt.cond);
            const bodyFn = compileBlockToClosure(stmt.body);
            return (args, vars) => {
                while (condFn(args, vars)) {
                    const r = bodyFn(args, vars);
                    if (r) {
                        if (r.earlyReturn) return r;
                        if (r.earlyBreak) return;
                        // earlyContinue: just continue the while loop
                    }
                }
            };
        }
        case 'break':
            return () => ({ earlyBreak: true });
        case 'continue':
            return () => ({ earlyContinue: true });
    }
}

type BlockFn = (
    args: any[],
    vars: any[],
) => { earlyReturn?: boolean; earlyBreak?: boolean; earlyContinue?: boolean; value?: any } | void;

function compileBlockToClosure(block: Block): BlockFn {
    const stmtFns = block.stmts.map(compileStmtToClosure);
    const returnFn = block.returnExpr ? compileExprToClosure(block.returnExpr) : undefined;

    return (args, vars) => {
        for (const fn of stmtFns) {
            const result = fn(args, vars);
            if (result && (result.earlyReturn || result.earlyBreak || result.earlyContinue)) return result;
        }
        if (returnFn) {
            return { earlyReturn: true, value: returnFn(args, vars) };
        }
    };
}

/**
 * Check if a block is pure (no statements, return expr doesn't need vars).
 */
function isPureBlock(block: Block): boolean {
    if (block.stmts.length > 0) return false;
    if (!block.returnExpr) return true;
    return !exprNeedsVars(block.returnExpr);
}

/**
 * Create an optimized closure-based executor for a block.
 * Pre-compiles to closures for efficient repeated execution.
 *
 * For pure blocks (no statements, return expr doesn't need vars),
 * uses a simplified executor that avoids vars array allocation.
 */
function createClosureExecutor<T>(block: Block): (...args: any[]) => T {
    // Fast path for pure blocks (common case for type guards)
    if (isPureBlock(block)) {
        if (!block.returnExpr) {
            return () => undefined as T;
        }
        const pureFn = compilePureExpr(block.returnExpr);
        return (...args: any[]): T => pureFn(args) as T;
    }

    // General case with vars support
    const blockFn = compileBlockToClosure(block);
    return (...args: any[]): T => {
        const result = blockFn(args, []);
        return result?.value;
    };
}

/**
 * Force Exec mode using closure-based compilation.
 * This compiles the expression tree to nested closures at build time,
 * eliminating switch statements and object lookups at runtime.
 * @internal
 */
export function fnExec<R>(...args: any[]): (...args: any[]) => R {
    const body = args.pop() as (b: Builder, ...inputs: Ref[]) => Ref<R> | void;
    const argCount = args.length;

    const builder = new Builder(argCount);
    const inputs = Array.from({ length: argCount }, (_, i) => builder.input(i));
    const result = body(builder, ...inputs);
    const block = builder.build(result as Ref<R> | undefined);

    return createClosureExecutor<R>(block) as any;
}

// ============================================================================
// Compatibility Layer (for tests using old API)
// ============================================================================

/**
 * @deprecated Use the direct exports (fn, fnJIT, fnExec, etc.) instead.
 * This namespace is provided for backward compatibility with tests.
 */
export const jit = {
    fn,
    fnJIT,
    fnExec,
    arg,
};

// Default export
export { fn as default };
