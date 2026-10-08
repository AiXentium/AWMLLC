import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { IntakeLimits } from "./shared";

/**
 * Server-enforced intake API. Every size, signature and archive-safety rule is
 * re-checked here; the browser UI only mirrors these limits for feedback.
 */

export const getIntakeLimits = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<IntakeLimits> => {
    const { loadLimits } = await import("./intake-service.server");
    return loadLimits(context.supabase);
  });

export const approveIntakeUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        projectId: z.string().uuid(),
        jobId: z.string().uuid(),
        filename: z.string().min(1).max(400),
        sizeBytes: z.number().int().nonnegative(),
        mimeType: z.string().max(200).nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { approveUpload } = await import("./intake-service.server");
    return approveUpload(context.supabase, context.userId, data);
  });

export const finalizeIntakeUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        intakeFileId: z.string().uuid(),
        checksum: z.string().regex(/^[a-f0-9]{64}$/),
        allowDuplicate: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { finalizeUpload } = await import("./intake-service.server");
    return finalizeUpload(context.supabase, context.userId, data);
  });

export const extractIntakeArchive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ intakeFileId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { extractArchive } = await import("./intake-service.server");
    return extractArchive(context.supabase, context.userId, data.intakeFileId);
  });

export const cancelIntakeFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({ intakeFileId: z.string().uuid(), reason: z.string().max(300).optional() })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { cancelFile } = await import("./intake-service.server");
    return cancelFile(context.supabase, data.intakeFileId, data.reason);
  });
