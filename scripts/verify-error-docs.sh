#!/usr/bin/env bash
#
# Verifies that all error codes used in the codebase are documented in ERRORS.md files.
#
# Usage: ./scripts/verify-error-docs.sh
#
# Exit codes:
#   0 - All error codes are documented
#   1 - Some error codes are missing documentation

set -e
cd "$(dirname "$0")/.."

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

echo "Verifying error code documentation..."
echo ""

HAS_ERRORS=0

# Get all packages that have ERRORS.md
for errors_file in packages/*/ERRORS.md; do
    pkg=$(basename $(dirname "$errors_file"))

    # Find error codes in source files for this package
    codes_in_src=$(grep -roh 'DK-[A-Z]*[0-9]\+' "packages/$pkg/src/" 2>/dev/null | sort -u || true)

    if [ -z "$codes_in_src" ]; then
        echo -e "${GREEN}✓ packages/$pkg/ERRORS.md${NC} - no error codes in source"
        continue
    fi

    # Find documented codes
    codes_in_docs=$(grep -oh '## DK-[A-Z]*[0-9]\+' "$errors_file" 2>/dev/null | sed 's/## //' | sort -u || true)

    # Find undocumented codes
    undocumented=""
    src_count=0
    for code in $codes_in_src; do
        src_count=$((src_count + 1))
        if ! echo "$codes_in_docs" | grep -q "^${code}$"; then
            undocumented="$undocumented $code"
        fi
    done

    if [ -n "$undocumented" ]; then
        HAS_ERRORS=1
        echo -e "${RED}✗ packages/$pkg/ERRORS.md is missing:${NC}"
        for code in $undocumented; do
            echo "    - $code"
        done
        echo ""
    else
        doc_count=$(echo "$codes_in_docs" | grep -c . || echo "0")
        echo -e "${GREEN}✓ packages/$pkg/ERRORS.md${NC} - $src_count codes in source, $doc_count documented"
    fi
done

echo ""
if [ $HAS_ERRORS -eq 1 ]; then
    echo -e "${RED}Error: Some error codes are not documented.${NC}"
    echo "Add documentation for the missing codes to the appropriate ERRORS.md file."
    exit 1
else
    echo -e "${GREEN}All error codes are documented!${NC}"
    exit 0
fi
