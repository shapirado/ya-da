export type MissingTotalMonth = {
  due: number;
  paid: number;
  status: "paid" | "partial" | "missing";
};

export type MissingTotalChild = {
  months: MissingTotalMonth[];
};

export type MissingTotalProps = {
  children: MissingTotalChild[];
};

export function sumMissing(children: MissingTotalChild[]): number {
  return children.reduce(
    (total, child) =>
      total +
      child.months
        .filter((month) => month.status !== "paid")
        .reduce((sum, month) => sum + (month.due - month.paid), 0),
    0,
  );
}

export default function MissingTotal({ children }: MissingTotalProps) {
  const amount = sumMissing(children);

  return (
    <div className="yd-card yd-stat missing">
      <div className="label">
        <span className="small muted">חסר כרגע</span>
      </div>
      <div className="value">
        {amount.toLocaleString("he-IL")} <small>₪</small>
      </div>
    </div>
  );
}
