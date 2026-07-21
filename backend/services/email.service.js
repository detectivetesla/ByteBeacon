/**
 * Email Service
 * Handles sending emails for password resets and notifications
 */

const nodemailer = require('nodemailer');

// Create transporter with SMTP settings
const createTransporter = () => {
    const smtpPort = parseInt(process.env.SMTP_PORT || process.env.VITE_SMTP_PORT || process.env.SMPT_PORT) || 587;
    // Port 465 is always secure (SSL), other ports (587, 25) usually use STARTTLS
    const isSecure = smtpPort === 465;

    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || process.env.VITE_SMTP_HOST || process.env.SMPT_HOST || 'smtp.gmail.com',
        port: smtpPort,
        secure: isSecure,
        auth: {
            user: process.env.SMTP_USER || process.env.VITE_SMTP_USER || process.env.SMPT_USER,
            pass: process.env.SMTP_PASS || process.env.VITE_SMTP_PASS || process.env.SMPT_PASS,
        },
        tls: {
            // Do not fail on invalid certificates
            rejectUnauthorized: false
        },
        connectionTimeout: 15000,
        greetingTimeout: 15000,
        socketTimeout: 30000
    });

    return transporter;
};

/**
 * Send password reset email
 * @param {string} to - Recipient email
 * @param {string} resetToken - The password reset token
 * @param {string} userName - User's name for personalization
 */
const sendPasswordResetEmail = async (to, resetToken, userName = 'User') => {
    const transporter = createTransporter();

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const resetLink = `${frontendUrl}/reset-password/${resetToken}`;

    const mailOptions = {
        from: `"ByteBeacon" <${process.env.SMTP_USER}>`,
        to,
        subject: 'Password Reset Request - ByteBeacon',
        html: `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Password Reset</title>
            </head>
            <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f7;">
                <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
                    <div style="background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); overflow: hidden;">
                        <!-- Header -->
                        <div style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 40px 30px; text-align: center;">
                            <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">ByteBeacon</h1>
                            <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0; font-size: 14px;">Password Reset Request</p>
                        </div>
                        
                        <!-- Content -->
                        <div style="padding: 40px 30px;">
                            <p style="color: #1f2937; font-size: 16px; margin: 0 0 20px;">Hello ${userName},</p>
                            
                            <p style="color: #4b5563; font-size: 14px; line-height: 1.6; margin: 0 0 24px;">
                                We received a request to reset your password. Click the button below to create a new password:
                            </p>
                            
                            <div style="text-align: center; margin: 32px 0;">
                                <a href="${resetLink}" 
                                   style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: #ffffff; text-decoration: none; padding: 14px 40px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                                    Reset Password
                                </a>
                            </div>
                            
                            <p style="color: #6b7280; font-size: 13px; line-height: 1.6; margin: 24px 0 0;">
                                This link will expire in <strong>1 hour</strong>. If you didn't request a password reset, you can safely ignore this email.
                            </p>
                            
                            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;">
                            
                            <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                                If the button doesn't work, copy and paste this link into your browser:
                            </p>
                            <p style="color: #6366f1; font-size: 12px; word-break: break-all; margin: 8px 0 0;">
                                ${resetLink}
                            </p>
                        </div>
                        
                        <!-- Footer -->
                        <div style="background-color: #f9fafb; padding: 24px 30px; text-align: center;">
                            <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                                © ${new Date().getFullYear()} ByteBeacon. All rights reserved.
                            </p>
                        </div>
                    </div>
                </div>
            </body>
            </html>
        `,
        text: `
Hello ${userName},

We received a request to reset your password for your ByteBeacon account.

Click this link to reset your password: ${resetLink}

This link will expire in 1 hour.

If you didn't request a password reset, you can safely ignore this email.

- The ByteBeacon Team
        `
    };

    try {
        console.log(`Attempting to send reset email to: ${to} using ${process.env.SMTP_USER}`);
        const info = await transporter.sendMail(mailOptions);
        console.log('Password reset email sent successfully:', info.messageId);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('FATAL ERROR sending password reset email:', error);
        throw error;
    }
};

/**
 * Send agent application email to admin
 * @param {Object} applicationData - Application details
 */
const sendAgentApplicationEmail = async (applicationData) => {
    const transporter = createTransporter();
    const adminEmail = 'nomotsumartin@gmail.com';

    const { userName, userEmail, userPhone, businessName, reason, experience, feePaid, applicationId } = applicationData;

    const mailOptions = {
        from: `"ByteBeacon" <${process.env.SMTP_USER}>`,
        to: adminEmail,
        subject: `🆕 New Agent Application - ${userName}`,
        html: `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>New Agent Application</title>
            </head>
            <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f7;">
                <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
                    <div style="background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); overflow: hidden;">
                        <!-- Header -->
                        <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 40px 30px; text-align: center;">
                            <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">ByteBeacon</h1>
                            <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0; font-size: 14px;">New Agent Application Received</p>
                        </div>
                        
                        <!-- Content -->
                        <div style="padding: 40px 30px;">
                            <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 15px 20px; border-radius: 8px; margin-bottom: 24px;">
                                <p style="margin: 0; font-size: 16px; font-weight: 600;">💰 Application Fee Paid: GHS ${feePaid.toFixed(2)}</p>
                            </div>

                            <h2 style="color: #1f2937; font-size: 18px; margin: 0 0 16px; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px;">Applicant Information</h2>
                            
                            <table style="width: 100%; border-collapse: collapse;">
                                <tr>
                                    <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 14px; width: 40%;">Full Name:</td>
                                    <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; color: #1f2937; font-size: 14px; font-weight: 600;">${userName}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">Email:</td>
                                    <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; color: #1f2937; font-size: 14px;">${userEmail}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">Phone:</td>
                                    <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; color: #1f2937; font-size: 14px; font-weight: 600;">${userPhone}</td>
                                </tr>
                                ${businessName ? `
                                <tr>
                                    <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">Business Name:</td>
                                    <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; color: #1f2937; font-size: 14px;">${businessName}</td>
                                </tr>
                                ` : ''}
                            </table>

                            <h2 style="color: #1f2937; font-size: 18px; margin: 32px 0 16px; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px;">Application Details</h2>
                            
                            <div style="background-color: #f9fafb; padding: 16px; border-radius: 8px; margin-bottom: 16px;">
                                <p style="color: #6b7280; font-size: 12px; margin: 0 0 4px; text-transform: uppercase;">Reason for Applying</p>
                                <p style="color: #1f2937; font-size: 14px; margin: 0; line-height: 1.6;">${reason || 'Not provided'}</p>
                            </div>

                            ${experience ? `
                            <div style="background-color: #f9fafb; padding: 16px; border-radius: 8px;">
                                <p style="color: #6b7280; font-size: 12px; margin: 0 0 4px; text-transform: uppercase;">Previous Experience</p>
                                <p style="color: #1f2937; font-size: 14px; margin: 0; line-height: 1.6;">${experience}</p>
                            </div>
                            ` : ''}
                            
                            <div style="text-align: center; margin: 32px 0;">
                                <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/admin/agents" 
                                   style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; text-decoration: none; padding: 14px 40px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                                    Review Application
                                </a>
                            </div>
                            
                            <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 24px 0 0;">
                                Application ID: ${applicationId}
                            </p>
                        </div>
                        
                        <!-- Footer -->
                        <div style="background-color: #f9fafb; padding: 24px 30px; text-align: center;">
                            <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                                © ${new Date().getFullYear()} ByteBeacon. All rights reserved.
                            </p>
                        </div>
                    </div>
                </div>
            </body>
            </html>
        `,
        text: `
New Agent Application - ByteBeacon

Application Fee Paid: GHS ${feePaid.toFixed(2)}

APPLICANT INFORMATION
=====================
Full Name: ${userName}
Email: ${userEmail}
Phone: ${userPhone}
${businessName ? `Business Name: ${businessName}` : ''}

APPLICATION DETAILS
===================
Reason for Applying:
${reason || 'Not provided'}

${experience ? `Previous Experience:\n${experience}` : ''}

Application ID: ${applicationId}

Review this application at: ${process.env.FRONTEND_URL || 'http://localhost:5173'}/admin/agents

- ByteBeacon System
        `
    };

    try {
        console.log(`Sending agent application email to admin: ${adminEmail}`);
        const info = await transporter.sendMail(mailOptions);
        console.log('Agent application email sent successfully:', info.messageId);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('Error sending agent application email:', error);
        // Don't throw - email failure shouldn't block the application
        return { success: false, error: error.message };
    }
};

module.exports = {
    sendPasswordResetEmail,
    sendAgentApplicationEmail
};
