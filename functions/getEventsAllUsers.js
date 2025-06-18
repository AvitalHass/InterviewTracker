import { google } from "googleapis";
import { authorize } from "../google-auth.js";
import { DynamoDBClient, ScanCommand } from "@aws-sdk/client-dynamodb";
import { createInterview } from "../handler.js";

const client = new DynamoDBClient({});

export const getEventsAllUsers = async (event) => {
  try {
    // 1. Get all users from UsersTable
    const usersData = await client.send(
      new ScanCommand({ TableName: process.env.USERS_TABLE })
    );
    const users = usersData.Items || [];
    let results = [];

    // 2. For each user, try to fetch their Google Calendar events
    for (const user of users) {
      const email = user.email.S;
      let auth;
      try {
        auth = await authorize(email); // You must implement this logic
      } catch (err) {
        results.push({ email, error: 'No valid Google token for user' });
        continue;
      }
      const calendar = google.calendar({ version: 'v3', auth });
      const now = new Date();
      const to = new Date(now);
      to.setDate(now.getDate() + 1);
      try {
        const res = await calendar.events.list({
          calendarId: 'primary',
          timeMin: now.toISOString(),
          timeMax: to.toISOString(),
          singleEvents: true,
          orderBy: 'startTime',
          q: 'interview',
        });
        // You can process events here, e.g., call createInterview for each event
        results.push({ email, events: res.data.items });
      } catch (err) {
        results.push({ email, error: 'Failed to fetch events' });
      }
    }
    return {
      statusCode: 200,
      body: JSON.stringify({ results }),
    };
  } catch (error) {
    console.error('Error in getEventsAllUsers:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to sync calendar events for all users' }),
    };
  }
};
