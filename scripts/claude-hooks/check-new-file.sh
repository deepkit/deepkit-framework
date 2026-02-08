#!/bin/bash
# Hook: BLOCK new source files unless import already exists
# Forces workflow: edit existing file FIRST, then create new file

FILE_PATH="$1"

# Skip non-TypeScript
[[ ! "$FILE_PATH" =~ \.ts$ ]] && exit 0

# Skip if file exists (editing, not creating)
[[ -f "$FILE_PATH" ]] && exit 0

# === EXCEPTIONS ===
[[ "$FILE_PATH" == *".spec.ts" ]] && exit 0
[[ "$FILE_PATH" == */tests/* ]] && exit 0
[[ "$FILE_PATH" == */benchmarks/* ]] && exit 0
[[ "$FILE_PATH" == *".bench.ts" ]] && exit 0
[[ "$FILE_PATH" == *"/index.ts" ]] && exit 0
[[ "$FILE_PATH" == *"/main.ts" ]] && exit 0
[[ "$FILE_PATH" == *"/cli.ts" ]] && exit 0
[[ "$FILE_PATH" == *".d.ts" ]] && exit 0
[[ "$FILE_PATH" == scripts/* ]] && exit 0
[[ ! "$FILE_PATH" =~ ^packages/[^/]+/src/ ]] && exit 0

# === THE GAME: Prove integration exists ===

MODULE_NAME=$(basename "${FILE_PATH%.ts}")

# Check 1: Is there already a file that imports this module?
# Look in both staged files and working directory
IMPORT_PATTERN="from ['\"].*${MODULE_NAME}['\"]"

# Search all .ts files for an import of this module
IMPORTING_FILE=$(grep -rl --include="*.ts" "$IMPORT_PATTERN" packages/ 2>/dev/null | grep -v ".spec.ts" | grep -v "/tests/" | head -1)

if [[ -n "$IMPORTING_FILE" ]]; then
    echo ""
    echo "✓ Integration verified: $IMPORTING_FILE imports '$MODULE_NAME'"
    echo "  Proceeding with file creation."
    echo ""
    exit 0
fi

# Check 2: Is there a staged file with the import?
STAGED_IMPORT=$(git diff --cached --name-only 2>/dev/null | xargs grep -l "$IMPORT_PATTERN" 2>/dev/null | head -1)

if [[ -n "$STAGED_IMPORT" ]]; then
    echo ""
    echo "✓ Integration verified: staged file $STAGED_IMPORT imports '$MODULE_NAME'"
    echo "  Proceeding with file creation."
    echo ""
    exit 0
fi

# Check 3: Is there a modified (unstaged) file with the import?
MODIFIED_IMPORT=$(git diff --name-only 2>/dev/null | xargs grep -l "$IMPORT_PATTERN" 2>/dev/null | head -1)

if [[ -n "$MODIFIED_IMPORT" ]]; then
    echo ""
    echo "✓ Integration verified: modified file $MODIFIED_IMPORT imports '$MODULE_NAME'"
    echo "  Proceeding with file creation."
    echo ""
    exit 0
fi

# === BLOCKED: No integration found ===
echo ""
echo "========================================================"
echo "BLOCKED: Cannot create $FILE_PATH"
echo "========================================================"
echo ""
echo "No file imports '${MODULE_NAME}' yet."
echo ""
echo "TO PROCEED, you must FIRST:"
echo "  1. Edit an EXISTING file to add:"
echo "     import { ... } from './${MODULE_NAME}.js';"
echo "  2. Then try creating this file again"
echo ""
echo "This ensures no orphan files are created."
echo ""
echo "If this is a false positive, the user can manually create the file."
echo "========================================================"
echo ""

exit 1
