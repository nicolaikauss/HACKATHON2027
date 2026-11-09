import { handle } from "@/server/runtime";
export async function POST(request: Request) { return handle("nextWeek",request); }
