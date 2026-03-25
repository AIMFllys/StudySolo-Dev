"""Email service using Aliyun DirectMail SMTP.

Sends verification code emails via SMTP SSL (port 465).
Shared SMTP account: accounts@email.1037solo.com
"""

import logging
import random
import smtplib
import string
from datetime import datetime, timedelta, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.core.config import get_settings

logger = logging.getLogger(__name__)
_MAX_VERIFICATION_ATTEMPTS = 5


def _generate_code(length: int = 6) -> str:
    """Generate a random numeric verification code."""
    return "".join(random.choices(string.digits, k=length))


def _build_verification_email_html(code: str) -> str:
    """Build a branded HTML email template for verification codes."""
    return f"""\
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background-color:#020617;font-family:'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol';-webkit-font-smoothing:antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#020617;padding:60px 20px;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background-color:#0F172A;border-radius:24px;border:1px solid rgba(255,255,255,0.08);overflow:hidden;box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);">
        <!-- Header -->
        <tr><td style="padding:48px 40px 0;text-align:center;">
          <img src="https://husteread.com/wp-content/uploads/2026/01/1037-SOLO-%E5%8F%B3%E4%BE%A71.png" alt="1037Solo Logo" style="height:48px;width:auto;display:block;margin:0 auto 16px;">
          <div style="font-size:14px;font-weight:500;color:#94A3B8;letter-spacing:1px;text-transform:uppercase;">StudySolo 账号安全中心</div>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:40px;">
          <h2 style="color:#F8FAFC;font-size:20px;font-weight:600;margin:0 0 16px;">您好，</h2>
          <p style="color:#CBD5E1;font-size:15px;margin:0 0 32px;line-height:1.7;">
            感谢访问 <strong>StudySolo</strong> — 由 1037Solo 团队为您打造的新一代个人数字工作平台。我们收到了一项关于您账号的验证请求。您的专属验证码为：
          </p>
          <div style="text-align:center;margin:32px 0;">
            <div style="display:inline-block;padding:20px 48px;background:linear-gradient(135deg, rgba(99,102,241,0.1) 0%, rgba(79,70,229,0.1) 100%);border:1px solid rgba(99,102,241,0.4);border-radius:16px;letter-spacing:12px;font-size:36px;font-weight:700;color:#818CF8;box-shadow: 0 4px 20px rgba(99,102,241,0.15);">
              {code}
            </div>
          </div>
          <p style="color:#94A3B8;font-size:14px;margin:32px 0 0;line-height:1.6;padding:16px;background-color:rgba(15,23,42,0.5);border-radius:12px;border:1px solid rgba(255,255,255,0.04);">
            <span style="display:inline-block;margin-bottom:8px;">⏱️ 验证码 <strong style="color:#E2E8F0;">5 分钟</strong>内有效，请留意使用时间。</span><br>
            🔒 请勿将此验证码泄露给其他任何人。
          </p>
        </td></tr>
        <!-- Divider -->
        <tr><td style="padding:0;text-align:center;">
          <div style="width:80%;height:1px;background:linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent);margin:0 auto;"></div>
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:32px 40px;text-align:center;background-color:#0B1120;">
          <p style="color:#64748B;font-size:12px;margin:0 0 12px;line-height:1.6;">
            如果您并未发出此操作请求（重置密码或注册），请忽略本邮件，您的账号安全不会受到影响。
          </p>
          <div style="margin-top:24px;">
            <a href="https://1037solo.com" style="color:#818CF8;font-size:13px;text-decoration:none;font-weight:500;margin:0 12px;">1037solo.com</a>
            <span style="color:#334155;">|</span>
            <a href="https://docs.1037solo.com" style="color:#818CF8;font-size:13px;text-decoration:none;font-weight:500;margin:0 12px;">帮助文档</a>
            <span style="color:#334155;">|</span>
            <a href="mailto:support@1037solo.com" style="color:#818CF8;font-size:13px;text-decoration:none;font-weight:500;margin:0 12px;">联系支持</a>
          </div>
          <p style="color:#334155;font-size:11px;margin:24px 0 0;">
            © {datetime.now().year} 1037Solo Team. All rights reserved.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""


class EmailService:
    """Send emails via Aliyun DirectMail SMTP."""

    def __init__(self) -> None:
        s = get_settings()
        self.smtp_host = s.smtp_host
        self.smtp_port = s.smtp_port
        self.smtp_user = s.smtp_user
        self.smtp_pass = s.smtp_pass

    def _send(self, to: str, subject: str, html_body: str) -> None:
        """Send an email via SMTP with STARTTLS.

        Uses port 80 with explicit TLS (STARTTLS) instead of implicit SSL
        on port 465, which is incompatible with Python 3.14 / OpenSSL 3.x.
        """
        msg = MIMEMultipart("alternative")
        msg["From"] = f"1037Solo <{self.smtp_user}>"
        msg["To"] = to
        msg["Subject"] = subject
        msg.attach(MIMEText(html_body, "html", "utf-8"))

        try:
            with smtplib.SMTP(self.smtp_host, self.smtp_port, timeout=10) as server:
                server.ehlo()
                server.starttls()
                server.ehlo()
                server.login(self.smtp_user, self.smtp_pass)
                server.sendmail(self.smtp_user, [to], msg.as_string())
            logger.info("Email sent to %s", to)
        except Exception:
            logger.exception("Failed to send email to %s", to)
            raise

    def send_verification_code(self, to: str, code: str) -> None:
        """Send a verification code email."""
        subject = "【StudySolo】重置密码/注册"
        html = _build_verification_email_html(code)
        self._send(to, subject, html)


# ---------------------------------------------------------------------------
# Helper: generate code + store in DB + send email
# ---------------------------------------------------------------------------

async def send_verification_code_to_email(
    email: str,
    code_type: str,
    db_client,
) -> str:
    """Generate a 6-digit code, store it, and send via email.

    Returns the generated code (useful for testing).
    """
    code = _generate_code()
    expires_at = (datetime.now(timezone.utc) + timedelta(minutes=5)).isoformat()

    # Mark previous unused codes for this email+type as used
    await db_client.from_("verification_codes_v2").update(
        {"is_used": True}
    ).eq("email", email).eq("type", code_type).eq("is_used", False).execute()

    # Insert new code
    await db_client.from_("verification_codes_v2").insert({
        "email": email,
        "code": code,
        "type": code_type,
        "is_used": False,
        "attempt_count": 0,
        "expires_at": expires_at,
    }).execute()

    # Send email
    service = EmailService()
    service.send_verification_code(email, code)

    return code


async def verify_code(
    email: str,
    code: str,
    code_type: str,
    db_client,
) -> bool:
    """Verify a code against the database.

    Returns True if valid, False otherwise.
    Marks the code as used on success.
    """
    now = datetime.now(timezone.utc).isoformat()

    result = (
        await db_client.from_("verification_codes_v2")
        .select("id, code, attempt_count")
        .eq("email", email)
        .eq("type", code_type)
        .eq("is_used", False)
        .gte("expires_at", now)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )

    if not result.data:
        return False

    record = result.data[0]
    code_id = record["id"]
    attempt_count = int(record.get("attempt_count") or 0)

    if attempt_count >= _MAX_VERIFICATION_ATTEMPTS:
        await db_client.from_("verification_codes_v2").update(
            {"is_used": True}
        ).eq("id", code_id).execute()
        return False

    if record.get("code") != code:
        new_attempt_count = attempt_count + 1
        update_payload = {"attempt_count": new_attempt_count}
        if new_attempt_count >= _MAX_VERIFICATION_ATTEMPTS:
            update_payload["is_used"] = True
        await db_client.from_("verification_codes_v2").update(update_payload).eq(
            "id", code_id
        ).execute()
        return False

    # Mark as used immediately after a successful verification.
    await db_client.from_("verification_codes_v2").update(
        {"is_used": True}
    ).eq("id", code_id).execute()

    return True
