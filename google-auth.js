import { google } from "googleapis";
import { SSMClient, GetParameterCommand, PutParameterCommand } from "@aws-sdk/client-ssm";
import { DynamoDBClient, GetItemCommand, UpdateItemCommand } from "@aws-sdk/client-dynamodb";

const ssmClient = new SSMClient({ region: 'us-east-1' });
const dynamoClient = new DynamoDBClient({});
const SCOPES = ['https://www.googleapis.com/auth/calendar.readonly'];
const TOKEN_PARAM_NAME = '/serverless-framework/deployment/google/token';

async function getCredentialsFromSSM() {
  const command = new GetParameterCommand({
    Name: '/serverless-framework/deployment/google/credentials',
    WithDecryption: true
  });
  
  const response = await ssmClient.send(command);
  return JSON.parse(response.Parameter.Value);
}


async function authorize() {
  // Get credentials from secure storage
  const credentials = await getCredentialsFromSSM();
  const { client_secret, client_id, redirect_uris } = credentials.installed;
  
  const oAuth2Client = new google.auth.OAuth2(
    client_id, client_secret, redirect_uris[0]
  );

  // Get token from secure storage
  let token;
  try {
    token = await getTokenFromSSM();
    
    // Check if token is expired or will expire soon
    const expiryDate = token.expiry_date;
    const now = Date.now();
    
    // If token expired or will expire in next 5 minutes, refresh it
    if (expiryDate <= now + 5 * 60 * 1000) {
      console.log('Token expired or about to expire, refreshing...');
      
      oAuth2Client.setCredentials(token);
      const newToken = await refreshToken(oAuth2Client);
      
      // Save refreshed token
      await saveTokenToSSM(newToken);
      token = newToken;
    }
    
    oAuth2Client.setCredentials(token);
    return oAuth2Client;
  } catch (error) {
    console.error('Error with token, need to get a new one', error);
    return getNewToken(oAuth2Client);
  }
}

async function refreshToken(oAuth2Client) {
  return new Promise((resolve, reject) => {
    oAuth2Client.refreshAccessToken((err, token) => {
      if (err) {
        console.error('Error refreshing access token', err);
        return reject(err);
      }
      resolve(token);
    });
  });
}

async function getTokenFromSSM() {
  try {
    const command = new GetParameterCommand({
      Name: TOKEN_PARAM_NAME,
      WithDecryption: true
    });
    
    const response = await ssmClient.send(command);
    return JSON.parse(response.Parameter.Value);
  } catch (error) {
    console.error('Error getting token from SSM', error);
    throw error;
  }
}

async function saveTokenToSSM(token) {
  try {
    const command = new PutParameterCommand({
      Name: TOKEN_PARAM_NAME,
      Value: JSON.stringify(token),
      Type: 'SecureString',
      Overwrite: true
    });
    
    await ssmClient.send(command);
    console.log('Token saved to SSM');
  } catch (error) {
    console.error('Error saving token to SSM', error);
    throw error;
  }
}

// Function to get a completely new token (interactive)
async function getNewToken(oAuth2Client) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent'  // Force to get refresh token
  });
  
  console.log('Authorize this app by visiting this url:', authUrl);
  // In a real application, you'd redirect the user to this URL
  // and have a callback endpoint that handles the resulting code
  
  // For serverless environments, you might need to:
  // 1. Generate this link in an admin tool
  // 2. Provide a temporary API endpoint to receive the code
  // 3. Manually update the token via a secured admin interface
  
  // For now, this requires manual intervention:
  throw new Error('Authentication token missing or invalid. Please run the token generation script manually.');
}


export async function authorize(email) {
  // 1. Get credentials from SSM (reuse getCredentialsFromSSM)
  const credentials = await getCredentialsFromSSM();
  const { client_secret, client_id, redirect_uris } = credentials.installed;
  const oAuth2Client = new google.auth.OAuth2(
    client_id, client_secret, redirect_uris[0]
  );

  // 2. Retrieve user's token from DynamoDB
  const getCommand = new GetItemCommand({
    TableName: process.env.USERS_TABLE,
    Key: { email: { S: email } }
  });
  const { Item } = await dynamoClient.send(getCommand);
  if (!Item || !Item.googleToken) {
    throw new Error('No Google token found for user: ' + email);
  }
  const token = JSON.parse(Item.googleToken.S);

  // 3. Set credentials and refresh if needed
  oAuth2Client.setCredentials(token);
  const now = Date.now();
  if (token.expiry_date && token.expiry_date <= now + 5 * 60 * 1000) {
    // Token expired or about to expire, refresh
    const newToken = await oAuth2Client.refreshAccessToken();
    oAuth2Client.setCredentials(newToken.credentials);
    // Save refreshed token back to DynamoDB
    await dynamoClient.send(new UpdateItemCommand({
      TableName: process.env.USERS_TABLE,
      Key: { email: { S: email } },
      UpdateExpression: 'SET googleToken = :token',
      ExpressionAttributeValues: {
        ':token': { S: JSON.stringify(newToken.credentials) }
      }
    }));
  }
  return oAuth2Client;
}

export { authorize };
