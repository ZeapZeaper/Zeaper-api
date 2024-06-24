const { firebase } = require("../config/firebase");
const ObjectId = require("mongoose").Types.ObjectId;

function isValidObjectId(id) {
  if (ObjectId.isValid(id)) {
    if (String(new ObjectId(id)) === id) return true;
    return false;
  }
  return false;
}

function authMiddleware(request, response, next) {
  const headerToken = request.headers.authorization;
  if (!headerToken) {
    console.log("No token provided");
    return response.status(401).send({ message: "No token provided" });
  }

  if (headerToken && headerToken.split(" ")[0] !== "Bearer") {
    console.log("Invalid token");
    return response.status(401).send({ message: "Invalid token" });
  }

  const token = headerToken.split(" ")[1];

  firebase
    .auth()
    .verifyIdToken(token)
    .then((res) => {
      next();
    })
    .catch((error) => {
      console.log("error in verifying token", error);
      response.send({ message: "Could not authorize", error }).status(400);
    });
}

module.exports = authMiddleware;
