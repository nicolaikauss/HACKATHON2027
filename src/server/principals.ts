import type { Principal } from "./types";
import { GateError } from "./errors";

export function requireHuman(principal: Principal): void {
  if (principal.kind !== "human") throw new GateError("human_required", 403);
}
export function requireAgent(principal: Principal): void {
  if (principal.kind !== "agent") throw new GateError("agent_required", 403);
}
