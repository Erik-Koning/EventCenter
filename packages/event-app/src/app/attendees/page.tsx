import { PageHeader } from "@/components/layout/PageHeader";
import { AttendeeGrid } from "@/components/attendees/AttendeeGrid";
import { ATTENDEES } from "@/data/attendees";

export default function AttendeesPage() {
  return (
    <>
      <PageHeader
        title="Attendees"
        subtitle={`${ATTENDEES.length} executives attending the offsite`}
      />
      <AttendeeGrid />
    </>
  );
}
