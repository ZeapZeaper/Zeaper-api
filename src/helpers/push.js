const { messaging } = require("../config/firebase");
const NotificationModel = require("../models/notification");

const sendOneDevicePushNotification = async (token, title, body, image) => {
  const message = {
    notification: {
      title,
      body,
      image:
        image ||
        "https://zeap.netlify.app/static/media/app_logo.620ff058fcbcd2428e3c.png",
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
      console.log("Error sending message:", error);
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

const sendMultipleDevicePushNotification = async (
  tokens,
  title,
  body,
  image
) => {
 
  const message = {
    notification: {
      title,
      body,
      image:
        image ||
        "https://zeap.netlify.app/static/media/app_logo.620ff058fcbcd2428e3c.png",
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
