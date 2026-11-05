import AppShell from "@/src/components/AppShell";
import { type UnpaidChild, type UnpaidMonthStatus } from "@/src/components/dashboard/UnpaidList";
import DashboardBoard, { type DashboardRow } from "@/src/components/dashboard/DashboardBoard";
import RecordPaymentButton from "@/src/components/dashboard/RecordPaymentButton";
import NewStudentButton from "@/src/components/dashboard/NewStudentButton";
import ReceiptReviewList from "@/src/components/receipts/ReceiptReviewList";
import type { CreateReceiptInput } from "@/src/components/RecordPayment/RecordPaymentModal";
import type { CreateStudentInput } from "@/src/components/dashboard/NewStudentModal";
import { listChildPrices, listChildrenWithPayer } from "@/src/lib/db/children";
import { listClassGroups } from "@/src/lib/db/classGroups";
import { listPayers } from "@/src/lib/db/payers";
import { listReceiptLinesForChild, listNeedsReviewReceipts } from "@/src/lib/db/receipts";
import { computeDueStatus, priceForMonth } from "@/src/lib/dues";
import { buildReceiptReviewItems } from "@/src/lib/receiptReviewItems";
import {
  markMonthPaid,
  recordPayment,
  updateChildFromDashboard,
  setChildPriceFromDashboard,
  updatePayerFromDashboard,
  createStudent,
  type MarkMonthPaidInput,
} from "./actions";
import { resolveReceipt, dismissReceipt, type ResolveReceiptLineInput } from "../receipts/actions";

// Always show today's live status rather than a build-time snapshot.
export const dynamic = "force-dynamic";

const RELATION_LABELS: Record<string, string> = {
  mom: "אמא",
  dad: "אבא",
};

const MONTH_NAMES_HEBREW = [
  "ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני",
  "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"
];

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

export default async function DashboardPage() {
  const asOfMonth = currentMonth();
  const currentMonthName = MONTH_NAMES_HEBREW[new Date().getMonth()];

  const [children, classGroups, payers, needsReviewReceipts] = await Promise.all([
    listChildrenWithPayer(),
    listClassGroups(),
    listPayers(),
    listNeedsReviewReceipts(),
  ]);

  const activeChildren = children.filter((child) => child.active);

  const families = payers.map((payer) => ({ id: payer.id, displayName: payer.displayName }));
  const childrenByPayer = activeChildren.reduce<Record<string, { id: string; name: string }[]>>(
    (map, child) => {
      if (!child.payerId) return map;
      const entry = { id: child.id, name: `${child.firstName} ${child.familyName}` };
      map[child.payerId] = [...(map[child.payerId] ?? []), entry];
      return map;
    },
    {},
  );

  const childrenWithStatus = await Promise.all(
    activeChildren.map(async (child) => {
      const [prices, lines] = await Promise.all([
        listChildPrices(child.id),
        listReceiptLinesForChild(child.id),
      ]);
      const statuses: UnpaidMonthStatus[] = computeDueStatus(
        child.enrollmentStart,
        prices,
        lines.map((line) => ({ month: line.month, amount: line.amount })),
        asOfMonth,
      );
      const classGroup = classGroups.find((group) => group.id === child.classGroupId);
      const className = classGroup
        ? [classGroup.day, classGroup.time].filter(Boolean).join(" ")
        : undefined;
      const classColor = classGroup?.color ?? undefined;
      const payerRelation = child.payer?.role
        ? RELATION_LABELS[child.payer.role] ?? child.payer.role
        : undefined;

      return {
        child,
        statuses,
        history: lines,
        owedMonths: statuses.filter((status) => status.status !== "paid"),
        className,
        classColor,
        payerName: child.payer?.displayName,
        payerRelation,
        payerPhone: child.payer?.phone ?? undefined,
        currentPrice: priceForMonth(prices, asOfMonth),
      };
    }),
  );

const childrenDue: UnpaidChild[] = childrenWithStatus
  .filter((entry) => entry.owedMonths.length > 0)
  .map((entry) => ({
    childId: entry.child.id,
    childName: `${entry.child.firstName} ${entry.child.familyName}`,
    className: entry.className,
    classColor: entry.classColor, // <-- pass it here
    payerId: entry.child.payerId ?? undefined,
    payerName: entry.payerName,
    payerRelation: entry.payerRelation,
    payerPhone: entry.payerPhone,
    months: entry.owedMonths,
    fullChild: entry.child,
  }));

  const fullyPaidCount = childrenWithStatus.filter(
    (entry) => entry.statuses.length > 0 && entry.owedMonths.length === 0,
  ).length;

  const dashboardRows: DashboardRow[] = childrenWithStatus.map((entry) => ({
    childId: entry.child.id,
    firstName: entry.child.firstName,
    familyName: entry.child.familyName,
    classGroupId: entry.child.classGroupId,
    className: entry.className,
    classColor: entry.classColor,
    payerId: entry.child.payerId ?? undefined,
    payerName: entry.payerName,
    payerRelation: entry.payerRelation,
    payerPhone: entry.payerPhone,
    statuses: entry.statuses,
    history: entry.history,
    currentPrice: entry.currentPrice,
    fullChild: entry.child,
  }));

  const needsReviewItems = buildReceiptReviewItems(needsReviewReceipts);

  const monthsWithData = Array.from(
    new Set(childrenWithStatus.flatMap((entry) => entry.statuses.map((status) => status.month))),
  ).sort((a, b) => (a > b ? -1 : 1));

  // Aggregate stats
  const totalMissing = childrenDue.reduce((sum, c) => {
    return sum + c.months.reduce((mSum, m) => mSum + (m.due - m.paid), 0);
  }, 0);

  const totalOwedItemsCount = childrenDue.reduce((sum, c) => sum + c.months.length, 0);

  async function handleMarkPaid(childId: string, input: MarkMonthPaidInputFromRow) {
    "use server";
    await markMonthPaid(childId, input.month, {
      amount: input.amount,
      method: input.method,
      receiptNumber: input.receiptNumber,
    });
  }

  async function handleRecordPayment(input: CreateReceiptInput) {
    "use server";
    await recordPayment(input);
  }

  async function handleCreateStudent(input: CreateStudentInput) {
    "use server";
    await createStudent(input);
  }

  async function handleResolveReceipt(lineId: string, input: ResolveReceiptLineInput) {
    "use server";
    await resolveReceipt(lineId, input);
  }

  async function handleDismissReceipt(receiptId: string) {
    "use server";
    await dismissReceipt(receiptId);
  }

  return (
    <AppShell>
      <div
      className="yd-main"
      style={{
        padding: "32px 40px 60px",
        maxWidth: 1140, // or 1000px/1140px depending on preferred tightness
        margin: "0 auto", // centers the entire dashboard view
        width: "100%",
      }}
    >
        {/* Top Header Bar */}
        <header className="yd-topbar" style={{ marginBottom: "var(--space-5)" }}>
          <div>
            <h1 className="yd-title">לוח בקרה</h1>
            <p className="yd muted small" style={{ marginTop: 4 }}>
              מעקב גבייה ותשלומים שוטפים לחוגי האומנות
            </p>
          </div>
          <div className="yd-row">
            <NewStudentButton
              families={families}
              classGroups={classGroups}
              onCreateStudent={handleCreateStudent}
            />
            <RecordPaymentButton
              families={families}
              childrenByPayer={childrenByPayer}
              onRecordPayment={handleRecordPayment}
            />
          </div>
        </header>

        {/* Receipts-to-review queue (only when something needs a look) */}
        {needsReviewItems.length > 0 && (
          <section className="yd-section" style={{ marginBottom: "var(--space-5)" }}>
            <div className="yd-section-head">
              <h2 className="yd-heading">קבלות לבדיקה ({needsReviewItems.length})</h2>
            </div>
            <ReceiptReviewList
              items={needsReviewItems}
              families={families}
              childrenByPayer={childrenByPayer}
              onResolve={handleResolveReceipt}
              onDismiss={handleDismissReceipt}
            />
          </section>
        )}

        {/* 3-Card Summary Deck */}
        <section className="yd-summary" style={{ gridTemplateColumns: "repeat(3, 1fr)", marginBottom: "var(--space-5)" }}>
          {/* Missing / Owed Card */}
          <div className="yd-card yd-stat missing">
            <div className="label">
              <span className="yd-dab" style={{ background: "var(--missing)" }} />
              <span className="yd muted">חוב פתוח לגבייה</span>
            </div>
            <div className="value" style={{ color: "var(--missing-ink)" }}>
              ₪{totalMissing.toLocaleString()}
            </div>
            <div className="sub">
              {childrenDue.length} ילדים ({totalOwedItemsCount} תשלומים ממתינים)
            </div>
          </div>

          {/* Fully Paid Students Card */}
          <div className="yd-card yd-stat collected">
            <div className="label">
              <span className="yd-dab sage" />
              <span className="yd muted">שילמו במלואם ({currentMonthName})</span>
            </div>
            <div className="value" style={{ color: "var(--paid-ink)" }}>
              {fullyPaidCount} <small className="yd muted" style={{ fontSize: 16 }}>ילדים</small>
            </div>
            <div className="sub">
              {activeChildren.length > 0
                ? `${Math.round((fullyPaidCount / activeChildren.length) * 100)}% מכלל התלמידים הפעילים`
                : "אין תלמידים פעילים"}
            </div>
          </div>

          {/* Active Enrollment Card */}
          <div className="yd-card yd-stat">
            <div className="label">
              <span className="yd-dab teal" />
              <span className="yd muted">תלמידים פעילים</span>
            </div>
            <div className="value">
              {activeChildren.length} <small className="yd muted" style={{ fontSize: 16 }}>ילדים</small>
            </div>
            <div className="sub">ב-{classGroups.length} קבוצות לימוד</div>
          </div>
        </section>

        {/* Children List Section (filterable) */}
        <DashboardBoard
          rows={dashboardRows}
          months={monthsWithData}
          classGroups={classGroups}
          payers={payers}
          onMarkPaid={handleMarkPaid}
          onUpdateChild={updateChildFromDashboard}
          onSetPrice={setChildPriceFromDashboard}
          onUpdatePayer={updatePayerFromDashboard}
        />
      </div>
    </AppShell>
  );
}

type MarkMonthPaidInputFromRow = MarkMonthPaidInput & { month: string };