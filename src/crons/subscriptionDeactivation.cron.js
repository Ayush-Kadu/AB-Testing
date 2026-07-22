const cron = require("node-cron");
const Usersubscription = require("../models/user.subscription.model");

const scheduleSubscriptionDeactivation = () => {
    // Runs every day at 11:30 PM(23:30) 
    cron.schedule("30 23 * * *", async () => {
        try {
            const now = new Date();

            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, "0");
            const day = String(now.getDate()).padStart(2, "0");

            const dateStr = `${year}-${month}-${day}`;
            const startDate = `${dateStr} 00:00:00`;
            const endDate = `${dateStr} 23:59:59`;

            console.log("Checking subscriptions with endDate between:", startDate, "and", endDate);

            const subscriptions = await Usersubscription.find({
                status: "active",
                endDate: {
                    $gte: startDate,
                    $lte: endDate
                }
            });

            if (subscriptions.length === 0) {
                console.log("No subscriptions to deactivate for today.");
                return;
            }

            for (const subscription of subscriptions) {
                await Usersubscription.updateOne(
                    { _id: subscription._id, status: "active" },
                    { $set: { status: "deactive" } }
                );
                console.log(`Deactivated subscription ${subscription._id} ending at ${subscription.endDate}`);
            }

        } catch (error) {
            console.error("Error in daily subscription deactivation cron:", error);
        }
    });
};

module.exports = scheduleSubscriptionDeactivation;
