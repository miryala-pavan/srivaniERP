#!/bin/bash
set -e
cd /var/srivani/app

echo "--- git status before ---"
git status --short

DIRTY=$(git status --porcelain --untracked-files=no)
if [ -n "$DIRTY" ]; then
  echo "--- stashing local working-tree drift (recoverable via 'git stash list') ---"
  git stash push -m "pre-git-deploy-reconcile-$(date +%Y%m%d_%H%M%S)"
fi

echo "--- pulling origin/master (fast-forward only - fails loudly instead of merging/rewriting if history diverged) ---"
git pull --ff-only origin master

echo "--- git log after pull ---"
git log --oneline -5
