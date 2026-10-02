"""
Database helpers for the Expense Tracker.

This file keeps all SQLite work in one place so app.py stays focused on
routes and page rendering. Beginners can read the functions from top to
bottom: connect, create tables, then add / read / update / delete.
"""

import sqlite3
from datetime import datetime, timedelta
from pathlib import Path

# The SQLite file lives in the project root, next to app.py.
BASE_DIR = Path(__file__).resolve().parent.parent
DB_PATH = BASE_DIR / "database.db"

# Categories are defined here so they are easy to change later.
# Each item has an id (stored in the database), a display name, an icon
# class (Font Awesome), and a color used on charts and badges.
CATEGORIES = [
    {"id": "food", "name": "Food", "icon": "fa-utensils", "color": "#F97316"},
    {"id": "shopping", "name": "Shopping", "icon": "fa-bag-shopping", "color": "#EC4899"},
    {"id": "transport", "name": "Transport", "icon": "fa-car", "color": "#3B82F6"},
    {"id": "entertainment", "name": "Entertainment", "icon": "fa-film", "color": "#8B5CF6"},
    {"id": "bills", "name": "Bills", "icon": "fa-lightbulb", "color": "#EAB308"},
    {"id": "education", "name": "Education", "icon": "fa-book", "color": "#06B6D4"},
    {"id": "health", "name": "Health", "icon": "fa-heart", "color": "#F43F5E"},
    {"id": "travel", "name": "Travel", "icon": "fa-plane", "color": "#14B8A6"},
    {"id": "salary", "name": "Salary", "icon": "fa-money-bill-wave", "color": "#22C55E"},
    {"id": "other", "name": "Other", "icon": "fa-box", "color": "#94A3B8"},
]

ALLOWED_CATEGORY_IDS = {item["id"] for item in CATEGORIES}
ALLOWED_TYPES = {"income", "expense"}
ALLOWED_SORTS = {"newest", "oldest", "highest", "lowest"}


def get_connection():
    """Open a SQLite connection with useful defaults."""
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def init_db():
    """Create tables if they do not exist yet."""
    connection = get_connection()
    try:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                amount REAL NOT NULL,
                type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
                category TEXT NOT NULL,
                description TEXT DEFAULT '',
                date TEXT NOT NULL,
                created_at TEXT NOT NULL,
                is_demo INTEGER NOT NULL DEFAULT 0
            )
            """
        )
        connection.execute("""
            CREATE TABLE IF NOT EXISTS budgets (
                month TEXT PRIMARY KEY,
                amount REAL NOT NULL CHECK(amount > 0),
                updated_at TEXT NOT NULL
            )
            """)
        connection.commit()
    finally:
        connection.close()


def row_to_dict(row):
    """Convert a sqlite3.Row into a normal dictionary."""
    item = dict(row)
    item["is_demo"] = bool(item.get("is_demo"))
    item["amount"] = float(item["amount"])
    return item


def validate_transaction(data, partial=False):
    """
    Check user input before saving.

    Returns (cleaned_data, error_message).
    If everything is valid, error_message is None.
    """
    cleaned = {}

    if not partial or "title" in data:
        title = str(data.get("title", "")).strip()
        if not title:
            return None, "Please enter a transaction title."
        if len(title) > 120:
            return None, "Title must be 120 characters or less."
        cleaned["title"] = title

    if not partial or "amount" in data:
        try:
            amount = float(data.get("amount"))
        except (TypeError, ValueError):
            return None, "Please enter a valid amount."
        if amount <= 0:
            return None, "Amount must be greater than zero."
        if amount > 1_000_000_000:
            return None, "Amount is too large."
        cleaned["amount"] = round(amount, 2)

    if not partial or "type" in data:
        tx_type = str(data.get("type", "")).strip().lower()
        if tx_type not in ALLOWED_TYPES:
            return None, "Type must be income or expense."
        cleaned["type"] = tx_type

    if not partial or "category" in data:
        category = str(data.get("category", "")).strip().lower()
        if category not in ALLOWED_CATEGORY_IDS:
            return None, "Please choose a valid category."
        cleaned["category"] = category

    if not partial or "description" in data:
        description = str(data.get("description", "")).strip()
        if len(description) > 500:
            return None, "Description must be 500 characters or less."
        cleaned["description"] = description

    if not partial or "date" in data:
        date_value = str(data.get("date", "")).strip()
        try:
            datetime.strptime(date_value, "%Y-%m-%d")
        except ValueError:
            return None, "Please choose a valid date."
        cleaned["date"] = date_value

    return cleaned, None


def add_transaction(data, is_demo=False):
    cleaned, error = validate_transaction(data)
    if error:
        return None, error

    created_at = datetime.now().isoformat(timespec="seconds")
    connection = get_connection()
    try:
        cursor = connection.execute(
            """
            INSERT INTO transactions
                (title, amount, type, category, description, date, created_at, is_demo)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                cleaned["title"],
                cleaned["amount"],
                cleaned["type"],
                cleaned["category"],
                cleaned["description"],
                cleaned["date"],
                created_at,
                1 if is_demo else 0,
            ),
        )
        connection.commit()
        return get_transaction(cursor.lastrowid), None
    except sqlite3.Error:
        return None, "Could not save the transaction. Please try again."
    finally:
        connection.close()


def get_transaction(transaction_id):
    connection = get_connection()
    try:
        row = connection.execute(
            "SELECT * FROM transactions WHERE id = ?",
            (transaction_id,),
        ).fetchone()
        return row_to_dict(row) if row else None
    finally:
        connection.close()


def list_transactions(filters=None):
    """Return transactions with optional search, filter, and sort."""
    filters = filters or {}
    clauses = []
    params = []

    search = str(filters.get("q", "")).strip()
    if search:
        clauses.append(
            "(title LIKE ? OR category LIKE ? OR description LIKE ? OR CAST(amount AS TEXT) LIKE ?)"
        )
        like = f"%{search}%"
        params.extend([like, like, like, like])

    tx_type = str(filters.get("type", "")).strip().lower()
    if tx_type in ALLOWED_TYPES:
        clauses.append("type = ?")
        params.append(tx_type)

    category = str(filters.get("category", "")).strip().lower()
    if category in ALLOWED_CATEGORY_IDS:
        clauses.append("category = ?")
        params.append(category)

    date_from = str(filters.get("from", "")).strip()
    if date_from:
        clauses.append("date >= ?")
        params.append(date_from)

    date_to = str(filters.get("to", "")).strip()
    if date_to:
        clauses.append("date <= ?")
        params.append(date_to)

    where_sql = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    sort = str(filters.get("sort", "newest")).strip().lower()
    if sort not in ALLOWED_SORTS:
        sort = "newest"

    order_sql = {
        "newest": "date DESC, id DESC",
        "oldest": "date ASC, id ASC",
        "highest": "amount DESC, date DESC",
        "lowest": "amount ASC, date DESC",
    }[sort]

    connection = get_connection()
    try:
        rows = connection.execute(
            f"SELECT * FROM transactions {where_sql} ORDER BY {order_sql}",
            params,
        ).fetchall()
        return [row_to_dict(row) for row in rows]
    finally:
        connection.close()


def update_transaction(transaction_id, data):
    existing = get_transaction(transaction_id)
    if not existing:
        return None, "Transaction not found."

    cleaned, error = validate_transaction(data)
    if error:
        return None, error

    connection = get_connection()
    try:
        connection.execute(
            """
            UPDATE transactions
            SET title = ?, amount = ?, type = ?, category = ?, description = ?, date = ?
            WHERE id = ?
            """,
            (
                cleaned["title"],
                cleaned["amount"],
                cleaned["type"],
                cleaned["category"],
                cleaned["description"],
                cleaned["date"],
                transaction_id,
            ),
        )
        connection.commit()
        return get_transaction(transaction_id), None
    except sqlite3.Error:
        return None, "Could not update the transaction. Please try again."
    finally:
        connection.close()


def delete_transaction(transaction_id):
    existing = get_transaction(transaction_id)
    if not existing:
        return False, "Transaction not found."

    connection = get_connection()
    try:
        connection.execute("DELETE FROM transactions WHERE id = ?", (transaction_id,))
        connection.commit()
        return True, None
    except sqlite3.Error:
        return False, "Could not delete the transaction. Please try again."
    finally:
        connection.close()


def clear_transactions(demo_only=False):
    connection = get_connection()
    try:
        if demo_only:
            connection.execute("DELETE FROM transactions WHERE is_demo = 1")
        else:
            connection.execute("DELETE FROM transactions")
        connection.commit()
        return True
    except sqlite3.Error:
        return False
    finally:
        connection.close()


def count_transactions():
    connection = get_connection()
    try:
        row = connection.execute("SELECT COUNT(*) AS total FROM transactions").fetchone()
        return int(row["total"])
    finally:
        connection.close()


def _sum_by_type(rows):
    income = 0.0
    expense = 0.0
    for row in rows:
        if row["type"] == "income":
            income += row["amount"]
        else:
            expense += row["amount"]
    return income, expense


def get_stats(month=None):
    """
    Build dashboard numbers for a selected month (YYYY-MM).
    Also compares with the previous month.
    """
    if not month:
        month = datetime.now().strftime("%Y-%m")

    try:
        current_start = datetime.strptime(month + "-01", "%Y-%m-%d")
    except ValueError:
        current_start = datetime.now().replace(day=1)

    if current_start.month == 12:
        next_start = current_start.replace(year=current_start.year + 1, month=1)
    else:
        next_start = current_start.replace(month=current_start.month + 1)

    previous_end = current_start - timedelta(days=1)
    previous_start = previous_end.replace(day=1)

    all_rows = list_transactions()
    current_rows = [
        row
        for row in all_rows
        if current_start.strftime("%Y-%m-%d") <= row["date"] < next_start.strftime("%Y-%m-%d")
    ]
    previous_rows = [
        row
        for row in all_rows
        if previous_start.strftime("%Y-%m-%d") <= row["date"] <= previous_end.strftime("%Y-%m-%d")
    ]

    current_income, current_expense = _sum_by_type(current_rows)
    previous_income, previous_expense = _sum_by_type(previous_rows)
    all_income, all_expense = _sum_by_type(all_rows)
    rows_before_month = [
        row for row in all_rows if row["date"] < current_start.strftime("%Y-%m-%d")
    ]
    previous_all_income, previous_all_expense = _sum_by_type(rows_before_month)

    current_savings = current_income - current_expense
    previous_savings = previous_income - previous_expense
    balance = all_income - all_expense
    previous_balance = previous_all_income - previous_all_expense

    def change(current, previous):
        if previous == 0:
            return 100.0 if current > 0 else 0.0
        return round(((current - previous) / abs(previous)) * 100, 1)

    savings_rate = round((current_savings / current_income) * 100, 1) if current_income else 0.0

    return {
        "month": current_start.strftime("%Y-%m"),
        "month_label": current_start.strftime("%B %Y"),
        "balance": round(balance, 2),
        "income": round(current_income, 2),
        "expenses": round(current_expense, 2),
        "savings": round(current_savings, 2),
        "savings_rate": savings_rate,
        "changes": {
            "balance": change(balance, previous_balance),
            "income": change(current_income, previous_income),
            "expenses": change(current_expense, previous_expense),
            "savings": change(current_savings, previous_savings),
        },
        "recent": list_transactions({"sort": "newest"})[:8],
        "total_count": len(all_rows),
    }


def _date_range(period, custom_from=None, custom_to=None):
    today = datetime.now().date()
    if period == "today":
        return today.isoformat(), today.isoformat()
    if period == "this_week":
        start = today - timedelta(days=today.weekday())
        return start.isoformat(), today.isoformat()
    if period == "last_month":
        first_this_month = today.replace(day=1)
        last_prev = first_this_month - timedelta(days=1)
        first_prev = last_prev.replace(day=1)
        return first_prev.isoformat(), last_prev.isoformat()
    if period == "custom" and custom_from and custom_to:
        return custom_from, custom_to
    first = today.replace(day=1)
    return first.isoformat(), today.isoformat()


def get_analytics(period="this_month", custom_from=None, custom_to=None):
    date_from, date_to = _date_range(period, custom_from, custom_to)
    rows = list_transactions({"from": date_from, "to": date_to, "sort": "oldest"})

    expense_by_category = {}
    daily = {}
    monthly = {}
    income_total = 0.0
    expense_total = 0.0

    for row in rows:
        day = row["date"]
        month_key = day[:7]
        daily.setdefault(day, {"income": 0.0, "expense": 0.0})
        monthly.setdefault(month_key, {"income": 0.0, "expense": 0.0, "savings": 0.0})

        if row["type"] == "income":
            income_total += row["amount"]
            daily[day]["income"] += row["amount"]
            monthly[month_key]["income"] += row["amount"]
        else:
            expense_total += row["amount"]
            daily[day]["expense"] += row["amount"]
            monthly[month_key]["expense"] += row["amount"]
            expense_by_category[row["category"]] = (
                expense_by_category.get(row["category"], 0.0) + row["amount"]
            )

    for month_key, values in monthly.items():
        values["savings"] = round(values["income"] - values["expense"], 2)
        values["income"] = round(values["income"], 2)
        values["expense"] = round(values["expense"], 2)

    category_lookup = {item["id"]: item for item in CATEGORIES}
    category_chart = [
        {
            "id": key,
            "name": category_lookup.get(key, {}).get("name", key.title()),
            "color": category_lookup.get(key, {}).get("color", "#94A3B8"),
            "amount": round(amount, 2),
        }
        for key, amount in sorted(expense_by_category.items(), key=lambda item: item[1], reverse=True)
    ]

    daily_chart = [
        {
            "date": day,
            "income": round(values["income"], 2),
            "expense": round(values["expense"], 2),
        }
        for day, values in sorted(daily.items())
    ]
    monthly_chart = [
        {
            "month": month_key,
            "income": values["income"],
            "expense": values["expense"],
            "savings": values["savings"],
        }
        for month_key, values in sorted(monthly.items())
    ]

    return {
        "from": date_from,
        "to": date_to,
        "income": round(income_total, 2),
        "expenses": round(expense_total, 2),
        "savings": round(income_total - expense_total, 2),
        "count": len(rows),
        "expense_by_category": category_chart,
        "income_vs_expense": {
            "income": round(income_total, 2),
            "expense": round(expense_total, 2),
        },
        "daily": daily_chart,
        "monthly": monthly_chart,
    }


def get_category_totals():
    rows = list_transactions()
    totals = {item["id"]: {"income": 0.0, "expense": 0.0, "count": 0} for item in CATEGORIES}
    for row in rows:
        if row["category"] in totals:
            totals[row["category"]][row["type"]] += row["amount"]
            totals[row["category"]]["count"] += 1

    result = []
    for item in CATEGORIES:
        stats = totals[item["id"]]
        result.append(
            {
                **item,
                "income": round(stats["income"], 2),
                "expense": round(stats["expense"], 2),
                "count": stats["count"],
            }
        )
    return result


def get_insights():
    """Build short, real insights from this month vs last month."""
    now = datetime.now()
    this_month = now.strftime("%Y-%m")
    last_month_date = (now.replace(day=1) - timedelta(days=1))
    last_month = last_month_date.strftime("%Y-%m")

    this_stats = get_stats(this_month)
    last_stats = get_stats(last_month)

    this_rows = list_transactions(
        {
            "from": now.replace(day=1).strftime("%Y-%m-%d"),
            "to": now.strftime("%Y-%m-%d"),
        }
    )
    last_start = last_month_date.replace(day=1).strftime("%Y-%m-%d")
    last_rows = list_transactions({"from": last_start, "to": last_month_date.strftime("%Y-%m-%d")})

    def category_spend(rows):
        spend = {}
        for row in rows:
            if row["type"] == "expense":
                spend[row["category"]] = spend.get(row["category"], 0.0) + row["amount"]
        return spend

    this_spend = category_spend(this_rows)
    last_spend = category_spend(last_rows)
    names = {item["id"]: item["name"] for item in CATEGORIES}

    insights = []

    if this_stats["total_count"] == 0:
        insights.append(
            {
                "icon": "fa-seedling",
                "tone": "neutral",
                "text": "No transactions yet. Add income or expenses to see personal insights.",
            }
        )
        return insights

    if this_spend:
        top_category = max(this_spend, key=this_spend.get)
        insights.append(
            {
                "icon": "fa-chart-pie",
                "tone": "warning",
                "text": f"{names.get(top_category, top_category.title())} is your highest expense category this month.",
            }
        )

        for category_id, amount in this_spend.items():
            previous = last_spend.get(category_id, 0.0)
            if previous > 0:
                diff = ((amount - previous) / previous) * 100
                name = names.get(category_id, category_id.title())
                if diff <= -5:
                    insights.append(
                        {
                            "icon": "fa-arrow-trend-down",
                            "tone": "success",
                            "text": f"You spent {abs(diff):.0f}% less on {name} this month.",
                        }
                    )
                elif diff >= 5:
                    insights.append(
                        {
                            "icon": "fa-arrow-trend-up",
                            "tone": "danger",
                            "text": f"You spent {diff:.0f}% more on {name} this month.",
                        }
                    )

    if this_stats["savings"] > last_stats["savings"]:
        insights.append(
            {
                "icon": "fa-piggy-bank",
                "tone": "success",
                "text": "Your savings increased this month.",
            }
        )
    elif this_stats["savings"] < last_stats["savings"]:
        insights.append(
            {
                "icon": "fa-triangle-exclamation",
                "tone": "warning",
                "text": "Your savings decreased compared with last month.",
            }
        )

    if this_stats["expenses"] > last_stats["expenses"] and last_stats["expenses"] > 0:
        insights.append(
            {
                "icon": "fa-receipt",
                "tone": "danger",
                "text": "Your expenses are higher than last month.",
            }
        )
    elif this_stats["expenses"] < last_stats["expenses"] and last_stats["expenses"] > 0:
        insights.append(
            {
                "icon": "fa-circle-check",
                "tone": "success",
                "text": "You spent less this month than last month.",
            }
        )

    if this_stats["income"] > 0:
        insights.append(
            {
                "icon": "fa-percent",
                "tone": "neutral",
                "text": f"Your savings rate this month is {this_stats['savings_rate']}%.",
            }
        )

    # Keep the list short and useful.
    unique = []
    seen = set()
    for item in insights:
        if item["text"] not in seen:
            unique.append(item)
            seen.add(item["text"])
    return unique[:6]


def seed_demo_data():
    """Insert realistic sample transactions for development and demos."""
    today = datetime.now().date()

    samples = [
        {"title": "Monthly Salary", "amount": 45000, "type": "income", "category": "salary", "description": "Demo salary credit", "offset": 0},
        {"title": "Freelance Project", "amount": 15000, "type": "income", "category": "other", "description": "Demo freelance payment", "offset": -18},
        {"title": "McDonald's", "amount": 450, "type": "expense", "category": "food", "description": "Demo lunch", "offset": 0},
        {"title": "Grocery Store", "amount": 3200, "type": "expense", "category": "food", "description": "Demo weekly groceries", "offset": -4},
        {"title": "Metro Card", "amount": 800, "type": "expense", "category": "transport", "description": "Demo commute", "offset": -6},
        {"title": "Electricity Bill", "amount": 2100, "type": "expense", "category": "bills", "description": "Demo utility bill", "offset": -9},
        {"title": "Netflix", "amount": 649, "type": "expense", "category": "entertainment", "description": "Demo subscription", "offset": -12},
        {"title": "Amazon Order", "amount": 2899, "type": "expense", "category": "shopping", "description": "Demo shopping", "offset": -8},
        {"title": "Pharmacy", "amount": 760, "type": "expense", "category": "health", "description": "Demo medicines", "offset": -14},
        {"title": "Online Course", "amount": 1999, "type": "expense", "category": "education", "description": "Demo learning", "offset": -20},
        {"title": "Weekend Trip", "amount": 8500, "type": "expense", "category": "travel", "description": "Demo travel", "offset": -22},
        {"title": "Coffee Shop", "amount": 280, "type": "expense", "category": "food", "description": "Demo coffee", "offset": -1},
        {"title": "Last Month Salary", "amount": 45000, "type": "income", "category": "salary", "description": "Demo previous salary", "offset": -32},
        {"title": "Last Month Groceries", "amount": 4100, "type": "expense", "category": "food", "description": "Demo previous groceries", "offset": -36},
        {"title": "Last Month Shopping", "amount": 5200, "type": "expense", "category": "shopping", "description": "Demo previous shopping", "offset": -40},
        {"title": "Last Month Rent Utilities", "amount": 1800, "type": "expense", "category": "bills", "description": "Demo previous bills", "offset": -38},
    ]

    created = 0
    for sample in samples:
        tx_date = today + timedelta(days=sample.pop("offset"))
        sample["date"] = tx_date.isoformat()
        _, error = add_transaction(sample, is_demo=True)
        if not error:
            created += 1
    return created


def get_budget(month=None):
    """Return the monthly budget and spending status for a YYYY-MM month."""
    month = month or datetime.now().strftime("%Y-%m")
    connection = get_connection()
    try:
        row = connection.execute("SELECT month, amount, updated_at FROM budgets WHERE month = ?", (month,)).fetchone()
        limit = float(row["amount"]) if row else 0.0
        spent_row = connection.execute(
            "SELECT COALESCE(SUM(amount), 0) AS spent FROM transactions WHERE type = 'expense' AND substr(date, 1, 7) = ?",
            (month,),
        ).fetchone()
        spent = float(spent_row["spent"] or 0)
        remaining = limit - spent if limit else 0.0
        percent = min((spent / limit) * 100, 100) if limit else 0.0
        return {
            "month": month,
            "limit": round(limit, 2),
            "spent": round(spent, 2),
            "remaining": round(remaining, 2),
            "percent": round(percent, 1),
            "over": bool(limit and spent > limit),
            "has_budget": bool(limit),
            "updated_at": row["updated_at"] if row else None,
        }
    finally:
        connection.close()


def set_budget(month, amount):
    month = str(month or "").strip()
    try:
        datetime.strptime(month, "%Y-%m")
        amount = round(float(amount), 2)
    except (TypeError, ValueError):
        return None, "Please enter a valid month and budget amount."
    if amount <= 0 or amount > 1_000_000_000:
        return None, "Budget must be greater than zero and within the allowed limit."
    updated_at = datetime.now().isoformat(timespec="seconds")
    connection = get_connection()
    try:
        connection.execute(
            "INSERT INTO budgets(month, amount, updated_at) VALUES(?, ?, ?) ON CONFLICT(month) DO UPDATE SET amount=excluded.amount, updated_at=excluded.updated_at",
            (month, amount, updated_at),
        )
        connection.commit()
        return get_budget(month), None
    except sqlite3.Error:
        return None, "Could not save the budget. Please try again."
    finally:
        connection.close()


def delete_budget(month):
    connection = get_connection()
    try:
        connection.execute("DELETE FROM budgets WHERE month = ?", (month,))
        connection.commit()
        return True
    except sqlite3.Error:
        return False
    finally:
        connection.close()
