"""
ENVISIONGRID — Automated Risk Report Generator
Generates AI playbooks for top risk locations and sends email reports.
Uses OpenAI SDK pointing at OpenRouter for LLM-powered playbook generation.
"""
import logging
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime
from typing import List, Dict, Optional

from openai import OpenAI

from src.config import (
    OPENROUTER_API_KEY, OPENROUTER_MODEL, OPENROUTER_BASE_URL, REPORT_TOP_N,
    SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, REPORT_RECIPIENT,
)
from src.hotspots import get_hotspots
from src.geo_grid import parse_grid_id

logger = logging.getLogger("envisiongrid.report")

# ── OpenRouter client via OpenAI SDK (lazy init) ─────────────────────
_or_client = None


def _get_or_client():
    global _or_client
    if _or_client is None:
        if not OPENROUTER_API_KEY:
            raise RuntimeError("OPENROUTER_API_KEY is not set")
        _or_client = OpenAI(
            api_key=OPENROUTER_API_KEY,
            base_url=OPENROUTER_BASE_URL,
        )
    return _or_client


# ── 1. Top risk locations ─────────────────────────────────────────────

def get_top_risk_locations(n: int = 2) -> List[Dict]:
    """
    Return the top N high-risk locations enriched with lat/lon.
    Uses the existing hotspot engine.
    """
    hotspots = get_hotspots(limit=n, use_sensors=True)
    enriched = []
    for hs in hotspots:
        lat, lon = parse_grid_id(hs["grid_id"])
        enriched.append({
            **hs,
            "lat": lat,
            "lon": lon,
        })
    return enriched


# ── 2. OpenRouter playbook generation ─────────────────────────────────

PLAYBOOK_PROMPT_TEMPLATE = """You are an environmental risk management expert.

A location at coordinates ({lat}, {lon}) — Grid ID: {grid_id} — has been flagged as HIGH RISK with a risk score of {risk_score:.2f} (confidence: {confidence:.2f}).

**Key Risk Drivers:**
{drivers_text}

**Violation Statistics:**
- Violations in last 7 days: {violation_count_7d}
- Sensor validated: {sensor_validated}

Generate a structured remediation playbook for the authorities with these sections:

1. **Situation Summary** — Brief assessment of the current risk
2. **Root Cause Analysis** — Based on the drivers listed above
3. **Immediate Actions (next 24 hours)** — Urgent steps to mitigate risk
4. **Short-term Actions (next 7 days)** — Follow-up measures
5. **Long-term Recommendations** — Systemic improvements
6. **Resource Requirements** — Personnel, equipment, budget estimates

Be specific, actionable, and concise. Use bullet points."""


def generate_playbook(location: Dict) -> str:
    """
    Call OpenRouter (via OpenAI SDK) to generate a playbook for a single location.
    """
    drivers_text = "\n".join(f"- {d}" for d in location.get("drivers", []))
    prompt = PLAYBOOK_PROMPT_TEMPLATE.format(
        lat=location.get("lat", "N/A"),
        lon=location.get("lon", "N/A"),
        grid_id=location["grid_id"],
        risk_score=location["risk_score"],
        confidence=location["confidence"],
        drivers_text=drivers_text or "- No specific drivers identified",
        violation_count_7d=location.get("violation_count_7d", 0),
        sensor_validated=location.get("sensor_validated", False),
    )

    try:
        client = _get_or_client()
        response = client.chat.completions.create(
            model=OPENROUTER_MODEL,
            messages=[{"role": "user", "content": prompt}],
        )
        choice = response.choices[0]
        msg = choice.message
        # Some thinking models (deepseek-r1) put final answer in 'content',
        # but may return None there during pure reasoning steps.
        # Try content first, then fall back to reasoning_content if available.
        content = msg.content
        if not content:
            content = getattr(msg, "reasoning_content", None)
        return content or "Playbook generation returned an empty response."
    except Exception as e:
        logger.error(f"OpenRouter API error for {location['grid_id']}: {e}")
        return f"⚠️ Playbook generation failed: {str(e)}"



def generate_playbook_for_alert(grid_id: str, risk_score: float,
                                 confidence: float, drivers: List[str]) -> str:
    """
    Generate a playbook for a single alert (used by the /report/playbook endpoint).
    """
    location = {
        "grid_id": grid_id,
        "risk_score": risk_score,
        "confidence": confidence,
        "drivers": drivers,
        "lat": grid_id.split("_")[0] if "_" in grid_id else "N/A",
        "lon": grid_id.split("_")[1] if "_" in grid_id else "N/A",
        "violation_count_7d": "N/A",
        "sensor_validated": False,
    }
    return generate_playbook(location)


# ── 3. HTML email builder ─────────────────────────────────────────────

def _build_report_html(locations: List[Dict], playbooks: List[str]) -> str:
    """
    Build a professional HTML email body.
    """
    now = datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")

    rows_html = ""
    for i, (loc, playbook) in enumerate(zip(locations, playbooks), 1):
        playbook_html = playbook.replace("\n", "<br>")
        playbook_html = playbook_html.replace("**", "<b>").replace("**", "</b>")
        risk_color = '#ef4444' if loc['risk_score'] >= 0.8 else '#f59e0b' if loc['risk_score'] >= 0.6 else '#22c55e'

        rows_html += f"""
        <div style="background:#1e293b; border-radius:12px; padding:24px; margin-bottom:24px; border-left:4px solid {risk_color};">
            <h2 style="color:#f8fafc; margin:0 0 12px 0;">
                #{i} — Grid {loc['grid_id']}
                <span style="float:right; background:{risk_color}; color:#fff; padding:4px 14px; border-radius:20px; font-size:14px;">
                    Risk: {loc['risk_score']:.2f}
                </span>
            </h2>
            <table style="color:#94a3b8; font-size:14px; margin-bottom:16px;">
                <tr><td style="padding-right:16px;">📍 Coordinates</td><td style="color:#e2e8f0;">{loc['lat']}, {loc['lon']}</td></tr>
                <tr><td style="padding-right:16px;">📊 Confidence</td><td style="color:#e2e8f0;">{loc['confidence']:.0%}</td></tr>
                <tr><td style="padding-right:16px;">⚠️ Violations (7d)</td><td style="color:#e2e8f0;">{loc.get('violation_count_7d', 'N/A')}</td></tr>
                <tr><td style="padding-right:16px;">📡 Sensor Validated</td><td style="color:#e2e8f0;">{'✅ Yes' if loc.get('sensor_validated') else '❌ No'}</td></tr>
            </table>
            <div style="color:#cbd5e1; margin-bottom:12px;">
                <strong style="color:#f8fafc;">Key Drivers:</strong><br>
                {'<br>'.join('&bull; ' + d for d in loc.get('drivers', []))}
            </div>
            <div style="background:#0f172a; border-radius:8px; padding:16px; color:#e2e8f0; font-size:13px; line-height:1.7;">
                <strong style="color:#38bdf8;">🤖 AI-Generated Remediation Playbook:</strong><br><br>
                {playbook_html}
            </div>
        </div>
        """

    return f"""
    <html>
    <body style="background:#0f172a; font-family:'Segoe UI',Arial,sans-serif; margin:0; padding:32px;">
        <div style="max-width:800px; margin:0 auto;">
            <div style="text-align:center; margin-bottom:32px;">
                <h1 style="color:#f8fafc; margin:0;">🌐 ENVISIONGRID</h1>
                <p style="color:#64748b; font-size:14px; margin:8px 0 0 0;">Environmental Risk Intelligence — Daily Authority Report</p>
                <p style="color:#475569; font-size:12px;">Generated: {now}</p>
            </div>
            <div style="background:#1e293b; border-radius:12px; padding:20px; margin-bottom:24px; text-align:center;">
                <h2 style="color:#f59e0b; margin:0;">⚡ Top {len(locations)} High-Risk Locations</h2>
                <p style="color:#94a3b8; margin:8px 0 0 0; font-size:14px;">Each location includes an AI-generated remediation playbook</p>
            </div>
            {rows_html}
            <div style="text-align:center; color:#475569; font-size:12px; margin-top:32px; padding-top:16px; border-top:1px solid #1e293b;">
                ENVISIONGRID — City-Scale Environmental Risk Intelligence Platform<br>
                This is an automated report. Do not reply to this email.
            </div>
        </div>
    </body>
    </html>
    """


# ── 4. Email sender ──────────────────────────────────────────────────

def send_report_email(html_body: str, recipient: Optional[str] = None) -> bool:
    to_addr = recipient or REPORT_RECIPIENT
    if not all([SMTP_USER, SMTP_PASSWORD, to_addr]):
        logger.error("Email credentials or recipient not configured. Skipping send.")
        return False

    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"🌐 EnvisionGrid Risk Report — {datetime.utcnow().strftime('%Y-%m-%d')}"
    msg["From"] = SMTP_USER
    msg["To"] = to_addr
    msg.attach(MIMEText(html_body, "html"))

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.sendmail(SMTP_USER, to_addr, msg.as_string())
        logger.info(f"Report email sent to {to_addr}")
        return True
    except Exception as e:
        logger.error(f"Failed to send email: {e}")
        return False


# ── 5. Orchestrator ──────────────────────────────────────────────────

_last_run = None


def get_last_run_time():
    return _last_run


def run_daily_report() -> Dict:
    """
    Main orchestrator: fetch hotspots → generate playbooks → send email.
    """
    global _last_run
    logger.info("=== Starting daily risk report generation ===")

    locations = get_top_risk_locations(n=REPORT_TOP_N)
    if not locations:
        logger.warning("No hotspot data available. Skipping report.")
        return {"status": "skipped", "reason": "no_hotspot_data"}

    logger.info(f"Found {len(locations)} high-risk locations")

    playbooks = []
    for loc in locations:
        logger.info(f"Generating playbook for {loc['grid_id']} (risk: {loc['risk_score']:.2f})")
        pb = generate_playbook(loc)
        playbooks.append(pb)

    html = _build_report_html(locations, playbooks)
    sent = send_report_email(html)
    _last_run = datetime.utcnow().isoformat()

    summary = {
        "status": "sent" if sent else "email_failed",
        "locations_count": len(locations),
        "top_grid": locations[0]["grid_id"] if locations else None,
        "top_risk_score": locations[0]["risk_score"] if locations else None,
        "timestamp": _last_run,
    }
    logger.info(f"Report generation complete: {summary}")
    return summary
