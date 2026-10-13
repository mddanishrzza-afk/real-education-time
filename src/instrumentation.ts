import { getProductionConfigErrors } from "@/lib/env";

type RequestInfo = { path: string; method: string; headers: Record<string, string | string[] | undefined> };
type RequestContext = { routerKind: string; routePath: string; routeType: string; renderSource?: string };

export async function register() {
  const errors = getProductionConfigErrors();
  if (errors.length) console.error("Production configuration is incomplete", { missingOrInvalidCount: errors.length });
}

/** Next.js request-error hook; structured console output is captured by Vercel logs/drains. */
export function onRequestError(error: unknown, request: RequestInfo, context: RequestContext) {
  const safeError = error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : { message: "Unknown request error" };
  console.error("Unhandled request error", {
    error: safeError,
    method: request.method,
    path: request.path,
    routerKind: context.routerKind,
    routePath: context.routePath,
    routeType: context.routeType,
  });
}
