import { z } from "zod";
export const allowedKeys = ["theme", "lang"];
export const settingsBodySchema = z.object({
    theme: z.enum(["light", "dark", "system"]).optional(),
    lang: z.string().min(2).max(10).optional(),
}).strict();
