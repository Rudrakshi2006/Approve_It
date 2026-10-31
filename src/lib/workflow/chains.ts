import { z } from "zod";

export const ResolverSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("applicant_selected"),
  }),
  z.object({
    kind: z.literal("role_same_department"),
    role: z.string().min(1),
  }),
  z.object({
    kind: z.literal("role"),
    role: z.string().min(1),
  }),
  z.object({
    kind: z.literal("app_role"),
    app_role: z.string().min(1),
  }),
  z.object({
    kind: z.literal("assignment"),
    scope_key: z.string().optional().nullable(),
  }),
]);

export type StepResolver = z.infer<typeof ResolverSchema>;

export const StepConfigSchema = z.object({
  step_key: z.string().min(1),
  label: z.string().min(1),
  resolver: ResolverSchema,
  can_reject: z.boolean().optional(),
  can_return: z.boolean().optional(),
  comment_required_on_reject: z.boolean().optional(),
  comment_required_on_return: z.boolean().optional(),
  comment_required_on_forward: z.boolean().optional(),
  attendance_required: z.boolean().optional(),
  decision_label: z.string().optional(),
});

export type StepConfig = z.infer<typeof StepConfigSchema>;

export const ChainSchema = z.array(StepConfigSchema).min(1);

export type ApprovalChain = z.infer<typeof ChainSchema>;

export function parseChain(raw: unknown): ApprovalChain {
  return ChainSchema.parse(raw);
}
