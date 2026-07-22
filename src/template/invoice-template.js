const invoiceTemplate = (order) => {

    const start = new Date(order.date);
    const end = new Date(order.dueDate);

    const sameMonth = start.getMonth() === end.getMonth();
    const sameYear = start.getFullYear() === end.getFullYear();

    const billingStart = start.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        ...(sameYear ? {} : { year: 'numeric' }),
    });

    const billingEnd = end.toLocaleDateString('en-US', {
        ...(sameMonth ? {} : { month: 'long' }),
        day: 'numeric',
        year: 'numeric'
    });

    const billingPeriod = `${billingStart} - ${billingEnd}`;

    const totalGstPercentage = (order.gst_percentages?.cgst || 0) +
        (order.gst_percentages?.sgst || 0) +
        (order.gst_percentages?.igst || 0);

    return `
    <!DOCTYPE html>
    <html lang="en">
    
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Invoice - ${order.id}</title>
        <style>
            /* Reset and Base Styles */
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
    
            body {
                font-family: Arial, sans-serif;
                line-height: 1.3;
                color: #333;
                background: #f5f5f5;
                padding: 10px;
                font-size: 12px;
            }
    
            /* Container */
            .invoice-container {
                max-width: 800px;
                margin: 0 auto;
                background: white;
                padding: 20px;
                box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
            }
    
            /* Header */
            .header {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                margin-bottom: 20px;
                padding-bottom: 15px;
                border-bottom: 2px solid #1695b4;
            }
    
            .company-info h1 {
                font-size: 18px;
                color: #1695b4;
                margin-bottom: 8px;
            }
    
            .company-info p {
                margin-bottom: 3px;
                font-size: 11px;
            }
    
            .invoice-info {
                text-align: right;
            }
    
            .invoice-info h2 {
                font-size: 24px;
                color: #1695b4;
                margin-bottom: 10px;
            }
    
            .invoice-details {
                background: #f8f9fa;
                padding: 10px;
                border-radius: 5px;
                margin-bottom: 8px;
                font-size: 11px;
            }
    
            .invoice-details p {
                margin-bottom: 3px;
            }
    
            .status {
                background: #fff3cd;
                color: #856404;
                padding: 3px 8px;
                border-radius: 15px;
                font-size: 10px;
                font-weight: bold;
                display: inline-block;
            }
    
            /* Billing Section */
            .billing-section {
                display: flex;
                gap: 20px;
                margin-bottom: 20px;
            }
    
            .billing-box {
                flex: 1;
                background: #f8f9fa;
                padding: 12px;
                border-radius: 5px;
                font-size: 11px;
            }
    
            .billing-box h3 {
                color: #1695b4;
                margin-bottom: 10px;
                font-size: 12px;
                border-bottom: 1px solid #ddd;
                padding-bottom: 3px;
            }
    
            .billing-box p {
                margin-bottom: 3px;
            }
    
            /* Services Table */
            .services-section {
                margin-bottom: 20px;
            }
    
            .services-section h3 {
                color: #1695b4;
                margin-bottom: 12px;
                font-size: 14px;
            }
    
            .services-table {
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 15px;
                font-size: 11px;
            }
    
            .services-table th {
                background: #1695b4;
                color: white;
                padding: 8px;
                text-align: left;
                font-weight: bold;
                border: 1px solid #1695b4;
                font-size: 11px;
            }
    
            .services-table td {
                padding: 8px;
                border: 1px solid #ddd;
            }
    
            .services-table .amount {
                text-align: left;
                font-weight: bold;
            }
    
            .service-description {
                font-weight: bold;
                margin-bottom: 3px;
            }
    
            /* Totals */
            .totals-section {
                margin-left: auto;
                width: 250px;
                margin-bottom: 20px;
            }
    
            .totals-table {
                width: 100%;
                border-collapse: collapse;
                font-size: 11px;
            }
    
            .totals-table td {
                padding: 6px 8px;
                border: 1px solid #ddd;
            }
    
            .totals-table .label {
                background: #f8f9fa;
                font-weight: bold;
            }
    
            .totals-table .amount {
                text-align: left;
                font-weight: bold;
            }
    
            .total-final {
                background: #1695b4 !important;
                color: white !important;
                font-weight: bold;
            }
    
            /* Footer */
            .footer {
                text-align: center;
                margin-top: 20px;
                padding-top: 10px;
                border-top: 1px solid #ddd;
                color: #666;
                font-size: 10px;
            }
    
            .footer p {
                margin-bottom: 3px;
            }
    
            /* PRINT STYLES */
            @page {
                size: A4;
                margin: 0.5in;
            }
    
            @media print {
                * {
                    -webkit-print-color-adjust: exact !important;
                    color-adjust: exact !important;
                    print-color-adjust: exact !important;
                }
    
                body {
                    background: white !important;
                    padding: 0 !important;
                    margin: 0 !important;
                    font-size: 10px !important;
                }
    
                .invoice-container {
                    box-shadow: none !important;
                    padding: 15px !important;
                    margin: 0 !important;
                    max-width: none !important;
                    width: 100% !important;
                }
    
                .header {
                    margin-bottom: 15px !important;
                }
    
                .company-info h1 {
                    font-size: 16px !important;
                }
    
                .invoice-info h2 {
                    font-size: 20px !important;
                }
    
                .billing-section {
                    margin-bottom: 15px !important;
                }
    
                .services-table th,
                .services-table td {
                    padding: 6px !important;
                }
    
                .totals-table td {
                    padding: 4px 6px !important;
                }
            }
    
            @media (max-width: 768px) {
                .header {
                    flex-direction: column;
                    gap: 15px;
                }
    
                .invoice-info {
                    text-align: left;
                }
    
                .billing-section {
                    flex-direction: column;
                    gap: 15px;
                }
    
                .totals-section {
                    width: 100%;
                }
    
                .invoice-container {
                    padding: 15px;
                }
            }

            /* Payment Section Styles */
            .payment-section {
                margin-bottom: 20px;
            }

            .payment-section h3 {
                color: #1695b4;
                margin-bottom: 12px;
                font-size: 14px;
            }

            .payment-info-box {
                background: #f8f9fa;
                padding: 12px;
                border-radius: 5px;
                font-size: 11px;
            }

            .payment-info-box p {
                margin-bottom: 5px;
            }

            /* For print media */
            @media print {
                .payment-info-box {
                    background: #f8f9fa !important;
                    -webkit-print-color-adjust: exact;
                    print-color-adjust: exact;
                }
            }

            .payment-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 15px;
            font-size: 14px;
            }

            .payment-table th, 
            .payment-table td {
            padding: 8px 12px;
            text-align: left;
            border: 1px solid #e5e7eb; /* gray-200 */
            }

            .dark .payment-table th,
            .dark .payment-table td {
            border-color: #374151; /* gray-700 */
            }

            .payment-table th {
            background-color: #f3f4f6; /* gray-100 */
            font-weight: 600;
            }

            .dark .payment-table th {
            background-color: #1f2937; /* gray-800 */
            }

            /* Totals Table Styles */
            .totals-table {
                width: 100%;
                border-collapse: collapse;
                margin-top: 10px;
            }

            .totals-table td {
                padding: 8px;
                border: 1px solid #e2e8f0;
            }

            .totals-table .label {
                background-color: #f8fafc;
                font-weight: 600;
            }

            .balance-zero {
                background-color: #f0fdf4; /* Light green background */
                color: #166534; /* Dark green text */
                font-weight: bold;
            }

            /* Dark mode support */
            .dark .totals-table td {
                border-color: #334155;
            }

            .dark .totals-table .label {
                background-color: #1e293b;
            }

            .dark .balance-zero {
                background-color: #052e16;
                color: #bbf7d0;
            }
        </style>
    </head>
    
    <body>
        <div class="invoice-container">
            <!-- Header -->
            <div class="header">
                <div class="company-info">
                    <div class="logo-container" style="margin-bottom: 10px;">
                        <img src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRkdRRxMNkG5hyvH3vdJWR99RplqIhJG8j2ZERwqjaz&s"
                            alt="Technians softech Logo" style="max-width: 150px; height: auto; max-height: 60px;">
                    </div>
                    <h1>Technians softech</h1>
                    <p><strong>A Premier Digital Marketing & Technology Agency</strong></p>
                    <p>1101, 11th Floor, Welldone Techpark,Sohna road</p>
                    <p>Sector 48, Gurgaon, Haryana, 122018</p>
                    <p>Phone: (555) 123-4567</p>
                    <p>Email: technians@softech.com</p>
                    <p>Website: www.technians.com</p>
                </div>
    
                <div class="invoice-info">
                    <h2>INVOICE</h2>
                    <div class="invoice-details">
                        <p><strong>Invoice #:</strong> <span style="font-family: monospace; font-weight: bold; color: #1695b4;">${order.id || 'N/A'}</span></p>
                        <p><strong>Invoice Date:</strong> ${new Date().toLocaleDateString('en-US')}</p>
                    </div>
                    <span class="status">${order.status || 'Pending Payment'}</span>
                </div>
            </div>
    
            <!-- Billing Information -->
            <div class="billing-section">
                <div class="billing-box">
                    <h3>Bill To:</h3>
                    <p><strong>${order.customerName || 'N/A'}</strong></p>
                    <p style="white-space: pre-line;">${order.address || 'N/A'}</p>
                    <p><strong>Email:</strong> ${order.email || 'N/A'}</p>
                </div>
                <div class="billing-box">
                    <h3>Service Period:</h3>
                    <p><strong>Billing Period:</strong> ${billingPeriod || 'N/A'}</p>
                    <p><strong>Service Plan:</strong> ${order.plan || 'N/A'}</p>
                    <p><strong>Contract:</strong> ${order.contract || 'N/A'} Contract </p>
                    <p><strong>Number of Campaign:</strong> ${order.no_of_campaign || 'N/A'}</p>
                    <p><strong>Number of Visitors:</strong> ${order.no_of_visitors || 'N/A'}</p>
                    <p><strong>Email Limit:</strong> ${order.email_limit || 'N/A'}</p>
                    <p><strong>SMS Limit:</strong> ${order.SMS_limit || 'N/A'}</p>
                </div>
            </div>
    
            <!-- Services Table -->
            <div class="services-section">
                <h3>Services & Charges</h3>
                <table class="services-table">
                    <thead>
                        <tr>
                            <th style="width: 50%;">Description</th>
                            <th style="width: 15%;">Qty</th>
                            <th style="width: 15%;">Rate</th>
                            <th style="width: 20%;">Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${order.items.map(item => `
                        <tr>
                            <td>
                                <div class="service-description">${item.name || 'N/A'}</div>
                            </td>
                            <td>${item.quantity || 'N/A'}</td>
                            <td>₹${item.price.toFixed(2) || 'N/A'}</td>
                            <td class="amount">₹${(item.quantity * item.price).toFixed(2) || 'N/A'}</td>
                        </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>

            <!-- Payment Information -->
            <div class="payment-section">
            <h3 class="mb-3">Payment Information</h3>
            <table class="payment-table w-full">
                <thead>
                <tr class="bg-gray-100 dark:bg-gray-800">
                    <th class="text-left py-2 px-4 font-medium">Details</th>
                    <th class="text-left py-2 px-4 font-medium">Value</th>
                </tr>
                </thead>
                <tbody>
                <tr class="border-b border-gray-200 dark:border-gray-700">
                    <td class="py-2 px-4 font-medium">Payment Method</td>
                    <td class="py-2 px-4">${order.paymentMethod || 'N/A'}</td>
                </tr>
                <tr class="border-b border-gray-200 dark:border-gray-700">
                    <td class="py-2 px-4 font-medium">Transaction ID</td>
                    <td class="py-2 px-4">${order.transactionId || 'N/A'}</td>
                </tr>
                <tr class="border-b border-gray-200 dark:border-gray-700">
                    <td class="py-2 px-4 font-medium">Payment Date</td>
                    <td class="py-2 px-4">${order.date || 'N/A'}</td>
                </tr>
                <tr>
                    <td class="py-2 px-4 font-medium">Amount Paid</td>
                    <td class="py-2 px-4 font-semibold text-green-600 dark:text-green-400">
                    ₹${order.total.toFixed(2) || 'N/A'}
                    </td>
                </tr>
                </tbody>
            </table>
            </div>
            
            <div style="display: flex; justify-content: space-between; margin-bottom: 20px; gap: 20px;">
            <!-- Left Side - GST/Tax Breakdown (only shown when there's tax) -->
            ${(order.isSameCountry || (order.gst_percentages?.international_gst > 0)) ? `
                <div style="flex: 1; max-width: 250px;">
                    ${order.isSameCountry ? `
                        <h3 style="color: #1695b4; margin-bottom: 12px; font-size: 14px;">GST Breakdown</h3>
                        <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
                            <thead>
                                <tr>
                                    <th style="background: #1695b4; color: white; padding: 4px; text-align: left;">Tax Type</th>
                                    <th style="background: #1695b4; color: white; padding: 4px; text-align: left;">%</th>
                                    <th style="background: #1695b4; color: white; padding: 4px; text-align: left;">Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${order.isSameState ? `
                                    ${order.gst_breakdown.cgst > 0 ? `
                                    <tr>
                                        <td style="padding: 4px; border: 1px solid #ddd;">CGST</td>
                                        <td style="padding: 4px; border: 1px solid #ddd;">${order.gst_percentages.cgst.toFixed(2)}%</td>
                                        <td style="padding: 4px; border: 1px solid #ddd;">₹${order.gst_breakdown.cgst.toFixed(2)}</td>
                                    </tr>
                                    ` : ''}
                                    ${order.gst_breakdown.sgst > 0 ? `
                                    <tr>
                                        <td style="padding: 4px; border: 1px solid #ddd;">SGST</td>
                                        <td style="padding: 4px; border: 1px solid #ddd;">${order.gst_percentages.sgst.toFixed(2)}%</td>
                                        <td style="padding: 4px; border: 1px solid #ddd;">₹${order.gst_breakdown.sgst.toFixed(2)}</td>
                                    </tr>
                                    ` : ''}
                                ` : `
                                    ${order.gst_breakdown.igst > 0 ? `
                                    <tr>
                                        <td style="padding: 4px; border: 1px solid #ddd;">IGST</td>
                                        <td style="padding: 4px; border: 1px solid #ddd;">${order.gst_percentages.igst.toFixed(2)}%</td>
                                        <td style="padding: 4px; border: 1px solid #ddd;">₹${order.gst_breakdown.igst.toFixed(2)}</td>
                                    </tr>
                                    ` : ''}
                                `}
                                <tr>
                                    <td style="padding: 4px; border: 1px solid #ddd; font-weight: bold;">Total GST</td>
                                    <td style="padding: 4px; border: 1px solid #ddd; font-weight: bold;">${totalGstPercentage.toFixed(2)}%</td>
                                    <td style="padding: 4px; border: 1px solid #ddd; font-weight: bold;">₹${order.tax.toFixed(2)}</td>
                                </tr>
                            </tbody>
                        </table>
                    ` : `
                        <h3 style="color: #1695b4; margin-bottom: 12px; font-size: 14px;">Tax Breakdown</h3>
                        <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
                            <thead>
                                <tr>
                                    <th style="background: #1695b4; color: white; padding: 4px; text-align: left;">Tax Type</th>
                                    <th style="background: #1695b4; color: white; padding: 4px; text-align: left;">%</th>
                                    <th style="background: #1695b4; color: white; padding: 4px; text-align: left;">Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td style="padding: 4px; border: 1px solid #ddd;">International Tax</td>
                                    <td style="padding: 4px; border: 1px solid #ddd;">${order.gst_percentages.international_gst.toFixed(2)}%</td>
                                    <td style="padding: 4px; border: 1px solid #ddd;">₹${order.tax.toFixed(2)}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 4px; border: 1px solid #ddd; font-weight: bold;">Total Tax</td>
                                    <td style="padding: 4px; border: 1px solid #ddd; font-weight: bold;">${order.gst_percentages.international_gst.toFixed(2)}%</td>
                                    <td style="padding: 4px; border: 1px solid #ddd; font-weight: bold;">₹${order.tax.toFixed(2)}</td>
                                </tr>
                            </tbody>
                        </table>
                    `}
                </div>
            ` : ''}

            <!-- Right Side - Totals Section (Always shown) -->
            <div style="flex: 1; max-width: 250px;">
                <h3 style="color: #1695b4; margin-bottom: 12px; font-size: 14px;">Invoice Summary</h3>
                <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
                    <tr>
                        <td style="padding: 4px; border: 1px solid #ddd; background: #f8f9fa; font-weight: bold;">Subtotal:</td>
                        <td style="padding: 4px; border: 1px solid #ddd; font-weight: bold; text-align: left;">₹${order.subtotal.toFixed(2)}</td>
                    </tr>
                    ${order.isSameCountry ? `
                        <tr>
                            <td style="padding: 4px; border: 1px solid #ddd; background: #f8f9fa; font-weight: bold;">GST (${totalGstPercentage}%):</td>
                            <td style="padding: 4px; border: 1px solid #ddd; font-weight: bold; text-align: left;">₹${order.tax.toFixed(2)}</td>
                        </tr>
                    ` : order.gst_percentages?.international_gst > 0 ? `
                        <tr>
                            <td style="padding: 4px; border: 1px solid #ddd; background: #f8f9fa; font-weight: bold;">International Tax (${order.gst_percentages.international_gst.toFixed(2)}%):</td>
                            <td style="padding: 4px; border: 1px solid #ddd; font-weight: bold; text-align: left;">₹${order.tax.toFixed(2)}</td>
                        </tr>
                    ` : ''}
                    <tr>
                        <td style="padding: 4px; border: 1px solid #ddd; background: #f8f9fa; font-weight: bold;">Total Amount:</td>
                        <td style="padding: 4px; border: 1px solid #ddd; font-weight: bold; text-align: left;">₹${order.total.toFixed(2)}</td>
                    </tr>
                    <tr style="background: #1695b4; color: white;">
                        <td style="padding: 4px; border: 1px solid #1695b4; font-weight: bold;">Amount Paid:</td>
                        <td style="padding: 4px; border: 1px solid #1695b4; font-weight: bold; text-align: left;">₹${order.total.toFixed(2)}</td>
                    </tr>
                    <tr style="background: #f0fdf4; color: #166534;">
                        <td style="padding: 4px; border: 1px solid #e2e8f0; font-weight: bold;">Balance Due:</td>
                        <td style="padding: 4px; border: 1px solid #e2e8f0; font-weight: bold; text-align: left;">₹0.00</td>
                    </tr>
                </table>
            </div>
        </div>
    
            <!-- Footer -->
            <div class="footer">
                <p>Thank you for your business!</p>
                <p>Technians softech | www.technians.com | technians@softech.com | (555) 123-4567</p>
                <p>This is an electronically generated invoice, no signature required.</p>
            </div>
        </div>
    </body>
    
    </html>`;
};

module.exports = { invoiceTemplate };