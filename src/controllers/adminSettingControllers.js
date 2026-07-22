const AdminSetting = require('../models/admin.setting.model');

exports.usdToInr = async (req, res, next) => {
    try {
        const { InrValue, logoutTime } = req.body;
        if (!InrValue || typeof InrValue !== 'number') {
            return res.status(400).json({ message: 'InrValue is required and must be a number.' });
        }

        const existingSetting = await AdminSetting.findOne({});

        if (existingSetting) {
            const noInrChange = existingSetting.InrValue === InrValue;
            const noLogoutChange = typeof logoutTime !== 'number' || existingSetting.logoutTime === logoutTime;

            if (noInrChange && noLogoutChange) {
                return res.status(200).json({
                    message: 'No update needed. Values are already up to date.',
                    data: existingSetting
                });
            }

            // Update only changed fields
            existingSetting.InrValue = InrValue;

            if (typeof logoutTime === 'number' && logoutTime >= 1) {
                existingSetting.logoutTime = logoutTime;
            }

            await existingSetting.save();

            return res.status(200).json({
                message: 'Admin setting updated successfully.',
                data: existingSetting
            });
        } else {
            // Create new document
            const payload = { InrValue };

            if (typeof logoutTime === 'number' && logoutTime >= 1) {
                payload.logoutTime = logoutTime;
            }

            const newSetting = await AdminSetting.create(payload);

            return res.status(201).json({
                message: 'Admin setting created successfully.',
                data: newSetting
            });
        }

    } catch (error) {
        next(error);
    }
};


exports.updateGstSettings = async (req, res, next) => {
    try {
        const { intra_state_tax, inter_state_tax, International_tax } = req.body;

        // Validate input
        if (!intra_state_tax || !inter_state_tax || !International_tax) {
            return res.status(400).json({ message: 'Both intra state tax and inter state tax settings are required' });
        }

        // Find and update settings
        let settings = await AdminSetting.findOne({});

        if (!settings) {
            // If no settings exist, create new one
            settings = new AdminSetting({
                gstSettings: { intra_state_tax, inter_state_tax, International_tax }
            });
        } else {
            // Update existing settings
            settings.gstSettings = { intra_state_tax, inter_state_tax, International_tax };
        }

        await settings.save();


        return res.status(200).json({
            message: 'GST settings updated successfully',
            data: settings.gstSettings
        });
    } catch (error) {
        next(error);
    }
};

// Invoice Series Management Functions
exports.getInvoiceSeries = async (req, res, next) => {
    try {
        let settings = await AdminSetting.findOne({});
        
        if (!settings) {
            // Create default settings if none exist
            const currentDate = new Date();
            const year = currentDate.getFullYear().toString().slice(-2);
            const month = (currentDate.getMonth() + 1).toString().padStart(2, '0');
            
            settings = new AdminSetting({
                InrValue: 83, // Default INR value
                invoiceSeries: {
                    prefix: 'MJ',
                    currentNumber: 1,
                    currentYear: year,
                    currentMonth: month,
                    isFrozen: false
                }
            });
            await settings.save();
        }

        // Generate current invoice series string
        const currentInvoiceSeries = `${settings.invoiceSeries.prefix}${settings.invoiceSeries.currentYear}${settings.invoiceSeries.currentMonth}${settings.invoiceSeries.currentNumber.toString().padStart(4, '0')}`;

        return res.status(200).json({
            success: true,
            data: {
                invoiceSeries: currentInvoiceSeries,
                currentRunningInvoice: currentInvoiceSeries,
                prefix: settings.invoiceSeries.prefix,
                currentNumber: settings.invoiceSeries.currentNumber,
                currentYear: settings.invoiceSeries.currentYear,
                currentMonth: settings.invoiceSeries.currentMonth,
                isFrozen: settings.invoiceSeries.isFrozen
            }
        });
    } catch (error) {
        next(error);
    }
};

exports.updateInvoiceSeries = async (req, res, next) => {
    try {
        const { invoiceSeries } = req.body;

        if (!invoiceSeries) {
            return res.status(400).json({ message: 'Invoice series is required' });
        }

        // Parse the invoice series format (e.g., MJ25070001)
        const match = invoiceSeries.match(/^([A-Z]{2})(\d{2})(\d{2})(\d{4})$/);
        if (!match) {
            return res.status(400).json({ message: 'Invalid invoice series format. Expected format: MJYYMM####' });
        }

        const [, prefix, year, month, number] = match;
        const currentNumber = parseInt(number);

        let settings = await AdminSetting.findOne({});
        
        if (!settings) {
            settings = new AdminSetting({
                InrValue: 83,
                invoiceSeries: {
                    prefix,
                    currentNumber,
                    currentYear: year,
                    currentMonth: month,
                    isFrozen: false
                }
            });
        } else {
            settings.invoiceSeries = {
                prefix,
                currentNumber,
                currentYear: year,
                currentMonth: month,
                isFrozen: false
            };
        }

        await settings.save();

        return res.status(200).json({
            success: true,
            message: 'Invoice series updated successfully',
            data: {
                invoiceSeries: `${prefix}${year}${month}${currentNumber.toString().padStart(4, '0')}`,
                currentRunningInvoice: `${prefix}${year}${month}${currentNumber.toString().padStart(4, '0')}`
            }
        });
    } catch (error) {
        next(error);
    }
};

exports.freezeInvoiceSeries = async (req, res, next) => {
    try {
        let settings = await AdminSetting.findOne({});
        
        if (!settings) {
            return res.status(404).json({ message: 'Admin settings not found' });
        }

        settings.invoiceSeries.isFrozen = true;
        await settings.save();

        return res.status(200).json({
            success: true,
            message: 'Invoice series frozen successfully'
        });
    } catch (error) {
        next(error);
    }
};

exports.restartInvoiceSeries = async (req, res, next) => {
    try {
        let settings = await AdminSetting.findOne({});
        
        if (!settings) {
            return res.status(404).json({ message: 'Admin settings not found' });
        }

        // Reset to 1 and update year/month if needed
        const currentDate = new Date();
        const year = currentDate.getFullYear().toString().slice(-2);
        const month = (currentDate.getMonth() + 1).toString().padStart(2, '0');

        settings.invoiceSeries.currentNumber = 1;
        settings.invoiceSeries.currentYear = year;
        settings.invoiceSeries.currentMonth = month;
        settings.invoiceSeries.isFrozen = false;
        settings.invoiceSeries.lastResetDate = new Date();
        
        await settings.save();

        const currentInvoiceSeries = `${settings.invoiceSeries.prefix}${year}${month}0001`;

        return res.status(200).json({
            success: true,
            message: 'Invoice series restarted successfully',
            data: {
                invoiceSeries: currentInvoiceSeries,
                currentRunningInvoice: currentInvoiceSeries
            }
        });
    } catch (error) {
        next(error);
    }
};

// Function to generate next invoice number
exports.generateNextInvoiceNumber = async () => {
    try {
        let settings = await AdminSetting.findOne({});
        
        if (!settings) {
            // Create default settings
            const currentDate = new Date();
            const year = currentDate.getFullYear().toString().slice(-2);
            const month = (currentDate.getMonth() + 1).toString().padStart(2, '0');
            
            settings = new AdminSetting({
                InrValue: 83,
                invoiceSeries: {
                    prefix: 'MJ',
                    currentNumber: 1,
                    currentYear: year,
                    currentMonth: month,
                    isFrozen: false
                }
            });
        }

        // Check if series is frozen
        if (settings.invoiceSeries.isFrozen) {
            throw new Error('Invoice series is frozen. Cannot generate new invoice number.');
        }

        const currentDate = new Date();
        const currentYear = currentDate.getFullYear().toString().slice(-2);
        const currentMonth = (currentDate.getMonth() + 1).toString().padStart(2, '0');

        // Reset number if year or month has changed
        if (settings.invoiceSeries.currentYear !== currentYear || settings.invoiceSeries.currentMonth !== currentMonth) {
            settings.invoiceSeries.currentNumber = 1;
            settings.invoiceSeries.currentYear = currentYear;
            settings.invoiceSeries.currentMonth = currentMonth;
        } else {
            // Increment the current number
            settings.invoiceSeries.currentNumber += 1;
        }

        await settings.save();

        // Generate the invoice number
        const invoiceNumber = `${settings.invoiceSeries.prefix}${settings.invoiceSeries.currentYear}${settings.invoiceSeries.currentMonth}${settings.invoiceSeries.currentNumber.toString().padStart(4, '0')}`;
        
        return invoiceNumber;
    } catch (error) {
        throw error;
    }
};
