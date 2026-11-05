import { redirect } from "next/navigation";

// The app has no landing page of its own: "/" always goes to the dashboard.
export default function Home() {
  redirect("/dashboard");
}
