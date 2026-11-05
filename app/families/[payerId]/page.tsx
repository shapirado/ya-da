import AppShell from "@/src/components/AppShell";
import ChildEditor from "@/src/components/families/ChildEditor";
import PayerEditor from "@/src/components/families/PayerEditor";
import WhatsAppReminder from "@/src/components/WhatsAppReminder";
import { listPayers } from "@/src/lib/db/payers";
import { listChildPrices, listChildrenWithPayer } from "@/src/lib/db/children";
import { listClassGroups } from "@/src/lib/db/classGroups";
import { listReceiptLinesForChild } from "@/src/lib/db/receipts";
import { monthLabel } from "@/src/components/dashboard/MonthRow";
import { computeDueStatus } from "@/src/lib/dues";
import type { ReminderItem } from "@/src/lib/whatsapp";
import { saveChild, savePrice, savePayer } from "../actions";

// Always show today's live data rather than a build-time snapshot.
export const dynamic = "force-dynamic";

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

export default async function FamilyDetailPage({
  params,
}: {
  params: Promise<{ payerId: string }>;
}) {
  const { payerId } = await params;

  const [payers, children, classGroups] = await Promise.all([
    listPayers(),
    listChildrenWithPayer(),
    listClassGroups(),
  ]);

  const payer = payers.find((candidate) => candidate.id === payerId);
  const familyChildren = children.filter((child) => child.payerId === payerId);

  if (!payer) {
    return (
      <AppShell>
        <div className="yd-stack">
          <h1 className="yd-title">משפחה לא נמצאה</h1>
        </div>
      </AppShell>
    );
  }

  const asOfMonth = currentMonth();

  const childrenWithHistory = await Promise.all(
    familyChildren.map(async (child) => {
      const [history, prices] = await Promise.all([
        listReceiptLinesForChild(child.id),
        listChildPrices(child.id),
      ]);
      const classGroup = classGroups.find((group) => group.id === child.classGroupId);
      const className = classGroup
        ? [classGroup.day, classGroup.time].filter(Boolean).join(" ")
        : "";
      const statuses = computeDueStatus(
        child.enrollmentStart,
        prices,
        history.map((line) => ({ month: line.month, amount: line.amount })),
        asOfMonth,
      );
      const owedMonths = statuses.filter((status) => status.status !== "paid");
      return { child, history, className, owedMonths };
    }),
  );

  const parentFirstName = payer.displayName.trim().split(/\s+/)[0] ?? payer.displayName;
  const reminderItems: ReminderItem[] = childrenWithHistory
    .filter(({ owedMonths }) => owedMonths.length > 0)
    .map(({ child, className, owedMonths }) => ({
      childName: `${child.firstName} ${child.familyName}`,
      className,
      monthsOwed: owedMonths.map((status) => monthLabel(status.month)),
    }));
  const reminderTotal = childrenWithHistory.reduce(
    (sum, { owedMonths }) => sum + owedMonths.reduce((s, status) => s + (status.due - status.paid), 0),
    0,
  );

  return (
    <AppShell>
      <div className="yd-stack">
        <h1 className="yd-title">{payer.displayName}</h1>

        <PayerEditor payer={payer} onSavePayer={savePayer} />

        <WhatsAppReminder
          parentFirstName={parentFirstName}
          phone={payer.phone}
          items={reminderItems}
          total={reminderTotal}
        />

        <h2 className="small muted" style={{ marginTop: 8 }}>
          ילדים
        </h2>
        {childrenWithHistory.map(({ child, history }) => (
          <div key={child.id} className="yd-stack">
            <ChildEditor
              child={child}
              groups={classGroups}
              onUpdateChild={saveChild}
              onSetPrice={savePrice}
            />
            <div className="yd-card yd-pad yd-stack">
              <span className="small muted">היסטוריית תשלומים · {child.firstName}</span>
              {history.length === 0 ? (
                <span className="small muted">אין תשלומים עדיין</span>
              ) : (
                history
                  .slice()
                  .sort((a, b) => (a.month > b.month ? -1 : 1))
                  .map((line) => (
                    <div key={line.id} className="yd-row" style={{ justifyContent: "space-between" }}>
                      <span>{monthLabel(line.month)}</span>
                      <span>{line.amount.toLocaleString("he-IL")} ₪</span>
                    </div>
                  ))
              )}
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
