#!/bin/bash
# Hook: Check if exports in a new/modified file duplicate existing functions
# Runs AFTER file is written

FILE_PATH="$1"

# Skip non-TypeScript or non-source files
[[ ! "$FILE_PATH" =~ \.ts$ ]] && exit 0
[[ ! "$FILE_PATH" =~ ^packages/[^/]+/src/ ]] && exit 0
[[ "$FILE_PATH" == *".spec.ts" ]] && exit 0
[[ "$FILE_PATH" == */tests/* ]] && exit 0

# Extract exported function/class/const names from the file
EXPORTS=$(grep -E "^export (function|class|const|interface|type) " "$FILE_PATH" 2>/dev/null | \
    sed -E 's/^export (function|class|const|interface|type) ([a-zA-Z_][a-zA-Z0-9_]*).*/\2/' | \
    sort -u)

if [[ -z "$EXPORTS" ]]; then
    exit 0
fi

DUPLICATES_FOUND=0

for name in $EXPORTS; do
    # Skip very common names
    [[ "$name" == "options" ]] && continue
    [[ "$name" == "config" ]] && continue
    [[ "$name" == "Options" ]] && continue
    [[ "$name" == "Config" ]] && continue

    # Search for same name exported elsewhere (not in this file)
    EXISTING=$(grep -rl --include="*.ts" "^export.*\b${name}\b" packages/*/src/ 2>/dev/null | \
        grep -v "$FILE_PATH" | \
        grep -v ".spec.ts" | \
        grep -v "/tests/" | \
        head -3)

    if [[ -n "$EXISTING" ]]; then
        if [[ $DUPLICATES_FOUND -eq 0 ]]; then
            echo ""
            echo "========================================================"
            echo "WARNING: Potential duplicate exports detected"
            echo "========================================================"
        fi
        echo ""
        echo "  '$name' is also exported in:"
        echo "$EXISTING" | sed 's/^/    /'
        DUPLICATES_FOUND=1
    fi
done

if [[ $DUPLICATES_FOUND -eq 1 ]]; then
    echo ""
    echo "Review these duplicates. If they do the same thing, use the existing one."
    echo "========================================================"
    echo ""
    # Warning only, don't block (might be intentional)
fi

exit 0
