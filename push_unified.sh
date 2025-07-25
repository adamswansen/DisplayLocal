#!/bin/bash

echo "🚀 Adding unified Race Display to new branch..."

# Create new branch
git checkout -b unified-version

# Create all the unified files
echo "Creating unified files..."

# [The script will create all files here]
# Then add and commit them

git add app_unified.py config_unified.py run.sh .env.example README_unified.md
git add Dockerfile docker-compose.yml init-db.sql

git commit -m "Add unified Race Display version"

echo "✅ Done! Push with: git push origin unified-version"
