import { z } from "zod";
import { DASHBOARD_WIDGET_KEYS } from "@/lib/dashboard/widgets";

const widgetKeySchema = z.enum(DASHBOARD_WIDGET_KEYS);

export const dashboardLayoutSchema = z
  .object({
    order: z.array(widgetKeySchema),
    hidden: z.array(widgetKeySchema),
  })
  .strict();
