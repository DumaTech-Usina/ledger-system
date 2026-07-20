import { type HTMLAttributes, type TdHTMLAttributes, type ThHTMLAttributes } from "react";
import { cn } from "@/utils/cn";

function Root({ className, ...props }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-x-auto">
      <table className={cn("w-full border-collapse text-sm", className)} {...props} />
    </div>
  );
}

function Head({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn(className)} {...props} />;
}

function Body({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn(className)} {...props} />;
}

function Row({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn("border-b border-line last:border-0", className)} {...props} />;
}

function HeaderCell({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        "px-4 py-2.5 text-left text-[12.5px] font-semibold uppercase tracking-wide text-muted",
        className,
      )}
      {...props}
    />
  );
}

function Cell({ className, mono, ...props }: TdHTMLAttributes<HTMLTableCellElement> & { mono?: boolean }) {
  return <td className={cn("px-4 py-3", mono && "tabular", className)} {...props} />;
}

export const Table = { Root, Head, Body, Row, HeaderCell, Cell };
