"use client";

import { useState, useEffect, useCallback } from "react";
import {
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  format,
  isSameDay,
} from "date-fns";
import { ChevronLeft, ChevronRight, MessageCircle, X } from "lucide-react";
import { useUserStore } from "@/lib/stores/userStore";
import { Skeleton } from "@/src/components/ui/skeleton";
import CalendarGrid, { type CalendarEvent } from "@/components/calendar/CalendarGrid";
import EventDetailSheet from "@/components/calendar/EventDetailSheet";
import EventChatPanel from "@/components/calendar/EventChatPanel";
import { cn } from "@/lib/utils";

export default function CalendarPage() {
  const { user } = useUserStore();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  const teamId = user?.activeTeamId;

  const fetchEvents = useCallback(async () => {
    if (!teamId) return;

    setIsLoading(true);
    try {
      const start = startOfMonth(currentMonth).toISOString();
      const end = endOfMonth(currentMonth).toISOString();
      const response = await fetch(
        `/api/events?teamId=${teamId}&start=${start}&end=${end}`
      );
      if (response.ok) {
        const data = await response.json();
        setEvents(data.events || []);
      }
    } catch (error) {
      console.error("Failed to fetch events:", error);
    } finally {
      setIsLoading(false);
    }
  }, [teamId, currentMonth]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const handlePrevMonth = () => setCurrentMonth((m) => subMonths(m, 1));
  const handleNextMonth = () => setCurrentMonth((m) => addMonths(m, 1));
  const handleToday = () => setCurrentMonth(new Date());

  const handleSelectEvent = (event: CalendarEvent) => {
    setSelectedEvent(event);
    setSheetOpen(true);
  };

  const handleSelectDate = (date: Date) => {
    setSelectedDate(date);
  };

  const selectedDayEvents = selectedDate
    ? events.filter((e) => {
        const start = new Date(e.startDate);
        const end = new Date(e.endDate);
        const dayStart = new Date(selectedDate);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(selectedDate);
        dayEnd.setHours(23, 59, 59, 999);
        return start <= dayEnd && end >= dayStart;
      })
    : [];

  if (!teamId) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="text-center py-12">
          <h2 className="text-lg font-medium text-muted-foreground">
            Join a team to use the calendar
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            The calendar shows events for your active team.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-background">
      <div className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold">Calendar</h1>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="p-1.5 rounded-md hover:bg-accent transition-colors"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <span className="text-lg font-semibold min-w-[180px] text-center">
                {format(currentMonth, "MMMM yyyy")}
              </span>
              <button
                type="button"
                onClick={handleNextMonth}
                className="p-1.5 rounded-md hover:bg-accent transition-colors"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
            <button
              type="button"
              onClick={handleToday}
              className="px-3 py-1 text-sm rounded-md border border-border hover:bg-accent transition-colors"
            >
              Today
            </button>
          </div>

          <button
            type="button"
            onClick={() => setChatOpen(!chatOpen)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
              chatOpen
                ? "bg-primary text-primary-foreground"
                : "bg-primary/10 text-primary hover:bg-primary/20"
            )}
          >
            {chatOpen ? <X className="h-4 w-4" /> : <MessageCircle className="h-4 w-4" />}
            {chatOpen ? "Close Chat" : "Create with AI"}
          </button>
        </div>

        {/* Main content area */}
        <div className="flex gap-4">
          {/* Calendar + day events */}
          <div className={cn("flex-1 min-w-0", chatOpen && "max-w-[calc(100%-340px)]")}>
            {isLoading ? (
              <Skeleton className="h-[600px] w-full rounded-lg" />
            ) : (
              <CalendarGrid
                currentMonth={currentMonth}
                events={events}
                selectedDate={selectedDate}
                onSelectDate={handleSelectDate}
                onSelectEvent={handleSelectEvent}
              />
            )}

            {/* Selected day event list */}
            {selectedDate && selectedDayEvents.length > 0 && (
              <div className="mt-4 border border-border rounded-lg p-4">
                <h3 className="text-sm font-semibold mb-3">
                  {format(selectedDate, "EEEE, MMMM d")}
                  <span className="text-muted-foreground font-normal ml-2">
                    {selectedDayEvents.length} event{selectedDayEvents.length !== 1 && "s"}
                  </span>
                </h3>
                <div className="space-y-2">
                  {selectedDayEvents.map((event) => (
                    <button
                      key={event.id}
                      type="button"
                      onClick={() => handleSelectEvent(event)}
                      className="w-full flex items-center gap-3 p-2 rounded-md hover:bg-accent text-left transition-colors"
                    >
                      <div className="text-xs text-muted-foreground w-20 shrink-0">
                        {format(new Date(event.startDate), "h:mm a")}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{event.title}</div>
                        {event.location && (
                          <div className="text-xs text-muted-foreground truncate">
                            {event.location}
                          </div>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {event.attendees.length} attendee{event.attendees.length !== 1 && "s"}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Chat panel */}
          {chatOpen && (
            <div className="w-[320px] shrink-0 border border-border rounded-lg overflow-hidden h-[calc(100vh-200px)] sticky top-6">
              <EventChatPanel
                onEventsCreated={fetchEvents}
              />
            </div>
          )}
        </div>
      </div>

      {/* Event detail sheet */}
      <EventDetailSheet
        event={selectedEvent}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onEventUpdated={fetchEvents}
      />
    </div>
  );
}
