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

// Bot setup
const downloader = new AttachmentDownloader();
const storage = new MemoryStorage();
const teamsBot = new AgentApplication({
  storage,
  fileDownloaders: [downloader],
});

teamsBot.message("/reset", async (context, state) => {
  state.deleteConversationState();
  await context.sendActivity("Ok I've deleted the current conversation state.");
});

teamsBot.message("/count", async (context, state) => {
  const count = state.conversation.count ?? 0;
  await context.sendActivity(`The count is ${count}`);
});

teamsBot.message("/diag", async (context, state) => {
  await state.load(context, storage);
  await context.sendActivity(JSON.stringify(context.activity));
});

teamsBot.message("/state", async (context, state) => {
  await state.load(context, storage);
  await context.sendActivity(JSON.stringify(state));
});

teamsBot.message("/runtime", async (context, state) => {
  const runtime = {
    nodeversion: process.version,
    sdkversion: version,
  };
  await context.sendActivity(JSON.stringify(runtime));
});

teamsBot.conversationUpdate("membersAdded", async (context, state) => {
  await context.sendActivity(
    `Hi there! I'm an echo bot running on Agents SDK version ${version} that will echo what you said to me.`
  );
});

// Azure AI Foundry integration
const AZURE_ENDPOINT = "https://voxrepofoundry.services.ai.azure.com/api/projects/VoxRepoFoundryAI";
const AGENT_ID = "asst_2nwCGYhb5MJTLEl5Vfna32SL";
const project = new AIProjectClient(
    AZURE_ENDPOINT,
    new DefaultAzureCredential()
);



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

async function handleCallEvent(reqBody) {
  console.log("Received call event:", JSON.stringify(reqBody, null, 2));
  
  const eventType = reqBody.eventType || reqBody.type; // Graph calling event type varies
  
  switch(eventType) {
    case "incomingCall":
      // Accept or reject call logic here
      console.log("Incoming call received.");
      // You could trigger further actions, like answering the call via Graph API
      break;

    case "callConnected":
      console.log("Call connected.");
      break;

    case "callDisconnected":
      console.log("Call disconnected.");
      break;

    default:
      console.log(`Unhandled call event type: ${eventType}`);
  }
}

module.exports = {
  teamsBot,
  handleCallEvent,
};


module.exports.teamsBot = teamsBot;
