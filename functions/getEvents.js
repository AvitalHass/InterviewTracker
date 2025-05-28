import { google } from "googleapis";
import { authorize } from "../google-auth.js";
import { createInterview } from "../handler.js";

export const getEvents = async (event) => {
  const auth = await authorize();
  const calendar = google.calendar({ version: 'v3', auth });

  const now = new Date();
  const to = new Date(now);
  to.setDate(now.getDate() + 1);

  const res = await calendar.events.list({
    calendarId: 'primary',
    timeMin: now.toISOString(),
    timeMax: to.toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
    q: 'interview'
  });
  console.log('Fetched events:', res);

  for (const item of res?.data?.items) {
    console.log('item:', item);
    const body = {
      company: item.organizer?.displayName || 'Unknown',
      role: item.summary || '',
      date: item.start.dateTime || item.start.date,
      type: 'interview',
      status: 'scheduled',
      interviewers: item.attendees?.filter(a => !a?.self)?.map(attendee => ({
        name: attendee.displayName || 'Unknown',
        email: attendee.email || 'Unknown',
      })) || [],
    };
    console.log('body:', body);
    await createInterview({ body: JSON.stringify(body) });
  };

  return {
    statusCode: 200,
    body: JSON.stringify(),
  };
};
