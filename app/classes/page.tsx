import AppShell from "@/src/components/AppShell";
import ClassesSettings from "@/src/components/classes/ClassesSettings";
import type { ClassGroupInput } from "@/src/lib/db/classGroups";
import {
  getDefaultPrices,
  listClassGroupsWithEnrollment,
  saveClassGroup,
  saveDefaultPrices,
  type DefaultPrices,
} from "./actions";

// Enrollment counts are a live, derived count of active children per
// group, so always show the current state rather than a build-time one.
export const dynamic = "force-dynamic";

export default async function ClassesPage() {
  const [groups, defaultPrices] = await Promise.all([
    listClassGroupsWithEnrollment(),
    getDefaultPrices(),
  ]);

  async function handleSaveGroup(id: string, input: Partial<ClassGroupInput>) {
    "use server";
    await saveClassGroup(id, input);
  }

  async function handleSaveDefaultPrices(input: Partial<DefaultPrices>) {
    "use server";
    await saveDefaultPrices(input);
  }

  return (
    <AppShell>
      <div className="yd-stack">
        <h1 className="yd-title">חוגים</h1>
        <ClassesSettings
          groups={groups}
          defaultPrices={defaultPrices}
          onSaveGroup={handleSaveGroup}
          onSaveDefaultPrices={handleSaveDefaultPrices}
        />
      </div>
    </AppShell>
  );
}
