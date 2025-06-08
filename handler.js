import { DynamoDBClient, GetItemCommand, PutItemCommand, ScanCommand, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { v4 as uuidv4 } from "uuid";
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import { EventBridgeClient, PutEventsCommand } from "@aws-sdk/client-eventbridge";

const eb = new EventBridgeClient();

const ses = new SESClient();
const client = new DynamoDBClient({});

export const getInterviews = async (event) => {
  try {
    const { queryStringParameters } = event;
    const { id, status, is_public } = queryStringParameters || {};

    const params = {
      TableName: process.env.TABLE_NAME,

    };
    const filterExpressions = [];
    const expressionAttributeNames = {};
    const expressionAttributeValues = {};

    if (id) {
      filterExpressions.push("#id = :id");
      expressionAttributeNames["#id"] = "id";
      expressionAttributeValues[":id"] = { S: id };
    }
    if (status) {
      filterExpressions.push("#status = :status");
      expressionAttributeNames["#status"] = "status";
      expressionAttributeValues[":status"] = { S: status };
    }
    if (is_public) {
      filterExpressions.push("#is_public = :is_public");
      expressionAttributeNames["#is_public"] = "is_public";
      expressionAttributeValues[":is_public"] = { S: is_public };
    }

    if (filterExpressions.length > 0) {
      params.FilterExpression = filterExpressions.join(" AND ");
      params.ExpressionAttributeNames = expressionAttributeNames;
      params.ExpressionAttributeValues = expressionAttributeValues;
    }

    const command = new ScanCommand(params);
    const data = await client.send(command);
    const res = {
      message: "Interviews fetched successfully",
      interviews: data.Items.map((item) => {
        console.log("Item:", item);
        console.log("Raw questions string:", item.questions?.S);

        return {
          id: item.id.S,
          company: item.company.S,
          role: item.role.S,
          date: item.date.S,
          type: item.type.S,
          status: item.status.S,
          interviewers: item.interviewers ? JSON.parse(item.interviewers.S) : [],
          passed: item.passed ? JSON.parse(item.passed.S) : false,
          performance_rating: item.performance_rating?.S ?? 5,
          questions: item.questions ? JSON.parse(item.questions.S) : [],
          confident_answers: item.confident_answers?.S ?? null,
          challenging_questions: item.challenging_questions?.S ?? null,
          strengths: item.strengths?.S ?? null,
          improvements: item.improvements?.S ?? null,
          connection: item.connection?.S ?? null,
          comfort_level: item.comfort_level?.S ?? null,
          notes: item.notes?.S ?? null,
          is_public: item.is_public ? JSON.parse(item.is_public.S) : false
        };
      }),
    };
    return createResponse(200, res);
  } catch (error) {
    console.error(error);
    console.log("Error fetching interviews:", error);
    return createResponse(500, { error: "Could not fetch interviews" });
  }
};

export const createInterview = async (event) => {
  try {
    const body = JSON.parse(event.body);
    const id = uuidv4();
    console.log("Create Body:", body);
    console.log("Create ID:", id);
    const item = {
      id: { S: id },
      company: { S: body.company },
      role: { S: body.role },
      date: { S: body.date },
      type: { S: body.type },
      status: { S: body.status ?? "scheduled" },
      ...(body.interviewers && { interviewers: { S: JSON.stringify(body.interviewers) } }),
      ...(body.questions && { questions: { S: JSON.stringify(body.questions) } }),
      ...(body.confident_answers && { confident_answers: { S: body.confident_answers } }),
      ...(body.challenging_questions && { challenging_questions: { S: body.challenging_questions } }),
      ...(body.strengths && { strengths: { S: body.strengths } }),
      ...(body.improvements && { improvements: { S: body.improvements } }),
      ...(body.connection && { connection: { S: body.connection } }),
      ...(body.comfort_level && { comfort_level: { S: body.comfort_level } }),
      ...(body.passed !== undefined && { passed: { S: JSON.stringify(body.passed) } }),
      ...(body.performance_rating !== undefined && { performance_rating: { S: JSON.stringify(body.performance_rating) } }),
      ...(body.notes && { notes: { S: body.notes } }),
      ...(body.is_public !== undefined && { is_public: { S: JSON.stringify(body.is_public) } }),
    };

    const command = new PutItemCommand({
      TableName: process.env.TABLE_NAME,
      Item: item,
    });

    await client.send(command);
    console.log("Create succeed", item);
    const reminderTime = new Date(new Date(body.date).getTime() + 5 * 60 * 1000);
    console.log("Interview Time (ms):", body.date);
    console.log("Interview Time (UTC):", new Date(body.date).toISOString());
    console.log("Reminder Time (UTC):", reminderTime.toISOString());
    console.log("Now (UTC):", new Date().toISOString());
    await eb.send(new PutEventsCommand({
      Entries: [
        {
          Source: "custom.interviewapp",
          DetailType: "SendReminder",
          Detail: JSON.stringify({
            email: process.env.REMINDER_EMAIL, // Extracted from environment variable
            interviewId: id,
            interviewTime: body.date,
          }),
          EventBusName: "default",
          Time: reminderTime,
        },
      ],
    }));
    return createResponse(201, { message: "Interview created", id });
  } catch (error) {
    console.log("Error creating interview:", error);
    console.error(error);
    return createResponse(500, { error: "Could not create interview" });
  }
};

export const updateInterview = async (event) => {
  try {
    const body = JSON.parse(event.body);
    const { id, company, role, date, type, status } = body;
    console.log("Update Body:", body);
    console.log("Update ID:", id);
    if (!id) {
      return createResponse(400, { error: "Interview ID is required" });
    }

    const updateExpression = [];
    const expressionAttributeNames = {};
    const expressionAttributeValues = {};

    if (company) {
      updateExpression.push("#company = :company");
      expressionAttributeNames["#company"] = "company";
      expressionAttributeValues[":company"] = { S: company };
    }

    if (role) {
      updateExpression.push("#role = :role");
      expressionAttributeNames["#role"] = "role";
      expressionAttributeValues[":role"] = { S: role };
    }

    if (date) {
      updateExpression.push("#date = :date");
      expressionAttributeNames["#date"] = "date";
      expressionAttributeValues[":date"] = { S: date };
    }

    if (type) {
      updateExpression.push("#type = :type");
      expressionAttributeNames["#type"] = "type";
      expressionAttributeValues[":type"] = { S: type };
    }

    if (status) {
      updateExpression.push("#status = :status");
      expressionAttributeNames["#status"] = "status";
      expressionAttributeValues[":status"] = { S: status };
    }
    if (body.interviewers) {
      updateExpression.push("#interviewers = :interviewers");
      expressionAttributeNames["#interviewers"] = "interviewers";
      expressionAttributeValues[":interviewers"] = { S: JSON.stringify(body.interviewers) };
    }

    if (body.questions) {
      updateExpression.push("#questions = :questions");
      expressionAttributeNames["#questions"] = "questions";
      expressionAttributeValues[":questions"] = { S: JSON.stringify(body.questions) };
    }

    if (body.confident_answers) {
      updateExpression.push("#confident_answers = :confident_answers");
      expressionAttributeNames["#confident_answers"] = "confident_answers";
      expressionAttributeValues[":confident_answers"] = { S: body.confident_answers };
    }

    if (body.challenging_questions) {
      updateExpression.push("#challenging_questions = :challenging_questions");
      expressionAttributeNames["#challenging_questions"] = "challenging_questions";
      expressionAttributeValues[":challenging_questions"] = { S: body.challenging_questions };
    }

    if (body.strengths) {
      updateExpression.push("#strengths = :strengths");
      expressionAttributeNames["#strengths"] = "strengths";
      expressionAttributeValues[":strengths"] = { S: body.strengths };
    }

    if (body.improvements) {
      updateExpression.push("#improvements = :improvements");
      expressionAttributeNames["#improvements"] = "improvements";
      expressionAttributeValues[":improvements"] = { S: body.improvements };
    }

    if (body.connection) {
      updateExpression.push("#connection = :connection");
      expressionAttributeNames["#connection"] = "connection";
      expressionAttributeValues[":connection"] = { S: body.connection };
    }

    if (body.comfort_level) {
      updateExpression.push("#comfort_level = :comfort_level");
      expressionAttributeNames["#comfort_level"] = "comfort_level";
      expressionAttributeValues[":comfort_level"] = { S: body.comfort_level };
    }

    if (body.passed !== undefined) {
      updateExpression.push("#passed = :passed");
      expressionAttributeNames["#passed"] = "passed";
      expressionAttributeValues[":passed"] = { S: JSON.stringify(body.passed) };
    }

    if (body.performance_rating !== undefined) {
      updateExpression.push("#performance_rating = :performance_rating");
      expressionAttributeNames["#performance_rating"] = "performance_rating";
      expressionAttributeValues[":performance_rating"] = { S: JSON.stringify(body.performance_rating) };
    }

    if (body.notes) {
      updateExpression.push("#notes = :notes");
      expressionAttributeNames["#notes"] = "notes";
      expressionAttributeValues[":notes"] = { S: body.notes };
    }

    if (body.is_public !== undefined) {
      updateExpression.push("#is_public = :is_public");
      expressionAttributeNames["#is_public"] = "is_public";
      expressionAttributeValues[":is_public"] = { S: JSON.stringify(body.is_public) };
    }
    if (updateExpression.length === 0) {
      return createResponse(400, { error: "No fields to update" });
    }

    const params = {
      TableName: process.env.TABLE_NAME,
      Key: {
        id: { S: id },
      },
      UpdateExpression: `SET ${updateExpression.join(", ")}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: "ALL_NEW",
    };
    console.log("Update Params:", params);
    const command = new UpdateItemCommand(params);
    const data = await client.send(command);
    console.log("Update succeed", data);
    return createResponse(200, { message: "Interview updated", updatedItem: data.Attributes });
  } catch (error) {
    console.error(error);
    return createResponse(500, { error: "Could not update interview" });
  }
};

export const preflightHandler = async () => {
  return {
    statusCode: 200,
    body: ''
  };
};

export const sendReminder = async (event) => {
  const { email, interviewId, interviewTime } = event.detail;

  const command = new SendEmailCommand({
    Destination: { ToAddresses: [email] },
    Message: {
      Subject: { Data: "Reminder: Fill in your interview notes" },
      Body: {
        Text: {
          Data: `Reminder: Please complete your interview notes for the session at ${interviewTime}.\n\nLink to interview: https://main.df2bdo3hdl95b.amplifyapp.com/interviewForm?id=${interviewId}`,
        },
      },
    },
    Source: process.env.SENDER_EMAIL,
  });

  try {
    await ses.send(command);
    console.log("Email sent");
  } catch (error) {
    console.error("Error sending email", error);
  }
};

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://main.df2bdo3hdl95b.amplifyapp.com',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
};

const createResponse = (statusCode, body) => ({
  statusCode,
  headers: corsHeaders,
  body: JSON.stringify(body)
});