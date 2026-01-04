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
    data: {
      notificationType: data?.notificationType || "general",
      roleType: data?.roleType || "buyer",
      ...data,
    },
    token,
  };

  try {
    return await messaging.send(message);
  } catch (error) {
    const errorCode = error?.errorInfo?.code || error?.code || error?.message;

    console.error("Error sending message:", token, errorCode);

    const removableTokenErrors = [
      "messaging/registration-token-not-registered",
      "messaging/invalid-registration-token",
      "messaging/invalid-argument",
    ];

    if (removableTokenErrors.includes(errorCode)) {
      await removeToken(token);
    }

    return null;
  }
};

const removeToken = async (token) => {
  await NotificationModel.updateOne(
    { pushToken: token },
    { $pull: { pushToken: token } }
  );

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
    data: {
      notificationType: data?.notificationType || "general",
      roleType: data?.roleType || "buyer",
      ...data,
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
