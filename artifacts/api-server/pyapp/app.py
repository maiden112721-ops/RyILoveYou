from __future__ import annotations

import hashlib
import html
import os
import re
import secrets
from collections import defaultdict
from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal, InvalidOperation
from functools import wraps
from typing import Any, Callable

import bleach
import psycopg
from dotenv import load_dotenv
from flask import Flask, g, jsonify, request, session
from psycopg.rows import dict_row
from werkzeug.security import check_password_hash
from werkzeug.exceptions import HTTPException

load_dotenv()

app = Flask(__name__)
app.secret_key = os.environ.get("SESSION_SECRET") or secrets.token_hex(32)
app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
app.config["SESSION_COOKIE_SECURE"] = os.environ.get("FLASK_ENV") == "production"

DATABASE_URL = os.environ.get("DATABASE_URL")
DEMO_MODE = os.environ.get("DEMO_MODE", "1" if os.environ.get("FLASK_ENV") != "production" else "0") == "1"
APP_PASSWORD_HASH = os.environ.get("APP_PASSWORD_HASH")
LETTER_PIN_HASH = os.environ.get("LETTER_PIN_HASH")

RICH_TEXT_TAGS = ["p", "br", "strong", "em", "u", "h2", "h3", "ul", "ol", "li", "blockquote", "a"]
RICH_TEXT_ATTRIBUTES = {"a": ["href", "title", "target", "rel"]}
TAG_RE = re.compile(r"[^a-zA-Z0-9À-ÿ' -]+")
COLOR_RE = re.compile(r"^#[0-9a-fA-F]{6}$")


def db():
    if not DATABASE_URL:
        raise RuntimeError("DATABASE_URL is required for persistent storage.")
    if "conn" not in g:
        g.conn = psycopg.connect(DATABASE_URL, row_factory=dict_row)
    return g.conn


@app.teardown_appcontext
def close_db(_error: BaseException | None) -> None:
    conn = g.pop("conn", None)
    if conn is not None:
        conn.close()


@app.errorhandler(Exception)
def handle_unexpected(error: Exception):
    if isinstance(error, HTTPException):
        return jsonify(error=error.description), error.code
    app.logger.exception("Unhandled API error", exc_info=error)
    return jsonify(error="Something went wrong while saving that. Please try again."), 500


def json_error(message: str, status: int = 400):
    return jsonify(error=message), status


def require_session(fn: Callable):
    @wraps(fn)
    def wrapped(*args, **kwargs):
        if not session.get("authenticated") and not (DEMO_MODE and not APP_PASSWORD_HASH):
            return json_error("Please unlock your private space first.", 401)
        return fn(*args, **kwargs)

    return wrapped


def parse_json() -> dict[str, Any]:
    body = request.get_json(silent=True)
    if not isinstance(body, dict):
        raise ValueError("Please send a valid form.")
    return body


def clean_tags(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, str):
        values = value.split(",")
    elif isinstance(value, list):
        values = value
    else:
        raise ValueError("Tags must be a list.")
    cleaned = []
    for item in values:
        tag = TAG_RE.sub("", str(item)).strip()
        if tag and tag not in cleaned:
            cleaned.append(tag[:40])
    return cleaned[:8]


def clean_text(value: Any, field: str, max_length: int) -> str:
    text = str(value or "").strip()
    if not text:
        raise ValueError(f"{field} is required.")
    if len(text) > max_length:
        raise ValueError(f"{field} is too long.")
    return text


def clean_rich_text(value: Any) -> str:
    content = str(value or "").strip()
    if not content:
        raise ValueError("Your letter needs a little something in it.")
    safe = bleach.clean(
        content,
        tags=RICH_TEXT_TAGS,
        attributes=RICH_TEXT_ATTRIBUTES,
        protocols=["http", "https", "mailto"],
        strip=True,
    )
    return bleach.linkify(safe, callbacks=[], skip_tags=["pre"])


def parse_id(value: str) -> int:
    try:
        result = int(value)
    except (TypeError, ValueError):
        raise ValueError("That item could not be found.")
    if result < 1:
        raise ValueError("That item could not be found.")
    return result


def parse_money(value: Any) -> Decimal:
    try:
        amount = Decimal(str(value)).quantize(Decimal("0.01"))
    except (InvalidOperation, ValueError):
        raise ValueError("Enter a valid peso amount.")
    if amount <= 0 or amount > Decimal("9999999999.99"):
        raise ValueError("Enter an amount greater than zero.")
    return amount


def parse_dt(value: Any) -> datetime:
    raw = str(value or "").strip()
    if not raw:
        raise ValueError("Choose a date and time.")
    try:
        parsed = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError:
        raise ValueError("That date and time is not valid.")
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def parse_date(value: Any, field: str, required: bool = True) -> date | None:
    raw = str(value or "").strip()
    if not raw and not required:
        return None
    try:
        return date.fromisoformat(raw)
    except ValueError:
        raise ValueError(f"{field} is not a valid date.")


def parse_time(value: Any) -> str | None:
    raw = str(value or "").strip()
    if not raw:
        return None
    try:
        return datetime.strptime(raw, "%H:%M").strftime("%H:%M:%S")
    except ValueError:
        raise ValueError("That time is not valid.")


def serialize(row: dict[str, Any]) -> dict[str, Any]:
    result = {}
    for key, value in row.items():
        if isinstance(value, (datetime, date, time)):
            result[key] = value.isoformat()
        elif isinstance(value, Decimal):
            result[key] = float(value)
        else:
            result[key] = value
    return result


def with_camel(row: dict[str, Any], mapping: dict[str, str]) -> dict[str, Any]:
    return {mapping.get(key, key): value for key, value in serialize(row).items()}


def letter_json(row: dict[str, Any]) -> dict[str, Any]:
    result = with_camel(row, {"created_at": "createdAt", "updated_at": "updatedAt"})
    result["tags"] = result.get("tags") or []
    return result


def reminder_json(row: dict[str, Any]) -> dict[str, Any]:
    result = with_camel(
        row,
        {
            "start_date": "startDate",
            "end_date": "endDate",
            "start_time": "startTime",
            "end_time": "endTime",
            "created_at": "createdAt",
            "updated_at": "updatedAt",
        },
    )
    result["tags"] = result.get("tags") or []
    if result.get("startTime"):
        result["startTime"] = result["startTime"][:5]
    if result.get("endTime"):
        result["endTime"] = result["endTime"][:5]
    return result


def wallet_balance(wallet_id: int, exclude_transaction_id: int | None = None) -> Decimal:
    sql = """
      SELECT COALESCE(SUM(CASE WHEN type = 'deposit' THEN amount ELSE -amount END), 0) AS balance
      FROM transactions WHERE wallet_id = %s
    """
    params: list[Any] = [wallet_id]
    if exclude_transaction_id is not None:
        sql += " AND id <> %s"
        params.append(exclude_transaction_id)
    row = db().execute(sql, params).fetchone()
    return Decimal(row["balance"] or 0)


def wallet_json(row: dict[str, Any]) -> dict[str, Any]:
    result = with_camel(row, {"target_amount": "targetAmount", "created_at": "createdAt", "updated_at": "updatedAt"})
    balance = Decimal(result.pop("balance") or 0)
    target = result.get("targetAmount")
    result["balance"] = float(balance)
    result["progress"] = round(min(balance / Decimal(str(target)) * 100, Decimal("100")), 1) if target and Decimal(str(target)) > 0 else None
    return result


def transaction_json(row: dict[str, Any]) -> dict[str, Any]:
    return with_camel(
        row,
        {
            "wallet_id": "walletId",
            "merchant_or_source": "merchantOrSource",
            "transaction_date": "transactionDate",
            "created_at": "createdAt",
            "updated_at": "updatedAt",
        },
    )


@app.get("/api/healthz")
def health():
    return jsonify(status="ok")


@app.get("/api/session")
def get_session():
    authenticated = bool(session.get("authenticated")) or (DEMO_MODE and not APP_PASSWORD_HASH)
    return jsonify(authenticated=authenticated)


@app.post("/api/session")
def login():
    try:
        password = clean_text(parse_json().get("password"), "Password", 200)
    except ValueError as error:
        return json_error(str(error))
    valid = False
    if APP_PASSWORD_HASH:
        valid = check_password_hash(APP_PASSWORD_HASH, password)
    elif DEMO_MODE:
        valid = True
    if not valid:
        return json_error("That password did not work. Please try again.", 401)
    session["authenticated"] = True
    return jsonify(authenticated=True)


@app.post("/api/session/logout")
def logout():
    session.clear()
    return "", 204


@app.get("/api/letters")
@require_session
def list_letters():
    rows = db().execute("SELECT * FROM letters ORDER BY created_at DESC").fetchall()
    return jsonify([letter_json(row) for row in rows])


@app.post("/api/letters/unlock")
@require_session
def unlock_letters():
    try:
        pin = clean_text(parse_json().get("pin"), "PIN", 20)
    except ValueError as error:
        return json_error(str(error))
    valid = check_password_hash(LETTER_PIN_HASH, pin) if LETTER_PIN_HASH else (DEMO_MODE and len(pin) == 6)
    if not valid:
        return json_error("That PIN didn’t match. Take another little look and try again.", 403)
    session["letter_unlocked_until"] = (datetime.now(timezone.utc) + timedelta(minutes=20)).isoformat()
    return "", 204


def letter_is_unlocked() -> bool:
    raw = session.get("letter_unlocked_until")
    try:
        return bool(raw and datetime.fromisoformat(raw) > datetime.now(timezone.utc))
    except (TypeError, ValueError):
        return False


@app.post("/api/letters")
@require_session
def create_letter():
    if not letter_is_unlocked():
        return json_error("Unlock letter posting with your private PIN first.", 403)
    try:
        body = parse_json()
        title = clean_text(body.get("title"), "Title", 180)
        content = clean_rich_text(body.get("content"))
        tags = clean_tags(body.get("tags"))
    except ValueError as error:
        return json_error(str(error))
    row = db().execute(
        "INSERT INTO letters (title, content, tags) VALUES (%s, %s, %s) RETURNING *",
        (title, content, psycopg.types.json.Jsonb(tags)),
    ).fetchone()
    db().commit()
    return jsonify(letter_json(row)), 201


@app.patch("/api/letters/<id>")
@require_session
def update_letter(id: str):
    if not letter_is_unlocked():
        return json_error("Unlock letter editing with your private PIN first.", 403)
    try:
        letter_id = parse_id(id)
        body = parse_json()
        title = clean_text(body.get("title"), "Title", 180)
        content = clean_rich_text(body.get("content"))
        tags = clean_tags(body.get("tags"))
    except ValueError as error:
        return json_error(str(error))
    row = db().execute(
        "UPDATE letters SET title=%s, content=%s, tags=%s, updated_at=now() WHERE id=%s RETURNING *",
        (title, content, psycopg.types.json.Jsonb(tags), letter_id),
    ).fetchone()
    if not row:
        db().rollback()
        return json_error("That letter is no longer here.", 404)
    db().commit()
    return jsonify(letter_json(row))


@app.delete("/api/letters/<id>")
@require_session
def delete_letter(id: str):
    if not letter_is_unlocked():
        return json_error("Unlock letter editing with your private PIN first.", 403)
    try:
        letter_id = parse_id(id)
    except ValueError as error:
        return json_error(str(error))
    db().execute("DELETE FROM letters WHERE id=%s", (letter_id,))
    db().commit()
    return "", 204


@app.get("/api/reminders")
@require_session
def list_reminders():
    start = parse_date(request.args.get("from"), "Start date", False)
    end = parse_date(request.args.get("to"), "End date", False)
    sql = "SELECT * FROM reminders"
    params: list[Any] = []
    if start and end:
        sql += " WHERE start_date <= %s AND end_date >= %s"
        params = [end, start]
    sql += " ORDER BY start_date, start_time NULLS LAST, id"
    rows = db().execute(sql, params).fetchall()
    return jsonify([reminder_json(row) for row in rows])


def reminder_values(body: dict[str, Any]) -> tuple[Any, ...]:
    title = clean_text(body.get("title"), "Reminder title", 180)
    description = str(body.get("description") or "").strip()[:2000]
    tags = clean_tags(body.get("tags"))
    start_date = parse_date(body.get("startDate"), "Start date")
    end_date = parse_date(body.get("endDate"), "End date", False) or start_date
    if end_date < start_date:
        raise ValueError("End date cannot be before the start date.")
    start_time = parse_time(body.get("startTime"))
    end_time = parse_time(body.get("endTime"))
    if start_time and end_time and end_time <= start_time and end_date == start_date:
        raise ValueError("End time must be after the start time.")
    color = str(body.get("color") or "#D66B83")
    if not COLOR_RE.fullmatch(color):
        raise ValueError("Choose a valid reminder color.")
    return title, description, psycopg.types.json.Jsonb(tags), start_date, end_date, start_time, end_time, color


@app.post("/api/reminders")
@require_session
def create_reminder():
    try:
        values = reminder_values(parse_json())
    except ValueError as error:
        return json_error(str(error))
    row = db().execute(
        """INSERT INTO reminders (title, description, tags, start_date, end_date, start_time, end_time, color)
           VALUES (%s,%s,%s,%s,%s,%s,%s,%s) RETURNING *""",
        values,
    ).fetchone()
    db().commit()
    return jsonify(reminder_json(row)), 201


@app.patch("/api/reminders/<id>")
@require_session
def update_reminder(id: str):
    try:
        reminder_id = parse_id(id)
        values = reminder_values(parse_json())
    except ValueError as error:
        return json_error(str(error))
    row = db().execute(
        """UPDATE reminders SET title=%s, description=%s, tags=%s, start_date=%s, end_date=%s,
           start_time=%s, end_time=%s, color=%s, updated_at=now() WHERE id=%s RETURNING *""",
        (*values, reminder_id),
    ).fetchone()
    if not row:
        db().rollback()
        return json_error("That reminder is no longer here.", 404)
    db().commit()
    return jsonify(reminder_json(row))


@app.delete("/api/reminders/<id>")
@require_session
def delete_reminder(id: str):
    try:
        reminder_id = parse_id(id)
    except ValueError as error:
        return json_error(str(error))
    db().execute("DELETE FROM reminders WHERE id=%s", (reminder_id,))
    db().commit()
    return "", 204


def wallet_row(wallet_id: int) -> dict[str, Any] | None:
    return db().execute(
        """SELECT w.*, COALESCE(SUM(CASE WHEN t.type='deposit' THEN t.amount ELSE -t.amount END), 0) AS balance
           FROM wallets w LEFT JOIN transactions t ON t.wallet_id=w.id WHERE w.id=%s GROUP BY w.id""",
        (wallet_id,),
    ).fetchone()


@app.get("/api/wallets")
@require_session
def list_wallets():
    rows = db().execute(
        """SELECT w.*, COALESCE(SUM(CASE WHEN t.type='deposit' THEN t.amount ELSE -t.amount END), 0) AS balance
           FROM wallets w LEFT JOIN transactions t ON t.wallet_id=w.id GROUP BY w.id ORDER BY w.created_at"""
    ).fetchall()
    return jsonify([wallet_json(row) for row in rows])


@app.post("/api/wallets")
@require_session
def create_wallet():
    try:
        body = parse_json()
        name = clean_text(body.get("name"), "Wallet name", 100)
        target = body.get("targetAmount")
        target_amount = None if target in (None, "") else parse_money(target)
    except ValueError as error:
        return json_error(str(error))
    row = db().execute("INSERT INTO wallets (name, target_amount) VALUES (%s,%s) RETURNING *", (name, target_amount)).fetchone()
    db().commit()
    row["balance"] = Decimal("0")
    return jsonify(wallet_json(row)), 201


@app.patch("/api/wallets/<id>")
@require_session
def update_wallet(id: str):
    try:
        wallet_id = parse_id(id)
        body = parse_json()
        name = clean_text(body.get("name"), "Wallet name", 100)
        target = body.get("targetAmount")
        target_amount = None if target in (None, "") else parse_money(target)
    except ValueError as error:
        return json_error(str(error))
    row = db().execute(
        "UPDATE wallets SET name=%s, target_amount=%s, updated_at=now() WHERE id=%s RETURNING *",
        (name, target_amount, wallet_id),
    ).fetchone()
    if not row:
        db().rollback()
        return json_error("That wallet is no longer here.", 404)
    db().commit()
    row["balance"] = wallet_balance(wallet_id)
    return jsonify(wallet_json(row))


@app.delete("/api/wallets/<id>")
@require_session
def delete_wallet(id: str):
    try:
        wallet_id = parse_id(id)
    except ValueError as error:
        return json_error(str(error))
    db().execute("DELETE FROM wallets WHERE id=%s", (wallet_id,))
    db().commit()
    return "", 204


def transaction_values(body: dict[str, Any]) -> tuple[Any, ...]:
    wallet_id = body.get("walletId")
    if wallet_id in ("", None):
        wallet_id = None
    elif isinstance(wallet_id, (int, float)) or str(wallet_id).isdigit():
        wallet_id = parse_id(str(wallet_id))
        if not wallet_row(wallet_id):
            raise ValueError("Choose an existing wallet.")
    else:
        raise ValueError("Choose an existing wallet.")
    tx_type = str(body.get("type") or "").lower()
    if tx_type not in ("deposit", "withdrawal"):
        raise ValueError("Choose deposit or withdrawal.")
    amount = parse_money(body.get("amount"))
    merchant = clean_text(body.get("merchantOrSource"), "Where it came from or went", 180)
    description = str(body.get("description") or "").strip()[:2000]
    transaction_date = parse_dt(body.get("transactionDate"))
    return wallet_id, tx_type, amount, merchant, description, transaction_date


def ensure_balance(wallet_id: int | None, tx_type: str, amount: Decimal, exclude_id: int | None = None) -> None:
    if wallet_id and tx_type == "withdrawal" and wallet_balance(wallet_id, exclude_id) < amount:
        raise ValueError("That withdrawal is higher than the wallet balance.")


@app.get("/api/transactions")
@require_session
def list_transactions():
    wallet_id = request.args.get("walletId")
    sql = "SELECT * FROM transactions"
    params: list[Any] = []
    if wallet_id not in (None, ""):
        sql += " WHERE wallet_id=%s"
        params.append(parse_id(wallet_id))
    sql += " ORDER BY transaction_date DESC, id DESC"
    rows = db().execute(sql, params).fetchall()
    return jsonify([transaction_json(row) for row in rows])


@app.post("/api/transactions")
@require_session
def create_transaction():
    try:
        values = transaction_values(parse_json())
        ensure_balance(values[0], values[1], values[2])
    except ValueError as error:
        return json_error(str(error))
    row = db().execute(
        """INSERT INTO transactions (wallet_id, type, amount, merchant_or_source, description, transaction_date)
           VALUES (%s,%s,%s,%s,%s,%s) RETURNING *""",
        values,
    ).fetchone()
    db().commit()
    return jsonify(transaction_json(row)), 201


@app.patch("/api/transactions/<id>")
@require_session
def update_transaction(id: str):
    try:
        transaction_id = parse_id(id)
        values = transaction_values(parse_json())
        ensure_balance(values[0], values[1], values[2], transaction_id)
    except ValueError as error:
        return json_error(str(error))
    row = db().execute(
        """UPDATE transactions SET wallet_id=%s, type=%s, amount=%s, merchant_or_source=%s,
           description=%s, transaction_date=%s, updated_at=now() WHERE id=%s RETURNING *""",
        (*values, transaction_id),
    ).fetchone()
    if not row:
        db().rollback()
        return json_error("That transaction is no longer here.", 404)
    db().commit()
    return jsonify(transaction_json(row))


@app.delete("/api/transactions/<id>")
@require_session
def delete_transaction(id: str):
    try:
        transaction_id = parse_id(id)
    except ValueError as error:
        return json_error(str(error))
    db().execute("DELETE FROM transactions WHERE id=%s", (transaction_id,))
    db().commit()
    return "", 204


def spending_points(range_name: str) -> tuple[list[dict[str, Any]], Decimal]:
    now = datetime.now(timezone.utc)
    if range_name == "daily":
        start = now - timedelta(days=6)
        buckets = [(start.date() + timedelta(days=i), (start.date() + timedelta(days=i)).strftime("%a")) for i in range(7)]
        expression = "DATE(transaction_date AT TIME ZONE 'UTC')"
    elif range_name == "monthly":
        start = now.replace(day=1) - timedelta(days=150)
        buckets = []
        cursor = date(start.year, start.month, 1)
        for _ in range(6):
            buckets.append((cursor, cursor.strftime("%b")))
            cursor = (cursor.replace(day=28) + timedelta(days=4)).replace(day=1)
        expression = "DATE_TRUNC('month', transaction_date AT TIME ZONE 'UTC')::date"
    else:
        start = now - timedelta(days=6 * 7)
        buckets = [(start.date() + timedelta(days=i * 7), f"W{i + 1}") for i in range(7)]
        expression = "DATE_TRUNC('week', transaction_date AT TIME ZONE 'UTC')::date"
    rows = db().execute(
        f"""SELECT {expression} AS bucket, COALESCE(SUM(amount), 0) AS total FROM transactions
            WHERE type='withdrawal' AND transaction_date >= %s GROUP BY bucket ORDER BY bucket""",
        (start,),
    ).fetchall()
    totals = {row["bucket"]: Decimal(row["total"] or 0) for row in rows}
    points = [{"label": label, "amount": float(totals.get(bucket, 0))} for bucket, label in buckets]
    return points, sum((Decimal(str(point["amount"])) for point in points), Decimal("0"))


@app.get("/api/dashboard/summary")
@require_session
def dashboard_summary():
    range_name = request.args.get("range", "weekly")
    if range_name not in ("daily", "weekly", "monthly"):
        return json_error("Choose a daily, weekly, or monthly view.")
    wallets = db().execute(
        """SELECT w.id, COALESCE(SUM(CASE WHEN t.type='deposit' THEN t.amount ELSE -t.amount END), 0) AS balance
           FROM wallets w LEFT JOIN transactions t ON t.wallet_id=w.id GROUP BY w.id"""
    ).fetchall()
    total = sum((Decimal(row["balance"] or 0) for row in wallets), Decimal("0"))
    points, spending_total = spending_points(range_name)
    recent = db().execute("SELECT * FROM transactions ORDER BY transaction_date DESC LIMIT 5").fetchall()
    return jsonify(
        totalMoney=float(total),
        walletCount=len(wallets),
        spendingTotal=float(spending_total),
        spendingPoints=points,
        recentTransactions=[transaction_json(row) for row in recent],
    )