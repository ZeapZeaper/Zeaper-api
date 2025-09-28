const { messaging } = require("../config/firebase");
const {
  sendOneDevicePushNotification,
  sendMultipleDevicePushNotification,
} = require("../helpers/push");
const { getAuthUser } = require("../middleware/firebaseUserAuth");
const NotificationModel = require("../models/notification");
const ShopModel = require("../models/shop");
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
    const { pushToken, isAdminPanel } = req.body;
    if (!pushToken) {
      return res.status(400).send({ error: "required pushToken" });
    }
    const validToken = await verifyFCMToken(pushToken);

    if (!validToken) {
      return res.status(400).send({ error: "Invalid pushToken" });
    }
    const pushTokenDate = new Date();

    const authUser = await getAuthUser(req);

    if (isAdminPanel && !authUser.isAdmin && !authUser.superAdmin) {
      return res.status(400).send({ error: "Unauthorized" });
    }
    if (isAdminPanel) {
      const adminNotification = await NotificationModel.findOne({
        isAdminPanel: true,
      });

      if (adminNotification) {
        const existed = adminNotification.pushToken.find(
          (token) => token === pushToken
        );
        if (existed) {
          return res.status(200).send({ data: adminNotification });
        }
        adminNotification.pushToken.push(pushToken);
        adminNotification.pushTokenDate = pushTokenDate;
        await adminNotification.save();

        return res.status(200).send({ data: adminNotification });
      }
      const notification = new NotificationModel({
        isAdminPanel: true,
        pushToken: [pushToken],
        pushTokenDate,
      });
      await notification.save();
      return res.status(200).send({ data: notification });
    }
    // check if existing token. if yes, updste, if no, create
    const user = authUser._id;
   

    const userToken = await NotificationModel.findOne({ user });
  
    if (userToken) {
      const existed = userToken.pushToken.find((token) => token === pushToken);

      if (existed) {
        return res.status(200).send({ data: userToken });
      }
      userToken.pushToken.push(pushToken);
      userToken.pushTokenDate = pushTokenDate;
      await userToken.save();

      return res.status(200).send({ data: userToken });
    }
    const notification = new NotificationModel({
      user,
      pushToken: [pushToken],
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

    if (pushToken.length === 0) {
      return res.status(400).send({
        error:
          "User push token not found. Ensure you first register the user pushToken",
      });
    }
 
    const messageids = [];
    const promises = pushToken.map(async (token) => {
      const sendPush = await sendOneDevicePushNotification(
        token,
        title,
        body,
        image
      );
      if (sendPush) {
        messageids.push(sendPush);
      }
    });
    await Promise.all(promises);
    if (messageids.length > 0) {
      return res
        .status(200)
        .send({ message: "Push notification sent", messageIds: messageids });
    }
    return res.status(400).send({ error: "Failed to send push notification" });
  } catch (err) {
    console.log("err", err);
    return res.status(500).send({ error: err.message });
  }
};
const sendPushOneDevice = async (pushToken, title, body, image) => {
  try {
    const sendPush = await sendOneDevicePushNotification(
      pushToken,
      title,
      body,
      image
    );
    if (sendPush) {
      return { message: "Push notification sent", meesageId: sendPush };
    }

    return { error: "Failed to send push notification" };
  } catch (err) {
    return { error: err.message };
  }
};
const sendPushMultipleDevice = async (pushTokens, title, body, image) => {
  try {
    const sendPush = await sendMultipleDevicePushNotification(
      pushTokens,
      title,
      body,
      image
    );
    if (sendPush) {
      console.log("Push notification sent");
      return { message: "Push notification sent", meesageId: sendPush };
    }
    console.log("Failed to send push notification", sendPush);
    return { error: "Failed to send push notification" };
  } catch (err) {
    return { error: err.message };
  }
};
const sendPushAllAdmins = async (title, body, image) => {
  try {
    const adminsNotifications = await NotificationModel.findOne({
      isAdminPanel: true,
    }).lean();

    const pushTokens = adminsNotifications.pushToken;
    console.log("pushTokens", pushTokens);
    const sendPush = await sendMultipleDevicePushNotification(
      pushTokens,
      title,
      body,
      image
    );

    if (sendPush) {
      console.log("Push notification sent");
      return { message: "Push notification sent", meesageId: sendPush };
    }
    console.log("Failed to send push notification", sendPush);
    return { error: "Failed to send push notification" };
  } catch (err) {
    return { error: err.message };
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
    const userNotification = (await NotificationModel.findOne({
      user: authUser._id,
    })
      .select("notifications")
      .lean()) || { notifications: [] };
    const sortedNotifications = userNotification.notifications.sort((a, b) => {
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
    userNotification.notifications = sortedNotifications || [];
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
    const notifications = (await NotificationModel.findOne({
      isAdminPanel: true,
    })
      .select("notifications")
      .lean()) || { notifications: [] };
    const sortedNotifications = notifications.notifications.sort((a, b) => {
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
    notifications.notifications = sortedNotifications || [];
    return res.status(200).send({ data: notifications });
  } catch (err) {
    return res.status(500).send({ error: err.message });
  }
};

const deleteNotification = async (req, res) => {
  try {
    const { notification_id, isAdminPanel } = req.body;
    if (!notification_id) {
      return res.status(400).send({ error: "required notification_id" });
    }
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
      (notification) =>
        notification._id.toString() !== notification_id.toString()
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
const clearAllAuthUserNotifications = async (req, res) => {
  try {
    const authUser = await getAuthUser(req);
    const userNotification = await NotificationModel.findOne({
      user: authUser._id,
    });
    if (!userNotification) {
      return res.status(400).send({ error: "Notification not found" });
    }
    userNotification.notifications = [];
    await userNotification.save();
    return res
      .status(200)
      .send({ data: userNotification, message: "All notifications cleared" });
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
    if (!isAdminPanel && !user_id) {
      return { error: "required user_id" };
    }

    let userNotification;

    if (isAdminPanel) {
      userNotification = await NotificationModel.findOne({
        isAdminPanel: true,
      });
      if (!userNotification) {
        userNotification = new NotificationModel({
          isAdminPanel: true,
        });
        await userNotification.save();
      }
    }
    if (!isAdminPanel) {
      userNotification = await NotificationModel.findOne({ user: user_id });
    }
    if (!userNotification && user_id) {
      userNotification = new NotificationModel({
        user: user_id,
      });
      await userNotification.save();
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
const notifyShop = async (param) => {
  try {
    const { shop_id, title, body, image } = param;
    const shop = await ShopModel.findById(shop_id).lean().select("user");
    const user = shop.user;
    if (!user) {
      return { error: "User not found" };
    }
    const userNotification = await NotificationModel.findOne({
      user,
    });
    const pushToken = userNotification.pushToken;
    if (pushToken.length > 0) {
      const push = await sendPushMultipleDevice(pushToken, title, body, image);
    }
    const notificationParam = {
      title,
      body,
      image,
      isAdminPanel: false,
      user_id: user,
    };
    const addUserNotification = await addNotification(notificationParam);
    return {
      data: { push, notificationBox: addUserNotification },
      message: "User notified",
    };
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
  clearAllAuthUserNotifications,
  addNotification,
  sendPushOneDevice,
  sendPushMultipleDevice,
  sendPushAllAdmins,
  notifyShop,
};
