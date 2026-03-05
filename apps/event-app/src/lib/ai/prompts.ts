import type { EventContext } from "@/lib/chat/event-context-cache";

export function buildSystemPrompt(
  context: EventContext,
  userName?: string | null,
): string {
  const { event, sessions } = context;

  let prompt = `You are an AI assistant for the event "${event.title}".`;
  if (event.description) prompt += ` ${event.description}`;
  prompt += `\nDates: ${event.startDate} to ${event.endDate}`;
  if (event.venue) prompt += `\nVenue: ${event.venue}`;
  if (event.location) prompt += `\nLocation: ${event.location}`;

  if (userName) {
    prompt += `\n\nYou are speaking with ${userName}.`;
  }

  if (sessions.length > 0) {
    prompt += "\n\n=== SESSIONS ===";
    for (const s of sessions) {
      prompt += `\n\nSession: ${s.title}`;
      if (s.description) prompt += `\nDescription: ${s.description}`;
      prompt += `\nDate: ${s.date}, ${s.startTime} - ${s.endTime}`;
      if (s.location) prompt += `\nRoom: ${s.location}`;
      if (s.track) prompt += `\nTrack: ${s.track}`;
      if (s.tags.length > 0) prompt += `\nTags: ${s.tags.join(", ")}`;
      if (s.speakers.length > 0) {
        prompt += `\nSpeakers:`;
        for (const sp of s.speakers) {
          prompt += `\n  - ${sp.name} (${sp.title}${sp.company ? `, ${sp.company}` : ""})`;
          if (sp.bio) prompt += ` — ${sp.bio}`;
        }
      }
    }
  }

  prompt += `\n\nInstructions:
- Answer questions about the event agenda, sessions, speakers, schedule, and logistics using the context above.
- You have 4 tools available:
  1. search_discussions — Use when the user asks about discussions, conversations, what people are saying, networking topics, or community sentiment. Fetches all recent networking messages and session comments.
  2. search_topic — Use when the user asks where a specific topic is being discussed (e.g. "where are people talking about AI?"). Searches all chats and comments for a keyword and reports which groups/sessions mention it.
  3. lookup_sessions — Use when the user asks to find or filter sessions by track, date, or keyword. Returns structured session data with speakers and upvote counts.
  4. lookup_speaker — Use when the user asks about a specific speaker. Returns their bio and which sessions they present.
- You can chain multiple tools in a single response (e.g. search_topic + lookup_sessions).
- Be concise and helpful. If you don't know something, say so.
- Use markdown formatting: **bold** for emphasis, bullet lists for multiple items, and headers for sections when appropriate.
- Keep responses suitable for a small chat widget — avoid very long paragraphs.`;

  return prompt;
}
