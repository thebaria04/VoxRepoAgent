// index.js is used to setup and configure your bot

// Import required packages
const express = require("express");

// Import required bot services.
// See https://aka.ms/bot-services to learn more about the different parts of a bot.
const { authorizeJWT, CloudAdapter, loadAuthConfigFromEnv } = require("@microsoft/agents-hosting");
const { teamsBot } = require("./teamsBot");

// Create authentication configuration
const authConfig = loadAuthConfigFromEnv();

// Create adapter
const adapter = new CloudAdapter(authConfig);

adapter.onTurnError = async (context, error) => {
  console.error(`[onTurnError] unhandled error:`, error); // log the whole error
  if (context.activity.type === "message") {
    await context.sendActivity(`The bot encountered an unhandled error:\n ${error && error.message ? error.message : error}`);
    await context.sendActivity("To continue to run this bot, please fix the bot source code.");
  }
};

// Create express application.
const expressApp = express();
expressApp.use(express.json());
//expressApp.use(authorizeJWT(authConfig));

const port = process.env.port || process.env.PORT || 3978;
const server = expressApp.listen(port, () => {
  console.log(
    `Bot Started, listening to port ${port} for appId ${authConfig.clientId} debug ${process.env.DEBUG}`
  );
});

// Listen for incoming requests.
expressApp.post("/api/messages", async (req, res) => {
  console.log('Hi, I am inside api/messages');
  console.log('Request body:', req.body);
  await adapter.process(req, res, async (context) => {
    console.log('Hi, I am inside adapter.process');
    await teamsBot.run(context);
  });
});

// Gracefully shutdown HTTP server
["exit", "uncaughtException", "SIGINT", "SIGTERM", "SIGUSR1", "SIGUSR2"].forEach((event) => {
  process.on(event, () => {
    server.close();
  });
});
