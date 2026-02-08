# Deepkit Todo Tracker

> **Init prompt**: `open docs/todo.md and continue the work`

This is the central task tracker for Deepkit development. Read this entire section before starting.

---

## Current Strategy: Local-First Development

**Branch:** `feat/next`

**Workflow:**
1. All fixes are implemented and tested locally on `feat/next`
2. **DO NOT** push to GitHub or close issues yet
3. **DO NOT** sync back to GitHub until the big PR is merged
4. Track completion status here in todo.md only
5. Once all targeted issues are fixed locally → merge PR → then bulk-close issues on GitHub

**Why:** We're accumulating a large set of fixes and improvements. Syncing incrementally would create noise. One big merge with comprehensive changelog is cleaner.

**Status tracking:**
- Issues in "Backlog" sections = not yet started
- Issues in "Completed" section = fixed locally on feat/next, awaiting PR merge

---

## Agent Instructions

### Your Role

You are an **orchestrator/supervisor**. You coordinate work but delegate execution to sub-agents.

### How to Continue Work

1. **Check `docs/todo/` folder** for existing issue folders
2. **Pick an incomplete issue** - read its `README.md` and `notes.md`
3. **Skip items marked `BLOCKED` or `NOT-YET`** - these are not ready
4. **Continue from where the previous agent left off**

If no existing work, pick from "Active Work" or "Backlog" below (prioritize High > Medium > Enhancement).

### How to Work

**CRITICAL: Never modify files directly. Always delegate to sub-agents.**

```
You (orchestrator)
  ├── Sub-agent: Explore codebase, find relevant files
  ├── Sub-agent: Analyze issue, investigate root cause
  ├── Sub-agent: Implement fix (writes code)
  ├── Sub-agent: Write tests
  ├── Sub-agent: VERIFY (run all quality gates)  ← REQUIRED
  └── Sub-agent: Document changes
```

Why: Keeps context clean, prevents orchestrator from getting lost in details.

### Complete Workflow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         COMPLETE AGENT WORKFLOW                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   1. INTAKE                                                                  │
│      - Read CLAUDE.md + todo.md                                              │
│      - Pick issue using priority (High > Medium > Enhancement)               │
│                                                                              │
│   2. ANALYSIS                                                                │
│      - Delegate: Explore codebase, find relevant files                       │
│      - Delegate: Analyze issue, investigate root cause                       │
│      - For core packages: Run IMPACT ANALYSIS (see docs/agents/)             │
│      - Update docs/todo/<issue>/notes.md                                     │
│                                                                              │
│   3. IMPLEMENTATION                                                          │
│      - Delegate: Implement fix (writes code)                                 │
│      - Delegate: Write tests                                                 │
│                                                                              │
│   4. VERIFICATION (REQUIRED - see docs/agents/verify-agent.md)               │
│      ┌─────────────────────────────────────────────────────────────────────┐│
│      │ Gate 1: TYPECHECK    - npm run typecheck                            ││
│      │ Gate 2: LINT         - prettier --check                             ││
│      │ Gate 3: TESTS        - npm run test packages/<affected>/            ││
│      │ Gate 4: BENCHMARK    - For hot-path packages (type, bson, orm)      ││
│      │ Gate 5: SECURITY     - For http/rpc/orm/sql changes                 ││
│      │ Gate 6: DX AUDIT     - For error handling, API changes              ││
│      │ Gate 7: DOCUMENTATION - JSDoc, README, examples updated             ││
│      │ Gate 8: IMPACT       - For core package changes                     ││
│      │                                                                     ││
│      │ ANY GATE FAIL → Fix and re-verify                                   ││
│      └─────────────────────────────────────────────────────────────────────┘│
│                                                                              │
│   5. COMMIT (only after all gates pass)                                      │
│      - Conventional commit message                                           │
│      - Reference issue number                                                │
│      - Update docs/todo/<issue>/ status                                      │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Rules (Non-Negotiable)

1. **Commits**
   - Only commit when a valuable chunk is complete (safe checkpoint)
   - Never amend commits
   - Never commit if typecheck fails (use `tsgo` for fast checking)
   - Never commit if lint fails
   - Never commit if tests fail

2. **Tests**
   - Always run tests before committing: `npm run test packages/<pkg>/`
   - Never simplify or weaken existing tests
   - Never run only a subset of tests to "make it pass"
   - Add regression tests for every bug fix

3. **Documentation**
   - Every issue needs a `docs/todo/<issue-id>/` folder
   - Update `notes.md` as you investigate
   - Update JSDoc for changed public APIs
   - Update README if behavior changes
   - Update this file's "Active Work" table

4. **Performance** (for hot-path packages: type, bson, orm, injector)
   - Run benchmarks before and after changes
   - Block commit if >10% regression
   - See docs/agents/benchmark-agent.md

5. **Security** (for http, rpc, orm, sql, mongo)
   - Review against security checklist
   - See docs/agents/security-agent.md

### Hooks (Implemented in lefthook.yml)

Pre-commit hooks enforce these rules automatically:
- [x] Pre-commit hook: block if `tsgo` typecheck fails
- [x] Pre-commit hook: block if lint fails
- [x] Commit-msg hook: enforce conventional commits
- [ ] Claude hook: warn if trying to modify files without sub-agent (manual)
- [ ] Claude hook: warn if committing without running tests (manual)

### Team Roles

See `docs/team/README.md` for the full team intro and pipeline diagram.

| Avatar | Name | Role | When Active |
|--------|------|------|-------------|
| 🧑‍💼 | Max | Lead | Every task - coordinates pipeline |
| 🔍 | Scout | Explorer | Phase 1 - find files, investigate |
| 🔧 | Alex | Implementer | Phase 2 - write code |
| 🧪 | Tess | Tester | Phase 2 - write tests |
| 🏎️ | Turbo | Perf | Phase 3 - hot-path changes |
| 🔒 | Sam | Security | Phase 3 - http/rpc/orm/sql |
| 🎨 | Devon | DX | Phase 3 - error/API changes |
| 📝 | Dana | Docs | Phase 3 - all changes |
| 🌊 | River | Impact | Phase 3 - core packages |

### Starting New Work

1. Create folder: `cp -r docs/todo/_ISSUE_TEMPLATE docs/todo/<issue-id>`
2. Update "Active Work" table below
3. Read GitHub issue for context (use `gh issue view <number>`)
4. Document approach in `docs/todo/<issue-id>/README.md`
5. Delegate implementation to sub-agents

### Package Improvements

1. Create: `cp docs/todo/packages/_TEMPLATE.md docs/todo/packages/<package>.md`
2. Update package status in tables below
3. Use sub-agents to analyze and improve

---

## Active Work

<!-- Currently being worked on - agents should check here first -->

| Issue | Title | Folder | Status |
|-------|-------|--------|--------|
| JIT-CSP | JIT/CSP Migration - Migrate packages to new jit API | docs/todo/jit-csp/ | **Phase 1 complete, Phase 2 pending** |
| BSON-REWRITE | Clean-slate BSON rewrite with jit.ts | docs/todo/bson-rewrite/ | **🔧 Phase 4: Stabilization** |

### BSON Rewrite Status

**Implementation complete.** The BSON package has been fully rewritten using the `jit.ts` Builder API. Zero `new Function()`, zero `CompilerContext`. Currently stabilizing.

**Remaining stabilization work:**
- 20 type-spec.spec.ts failures (legacy roundtrip tests)
- 13 coercion.spec.ts failures (type coercion gaps in slow-path deserializer)
- `getBsonEncoder` API not yet implemented (encoder.spec.ts: 0/15)
- edge-cases.spec.ts / roundtrip/type-spec.spec.ts reference missing APIs
- String deserialization performance (1.2M ops/sec, only 1.1x vs bson-js)
- 1 stream.spec.ts failure

See `docs/todo/bson-rewrite/README.md` for full plan.

---

## JIT/CSP Migration Project

**Goals:**
1. **CSP compatibility** - Support CSP-restricted environments (Cloudflare Workers, strict browser CSP) via Exec mode
2. **Faster bootstrap** - Lazy JIT generation: start with Exec mode, only compile to JIT after N calls (e.g., 10+), similar to V8's tiered compilation
3. **Unified API** - Single codebase for both modes, automatic runtime detection

**Documentation:** `docs/todo/jit-csp/technical-spec.md`

### Phase 0: Baseline Benchmarks ✅ COMPLETE

Comprehensive benchmarks are in place with a pre-refactor baseline saved.

**Completed:**
1. [x] Create comprehensive benchmarks for each package's JIT-compiled code
2. [x] Set up automated benchmark storage (baseline files in git)
3. [x] Document current performance numbers as migration baseline

**Baseline file:** `benchmarks/src/benchmarks/baselines/baseline-pre-jit-refactor.json`

**Commands:**
```bash
npm run benchmark                    # Run all benchmarks
npm run benchmark -- --save-baseline # Save new baseline
npm run benchmark -- --compare-baseline # Compare against baseline
```

**Packages using CompilerContext** (in migration order):

| Priority | Package | Files | Complexity | Benchmark Status |
|----------|---------|-------|------------|------------------|
| 1 | @deepkit/type | serializer.ts, snapshot.ts, path.ts, change-detector.ts | High (core serialization) | ✅ 115 benchmarks |
| 2 | @deepkit/bson | bson-serializer.ts, bson-deserializer.ts | High (binary perf critical) | ✅ 19 benchmarks |
| 3 | @deepkit/injector | injector.ts | Medium (DI factories) | ✅ 36 benchmarks |
| 4 | @deepkit/http | router.ts, request-parser.ts | Medium (request handling) | ✅ 28 benchmarks |
| 5 | @deepkit/workflow | workflow.ts | Low (state machines) | ⏭️ Skip (low priority) |

**Total: 306 benchmarks across 15 suites** covering serialization, validation, reflection, change-detection, BSON, RPC, ORM, HTTP, injector, and more.

### Phase 1: Migrate @deepkit/type (NEXT)

After benchmarks are in place:
- [ ] Migrate serializer.ts to `jit` API
- [ ] Migrate change-detector.ts to `jit` API
- [ ] Migrate snapshot.ts to `jit` API
- [ ] Migrate path.ts to `jit` API
- [ ] Verify benchmarks match or beat baseline
- [ ] Run full test suite

### Phase 2: Migrate Downstream Packages (539 TS errors total)

See `docs/todo/jit-csp/tracker.md` for detailed file-by-file breakdown.

**Phase 2a: @deepkit/bson (385 errors) - CRITICAL**
- [ ] Migrate bson-serializer.ts (221 errors)
- [ ] Migrate bson-deserializer-templates.ts (160 errors)
- [ ] Migrate bson-deserializer.ts (3 errors)
- [ ] Fix utils.ts (1 error)
- [ ] Verify BSON benchmarks match or beat baseline

**Phase 2b: @deepkit/sql (117 errors) - CRITICAL**
- [ ] Migrate sql-serializer.ts to new Handler API
- [ ] Update SQL type handlers for new BuildState

**Phase 2c: @deepkit/mongo (16 errors)**
- [ ] Migrate mongo-serializer.ts (11 errors)
- [ ] Fix persistence.ts (2 errors)
- [ ] Fix mapping.ts (2 errors)
- [ ] Fix query.resolver.ts (1 error)

**Phase 2d: SQL Adapters**
- [ ] Migrate mysql-serializer.ts (9 errors)
- [ ] Migrate sqlite-serializer.ts (7 errors)
- [ ] postgres-serializer.ts (0 errors - already done or doesn't exist)

**Phase 2e: Cleanup**
- [ ] Fix orm/utils.ts (1 error)
- [ ] Fix desktop-ui/state.ts (4 errors - may be unrelated)

### Phase 3: Additional Packages (if needed)

- [ ] @deepkit/injector - injector.ts (uses CompilerContext from @deepkit/core, may need update)
- [ ] @deepkit/http - router.ts, request-parser.ts (uses getSerializeFunction, getValidatorFunction)
- [ ] @deepkit/workflow - workflow.ts (minimal usage)

### Phase 4: Testing & Documentation

- [ ] Cross-runtime testing (Node, Deno, Bun, Cloudflare Workers)
- [ ] Performance regression CI
- [ ] Migration guide
- [ ] API documentation

---

## Backlog

### Priority: High

Issues blocking users or causing incorrect behavior.

| Issue | Title | Package | Created |
|-------|-------|---------|---------|
| - | - | - | - |

### Priority: Medium

Issues affecting DX or edge cases.

| Issue | Title | Package | Created | Notes |
|-------|-------|---------|---------|-------|
| - | - | - | - | - |

### Priority: Low

Minor bugs or narrow edge cases.

| Issue | Title | Package | Created | Notes |
|-------|-------|---------|---------|-------|
| [#227](https://github.com/deepkit/deepkit-framework/issues/227) | ORM serialization problem with table connection | orm | 2022-05-03 | **NEEDS REPRO** - unclear issue description |

### DX / Tooling Issues

| Issue | Title | Package | Created | Notes |
|-------|-------|---------|---------|-------|
| [#363](https://github.com/deepkit/deepkit-framework/issues/363) | type-compiler injection can't be updated | type-compiler | 2022-08-22 | Workaround: delete TS install first |
| [#355](https://github.com/deepkit/deepkit-framework/issues/355) | pnpm install requires manual command | type-compiler | 2022-08-19 | Workaround: run `deepkit-type-install` manually |
| [#357](https://github.com/deepkit/deepkit-framework/issues/357) | pnpm multiple TS versions issue | type-compiler | 2022-08-19 | Workaround: --preserve-symlinks |

### Enhancement Requests

| Issue | Title | Package | Created |
|-------|-------|---------|---------|
| [#658](https://github.com/deepkit/deepkit-framework/issues/658) | TypeScript 7 support | type-compiler | 2025-06-25 | **BLOCKED** - TS7 switched to Go (tsgo), our transformer is TS-based. Solution in progress (not public). |
| [#609](https://github.com/deepkit/deepkit-framework/issues/609) | ORM adapter for PgLite | orm | 2024-09-05 |
| [#575](https://github.com/deepkit/deepkit-framework/issues/575) | Batch mechanism in Message Queue | broker | 2024-06-17 |
| [#572](https://github.com/deepkit/deepkit-framework/issues/572) | Add light theme in documentation | website | 2024-06-07 |
| [#567](https://github.com/deepkit/deepkit-framework/issues/567) | Observability tools | framework | 2024-05-11 |
| [#548](https://github.com/deepkit/deepkit-framework/issues/548) | API SDK extraction | framework | 2024-08-08 |
| [#492](https://github.com/deepkit/deepkit-framework/issues/492) | Deepkit Broker improvements | broker | 2024-05-22 |
| [#488](https://github.com/deepkit/deepkit-framework/issues/488) | RPC with HTTP streams | rpc | 2023-10-11 |
| [#390](https://github.com/deepkit/deepkit-framework/issues/390) | Simpler query for simple updates | orm | 2022-12-02 |
| [#380](https://github.com/deepkit/deepkit-framework/issues/380) | Babel plugin for type-compiler | type-compiler | 2022-09-26 |
| [#379](https://github.com/deepkit/deepkit-framework/issues/379) | HttpQueries strict validation (reject unknown params) | http | 2022-09-16 |
| [#246](https://github.com/deepkit/deepkit-framework/issues/246) | Support getter methods in typeOf<> | type | 2022-05-31 |

### Documentation

| Issue | Title | Created |
|-------|-------|---------|
| [#641](https://github.com/deepkit/deepkit-framework/issues/641) | Migrations guide for Nest users | 2025-04-02 |
| [#591](https://github.com/deepkit/deepkit-framework/issues/591) | Better next() usage docs | 2024-07-06 |
| [#583](https://github.com/deepkit/deepkit-framework/issues/583) | Next.js working setup example | 2025-04-03 |

### Non-Issues (to close/ignore)

| Issue | Title | Reason |
|-------|-------|--------|
| [#666](https://github.com/deepkit/deepkit-framework/issues/666) | Thank you for @deepkit/type | Not an issue - appreciation |
| [#665](https://github.com/deepkit/deepkit-framework/issues/665) | Deepki trademark concern | Off-topic |
| [#261](https://github.com/deepkit/deepkit-framework/issues/261) | Windows installation difficulty | User missing VS build tools for node-gyp |
| [#353](https://github.com/deepkit/deepkit-framework/issues/353) | dir named 'app' breaks DI | User error - missing type annotation on config |

---

## Package Improvement Tracking

Each package has standard improvement areas tracked in `docs/todo/packages/<package>.md`.

### Core Packages

| Package | Docs | README | Tests | Perf | Bugs | Status |
|---------|------|--------|-------|------|------|--------|
| type | - | - | - | - | - | Not started |
| type-compiler | - | - | - | - | - | Not started |
| type-spec | - | - | - | - | - | Not started |
| injector | - | - | - | - | - | Not started |
| core | - | - | - | - | - | Not started |

### Application Packages

| Package | Docs | README | Tests | Perf | Bugs | Status |
|---------|------|--------|-------|------|------|--------|
| app | - | - | - | - | - | Not started |
| framework | - | - | - | - | - | Not started |
| http | - | - | - | - | - | Not started |
| rpc | - | - | - | - | - | Not started |

### Data Packages

| Package | Docs | README | Tests | Perf | Bugs | Status |
|---------|------|--------|-------|------|------|--------|
| orm | - | - | - | - | - | Not started |
| bson | - | - | - | - | - | Not started |
| mongo | - | - | - | - | - | Not started |
| sql | - | - | - | - | - | Not started |
| postgres | - | - | - | - | - | Not started |
| mysql | - | - | - | - | - | Not started |
| sqlite | - | - | - | - | - | Not started |

### Infrastructure Packages

| Package | Docs | README | Tests | Perf | Bugs | Status |
|---------|------|--------|-------|------|------|--------|
| broker | - | - | - | - | - | Not started |
| event | - | - | - | - | - | Not started |
| logger | - | - | - | - | - | Not started |
| filesystem | - | - | - | - | - | Not started |
| workflow | - | - | - | - | - | Not started |

### Tooling Packages

| Package | Docs | README | Tests | Perf | Bugs | Status |
|---------|------|--------|-------|------|------|--------|
| vite | - | - | - | - | - | Not started |
| bun | - | - | - | - | - | Not started |
| run | - | - | - | - | - | Not started |

Legend: ✅ Done | 🔄 In Progress | ⚠️ Needs Work | - Not Started

---

## Codebase Analysis Issues

Issues discovered through codebase analysis (not from GitHub).

| ID | Title | Package | Severity | Folder |
|----|-------|---------|----------|--------|
| - | - | - | - | - |

---

## Completed

| Issue | Title | Completed | PR/Commit |
|-------|-------|-----------|-----------|
| [#241](https://github.com/deepkit/deepkit-framework/issues/241) | Debugger fails with Database subclass + generic | 2026-01-20 | verified working |
| [#352](https://github.com/deepkit/deepkit-framework/issues/352) | External types produce broken output | 2026-01-20 | 7b98a9f0 |
| [#220](https://github.com/deepkit/deepkit-framework/issues/220) | DI fails when type name duplicates DOM | 2026-01-20 | already fixed |
| [#285](https://github.com/deepkit/deepkit-framework/issues/285) | Express middleware req.get() missing | 2026-01-20 | 699dca13 |
| [#356](https://github.com/deepkit/deepkit-framework/issues/356) | Windows backslash path delimiters | 2026-01-20 | fd8fda2f |
| [#375](https://github.com/deepkit/deepkit-framework/issues/375) | Nested joins on backrefs not deserialized | 2026-01-20 | already fixed |
| [#439](https://github.com/deepkit/deepkit-framework/issues/439) | Better middleware handling | 2026-01-20 | 6d6d5c28 |
| [#636](https://github.com/deepkit/deepkit-framework/issues/636) | Hydrate fetched objects in identity map | 2026-01-20 | f98ea7b6 |
| [#419](https://github.com/deepkit/deepkit-framework/issues/419) | NanoId type support | 2026-01-20 | 3d805f79 |
| [#441](https://github.com/deepkit/deepkit-framework/issues/441) | CORS support | 2026-01-19 | 20d892ca |
| [#682](https://github.com/deepkit/deepkit-framework/issues/682) | remove const enum everywhere | 2025-11-29 | [#683](https://github.com/deepkit/deepkit-framework/pull/683) |
| [#614](https://github.com/deepkit/deepkit-framework/issues/614) | HttpQuery validator expression leaks | 2025-02-15 | 4d1a13ec |
| [#612](https://github.com/deepkit/deepkit-framework/issues/612) | Optional chaining SyntaxError | 2026-01-16 | 02c2a6c9 |
| [#598](https://github.com/deepkit/deepkit-framework/issues/598) | Missing shebang in bin/deepkit-sql.js | 2026-01-16 | 7bb2b6f1 |
| [#573](https://github.com/deepkit/deepkit-framework/issues/573) | [bson] make sure NaN is serialized as 0 | 2026-01-18 | 8578bb4f |
| [#676](https://github.com/deepkit/deepkit-framework/issues/676) | [bson] Improve error message | 2026-01-18 | 1367b606 |
| [#668](https://github.com/deepkit/deepkit-framework/issues/668) | query.count() throws error with pagination | 2026-01-18 | 86a8e7ec |
| [#577](https://github.com/deepkit/deepkit-framework/issues/577) | Wrong error message in union validation | 2026-01-18 | 759326d9, 6500cf72 |
| [#653](https://github.com/deepkit/deepkit-framework/issues/653) | HttpHeader case sensitive in TestingFacade | 2026-01-18 | 97f8991e |
| [#574](https://github.com/deepkit/deepkit-framework/issues/574) | BrokerKeyValue export not found | 2025-04-24 | 5a58776 |
| [#565](https://github.com/deepkit/deepkit-framework/issues/565) | validate with generics and arrays | 2024-10-xx | 4d24c8b3 |
| [#590](https://github.com/deepkit/deepkit-framework/issues/590) | Ending response at middleware - no log entry | 2026-01-18 | 937781e5 |
| [#589](https://github.com/deepkit/deepkit-framework/issues/589) | Throwing at HTTP Middlewares | 2026-01-18 | 9ee05a9a |
| [#505](https://github.com/deepkit/deepkit-framework/issues/505) | assert circular structure to json | 2026-01-18 | 7b2fb424 |
| [#478](https://github.com/deepkit/deepkit-framework/issues/478) | deserialize maximum call stack exceeded | 2026-01-18 | 2a41820e |
| [#524](https://github.com/deepkit/deepkit-framework/issues/524) | conditional type inference unexpected | 2026-01-19 | - |
| [#508](https://github.com/deepkit/deepkit-framework/issues/508) | Improve error "No valid runtime type" | 2026-01-19 | - |
| [#664](https://github.com/deepkit/deepkit-framework/issues/664) | function __types should be hoisted | 2026-01-19 | 3d09fa28 |
| [#634](https://github.com/deepkit/deepkit-framework/issues/634) | Named re-exports missing type representations | 2026-01-19 | 366ccdd2 |
| [#318](https://github.com/deepkit/deepkit-framework/issues/318) | index.ts exports cause silent failures | 2026-01-19 | 366ccdd2 (via #634) |
| [#601](https://github.com/deepkit/deepkit-framework/issues/601) | exclude declare statements | 2026-01-19 | 3d09fa28 |
| [#555](https://github.com/deepkit/deepkit-framework/issues/555) | No valid runtime type for external imports | 2026-01-19 | 1eba2ba1 |
| [#600](https://github.com/deepkit/deepkit-framework/issues/600) | Improve tsconfig extends handling | 2026-01-19 | a554c90f |
| [#509](https://github.com/deepkit/deepkit-framework/issues/509) | Node InferType did not pass test 'isEntityName' | 2026-01-19 | d70356d6 |
| [#395](https://github.com/deepkit/deepkit-framework/issues/395) | custom identifier in crud routes | 2026-01-19 | 555b09c2 |
| [#582](https://github.com/deepkit/deepkit-framework/issues/582) | Replace faker with maintained version | 2026-01-19 | 2803ca46 |
| [#456](https://github.com/deepkit/deepkit-framework/issues/456) | Receive types in Vite from other file | 2026-01-19 | - |
| [#562](https://github.com/deepkit/deepkit-framework/issues/562) | serialize<T> circular import error | 2026-01-19 | fbb3652c |
| [#458](https://github.com/deepkit/deepkit-framework/issues/458) | Body parameter in separate file controller | already fixed | 0173239d |
| [#444](https://github.com/deepkit/deepkit-framework/issues/444) | mongodb BSONError for Array | already fixed | - |
| [#430](https://github.com/deepkit/deepkit-framework/issues/430) | Incorrect narrowing of keyof functions | already fixed | - |
| [#593](https://github.com/deepkit/deepkit-framework/issues/593) | DeepkitLoader setup guide | 2026-01-19 | 15f3060e |

---

## Breaking Changes

Track breaking changes for the next major release. Use `!` after scope in commit message to trigger changelog generation.

**Commit format**: `feat(scope)!: description` + `BREAKING CHANGE:` footer

| Change | Package | Description | Commit |
|--------|---------|-------------|--------|
| Reference serialization | type, bson | `& Reference` now ALWAYS serializes as FK (primary key only), regardless of runtime object state. Previously, serialization depended on `isReferenceInstance()` which was unpredictable. Use new `& Inline` annotation for nested serialization. | 4b8e3102 |

---

## Design Decision: Type-Driven Reference Serialization

### Principle: Type Annotation = Serialization Output. No Magic.

The type definition determines serialization behavior. No runtime state inspection. No query tracking. Fully predictable.

### The Rules

```typescript
class Post {
    // Rule 1: & Reference → FK only (always)
    author: User & Reference;              // → { author: 2 }

    // Rule 2: & Reference & Inline → Nested object (always)
    // Throws SerializationError if not loaded
    editor: User & Reference & Inline;     // → { editor: { id: 3, name: "..." } }

    // Rule 3: No & Reference → Embedded object (existing behavior)
    metadata: Metadata;                    // → { metadata: { ... } }
}
```

### Behavior Matrix

| Type Annotation | JSON Serialization | BSON Serialization | MongoDB Storage |
|-----------------|-------------------|-------------------|-----------------|
| `& Reference` | FK only | FK only | FK only |
| `& Reference & Inline` | Nested object | Nested object | FK only (always) |
| `& Reference & Inline<{only:['json']}>` | Nested object | FK only | FK only |

**MongoDB special case**: Database storage NEVER includes nested objects for Reference fields, regardless of `& Inline`. This is enforced at the adapter level.

### Different Output Shapes

If you need different serialization outputs for the same entity, use TypeScript types:

```typescript
// Detailed view with nested author
type PostDetail = Post & { author: User & Reference & Inline };

// List view with FK only
type PostSummary = Post & { author: User & Reference };

serialize<PostDetail>(post);  // { author: { id: 1, name: "..." } }
serialize<PostSummary>(post); // { author: 1 }
```

This is more explicit and type-safe than runtime options.

### How joinWith() Works

`joinWith()` is purely for **loading data**, not for controlling serialization:

```typescript
// joinWith loads the data
const post = await db.query(Post).joinWith('author').findOne();

// Serialization follows the TYPE, not the query
serialize<Post>(post);  // { author: 2 } - because & Reference means FK

// If you want nested, change the schema:
// author: User & Reference & Inline
```

### Error Handling

```typescript
class Post {
    editor: User & Reference & Inline;  // Must be loaded for serialization
}

// Query WITHOUT loading editor
const post = await db.query(Post).findOne();

// Serialization throws because editor is not loaded
serialize<Post>(post);
// Error: Cannot serialize Post.editor: Inline reference not loaded.
// Use joinWith('editor') to load the relation.
```

### Why This Design?

| Aspect | Type-Driven (chosen) | Query-Driven (rejected) |
|--------|---------------------|------------------------|
| Predictability | Read type → know output | Must trace query path |
| Debugging | Look at schema | "Why is output different?" |
| Mental overhead | Low | High |
| Hidden state | None | Join tracking metadata |
| Agent-friendly | ✓ Clear rules | ✗ Context-dependent |

### Implementation Status ✅ COMPLETE

1. ✅ **Add `Inline` type annotation** to `@deepkit/type` (4b8e3102)
   - `Inline` marker type
   - `Inline<{ only?: string[], except?: string[] }>` for serializer-specific

2. ✅ **Update JSON serializer** (`packages/type/src/serializer.ts`)
   - `& Reference` → always serialize FK (ignore runtime state)
   - `& Reference & Inline` → serialize nested (throw if not loaded)

3. ✅ **Update BSON serializer** (`packages/bson/src/bson-serializer.ts`)
   - Same logic as JSON serializer
   - Respect `Inline<{ only: [...] }>` context options

4. ✅ **MongoDB always uses FK** (ignore Inline) - enforced in BSON serializer

5. ✅ **ORM formatter** - No changes needed (object identity fix preserved)

6. ✅ **Tests updated** - All 2226+ tests passing

7. ✅ **Error handling** - Uses proper SerializationError/BSONError classes (867e41f8)

**Note:** `expand`/`collapse` runtime options were considered but rejected - they would reintroduce unpredictability. Use different types/DTOs instead for different serialization shapes.

---

## Issue Folder Structure

Each issue folder should contain:

```
docs/todo/<issue-id>/
├── README.md       # Issue description, context, approach
├── notes.md        # Investigation notes, findings
├── tasks.md        # Sub-tasks checklist (if complex)
└── comments/       # GitHub comments sync (if needed)
```

## Sync Information

- **Last GitHub issue review**: 2026-01-20
- **GitHub open issues**: 85 (many already fixed locally, not yet closed)
- **Strategy**: Local-first on `feat/next` branch, no GitHub sync until PR merge

### Local Tracking
- **Bugs to fix**: 7 (4 Medium, 3 Low)
- **Enhancements**: 12
- **DX/tooling**: 3
- **Documentation**: 3
- **Completed locally**: 35+ (see Completed section)
