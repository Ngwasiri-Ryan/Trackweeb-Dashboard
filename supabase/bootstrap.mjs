#!/usr/bin/env node
/** @deprecated Use `npm run setup` */
import { ensureSetup } from "./ensure-setup.mjs";

ensureSetup().catch((err) => {
  console.error(err);
  process.exit(1);
});
