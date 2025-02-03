const { messaging } = require("../config/firebase");
const {
  sendOneDevicePushNotification,
  sendMultipleDevicePushNotification,
} = require("../helpers/push");
const { getAuthUser } = require("../middleware/firebaseUserAuth");
const NotificationModel = require("../models/notification");
const UserModel = require("../models/user");

const verifyFCMToken = async (fcmToken) => {
  return messaging.send(
    {
      token: fcmToken,
    },
    true
  );
};

const registerPushToken = async (req, res) => {
  try {
    const { pushToken } = req.body;
    if (!pushToken) {
      return res.status(400).send({ error: "required pushToken" });
    }
    const validToken = await verifyFCMToken(pushToken);

    if (!validToken) {
      return res.status(400).send({ error: "Invalid pushToken" });
    }
    const authUser = await getAuthUser(req);
    // check if existing token. if yes, updste, if no, create
    const user = authUser._id;
    const pushTokenDate = new Date();
    const existingToken = await NotificationModel.findOne({ user });
    if (existingToken) {
      existingToken.pushToken = pushToken;
      existingToken.pushTokenDate = pushTokenDate;
      await existingToken.save();
      return res.status(200).send({ data: existingToken });
    }
    const notification = new NotificationModel({
      user,
      pushToken,
      pushTokenDate,
    });
    await notification.save();
    return res.status(200).send({ data: notification });
  } catch (err) {
    return res.status(500).send({ error: err.message });
  }
};

const testPushNotification = async (req, res) => {
  try {
    const { title, body, image } = req.body;
    if (!title) {
      return res.status(400).send({ error: "required title" });
    }
    if (!body) {
      return res.status(400).send({ error: "required body" });
    }
    const authUser = await getAuthUser(req);
    const userNotification = await NotificationModel.findOne({
      user: authUser._id,
    });
    const pushToken = userNotification.pushToken;
    if (!pushToken) {
      return res.status(400).send({
        error:
          "User push token not found. Ensure you first register the user pushToken",
      });
    }
    const sendPush = await sendOneDevicePushNotification(
      pushToken,
      title,
      body,
      image
    );

    if (sendPush) {
      console.log("Push notification sent");
      return res
        .status(200)
        .send({ message: "Push notification sent", meesageId: sendPush });
    }
    console.log("Failed to send push notification", sendPush);
    return res.status(400).send({ error: "Failed to send push notification" });
  } catch (err) {
    return res.status(500).send({ error: err.message });
  }
};
const testMultiplePushNotification = async (req, res) => {
  try {
    const { title, body, image } = req.body;
    if (!title) {
      return res.status(400).send({ error: "required title" });
    }
    if (!body) {
      return res.status(400).send({ error: "required body" });
    }
    const adminsAndSuperAdmins = await UserModel.find({
      $or: [{ isAdmin: true, superAdmin: true }],
    }).lean();

    const pushTokens = [];
    const adminsIds = adminsAndSuperAdmins.map((admin) => admin._id);
    const userNotifications = await NotificationModel.find({
      user: { $in: adminsIds },
    }).lean();
    userNotifications.forEach((notification) => {
      pushTokens.push(notification.pushToken);
    });

    const sendPush = await sendMultipleDevicePushNotification(
      pushTokens,
      title,
      body,
      image
    );

    if (sendPush) {
      console.log("Push notification sent");
      return res
        .status(200)
        .send({ message: "Push notification sent", meesageId: sendPush });
    }
    console.log("Failed to send push notification", sendPush);
    return res.status(400).send({ error: "Failed to send push notification" });
  } catch (err) {
    return res.status(500).send({ error: err.message });
  }
};

const getNotifications = async (req, res) => {
  try {
    const authUser = await getAuthUser(req);
    const userNotification = await NotificationModel.findOne({
      user: authUser._id,
    })
      .select("notifications")
      .lean();
    return res.status(200).send({ data: userNotification });
  } catch (err) {
    return res.status(500).send({ error: err.message });
  }
};

const getAdminsNotifications = async (req, res) => {
  try {
    const authUser = await getAuthUser(req);
    if (!authUser.isAdmin && !authUser.superAdmin) {
      return res.status(400).send({ error: "Unauthorized" });
    }
    const notifications = await NotificationModel.find({
      isAdminPanel: true,
    })
      .select("notifications")
      .lean();
  } catch (err) {
    return res.status(500).send({ error: err.message });
  }
};

const deleteNotification = async (req, res) => {
  try {
    const { notification_id, isAdminPanel } = req.body;
    const authUser = await getAuthUser(req);
    const query = {
      ...(isAdminPanel && { isAdminPanel }),
      ...(!isAdminPanel && { user: authUser._id }),
    };
    if (isAdminPanel && !authUser.isAdmin && !authUser.superAdmin) {
      return res.status(400).send({ error: "Unauthorized" });
    }
    const userNotification = await NotificationModel.findOne({
      ...query,
    }).select("notifications");
    if (!userNotification) {
      return res.status(400).send({ error: "Notification not found" });
    }
    const notifications = userNotification.notifications;
    const newNotifications = notifications.filter(
      (notification) => notification._id !== notification_id
    );
    userNotification.notifications = newNotifications;
    await userNotification.save();
    return res
      .status(200)
      .send({ data: userNotification, message: "Notification deleted" });
  } catch (err) {
    return res.status(500).send({ error: err.message });
  }
};
const addNotification = async (param) => {
  try {
    const { title, body, image, isAdminPanel, user_id } = param;
    if (!title) {
      return { error: "required title" };
    }
    if (!body) {
      return { error: "required body" };
    }
    if (isAdminPanel && !user_id) {
      return { error: "required user_id" };
    }
    let userNotification;
    if (isAdminPanel) {
      userNotification = await NotificationModel.findOne({
        isAdminPanel: true,
      });
    }
    if (!isAdminPanel) {
      userNotification = await NotificationModel.findOne({ user: user_id });
    }
    const notifications = userNotification.notifications;
    notifications.push({ title, body, image });
    userNotification.notifications = notifications;
    await userNotification.save();
    return { data: userNotification };
  } catch (err) {
    return { error: err.message };
  }
};

module.exports = {
  registerPushToken,
  testPushNotification,
  testMultiplePushNotification,
  getNotifications,
  getAdminsNotifications,
  deleteNotification,
  addNotification,
  
};
