import { FilterX } from "lucide-react";
import { Button, type ButtonProps } from "@/components/Button";
import { useLanguage } from "@/i18n/i18n";

/** The one "clear filters" affordance in the app — same warm accent and icon everywhere it appears. */
export function ClearFiltersButton(props: Omit<ButtonProps, "variant" | "children">) {
  const { t } = useLanguage();
  return (
    <Button variant="warn" size="sm" {...props}>
      <FilterX className="size-4" strokeWidth={1.5} />
      {t.filters.clear}
    </Button>
  );
}
