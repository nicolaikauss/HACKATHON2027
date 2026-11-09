import { z } from "zod";
import type { Backend } from "./backend";
import { GateError } from "./errors";

export const SESSION_COOKIE = "nac_session";
export function readSession(request: Request): string | null {
  const value = request.headers.get("cookie")?.split(";").map(x=>x.trim()).find(x=>x.startsWith(`${SESSION_COOKIE}=`))?.slice(SESSION_COOKIE.length+1);
  const parsed=z.uuid().safeParse(value);
  return parsed.success ? parsed.data : null;
}
export function sessionCookie(request: Request, sessionId: string): string {
  return `${SESSION_COOKIE}=${sessionId}; Path=/; HttpOnly; SameSite=Lax${new URL(request.url).protocol==="https:"?"; Secure":""}`;
}
export async function requireSession(backend: Backend, request: Request): Promise<string> {
  const id=readSession(request);
  if (!id) throw new GateError("session_not_found",401);
  try { await backend.state(id); } catch(error) {
    if(error instanceof GateError && error.code==="session_not_found") throw new GateError("session_not_found",401);
    throw error;
  }
  return id;
}
