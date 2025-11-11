const { firebase } = require("../config/firebase");
const { userCache, tokenCache } = require("../helpers/cache");
const UserModel = require("../models/user");
const ObjectId = require("mongoose").Types.ObjectId;

function isValidObjectId(id) {
  if (ObjectId.isValid(id)) {
    if (String(new ObjectId(id)) === id) return true;
    return false;
  }
  return false;
}
// Utility to extract token from headers
const getToken = (request) => {
  const headerToken = request.headers.authorization;
  if (!headerToken) {
    console.log("No token provided");
    return { error: "No token provided" };
  }

  if (headerToken && headerToken.split(" ")[0] !== "Bearer") {
    console.log("Invalid token");
    return { error: "Invalid token" };
  }

  const token = headerToken.split(" ")[1];
  return token;
};

// Auth middleware with token verification and caching of decoded token
const authMiddleware = async (request, response, next) => {
  try {
    const token = getToken(request);

    if (token.error) {
      return response
        .status(401)
        .send({ message: "Could not authorize", error: token.error });
    }

    // Check if decoded token is already cached
    let decodedToken = tokenCache.get(token);

    if (!decodedToken) {
      decodedToken = await firebase.auth().verifyIdToken(token);
      tokenCache.set(token, decodedToken, 60 * 60); // cache for 1 hour
    }

    // Attach decoded token to request for reuse
    request.authUser = decodedToken;
    const uid = decodedToken.uid;

    // Check if user is cached
    let cachedUser = userCache.get(uid);
    if (cachedUser) {
      request.cachedUser = cachedUser;
      return next();
    }
    next();
  } catch (error) {
    console.log("Error verifying token:", error);
    response.status(401).send({ message: "Could not authorize", error });
  }
};

// Optimized getAuthUser using request.authUser and caching user
const getAuthUser = async (request) => {
  const authUser = request.authUser;
  if (!authUser) return null;

  const uid = authUser.uid;

  // Check user cache first
  let cachedUser = userCache.get(uid);

  if (cachedUser) return cachedUser;

  // Fetch from DB if not cached
  const user = await UserModel.findOne({ uid });
  if (!user) return false;

  userCache.set(uid, user);
  return user;
};
const getAuthUserUid = async (request) => {
  const authUser = request.authUser;
  if (!authUser) return null;

  return authUser.uid;
};

const authUserAdminMiddleware = async (request, response, next) => {
  const token = getToken(request);
  const authUser = await firebase.auth().verifyIdToken(token);
  if (!authUser) {
    return response.send({ message: "Could not authorize", error }).status(400);
  }
  const uid = authUser.uid;
  const cachedUser = userCache.get(uid);
  if (cachedUser) {
    if (!cachedUser.isAdmin && !cachedUser.superAdmin) {
      return response
        .status(400)
        .json({ error: "You are not authorized to perform this operation" });
    }
    request.cachedUser = cachedUser;
    return next();
  }
  const user = await UserModel.findOne({ uid });
  if (!user) {
    return response.send({ message: "User not found" }).status(400);
  }

  if (!user.isAdmin && !user.superAdmin) {
    return response
      .status(400)
      .json({ error: "You are not authorized to perform this operation" });
  }
  request.cachedUser = user;
  next();
};

module.exports = {
  authMiddleware,
  getAuthUser,
  authUserAdminMiddleware,
  getAuthUserUid,
};
