import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  events,
  eventAttendees,
  speakers,
  eventSessions,
  sessionSpeakers,
  attendees,
  users,
} from "@/db/schema";
import { requireAuth } from "@/lib/authorization";
import { handleApiError } from "@/lib/api-error";
import { createId } from "@/lib/utils";

/**
 * POST /api/admin/seed - Seed a full example event with sessions, speakers, attendees
 */
export async function POST() {
  const authResult = await requireAuth({
    permissions: { role: "admin" },
  });
  if (!authResult.success) return authResult.response;

  try {
    // === EVENT ===
    const eventId = createId();
    const [event] = await db
      .insert(events)
      .values({
        id: eventId,
        title: "Executive Leadership Offsite 2026",
        description:
          "A three-day leadership offsite focused on strategy, innovation, and team culture for senior leaders across the organization.",
        startDate: "2026-04-15",
        endDate: "2026-04-17",
        venue: "Fairmont Royal York",
        location: "Toronto, ON",
      })
      .returning();

    // === SPEAKERS ===
    const speakerData = [
      {
        id: createId(),
        name: "Sarah Chen",
        title: "Chief Innovation Officer",
        company: "Scotiabank",
        bio: "Sarah leads enterprise-wide innovation strategy and digital transformation initiatives across global markets.",
        initials: "SC",
      },
      {
        id: createId(),
        name: "Marcus Williams",
        title: "SVP, Technology & Operations",
        company: "Scotiabank",
        bio: "Marcus oversees technology infrastructure and operational excellence, driving cloud adoption and platform modernization.",
        initials: "MW",
      },
      {
        id: createId(),
        name: "Dr. Priya Sharma",
        title: "Head of AI & Data Science",
        company: "Scotiabank",
        bio: "Priya leads the bank's AI center of excellence, focusing on responsible AI deployment and data-driven decision making.",
        initials: "PS",
      },
      {
        id: createId(),
        name: "James O'Brien",
        title: "EVP, People & Culture",
        company: "Scotiabank",
        bio: "James champions organizational culture transformation and talent development strategies for the future of work.",
        initials: "JO",
      },
      {
        id: createId(),
        name: "Elena Rodriguez",
        title: "VP, Strategic Planning",
        company: "Scotiabank",
        bio: "Elena drives long-term strategic planning and competitive intelligence across the bank's business lines.",
        initials: "ER",
      },
      {
        id: createId(),
        name: "David Kim",
        title: "Director, Customer Experience",
        company: "Scotiabank",
        bio: "David leads customer journey design and experience optimization leveraging behavioral insights and emerging technology.",
        initials: "DK",
      },
    ];
    await db.insert(speakers).values(speakerData);

    // === ATTENDEE RECORDS FOR SPEAKERS ===
    const speakerAttendeeRows = speakerData.map((sp) => ({
      id: createId(),
      name: sp.name,
      title: sp.title,
      initials: sp.initials,
      isSpeaker: true,
      company: sp.company,
      bio: sp.bio,
    }));
    await db.insert(attendees).values(speakerAttendeeRows);

    // Link speaker attendees to event
    const speakerEaRows = speakerAttendeeRows.map((a) => ({
      id: createId(),
      eventId,
      attendeeId: a.id,
    }));
    await db.insert(eventAttendees).values(speakerEaRows);

    // === SESSIONS (5 per day × 3 days) ===
    const sessionData = [
      // Day 1 — April 15
      { title: "Opening Keynote: The Future of Banking", description: "Setting the vision for the next decade of financial services.", date: "2026-04-15", startTime: "09:00", endTime: "10:00", location: "Grand Ballroom", track: "Leadership" as const, speakerIdx: 0 },
      { title: "AI-Powered Decision Making", description: "How artificial intelligence is transforming executive decision-making processes.", date: "2026-04-15", startTime: "10:30", endTime: "11:30", location: "Conference Room A", track: "Technology" as const, speakerIdx: 2 },
      { title: "Strategic Planning Workshop", description: "Interactive workshop on adaptive strategy in uncertain markets.", date: "2026-04-15", startTime: "13:00", endTime: "14:30", location: "Workshop Room 1", track: "Strategy" as const, speakerIdx: 4 },
      { title: "Building a Culture of Innovation", description: "Frameworks for embedding innovation into organizational DNA.", date: "2026-04-15", startTime: "15:00", endTime: "16:00", location: "Conference Room B", track: "Innovation" as const, speakerIdx: 0 },
      { title: "Fireside Chat: Leadership Lessons", description: "Candid conversation about leadership challenges and growth.", date: "2026-04-15", startTime: "16:30", endTime: "17:30", location: "Grand Ballroom", track: "Culture" as const, speakerIdx: 3 },
      // Day 2 — April 16
      { title: "Cloud Transformation Roadmap", description: "Accelerating cloud adoption while managing risk and compliance.", date: "2026-04-16", startTime: "09:00", endTime: "10:00", location: "Conference Room A", track: "Technology" as const, speakerIdx: 1 },
      { title: "Customer Experience 2030", description: "Reimagining the customer journey for the next generation.", date: "2026-04-16", startTime: "10:30", endTime: "11:30", location: "Conference Room B", track: "Innovation" as const, speakerIdx: 5 },
      { title: "Talent Strategy for the AI Era", description: "Attracting, developing, and retaining talent in a rapidly changing landscape.", date: "2026-04-16", startTime: "13:00", endTime: "14:00", location: "Workshop Room 1", track: "Culture" as const, speakerIdx: 3 },
      { title: "Data-Driven Growth Strategies", description: "Leveraging data analytics to identify and capture growth opportunities.", date: "2026-04-16", startTime: "14:30", endTime: "15:30", location: "Conference Room A", track: "Strategy" as const, speakerIdx: 2 },
      { title: "Panel: Cross-Functional Collaboration", description: "Breaking silos and fostering collaboration across business lines.", date: "2026-04-16", startTime: "16:00", endTime: "17:00", location: "Grand Ballroom", track: "Leadership" as const, speakerIdx: 4 },
      // Day 3 — April 17
      { title: "Responsible AI Governance", description: "Building ethical AI frameworks and governance structures.", date: "2026-04-17", startTime: "09:00", endTime: "10:00", location: "Conference Room A", track: "Technology" as const, speakerIdx: 2 },
      { title: "Innovation Lab: Rapid Prototyping", description: "Hands-on session designing solutions for real business challenges.", date: "2026-04-17", startTime: "10:30", endTime: "12:00", location: "Workshop Room 1", track: "Innovation" as const, speakerIdx: 5 },
      { title: "Operational Resilience", description: "Strengthening operational resilience in an increasingly complex environment.", date: "2026-04-17", startTime: "13:00", endTime: "14:00", location: "Conference Room B", track: "Strategy" as const, speakerIdx: 1 },
      { title: "Leading Through Change", description: "Practical frameworks for leading teams through transformation.", date: "2026-04-17", startTime: "14:30", endTime: "15:30", location: "Conference Room A", track: "Culture" as const, speakerIdx: 3 },
      { title: "Closing Keynote: Commitments & Next Steps", description: "Synthesizing insights and committing to action plans.", date: "2026-04-17", startTime: "16:00", endTime: "17:00", location: "Grand Ballroom", track: "Leadership" as const, speakerIdx: 0 },
    ];

    const sessionRows = sessionData.map((s) => ({
      id: createId(),
      eventId,
      title: s.title,
      description: s.description,
      date: s.date,
      startTime: s.startTime,
      endTime: s.endTime,
      location: s.location,
      track: s.track,
    }));
    await db.insert(eventSessions).values(sessionRows);

    // === SESSION ↔ SPEAKER LINKS ===
    const ssRows = sessionData.map((s, i) => ({
      id: createId(),
      sessionId: sessionRows[i].id,
      speakerId: speakerData[s.speakerIdx].id,
    }));
    await db.insert(sessionSpeakers).values(ssRows);

    // === ATTENDEES ===
    const attendeeNames = [
      { name: "Alexandra Thompson", title: "VP, Retail Banking", initials: "AT" },
      { name: "Benjamin Park", title: "Director, Risk Management", initials: "BP" },
      { name: "Catherine Liu", title: "SVP, Wealth Management", initials: "CL" },
      { name: "Daniel Foster", title: "VP, Commercial Banking", initials: "DF" },
      { name: "Emily Watson", title: "Director, Compliance", initials: "EW" },
      { name: "Frank Nguyen", title: "VP, Digital Banking", initials: "FN" },
      { name: "Grace Martinez", title: "Director, Marketing", initials: "GM" },
      { name: "Henry Patel", title: "SVP, Capital Markets", initials: "HP" },
      { name: "Isabella Brown", title: "VP, Human Resources", initials: "IB" },
      { name: "Jack Morrison", title: "Director, Finance", initials: "JM" },
      { name: "Karen Singh", title: "VP, Operations", initials: "KS" },
      { name: "Liam O'Connor", title: "Director, IT Security", initials: "LO" },
      { name: "Maria Garcia", title: "VP, International Banking", initials: "MG" },
      { name: "Nathan Lee", title: "Director, Product Development", initials: "NL" },
      { name: "Olivia Campbell", title: "SVP, Corporate Strategy", initials: "OC" },
      { name: "Patrick Murphy", title: "VP, Treasury", initials: "PM" },
      { name: "Quinn Taylor", title: "Director, Data Analytics", initials: "QT" },
      { name: "Rachel Adams", title: "VP, Client Relations", initials: "RA" },
      { name: "Samuel Jackson", title: "Director, Innovation Lab", initials: "SJ" },
      { name: "Tanya Volkov", title: "VP, Legal & Regulatory", initials: "TV" },
      { name: "Umar Hassan", title: "Director, Partnerships", initials: "UH" },
      { name: "Victoria Chang", title: "SVP, Insurance", initials: "VC" },
      { name: "William Scott", title: "VP, Branch Network", initials: "WS" },
      { name: "Xena Papadopoulos", title: "Director, ESG Strategy", initials: "XP" },
      { name: "Yusuf Ali", title: "VP, Platform Engineering", initials: "YA" },
    ];

    const attendeeRows = attendeeNames.map((a) => ({
      id: createId(),
      name: a.name,
      title: a.title,
      initials: a.initials,
    }));
    await db.insert(attendees).values(attendeeRows);

    // === EVENT ↔ ATTENDEE LINKS ===
    const eaRows = attendeeRows.map((a) => ({
      id: createId(),
      eventId,
      attendeeId: a.id,
    }));
    await db.insert(eventAttendees).values(eaRows);

    // === ADD SEEDING USER TO GUESTLIST AS ADMIN ===
    const { user } = authResult;
    let userAttendee = await db.query.attendees.findFirst({
      where: eq(attendees.userId, user.id),
    });
    if (!userAttendee) {
      const [created] = await db
        .insert(attendees)
        .values({
          id: createId(),
          name: user.name ?? user.email,
          title: "Admin",
          userId: user.id,
          initials: (user.name ?? "A")
            .split(/\s+/)
            .map((w: string) => w[0])
            .join("")
            .toUpperCase()
            .slice(0, 2),
        })
        .returning();
      userAttendee = created;
    }
    await db
      .insert(eventAttendees)
      .values({
        id: createId(),
        eventId,
        attendeeId: userAttendee.id,
        role: "admin",
      })
      .onConflictDoNothing();

    // Set as current event
    await db
      .update(users)
      .set({ currentEventId: eventId, role: "admin" })
      .where(eq(users.id, user.id));

    return NextResponse.json(event, { status: 201 });
  } catch (error) {
    return handleApiError(error, "admin/seed:POST");
  }
}
