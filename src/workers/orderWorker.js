const { Worker } = require("bullmq");
const UserModel = require("../models/user");
const EmailTemplateModel = require("../models/emailTemplate");
const {
  replaceOrderVariablesinTemplate,
  replaceUserVariablesinTemplate,
} = require("../helpers/utils");
const { sendProductOrdershopEmail } = require("../resolvers/order");
const {
  sendPushAllAdmins,
  notifyIndividualUser,
  notifyShop,
} = require("../resolvers/notification");
const { addPointAfterSales } = require("../resolvers/point");
const orderQueue = require("../queue/orderQueue");
const { sendEmail } = require("../helpers/emailer");

const worker = new Worker(
  orderQueue.name,
  async (job) => {
    const tasks = job.data.workerTasks;

    for (const task of tasks) {
      try {
        switch (task.taskType) {
          case "notifyShop":
            await notifyShop({
              shop_id: task.shop_id,
              title: task.title,
              body: task.body,
              image: task.image,
              data: {
                orderId: task.orderId,
                itemNo: task.itemNo,
                productOrder_id: task.productOrder_id,
                notificationType: "order",
                roleType: "vendor",
              },
            });
            break;

          case "notifyUser":
            await notifyIndividualUser({
              user_id: task.user_id,
              title: task.title,
              body: task.body,
              image: task.image,
              data: {
                orderId: task.orderId,
                notificationType: "order",
                roleType: "buyer",
              },
            });
            break;

          case "sendBuyerOrderEmail":
            {
              const orderEmailTemplate = await EmailTemplateModel.findOne({
                name: "successful-order",
              }).lean();
              const user = await UserModel.findById(task.user_id).lean();

              const emailBody = replaceOrderVariablesinTemplate(
                replaceUserVariablesinTemplate(orderEmailTemplate?.body, user),
                task.order // lean object: { orderId, orderPoints, itemNo }
              );

              const emailSubject = replaceOrderVariablesinTemplate(
                replaceUserVariablesinTemplate(
                  orderEmailTemplate?.subject,
                  user
                ),
                task.order
              );

              await sendEmail({
                from: "admin@zeaper.com",
                to: [user.email],
                subject: emailSubject || "Order Successful",
                body: emailBody || "",
                attach: true,
                order_id: task.order.orderId,
              });
            }
            break;

          case "notifyAdmins":
            await sendPushAllAdmins({
              title: task.title,
              body: task.body,
              image: task.image,
              data: {
                orderId: task.orderId,
                notificationType: "order",
                roleType: "admin",
              },
            });
            break;

          case "addLoyaltyPoints":
            await addPointAfterSales(task.user_id, task.points);
            break;
          case "updateBuyerHasOrders":
            await UserModel.findByIdAndUpdate(task.user_id, {
              hasOrders: true,
            });
            break;

          case "sendProductOrdershopEmail":
            await sendProductOrdershopEmail(task.productOrder);
            break;

          default:
            console.warn("Unknown task type:", task.taskType);
        }
        console.log(
          `Task ${task.taskType} completed for order ${
            task.orderId || task.productOrder?._id
          }`
        );
      } catch (err) {
        console.error(`Task ${task.taskType} failed`, err);
      }
    }

    return { status: "done" };
  },
  { connection: orderQueue.opts.connection }
);

worker.on("completed", (job) => console.log("Job completed", job.id));
worker.on("failed", (job, err) => console.error("Job failed", job.id, err));
