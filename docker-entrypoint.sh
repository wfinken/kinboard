#!/bin/sh
set -e

echo "Applying database migrations..."
node --experimental-strip-types ./apps/api/src/db/migrate.ts

echo "Starting KinBoard..."
exec node ./apps/api/dist/server/entry.mjs
