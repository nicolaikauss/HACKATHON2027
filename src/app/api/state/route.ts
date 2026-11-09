import { handle } from "@/server/runtime";
export async function GET(request: Request) { return handle("state",request); }
