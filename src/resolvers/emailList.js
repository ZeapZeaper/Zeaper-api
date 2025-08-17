const EmailListModel = require("../models/emailList");

const addToWaitingList = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  try {
    const existingEmail = await EmailListModel.findOne({
      email,
      subscribedTo: "waitlist",
    });
    if (existingEmail) {
      return res.status(200).send({
        data: existingEmail,
        message: "You are already on the waiting list.",
      });
    }

    const newEntry = new EmailListModel({
      email,
      subscribedTo: "waitlist",
      source: "website",
    });

    await newEntry.save();
    return res.status(200).send({
      data: newEntry,
      message: "Successfully added to the waiting list.",
    });
  } catch (error) {
    console.error("Error adding to waiting list:", error);
    return res
      .status(400)
      .send({ error: "Failed to add to the waiting list." });
  }
};

const addToNewsletter = async (req, res) => {
    console.log("Adding to newsletter");
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  try {
    const existingEmail = await EmailListModel.findOne({
      email,
      subscribedTo: "newsletter",
    });
    if (existingEmail) {
      return res.status(200).send({
        data: existingEmail,
        message: "You are already subscribed to the newsletter.",
      });
    }

    const newEntry = new EmailListModel({
      email,
      subscribedTo: "newsletter",
      source: "website",
    });

    await newEntry.save();
    return res.status(200).send({
      data: newEntry,
      message: "Successfully subscribed to the newsletter.",
    });
  } catch (error) {
    console.error("Error subscribing to newsletter:", error);
    res.status(400).send({ error: "Failed to subscribe to the newsletter." });
  }
};

const removeFromEmailList = async (req, res) => {
  const { email, subscribedTo } = req.body;

  if (!email || !subscribedTo) {
    return res
      .status(400)
      .json({ error: "Email and subscription type are required" });
  }

  try {
    const result = await EmailListModel.deleteOne({ email, subscribedTo });
    if (result.deletedCount === 0) {
        return res.status(404).send({
            message: "No matching email found in the list.",
        });
    }
    return res.status(200).send({
        message: `Successfully removed from the email list for ${subscribedTo}.`,
        data: { email, subscribedTo },
    });
  } catch (error) {
    console.error("Error removing from email list:", error);
    return res.status(500).send({
        message: "Failed to remove from the email list.",
    });
  }
};

module.exports = {
  addToWaitingList,
  addToNewsletter,
  removeFromEmailList,
};
