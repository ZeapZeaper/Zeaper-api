const startGuestCleanupCron = require("./guestCleanup.cron");

const startCrons = () => {
  console.log("[CRON] Initializing crons...");
  startGuestCleanupCron(false);// set to true for test mode
};

module.exports = startCrons;
