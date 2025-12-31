#!/bin/bash

# Script to copy documentation to new repository
# Usage: ./copy-to-repo.sh /path/to/new/repo

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

REPO_PATH="$1"

if [ -z "$REPO_PATH" ]; then
    echo "Usage: $0 /path/to/new/repo"
    echo "Example: $0 ~/projects/docker-mcp-server"
    exit 1
fi

if [ ! -d "$REPO_PATH" ]; then
    echo "Error: Directory $REPO_PATH does not exist"
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DOCS_DIR="$SCRIPT_DIR"

echo -e "${BLUE}📚 Copying documentation to $REPO_PATH${NC}"

# Create docs directory if it doesn't exist
mkdir -p "$REPO_PATH/docs"

# Copy all markdown files and template
echo -e "${GREEN}→ Copying documentation files...${NC}"
cp -v "$DOCS_DIR"/*.md "$REPO_PATH/docs/"
cp -v "$DOCS_DIR"/*.template "$REPO_PATH/docs/" 2>/dev/null || true
cp -v "$DOCS_DIR"/*.txt "$REPO_PATH/docs/" 2>/dev/null || true
cp -v "$DOCS_DIR"/*.sh "$REPO_PATH/docs/" 2>/dev/null || true

echo -e "${GREEN}✅ Documentation copied successfully!${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "1. cd $REPO_PATH"
echo "2. Follow docs/SETUP_INSTRUCTIONS.md"
echo "3. Copy docs/package.json.template to package.json"
echo "4. npm install"
echo "5. Start implementation!"

