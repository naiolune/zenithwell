# Supabase Email Template Setup for ZenithWell

This guide covers configuring Supabase's built-in email templates for the ZenithWell platform.

## 📧 Supabase Email Templates

Supabase provides built-in email templates that can be customized for your application. This is much simpler than setting up a custom email service.

## 🚀 Setup Steps

### 1. Access Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to **Authentication** → **Email Templates**
3. You'll see several template types:
   - Confirm signup
   - Reset password
   - Magic link
   - Change email address

### 2. Configure Signup Confirmation Template

1. Click on **"Confirm signup"** template
2. Customize the template with ZenithWell branding:

#### HTML Template:
```html
<h2>Welcome to ZenithWell!</h2>
<p>Hi there,</p>
<p>Thank you for signing up for ZenithWell - your AI-powered mental wellness platform.</p>
<p>Please confirm your account by clicking the link below:</p>
<p><a href="{{ .ConfirmationURL }}">Confirm your account</a></p>
<p>This link will expire in 24 hours.</p>
<p>Once confirmed, you'll have access to:</p>
<ul>
  <li>3 free AI wellness sessions per month</li>
  <li>Progress tracking and insights</li>
  <li>24/7 AI-powered wellness support</li>
  <li>Secure, private conversations</li>
</ul>
<p>Best regards,<br>The ZenithWell Team</p>
<p>---<br>
<strong>ZenithWell</strong> - Where thoughts flow freely, healing begins<br>
Need help? Contact us at support@mindflow.ai
</p>
```

#### Subject Line:
```
Welcome to ZenithWell - Confirm Your Account
```

### 3. Configure Password Reset Template

1. Click on **"Reset password"** template
2. Customize for ZenithWell:

#### HTML Template:
```html
<h2>Reset Your ZenithWell Password</h2>
<p>Hi there,</p>
<p>You requested to reset your password for your ZenithWell account.</p>
<p>Click the link below to reset your password:</p>
<p><a href="{{ .ConfirmationURL }}">Reset password</a></p>
<p>This link will expire in 1 hour.</p>
<p>If you didn't request this password reset, please ignore this email.</p>
<p>Best regards,<br>The ZenithWell Team</p>
```

#### Subject Line:
```
Reset Your ZenithWell Password
```

### 4. Configure Magic Link Template

1. Click on **"Magic link"** template
2. Customize for ZenithWell:

#### HTML Template:
```html
<h2>Your ZenithWell Login Link</h2>
<p>Hi there,</p>
<p>You requested a login link for your ZenithWell account.</p>
<p>Click the link below to sign in:</p>
<p><a href="{{ .ConfirmationURL }}">Sign in to ZenithWell</a></p>
<p>This link will expire in 1 hour.</p>
<p>If you didn't request this login link, please ignore this email.</p>
<p>Best regards,<br>The ZenithWell Team</p>
```

#### Subject Line:
```
Your ZenithWell Login Link
```

## 🎨 Template Customization

### Available Variables

Supabase provides these variables for email templates:

- `{{ .ConfirmationURL }}` - The confirmation/reset link
- `{{ .Token }}` - The confirmation token
- `{{ .SiteURL }}` - Your site URL
- `{{ .Email }}` - User's email address

### Styling Tips

1. **Keep it Simple**: Use basic HTML that works across email clients
2. **Mobile Friendly**: Use responsive design principles
3. **Brand Colors**: Use ZenithWell's blue (#2563eb) and purple (#7c3aed)
4. **Clear CTAs**: Make action buttons prominent
5. **Security Notes**: Always mention link expiration

### Example Styled Template

```html
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="margin: 0; font-size: 28px;">🧠 ZenithWell</h1>
    <p style="margin: 10px 0 0 0; opacity: 0.9;">Where thoughts flow freely, healing begins</p>
  </div>
  
  <div style="background: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
    <h2 style="color: #1f2937; margin-bottom: 20px;">Welcome to ZenithWell!</h2>
    
    <p>Hi there,</p>
    <p>Thank you for signing up for ZenithWell - your AI-powered mental wellness platform.</p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="{{ .ConfirmationURL }}" style="background: #2563eb; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">Confirm Your Account</a>
    </div>
    
    <p style="font-size: 14px; color: #6b7280; background: #f9fafb; padding: 15px; border-radius: 6px; border-left: 4px solid #f59e0b;">
      <strong>🔒 Security Note:</strong> This link will expire in 24 hours for your security.
    </p>
    
    <h3 style="color: #1f2937; margin-top: 30px;">What you'll get:</h3>
    <ul style="color: #4b5563;">
      <li>3 free AI wellness sessions per month</li>
      <li>Progress tracking and insights</li>
      <li>24/7 AI-powered wellness support</li>
      <li>Secure, private conversations</li>
    </ul>
    
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
    
    <p style="color: #6b7280; font-size: 14px;">
      Best regards,<br>
      <strong>The ZenithWell Team</strong>
    </p>
  </div>
</div>
```

## 🔧 Configuration Settings

### Email Settings

1. Go to **Authentication** → **Settings**
2. Configure these settings:

#### Site URL
```
https://yourdomain.com
```

#### Redirect URLs
```
https://yourdomain.com/auth/callback
https://yourdomain.com/dashboard
```

#### Email Settings
- **Enable email confirmations**: ✅ On
- **Enable email change confirmations**: ✅ On
- **Enable password reset**: ✅ On

### SMTP Settings (Optional)

If you want to use your own SMTP server:

1. Go to **Authentication** → **Settings** → **SMTP Settings**
2. Configure your SMTP provider:
   - **Host**: Your SMTP server
   - **Port**: Usually 587 or 465
   - **Username**: Your email username
   - **Password**: Your email password
   - **Sender name**: ZenithWell
   - **Sender email**: noreply@yourdomain.com

## 🧪 Testing

### Test Email Templates

1. **Signup Flow**:
   - Create a test account
   - Check email for confirmation
   - Verify template rendering

2. **Password Reset**:
   - Use "Forgot password" feature
   - Check email for reset link
   - Test reset functionality

3. **Magic Link**:
   - Use magic link login
   - Check email for login link
   - Test login functionality

### Email Client Testing

Test your templates in:
- Gmail
- Outlook
- Apple Mail
- Mobile email clients

## 📊 Monitoring

### Supabase Dashboard

Monitor email delivery in:
- **Authentication** → **Users** - See user confirmation status
- **Logs** - Check for email sending errors
- **Settings** - Monitor email configuration

### Key Metrics

- **Confirmation Rate**: Users who confirm their email
- **Delivery Rate**: Emails successfully sent
- **Bounce Rate**: Emails that bounced back

## 🚨 Troubleshooting

### Common Issues

#### Emails Not Sending
- Check SMTP configuration
- Verify domain settings
- Check Supabase logs
- Ensure proper redirect URLs

#### Templates Not Rendering
- Check HTML syntax
- Test in different email clients
- Verify variable usage
- Check template preview

#### Users Not Receiving Emails
- Check spam folders
- Verify email addresses
- Check SMTP limits
- Monitor bounce rates

## 🎯 Best Practices

1. **Keep Templates Simple**: Use basic HTML that works everywhere
2. **Test Thoroughly**: Test in multiple email clients
3. **Monitor Delivery**: Keep an eye on email metrics
4. **Update Regularly**: Keep templates current with your brand
5. **Security First**: Always mention link expiration

---

**Note**: Supabase handles all the email infrastructure, so you just need to focus on creating great templates!
