"""Vyastha backend API tests - auth, company profile, customers, products/inventory,
invoices (auto-calc + stock deduct + UPI QR), quotations + conversion, drafts, payments, dashboard."""
import time
import uuid
from datetime import date

import pytest
import requests

from conftest import BASE_URL

TODAY = date.today().isoformat()


# ---------- Auth module ----------
class TestAuth:
    def test_demo_login(self, anon):
        r = anon.post(f"{BASE_URL}/api/auth/demo-login")
        assert r.status_code == 200, r.text
        d = r.json()
        assert isinstance(d.get("token"), str) and len(d["token"]) > 20
        assert d["user"]["email"] == "demo@vyastha.com"

    def test_login_with_documented_credentials(self, anon, test_credentials):
        r = anon.post(f"{BASE_URL}/api/auth/login", json={
            "email": test_credentials["email"], "password": test_credentials["password"]})
        assert r.status_code == 200, f"Login failed for {test_credentials['email']}: {r.text[:300]}"
        assert r.json()["user"]["email"] == test_credentials["email"].lower()

    def test_login_demo_credentials(self, anon):
        r = anon.post(f"{BASE_URL}/api/auth/login", json={
            "email": "demo@vyastha.com", "password": "demopassword123"})
        assert r.status_code == 200, r.text
        assert "token" in r.json()

    def test_login_httponly_cookie_set(self, anon):
        r = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "demo@vyastha.com", "password": "demopassword123"})
        assert r.status_code == 200
        raw = r.headers.get("set-cookie", "")
        assert "access_token" in raw, f"No access_token cookie: {raw}"
        assert "HttpOnly" in raw or "httponly" in raw

    def test_login_bad_password(self, anon):
        r = anon.post(f"{BASE_URL}/api/auth/login", json={
            "email": "demo@vyastha.com", "password": "wrongpass"})
        assert r.status_code == 401
        assert "detail" in r.json()

    def test_register_duplicate_email(self, anon):
        r = anon.post(f"{BASE_URL}/api/auth/register", json={
            "email": "demo@vyastha.com", "password": "x12345678", "name": "Dup"})
        assert r.status_code == 400

    def test_register_new_user(self, anon):
        email = f"TEST_{uuid.uuid4().hex[:8]}@qatest-vyastha.com"
        r = anon.post(f"{BASE_URL}/api/auth/register", json={
            "email": email, "password": "Testpass123!", "name": "TEST User", "company_name": "TEST Co"})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["user"]["email"] == email.lower()
        # profile auto-created for new user
        s = requests.Session()
        s.headers.update({"Authorization": f"Bearer {d['token']}"})
        prof = s.get(f"{BASE_URL}/api/company-profile")
        assert prof.status_code == 200
        assert "_id" not in prof.json()

    def test_me_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 401

    def test_me_with_token(self, client):
        r = client.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 200
        assert r.json()["email"] == "demo@vyastha.com"

    def test_invalid_token_rejected(self):
        r = requests.get(f"{BASE_URL}/api/auth/me", headers={"Authorization": "Bearer garbage.token.here"})
        assert r.status_code == 401

    def test_brute_force_lockout(self, anon):
        """Playbook requirement: lockout after 5 failed attempts."""
        email = f"TEST_bf_{uuid.uuid4().hex[:6]}@qatest-vyastha.com"
        anon.post(f"{BASE_URL}/api/auth/register", json={
            "email": email, "password": "Correct123!", "name": "BF"})
        codes = []
        for _ in range(6):
            codes.append(anon.post(f"{BASE_URL}/api/auth/login",
                                   json={"email": email, "password": "bad"}).status_code)
        assert 423 in codes or 429 in codes, f"No lockout after 6 failures, codes={codes}"

    def test_bcrypt_hash_format(self):
        import asyncio, os
        from motor.motor_asyncio import AsyncIOMotorClient
        from dotenv import dotenv_values
        env = dotenv_values("/app/backend/.env")
        mongo = env.get("MONGO_URL") or os.environ.get("MONGO_URL")
        dbname = env.get("DB_NAME") or os.environ.get("DB_NAME")

        async def check():
            c = AsyncIOMotorClient(mongo)
            u = await c[dbname].users.find_one({"email": "demo@vyastha.com"})
            c.close()
            return u
        u = asyncio.get_event_loop().run_until_complete(check()) if False else asyncio.run(check())
        assert u is not None
        assert u["password_hash"].startswith("$2b$"), f"Bad hash prefix: {u['password_hash'][:6]}"


# ---------- Company profile module ----------
class TestCompanyProfile:
    def test_get_profile(self, client):
        r = client.get(f"{BASE_URL}/api/company-profile")
        assert r.status_code == 200, r.text
        d = r.json()
        assert "_id" not in d
        assert "bank_details" in d and "upi_id" in d["bank_details"]

    def test_update_profile_persists(self, client):
        orig = client.get(f"{BASE_URL}/api/company-profile").json()
        payload = dict(orig)
        payload["tagline"] = "TEST_tagline_x"
        payload["bank_details"] = dict(orig.get("bank_details", {}))
        payload["bank_details"]["upi_id"] = "testvyastha@okaxis"
        r = client.put(f"{BASE_URL}/api/company-profile", json=payload)
        assert r.status_code == 200, r.text
        got = client.get(f"{BASE_URL}/api/company-profile").json()
        assert got["tagline"] == "TEST_tagline_x"
        assert got["bank_details"]["upi_id"] == "testvyastha@okaxis"
        # restore
        client.put(f"{BASE_URL}/api/company-profile", json=orig)


# ---------- Customers CRUD ----------
class TestCustomers:
    created = []

    def test_customer_crud(self, client):
        payload = {"company_name": "TEST_Customer Pvt Ltd", "contact_person": "QA Bot",
                   "gstin_number": "27AAAAA0000A1Z5", "pan_number": "AAAAA0000A",
                   "phone": "9999999999", "email": "qa@test.com", "address": "Test Addr"}
        r = client.post(f"{BASE_URL}/api/customers", json=payload)
        assert r.status_code in (200, 201), r.text
        c = r.json()
        assert "_id" not in c
        cid = c["id"]
        TestCustomers.created.append(cid)
        assert c["company_name"] == payload["company_name"]
        assert c["gstin_number"] == payload["gstin_number"]

        lst = client.get(f"{BASE_URL}/api/customers")
        assert lst.status_code == 200
        assert any(x["id"] == cid for x in lst.json())

        upd = client.put(f"{BASE_URL}/api/customers/{cid}", json={**payload, "phone": "8888888888"})
        assert upd.status_code == 200, upd.text
        again = [x for x in client.get(f"{BASE_URL}/api/customers").json() if x["id"] == cid][0]
        assert again["phone"] == "8888888888"

        dele = client.delete(f"{BASE_URL}/api/customers/{cid}")
        assert dele.status_code in (200, 204)
        assert not any(x["id"] == cid for x in client.get(f"{BASE_URL}/api/customers").json())
        TestCustomers.created.remove(cid)

    def test_update_nonexistent_customer(self, client):
        r = client.put(f"{BASE_URL}/api/customers/{uuid.uuid4()}", json={"company_name": "x"})
        assert r.status_code == 404, f"Expected 404, got {r.status_code}"


# ---------- Products & Inventory ----------
class TestInventory:
    def _new_product(self, client, **kw):
        payload = {"name": f"TEST_Prod_{uuid.uuid4().hex[:6]}", "sku": f"TEST-{uuid.uuid4().hex[:5]}",
                   "category": "TEST", "unit": "pc", "unit_price": 100.0,
                   "stock_quantity": 50, "low_stock_threshold": 5}
        payload.update(kw)
        r = client.post(f"{BASE_URL}/api/products", json=payload)
        assert r.status_code in (200, 201), r.text
        return r.json()

    def test_create_product_and_opening_stock_txn(self, client):
        p = self._new_product(client)
        assert "_id" not in p
        assert p["stock_quantity"] == 50
        txns = client.get(f"{BASE_URL}/api/inventory/transactions").json()
        assert any(t["product_id"] == p["id"] and t["type"] == "IN_INITIAL" for t in txns), \
            "No opening balance transaction logged"
        client.delete(f"{BASE_URL}/api/products/{p['id']}")

    def test_adjust_stock_in_out(self, client):
        p = self._new_product(client, stock_quantity=20)
        r = client.post(f"{BASE_URL}/api/products/{p['id']}/adjust-stock",
                        json={"quantity": 10, "type": "IN", "reason": "TEST in"})
        assert r.status_code == 200, r.text
        assert r.json()["new_stock"] == 30
        r2 = client.post(f"{BASE_URL}/api/products/{p['id']}/adjust-stock",
                         json={"quantity": 5, "type": "OUT", "reason": "TEST out"})
        assert r2.status_code == 200
        assert r2.json()["new_stock"] == 25
        fetched = [x for x in client.get(f"{BASE_URL}/api/products").json() if x["id"] == p["id"]][0]
        assert fetched["stock_quantity"] == 25
        txns = client.get(f"{BASE_URL}/api/inventory/transactions").json()
        mine = [t for t in txns if t["product_id"] == p["id"]]
        assert any(t["type"] == "OUT" and t["quantity"] == -5 for t in mine)
        client.delete(f"{BASE_URL}/api/products/{p['id']}")

    def test_adjust_stock_nonexistent(self, client):
        r = client.post(f"{BASE_URL}/api/products/{uuid.uuid4()}/adjust-stock",
                        json={"quantity": 1, "type": "IN"})
        assert r.status_code == 404

    def test_low_stock_alerts(self, client):
        p = self._new_product(client, stock_quantity=2, low_stock_threshold=10)
        r = client.get(f"{BASE_URL}/api/inventory/alerts")
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["count"] >= 1
        assert any(i["id"] == p["id"] for i in d["items"]), "Low-stock product missing from alerts"
        client.delete(f"{BASE_URL}/api/products/{p['id']}")

    def test_update_product(self, client):
        p = self._new_product(client)
        r = client.put(f"{BASE_URL}/api/products/{p['id']}",
                       json={"name": p["name"], "unit_price": 250.5, "stock_quantity": 77,
                             "low_stock_threshold": 3})
        assert r.status_code == 200, r.text
        assert r.json()["unit_price"] == 250.5
        got = [x for x in client.get(f"{BASE_URL}/api/products").json() if x["id"] == p["id"]][0]
        assert got["stock_quantity"] == 77
        client.delete(f"{BASE_URL}/api/products/{p['id']}")

    def test_delete_nonexistent_product(self, client):
        r = client.delete(f"{BASE_URL}/api/products/{uuid.uuid4()}")
        # documenting behaviour: should ideally be 404
        assert r.status_code in (200, 204, 404)


# ---------- Invoices: calc integrity, UPI QR, stock deduction ----------
class TestInvoices:
    def test_invoice_autocalc_and_upi_qr(self, client):
        profile = client.get(f"{BASE_URL}/api/company-profile").json()
        payload = {
            "buyer_details": {"company_name": "TEST_Buyer Auto Calc", "gstin_number": "27ZZZZZ0000Z1Z5"},
            "line_items": [
                {"description": "Item A", "quantity": 3, "unit_price": 100.0},
                {"description": "Item B", "quantity": 2, "unit_price": 250.0},
            ],
            "tax_rate": 18.0, "discount_type": "percentage", "discount_value": 10.0,
            "status": "finalized", "auto_deduct_inventory": False,
        }
        r = client.post(f"{BASE_URL}/api/invoices", json=payload)
        assert r.status_code in (200, 201), r.text
        inv = r.json()
        assert "_id" not in inv
        # subtotal 300 + 500 = 800; disc 10% = 80; taxable 720; tax 129.6; total 849.6
        assert inv["subtotal"] == 800.0
        assert inv["discount_amount"] == 80.0
        assert inv["tax_amount"] == 129.6
        assert inv["total_amount"] == 849.6
        assert inv["balance_due"] == 849.6
        assert inv["invoice_number"].startswith(profile.get("invoice_prefix", "INV"))
        qr = inv["upi_qr_data"]
        assert qr.startswith("upi://pay?pa="), qr
        assert "&am=849.60" in qr, qr
        assert "&cu=INR" in qr
        # persistence
        got = client.get(f"{BASE_URL}/api/invoices/{inv['id']}")
        assert got.status_code == 200
        assert got.json()["total_amount"] == 849.6
        client.delete(f"{BASE_URL}/api/invoices/{inv['id']}")

    def test_invoice_ignores_client_supplied_totals(self, client):
        r = client.post(f"{BASE_URL}/api/invoices", json={
            "buyer_details": {"company_name": "TEST_Tamper"},
            "line_items": [{"description": "X", "quantity": 1, "unit_price": 1000.0}],
            "tax_rate": 0, "total_amount": 1.0, "subtotal": 1.0,
            "status": "finalized", "auto_deduct_inventory": False})
        assert r.status_code in (200, 201), r.text
        assert r.json()["total_amount"] == 1000.0, "Server trusted client total"
        client.delete(f"{BASE_URL}/api/invoices/{r.json()['id']}")

    def test_invoice_stock_auto_deduct(self, client):
        prod = client.post(f"{BASE_URL}/api/products", json={
            "name": f"TEST_StockProd_{uuid.uuid4().hex[:6]}", "unit_price": 500.0,
            "stock_quantity": 30, "low_stock_threshold": 2}).json()
        r = client.post(f"{BASE_URL}/api/invoices", json={
            "buyer_details": {"company_name": "TEST_Buyer Stock"},
            "line_items": [{"product_id": prod["id"], "description": prod["name"],
                            "quantity": 4, "unit_price": 500.0}],
            "status": "finalized", "auto_deduct_inventory": True})
        assert r.status_code in (200, 201), r.text
        inv = r.json()
        after = [x for x in client.get(f"{BASE_URL}/api/products").json() if x["id"] == prod["id"]][0]
        assert after["stock_quantity"] == 26, f"Expected 26 got {after['stock_quantity']}"
        txns = client.get(f"{BASE_URL}/api/inventory/transactions").json()
        out = [t for t in txns if t["product_id"] == prod["id"] and t["type"] == "OUT_INVOICE"]
        assert out and out[0]["quantity"] == -4
        assert out[0]["reference"] == inv["invoice_number"]
        client.delete(f"{BASE_URL}/api/invoices/{inv['id']}")
        client.delete(f"{BASE_URL}/api/products/{prod['id']}")

    def test_draft_invoice_does_not_deduct_then_finalize_deducts(self, client):
        prod = client.post(f"{BASE_URL}/api/products", json={
            "name": f"TEST_DraftProd_{uuid.uuid4().hex[:6]}", "unit_price": 100.0,
            "stock_quantity": 10, "low_stock_threshold": 1}).json()
        items = [{"product_id": prod["id"], "description": prod["name"],
                  "quantity": 3, "unit_price": 100.0}]
        d = client.post(f"{BASE_URL}/api/invoices", json={
            "buyer_details": {"company_name": "TEST_DraftBuyer"}, "line_items": items,
            "status": "draft", "auto_deduct_inventory": True})
        assert d.status_code in (200, 201), d.text
        inv = d.json()
        mid = [x for x in client.get(f"{BASE_URL}/api/products").json() if x["id"] == prod["id"]][0]
        assert mid["stock_quantity"] == 10, "Draft should not deduct stock"

        u = client.put(f"{BASE_URL}/api/invoices/{inv['id']}", json={
            "buyer_details": inv["buyer_details"], "line_items": items,
            "seller_details": inv["seller_details"], "status": "finalized",
            "auto_deduct_inventory": True})
        assert u.status_code == 200, u.text
        after = [x for x in client.get(f"{BASE_URL}/api/products").json() if x["id"] == prod["id"]][0]
        assert after["stock_quantity"] == 7, f"Expected 7 got {after['stock_quantity']}"
        client.delete(f"{BASE_URL}/api/invoices/{inv['id']}")
        client.delete(f"{BASE_URL}/api/products/{prod['id']}")

    def test_invoice_number_uniqueness(self, client):
        nums = []
        ids = []
        for _ in range(3):
            r = client.post(f"{BASE_URL}/api/invoices", json={
                "buyer_details": {"company_name": "TEST_Seq"},
                "line_items": [{"description": "S", "quantity": 1, "unit_price": 10}],
                "status": "finalized", "auto_deduct_inventory": False})
            assert r.status_code in (200, 201), r.text
            nums.append(r.json()["invoice_number"])
            ids.append(r.json()["id"])
        assert len(set(nums)) == 3, f"Duplicate invoice numbers: {nums}"
        for i in ids:
            client.delete(f"{BASE_URL}/api/invoices/{i}")

    def test_get_invoice_404(self, client):
        r = client.get(f"{BASE_URL}/api/invoices/{uuid.uuid4()}")
        assert r.status_code == 404

    def test_invoices_require_auth(self, anon):
        assert requests.get(f"{BASE_URL}/api/invoices").status_code == 401

    def test_invoice_list_filters(self, client):
        r = client.get(f"{BASE_URL}/api/invoices", params={"status": "finalized"})
        assert r.status_code == 200
        assert all(i["status"] == "finalized" for i in r.json())


# ---------- Quotations & conversion ----------
class TestQuotations:
    def test_quotation_create_and_convert(self, client):
        prod = client.post(f"{BASE_URL}/api/products", json={
            "name": f"TEST_QuoProd_{uuid.uuid4().hex[:6]}", "unit_price": 200.0,
            "stock_quantity": 20, "low_stock_threshold": 1}).json()
        q = client.post(f"{BASE_URL}/api/quotations", json={
            "buyer_details": {"company_name": "TEST_QuoBuyer"},
            "line_items": [{"product_id": prod["id"], "description": prod["name"],
                            "quantity": 2, "unit_price": 200.0}],
            "tax_rate": 18.0, "status": "sent"})
        assert q.status_code in (200, 201), q.text
        quo = q.json()
        assert "_id" not in quo
        assert quo["subtotal"] == 400.0
        assert quo["total_amount"] == 472.0
        assert quo["quotation_number"]

        c = client.post(f"{BASE_URL}/api/quotations/{quo['id']}/convert-to-invoice")
        assert c.status_code in (200, 201), c.text
        inv = c.json()["invoice"]
        assert inv["reference_quotation_number"] == quo["quotation_number"]
        assert inv["total_amount"] == 472.0
        assert inv["status"] == "finalized"
        assert inv["upi_qr_data"].startswith("upi://pay?pa=")
        assert "&am=472.00" in inv["upi_qr_data"]
        # quotation flagged converted
        quo2 = client.get(f"{BASE_URL}/api/quotations/{quo['id']}").json()
        assert quo2["status"] == "converted"
        assert quo2.get("converted_invoice_number") == inv["invoice_number"]
        # stock deducted by conversion
        after = [x for x in client.get(f"{BASE_URL}/api/products").json() if x["id"] == prod["id"]][0]
        assert after["stock_quantity"] == 18, f"Expected 18 got {after['stock_quantity']}"
        client.delete(f"{BASE_URL}/api/invoices/{inv['id']}")
        client.delete(f"{BASE_URL}/api/quotations/{quo['id']}")
        client.delete(f"{BASE_URL}/api/products/{prod['id']}")

    def test_convert_nonexistent_quotation(self, client):
        r = client.post(f"{BASE_URL}/api/quotations/{uuid.uuid4()}/convert-to-invoice")
        assert r.status_code == 404

    def test_double_convert_quotation(self, client):
        q = client.post(f"{BASE_URL}/api/quotations", json={
            "buyer_details": {"company_name": "TEST_DoubleConv"},
            "line_items": [{"description": "D", "quantity": 1, "unit_price": 100}],
            "status": "sent"}).json()
        i1 = client.post(f"{BASE_URL}/api/quotations/{q['id']}/convert-to-invoice")
        assert i1.status_code == 200
        i2 = client.post(f"{BASE_URL}/api/quotations/{q['id']}/convert-to-invoice")
        # already converted -> should be rejected (400/409)
        client.delete(f"{BASE_URL}/api/invoices/{i1.json()['invoice']['id']}")
        if i2.status_code == 200:
            client.delete(f"{BASE_URL}/api/invoices/{i2.json()['invoice']['id']}")
        client.delete(f"{BASE_URL}/api/quotations/{q['id']}")
        assert i2.status_code in (400, 409), \
            "Already-converted quotation converted again, creating a duplicate invoice"


# ---------- Drafts module ----------
class TestDrafts:
    def test_drafts_stats(self, client):
        r = client.get(f"{BASE_URL}/api/drafts/stats")
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["max_daily_limit"] == 50
        for k in ("today_drafts_count", "remaining_drafts_today", "invoice_drafts", "quotation_drafts"):
            assert k in d

    def test_draft_appears_in_stats(self, client):
        before = client.get(f"{BASE_URL}/api/drafts/stats").json()["today_drafts_count"]
        r = client.post(f"{BASE_URL}/api/invoices", json={
            "buyer_details": {"company_name": "TEST_DraftCount"},
            "line_items": [{"description": "d", "quantity": 1, "unit_price": 5}],
            "status": "draft", "auto_deduct_inventory": False})
        assert r.status_code in (200, 201), r.text
        inv = r.json()
        after = client.get(f"{BASE_URL}/api/drafts/stats").json()
        assert after["today_drafts_count"] == before + 1
        assert any(x["id"] == inv["id"] for x in after["invoice_drafts"])
        assert after["remaining_drafts_today"] == 50 - after["today_drafts_count"]
        client.delete(f"{BASE_URL}/api/invoices/{inv['id']}")

    def test_quotation_draft_counts_toward_limit(self, client):
        before = client.get(f"{BASE_URL}/api/drafts/stats").json()["today_drafts_count"]
        q = client.post(f"{BASE_URL}/api/quotations", json={
            "buyer_details": {"company_name": "TEST_QDraft"},
            "line_items": [{"description": "q", "quantity": 1, "unit_price": 5}],
            "status": "draft"})
        assert q.status_code in (200, 201), q.text
        after = client.get(f"{BASE_URL}/api/drafts/stats").json()["today_drafts_count"]
        assert after == before + 1
        client.delete(f"{BASE_URL}/api/quotations/{q.json()['id']}")

    def test_quotation_draft_limit_enforced(self, client):
        """Backend enforces 50/day on invoice drafts; verify it also guards quotation drafts."""
        import inspect
        src = open("/app/backend/server.py").read()
        quo_fn = src.split("async def create_quotation")[1].split("@api_router")[0]
        assert "draft limit" in quo_fn.lower() or "50" in quo_fn, \
            "create_quotation does not enforce the 50 drafts/day limit"


# ---------- Payments module ----------
class TestPayments:
    def test_payments_today_and_all(self, client):
        t = client.get(f"{BASE_URL}/api/payments", params={"filter": "today"})
        assert t.status_code == 200, t.text
        assert t.json()["filter"] == "today"
        assert all(p["payment_date"] == TODAY for p in t.json()["payments"])
        a = client.get(f"{BASE_URL}/api/payments", params={"filter": "all"})
        assert a.status_code == 200
        assert a.json()["count"] >= t.json()["count"]

    def test_record_full_payment_marks_invoice_paid(self, client):
        inv = client.post(f"{BASE_URL}/api/invoices", json={
            "buyer_details": {"company_name": "TEST_PayBuyer"},
            "line_items": [{"description": "P", "quantity": 1, "unit_price": 1000.0}],
            "tax_rate": 0, "status": "finalized", "auto_deduct_inventory": False}).json()
        assert inv["total_amount"] == 1000.0
        r = client.post(f"{BASE_URL}/api/payments", json={
            "invoice_id": inv["id"], "invoice_number": inv["invoice_number"],
            "customer_name": "TEST_PayBuyer", "amount": 1000.0,
            "payment_date": TODAY, "payment_method": "UPI", "status": "successful"})
        assert r.status_code in (200, 201), r.text
        pay = r.json()
        assert "_id" not in pay
        assert pay["transaction_ref"]
        got = client.get(f"{BASE_URL}/api/invoices/{inv['id']}").json()
        assert got["payment_status"] == "paid"
        assert got["balance_due"] == 0.0
        assert got["amount_paid"] == 1000.0
        today = client.get(f"{BASE_URL}/api/payments", params={"filter": "today"}).json()
        assert any(p["id"] == pay["id"] for p in today["payments"])
        client.delete(f"{BASE_URL}/api/invoices/{inv['id']}")

    def test_partial_payment(self, client):
        inv = client.post(f"{BASE_URL}/api/invoices", json={
            "buyer_details": {"company_name": "TEST_PartialBuyer"},
            "line_items": [{"description": "P", "quantity": 1, "unit_price": 500.0}],
            "tax_rate": 0, "status": "finalized", "auto_deduct_inventory": False}).json()
        client.post(f"{BASE_URL}/api/payments", json={
            "invoice_id": inv["id"], "invoice_number": inv["invoice_number"],
            "amount": 200.0, "payment_date": TODAY, "status": "successful"})
        got = client.get(f"{BASE_URL}/api/invoices/{inv['id']}").json()
        assert got["payment_status"] == "partially_paid"
        assert got["balance_due"] == 300.0
        client.delete(f"{BASE_URL}/api/invoices/{inv['id']}")

    def test_overpayment_rejected(self, client):
        inv = client.post(f"{BASE_URL}/api/invoices", json={
            "buyer_details": {"company_name": "TEST_OverPay"},
            "line_items": [{"description": "O", "quantity": 1, "unit_price": 100.0}],
            "tax_rate": 0, "status": "finalized", "auto_deduct_inventory": False}).json()
        r = client.post(f"{BASE_URL}/api/payments", json={
            "invoice_id": inv["id"], "invoice_number": inv["invoice_number"],
            "amount": 5000.0, "payment_date": TODAY, "status": "successful"})
        client.delete(f"{BASE_URL}/api/invoices/{inv['id']}")
        assert r.status_code == 400, "Overpayment beyond invoice total accepted"

    def test_negative_payment_rejected(self, client):
        r = client.post(f"{BASE_URL}/api/payments", json={
            "invoice_number": "TEST-NEG", "amount": -100.0, "payment_date": TODAY})
        assert r.status_code in (400, 422), "Negative payment amount accepted"


# ---------- Dashboard ----------
class TestDashboard:
    def test_dashboard_stats(self, client):
        r = client.get(f"{BASE_URL}/api/dashboard/stats")
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("total_revenue", "today_collected", "total_outstanding",
                  "today_drafts_count", "max_daily_drafts", "low_stock_count",
                  "recent_invoices", "recent_payments"):
            assert k in d, f"Missing {k}"
        assert d["max_daily_drafts"] == 50
        assert all("_id" not in i for i in d["recent_invoices"])

    def test_dashboard_requires_auth(self, anon):
        assert requests.get(f"{BASE_URL}/api/dashboard/stats").status_code == 401


# ---------- Seed & multi-tenant isolation ----------
class TestSeedAndIsolation:
    def test_seed_demo_data(self, client):
        r = client.post(f"{BASE_URL}/api/seed/demo-data")
        assert r.status_code in (200, 201), r.text
        assert client.get(f"{BASE_URL}/api/products").json()

    def test_data_isolated_per_user(self, anon):
        email = f"TEST_iso_{uuid.uuid4().hex[:6]}@qatest-vyastha.com"
        tok = anon.post(f"{BASE_URL}/api/auth/register", json={
            "email": email, "password": "Iso12345!", "name": "Iso"}).json()["token"]
        s = requests.Session()
        s.headers.update({"Authorization": f"Bearer {tok}"})
        assert s.get(f"{BASE_URL}/api/invoices").json() == []
        assert s.get(f"{BASE_URL}/api/products").json() == []


# ---------- Draft daily limit (50/day) enforcement on a fresh tenant ----------
class TestDraftLimit:
    def test_51st_draft_rejected(self, anon):
        email = f"TEST_limit_{uuid.uuid4().hex[:6]}@qatest-vyastha.com"
        reg = anon.post(f"{BASE_URL}/api/auth/register", json={
            "email": email, "password": "Limit123!", "name": "Limit"})
        assert reg.status_code == 200, reg.text
        s = requests.Session()
        s.headers.update({"Authorization": f"Bearer {reg.json()['token']}"})
        payload = {"buyer_details": {"company_name": "TEST_LimitBuyer"},
                   "line_items": [{"description": "L", "quantity": 1, "unit_price": 1}],
                   "status": "draft", "auto_deduct_inventory": False}
        for i in range(50):
            r = s.post(f"{BASE_URL}/api/invoices", json=payload)
            assert r.status_code in (200, 201), f"draft {i+1} failed: {r.status_code} {r.text[:200]}"
        stats = s.get(f"{BASE_URL}/api/drafts/stats").json()
        assert stats["today_drafts_count"] == 50
        assert stats["remaining_drafts_today"] == 0
        over = s.post(f"{BASE_URL}/api/invoices", json=payload)
        assert over.status_code == 400, f"51st draft accepted ({over.status_code})"
        assert "limit" in over.json().get("detail", "").lower()
        # quotation draft also blocked
        overq = s.post(f"{BASE_URL}/api/quotations", json={
            "buyer_details": {"company_name": "TEST_LimitBuyer"},
            "line_items": [{"description": "L", "quantity": 1, "unit_price": 1}],
            "status": "draft"})
        assert overq.status_code == 400, f"51st quotation draft accepted ({overq.status_code})"
        # finalized invoice still allowed beyond draft limit
        fin = s.post(f"{BASE_URL}/api/invoices", json={**payload, "status": "finalized"})
        assert fin.status_code in (200, 201), "Finalized invoice blocked by draft limit"
