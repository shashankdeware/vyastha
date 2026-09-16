"""Vyastha NEW features tests: subscription/plans, AI Ask Vyastha, admin panel, notifications, integrations."""
import uuid
import requests
import pytest

from conftest import BASE_URL


# ---------- helpers ----------
def _register(anon):
    email = f"TEST_new_{uuid.uuid4().hex[:8]}@qatest-vyastha.com"
    r = anon.post(f"{BASE_URL}/api/auth/register", json={
        "email": email, "password": "Testpass123!", "name": "TEST NF", "company_name": "TEST NF Co"})
    assert r.status_code == 200, r.text
    return r.json(), email


def _sess(token):
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json", "Authorization": f"Bearer {token}"})
    return s


@pytest.fixture(scope="module")
def new_user(anon=None):
    a = requests.Session()
    a.headers.update({"Content-Type": "application/json"})
    data, email = _register(a)
    return {"token": data["token"], "user": data["user"], "email": email, "session": _sess(data["token"])}


@pytest.fixture(scope="module")
def admin_client():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "admin@vyastha.com", "password": "adminpassword123"}, timeout=30)
    assert r.status_code == 200, f"Admin login failed: {r.text[:200]}"
    return _sess(r.json()["token"])


# ---------- Plans ----------
class TestPlans:
    def test_plans_public(self):
        r = requests.get(f"{BASE_URL}/api/plans")
        assert r.status_code == 200, r.text
        plans = r.json()
        slugs = {p["slug"]: p for p in plans}
        assert "free" in slugs and "pro" in slugs, f"Missing plans: {slugs.keys()}"
        pro = slugs["pro"]
        assert pro["monthly_price"] == 49
        assert pro["yearly_price"] == 499
        assert pro["trial_days"] == 90
        assert "_id" not in pro


# ---------- Subscription lifecycle ----------
class TestSubscription:
    def test_new_user_gets_pro_trial(self, new_user):
        r = new_user["session"].get(f"{BASE_URL}/api/subscription")
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["is_trial"] is True
        assert d["entitlements"]["plan_slug"] == "pro"
        sub = d["subscription"]
        assert sub and sub["status"] == "trialing"
        assert sub["plan_slug"] == "pro"
        # ~90 days trial, allow small margin
        assert 85 <= d["days_left"] <= 91, f"days_left={d['days_left']}"
        assert "_id" not in sub

    def test_entitlements_include_ai(self, new_user):
        r = new_user["session"].get(f"{BASE_URL}/api/entitlements")
        assert r.status_code == 200, r.text
        ent = r.json()
        assert ent["features"].get("ai_business_assistant") is True

    def test_checkout_creates_stripe_session(self, new_user):
        r = new_user["session"].post(f"{BASE_URL}/api/subscription/checkout", json={
            "plan_slug": "pro", "billing_cycle": "yearly",
            "origin_url": "https://vyastha-dev.preview.emergentagent.com"})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["checkout_url"].startswith("https://"), d
        assert "stripe.com" in d["checkout_url"] or "checkout" in d["checkout_url"]
        assert d["session_id"]
        assert d["amount"] == 499
        # status check returns pending
        s = new_user["session"].get(f"{BASE_URL}/api/subscription/status/{d['session_id']}")
        assert s.status_code == 200, s.text
        js = s.json()
        assert js["session_id"] == d["session_id"]
        assert js["payment_status"] in ("pending", "unpaid", "no_payment_required", None)

    def test_checkout_invalid_plan(self, new_user):
        r = new_user["session"].post(f"{BASE_URL}/api/subscription/checkout", json={
            "plan_slug": "nonexistent", "billing_cycle": "monthly", "origin_url": "https://x.example"})
        assert r.status_code == 404

    def test_checkout_invalid_cycle(self, new_user):
        r = new_user["session"].post(f"{BASE_URL}/api/subscription/checkout", json={
            "plan_slug": "pro", "billing_cycle": "weekly", "origin_url": "https://x.example"})
        assert r.status_code == 422

    def test_status_unknown_session(self, new_user):
        r = new_user["session"].get(f"{BASE_URL}/api/subscription/status/does-not-exist-xyz")
        assert r.status_code == 404


# ---------- AI Ask Vyastha ----------
class TestAskVyastha:
    def test_suggestions(self, new_user):
        r = new_user["session"].get(f"{BASE_URL}/api/ai/suggestions")
        assert r.status_code == 200, r.text
        d = r.json()
        # greeting + suggested categories
        assert isinstance(d, dict)
        # be flexible: check for common keys
        assert any(k in d for k in ("greeting", "welcome", "message"))
        assert any(k in d for k in ("suggestions", "categories", "questions"))

    def test_ai_alerts(self, new_user):
        r = new_user["session"].get(f"{BASE_URL}/api/ai/alerts")
        assert r.status_code == 200, r.text
        d = r.json()
        assert "alerts" in d and isinstance(d["alerts"], list)

    def test_ai_ask_returns_reply(self, new_user):
        r = new_user["session"].post(f"{BASE_URL}/api/ai/ask", json={
            "question": "Aaj kitni sale hui?", "language": "hinglish"}, timeout=60)
        assert r.status_code == 200, r.text[:500]
        d = r.json()
        # AI reply should be present under some field
        text = d.get("reply") or d.get("answer") or d.get("message") or ""
        assert isinstance(text, str) and len(text.strip()) > 0, f"No AI reply in: {d}"

    def test_ai_ask_empty_question(self, new_user):
        r = new_user["session"].post(f"{BASE_URL}/api/ai/ask", json={"question": "   ", "language": "en"})
        assert r.status_code == 422

    def test_ai_requires_auth(self):
        r = requests.post(f"{BASE_URL}/api/ai/ask", json={"question": "hi"})
        assert r.status_code == 401


# ---------- Notifications & integrations ----------
class TestNotifications:
    def test_notifications_list(self, new_user):
        r = new_user["session"].get(f"{BASE_URL}/api/notifications")
        assert r.status_code == 200, r.text
        d = r.json()
        assert "count" in d and "notifications" in d
        assert isinstance(d["notifications"], list)

    def test_integrations_status(self, new_user):
        r = new_user["session"].get(f"{BASE_URL}/api/integrations/status")
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("email", "whatsapp", "payments", "ai"):
            assert k in d
            assert isinstance(d[k], bool)

    def test_notification_prefs_roundtrip(self, new_user):
        s = new_user["session"]
        r = s.get(f"{BASE_URL}/api/notification-preferences")
        assert r.status_code == 200
        upd = s.put(f"{BASE_URL}/api/notification-preferences", json={
            "in_app": True, "email": True, "whatsapp": False,
            "low_stock": False, "overdue_payments": True, "trial_expiry": True})
        assert upd.status_code == 200, upd.text
        after = s.get(f"{BASE_URL}/api/notification-preferences").json()
        assert after["email"] is True
        assert after["low_stock"] is False


# ---------- Admin panel ----------
class TestAdmin:
    def test_admin_stats(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/admin/stats")
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("total_users", "total_businesses", "active_subscriptions", "trialing",
                  "revenue_total", "plan_counts", "status_counts"):
            assert k in d

    def test_admin_users(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/admin/users")
        assert r.status_code == 200
        users = r.json()
        assert isinstance(users, list) and len(users) >= 1
        for u in users[:5]:
            assert "password_hash" not in u
            assert "_id" not in u

    def test_admin_plans(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/admin/plans")
        assert r.status_code == 200
        plans = r.json()
        assert any(p["slug"] == "pro" for p in plans)

    def test_admin_update_plan(self, admin_client):
        # get original
        plans = admin_client.get(f"{BASE_URL}/api/admin/plans").json()
        pro = next(p for p in plans if p["slug"] == "pro")
        orig = pro["monthly_price"]
        # update
        r = admin_client.put(f"{BASE_URL}/api/admin/plans/pro", json={"monthly_price": 99})
        assert r.status_code == 200, r.text
        assert r.json()["monthly_price"] == 99
        # verify persistence
        again = admin_client.get(f"{BASE_URL}/api/admin/plans").json()
        pro2 = next(p for p in again if p["slug"] == "pro")
        assert pro2["monthly_price"] == 99
        # revert
        admin_client.put(f"{BASE_URL}/api/admin/plans/pro", json={"monthly_price": orig})
        assert admin_client.get(f"{BASE_URL}/api/admin/plans").json()
        final = next(p for p in admin_client.get(f"{BASE_URL}/api/admin/plans").json() if p["slug"] == "pro")
        assert final["monthly_price"] == orig

    def test_admin_update_unknown_plan(self, admin_client):
        r = admin_client.put(f"{BASE_URL}/api/admin/plans/no-such", json={"monthly_price": 10})
        assert r.status_code == 404

    def test_admin_audit_logs(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/admin/audit-logs")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_non_admin_forbidden(self, new_user):
        for path in ("/api/admin/stats", "/api/admin/users",
                     "/api/admin/plans", "/api/admin/audit-logs"):
            r = new_user["session"].get(f"{BASE_URL}{path}")
            assert r.status_code == 403, f"{path} returned {r.status_code}"


# ---------- E2E: existing invoice math + GST split ----------
class TestInvoiceGSTSplit:
    def test_intrastate_cgst_sgst(self, new_user):
        s = new_user["session"]
        # Ensure seller has a state_code
        prof = s.get(f"{BASE_URL}/api/company-profile").json()
        prof["state_code"] = "27"
        s.put(f"{BASE_URL}/api/company-profile", json=prof)
        r = s.post(f"{BASE_URL}/api/invoices", json={
            "seller_details": {"state_code": "27"},
            "buyer_details": {"company_name": "TEST_Intra", "state_code": "27",
                              "gstin_number": "27AAAAA0000A1Z5"},
            "line_items": [{"description": "X", "quantity": 1, "unit_price": 1000.0}],
            "tax_rate": 18.0, "status": "finalized", "auto_deduct_inventory": False})
        assert r.status_code in (200, 201), r.text
        inv = r.json()
        # Same-state -> CGST + SGST, IGST 0
        assert inv.get("cgst_amount", 0) + inv.get("sgst_amount", 0) == pytest.approx(180.0, rel=0.02)
        assert inv.get("igst_amount", 0) in (0, 0.0)
        assert inv.get("amount_in_words"), "amount_in_words missing"
        s.delete(f"{BASE_URL}/api/invoices/{inv['id']}")

    def test_interstate_igst(self, new_user):
        s = new_user["session"]
        r = s.post(f"{BASE_URL}/api/invoices", json={
            "seller_details": {"state_code": "27"},
            "buyer_details": {"company_name": "TEST_Inter", "state_code": "29",
                              "gstin_number": "29AAAAA0000A1Z5"},
            "line_items": [{"description": "X", "quantity": 1, "unit_price": 1000.0}],
            "tax_rate": 18.0, "status": "finalized", "auto_deduct_inventory": False})
        assert r.status_code in (200, 201), r.text
        inv = r.json()
        assert inv.get("igst_amount", 0) == pytest.approx(180.0, rel=0.02)
        assert (inv.get("cgst_amount", 0) + inv.get("sgst_amount", 0)) in (0, 0.0)
        s.delete(f"{BASE_URL}/api/invoices/{inv['id']}")
