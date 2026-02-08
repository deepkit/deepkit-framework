#!/bin/bash
# Hook: Check for bad patterns after file edit
# Runs after Edit/Write tool modifies a file

FILE_PATH="$1"

# Only check TypeScript files in packages
if [[ ! "$FILE_PATH" =~ \.ts$ ]]; then
    exit 0
fi

# === CHECK 1: Block re-exports in non-index files ===
if [[ "$FILE_PATH" =~ ^packages/[^/]+/src/.*\.ts$ ]] && [[ "$FILE_PATH" != *"/index.ts" ]]; then

    # Block export *
    if grep -q "^export \* from" "$FILE_PATH" 2>/dev/null; then
        echo ""
        echo "BLOCKED: 'export *' in non-index file"
        echo "File: $FILE_PATH"
        echo ""
        echo "Only root index.ts files may use 'export *'."
        exit 1
    fi

    # Block re-exports
    if grep -q "^export {.*} from" "$FILE_PATH" 2>/dev/null; then
        echo ""
        echo "BLOCKED: Re-export in non-index file"
        echo "File: $FILE_PATH"
        echo ""
        echo "Only root index.ts files may re-export."
        exit 1
    fi
fi

# === CHECK 2: Block TODO/FIXME in production source files ===
if [[ "$FILE_PATH" =~ ^packages/[^/]+/src/.*\.ts$ ]]; then
    # Skip test files
    if [[ "$FILE_PATH" == *".spec.ts" ]] || [[ "$FILE_PATH" == */tests/* ]]; then
        exit 0
    fi

    # Skip benchmark files
    if [[ "$FILE_PATH" == */benchmarks/* ]] || [[ "$FILE_PATH" == *".bench.ts" ]]; then
        exit 0
    fi

    if grep -n "TODO\|FIXME" "$FILE_PATH" 2>/dev/null | grep -v "^[0-9]*:\s*//" | head -5; then
        echo ""
        echo "BLOCKED: TODO/FIXME found in production code"
        echo "File: $FILE_PATH"
        echo ""
        echo "Remove TODO/FIXME comments before saving."
        echo "Either do the work now or don't leave breadcrumbs."
        exit 1
    fi
fi

# === CHECK 3: Block DEFERRED/SKIPPED in markdown files ===
if [[ "$FILE_PATH" =~ \.md$ ]]; then
    if grep -qi "DEFERRED\|SKIPPED" "$FILE_PATH" 2>/dev/null; then
        echo ""
        echo "BLOCKED: DEFERRED/SKIPPED found in markdown"
        echo "File: $FILE_PATH"
        echo ""
        echo "Don't defer critical work. Either:"
        echo "  - Do it now"
        echo "  - Remove it from the plan entirely"
        echo "  - Mark as 'OUT OF SCOPE: <reason>'"
        exit 1
    fi
fi

exit 0
