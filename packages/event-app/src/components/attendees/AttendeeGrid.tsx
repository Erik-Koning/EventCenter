import { ATTENDEES } from "@/data/attendees";
import { AttendeeCard } from "./AttendeeCard";

export function AttendeeGrid() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {ATTENDEES.map((attendee) => (
        <AttendeeCard key={attendee.id} attendee={attendee} />
      ))}
    </div>
  );
}
