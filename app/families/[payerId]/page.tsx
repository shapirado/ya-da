import AppShell from "@/src/components/AppShell";
import ChildEditor from "@/src/components/families/ChildEditor";
import PayerEditor from "@/src/components/families/PayerEditor";
import { listPayers } from "@/src/lib/db/payers";
import { listChildrenWithPayer } from "@/src/lib/db/children";
import { listClassGroups } from "@/src/lib/db/classGroups";
import { listReceiptLinesForChild } from "@/src/lib/db/receipts";
import { monthLabel } from "@/src/components/dashboard/MonthRow";
import { saveChild, savePrice, savePayer } from "../actions";

// Always show today's live data rather than a build-time snapshot.
export const dynamic = "force-dynamic";

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

  const childrenWithHistory = await Promise.all(
    familyChildren.map(async (child) => ({
      child,
      history: await listReceiptLinesForChild(child.id),
    })),
  );

  return (
    <AppShell>
      <div className="yd-stack">
        <h1 className="yd-title">{payer.displayName}</h1>

        <PayerEditor payer={payer} onSavePayer={savePayer} />

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
