const UserModel = require("../models/user");
const ShopModel = require("../models/shop");
const { storageRef } = require("../config/firebase"); // reference to our db
const root = require("../../root");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const sharp = require("sharp");
const {
  deleteLocalFile,
  cryptoDecrypt,
  cryptoEncrypt,
} = require("../helpers/utils");
const validator = require("email-validator");
const { firebase } = require("../config/firebase");
const { generateUniqueShopId } = require("./shop");
const { getAuthUser } = require("../middleware/firebaseUserAuth");

//saving image to firebase storage
const addImage = async (req, filename) => {
  let url = {};
  if (filename) {
    const source = path.join(root + "/uploads/" + filename);
    await sharp(source)
      .resize(1024, 1024)
      .jpeg({ quality: 90 })
      .toFile(path.resolve(req.file.destination, "resized", filename));
    const storage = await storageRef.upload(
      path.resolve(req.file.destination, "resized", filename),
      {
        public: true,
        destination: `/user/${filename}`,
        metadata: {
          firebaseStorageDownloadTokens: uuidv4(),
        },
      }
    );
    url = { link: storage[0].metadata.mediaLink, name: filename };
    const deleteSourceFile = await deleteLocalFile(source);
    const deleteResizedFile = await deleteLocalFile(
      path.resolve(req.file.destination, "resized", filename)
    );
    await Promise.all([deleteSourceFile, deleteResizedFile]);
    return url;
  }
  return url;
};

const deleteImageFromFirebase = async (name) => {
  if (name) {
    storageRef
      .file("/user/" + name)
      .delete()
      .then(() => {
        return true;
      })
      .catch((err) => {
        console.log("err is", err);
        return false;
      });
  }
};

function getRandomInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

const generateUniqueUserId = async () => {
  let userId;
  let found = true;

  do {
    const randomVal = getRandomInt(1000000, 9999999);
    userId = `${randomVal}`;
    const exist = await UserModel.findOne(
      {
        userId,
      },
      { lean: true }
    );

    if (exist) {
      found = true;
    } else {
      found = false;
    }
  } while (found);

  return userId.toString();
};
const addUserToFirebase = async (params) => {
  const { email, password, displayName } = params;

  try {
    const user = await firebase
      .auth()
      .createUser({ email, password, displayName });

    return user;
  } catch (error) {
    return error;
  }
};
const deleteUserFromFirebase = async (uid) => {
  try {
    console.log("deleting user", uid);
    const user = await firebase.auth().deleteUser(uid);
    return user;
  } catch (error) {
    return error;
  }
};
const addShop = async (user, shopName) => {
  const shopId = await generateUniqueShopId();
  const shop = new ShopModel({
    shopId,
    userId: user?.userId,
    user: user?._id,
    shopName,
  });
  const newShop = await shop.save();
  return newShop;
};

const createUser = async (req, res) => {
  const { email, firstName, lastName, password, isVendor, shopName } = req.body;
  let firebaseUser = {};
  let newUser;
  let shopId;

  try {
    if (!email) {
      return res.status(400).send({ error: "email is required" });
    }
    if (!password) {
      return res.status(400).send({ error: "password is required" });
    }

    if (!firstName) {
      return res.status(400).send({ error: "firstName is required" });
    }
    if (!lastName) {
      return res.status(400).send({ error: "lastName is required" });
    }
    if (isVendor && !shopName) {
      return res.status(400).send({
        error:
          "shopName is required as the user is registering as a vendor as well",
      });
    }
    if (email && !validator.validate(email)) {
      return res.status(400).send({ error: "email is invalid" });
    }
    if (email) {
      const alreadyUser = await UserModel.findOne({ email }).lean();

      if (alreadyUser) {
        return res.status(400).send({
          error: "An account with same email address is already existing.",
        });
      }
    }

    
    //const encryptedPassword = cryptoEncrypt(password);
    //console.log("encryptedPassword", encryptedPassword);
    const decriptedPassword = cryptoDecrypt(password);
    req.body.password = decriptedPassword;
    firebaseUser = await addUserToFirebase(req.body);
    if (!firebaseUser.uid) {
      return res.status(400).send({ error: "Error creating user" });
    }

    let imageUrl = {};

    if (req.file) {
      imageUrl = await addImage(req, req.file.filename);
    }
    if (req.body?.social) {
      req.body.social = JSON.parse(req.body.social);
    }

    const userId = await generateUniqueUserId();

    const params = {
      firstName,
      lastName,
      ...req.body,
      imageUrl,
      email,
      userId,
      uid: firebaseUser.uid,
      emailVerified: firebaseUser.emailVerified,
    };
    const user = new UserModel({ ...params });
    newUser = await user.save();

    const data = {};

    if (isVendor) {
      const shop = await addShop(newUser, shopName);
      console.log("shop", shop);
      shopId = shop.shopId;
      if (!shopId) {
        return res.status(500).send({ error: "Error creating shop" });
      }
      const updatedUser = await UserModel.findByIdAndUpdate(
        newUser._id,
        {
          shopId,
          shopEnabled: true,
        },
        { new: true }
      );
      if (!updatedUser) {
        return res.status(500).send({ error: "Error updating user shop" });
      }
      newUser = updatedUser;
      data.shop = shop;
      data.user = newUser;
    }

    return res.status(200).send({
      data,
      message: "User created successfully and email verification sent",
    });
  } catch (error) {
    if (firebaseUser.uid) {
      const deleteFirebaseUser = await deleteUserFromFirebase(firebaseUser.uid);
      if (deleteFirebaseUser) {
        console.log("Error deleting user from firebase", firebaseUser);
      }
    }
    if (newUser?._id) {
      const deleteUser = await UserModel.findByIdAndDelete(newUser._id);
      if (!deleteUser) {
        console.log("Error deleting user", newUser._id);
      }
    }
    if (shopId) {
      const deleteShop = await ShopModel.findOneAndDelete({ shopId }).lean();
      if (!deleteShop) {
        console.log("Error deleting shop", shopId);
      }
    }
    return res
      .status(500)
      .send({ error: error.message, message: "Error creating user" });
  }
};

const createUserWithGoogleOrApple = async (req, res) => {
  try {
    const { email, firstName, lastName, imageUrl } = req.body;

    if (!email) {
      return res.status(400).send({ error: "email is required" });
    }
    if (!firstName) {
      return res.status(400).send({ error: "firstName is required" });
    }
    if (!lastName) {
      return res.status(400).send({ error: "lastName is required" });
    }
    const authUser = getAuthUser(req);
    if (!authUser) {
      return res.status(400).send({ error: "User not found in firebase" });
    }
    const alreadyUser = await UserModel.findOne({ email }).lean();
    if (alreadyUser) {
      const deleteFirebaseUser = await deleteUserFromFirebase(uid);
      return res.status(400).send({
        error: "An account with same email address is already existing.",
      });
    }
    const uid = authUser.uid;
    const displayName = `${firstName} ${lastName}`;
    const userId = await generateUniqueUserId();
    const user = new UserModel({
      email,
      firstName,
      lastName,
      displayName,
      imageUrl,
      userId,
      uid,
    });
    const newUser = await user.save();
    return res
      .status(200)
      .send({ data: newUser, message: "User created successfully" });
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};

const getUsers = async (req, res) => {
  try {
    const skip = parseInt(req.query.skip) || 0;
    const limit = parseInt(req.query.limit) || 10;
    const sort = req.query.sort || "desc";
    const search = req.query.search || "";
    const match = {
      ...req.query,
    };
    if (search) {
      match.$or = [
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }
    const query = { ...match };
    const users = await UserModel.find(query)
      .sort({ createdAt: sort })
      .skip(skip)
      .limit(limit)
      .lean();
    return res.status(200).send({ data: users });
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};

const getUser = async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) {
      return res.status(400).send({ error: "userId is required" });
    }
    const user = await UserModel.findOne({ userId }).lean();
    if (!user) {
      return res.status(404).send({ error: "User not found" });
    }
    return res.status(200).send({ data: user });
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};
const getUserById = async (req, res) => {
  try {
    const { _id } = req.query;
    if (!_id) {
      return res.status(400).send({ error: "_id is required" });
    }

    const user = await UserModel.findById(_id).lean();
    const email = user?.email;
    let userAccessRecord = {
      adminAccess: user?.isAdmin || user?.superAdmin,
    };
    if (email) {
      await firebase
        .auth()
        .getUserByEmail(email)
        .then((userRecord) => {
          if (userRecord?.uid) {
            userAccessRecord = {
              email: userRecord?.email,
              emailVerified: userRecord?.emailVerified,
              creationTime: userRecord?.metadata?.creationTime,
              lastSignInTime: userRecord?.metadata?.lastSignInTime,
            };
          }
        })
        .catch((error) => {
          console.log("Error fetching user data:", error);
        });
    }
    user.userAccessRecord = userAccessRecord;

    return res.status(200).send({ data: user });
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};

const getAdminUsers = async (req, res) => {
  try {
    const { isAdmin, disabled, superAdmin } = req.query;
    const users = await UserModel.find({
      disabled,
      $or: [{ isAdmin }, { superAdmin }],
    }).lean();
    return res.status(200).send({ data: users });
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};

const updateUser = async (req, res) => {
  
  try {
    
    const { _id } = req.query;
    if (!_id) {
      return res.status(400).send({ error: "_id is required" });
    }
    const user = await UserModel.findById(_id);
    if (!user) {
      return res.status(404).send({ error: "User not found" });
    }

    const updatedUser = await UserModel.findByIdAndUpdate(_id, req.body);

    return res
      .status(200)
      .send({ data: updatedUser, message: "User updated successfully" });
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};

const validateUsers = async (ids) => {
  const invalidUser = await ids.reduce(async (acc, item) => {
    let invalid = await acc;

    const found = await UserModel.findById(item);

    if (!found) {
      invalid.push(id);
    }

    return invalid;
  }, []);
};

const deleteUser = async (contacts) => {
  return contacts.reduce(async (acc, _id) => {
    const result = await acc;
    const disabled = await OrganisationUserModel.findByIdAndUpdate(
      _id,
      { disabled: true },
      { new: true }
    );
    if (!disabled) {
      result.push(_id);
    }

    return result;
  }, []);
};
const deleteUsers = async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids) {
      return res.status(400).send({ error: "ids are required" });
    }
    const invalidUsers = await validateUsers(ids);
    if (invalidUsers.length > 0) {
      return res.status(404).send({ error: "Invalid users" });
    }
    const deletedUsers = await deleteUser(ids);
    if (deletedUsers.length > 0) {
      return res.status(500).send({ error: "Error deleting users" });
    }
    return res.status(200).send({ message: "Users deleted successfully" });
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};
const restoreUserIds = async (ids) => {
  return ids.reduce(async (acc, _id) => {
    const result = await acc;
    const restored = await OrganisationUserModel.findByIdAndUpdate(
      _id,
      { disabled: false },
      { new: true }
    );
    if (!restored) {
      result.push(_id);
    }

    return result;
  }, []);
};
const restoreUser = async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids) {
      return res.status(400).send({ error: "ids are required" });
    }
    const invalidUsers = await validateUsers(ids);
    if (invalidUsers.length > 0) {
      return res.status(404).send({ error: "Invalid users" });
    }
    const restoredUsers = await restoreUserIds(ids);
    if (restoredUsers.length > 0) {
      return res.status(500).send({ error: "Error restoring users" });
    }
    return res.status(200).send({ message: "Users restored successfully" });
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};

const absoluteDeleteUser = async (req, res) => {
  try {
    const { _id } = req.query;
    if (!_id) {
      return res.status(400).send({ error: "_id is required" });
    }
    const user = await UserModel.findById(_id);
    if (!user) {
      return res.status(404).send({ error: "User not found" });
    }
    const deletedUser = await UserModel.findByIdAndDelete(_id);
    if (!deletedUser) {
      return res.status(500).send({ error: "Error deleting user" });
    }
    const deleteFirebaseUser = await deleteUserFromFirebase(user.uid);
    if (!deleteFirebaseUser) {
      return res
        .status(500)
        .send({ error: "Error deleting user from firebase" });
    }
    if (user.imageUrl?.name) {
      const deleteImage = await deleteImageFromFirebase(user.imageUrl.name);
      if (!deleteImage) {
        return res.status(500).send({ error: "Error deleting image" });
      }
    }
    const deleteShop = await ShopModel.findOneAndDelete({
      userId: user.userId,
    }).lean();
    if (!deleteShop) {
      return res.status(500).send({ error: "Error deleting shop" });
    }

    return res.status(200).send({ message: "User deleted successfully" });
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};
const getUserByUid = async (req, res) => {
  try {
    const { uid } = req.query;
    if (!uid) {
      return res.status(400).send({ error: "uid is required" });
    }
    const user = await UserModel.findOne({
      uid,
    }).lean();
    if (!user) {
      return res.status(404).send({ error: "User not found" });
    }
    if(user?.disabled){
      return res.status(404).send({ error: "User is disabled" });
    }
    return res.status(200).send({ data: user });
  }
  catch (error) {
    return res.status(500).send({ error: error.message });
  }
}
module.exports = {
  createUser,
  createUserWithGoogleOrApple,
  getUsers,
  getUser,
  getUserById,
  getAdminUsers,
  updateUser,
  deleteUsers,
  restoreUser,
  absoluteDeleteUser,
  getUserByUid,
};
