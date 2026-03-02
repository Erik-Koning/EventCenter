import { PageHeader } from "@/components/layout/PageHeader";
import { SessionList } from "@/components/sessions/SessionList";

export default function SessionsPage() {
  return (
    <>
      <PageHeader
        title="Sessions"
        subtitle="Browse all sessions and upvote the ones you're excited about"
      />

      <SessionList />
    </>
  );
}
