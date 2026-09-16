"""
Approved, tenant-isolated business-data functions for the Ask Vyastha AI.

Every function is scoped to a single business (user_id). The AI model NEVER
gets direct database access - it only ever sees the summarized output of these
functions. This enforces tenant isolation and prevents data leakage.
"""

from __future__ import annotations

from datetime import date, datetime, timezone, timedelta
from typing import Any

from lib.db import db


def _today_str() -> str:
    return date.today().isoformat()


def _month_bounds() -> tuple[str, str]:
    today = date.today()
    start = today.replace(day=1).isoformat()
    return start, today.isoformat()


async def _active_invoices(user_id: str) -> list[dict[str, Any]]:
    return await db.invoices.find(
        {"user_id": user_id, "status": {"$ne": "cancelled"}}, {"_id": 0}
    ).to_list(2000)


async def get_today_sales(user_id: str) -> dict[str, Any]:
    today = _today_str()
    invs = await db.invoices.find(
        {"user_id": user_id, "invoice_date": today, "status": {"$ne": "cancelled"}},
        {"_id": 0},
    ).to_list(1000)
    total = sum(i.get("total_amount", 0) for i in invs)
    return {"date": today, "invoice_count": len(invs), "total_sales": round(total, 2)}


async def get_sales_summary(user_id: str) -> dict[str, Any]:
    invs = await _active_invoices(user_id)
    start, end = _month_bounds()
    month_invs = [i for i in invs if start <= i.get("invoice_date", "") <= end]
    total_all = sum(i.get("total_amount", 0) for i in invs)
    month_total = sum(i.get("total_amount", 0) for i in month_invs)
    return {
        "lifetime_sales": round(total_all, 2),
        "this_month_sales": round(month_total, 2),
        "this_month_invoice_count": len(month_invs),
        "total_invoice_count": len(invs),
    }


async def get_monthly_sales(user_id: str) -> dict[str, Any]:
    invs = await _active_invoices(user_id)
    buckets: dict[str, float] = {}
    for i in invs:
        d = i.get("invoice_date", "")
        if len(d) >= 7:
            buckets[d[:7]] = buckets.get(d[:7], 0) + i.get("total_amount", 0)
    ordered = sorted(buckets.items())
    return {"monthly": [{"month": m, "sales": round(v, 2)} for m, v in ordered[-6:]]}


async def get_sales_trend(user_id: str) -> dict[str, Any]:
    data = await get_monthly_sales(user_id)
    months = data["monthly"]
    trend = "stable"
    if len(months) >= 2:
        prev, curr = months[-2]["sales"], months[-1]["sales"]
        if prev > 0:
            change = (curr - prev) / prev * 100
            if change > 10:
                trend = "growing"
            elif change < -10:
                trend = "declining"
            data["change_percent"] = round(change, 1)
    data["trend"] = trend
    return data


async def get_top_products(user_id: str, limit: int = 5) -> dict[str, Any]:
    invs = await _active_invoices(user_id)
    tally: dict[str, dict[str, float]] = {}
    for inv in invs:
        for item in inv.get("line_items", []):
            name = item.get("description") or "Unknown"
            row = tally.setdefault(name, {"qty": 0, "amount": 0})
            row["qty"] += float(item.get("quantity", 0))
            row["amount"] += float(item.get("amount", 0) or (float(item.get("quantity", 0)) * float(item.get("unit_price", 0))))
    ranked = sorted(tally.items(), key=lambda x: x[1]["amount"], reverse=True)[:limit]
    return {"top_products": [{"name": n, "quantity_sold": round(v["qty"], 2), "revenue": round(v["amount"], 2)} for n, v in ranked]}


async def get_low_stock_products(user_id: str) -> dict[str, Any]:
    products = await db.products.find({"user_id": user_id}, {"_id": 0}).to_list(2000)
    low = [
        {"name": p.get("name"), "stock": p.get("stock_quantity", 0), "threshold": p.get("low_stock_threshold", 10), "unit": p.get("unit", "pc")}
        for p in products
        if p.get("stock_quantity", 0) <= p.get("low_stock_threshold", 10)
    ]
    return {"count": len(low), "products": low}


async def get_fast_moving_products(user_id: str) -> dict[str, Any]:
    top = await get_top_products(user_id, limit=5)
    return {"fast_moving": top["top_products"]}


async def get_slow_moving_products(user_id: str) -> dict[str, Any]:
    invs = await _active_invoices(user_id)
    sold: dict[str, float] = {}
    for inv in invs:
        for item in inv.get("line_items", []):
            name = item.get("description") or ""
            sold[name.lower()] = sold.get(name.lower(), 0) + float(item.get("quantity", 0))
    products = await db.products.find({"user_id": user_id}, {"_id": 0}).to_list(2000)
    slow = []
    for p in products:
        q = sold.get((p.get("name") or "").lower(), 0)
        if q == 0:
            slow.append({"name": p.get("name"), "stock": p.get("stock_quantity", 0), "sold": q})
    return {"count": len(slow), "slow_moving": slow[:10]}


async def get_pending_payments(user_id: str) -> dict[str, Any]:
    invs = await db.invoices.find(
        {"user_id": user_id, "status": {"$ne": "cancelled"}, "payment_status": {"$ne": "paid"}},
        {"_id": 0},
    ).to_list(2000)
    items = [
        {
            "invoice_number": i.get("invoice_number"),
            "customer": (i.get("buyer_details") or {}).get("company_name", ""),
            "balance_due": round(i.get("balance_due", i.get("total_amount", 0)), 2),
            "invoice_date": i.get("invoice_date"),
        }
        for i in invs
    ]
    items.sort(key=lambda x: x["balance_due"], reverse=True)
    total = sum(i["balance_due"] for i in items)
    return {"count": len(items), "total_outstanding": round(total, 2), "pending": items[:15]}


async def get_overdue_payments(user_id: str, days: int = 15) -> dict[str, Any]:
    cutoff = (date.today() - timedelta(days=days)).isoformat()
    data = await get_pending_payments(user_id)
    overdue = [p for p in data["pending"] if p.get("invoice_date", "") and p["invoice_date"] < cutoff]
    return {"count": len(overdue), "overdue": overdue, "overdue_after_days": days}


async def get_payments_received_today(user_id: str) -> dict[str, Any]:
    today = _today_str()
    pays = await db.payments.find(
        {"user_id": user_id, "payment_date": today, "status": "successful"}, {"_id": 0}
    ).to_list(1000)
    total = sum(p.get("amount", 0) for p in pays)
    return {"date": today, "count": len(pays), "total_received": round(total, 2)}


async def get_top_customers(user_id: str, limit: int = 5) -> dict[str, Any]:
    invs = await _active_invoices(user_id)
    tally: dict[str, float] = {}
    for inv in invs:
        name = (inv.get("buyer_details") or {}).get("company_name", "") or "Unknown"
        tally[name] = tally.get(name, 0) + inv.get("total_amount", 0)
    ranked = sorted(tally.items(), key=lambda x: x[1], reverse=True)[:limit]
    return {"top_customers": [{"name": n, "total_business": round(v, 2)} for n, v in ranked]}


async def get_inactive_customers(user_id: str, days: int = 60) -> dict[str, Any]:
    cutoff = (date.today() - timedelta(days=days)).isoformat()
    customers = await db.customers.find({"user_id": user_id}, {"_id": 0}).to_list(2000)
    invs = await _active_invoices(user_id)
    last_seen: dict[str, str] = {}
    for inv in invs:
        name = (inv.get("buyer_details") or {}).get("company_name", "")
        d = inv.get("invoice_date", "")
        if name and d > last_seen.get(name, ""):
            last_seen[name] = d
    inactive = []
    for c in customers:
        name = c.get("company_name")
        seen = last_seen.get(name, "")
        if not seen or seen < cutoff:
            inactive.append({"name": name, "last_purchase": seen or "never", "phone": c.get("phone", "")})
    return {"count": len(inactive), "inactive_customers": inactive[:15], "inactive_after_days": days}


async def get_customer_summary(user_id: str) -> dict[str, Any]:
    count = await db.customers.count_documents({"user_id": user_id})
    return {"total_customers": count}


async def get_recent_invoices(user_id: str, limit: int = 5) -> dict[str, Any]:
    invs = await db.invoices.find({"user_id": user_id}, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return {"recent_invoices": [
        {"invoice_number": i.get("invoice_number"), "customer": (i.get("buyer_details") or {}).get("company_name", ""),
         "total": i.get("total_amount", 0), "status": i.get("payment_status"), "date": i.get("invoice_date")}
        for i in invs
    ]}


async def get_recent_quotations(user_id: str, limit: int = 5) -> dict[str, Any]:
    quos = await db.quotations.find({"user_id": user_id}, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return {"recent_quotations": [
        {"quotation_number": q.get("quotation_number"), "customer": (q.get("buyer_details") or {}).get("company_name", ""),
         "total": q.get("total_amount", 0), "status": q.get("status"), "date": q.get("quotation_date")}
        for q in quos
    ]}


async def get_inventory_summary(user_id: str) -> dict[str, Any]:
    products = await db.products.find({"user_id": user_id}, {"_id": 0}).to_list(2000)
    stock_value = sum(float(p.get("unit_price", 0)) * float(p.get("stock_quantity", 0)) for p in products)
    low = sum(1 for p in products if p.get("stock_quantity", 0) <= p.get("low_stock_threshold", 10))
    return {"total_products": len(products), "low_stock_count": low, "stock_value": round(stock_value, 2)}


async def find_customer(user_id: str, query: str) -> dict[str, Any]:
    customers = await db.customers.find(
        {"user_id": user_id, "company_name": {"$regex": query, "$options": "i"}}, {"_id": 0}
    ).to_list(10)
    return {"matches": [{"name": c.get("company_name"), "phone": c.get("phone"), "gstin": c.get("gstin_number"), "id": c.get("id")} for c in customers]}


async def find_product(user_id: str, query: str) -> dict[str, Any]:
    products = await db.products.find(
        {"user_id": user_id, "name": {"$regex": query, "$options": "i"}}, {"_id": 0}
    ).to_list(10)
    return {"matches": [{"name": p.get("name"), "price": p.get("unit_price"), "stock": p.get("stock_quantity"), "id": p.get("id")} for p in products]}


async def get_business_alerts(user_id: str) -> dict[str, Any]:
    alerts: list[dict[str, Any]] = []
    low = await get_low_stock_products(user_id)
    if low["count"] > 0:
        alerts.append({"type": "low_stock", "severity": "warning",
                       "message": f"{low['count']} product(s) are low on stock", "count": low["count"]})
    pending = await get_pending_payments(user_id)
    if pending["total_outstanding"] > 0:
        alerts.append({"type": "pending_payments", "severity": "info",
                       "message": f"Rs.{pending['total_outstanding']:.0f} outstanding across {pending['count']} invoice(s)",
                       "amount": pending["total_outstanding"]})
    overdue = await get_overdue_payments(user_id)
    if overdue["count"] > 0:
        alerts.append({"type": "overdue_payments", "severity": "critical",
                       "message": f"{overdue['count']} payment(s) are overdue", "count": overdue["count"]})
    trend = await get_sales_trend(user_id)
    if trend.get("trend") == "declining":
        alerts.append({"type": "sales_decline", "severity": "warning",
                       "message": "Sales are declining compared to last month"})
    return {"count": len(alerts), "alerts": alerts}


async def get_business_summary(user_id: str) -> dict[str, Any]:
    """A compact snapshot the AI can reason over for any general question."""
    sales = await get_sales_summary(user_id)
    today = await get_today_sales(user_id)
    pending = await get_pending_payments(user_id)
    inv = await get_inventory_summary(user_id)
    cust = await get_customer_summary(user_id)
    top_p = await get_top_products(user_id, 3)
    top_c = await get_top_customers(user_id, 3)
    trend = await get_sales_trend(user_id)
    low = await get_low_stock_products(user_id)
    return {
        "today_sales": today,
        "sales_summary": sales,
        "sales_trend": {"trend": trend.get("trend"), "change_percent": trend.get("change_percent")},
        "pending_payments": {"count": pending["count"], "total_outstanding": pending["total_outstanding"], "top": pending["pending"][:5]},
        "inventory": inv,
        "low_stock_products": low["products"][:5],
        "customers": cust,
        "top_products": top_p["top_products"],
        "top_customers": top_c["top_customers"],
    }
