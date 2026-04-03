# Nayba — Supabase Auth Email Templates

Paste these into the Supabase dashboard under **Authentication → Email Templates**.

---

## Template 1 — Confirm Signup

**Subject line:** `Confirm your nayba account`

```html
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; background-color: #F7F7F5; -webkit-font-smoothing: antialiased;">
  <div style="max-width: 480px; margin: 40px auto; padding: 0 16px;">
    <div style="background: #FFFFFF; border-radius: 12px; padding: 40px; text-align: center;">
      <div style="margin-bottom: 24px;">
        <span style="font-family: Georgia, 'Instrument Sans', sans-serif; font-size: 24px; font-weight: 700; color: #C4674A; letter-spacing: -0.5px;">nayba</span>
      </div>
      <p style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 15px; color: rgba(28,28,26,0.6); line-height: 1.7; margin: 0 0 24px;">
        Hi there, tap the button below to confirm your email address and finish setting up your nayba account.
      </p>
      <div style="margin-bottom: 24px;">
        <a href="{{ .ConfirmationURL }}" style="background: #C4674A; color: #FFFFFF; border-radius: 999px; padding: 14px 28px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 14px; font-weight: 600; text-decoration: none; display: inline-block;">
          Confirm my email
        </a>
      </div>
      <div style="border-top: 1px solid #E6E2DB; padding-top: 16px; margin-top: 24px;">
        <p style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 12px; color: rgba(28,28,26,0.35); margin: 0;">
          If you didn't sign up for nayba you can safely ignore this email.
        </p>
      </div>
    </div>
  </div>
</body>
</html>
```

---

## Template 2 — Reset Password

**Subject line:** `Reset your nayba password`

```html
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; background-color: #F7F7F5; -webkit-font-smoothing: antialiased;">
  <div style="max-width: 480px; margin: 40px auto; padding: 0 16px;">
    <div style="background: #FFFFFF; border-radius: 12px; padding: 40px; text-align: center;">
      <div style="margin-bottom: 24px;">
        <span style="font-family: Georgia, 'Instrument Sans', sans-serif; font-size: 24px; font-weight: 700; color: #C4674A; letter-spacing: -0.5px;">nayba</span>
      </div>
      <p style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 15px; color: rgba(28,28,26,0.6); line-height: 1.7; margin: 0 0 24px;">
        Hi there, tap the button below to reset your nayba password. This link expires in 1 hour.
      </p>
      <div style="margin-bottom: 24px;">
        <a href="{{ .ConfirmationURL }}" style="background: #C4674A; color: #FFFFFF; border-radius: 999px; padding: 14px 28px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 14px; font-weight: 600; text-decoration: none; display: inline-block;">
          Reset my password
        </a>
      </div>
      <div style="border-top: 1px solid #E6E2DB; padding-top: 16px; margin-top: 24px;">
        <p style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 12px; color: rgba(28,28,26,0.35); margin: 0;">
          If you didn't request a password reset you can safely ignore this email.
        </p>
      </div>
    </div>
  </div>
</body>
</html>
```

---

## How to apply these templates

1. Go to your Supabase project dashboard
2. Navigate to **Authentication** in the left sidebar
3. Click **Email Templates** tab
4. **Confirm signup template:**
   - Click on **Confirm signup**
   - Set **Subject** to: `Confirm your nayba account`
   - Paste the Template 1 HTML into the **Body** field (replace all existing content)
   - Click **Save**
5. **Reset password template:**
   - Click on **Reset password**
   - Set **Subject** to: `Reset your nayba password`
   - Paste the Template 2 HTML into the **Body** field (replace all existing content)
   - Click **Save**
6. Send a test signup or password reset to verify the templates render correctly
