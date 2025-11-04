#!/bin/bash
# Update script for index.html

VERSION=$(date +%Y%m%d%H%M%S)

echo "Updating to version: $VERSION"

# Update all script and css references with new version
sed -i "s/\?v=[0-9]*/\?v=$VERSION/g" index.html

echo "✅ Updated! New version: $VERSION"
echo "Restart server: python -m http.server 8000"
