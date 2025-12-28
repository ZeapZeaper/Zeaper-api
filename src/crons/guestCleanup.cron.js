"use strict";
const cron = require("node-cron");

const UserModel = require("../models/user");
const WishModel = require("../models/wish");
const BasketModel = require("../models/basket");
const BodyMeasurementTemplateModel = require("../models/bodyMeasurementTemplate");
const NotificationModel = require("../models/notification");
const RecentViewsModel = require("../models/recentViews");
const ReviewModel = require("../models/review");
const { deleteUserFromFirebase } = require("../config/firebase");
const DeliveryAddressModel = require("../models/deliveryAddresses");
const PointModel = require("../models/points");

const BATCH_SIZE = 100;
const DRY_RUN = false; // <--- set to false when ready to run for real

/**
 * Fully delete guests who have NO orders
 */
const cleanupGuestsWithoutOrders = async () => {
  console.log(
    "[CRON] Cleanup guests WITHOUT orders started:",
    new Date().toISOString()
  );

  while (true) {
    const guests = await UserModel.find(
      {
        isGuest: true,
        disabled: false,
        hasOrders: false,
        expiresAt: { $lt: new Date() },
      },
      { _id: 1, uid: 1, userId: 1 }
    ).limit(BATCH_SIZE);

    if (!guests.length) break;

    const userIds = guests.map((u) => u._id);

    if (DRY_RUN) {
      console.log(
        `[DRY RUN] Would fully delete ${guests.length} guest users without orders:`,
        userIds
      );
    } else {
      await Promise.all(
        guests.map((u) =>
          u.uid ? deleteUserFromFirebase(u.uid).catch(() => null) : null
        )
      );
      await Promise.all([
        WishModel.deleteMany({ user: { $in: userIds } }),
        BasketModel.deleteMany({ user: { $in: userIds } }),
        BodyMeasurementTemplateModel.deleteMany({ user: { $in: userIds } }),
        DeliveryAddressModel.deleteMany({ user: { $in: userIds } }),
        NotificationModel.deleteMany({ user: { $in: userIds } }),
        PointModel.deleteMany({ user: { $in: userIds } }),
        RecentViewsModel.deleteMany({ user: { $in: userIds } }),
        ReviewModel.deleteMany({ user: { $in: userIds } }),
        UserModel.deleteMany({ _id: { $in: userIds } }),
      ]);
      console.log(
        `[CRON] Fully deleted ${guests.length} guest users without orders`
      );
    }
  }

  console.log(
    "[CRON] Cleanup guests WITHOUT orders finished:",
    new Date().toISOString()
  );
};

/**
 * Partially clean guests who HAVE orders
 */
const cleanupGuestsWithOrders = async () => {
  console.log(
    "[CRON] Cleanup guests WITH orders started:",
    new Date().toISOString()
  );

  while (true) {
    const guests = await UserModel.find(
      {
        isGuest: true,
        disabled: false,
        hasOrders: true,
        expiresAt: { $lt: new Date() },
      },
      { _id: 1, uid: 1, userId: 1 }
    ).limit(BATCH_SIZE);

    if (!guests.length) break;

    const userIds = guests.map((u) => u._id);

    if (DRY_RUN) {
      console.log(
        `[DRY RUN] Would partially clean ${guests.length} guest users with orders:`,
        userIds
      );
    } else {
      await Promise.all(
        guests.map((u) =>
          u.uid ? deleteUserFromFirebase(u.uid).catch(() => null) : null
        )
      );
      await Promise.all([
        WishModel.deleteMany({ user: { $in: userIds } }),
        BasketModel.deleteMany({ user: { $in: userIds } }),
        BodyMeasurementTemplateModel.deleteMany({ user: { $in: userIds } }),
        DeliveryAddressModel.deleteMany({ user: { $in: userIds } }),
        NotificationModel.deleteMany({ user: { $in: userIds } }),
        PointModel.deleteMany({ user: { $in: userIds } }),
        RecentViewsModel.deleteMany({ user: { $in: userIds } }),
        ReviewModel.deleteMany({ user: { $in: userIds } }),
        UserModel.updateMany(
          { _id: { $in: userIds } },
          { $set: { disabled: true, disabledAt: new Date(), disabledBy: "cron" } }
        ),
      ]);
      console.log(
        `[CRON] Partially cleaned ${guests.length} guest users with orders`
      );
    }
  }

  console.log(
    "[CRON] Cleanup guests WITH orders finished:",
    new Date().toISOString()
  );
};

/**
 * Schedule the cron jobs
 * For testing: you can run a cron in the next 5 seconds by using a special cron expression
 */
const startGuestCleanupCron = (testMode = false) => {
  const cronExpression = testMode ? "*/5 * * * * *" : "0 3 * * *"; // every 5 sec for testing, or 3:00 AM for prod
  const timezone = testMode ? "UTC" : "Europe/London";

  cron.schedule(
    cronExpression,
    async () => {
      try {
        console.log(`[CRON] Running guest cleanup (testMode=${testMode})`);
        await cleanupGuestsWithoutOrders();
        await cleanupGuestsWithOrders();
      } catch (error) {
        console.error("[CRON] Guest cleanup error:", error);
      }
    },
    { timezone }
  );
};

module.exports = startGuestCleanupCron;
