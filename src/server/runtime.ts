import { createBackend } from "./backend";
import { productionDatabase } from "./db";
import { productionProvider } from "./payments";
import { createHttpHandlers } from "./http";
import { errorResponse } from "./errors";

let handlers: ReturnType<typeof createHttpHandlers> | undefined;
export async function handle(name: keyof ReturnType<typeof createHttpHandlers>, request: Request): Promise<Response> {
  try {
    handlers ??= createHttpHandlers(createBackend(productionDatabase(),productionProvider()));
    return await handlers[name](request);
  } catch(error) { return errorResponse(error); }
}
