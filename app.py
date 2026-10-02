"""
Expense Tracker - Flask application.

Run this file to start the website:
    python app.py

Then open http://127.0.0.1:5000 in your browser.
"""

from datetime import datetime

from flask import Flask, jsonify, render_template, request

from utils.database import (
    CATEGORIES,
    add_transaction,
    clear_transactions,
    count_transactions,
    delete_transaction,
    get_analytics,
    get_category_totals,
    get_budget,
    set_budget,
    delete_budget,
    get_insights,
    get_stats,
    get_transaction,
    init_db,
    list_transactions,
    seed_demo_data,
    update_transaction,
)

app = Flask(__name__)
app.config["JSON_SORT_KEYS"] = False


@app.before_request
def setup_database():
    """Make sure the SQLite tables exist before handling a request."""
    init_db()


def json_error(message, status=400):
    return jsonify({"ok": False, "error": message}), status


@app.context_processor
def inject_globals():
    """Make categories and the current page available in every template."""
    return {
        "categories": CATEGORIES,
        "active_page": request.endpoint,
    }


@app.route("/")
def index():
    return render_template("index.html", page_title="Dashboard")


@app.route("/transactions")
def transactions():
    return render_template("transactions.html", page_title="Transactions")


@app.route("/analytics")
def analytics():
    return render_template("analytics.html", page_title="Analytics")


@app.route("/categories")
def categories():
    return render_template("categories.html", page_title="Categories")


@app.route("/settings")
def settings():
    return render_template("settings.html", page_title="Settings")


@app.route("/api/categories")
def api_categories():
    return jsonify({"ok": True, "categories": CATEGORIES})


@app.route("/api/transactions", methods=["GET", "POST"])
def api_transactions():
    if request.method == "POST":
        payload = request.get_json(silent=True) or {}
        created, error = add_transaction(payload)
        if error:
            return json_error(error)
        return jsonify({"ok": True, "transaction": created, "message": "Transaction added successfully"})

    filters = {
        "q": request.args.get("q", ""),
        "type": request.args.get("type", ""),
        "category": request.args.get("category", ""),
        "from": request.args.get("from", ""),
        "to": request.args.get("to", ""),
        "sort": request.args.get("sort", "newest"),
    }
    return jsonify({"ok": True, "transactions": list_transactions(filters)})


@app.route("/api/transactions/<int:transaction_id>", methods=["GET", "PUT", "DELETE"])
def api_transaction_detail(transaction_id):
    if request.method == "GET":
        item = get_transaction(transaction_id)
        if not item:
            return json_error("Transaction not found.", 404)
        return jsonify({"ok": True, "transaction": item})

    if request.method == "PUT":
        payload = request.get_json(silent=True) or {}
        updated, error = update_transaction(transaction_id, payload)
        if error:
            status = 404 if error == "Transaction not found." else 400
            return json_error(error, status)
        return jsonify({"ok": True, "transaction": updated, "message": "Transaction updated successfully"})

    deleted, error = delete_transaction(transaction_id)
    if not deleted:
        status = 404 if error == "Transaction not found." else 400
        return json_error(error, status)
    return jsonify({"ok": True, "message": "Transaction deleted"})


@app.route("/api/stats")
def api_stats():
    month = request.args.get("month", "")
    return jsonify({"ok": True, **get_stats(month or None)})


@app.route("/api/analytics")
def api_analytics():
    period = request.args.get("period", "this_month")
    custom_from = request.args.get("from", "")
    custom_to = request.args.get("to", "")
    return jsonify({"ok": True, **get_analytics(period, custom_from, custom_to)})


@app.route("/api/insights")
def api_insights():
    return jsonify({"ok": True, "insights": get_insights()})


@app.route("/api/category-totals")
def api_category_totals():
    return jsonify({"ok": True, "categories": get_category_totals()})




@app.route("/api/budget", methods=["GET", "POST", "DELETE"])
def api_budget():
    month = request.args.get("month", "") or (request.get_json(silent=True) or {}).get("month", "")
    month = str(month).strip() or datetime.now().strftime("%Y-%m")
    if request.method == "GET":
        return jsonify({"ok": True, **get_budget(month)})
    if request.method == "DELETE":
        if not delete_budget(month):
            return json_error("Could not remove the budget.", 500)
        return jsonify({"ok": True, "message": "Budget removed"})
    payload = request.get_json(silent=True) or {}
    budget, error = set_budget(month, payload.get("amount"))
    if error:
        return json_error(error)
    return jsonify({"ok": True, **budget, "message": "Budget saved successfully"})

@app.route("/api/demo-data", methods=["POST"])
def api_demo_data():
    created = seed_demo_data()
    return jsonify({"ok": True, "created": created, "message": f"Added {created} demo transactions"})


@app.route("/api/reset-demo", methods=["POST"])
def api_reset_demo():
    clear_transactions(demo_only=True)
    created = seed_demo_data()
    return jsonify({"ok": True, "created": created, "message": "Demo data was reset"})


@app.route("/api/clear", methods=["POST"])
def api_clear():
    payload = request.get_json(silent=True) or {}
    confirm = str(payload.get("confirm", "")).strip().lower()
    if confirm != "delete":
        return json_error("Please confirm by sending confirm=delete.")
    if not clear_transactions(demo_only=False):
        return json_error("Could not clear transactions.", 500)
    return jsonify({"ok": True, "message": "All transactions were deleted"})


@app.errorhandler(404)
def not_found(_error):
    if request.path.startswith("/api/"):
        return json_error("The requested resource was not found.", 404)
    return render_template("404.html", page_title="Page not found"), 404


@app.errorhandler(500)
def server_error(_error):
    if request.path.startswith("/api/"):
        return json_error("Something went wrong. Please try again.", 500)
    return render_template("404.html", page_title="Something went wrong"), 500


if __name__ == "__main__":
    init_db()
    print("Expense Tracker is running at http://127.0.0.1:5000")
    app.run(debug=True)
