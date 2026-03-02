export interface Speaker {
  id: string;
  name: string;
  title: string;
  company: string;
  bio: string;
  imageUrl: string;
  initials: string;
}

export interface Session {
  id: string;
  title: string;
  description: string;
  speakerId: string;
  day: 1 | 2 | 3;
  startTime: string; // "09:00" format
  endTime: string; // "10:00" format
  location: string;
  track?: "Leadership" | "Technology" | "Strategy" | "Innovation" | "Culture";
  tags: string[];
  isUserSubmitted?: boolean;
}

export interface Attendee {
  id: string;
  name: string;
  title: string;
  company: string;
  imageUrl: string;
  initials: string;
}

export interface EventInfo {
  name: string;
  tagline: string;
  dates: {
    day1: string;
    day2: string;
    day3: string;
  };
  venue: string;
  location: string;
  purpose: string;
}
