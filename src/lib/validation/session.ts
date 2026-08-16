import { z } from "zod";

export const logSessionSchema = z.object({
  pocId: z.uuid(),
  seekerId: z.uuid(),
  seekerEmail: z.email(),
  kwh: z.coerce.number().positive().max(500),
});
