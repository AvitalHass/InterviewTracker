import { OAuth2Client } from 'google-auth-library';
import { DynamoDBClient, PutItemCommand, GetItemCommand } from "@aws-sdk/client-dynamodb";

const client = new DynamoDBClient({});
const oAuth2Client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export const verifyGoogleToken = async (event) => {
  try {
    let token;
    // Check if token is in body
    if (event.body) {
      const body = JSON.parse(event.body);
      token = body.token;
    }
    
    // If not in body, check Authorization header
    if (!token && event.headers?.Authorization) {
      token = event.headers.Authorization.replace('Bearer ', '');
    }

    if (!token) {
      return createResponse(400, { error: 'Token is required' });
    }

    // Verify the token
    const ticket = await oAuth2Client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID
    });
    const payload = ticket.getPayload();
    const { email, name, picture } = payload;

    // Store or update user in DynamoDB
    const putCommand = new PutItemCommand({
      TableName: process.env.USERS_TABLE,
      Item: {
        email: { S: email },
        name: { S: name },
        picture: { S: picture },
        lastLogin: { S: new Date().toISOString() }
      }
    });

    await client.send(putCommand);

    return createResponse(200, {
      message: 'Successfully authenticated',
      user: {
        email,
        name,
        picture
      },
      token // Return the token back to the client
    });
  } catch (error) {
    console.error('Error verifying token:', error);
    return createResponse(401, { error: 'Invalid token' });
  }
};

export const getUserData = async (event) => {
  try {
    const token = event.headers?.Authorization?.replace('Bearer ', '');
    
    if (!token) {
      return createResponse(400, { error: 'Token is required' });
    }

    // Verify the token
    const ticket = await oAuth2Client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();
    const { email } = payload;

    // Get user from DynamoDB
    const getCommand = new GetItemCommand({
      TableName: process.env.USERS_TABLE,
      Key: {
        email: { S: email }
      }
    });

    const { Item } = await client.send(getCommand);
    
    if (!Item) {
      return createResponse(404, { error: 'User not found' });
    }

    return createResponse(200, {
      user: {
        email: Item.email.S,
        name: Item.name.S,
        picture: Item.picture.S,
        lastLogin: Item.lastLogin.S
      }
    });
  } catch (error) {
    console.error('Error getting user data:', error);
    return createResponse(401, { error: 'Invalid token' });
  }
};

// Update CORS headers to remove trailing slash
const corsHeaders = {
  'Access-Control-Allow-Origin': 'http://localhost:5173',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const createResponse = (statusCode, body) => ({
  statusCode,
  headers: corsHeaders,
  body: JSON.stringify(body)
});