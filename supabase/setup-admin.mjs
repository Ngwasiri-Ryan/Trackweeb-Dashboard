#!/usr/bin/env node
/** @deprecated Use `npm run setup` — runs idempotent ensure-setup.mjs */
import { ensureSetup } from "./ensure-setup.mjs";

ensureSetup()
  .then((result) => {
    if (result.skipped && result.reason) {
      console.warn(result.reason);
    }
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
