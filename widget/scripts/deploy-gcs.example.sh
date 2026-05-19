#!/usr/bin/env bash
# Example: sync prepared static files to a public GCS bucket (replace placeholders).
# Prerequisites: `yarn prepare-hosting` in this directory, `gcloud` auth, bucket created.
#
#   gsutil mb -l us-central1 gs://YOUR_BUCKET
#   gsutil iam ch allUsers:objectViewer gs://YOUR_BUCKET
#
set -euo pipefail
BUCKET="${BUCKET:-gs://YOUR_BUCKET_NAME}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WIDGET_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$WIDGET_ROOT"
yarn prepare-hosting
yarn verify:hosting
# Rsync public site root to bucket root (HTTPS + website config is separate — see widget README).
gsutil -m rsync -r -d hosting/public "${BUCKET}"
