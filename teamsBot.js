// Required imports
const { ActivityTypes } = require("@microsoft/agents-activity");
const {
  AgentApplication,
  AttachmentDownloader,
  MemoryStorage,
} = require("@microsoft/agents-hosting");
const { version } = require("@microsoft/agents-hosting/package.json");
const { DefaultAzureCredential } = require("@azure/identity");
const { AIProjectClient } = require("@azure/ai-projects");
const { Client } = require("@microsoft/microsoft-graph-client");
const axios = require("axios");
const qs = require("qs");

// Bot setup
const downloader = new AttachmentDownloader();
const storage = new MemoryStorage();
const teamsBot = new AgentApplication({
  storage,
  fileDownloaders: [downloader],
});

// Azure AI Foundry integration
const AZURE_ENDPOINT = "https://voxrepofoundry.services.ai.azure.com/api/projects/VoxRepoFoundryAI";
const AGENT_ID = "asst_2nwCGYhb5MJTLEl5Vfna32SL";
const project = new AIProjectClient(
    AZURE_ENDPOINT,
    new DefaultAzureCredential()
);

const clientId = process.env.clientId;
const clientSecret = process.env.clientSecret;

// Get access token for Microsoft Graph
async function getAccessToken(tenantId) {
  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  const data = {
    client_id: clientId,
    scope: "https://graph.microsoft.com/.default",
    client_secret: clientSecret,
    grant_type: "client_credentials",
  };

  const response = await axios.post(tokenUrl, qs.stringify(data), {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });

  return response.data.access_token;
}

teamsBot.activity(ActivityTypes.Message, async (context, state) => {
  try {

    console.log('Inside activity message handler');
    await state.load(context, storage);
    const agent = await project.agents.getAgent("asst_2nwCGYhb5MJTLEl5Vfna32SL");
    console.log(`Retrieved agent: ${agent.name}`);

    const thread = await project.agents.threads.create();
    console.log(`Created thread, ID: ${thread.id}`);


    console.log('Message text:', context.activity.text);

    const message = await project.agents.messages.create(
    thread.id,
    "user",
    context.activity.text
    );
    console.log(`Created message, ID: ${message.id}`);  

    let run = await project.agents.runs.create(thread.id, agent.id);

    console.log(`Created run, ID: ${run.id}, status: ${run.status}`);
    while (run.status === "queued" || run.status === "in_progress") {
    // Wait for a second
    await new Promise((resolve) => setTimeout(resolve, 1000));
    run = await project.agents.runs.get(thread.id, run.id);
  }

    if (run.status === "failed") {
      await context.sendActivity(`Azure AI Foundry run failed: ${run.last_error}`);
    } 
    else {
      console.log(`Run completed with status: ${run.status}`);
      
      const messages = await project.agents.messages.list(thread.id, { order: "asc" });
      console.log('Thread id:', thread.id);
      let assistantMessage = null;

      // Iterate to find the latest assistant message with text content
      for await (const m of messages) {
        if (m.role === "assistant") {
          console.log("Assistant message object:", JSON.stringify(m, null, 2));
          if (Array.isArray(m.content)) {
            // Find the text content block in m.content
            const content = m.content.find(c => c.type === "text" && c.text && typeof c.text.value === "string");
            if (content) {
              assistantMessage = content.text.value;
            }
          }
        }
      }

      if (assistantMessage) {
        // Send the assistant's reply as a single message
        await context.sendActivity(assistantMessage);
      } else {
        await context.sendActivity("No assistant response found.");
      }
    }
  } catch (err) {
    console.error("Error in activity handler:", err);
    await context.sendActivity(`Error communicating with Azure AI Foundry: ${err && err.message ? err.message : err}`);
  }
});

// Answer the call
async function answerCall(callId, callbackUri, accessToken) {
  const url = `https://graph.microsoft.com/v1.0/communications/calls/${callId}/answer`;
  const body = {
    callbackUri: callbackUri,
    mediaConfig: {
      "@odata.type": "#microsoft.graph.serviceHostedMediaConfig",
    },
    acceptedModalities: ["audio"],
  };

  await axios.post(url, body, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  console.log(`Answered call ${callId}`);
}

async function subscribeToAudioStream(callId, accessToken) {

  const client = Client.init({
    authProvider: (done) => {
      done(null, accessToken);
    }
  });

  // Hypothetical Graph API endpoint to subscribe to media stream
  // *** This endpoint may not exist or be supported in JS ***
  const subscribeEndpoint = `/communications/calls/${callId}/subscribeToMedia`;

  try {
    const response = await client
      .api(subscribeEndpoint)
      .post({
        mediaConfig: {
          // specify audio (maybe audio only), encoding, etc.
          "audio": {
            "format": "pcm",
            "samplingRate": 16000
          }
        },
        streamDirection: "receive" // or "sendReceive"
      });

    // Response might give you a WebSocket URL or stream handle
    console.log("Subscribed to audio stream:", response);
    return response;  // depending on what is returned (URL / stream)
  } catch (err) {
    console.error("Error subscribing to audio stream:", err.response?.data || err.message);
    throw err;
  }
}

async function handleCallEvent(reqbody) {
  console.log("Received call event:", JSON.stringify(reqbody, null, 2));

  if (reqbody.value && reqbody.value.length > 0) {
    const notification = reqbody.value[0];
    const call = notification.resourceData;
    const changeType = notification.changeType;

    if (call && call.state === "incoming") {
      console.log(`Incoming call detected with id: ${call.id}`);

      try {
        const tenantId = call.tenantId; // from call event

        const accessToken = await getAccessToken(tenantId);

        const botCallbackUri = "https://voxrepobot-f9e6b8a2dva9b4ex.canadacentral-01.azurewebsites.net/calling/callback";

        if (changeType === "created" && call.state === "incoming") {
        // Answer the incoming call
        console.log(`Incoming call detected with id: ${call.id}`);
        await answerCall(call.id, botCallbackUri, accessToken);
        console.log(`Call ${call.id} answered.`);
      } 
      else if (changeType === "updated" && call.state === "established") {
        
        console.log(`Call ${call.id} established.`);
        console.log('Subscribing to audio stream...');
        // Subscribe to the audio stream        
        const audioStream = await subscribeToAudioStream(call.id, accessToken);
        console.log('Subscribed to audio stream:', audioStream);
      } 
      else {
        console.log(`Unhandled call state: ${call.state}, changeType: ${changeType}`);
      }
      } catch (error) {
      console.error("Error handling call:", error.response?.data || error.message);
    }
  }
}
}

module.exports = {
  teamsBot,
  handleCallEvent,
};

