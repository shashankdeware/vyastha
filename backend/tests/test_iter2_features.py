"""Iteration-2 backend tests: WhatsApp reminders, subscription receipts, analytics, AI invoice draft."""
import uuid
import requests
import pytest

from conftest import BASE_URL


def _register():
    email = f"TEST_iter2_{uuid.uuid4().hex[:8]}@qatest-vyastha.com"
    r = requests.post(f"{BASE_URL}/api/auth/register", json={
        "email": email, "password": "Testpass123!", "name": "TEST Iter2",
        "company_name": "TEST Iter2 Co"}, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()["token"]


def _sess(token):
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json", "Authorization": f"Bearer {token}"})
    return s


@pytest.fixture(scope="module")
def user():
    tok = _register()
    s = _sess(tok)
    # ensure state_code so invoice math works
    prof = s.get(f"{BASE_URL}/api/company-profile").json()
    prof["state_code"] = "27"
    prof.setdefault("company_name", "TEST Iter2 Co")
    s.put(f"{BASE_URL}/api/company-profile", json=prof)
    # customer
    c = s.post(f"{BASE_URL}/api/customers", json={
        "company_name": "Ramesh Traders", "phone": "9876543210",
        "gstin_number": "", "email": "ramesh@example.com", "address": "Mumbai"}).json()
    # product (chair @ 500)
    p = s.post(f"{BASE_URL}/api/products", json={
        "name": "chair", "unit_price": 500, "stock_quantity": 100,
        "low_stock_threshold": 5}).json()
    # unpaid finalized invoice
    inv = s.post(f"{BASE_URL}/api/invoices", json={
        "seller_details": {"state_code": "27"},
        "buyer_details": {"company_name": "Ramesh Traders", "phone": "9876543210",
                          "state_code": "27"},
        "line_items": [{"description": "chair", "quantity": 5, "unit_price": 500.0}],
        "tax_rate": 18.0, "status": "finalized", "auto_deduct_inventory": False}).json()
    return {"session": s, "customer": c, "product": p, "invoice": inv}


class TestReminders:
    def test_pending_returns_invoice(self, user):
        r = user["session"].get(f"{BASE_URL}/api/reminders/pending")
        assert r.status_code == 200, r.text
        d = r.json()
        assert "reminders" in d and "total_outstanding" in d
        inv_no = user["invoice"]["invoice_number"]
        match = [x for x in d["reminders"] if x["invoice_number"] == inv_no]
        assert match, f"pending invoice {inv_no} missing from {d}"
        m = match[0]
        assert m["has_phone"] is True
        assert m["whatsapp_url"].startswith("https://wa.me/91")
        assert inv_no in m["message"]
        # amount formatted somewhere
        assert "pending" in m["message"].lower()
        assert d["total_outstanding"] >= m["balance_due"] > 0


class TestSubscriptionReceipts:
    def test_empty_receipts_ok(self, user):
        r = user["session"].get(f"{BASE_URL}/api/subscription/receipts")
        assert r.status_code == 200, r.text
        d = r.json()
        assert "receipts" in d and isinstance(d["receipts"], list)
        # New user has never paid; may be empty. If non-empty, check shape.
        for rc in d["receipts"]:
            for k in ("receipt_number", "taxable_value", "cgst", "sgst", "gst_amount", "amount"):
                assert k in rc


class TestAnalytics:
    def test_overview_shape(self, user):
        r = user["session"].get(f"{BASE_URL}/api/analytics/overview")
        assert r.status_code == 200, r.text
        d = r.json()
        assert isinstance(d["monthly"], list) and len(d["monthly"]) == 6
        for m in d["monthly"]:
            for k in ("month", "sales", "collected"):
                assert k in m
        assert "payment_breakdown" in d
        assert "top_products" in d
        assert "totals" in d
        for k in ("total_sales", "total_collected", "outstanding", "invoice_count"):
            assert k in d["totals"]
        # invoice we created should push total_sales > 0
        assert d["totals"]["total_sales"] > 0
        assert d["totals"]["invoice_count"] >= 1


class TestAIInvoiceDraft:
    def test_ai_ask_returns_invoice_draft(self, user):
        r = user["session"].post(f"{BASE_URL}/api/ai/ask", json={
            "question": "Ramesh Traders ke liye 5 chair ka invoice banao 500 rupaye each",
            "language": "hinglish"}, timeout=90)
        assert r.status_code == 200, r.text[:500]
        d = r.json()
        sa = d.get("suggested_action")
        assert sa is not None, f"No suggested_action in {d}"
        assert sa.get("type") == "invoice_draft", f"type={sa.get('type')} full={sa}"
        draft = sa.get("draft") or {}
        assert draft.get("buyer", {}).get("company_name"), draft
        items = draft.get("line_items") or []
        assert items, draft
        it = items[0]
        for k in ("description", "quantity", "unit_price"):
            assert k in it
