// generate-token.js - Run this locally, not in production
const readline = require('readline');
const { google } = require('googleapis');
const { SSMClient, PutParameterCommand, GetParameterCommand } = require('@aws-sdk/client-ssm');

const ssmClient = new SSMClient({ region: 'us-east-1' });
const SCOPES = ['https://www.googleapis.com/auth/calendar.readonly'];
const TOKEN_PARAM_NAME = '/serverless-framework/deployment/google/token';

async function getToken() {
  const command = new GetParameterCommand({
    Name: '/serverless-framework/deployment/google/credentials',
    WithDecryption: true
  });

  const credentials = await ssmClient.send(command);
  const raw = credentials.Parameter.Value;
  const parsed = JSON.parse(raw);
  const { client_secret, client_id, redirect_uris } = parsed.installed;
  console.log('1');
  if (!client_id || !client_secret || !redirect_uris) {
    console.error('Missing required environment variables');
    process.exit(1);
  }

  const oAuth2Client = new google.auth.OAuth2(
    client_id, client_secret, redirect_uris[0]
  );
  console.log('2');
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent' // Force refresh token generation
  });

  console.log('Go to this URL to authorize the app:\n', authUrl);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.question('\nPaste the code here: ', async (code) => {
    rl.close();
    try {
      const { tokens } = await oAuth2Client.getToken(code);
      console.log('Got tokens:', tokens);

      // Save to SSM Parameter Store
      const command = new PutParameterCommand({
        Name: TOKEN_PARAM_NAME,
        Value: JSON.stringify(tokens),
        Type: 'SecureString',
        Overwrite: true
      });

      await ssmClient.send(command);
      console.log('Token successfully stored in SSM Parameter Store');
    } catch (error) {
      console.error('Error retrieving or storing token', error);
    }
  });
}

getToken();