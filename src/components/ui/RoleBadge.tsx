import type { Role } from "@/generated/prisma/enums";

const LABELS: Partial<Record<Role, string>> = {
  ADMIN: "Админ",
  TRAINER: "Треньор",
};

/**
 * The staff role pill shown beside a person's greeting or heading. Renders nothing for an
 * ordinary customer — "Потребител" would be noise on every profile.
 */
export default function RoleBadge({ role }: { role: Role }) {
  const label = LABELS[role];
  if (!label) return null;

  return (
    <span className="inline-flex items-center rounded-full bg-brand-500/15 px-2.5 py-1 align-middle text-xs font-semibold text-brand-400">
      {label}
    </span>
  );
}
