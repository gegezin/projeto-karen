import { google } from 'googleapis';

export class CalendarManager {
  private oauth2Client: any;
  private calendar: any;

  constructor(clientId: string, clientSecret: string, redirectUri: string) {
    this.oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  }

  setCredentials(accessToken: string, refreshToken: string): void {
    this.oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken
    });
    this.calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
  }

  async getTodayEvents(): Promise<CalendarEvent[]> {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

    return this.getEventsInRange(startOfDay, endOfDay);
  }

  async getEventsInRange(startDate: Date, endDate: Date): Promise<CalendarEvent[]> {
    try {
      const response = await this.calendar.events.list({
        calendarId: 'primary',
        timeMin: startDate.toISOString(),
        timeMax: endDate.toISOString(),
        singleEvents: true,
        orderBy: 'startTime'
      });

      const events: CalendarEvent[] = [];

      if (response.data.items) {
        for (const item of response.data.items) {
          events.push({
            id: item.id,
            summary: item.summary || '',
            description: item.description || '',
            start: item.start?.dateTime || item.start?.date || '',
            end: item.end?.dateTime || item.end?.date || '',
            location: item.location || '',
            attendees: item.attendees?.map((a: any) => a.email) || []
          });
        }
      }

      return events;
    } catch (error: any) {
      throw new Error('Erro ao buscar eventos: ' + error.message);
    }
  }

  async createEvent(event: CreateEventInput): Promise<string> {
    try {
      const response = await this.calendar.events.insert({
        calendarId: 'primary',
        resource: {
          summary: event.summary,
          description: event.description,
          start: {
            dateTime: event.startDateTime,
            timeZone: event.timeZone || 'America/Sao_Paulo'
          },
          end: {
            dateTime: event.endDateTime,
            timeZone: event.timeZone || 'America/Sao_Paulo'
          },
          location: event.location,
          attendees: event.attendees?.map(email => ({ email })),
          reminders: {
            useDefault: event.useDefaultReminders || false,
            overrides: event.reminders?.map(minutes => ({ method: 'email', minutes }))
          }
        }
      });

      return response.data.id;
    } catch (error: any) {
      throw new Error('Erro ao criar evento: ' + error.message);
    }
  }

  async updateEvent(eventId: string, updates: Partial<CreateEventInput>): Promise<void> {
    try {
      const existingEvent = await this.calendar.events.get({
        calendarId: 'primary',
        eventId: eventId
      });

      const resource: any = {};

      if (updates.summary) resource.summary = updates.summary;
      if (updates.description) resource.description = updates.description;
      if (updates.startDateTime) {
        resource.start = {
          dateTime: updates.startDateTime,
          timeZone: updates.timeZone || 'America/Sao_Paulo'
        };
      }
      if (updates.endDateTime) {
        resource.end = {
          dateTime: updates.endDateTime,
          timeZone: updates.timeZone || 'America/Sao_Paulo'
        };
      }
      if (updates.location) resource.location = updates.location;
      if (updates.attendees) {
        resource.attendees = updates.attendees.map(email => ({ email }));
      }

      await this.calendar.events.patch({
        calendarId: 'primary',
        eventId: eventId,
        resource: resource
      });
    } catch (error: any) {
      throw new Error('Erro ao atualizar evento: ' + error.message);
    }
  }

  async deleteEvent(eventId: string): Promise<void> {
    try {
      await this.calendar.events.delete({
        calendarId: 'primary',
        eventId: eventId
      });
    } catch (error: any) {
      throw new Error('Erro ao deletar evento: ' + error.message);
    }
  }

  async getFreeBusy(timeMin: Date, timeMax: Date): Promise<FreeBusyInfo> {
    try {
      const response = await this.calendar.freebusy.query({
        resource: {
          timeMin: timeMin.toISOString(),
          timeMax: timeMax.toISOString(),
          items: [{ id: 'primary' }]
        }
      });

      const busy = response.data.calendars?.primary?.busy || [];
      
      return {
        busy: busy.map((b: any) => ({
          start: b.start,
          end: b.end
        }))
      };
    } catch (error: any) {
      throw new Error('Erro ao buscar disponibilidade: ' + error.message);
    }
  }

  async findAvailableSlots(
    startDate: Date, 
    endDate: Date, 
    durationMinutes: number
  ): Promise<Date[]> {
    const freeBusy = await this.getFreeBusy(startDate, endDate);
    const availableSlots: Date[] = [];
    
    const currentTime = new Date(startDate);
    const endTime = new Date(endDate);
    
    while (currentTime < endTime) {
      const slotEnd = new Date(currentTime.getTime() + durationMinutes * 60000);
      
      const isBusy = freeBusy.busy.some((busy: any) => {
        const busyStart = new Date(busy.start);
        const busyEnd = new Date(busy.end);
        return (currentTime < busyEnd && slotEnd > busyStart);
      });
      
      if (!isBusy && slotEnd <= endTime) {
        availableSlots.push(new Date(currentTime));
      }
      
      currentTime.setMinutes(currentTime.getMinutes() + 30);
    }
    
    return availableSlots;
  }

  generateAuthUrl(): string {
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/calendar.readonly', 'https://www.googleapis.com/auth/calendar.events']
    });
  }

  async getAccessToken(code: string): Promise<any> {
    const { tokens } = await this.oauth2Client.getToken(code);
    return tokens;
  }
}

interface CalendarEvent {
  id: string;
  summary: string;
  description: string;
  start: string;
  end: string;
  location: string;
  attendees: string[];
}

interface CreateEventInput {
  summary: string;
  description?: string;
  startDateTime: string;
  endDateTime: string;
  timeZone?: string;
  location?: string;
  attendees?: string[];
  useDefaultReminders?: boolean;
  reminders?: number[];
}

interface FreeBusyInfo {
  busy: Array<{ start: string; end: string }>;
}
