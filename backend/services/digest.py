"""
Morning Career Digest Service
Sends a daily personalised email digest to opted-in users.

Digest includes:
  - Career health score summary
  - Top 3 new job matches
  - Today's campaign todos
  - Market pulse (hot skills / roles)
  - Learning progress nudge

Delivery: tries SendGrid first, falls back to Resend, falls back to SMTP.
"""
import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Optional

logger = logging.getLogger(__name__)

# ── Email provider helpers ────────────────────────────────────────────────────

async def _send_via_sendgrid(to: str, subject: str, html: str) -> bool:
    """Send using SendGrid if SENDGRID_API_KEY is set."""
    key = os.getenv("SENDGRID_API_KEY")
    if not key:
        return False
    try:
        import httpx
        resp = await httpx.AsyncClient().post(
            "https://api.sendgrid.com/v3/mail/send",
            headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
            json={
                "personalizations": [{"to": [{"email": to}]}],
                "from": {"email": os.getenv("DIGEST_FROM_EMAIL", "digest@jobintel.ai"), "name": "JobIntel AI"},
                "subject": subject,
                "content": [{"type": "text/html", "value": html}],
            },
            timeout=10,
        )
        return resp.status_code in (200, 202)
    except Exception as exc:
        logger.warning(f"SendGrid failed: {exc}")
        return False


async def _send_via_resend(to: str, subject: str, html: str) -> bool:
    """Send using Resend if RESEND_API_KEY is set."""
    key = os.getenv("RESEND_API_KEY")
    if not key:
        return False
    try:
        import httpx
        resp = await httpx.AsyncClient().post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
            json={
                "from": os.getenv("DIGEST_FROM_EMAIL", "digest@jobintel.ai"),
                "to": [to],
                "subject": subject,
                "html": html,
            },
            timeout=10,
        )
        return resp.status_code == 200
    except Exception as exc:
        logger.warning(f"Resend failed: {exc}")
        return False


async def _send_via_smtp(to: str, subject: str, html: str) -> bool:
    """Send using SMTP if SMTP_HOST is set (synchronous fallback)."""
    host = os.getenv("SMTP_HOST")
    if not host:
        return False
    try:
        import smtplib
        from email.mime.multipart import MIMEMultipart
        from email.mime.text import MIMEText
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = os.getenv("DIGEST_FROM_EMAIL", "digest@jobintel.ai")
        msg["To"] = to
        msg.attach(MIMEText(html, "html"))
        with smtplib.SMTP(host, int(os.getenv("SMTP_PORT", "587"))) as server:
            server.starttls()
            user = os.getenv("SMTP_USER", "")
            pw = os.getenv("SMTP_PASS", "")
            if user and pw:
                server.login(user, pw)
            server.sendmail(msg["From"], [to], msg.as_string())
        return True
    except Exception as exc:
        logger.warning(f"SMTP failed: {exc}")
        return False


async def send_email(to: str, subject: str, html: str) -> bool:
    """Try providers in order; return True if any succeeds."""
    if await _send_via_sendgrid(to, subject, html):
        return True
    if await _send_via_resend(to, subject, html):
        return True
    if await _send_via_smtp(to, subject, html):
        return True
    logger.warning(f"All email providers failed for {to}")
    return False


# ── Digest builder ────────────────────────────────────────────────────────────

def _build_digest_html(
    user_name: str,
    health_score: int,
    top_jobs: list,
    todos: list,
    learning_paths: list,
    hot_skills: list,
) -> str:
    """Build the digest HTML email."""
    today = datetime.now().strftime("%A, %B %-d")

    jobs_html = ""
    for job in top_jobs[:3]:
        score = job.get("fitScore") or job.get("fit_score", 0)
        jobs_html += f"""
        <tr>
          <td style="padding:8px 0; border-bottom:1px solid #1e293b;">
            <strong style="color:#f1f5f9;">{job.get('title','')}</strong>
            <span style="color:#64748b; font-size:12px;"> at {job.get('organization','')}</span>
            <br><span style="color:#818cf8; font-size:12px; font-weight:700;">{score}% fit</span>
          </td>
        </tr>"""

    todos_html = "".join(
        f'<li style="color:#94a3b8; padding:3px 0; font-size:13px;">• {t.get("text","")}</li>'
        for t in todos[:3]
    )

    paths_html = ""
    for p in learning_paths[:2]:
        paths_html += f"""
        <div style="margin-bottom:8px;">
          <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:3px;">
            <span style="color:#e2e8f0;">{p.get('skill_name','')}</span>
            <span style="color:#818cf8;">{p.get('progress_pct',0)}%</span>
          </div>
          <div style="height:4px; background:#1e293b; border-radius:99px;">
            <div style="height:4px; width:{p.get('progress_pct',0)}%; background:#6366f1; border-radius:99px;"></div>
          </div>
        </div>"""

    skills_html = " ".join(
        f'<span style="background:#1e293b; color:#818cf8; padding:2px 8px; border-radius:99px; font-size:11px;">{s}</span>'
        for s in hot_skills[:6]
    )

    health_color = "#10b981" if health_score >= 70 else "#f59e0b" if health_score >= 50 else "#ef4444"

    return f"""
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0; padding:0; background:#0f172a; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:600px; margin:0 auto; padding:32px 16px;">

    <!-- Header -->
    <div style="text-align:center; margin-bottom:32px;">
      <div style="display:inline-flex; align-items:center; gap:8px;">
        <div style="width:32px; height:32px; background:linear-gradient(135deg,#4f46e5,#7c3aed); border-radius:8px; display:flex; align-items:center; justify-content:center;">
          <span style="color:white; font-size:16px;">⚡</span>
        </div>
        <span style="color:#f1f5f9; font-weight:700; font-size:16px;">JobIntel AI</span>
      </div>
      <h1 style="color:#f1f5f9; font-size:20px; margin:16px 0 4px;">Good morning, {user_name}!</h1>
      <p style="color:#64748b; font-size:13px; margin:0;">Your career digest for {today}</p>
    </div>

    <!-- Health Score -->
    <div style="background:#1e293b; border-radius:16px; padding:20px; margin-bottom:16px; text-align:center;">
      <p style="color:#94a3b8; font-size:11px; text-transform:uppercase; letter-spacing:1px; margin:0 0 8px;">Career Health Score</p>
      <div style="font-size:48px; font-weight:800; color:{health_color}; line-height:1;">{health_score}</div>
      <p style="color:#64748b; font-size:12px; margin:4px 0 0;">{'On track 🎯' if health_score >= 70 else 'Needs attention ⚠️'}</p>
    </div>

    <!-- Top Job Matches -->
    {f'''
    <div style="background:#1e293b; border-radius:16px; padding:20px; margin-bottom:16px;">
      <p style="color:#818cf8; font-size:11px; text-transform:uppercase; letter-spacing:1px; margin:0 0 12px; font-weight:700;">🎯 Top Job Matches</p>
      <table style="width:100%; border-collapse:collapse;">{jobs_html}</table>
      <a href="{os.getenv('FRONTEND_URL','http://localhost:3000')}/jobs"
         style="display:block; text-align:center; margin-top:12px; color:#818cf8; font-size:12px;">View all matches →</a>
    </div>''' if jobs_html else ''}

    <!-- Today's Tasks -->
    {f'''
    <div style="background:#1e293b; border-radius:16px; padding:20px; margin-bottom:16px;">
      <p style="color:#818cf8; font-size:11px; text-transform:uppercase; letter-spacing:1px; margin:0 0 12px; font-weight:700;">✅ Today's Actions</p>
      <ul style="margin:0; padding:0; list-style:none;">{todos_html}</ul>
    </div>''' if todos_html else ''}

    <!-- Learning Progress -->
    {f'''
    <div style="background:#1e293b; border-radius:16px; padding:20px; margin-bottom:16px;">
      <p style="color:#818cf8; font-size:11px; text-transform:uppercase; letter-spacing:1px; margin:0 0 12px; font-weight:700;">📚 Learning Progress</p>
      {paths_html}
    </div>''' if paths_html else ''}

    <!-- Hot Skills -->
    {f'''
    <div style="background:#1e293b; border-radius:16px; padding:20px; margin-bottom:16px;">
      <p style="color:#818cf8; font-size:11px; text-transform:uppercase; letter-spacing:1px; margin:0 0 12px; font-weight:700;">🔥 Hot Skills Right Now</p>
      <div>{skills_html}</div>
    </div>''' if skills_html else ''}

    <!-- CTA -->
    <div style="text-align:center; margin-top:24px;">
      <a href="{os.getenv('FRONTEND_URL','http://localhost:3000')}"
         style="display:inline-block; background:linear-gradient(135deg,#4f46e5,#7c3aed); color:white; text-decoration:none; padding:12px 32px; border-radius:12px; font-weight:600; font-size:14px;">
        Open Career Dashboard →
      </a>
    </div>

    <!-- Footer -->
    <p style="text-align:center; color:#334155; font-size:11px; margin-top:32px;">
      JobIntel AI · Career Intelligence Platform<br>
      <a href="{os.getenv('FRONTEND_URL','http://localhost:3000')}/settings" style="color:#475569;">Manage email preferences</a>
    </p>
  </div>
</body>
</html>"""


# ── Main send function ────────────────────────────────────────────────────────

async def send_morning_digest(
    user_id,
    user_email: str,
    user_name: str,
    db,
) -> bool:
    """
    Build and send the morning digest for a single user.
    Called by a scheduler (APScheduler / Celery beat) or the API endpoint.
    """
    from sqlalchemy import select
    from models.database import (
        CareerGraph, VerifiedJob, LearningPath,
        CandidateProfile, CareerGoal,
    )
    from services.fit_score import compute_fit_score

    try:
        # ── Health score ──────────────────────────────────────────────────────
        graph_r = await db.execute(
            select(CareerGraph).where(CareerGraph.user_id == user_id)
        )
        graph = graph_r.scalar_one_or_none()
        health_score = int(graph.health_score) if graph and graph.health_score else 0

        # ── Profile + goal ────────────────────────────────────────────────────
        profile_r = await db.execute(
            select(CandidateProfile).where(CandidateProfile.user_id == user_id)
        )
        profile = profile_r.scalar_one_or_none()

        goal_r = await db.execute(
            select(CareerGoal).where(CareerGoal.user_id == user_id, CareerGoal.is_active == True)
        )
        goal = goal_r.scalar_one_or_none()

        # ── Top job matches ───────────────────────────────────────────────────
        top_jobs = []
        if profile:
            cutoff = datetime.now(timezone.utc) - timedelta(days=3)
            jobs_r = await db.execute(
                select(VerifiedJob)
                .where(VerifiedJob.created_at >= cutoff)
                .order_by(VerifiedJob.created_at.desc())
                .limit(30)
            )
            recent_jobs = jobs_r.scalars().all()
            scored = []
            for job in recent_jobs:
                fit = compute_fit_score(
                    user_skills=list(profile.skills or []),
                    user_frameworks=list(profile.frameworks or []),
                    user_languages=list(profile.languages or []),
                    user_experience_years=profile.experience_years,
                    user_preferred_locations=list(profile.preferred_locations or []),
                    user_work_mode=profile.work_mode,
                    user_current_salary=profile.current_salary,
                    user_target_role=goal.target_role if goal else None,
                    user_target_salary_min=goal.target_salary_min if goal else None,
                    job_title=job.title or "",
                    job_description=job.description or "",
                    job_requirements=list(job.requirements or []) + list(job.technologies or []),
                    job_experience_required=job.experience_required,
                    job_location=job.location,
                    job_work_mode=job.work_mode,
                    job_salary_min=job.salary_min,
                    job_salary_max=job.salary_max,
                )
                scored.append({"title": job.title, "organization": job.organization, "fitScore": fit["fit_score"]})
            scored.sort(key=lambda x: x["fitScore"], reverse=True)
            top_jobs = scored[:3]

        # ── Learning paths ────────────────────────────────────────────────────
        paths_r = await db.execute(
            select(LearningPath)
            .where(LearningPath.user_id == user_id, LearningPath.status == "active")
            .limit(3)
        )
        learning_paths = [
            {"skill_name": p.skill_name, "progress_pct": p.progress_pct}
            for p in paths_r.scalars().all()
        ]

        # ── Hot skills (static trending list) ────────────────────────────────
        hot_skills = ["LLMs", "TypeScript", "Terraform", "dbt", "FastAPI", "Kubernetes"]

        # ── Build + send ──────────────────────────────────────────────────────
        html = _build_digest_html(
            user_name=user_name,
            health_score=health_score,
            top_jobs=top_jobs,
            todos=[],   # Campaign todos require a separate AI call; skip in digest
            learning_paths=learning_paths,
            hot_skills=hot_skills,
        )

        sent = await send_email(
            to=user_email,
            subject=f"☀️ Your Career Digest — {datetime.now().strftime('%b %d')}",
            html=html,
        )
        logger.info(f"Digest for {user_email}: {'sent' if sent else 'failed'}")
        return sent

    except Exception as exc:
        logger.error(f"Digest build failed for {user_email}: {exc}")
        return False
