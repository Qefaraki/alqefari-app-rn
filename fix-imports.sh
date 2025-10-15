#!/bin/bash

# Fix all test file imports to use CommonJS

for file in __tests__/rpc/*.test.js; do
  # Fix fixture requires (remove extra quotes/parentheses)
  sed -i '' 's/require( .*profileFixtures.js".*$/require("..\/fixtures\/profileFixtures.js");/g' "$file"
  sed -i '' 's/require( .*auditLogFixtures.js".*$/require("..\/fixtures\/auditLogFixtures.js");/g' "$file"
  sed -i '' 's/require( .*userFixtures.js".*$/require("..\/fixtures\/userFixtures.js");/g' "$file"

  # Convert all import statements to require for utils
  sed -i '' 's/^import {/const {/g' "$file"
  sed -i '' 's/} from /} = require(/g' "$file"
  sed -i '' "s/'\.\.\/utils\/\(.*\)\.js';/\"..\/utils\/\1.js\");/g" "$file"
done

echo "✅ Fixed all imports in test files"
