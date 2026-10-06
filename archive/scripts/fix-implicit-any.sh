#!/bin/bash
# Script to help fix implicit any types by showing file-by-file errors

echo "TypeScript Implicit Any Errors by File:"
echo "========================================"
echo ""

npx tsc --noEmit 2>&1 | \
  grep "error TS7006\|error TS7031\|error TS7018\|error TS7023\|error TS7010" | \
  cut -d'(' -f1 | \
  sort | uniq -c | sort -rn

echo ""
echo "Total implicit any errors:"
npx tsc --noEmit 2>&1 | \
  grep "error TS7006\|error TS7031\|error TS7018\|error TS7023\|error TS7010" | \
  wc -l
