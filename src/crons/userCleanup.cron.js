const cron = require("node-cron");
const User = require("../models/user.model");

const scheduleUserCleanup = () => {
    cron.schedule("0 0 * * *", async () => {
        try {
            const result = await User.deleteMany({
                isDeleted: true,
                autoDeletedAt: { $lte: new Date() }
            });
            console.log(`${result.deletedCount} users permanently deleted.`);
        } catch (error) {
            console.error("Error during user cleanup cron job:", error);
        }
    });

};

module.exports = scheduleUserCleanup;
