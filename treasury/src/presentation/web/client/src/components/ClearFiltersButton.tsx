import { Button, type ButtonProps } from "@/components/Button";
import { useLanguage } from "@/i18n/i18n";

function BroomIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="size-4">
      {/* Handle */}
      <path d="M15.5 3.5 9.5 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      {/* Bristle skirt */}
      <path d="M9.5 10 4.5 16.5M9.5 10 13 16.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4.5 16.5h8.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      {/* Bristle texture */}
      <path d="M6.6 13.4 5.6 16.5M8.4 13v3.5M10.4 13.3l1 3.2" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
    </svg>
  );
}

/** The one "clear filters" affordance in the app — same warm accent and broom icon everywhere it appears. */
export function ClearFiltersButton(props: Omit<ButtonProps, "variant" | "children">) {
  const { t } = useLanguage();
  return (
    <Button variant="warn" size="sm" {...props}>
      <BroomIcon />
      {t.filters.clear}
    </Button>
  );
}
