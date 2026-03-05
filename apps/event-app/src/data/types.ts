export interface Speaker {
  id: string;
  name: string;
  title: string;
  company: string | null;
  bio: string;
  imageUrl: string | null;
  initials: string;
}

export interface Session {
  id: string;
  title: string;
  description: string | null;
  date: string;
  startTime: string; // "09:00" format
  endTime: string; // "10:00" format
  location: string | null;
  track?: "Leadership" | "Technology" | "Strategy" | "Innovation" | "Culture" | null;
  tags: string[] | null;
  eventId: string | null;
  speakers: Speaker[];
  isUserSubmitted?: boolean;
}

export interface Attendee {
  id: string;
  name: string;
  title: string | null;
  imageUrl: string | null;
  initials: string | null;
  isSpeaker: boolean;
}

export interface EventInfo {
  id: string;
  title: string;
  description: string | null;
  startDate: string;
  endDate: string;
  venue: string | null;
  location: string | null;
}
