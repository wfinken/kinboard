#!/bin/sh
set -e

echo "Applying database migrations..."
node --experimental-strip-types ./src/db/migrate.ts

echo "Starting KinBoard..."
exec node ./dist/server/entry.mjs
