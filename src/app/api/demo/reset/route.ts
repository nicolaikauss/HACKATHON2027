import { handle } from "@/server/runtime";
export async function POST(request: Request) { return handle("reset",request); }
