"use client";

import type { Child } from "@/src/lib/db/children";
import { buildReminderMessage, buildWhatsAppLink } from "@/src/lib/whatsapp";
import { monthLabel } from "./MonthRow";

export type UnpaidMonthStatus = {
  month: string;
  due: number;
  paid: number;
  status: "paid" | "partial" | "missing";
};

export type UnpaidChild = {
  childId: string;
  childName: string;
  className?: string;
  classColor?: string;
  payerId?: string;
  payerName?: string;
  payerRelation?: string;
  payerPhone?: string;
  months: UnpaidMonthStatus[];
  fullChild: Child;
};

export type UnpaidListProps = {
  children: UnpaidChild[];
  fullyPaidCount?: number;
  selectedChildId?: string | null;
  onSelectChild?: (childId: string) => void;
};

export default function UnpaidList({
  children,
  fullyPaidCount,
  selectedChildId,
  onSelectChild,
}: UnpaidListProps) {
  return (
    <div className="yd-unpaid-children yd-stack">
      {children.map((child) => (
        <UnpaidChildCard
          key={child.childId}
          child={child}
          selected={selectedChildId === child.childId}
          onSelectChild={onSelectChild}
        />
      ))}
      {typeof fullyPaidCount === "number" && fullyPaidCount > 0 && (
        <div className="yd-card yd-pad yd-row yd-fully-paid-summary">
          <span>{fullyPaidCount} ילדים ששילמו החודש</span>
        </div>
      )}
    </div>
  );
}

function genderIcon(gender: string | null): string {
  if (gender === "בן") return "♂";
  if (gender === "בת") return "♀";
  return "";
}

function UnpaidChildCard({
  child,
  selected,
  onSelectChild,
}: {
  child: UnpaidChild;
  selected: boolean;
  onSelectChild?: UnpaidListProps["onSelectChild"];
}) {
  const owedMonths = child.months.filter((month) => month.status !== "paid");
  const total = owedMonths.reduce((sum, month) => sum + (month.due - month.paid), 0);
  const fullyPaidInScope = owedMonths.length === 0;
  const avatarColor = child.classColor ?? "var(--paper-sunk)";

  const whatsappLink =
    !fullyPaidInScope && child.payerPhone
      ? buildWhatsAppLink(
          child.payerPhone,
          buildReminderMessage({
            parentFirstName: child.payerName?.trim().split(/\s+/)[0] ?? child.payerName ?? "",
            items: [
              {
                childName: child.childName,
                className: child.className ?? "",
                monthsOwed: owedMonths.map((month) => monthLabel(month.month)),
              },
            ],
            total,
          }),
        )
      : null;

  return (
    <div
      className={`yd-card yd-unpaid-child${selected ? " selected" : ""}`}
      onClick={() => onSelectChild?.(child.childId)}
      role="button"
      tabIndex={0}
    >
      <div className="yd-unpaid-child-head">
        <span
          className="yd-avatar"
          style={{ background: avatarColor }}
          aria-hidden="true"
        >
          {genderIcon(child.fullChild.gender)}
        </span>
        <div className="info">
          <span className="name">
            {child.childName}
            {child.className && <span className="yd-chip small">{child.className}</span>}
          </span>
          {child.payerName && (
            <span className="small muted">
              {child.payerName}
              {child.payerRelation ? ` (${child.payerRelation})` : ""}
            </span>
          )}
        </div>
        {whatsappLink && (
          <a
            href={whatsappLink}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="שליחת תזכורת ב-WhatsApp"
            className="yd-btn icon ghost whatsapp-icon"
            onClick={(event) => event.stopPropagation()}
          >
            <WhatsAppIcon />
          </a>
        )}
        {fullyPaidInScope ? (
          <span className="yd-chip paid">
            <span className="dot" />
            שולם
          </span>
        ) : (
          <span className="amt">{total.toLocaleString("he-IL")} ₪</span>
        )}
      </div>
    </div>
  );
}

function WhatsAppIcon() {
  return (
    <svg
      className="ic"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
      <path d="M12.004 2.004c-5.514 0-9.99 4.476-9.99 9.99 0 1.76.46 3.483 1.335 5.003L2 22l5.136-1.33a9.96 9.96 0 0 0 4.868 1.24h.004c5.514 0 9.99-4.476 9.99-9.99 0-2.669-1.04-5.177-2.927-7.064a9.927 9.927 0 0 0-7.067-2.852zm0 18.19h-.003a8.3 8.3 0 0 1-4.233-1.16l-.304-.18-3.048.79.813-2.971-.198-.306a8.258 8.258 0 0 1-1.267-4.373c0-4.566 3.717-8.283 8.287-8.283a8.228 8.228 0 0 1 5.861 2.432 8.228 8.228 0 0 1 2.426 5.859c0 4.566-3.718 8.282-8.284 8.282z" />
    </svg>
  );
}
