import { clsx } from "clsx";

const LABELS = {
  green: "Пригласить немедленно",
  yellow: "Рассмотреть дополнительно",
  red: "Низкий приоритет",
};

const ICONS = { green: "🟢", yellow: "🟡", red: "🔴" };

export default function RecommendationBadge({ rec }: { rec: string | null }) {
  if (!rec) return null;
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
        rec === "green" && "bg-green-100 text-green-800",
        rec === "yellow" && "bg-yellow-100 text-yellow-800",
        rec === "red" && "bg-red-100 text-red-800"
      )}
    >
      {ICONS[rec as keyof typeof ICONS]} {LABELS[rec as keyof typeof LABELS]}
    </span>
  );
}
