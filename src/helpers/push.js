const { messaging } = require("../config/firebase");

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
    });
};

const sendMultipleDevicePushNotification = async (
  tokens,
  title,
  body,
  image
) => {
  console.log("tokens", tokens, title, body, image);
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
      console.log("response", response);
      if (response.failureCount > 0) {
        const failedTokens = [];
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            failedTokens.push(tokens[idx]);
          }
        });
        console.log("List of tokens that caused failures: " + failedTokens);
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
