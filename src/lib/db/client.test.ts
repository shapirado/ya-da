import { describe, expect, test } from "vitest";
import { getSupabaseClient } from "./client";

describe("getSupabaseClient", () => {
  test("client can query the payers table", async () => {
    const { error } = await getSupabaseClient()
      .from("payers")
      .select("id")
      .limit(1);
    expect(error).toBeNull();
  });
});
