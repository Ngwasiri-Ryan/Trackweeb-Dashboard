import type { Plugin } from "vite";

type SetupResult = {
  alreadySetup: boolean;
  skipped?: boolean;
  reason?: string;
  schemaApplied?: boolean;
  adminApplied?: boolean;
};

export function ensureSetupPlugin(): Plugin {
  let setupPromise: Promise<SetupResult> | null = null;

  async function runSetup(): Promise<SetupResult> {
    if (!setupPromise) {
      setupPromise = import("./supabase/ensure-setup.mjs").then(({ ensureSetup }) => ensureSetup({ silent: false }));
    }
    return setupPromise;
  }

  return {
    name: "trackweeb-ensure-setup",
    configureServer(server) {
      void runSetup();

      server.middlewares.use("/api/ensure-setup", (req, res) => {
        if (req.method !== "GET" && req.method !== "POST") {
          res.statusCode = 405;
          res.end("Method not allowed");
          return;
        }

        runSetup()
          .then((result) => {
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify(result));
          })
          .catch((err: unknown) => {
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            res.end(
              JSON.stringify({
                alreadySetup: false,
                error: err instanceof Error ? err.message : String(err),
              }),
            );
          });
      });
    },
  };
}
