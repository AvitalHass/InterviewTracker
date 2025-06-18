import { google } from "googleapis";
import { authorize } from "../google-auth.js";
import { DynamoDBClient, GetItemCommand } from "@aws-sdk/client-dynamodb";
import { createInterview } from "../handler.js";
import { OAuth2Client } from 'google-auth-library';

const client = new DynamoDBClient({});
const oAuth2Client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Helper function to extract token
const getToken = (headers) => {
  if (!headers?.Authorization) return null;
  return headers.Authorization.replace('Bearer ', '');
};

export const getEvents = async (event) => {
  try {
    const token = getToken(event.headers);
    if (!token) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: "Authorization required" })
      };
    }

    // Verify the token and get user email
    const ticket = await oAuth2Client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID
    });
    const { email } = ticket.getPayload();

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

    for (const item of res?.data?.items) {
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
        userEmail: email
      };
      
      // Create a mock event object with headers for createInterview
      const mockEvent = {
        body: JSON.stringify(body),
        headers: event.headers // Pass through the original headers with Authorization
      };
      
      await createInterview(mockEvent);
    }

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': 'http://localhost:5173',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      },
      body: JSON.stringify({ message: "Calendar events synced successfully" })
    };
  } catch (error) {
    console.error('Error in getEvents:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': 'http://localhost:5173',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      },
      body: JSON.stringify({ error: "Failed to sync calendar events" })
    };
  }
};
