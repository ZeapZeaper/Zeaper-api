const { messaging } = require("../config/firebase");
const NotificationModel = require("../models/notification");

const sendOneDevicePushNotification = async ({
  token,
  title,
  body,
  image,
  data,
}) => {
  const message = {
    notification: {
      title,
      body,
      image:
        image ||
        "https://admin.zeaper.com/static/media/Iconmark_green.129d5bdb389ec6130623.png",
    },
    data:{
      notificationType: data?.notificationType || 'general',
      roleType: data?.roleType || 'buyer',
      ...data
    },
    token,
  };

  return messaging
    .send(message)
    .then((response) => {
      // Response is a message ID string.

      return response;
    })
    .catch((error) => {
      console.log("Error sending message:", token, error);
      if (
        error.code === "messaging/invalid-argument" ||
        error.code === "messaging/registration-token-not-registered"
      ) {
        removeToken(token);
      }
    });
};

const removeToken = async (token) => {
  const userNotifications = await NotificationModel.findOne({
    pushToken: token,
  })
    .select("pushToken")
    .lean();
  if (userNotifications) {
    const pushToken = userNotifications.pushToken;
    const modifiedToken = pushToken.filter((item) => item !== token);
    await NotificationModel.findOneAndUpdate(
      { pushToken: token },
      { $set: { pushToken: modifiedToken } },
      { new: true }
    );
  }
  return { success: true };
};

const sendMultipleDevicePushNotification = async ({
  tokens,
  title,
  body,
  data,
  image,
}) => {
  const message = {
    notification: {
      title,
      body,
      image:
        image ||
        "https://admin.zeaper.com/static/media/Iconmark_green.129d5bdb389ec6130623.png",
    },
    data:{
      notificationType: data?.notificationType || 'general',
      roleType: data?.roleType || 'buyer',
      ...data
    },
    tokens,
  };

  return messaging
    .sendEachForMulticast(message)
    .then((response) => {
      if (response.failureCount > 0) {
        const failedTokens = [];
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            failedTokens.push(tokens[idx]);
          }
        });
        console.log("List of tokens that caused failures: " + failedTokens);
        if (failedTokens.length > 0) {
          failedTokens.forEach(async (token) => {
            await removeToken(token);
          });
        }
      }
      return response;
    })
    .catch((error) => {
      console.log("Error sending message:", error);
    });
};

module.exports = {
  sendOneDevicePushNotification,
  sendMultipleDevicePushNotification,
};
