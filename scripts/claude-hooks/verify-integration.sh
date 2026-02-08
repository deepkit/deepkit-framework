#!/bin/bash
# Verify new source files are imported somewhere
# Run this before committing!

# Exceptions - files that don't need to be imported:
# - Test files: *.spec.ts, */tests/*
# - Benchmark files: */benchmarks/*, *.bench.ts
# - Index files: index.ts (they are the importers)
# - Entry points: main.ts, cli.ts, bin.ts
# - Type declaration files: *.d.ts

is_exception() {
    local file="$1"

    # Test files
    [[ "$file" == *".spec.ts" ]] && return 0
    [[ "$file" == */tests/* ]] && return 0
    [[ "$file" == */test/* ]] && return 0

    # Benchmark files
    [[ "$file" == */benchmarks/* ]] && return 0
    [[ "$file" == *".bench.ts" ]] && return 0

    # Index/entry files
    [[ "$file" == *"/index.ts" ]] && return 0
    [[ "$file" == *"/main.ts" ]] && return 0
    [[ "$file" == *"/cli.ts" ]] && return 0
    [[ "$file" == *"/bin.ts" ]] && return 0

    # Type declarations
    [[ "$file" == *".d.ts" ]] && return 0

    # Scripts directory
    [[ "$file" == scripts/* ]] && return 0

    # Not an exception
    return 1
}

echo "Checking for unintegrated source files..."

FAILED=0

# Check all staged NEW .ts files in packages/*/src/
for file in $(git diff --cached --name-only --diff-filter=A | grep -E "^packages/[^/]+/src/.*\.ts$"); do

    # Skip exceptions
    if is_exception "$file"; then
        continue
    fi

    # Extract the module name (filename without .ts and .js extension reference)
    module=$(basename "${file%.ts}")

    # Check if any file imports this module
    # Look for: from './module' or from '../path/module' etc
    if ! grep -r --include="*.ts" "from ['\"].*/${module}['\"]" packages/ 2>/dev/null | grep -v "$file" | grep -v "\.spec\.ts" | grep -q .; then
        # Also check for imports without path (just module name at end)
        if ! grep -r --include="*.ts" "from ['\"].*${module}['\"]" packages/ 2>/dev/null | grep -v "$file" | grep -v "\.spec\.ts" | grep -q .; then
            echo ""
            echo "ERROR: Unintegrated file: $file"
            echo "       No production code imports '${module}'"
            echo "       Either import it somewhere or delete it."
            FAILED=1
        fi
    fi
done

if [[ $FAILED -eq 1 ]]; then
    echo ""
    echo "=========================================="
    echo "COMMIT BLOCKED: Unintegrated files found"
    echo "=========================================="
    echo ""
    echo "New source files must be imported by production code."
    echo "Exceptions: tests, benchmarks, index.ts, main.ts, cli.ts"
    echo ""
    echo "Fix the issues above before committing."
    exit 1
fi

echo "All new files are integrated (or are valid exceptions)."
exit 0
