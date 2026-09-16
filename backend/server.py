import certifi
from dotenv import load_dotenv
from pathlib import Path
import os
import logging
import uuid
from urllib.parse import quote as _url_quote
from datetime import datetime, timezone, timedelta, date
from typing import List, Optional, Dict, Any
import bcrypt
import jwt
from lib.amount_words import amount_in_words
from bson import ObjectId

from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response, Query
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, ConfigDict, EmailStr, field_validator

from lib import plans as plans_lib
from lib import razorpay_client
from lib import email_service
from lib import validators as v_lib

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
if mongo_url.startswith("mongodb+srv") or "mongodb.net" in mongo_url:
    client = AsyncIOMotorClient(mongo_url, tlsCAFile=certifi.where())
else:
    client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'test_database')]

JWT_SECRET = os.environ.get("JWT_SECRET", "vyastha_jwt_secret_key_2026_default_99")
JWT_ALGORITHM = "HS256"

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = FastAPI(title="Vyastha Billing & Invoicing API")
api_router = APIRouter(prefix="/api")


# ==========================================
# Auth Helpers & Password Hashing
# ==========================================
def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
    return hashed.decode("utf-8")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
    except Exception:
        return False

def create_access_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
        "type": "access"
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def create_refresh_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=30),
        "type": "refresh"
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Authentication required")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user_id = payload.get("sub")
        try:
            user = await db.users.find_one({"_id": ObjectId(user_id)})
        except Exception:
            user = await db.users.find_one({"id": user_id})
        if not user:
            user = await db.users.find_one({"email": payload.get("email")})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        user["_id"] = str(user["_id"])
        user.pop("password_hash", None)
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


# ==========================================
# Pydantic Models
# ==========================================
class UserRegister(BaseModel):
    email: EmailStr
    password: str
    name: str
    company_name: Optional[str] = ""
    phone: Optional[str] = ""

class UserLogin(BaseModel):
    email: str
    password: str

class UserResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    email: str
    name: str
    company_name: Optional[str] = ""
    role: str = "business_owner"

class BankDetails(BaseModel):
    model_config = ConfigDict(extra="ignore")
    bank_name: str = ""
    account_holder_name: str = ""
    account_number: str = ""
    ifsc: str = ""
    branch: str = ""
    upi_id: str = ""

class CompanyProfile(BaseModel):
    model_config = ConfigDict(extra="ignore")
    company_name: str = "Vyastha Enterprise"
    pan_number: str = ""
    gstin_number: str = ""
    state_code: str = ""  
    phone: str = ""
    email: str = ""
    company_logo: str = ""
    tagline: str = ""
    address: str = ""
    bank_details: BankDetails = Field(default_factory=BankDetails)
    signature_image: str = ""
    default_terms: str = "1. Payment is due within 15 days of invoice date.\n2. Goods once sold will not be taken back.\n3. All disputes are subject to local jurisdiction."
    invoice_prefix: str = "INV"
    quotation_prefix: str = "QUO"

    @field_validator("pan_number")
    @classmethod
    def _v_pan(cls, val):
        return v_lib.validate_pan(val)

    @field_validator("gstin_number")
    @classmethod
    def _v_gstin(cls, val):
        return v_lib.validate_gstin(val)

    @field_validator("phone")
    @classmethod
    def _v_phone(cls, val):
        return v_lib.validate_indian_mobile(val)

    @field_validator("email")
    @classmethod
    def _v_email(cls, val):
        return v_lib.validate_email_format(val)

class Customer(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    customer_id: str = ""  # e.g. CUST-001
    company_name: str
    contact_person: str = ""
    gstin_number: str = ""
    state_code: str = "" 
    pan_number: str = ""
    phone: str = ""
    email: str = ""
    address: str = ""
    user_id: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class CustomerCreate(BaseModel):
    company_name: str = Field(..., min_length=1, max_length=200)
    contact_person: Optional[str] = ""
    gstin_number: Optional[str] = ""
    pan_number: Optional[str] = ""
    phone: Optional[str] = ""
    email: Optional[str] = ""
    address: Optional[str] = ""
    customer_id: Optional[str] = ""

    @field_validator("gstin_number")
    @classmethod
    def _v_gstin(cls, val):
        return v_lib.validate_gstin(val)

    @field_validator("pan_number")
    @classmethod
    def _v_pan(cls, val):
        return v_lib.validate_pan(val)

    @field_validator("phone")
    @classmethod
    def _v_phone(cls, val):
        return v_lib.validate_indian_mobile(val)

    @field_validator("email")
    @classmethod
    def _v_email(cls, val):
        return v_lib.validate_email_format(val)

class Product(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    sku: str = ""
    category: str = "General"
    unit: str = "pc"  # pc, kg, box, mtr, set, etc.
    unit_price: float = 0.0
    stock_quantity: int = 0
    low_stock_threshold: int = 10
    description: str = ""
    user_id: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class ProductCreate(BaseModel):
    name: str
    sku: Optional[str] = ""
    category: Optional[str] = "General"
    unit: Optional[str] = "pc"
    unit_price: float = 0.0
    stock_quantity: int = 0
    low_stock_threshold: int = 10
    description: Optional[str] = ""

class StockAdjustment(BaseModel):
    quantity: int  # positive to add (IN), negative to deduct (OUT)
    type: str = "IN"  # IN, OUT, ADJUSTMENT
    reason: str = "Stock adjustment"
    reference: Optional[str] = ""

class LineItem(BaseModel):
    model_config = ConfigDict(extra="ignore")
    product_id: Optional[str] = None
    description: str
    quantity: float = 1.0
    unit: str = "pc"
    pieces: float = 1.0
    unit_price: float = 0.0
    amount: float = 0.0

class InvoiceCreate(BaseModel):
    invoice_number: Optional[str] = None
    invoice_date: str = Field(default_factory=lambda: date.today().isoformat())
    shipping_date: Optional[str] = ""
    customer_id: Optional[str] = ""
    vehicle_number: Optional[str] = ""
    reference_quotation_number: Optional[str] = ""
    seller_details: Dict[str, Any] = Field(default_factory=dict)
    buyer_details: Dict[str, Any] = Field(default_factory=dict)
    line_items: List[LineItem] = Field(default_factory=list)
    subtotal: float = 0.0
    tax_rate: float = 18.0
    tax_amount: float = 0.0
    discount_type: str = "amount"  # amount or percentage
    discount_value: float = 0.0
    discount_amount: float = 0.0
    total_amount: float = 0.0
    terms_and_conditions: Optional[str] = ""
    bank_details: Dict[str, Any] = Field(default_factory=dict)
    signature_url: Optional[str] = ""
    notes: Optional[str] = ""
    status: str = "finalized"  # draft, finalized, sent, paid, cancelled
    payment_status: str = "unpaid"  # unpaid, partially_paid, paid
    amount_paid: float = 0.0
    auto_deduct_inventory: bool = True

class QuotationCreate(BaseModel):
    quotation_number: Optional[str] = None
    quotation_date: str = Field(default_factory=lambda: date.today().isoformat())
    valid_until: Optional[str] = ""
    customer_id: Optional[str] = ""
    vehicle_number: Optional[str] = ""
    seller_details: Dict[str, Any] = Field(default_factory=dict)
    buyer_details: Dict[str, Any] = Field(default_factory=dict)
    line_items: List[LineItem] = Field(default_factory=list)
    subtotal: float = 0.0
    tax_rate: float = 18.0
    tax_amount: float = 0.0
    discount_type: str = "amount"
    discount_value: float = 0.0
    discount_amount: float = 0.0
    total_amount: float = 0.0
    terms_and_conditions: Optional[str] = ""
    bank_details: Dict[str, Any] = Field(default_factory=dict)
    signature_url: Optional[str] = ""
    notes: Optional[str] = ""
    status: str = "draft"  # draft, sent, accepted, rejected, converted

class PaymentCreate(BaseModel):
    invoice_id: Optional[str] = None
    invoice_number: str = ""
    customer_name: str = ""
    amount: float
    payment_date: str = Field(default_factory=lambda: date.today().isoformat())
    payment_method: str = "UPI"  # UPI, Bank Transfer, Cash, Card, Cheque
    transaction_ref: Optional[str] = ""
    notes: Optional[str] = ""
    status: str = "successful"  # successful, pending, failed


class DocumentEmailRequest(BaseModel):
    to_email: EmailStr
    subject: Optional[str] = None
    message: Optional[str] = None
    pdf_base64: str = Field(..., min_length=1, description="Base64-encoded PDF generated client-side from the invoice/quotation preview")


# ==========================================
# Helper Functions for Sequences & Stock
# ==========================================
def build_upi_qr_string(upi_id: str, company_name: str, amount: float, ref: str) -> str:
    if not upi_id:
        upi_id = "business@upi"
    clean_name = "".join(c for c in company_name if c.isalnum() or c in " _-") or "VyasthaPay"
    clean_ref = "".join(c for c in ref if c.isalnum() or c in "-_") or "Bill"
    formatted_amt = f"{amount:.2f}"
    return f"upi://pay?pa={upi_id}&pn={clean_name}&am={formatted_amt}&cu=INR&tn={clean_ref}"

def calculate_gst_split(tax_amount: float, seller_state: str, buyer_state: str):
    """Same state → CGST+SGST split; different state → IGST."""
    if seller_state and buyer_state and seller_state.strip() == buyer_state.strip():
        half = round(tax_amount / 2, 2)
        return {"cgst_amount": half, "sgst_amount": tax_amount - half, "igst_amount": 0.0}
    else:
        return {"cgst_amount": 0.0, "sgst_amount": 0.0, "igst_amount": round(tax_amount, 2)}

async def get_next_sequence(user_id: str, seq_type: str, prefix: str) -> str:
    year = date.today().year
    seq_doc = await db.counters.find_one_and_update(
        {"user_id": user_id, "type": seq_type, "year": year},
        {"$inc": {"sequence": 1}},
        upsert=True,
        return_document=True
    )
    seq_num = seq_doc.get("sequence", 1) if seq_doc else 1
    return f"{prefix}-{year}-{seq_num:04d}"

async def get_daily_draft_count(user_id: str) -> int:
    today_str = date.today().isoformat()
    invoice_drafts = await db.invoices.count_documents({
        "user_id": user_id,
        "status": "draft",
        "created_date_str": today_str
    })
    quotation_drafts = await db.quotations.count_documents({
        "user_id": user_id,
        "status": "draft",
        "created_date_str": today_str
    })
    return invoice_drafts + quotation_drafts

async def deduct_inventory_for_items(user_id: str, line_items: List[dict], reference: str):
    for item in line_items:
        p_id = item.get("product_id")
        qty = float(item.get("quantity", 0))
        if not qty or qty <= 0:
            continue
        
        product = None
        if p_id:
            product = await db.products.find_one({"id": p_id, "user_id": user_id})
        if not product and item.get("description"):
            # match by name if product_id not provided
            product = await db.products.find_one({
                "name": {"$regex": f"^{item.get('description')}$", "$options": "i"},
                "user_id": user_id
            })
        
        if product:
            new_qty = max(0, product.get("stock_quantity", 0) - int(qty))
            await db.products.update_one(
                {"id": product["id"], "user_id": user_id},
                {"$set": {"stock_quantity": new_qty, "updated_at": datetime.now(timezone.utc).isoformat()}}
            )
            # Record transaction
            await db.inventory_transactions.insert_one({
                "id": str(uuid.uuid4()),
                "user_id": user_id,
                "product_id": product["id"],
                "product_name": product["name"],
                "quantity": -int(qty),
                "type": "OUT_INVOICE",
                "reason": f"Deducted for Invoice {reference}",
                "reference": reference,
                "created_at": datetime.now(timezone.utc).isoformat()
            })

async def restore_inventory_for_items(user_id: str, line_items: List[dict], reference: str):
    for item in line_items:
        p_id = item.get("product_id")
        qty = float(item.get("quantity", 0))
        if not qty or qty <= 0:
            continue
        
        product = None
        if p_id:
            product = await db.products.find_one({"id": p_id, "user_id": user_id})
        if not product and item.get("description"):
            product = await db.products.find_one({
                "name": {"$regex": f"^{item.get('description')}$", "$options": "i"},
                "user_id": user_id
            })
        
        if product:
            new_qty = product.get("stock_quantity", 0) + int(qty)
            await db.products.update_one(
                {"id": product["id"], "user_id": user_id},
                {"$set": {"stock_quantity": new_qty, "updated_at": datetime.now(timezone.utc).isoformat()}}
            )
            await db.inventory_transactions.insert_one({
                "id": str(uuid.uuid4()),
                "user_id": user_id,
                "product_id": product["id"],
                "product_name": product["name"],
                "quantity": int(qty),
                "type": "IN_RESTORE",
                "reason": f"Restored from cancelled invoice {reference}",
                "reference": reference,
                "created_at": datetime.now(timezone.utc).isoformat()
            })


# ==========================================
# Auth Endpoints
# ==========================================
@api_router.post("/auth/register")
async def register(input: UserRegister, response: Response):
    email_clean = input.email.strip().lower()
    existing = await db.users.find_one({"email": email_clean})
    if existing:
        raise HTTPException(status_code=400, detail="An account with this email already exists")
    
    hashed = hash_password(input.password)
    user_id = str(uuid.uuid4())
    user_doc = {
        "id": user_id,
        "email": email_clean,
        "name": input.name,
        "company_name": input.company_name or "My Business",
        "phone": input.phone or "",
        "password_hash": hashed,
        "role": "business_owner",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user_doc)
    try:
        await sub_svc.ensure_trial(user_id)
    except Exception as e:
        logger.error(f"Trial grant on register failed: {e}")
    
    # Create initial company profile
    await db.company_profiles.update_one(
        {"user_id": user_id},
        {"$set": {
            "user_id": user_id,
            "company_name": input.company_name or "My Business",
            "email": email_clean,
            "phone": input.phone or "",
            "bank_details": {
                "bank_name": "State Bank of India",
                "account_holder_name": input.company_name or input.name,
                "account_number": "39201928374",
                "ifsc": "SBIN0001234",
                "branch": "Main Branch",
                "upi_id": f"{email_clean.split('@')[0]}@okhdfcbank"
            },
            "default_terms": "1. Payment is due within 15 days of invoice date.\n2. Goods once sold will not be taken back.\n3. All disputes are subject to local jurisdiction.",
            "invoice_prefix": "INV",
            "quotation_prefix": "QUO"
        }},
        upsert=True
    )
    
    access_token = create_access_token(user_id, email_clean)
    refresh_token = create_refresh_token(user_id)
    response.set_cookie(key="access_token", value=access_token, httponly=True, secure=False, samesite="lax", max_age=86400 * 7, path="/")
    response.set_cookie(key="refresh_token", value=refresh_token, httponly=True, secure=False, samesite="lax", max_age=86400 * 30, path="/")
    
    return {
        "token": access_token,
        "user": {
            "id": user_id,
            "email": email_clean,
            "name": input.name,
            "company_name": input.company_name or "My Business",
            "role": "business_owner"
        }
    }

@api_router.post("/auth/login")
async def login(input: UserLogin, response: Response):
    email_clean = input.email.strip().lower()
    user = await db.users.find_one({"email": email_clean})
    if not user or not verify_password(input.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    user_id = user.get("id") or str(user["_id"])
    access_token = create_access_token(user_id, email_clean)
    refresh_token = create_refresh_token(user_id)
    
    response.set_cookie(key="access_token", value=access_token, httponly=True, secure=False, samesite="lax", max_age=86400 * 7, path="/")
    response.set_cookie(key="refresh_token", value=refresh_token, httponly=True, secure=False, samesite="lax", max_age=86400 * 30, path="/")
    
    return {
        "token": access_token,
        "user": {
            "id": user_id,
            "email": email_clean,
            "name": user.get("name", "Business Owner"),
            "company_name": user.get("company_name", ""),
            "role": user.get("role", "business_owner")
        }
    }

@api_router.post("/auth/demo-login")
async def demo_login(response: Response):
    demo_email = "demo@vyastha.com"
    user = await db.users.find_one({"email": demo_email})
    if not user:
        user_id = str(uuid.uuid4())
        hashed = hash_password("demopassword123")
        user_doc = {
            "id": user_id,
            "email": demo_email,
            "name": "Rajesh Sharma",
            "company_name": "Vyastha Enterprise Solutions Ltd",
            "phone": "+91 98765 43210",
            "password_hash": hashed,
            "role": "business_owner",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.users.insert_one(user_doc)
        user = user_doc
    
    user_id = user.get("id") or str(user["_id"])
    access_token = create_access_token(user_id, demo_email)
    refresh_token = create_refresh_token(user_id)
    
    response.set_cookie(key="access_token", value=access_token, httponly=True, secure=False, samesite="lax", max_age=86400 * 7, path="/")
    response.set_cookie(key="refresh_token", value=refresh_token, httponly=True, secure=False, samesite="lax", max_age=86400 * 30, path="/")
    
    return {
        "token": access_token,
        "user": {
            "id": user_id,
            "email": demo_email,
            "name": user.get("name", "Rajesh Sharma"),
            "company_name": user.get("company_name", "Vyastha Enterprise Solutions Ltd"),
            "role": "business_owner"
        }
    }

@api_router.get("/auth/me")
async def get_me(user: dict = Depends(get_current_user)):
    user_id = user.get("id") or str(user["_id"])
    return {
        "id": user_id,
        "email": user.get("email"),
        "name": user.get("name"),
        "company_name": user.get("company_name", ""),
        "role": user.get("role", "business_owner")
    }

@api_router.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie(key="access_token", path="/")
    response.delete_cookie(key="refresh_token", path="/")
    return {"message": "Logged out successfully"}


# ==========================================
# Company Profile / Settings Module
# ==========================================
@api_router.get("/company-profile")
async def get_company_profile(user: dict = Depends(get_current_user)):
    user_id = user.get("id") or str(user["_id"])
    profile = await db.company_profiles.find_one({"user_id": user_id}, {"_id": 0})
    if not profile:
        profile = {
            "user_id": user_id,
            "company_name": user.get("company_name") or "Vyastha Enterprise",
            "pan_number": "ABCDE1234F",
            "gstin_number": "27ABCDE1234F1Z5",
            "phone": "+91 98765 43210",
            "email": user.get("email") or "billing@vyastha.com",
            "company_logo": "",
            "tagline": "Excellence in Enterprise Solutions",
            "address": "402, Business Hub, MG Road, Mumbai, Maharashtra 400001",
            "bank_details": {
                "bank_name": "HDFC Bank",
                "account_holder_name": user.get("company_name") or "Vyastha Enterprise",
                "account_number": "50200012345678",
                "ifsc": "HDFC0000240",
                "branch": "Fort Mumbai",
                "upi_id": "vyastha@hdfcbank"
            },
            "signature_image": "",
            "default_terms": "1. Payment is due within 15 days of invoice date.\n2. Goods once sold will not be taken back.\n3. All disputes are subject to Mumbai jurisdiction.",
            "invoice_prefix": "INV",
            "quotation_prefix": "QUO"
        }
        await db.company_profiles.insert_one(dict(profile))
    return profile

@api_router.put("/company-profile")
async def update_company_profile(profile_data: CompanyProfile, user: dict = Depends(get_current_user)):
    user_id = user.get("id") or str(user["_id"])
    update_dict = profile_data.model_dump()
    update_dict["user_id"] = user_id
    update_dict["updated_at"] = datetime.now(timezone.utc).isoformat()

    await db.company_profiles.update_one(
        {"user_id": user_id},
        {"$set": update_dict},
        upsert=True
    )
    # Update user's company_name as well
    if update_dict.get("company_name"):
        await db.users.update_one(
            {"$or": [{"id": user_id}, {"_id": ObjectId(user_id) if ObjectId.is_valid(user_id) else None}]},
            {"$set": {"company_name": update_dict["company_name"]}}
        )

    return {"message": "Company profile updated successfully", "profile": update_dict}


# ==========================================
# Customers Module
# ==========================================
@api_router.get("/customers")
async def get_customers(user: dict = Depends(get_current_user)):
    user_id = user.get("id") or str(user["_id"])
    customers = await db.customers.find({"user_id": user_id}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return customers

@api_router.post("/customers")
async def create_customer(data: CustomerCreate, user: dict = Depends(get_current_user)):
    user_id = user.get("id") or str(user["_id"])
    cust_count = await db.customers.count_documents({"user_id": user_id})
    cust_code = data.customer_id or f"CUST-{cust_count + 1:03d}"
    
    cust_doc = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "customer_id": cust_code,
        "company_name": data.company_name,
        "contact_person": data.contact_person or "",
        "gstin_number": data.gstin_number or "",
        "pan_number": data.pan_number or "",
        "phone": data.phone or "",
        "email": data.email or "",
        "address": data.address or "",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.customers.insert_one(cust_doc)
    cust_doc.pop("_id", None)
    return cust_doc

@api_router.put("/customers/{customer_id}")
async def update_customer(customer_id: str, data: CustomerCreate, user: dict = Depends(get_current_user)):
    user_id = user.get("id") or str(user["_id"])
    update_dict = data.model_dump(exclude_unset=True)
    update_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    res = await db.customers.update_one(
        {"id": customer_id, "user_id": user_id},
        {"$set": update_dict}
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    updated = await db.customers.find_one({"id": customer_id, "user_id": user_id}, {"_id": 0})
    return updated

@api_router.delete("/customers/{customer_id}")
async def delete_customer(customer_id: str, user: dict = Depends(get_current_user)):
    user_id = user.get("id") or str(user["_id"])
    await db.customers.delete_one({"id": customer_id, "user_id": user_id})
    return {"message": "Customer deleted successfully"}


# ==========================================
# Products & Inventory Module
# ==========================================
@api_router.get("/products")
async def get_products(user: dict = Depends(get_current_user)):
    user_id = user.get("id") or str(user["_id"])
    products = await db.products.find({"user_id": user_id}, {"_id": 0}).sort("name", 1).to_list(1000)
    return products

@api_router.post("/products")
async def create_product(data: ProductCreate, user: dict = Depends(get_current_user)):
    user_id = user.get("id") or str(user["_id"])
    prod_count = await db.products.count_documents({"user_id": user_id})
    sku = data.sku or f"SKU-{prod_count + 1:04d}"
    
    prod_doc = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "name": data.name,
        "sku": sku,
        "category": data.category or "General",
        "unit": data.unit or "pc",
        "unit_price": float(data.unit_price),
        "stock_quantity": int(data.stock_quantity),
        "low_stock_threshold": int(data.low_stock_threshold),
        "description": data.description or "",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    await db.products.insert_one(prod_doc)
    prod_doc.pop("_id", None)
    
    # Initial stock log if initial stock > 0
    if prod_doc["stock_quantity"] > 0:
        await db.inventory_transactions.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "product_id": prod_doc["id"],
            "product_name": prod_doc["name"],
            "quantity": prod_doc["stock_quantity"],
            "type": "IN_INITIAL",
            "reason": "Initial stock opening balance",
            "reference": "OPENING_BALANCE",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
    return prod_doc

@api_router.put("/products/{product_id}")
async def update_product(product_id: str, data: ProductCreate, user: dict = Depends(get_current_user)):
    user_id = user.get("id") or str(user["_id"])
    update_dict = data.model_dump(exclude_unset=True)
    update_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    res = await db.products.update_one(
        {"id": product_id, "user_id": user_id},
        {"$set": update_dict}
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Product not found")
    
    updated = await db.products.find_one({"id": product_id, "user_id": user_id}, {"_id": 0})
    return updated

@api_router.delete("/products/{product_id}")
async def delete_product(product_id: str, user: dict = Depends(get_current_user)):
    user_id = user.get("id") or str(user["_id"])
    await db.products.delete_one({"id": product_id, "user_id": user_id})
    return {"message": "Product deleted"}

@api_router.post("/products/{product_id}/adjust-stock")
async def adjust_stock(product_id: str, adjustment: StockAdjustment, user: dict = Depends(get_current_user)):
    user_id = user.get("id") or str(user["_id"])
    product = await db.products.find_one({"id": product_id, "user_id": user_id})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    current_stock = product.get("stock_quantity", 0)
    change = adjustment.quantity
    if adjustment.type.upper() == "OUT":
        change = -abs(change)
    else:
        change = abs(change)
        
    new_stock = max(0, current_stock + change)
    await db.products.update_one(
        {"id": product_id, "user_id": user_id},
        {"$set": {"stock_quantity": new_stock, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    txn_doc = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "product_id": product_id,
        "product_name": product.get("name"),
        "quantity": change,
        "type": adjustment.type.upper(),
        "reason": adjustment.reason,
        "reference": adjustment.reference or "MANUAL_ADJUSTMENT",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.inventory_transactions.insert_one(txn_doc)
    txn_doc.pop("_id", None)
    
    return {
        "product_id": product_id,
        "previous_stock": current_stock,
        "new_stock": new_stock,
        "transaction": txn_doc
    }

@api_router.get("/inventory/alerts")
async def get_inventory_alerts(user: dict = Depends(get_current_user)):
    user_id = user.get("id") or str(user["_id"])
    products = await db.products.find({"user_id": user_id}, {"_id": 0}).to_list(1000)
    low_stock_items = [p for p in products if p.get("stock_quantity", 0) <= p.get("low_stock_threshold", 10)]
    return {
        "count": len(low_stock_items),
        "items": low_stock_items
    }

@api_router.get("/inventory/transactions")
async def get_inventory_transactions(user: dict = Depends(get_current_user)):
    user_id = user.get("id") or str(user["_id"])
    txns = await db.inventory_transactions.find({"user_id": user_id}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return txns


# ==========================================
# Drafts Management & Stats Endpoint
# ==========================================
@api_router.get("/drafts/stats")
async def get_drafts_stats(user: dict = Depends(get_current_user)):
    user_id = user.get("id") or str(user["_id"])
    today_str = date.today().isoformat()
    
    invoice_drafts = await db.invoices.find({
        "user_id": user_id,
        "status": "draft"
    }, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    quotation_drafts = await db.quotations.find({
        "user_id": user_id,
        "status": "draft"
    }, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    today_draft_count = sum(1 for d in invoice_drafts if d.get("created_date_str") == today_str) + \
                        sum(1 for d in quotation_drafts if d.get("created_date_str") == today_str)
    
    return {
        "today_drafts_count": today_draft_count,
        "max_daily_limit": 50,
        "remaining_drafts_today": max(0, 50 - today_draft_count),
        "total_active_drafts": len(invoice_drafts) + len(quotation_drafts),
        "invoice_drafts": invoice_drafts,
        "quotation_drafts": quotation_drafts
    }


# ==========================================
# Invoices Module
# ==========================================
@api_router.get("/invoices")
async def get_invoices(
    status: Optional[str] = None,
    payment_status: Optional[str] = None,
    user: dict = Depends(get_current_user)
):
    user_id = user.get("id") or str(user["_id"])
    query: Dict[str, Any] = {"user_id": user_id}
    if status:
        query["status"] = status
    if payment_status:
        query["payment_status"] = payment_status
        
    invoices = await db.invoices.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return invoices

@api_router.get("/invoices/{invoice_id}")
async def get_invoice_by_id(invoice_id: str, user: dict = Depends(get_current_user)):
    user_id = user.get("id") or str(user["_id"])
    invoice = await db.invoices.find_one({"$or": [{"id": invoice_id}, {"invoice_number": invoice_id}], "user_id": user_id}, {"_id": 0})
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return invoice

@api_router.post("/invoices/{invoice_id}/send-email")
async def send_invoice_email(invoice_id: str, payload: DocumentEmailRequest, user: dict = Depends(get_current_user)):
    user_id = user.get("id") or str(user["_id"])
    invoice = await db.invoices.find_one({"id": invoice_id, "user_id": user_id}, {"_id": 0})
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    seller_name = (invoice.get("seller_details") or {}).get("company_name", "Vyastha Business")
    default_subject = f"Invoice {invoice.get('invoice_number', '')} from {seller_name}"
    default_message = (
        f"Dear {(invoice.get('buyer_details') or {}).get('company_name', 'Customer')},\n\n"
        f"Please find attached your invoice #{invoice.get('invoice_number', '')} from {seller_name}.\n\n"
        f"Invoice Amount: Rs. {invoice.get('total_amount', 0):.2f}\n\n"
        f"Thank you for your business.\n\nRegards,\n{seller_name}"
    )

    try:
        email_service.send_email_with_pdf(
            to_email=payload.to_email,
            subject=(payload.subject or default_subject).strip(),
            body_text=(payload.message or default_message),
            pdf_base64=payload.pdf_base64,
            attachment_filename=f"{invoice.get('invoice_number', 'invoice')}.pdf",
        )
    except email_service.EmailNotConfiguredError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except email_service.EmailSendError as exc:
        raise HTTPException(status_code=502, detail=str(exc))

    await db.invoices.update_one(
        {"id": invoice_id, "user_id": user_id},
        {"$set": {"last_emailed_to": payload.to_email, "last_emailed_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"success": True, "message": f"Invoice emailed to {payload.to_email}"}


@api_router.post("/invoices")
async def create_invoice(data: InvoiceCreate, user: dict = Depends(get_current_user)):
    user_id = user.get("id") or str(user["_id"])
    
    # Check Draft Limit if status is draft
    today_str = date.today().isoformat()
    if data.status == "draft":
        today_count = await get_daily_draft_count(user_id)
        if today_count >= 50:
            raise HTTPException(status_code=400, detail="Daily draft limit reached (50 drafts/day maximum). Please finalize or delete existing drafts.")
            
    # Fetch Company Profile for Prefix & Defaults if needed
    profile = await db.company_profiles.find_one({"user_id": user_id}, {"_id": 0}) or {}
    prefix = profile.get("invoice_prefix") or "INV"
    
    inv_number = data.invoice_number
    if not inv_number:
        inv_number = await get_next_sequence(user_id, "invoice", prefix)

    # Real-time calculation integrity check
    line_items_data = [item.model_dump() for item in data.line_items]

    calc_subtotal = sum(
        float(item.get("quantity", 0)) * float(item.get("unit_price", 0))
        for item in line_items_data
    )

    discount_amt = 0.0

    if data.discount_type == "percentage":
        discount_amt = (calc_subtotal * data.discount_value) / 100.0
    else:
        discount_amt = data.discount_value

    discount_amt = max(0.0, min(discount_amt, calc_subtotal))

    taxable = max(0.0, calc_subtotal - discount_amt)

    calc_tax_amt = (taxable * data.tax_rate) / 100.0

    calc_total = taxable + calc_tax_amt

    calc_amount_in_words = amount_in_words(calc_total)

    seller_state = (data.seller_details or profile).get("state_code", "")
    buyer_state = (data.buyer_details or {}).get("state_code", "")

    gst_split = calculate_gst_split(
        calc_tax_amt,
        seller_state,
        buyer_state
)
        
    # Generate Dynamic UPI Payment QR Data
    seller = data.seller_details or profile
    upi_id = seller.get("bank_details", {}).get("upi_id") or profile.get("bank_details", {}).get("upi_id") or "business@upi"
    company_name = seller.get("company_name") or profile.get("company_name") or "Vyastha Business"
    upi_qr_data = build_upi_qr_string(upi_id, company_name, calc_total, f"Invoice {inv_number}")
    
    # Auto-save buyer to customers collection if requested or non-empty
    buyer = data.buyer_details or {}
    if buyer.get("company_name"):
        existing_cust = await db.customers.find_one({"company_name": buyer.get("company_name"), "user_id": user_id})
        if not existing_cust:
            cust_count = await db.customers.count_documents({"user_id": user_id})
            await db.customers.insert_one({
                "id": str(uuid.uuid4()),
                "user_id": user_id,
                "customer_id": buyer.get("customer_id") or f"CUST-{cust_count+1:03d}",
                "company_name": buyer.get("company_name"),
                "contact_person": buyer.get("contact_person", ""),
                "gstin_number": buyer.get("gstin_number", ""),
                "phone": buyer.get("phone", ""),
                "email": buyer.get("email", ""),
                "address": buyer.get("address", ""),
                "created_at": datetime.now(timezone.utc).isoformat()
            })
            
    inv_id = str(uuid.uuid4())
    inv_doc = {
        "id": inv_id,
        "user_id": user_id,
        "invoice_number": inv_number,
        "invoice_date": data.invoice_date,
        "shipping_date": data.shipping_date or "",
        "customer_id": data.customer_id or buyer.get("customer_id", ""),
        "vehicle_number": data.vehicle_number or "",
        "reference_quotation_number": data.reference_quotation_number or "",
        "seller_details": data.seller_details or profile,
        "buyer_details": data.buyer_details,
        "line_items": line_items_data,
        "subtotal": round(calc_subtotal, 2),
        "tax_rate": data.tax_rate,
        "tax_amount": round(calc_tax_amt, 2),
        "discount_type": data.discount_type,
        "discount_value": data.discount_value,
        "discount_amount": round(discount_amt, 2),
        "total_amount": round(calc_total, 2),
        "amount_in_words": calc_amount_in_words,
        "cgst_amount": gst_split["cgst_amount"],
        "sgst_amount": gst_split["sgst_amount"],
        "igst_amount": gst_split["igst_amount"],
        "terms_and_conditions": data.terms_and_conditions or profile.get("default_terms", ""),
        "bank_details": data.bank_details or profile.get("bank_details", {}),
        "signature_url": data.signature_url or profile.get("signature_image", ""),
        "notes": data.notes or "",
        "status": data.status,
        "payment_status": data.payment_status,
        "amount_paid": float(data.amount_paid),
        "balance_due": max(0.0, round(calc_total - float(data.amount_paid), 2)),
        "upi_qr_data": upi_qr_data,
        "created_date_str": today_str,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.invoices.insert_one(inv_doc)
    inv_doc.pop("_id", None)
    
    # Deduct stock if invoice finalized or sent and auto_deduct_inventory is true
    if data.status in ["finalized", "sent", "paid"] and data.auto_deduct_inventory:
        await deduct_inventory_for_items(user_id, line_items_data, inv_number)
        
    return inv_doc

@api_router.put("/invoices/{invoice_id}")
async def update_invoice(invoice_id: str, data: InvoiceCreate, user: dict = Depends(get_current_user)):
    user_id = user.get("id") or str(user["_id"])
    existing = await db.invoices.find_one({"id": invoice_id, "user_id": user_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Invoice not found")
        
    line_items_data = [item.model_dump() for item in data.line_items]
    calc_subtotal = sum(float(item.get("quantity", 0)) * float(item.get("unit_price", 0)) for item in line_items_data)
    
    discount_amt = 0.0
    if data.discount_type == "percentage":
        discount_amt = (calc_subtotal * data.discount_value) / 100.0
    else:
        discount_amt = data.discount_value
    discount_amt = max(0.0, min(discount_amt, calc_subtotal))
    
    taxable = max(0.0, calc_subtotal - discount_amt)
    calc_tax_amt = (taxable * data.tax_rate) / 100.0
    calc_total = taxable + calc_tax_amt
    calc_amount_in_words = amount_in_words(calc_total)
    seller_state = data.seller_details.get("state_code", "")
    buyer_state = data.buyer_details.get("state_code", "")
    gst_split = calculate_gst_split(calc_tax_amt, seller_state, buyer_state)
    
    upi_id = data.seller_details.get("bank_details", {}).get("upi_id") or "business@upi"
    company_name = data.seller_details.get("company_name") or "Vyastha Business"
    upi_qr_data = build_upi_qr_string(upi_id, company_name, calc_total, f"Invoice {existing.get('invoice_number')}")
    
    # Check stock transition
    old_status = existing.get("status")
    new_status = data.status
    if old_status == "draft" and new_status in ["finalized", "sent", "paid"] and data.auto_deduct_inventory:
        await deduct_inventory_for_items(user_id, line_items_data, existing.get("invoice_number"))
    elif old_status in ["finalized", "sent", "paid"] and new_status == "cancelled":
        await restore_inventory_for_items(user_id, existing.get("line_items", []), existing.get("invoice_number"))
        
    update_doc = {
        "invoice_date": data.invoice_date,
        "shipping_date": data.shipping_date or "",
        "customer_id": data.customer_id or "",
        "vehicle_number": data.vehicle_number or "",
        "reference_quotation_number": data.reference_quotation_number or "",
        "seller_details": data.seller_details,
        "buyer_details": data.buyer_details,
        "line_items": line_items_data,
        "subtotal": round(calc_subtotal, 2),
        "tax_rate": data.tax_rate,
        "tax_amount": round(calc_tax_amt, 2),
        "discount_type": data.discount_type,
        "discount_value": data.discount_value,
        "discount_amount": round(discount_amt, 2),
        "total_amount": round(calc_total, 2),
        "amount_in_words": calc_amount_in_words,
        "cgst_amount": gst_split["cgst_amount"],
        "sgst_amount": gst_split["sgst_amount"],
        "igst_amount": gst_split["igst_amount"],
        "terms_and_conditions": data.terms_and_conditions,
        "bank_details": data.bank_details,
        "signature_url": data.signature_url,
        "notes": data.notes or "",
        "status": data.status,
        "payment_status": data.payment_status,
        "amount_paid": float(data.amount_paid),
        "balance_due": max(0.0, round(calc_total - float(data.amount_paid), 2)),
        "upi_qr_data": upi_qr_data,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.invoices.update_one({"id": invoice_id, "user_id": user_id}, {"$set": update_doc})
    updated = await db.invoices.find_one({"id": invoice_id, "user_id": user_id}, {"_id": 0})
    return updated

@api_router.delete("/invoices/{invoice_id}")
async def delete_invoice(invoice_id: str, user: dict = Depends(get_current_user)):
    user_id = user.get("id") or str(user["_id"])
    existing = await db.invoices.find_one({"id": invoice_id, "user_id": user_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Invoice not found")

    status = existing.get("status")
    stock_was_deducted = status in ["finalized", "sent", "paid", "partially_paid"]

    if stock_was_deducted:
        # A finalized invoice already deducted inventory. Deleting it outright
        # would silently leave stock counts wrong, so we reverse the deduction
        # first and keep a clear audit trail via inventory_transactions.
        await restore_inventory_for_items(
            user_id,
            existing.get("line_items", []),
            f"{existing.get('invoice_number')} (deleted)"
        )

    await db.invoices.delete_one({"id": invoice_id, "user_id": user_id})

    if stock_was_deducted:
        return {
            "message": "Invoice deleted successfully. Deducted stock has been restored to inventory.",
            "inventory_restored": True
        }
    return {"message": "Invoice deleted successfully", "inventory_restored": False}


# ==========================================
# Quotations Module & Convert to Invoice
# ==========================================
@api_router.get("/quotations")
async def get_quotations(
    status: Optional[str] = None,
    user: dict = Depends(get_current_user)
):
    user_id = user.get("id") or str(user["_id"])
    query: Dict[str, Any] = {"user_id": user_id}
    if status:
        query["status"] = status
    quotations = await db.quotations.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return quotations

@api_router.get("/quotations/{quotation_id}")
async def get_quotation_by_id(quotation_id: str, user: dict = Depends(get_current_user)):
    user_id = user.get("id") or str(user["_id"])
    quo = await db.quotations.find_one({"$or": [{"id": quotation_id}, {"quotation_number": quotation_id}], "user_id": user_id}, {"_id": 0})
    if not quo:
        raise HTTPException(status_code=404, detail="Quotation not found")
    return quo

@api_router.post("/quotations/{quotation_id}/send-email")
async def send_quotation_email(quotation_id: str, payload: DocumentEmailRequest, user: dict = Depends(get_current_user)):
    user_id = user.get("id") or str(user["_id"])
    quotation = await db.quotations.find_one({"id": quotation_id, "user_id": user_id}, {"_id": 0})
    if not quotation:
        raise HTTPException(status_code=404, detail="Quotation not found")

    seller_name = (quotation.get("seller_details") or {}).get("company_name", "Vyastha Business")
    default_subject = f"Quotation {quotation.get('quotation_number', '')} from {seller_name}"
    default_message = (
        f"Dear {(quotation.get('buyer_details') or {}).get('company_name', 'Customer')},\n\n"
        f"Please find attached your quotation #{quotation.get('quotation_number', '')} from {seller_name}.\n\n"
        f"Quotation Amount: Rs. {quotation.get('total_amount', 0):.2f}\n\n"
        f"Thank you for your interest.\n\nRegards,\n{seller_name}"
    )

    try:
        email_service.send_email_with_pdf(
            to_email=payload.to_email,
            subject=(payload.subject or default_subject).strip(),
            body_text=(payload.message or default_message),
            pdf_base64=payload.pdf_base64,
            attachment_filename=f"{quotation.get('quotation_number', 'quotation')}.pdf",
        )
    except email_service.EmailNotConfiguredError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except email_service.EmailSendError as exc:
        raise HTTPException(status_code=502, detail=str(exc))

    await db.quotations.update_one(
        {"id": quotation_id, "user_id": user_id},
        {"$set": {"last_emailed_to": payload.to_email, "last_emailed_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"success": True, "message": f"Quotation emailed to {payload.to_email}"}


@api_router.post("/quotations")
async def create_quotation(data: QuotationCreate, user: dict = Depends(get_current_user)):
    user_id = user.get("id") or str(user["_id"])
    today_str = date.today().isoformat()
    
    if data.status == "draft":
        today_count = await get_daily_draft_count(user_id)
        if today_count >= 50:
            raise HTTPException(status_code=400, detail="Daily draft limit reached (50 drafts/day maximum).")
            
    profile = await db.company_profiles.find_one({"user_id": user_id}, {"_id": 0}) or {}
    prefix = profile.get("quotation_prefix") or "QUO"
    
    quo_number = data.quotation_number
    if not quo_number:
        quo_number = await get_next_sequence(user_id, "quotation", prefix)
        
    line_items_data = [item.model_dump() for item in data.line_items]
    calc_subtotal = sum(float(item.get("quantity", 0)) * float(item.get("unit_price", 0)) for item in line_items_data)
    
    discount_amt = 0.0
    if data.discount_type == "percentage":
        discount_amt = (calc_subtotal * data.discount_value) / 100.0
    else:
        discount_amt = data.discount_value
    discount_amt = max(0.0, min(discount_amt, calc_subtotal))
    
    taxable = max(0.0, calc_subtotal - discount_amt)
    calc_tax_amt = (taxable * data.tax_rate) / 100.0
    calc_total = taxable + calc_tax_amt
    calc_amount_in_words = amount_in_words(calc_total)
    seller_state = (data.seller_details or profile).get("state_code", "")
    buyer_state = (data.buyer_details or {}).get("state_code", "")
    gst_split = calculate_gst_split(calc_tax_amt, seller_state, buyer_state)
    
    seller = data.seller_details or profile
    upi_id = seller.get("bank_details", {}).get("upi_id") or profile.get("bank_details", {}).get("upi_id") or "business@upi"
    company_name = seller.get("company_name") or profile.get("company_name") or "Vyastha Business"
    upi_qr_data = build_upi_qr_string(upi_id, company_name, calc_total, f"Quote {quo_number}")
    
    quo_id = str(uuid.uuid4())
    quo_doc = {
        "id": quo_id,
        "user_id": user_id,
        "quotation_number": quo_number,
        "quotation_date": data.quotation_date,
        "valid_until": data.valid_until or "",
        "customer_id": data.customer_id or "",
        "vehicle_number": data.vehicle_number or "",
        "seller_details": data.seller_details or profile,
        "buyer_details": data.buyer_details,
        "line_items": line_items_data,
        "subtotal": round(calc_subtotal, 2),
        "tax_rate": data.tax_rate,
        "tax_amount": round(calc_tax_amt, 2),
        "discount_type": data.discount_type,
        "discount_value": data.discount_value,
        "discount_amount": round(discount_amt, 2),
        "total_amount": round(calc_total, 2),
        "amount_in_words": calc_amount_in_words,
        "cgst_amount": gst_split["cgst_amount"],
        "sgst_amount": gst_split["sgst_amount"],
        "igst_amount": gst_split["igst_amount"],
        "terms_and_conditions": data.terms_and_conditions or profile.get("default_terms", ""),
        "bank_details": data.bank_details or profile.get("bank_details", {}),
        "signature_url": data.signature_url or profile.get("signature_image", ""),
        "notes": data.notes or "",
        "status": data.status,
        "upi_qr_data": upi_qr_data,
        "created_date_str": today_str,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.quotations.insert_one(quo_doc)
    quo_doc.pop("_id", None)
    return quo_doc

@api_router.post("/quotations/{quotation_id}/convert-to-invoice")
async def convert_quotation_to_invoice(quotation_id: str, user: dict = Depends(get_current_user)):
    user_id = user.get("id") or str(user["_id"])
    quo = await db.quotations.find_one({"$or": [{"id": quotation_id}, {"quotation_number": quotation_id}], "user_id": user_id}, {"_id": 0})
    if not quo:
        raise HTTPException(status_code=404, detail="Quotation not found")
    if quo.get("status") == "converted":
        raise HTTPException(status_code=409, detail=f"Quotation already converted to invoice {quo.get('converted_invoice_number', '')}")

    # Atomically claim the conversion so two simultaneous requests can never
    # both succeed (prevents duplicate invoice + duplicate stock deduction).
    original_status = quo.get("status")
    claim = await db.quotations.find_one_and_update(
        {"id": quo["id"], "user_id": user_id, "status": {"$nin": ["converted", "converting"]}},
        {"$set": {"status": "converting", "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    if not claim:
        raise HTTPException(status_code=409, detail="Quotation already converted to invoice.")


    try:
        profile = await db.company_profiles.find_one({"user_id": user_id}, {"_id": 0}) or {}
        prefix = profile.get("invoice_prefix") or "INV"
        inv_number = await get_next_sequence(user_id, "invoice", prefix)

        today_str = date.today().isoformat()
        inv_id = str(uuid.uuid4())

        upi_id = quo.get("seller_details", {}).get("bank_details", {}).get("upi_id") or profile.get("bank_details", {}).get("upi_id") or "business@upi"
        company_name = quo.get("seller_details", {}).get("company_name") or profile.get("company_name") or "Vyastha Business"
        upi_qr = build_upi_qr_string(upi_id, company_name, quo.get("total_amount", 0), f"Invoice {inv_number}")

        inv_doc = {
            "id": inv_id,
            "user_id": user_id,
            "invoice_number": inv_number,
            "invoice_date": today_str,
            "shipping_date": "",
            "customer_id": quo.get("customer_id", ""),
            "vehicle_number": quo.get("vehicle_number", ""),
            "reference_quotation_number": quo.get("quotation_number"),
            "seller_details": quo.get("seller_details", {}),
            "buyer_details": quo.get("buyer_details", {}),
            "line_items": quo.get("line_items", []),
            "subtotal": quo.get("subtotal", 0),
            "tax_rate": quo.get("tax_rate", 18.0),
            "tax_amount": quo.get("tax_amount", 0),
            "discount_type": quo.get("discount_type", "amount"),
            "discount_value": quo.get("discount_value", 0),
            "discount_amount": quo.get("discount_amount", 0),
            "total_amount": quo.get("total_amount", 0),
            "amount_in_words": quo.get("amount_in_words") or amount_in_words(quo.get("total_amount", 0)),
            "cgst_amount": quo.get("cgst_amount", 0),
            "sgst_amount": quo.get("sgst_amount", 0),
            "igst_amount": quo.get("igst_amount", 0),
            "terms_and_conditions": quo.get("terms_and_conditions", ""),
            "bank_details": quo.get("bank_details", {}),
            "signature_url": quo.get("signature_url", ""),
            "notes": quo.get("notes", ""),
            "status": "finalized",
            "payment_status": "unpaid",
            "amount_paid": 0.0,
            "balance_due": quo.get("total_amount", 0),
            "upi_qr_data": upi_qr,
            "created_date_str": today_str,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }

        await db.invoices.insert_one(inv_doc)
        # Deduct stock
        await deduct_inventory_for_items(user_id, quo.get("line_items", []), inv_number)
        # Update quotation status - this is the final commit of the conversion
        await db.quotations.update_one(
            {"id": quo["id"], "user_id": user_id},
            {"$set": {"status": "converted", "converted_invoice_number": inv_number, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )

        inv_doc.pop("_id", None)
        return {
            "message": f"Successfully converted {quo.get('quotation_number')} to {inv_number}",
            "invoice": inv_doc
        }
    except Exception:
        # Release the claim so the quotation isn't stuck in "converting" forever.
        await db.quotations.update_one(
            {"id": quo["id"], "user_id": user_id, "status": "converting"},
            {"$set": {"status": original_status, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        raise

@api_router.delete("/quotations/{quotation_id}")
async def delete_quotation(quotation_id: str, user: dict = Depends(get_current_user)):
    user_id = user.get("id") or str(user["_id"])
    await db.quotations.delete_one({"id": quotation_id, "user_id": user_id})
    return {"message": "Quotation deleted"}


# ==========================================
# Payments Module
# ==========================================
@api_router.get("/payments")
async def get_payments(
    filter: str = Query("today", description="Filter payments by 'today' or 'all'"),
    user: dict = Depends(get_current_user)
):
    user_id = user.get("id") or str(user["_id"])
    query: Dict[str, Any] = {"user_id": user_id}
    
    if filter == "today":
        today_str = date.today().isoformat()
        query["payment_date"] = today_str
        
    payments = await db.payments.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    
    # Summary calculation
    total_collected = sum(p.get("amount", 0) for p in payments if p.get("status") == "successful")
    return {
        "filter": filter,
        "total_amount": round(total_collected, 2),
        "count": len(payments),
        "payments": payments
    }

@api_router.post("/payments")
async def record_payment(data: PaymentCreate, user: dict = Depends(get_current_user)):
    user_id = user.get("id") or str(user["_id"])
    
    if float(data.amount) <= 0:
        raise HTTPException(status_code=422, detail="Payment amount must be greater than 0")
    
    # If linked to an invoice, verify not overpaying
    linked_invoice = None
    if data.invoice_id:
        linked_invoice = await db.invoices.find_one({"id": data.invoice_id, "user_id": user_id})
    if not linked_invoice and data.invoice_number:
        linked_invoice = await db.invoices.find_one({"invoice_number": data.invoice_number, "user_id": user_id})
    if linked_invoice:
        balance_due = float(linked_invoice.get("balance_due", linked_invoice.get("total_amount", 0)))
        if float(data.amount) > balance_due + 0.01:
            raise HTTPException(
                status_code=400,
                detail=f"Payment amount ₹{data.amount} exceeds invoice balance due ₹{balance_due:.2f}"
            )
    
    pay_id = str(uuid.uuid4())
    pay_doc = {
        "id": pay_id,
        "user_id": user_id,
        "invoice_id": data.invoice_id or "",
        "invoice_number": data.invoice_number,
        "customer_name": data.customer_name,
        "amount": round(float(data.amount), 2),
        "payment_date": data.payment_date,
        "payment_method": data.payment_method,
        "transaction_ref": data.transaction_ref or f"TXN-{uuid.uuid4().hex[:8].upper()}",
        "notes": data.notes or "",
        "status": data.status,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.payments.insert_one(pay_doc)
    pay_doc.pop("_id", None)
    
    # If linked to an invoice and successful, update invoice balance and payment status
    if data.invoice_id and data.status == "successful":
        invoice = await db.invoices.find_one({"id": data.invoice_id, "user_id": user_id})
        if not invoice and data.invoice_number:
            invoice = await db.invoices.find_one({"invoice_number": data.invoice_number, "user_id": user_id})
            
        if invoice:
            new_paid = float(invoice.get("amount_paid", 0)) + float(data.amount)
            total_amt = float(invoice.get("total_amount", 0))
            new_balance = max(0.0, total_amt - new_paid)
            
            new_status = "paid" if new_balance <= 0.01 else "partially_paid"
            await db.invoices.update_one(
                {"id": invoice["id"], "user_id": user_id},
                {"$set": {
                    "amount_paid": round(new_paid, 2),
                    "balance_due": round(new_balance, 2),
                    "payment_status": new_status,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }}
            )
            
    return pay_doc


# ==========================================
# Dashboard Statistics & Overview
# ==========================================
@api_router.get("/dashboard/stats")
async def get_dashboard_stats(user: dict = Depends(get_current_user)):
    user_id = user.get("id") or str(user["_id"])
    today_str = date.today().isoformat()
    
    all_invoices = await db.invoices.find({"user_id": user_id}, {"_id": 0}).to_list(1000)
    all_payments = await db.payments.find({"user_id": user_id}, {"_id": 0}).to_list(1000)
    all_products = await db.products.find({"user_id": user_id}, {"_id": 0}).to_list(1000)
    
    total_revenue = sum(inv.get("total_amount", 0) for inv in all_invoices if inv.get("status") != "cancelled")
    total_collected = sum(p.get("amount", 0) for p in all_payments if p.get("status") == "successful")
    today_collected = sum(p.get("amount", 0) for p in all_payments if p.get("status") == "successful" and p.get("payment_date") == today_str)
    
    unpaid_invoices = [inv for inv in all_invoices if inv.get("status") != "cancelled" and inv.get("payment_status") != "paid"]
    total_outstanding = sum(inv.get("balance_due", inv.get("total_amount", 0)) for inv in unpaid_invoices)
    
    low_stock_count = sum(1 for p in all_products if p.get("stock_quantity", 0) <= p.get("low_stock_threshold", 10))
    
    today_draft_count = await get_daily_draft_count(user_id)
    
    recent_invoices = sorted(all_invoices, key=lambda x: x.get("created_at", ""), reverse=True)[:5]
    recent_payments = sorted(all_payments, key=lambda x: x.get("created_at", ""), reverse=True)[:5]
    
    return {
        "total_revenue": round(total_revenue, 2),
        "total_collected": round(total_collected, 2),
        "today_collected": round(today_collected, 2),
        "total_outstanding": round(total_outstanding, 2),
        "total_invoices_count": len(all_invoices),
        "unpaid_invoices_count": len(unpaid_invoices),
        "low_stock_count": low_stock_count,
        "today_drafts_count": today_draft_count,
        "max_daily_drafts": 50,
        "recent_invoices": recent_invoices,
        "recent_payments": recent_payments
    }


# ==========================================
# Demo Data Seeder (Optional 1-Click Sandbox)
# ==========================================
@api_router.post("/seed/demo-data")
async def seed_demo_data(user: dict = Depends(get_current_user)):
    user_id = user.get("id") or str(user["_id"])
    today_str = date.today().isoformat()
    
    # 1. Update company profile
    company_profile = {
        "user_id": user_id,
        "company_name": "Vyastha Enterprise Solutions Ltd",
        "pan_number": "AAACV9821K",
        "gstin_number": "27AAACV9821K1Z3",
        "phone": "+91 98200 12345",
        "email": "contact@vyastha-solutions.in",
        "company_logo": "https://images.unsplash.com/photo-1693045181288-87092e30f862?w=400&auto=format&fit=crop&q=80",
        "tagline": "Precision Invoicing & Smart Inventory Logistics",
        "address": "Floor 12, Tower B, Cyber City, BKC, Mumbai, MH 400051",
        "bank_details": {
            "bank_name": "HDFC Bank Ltd",
            "account_holder_name": "Vyastha Enterprise Solutions Ltd",
            "account_number": "50200088991122",
            "ifsc": "HDFC0000128",
            "branch": "BKC Bandra East",
            "upi_id": "vyastha.enterprise@hdfcbank"
        },
        "signature_image": "",
        "default_terms": "1. 100% Payment due within 15 days of invoice date.\n2. Goods once dispatched remain property of Vyastha until cleared.\n3. Delayed payments attract 1.5% interest per month.\n4. All claims subject to Mumbai jurisdiction.",
        "invoice_prefix": "INV",
        "quotation_prefix": "QUO",
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    await db.company_profiles.update_one({"user_id": user_id}, {"$set": company_profile}, upsert=True)
    
    # 2. Seed realistic Customers
    sample_customers = [
        {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "customer_id": "CUST-101",
            "company_name": "Apex Global Logistics LLP",
            "contact_person": "Vikram Malhotra",
            "gstin_number": "27AABCA5544K1ZZ",
            "pan_number": "AABCA5544K",
            "phone": "+91 98111 22334",
            "email": "procurement@apexlogistics.in",
            "address": "Plot 45, MIDC Industrial Area, Andheri East, Mumbai 400093",
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "customer_id": "CUST-102",
            "company_name": "Nexus Retail & Distributions",
            "contact_person": "Pooja Hegde",
            "gstin_number": "29BBBCB8899M1ZQ",
            "pan_number": "BBBCB8899M",
            "phone": "+91 97444 88990",
            "email": "finance@nexusretail.com",
            "address": "100 Feet Ring Road, Indiranagar, Bengaluru, KA 560038",
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "customer_id": "CUST-103",
            "company_name": "Zenith Infotech Solutions",
            "contact_person": "Arun Kumar",
            "gstin_number": "33CCCZC1234N1Z8",
            "pan_number": "CCCZC1234N",
            "phone": "+91 94444 55667",
            "email": "accounts@zenithinfo.co",
            "address": "OMR IT Corridor, Chennai, TN 600096",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
    ]
    for c in sample_customers:
        await db.customers.update_one({"company_name": c["company_name"], "user_id": user_id}, {"$set": c}, upsert=True)
        
    # # 3. Seed Products (including some with low stock to show alerts)
    # sample_products = [
    #     {
    #         "id": str(uuid.uuid4()),
    #         "user_id": user_id,
    #         "name": "Industrial Thermal Label Rolls (100x150mm)",
    #         "sku": "PRD-LBL-001",
    #         "category": "Packaging",
    #         "unit": "box",
    #         "unit_price": 1250.0,
    #         "stock_quantity": 48,
    #         "low_stock_threshold": 15,
    #         "description": "Premium top-coated direct thermal barcode shipping labels.",
    #         "created_at": datetime.now(timezone.utc).isoformat(),
    #         "updated_at": datetime.now(timezone.utc).isoformat()
    #     },
    #     {
    #         "id": str(uuid.uuid4()),
    #         "user_id": user_id,
    #         "name": "Heavy Duty Steel Pallet Strapping (19mm)",
    #         "sku": "PRD-STRP-002",
    #         "category": "Hardware",
    #         "unit": "roll",
    #         "unit_price": 3400.0,
    #         "stock_quantity": 4,  # LOW STOCK
    #         "low_stock_threshold": 10,
    #         "description": "High tensile cold-rolled steel strapping for pallet stabilization.",
    #         "created_at": datetime.now(timezone.utc).isoformat(),
    #         "updated_at": datetime.now(timezone.utc).isoformat()
    #     },
    #     {
    #         "id": str(uuid.uuid4()),
    #         "user_id": user_id,
    #         "name": "Wireless 2D Handheld QR/Barcode Scanner",
    #         "sku": "PRD-SCN-003",
    #         "category": "Electronics",
    #         "unit": "pc",
    #         "unit_price": 4850.0,
    #         "stock_quantity": 3,  # LOW STOCK
    #         "low_stock_threshold": 8,
    #         "description": "Long range Bluetooth 5.0 industrial warehouse scanner.",
    #         "created_at": datetime.now(timezone.utc).isoformat(),
    #         "updated_at": datetime.now(timezone.utc).isoformat()
    #     },
    #     {
    #         "id": str(uuid.uuid4()),
    #         "user_id": user_id,
    #         "name": "Corrugated 5-Ply Shipping Box (18x12x12 inch)",
    #         "sku": "PRD-BOX-004",
    #         "category": "Packaging",
    #         "unit": "pc",
    #         "unit_price": 85.0,
    #         "stock_quantity": 250,
    #         "low_stock_threshold": 50,
    #         "description": "Heavy-duty double wall corrugated carton for bulk transit.",
    #         "created_at": datetime.now(timezone.utc).isoformat(),
    #         "updated_at": datetime.now(timezone.utc).isoformat()
    #     }
    # ]
    # for p in sample_products:
    #     await db.products.update_one({"sku": p["sku"], "user_id": user_id}, {"$set": p}, upsert=True)
        
    # # 4. Seed Invoices
    # inv_1_num = "INV-2026-0001"
    # inv_1_items = [
    #     {"description": "Industrial Thermal Label Rolls (100x150mm)", "quantity": 10, "unit": "box", "pieces": 10, "unit_price": 1250.0, "amount": 12500.0},
    #     {"description": "Wireless 2D Handheld QR/Barcode Scanner", "quantity": 2, "unit": "pc", "pieces": 2, "unit_price": 4850.0, "amount": 9700.0}
    # ]
    # subtotal_1 = 22200.0
    # tax_1 = 3996.0  # 18%
    # total_1 = 26196.0
    
    # inv_1 = {
    #     "id": str(uuid.uuid4()),
    #     "user_id": user_id,
    #     "invoice_number": inv_1_num,
    #     "invoice_date": today_str,
    #     "shipping_date": today_str,
    #     "customer_id": "CUST-101",
    #     "vehicle_number": "MH-04-AB-9821",
    #     "reference_quotation_number": "",
    #     "seller_details": company_profile,
    #     "buyer_details": sample_customers[0],
    #     "line_items": inv_1_items,
    #     "subtotal": subtotal_1,
    #     "tax_rate": 18.0,
    #     "tax_amount": tax_1,
    #     "discount_type": "amount",
    #     "discount_value": 0.0,
    #     "discount_amount": 0.0,
    #     "total_amount": total_1,
    #     "terms_and_conditions": company_profile["default_terms"],
    #     "bank_details": company_profile["bank_details"],
    #     "signature_url": "",
    #     "notes": "Thank you for your business! Goods dispatched via SafeXpress.",
    #     "status": "finalized",
    #     "payment_status": "paid",
    #     "amount_paid": total_1,
    #     "balance_due": 0.0,
    #     "upi_qr_data": build_upi_qr_string(company_profile["bank_details"]["upi_id"], company_profile["company_name"], total_1, f"Invoice {inv_1_num}"),
    #     "created_date_str": today_str,
    #     "created_at": datetime.now(timezone.utc).isoformat(),
    #     "updated_at": datetime.now(timezone.utc).isoformat()
    # }
    # await db.invoices.update_one({"invoice_number": inv_1_num, "user_id": user_id}, {"$set": inv_1}, upsert=True)
    
    # # Record payment for invoice 1
    # pay_1 = {
    #     "id": str(uuid.uuid4()),
    #     "user_id": user_id,
    #     "invoice_id": inv_1["id"],
    #     "invoice_number": inv_1_num,
    #     "customer_name": sample_customers[0]["company_name"],
    #     "amount": total_1,
    #     "payment_date": today_str,
    #     "payment_method": "UPI",
    #     "transaction_ref": "UPI/26196/SBIN88921102",
    #     "notes": "Received instant settlement via PhonePe UPI",
    #     "status": "successful",
    #     "created_at": datetime.now(timezone.utc).isoformat()
    # }
    # await db.payments.update_one({"invoice_number": inv_1_num, "user_id": user_id}, {"$set": pay_1}, upsert=True)
    
    # # Quotation
    # quo_1_num = "QUO-2026-0001"
    # quo_1 = {
    #     "id": str(uuid.uuid4()),
    #     "user_id": user_id,
    #     "quotation_number": quo_1_num,
    #     "quotation_date": today_str,
    #     "valid_until": (date.today() + timedelta(days=14)).isoformat(),
    #     "customer_id": "CUST-102",
    #     "vehicle_number": "",
    #     "seller_details": company_profile,
    #     "buyer_details": sample_customers[1],
    #     "line_items": [
    #         {"description": "Corrugated 5-Ply Shipping Box (18x12x12 inch)", "quantity": 100, "unit": "pc", "pieces": 100, "unit_price": 85.0, "amount": 8500.0},
    #         {"description": "Heavy Duty Steel Pallet Strapping (19mm)", "quantity": 2, "unit": "roll", "pieces": 2, "unit_price": 3400.0, "amount": 6800.0}
    #     ],
    #     "subtotal": 15300.0,
    #     "tax_rate": 18.0,
    #     "tax_amount": 2754.0,
    #     "discount_type": "percentage",
    #     "discount_value": 5.0,
    #     "discount_amount": 765.0,
    #     "total_amount": 17289.0,
    #     "terms_and_conditions": company_profile["default_terms"],
    #     "bank_details": company_profile["bank_details"],
    #     "signature_url": "",
    #     "notes": "5% Volume Discount applied for quarterly agreement.",
    #     "status": "sent",
    #     "upi_qr_data": build_upi_qr_string(company_profile["bank_details"]["upi_id"], company_profile["company_name"], 17289.0, f"Quote {quo_1_num}"),
    #     "created_date_str": today_str,
    #     "created_at": datetime.now(timezone.utc).isoformat(),
    #     "updated_at": datetime.now(timezone.utc).isoformat()
    # }
    # await db.quotations.update_one({"quotation_number": quo_1_num, "user_id": user_id}, {"$set": quo_1}, upsert=True)
    
    # return {"message": "Demo data populated successfully with realistic business profiles, inventory, invoices, and payments!"}


# Root-level health endpoints for deployment probe
@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "vyastha-billing"}

@app.get("/")
async def root():
    return {"status": "ok", "service": "vyastha-billing"}

DEFAULT_ALLOWED_ORIGINS = ["https://vyastha-web-eight.vercel.app"]
_cors_env = os.environ.get("CORS_ORIGINS", "")
_allow_origin_regex = None
if _cors_env.strip() in ("", "*"):
    # Reflect any Origin back (works with credentials, unlike a literal "*").
    _allow_origin_regex = ".*"
    ALLOWED_ORIGINS = []
else:
    ALLOWED_ORIGINS = [o.strip() for o in _cors_env.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=_allow_origin_regex,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    # Create indexes
    try:
        await db.users.create_index("email", unique=True)
        await db.invoices.create_index([("user_id", 1), ("invoice_number", 1)])
        await db.quotations.create_index([("user_id", 1), ("quotation_number", 1)])
        await db.products.create_index([("user_id", 1), ("sku", 1)])
        await db.customers.create_index([("user_id", 1), ("customer_id", 1)])
        await db.payments.create_index([("user_id", 1), ("payment_date", 1)])
        
        # Seed Admin user if not present
        admin_email = os.environ.get("ADMIN_EMAIL", "admin@vyastha.com")
        admin_password = os.environ.get("ADMIN_PASSWORD", "adminpassword123")
        existing_admin = await db.users.find_one({"email": admin_email})
        if not existing_admin:
            admin_id = str(uuid.uuid4())
            hashed = hash_password(admin_password)
            await db.users.insert_one({
                "id": admin_id,
                "email": admin_email,
                "name": "System Administrator",
                "company_name": "Vyastha Central HQ",
                "password_hash": hashed,
                "role": "admin",
                "created_at": datetime.now(timezone.utc).isoformat()
            })
            logger.info("Admin user seeded.")
    except Exception as e:
        logger.error(f"Error in startup: {e}")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()


# ==========================================
# Subscription seeding + trial (runs on startup)
# ==========================================
from lib import subscription_service as sub_svc
from lib import ai_assistant as ai_svc
from lib import ai_data as ai_data_svc
from lib import features as features_lib


@app.on_event("startup")
async def seed_plans_startup():
    try:
        await sub_svc.seed_plans()
        logger.info("Subscription plans seeded.")
    except Exception as e:
        logger.error(f"Plan seeding error: {e}")


async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


def _inr(amount: float) -> str:
    """Format a number using the Indian numbering system, e.g. Rs.1,20,000."""
    try:
        n = float(amount)
    except (TypeError, ValueError):
        return "Rs.0"
    neg = n < 0
    n = abs(n)
    whole = int(round(n))
    s = str(whole)
    if len(s) > 3:
        last3 = s[-3:]
        rest = s[:-3]
        parts = []
        while len(rest) > 2:
            parts.insert(0, rest[-2:])
            rest = rest[:-2]
        if rest:
            parts.insert(0, rest)
        s = ",".join(parts) + "," + last3
    return ("-" if neg else "") + "Rs." + s


# ==========================================
# Plans + Subscription + Entitlements
# ==========================================
@api_router.get("/plans")
async def list_plans():
    documents = await db.plans.find({"active": True}, {"_id": 0}).sort("rank", 1).to_list(50)
    return documents


@api_router.get("/entitlements")
async def get_entitlements(user: dict = Depends(get_current_user)):
    user_id = user.get("id") or str(user["_id"])
    if user.get("role") != "admin":
        await sub_svc.ensure_trial(user_id)
    ent = await features_lib.resolve_entitlements(user_id)
    return ent


@api_router.get("/subscription")
async def get_subscription(user: dict = Depends(get_current_user)):
    user_id = user.get("id") or str(user["_id"])
    if user.get("role") != "admin":
        await sub_svc.ensure_trial(user_id)
    ent = await features_lib.resolve_entitlements(user_id)
    sub = await features_lib.get_business_subscription(user_id)
    plan = await sub_svc.get_plan_doc(ent["plan_slug"]) or {}
    days_left = None
    if sub and sub.get("current_period_end"):
        pe = sub["current_period_end"]
        if isinstance(pe, str):
            try:
                pe = datetime.fromisoformat(pe)
            except Exception:
                pe = None
        if pe:
            if pe.tzinfo is None:
                pe = pe.replace(tzinfo=timezone.utc)
            days_left = max(0, (pe - datetime.now(timezone.utc)).days)
    return {
        "subscription": sub,
        "entitlements": ent,
        "plan": plan,
        "days_left": days_left,
        "is_trial": bool(sub and sub.get("status") == "trialing"),
        "gateway_configured": sub_svc.is_stripe_configured(),
    }


class CheckoutBody(BaseModel):
    plan_slug: str
    billing_cycle: str = "monthly"
    origin_url: str


@api_router.post("/subscription/checkout")
async def create_subscription_checkout(body: CheckoutBody, request: Request, user: dict = Depends(get_current_user)):
    user_id = user.get("id") or str(user["_id"])
    if not sub_svc.is_stripe_configured():
        raise HTTPException(status_code=503, detail="Payment gateway not configured")
    plan = await sub_svc.get_plan_doc(body.plan_slug)
    if not plan or not plan.get("active"):
        raise HTTPException(status_code=404, detail="Plan not available")
    if body.billing_cycle not in ("monthly", "yearly"):
        raise HTTPException(status_code=422, detail="Invalid billing cycle")

    amount = sub_svc.plan_price_rupees(plan, body.billing_cycle)  # server-side price
    if amount <= 0:
        raise HTTPException(status_code=400, detail="This plan is free and does not require checkout")

    from emergentintegrations.payments.stripe.checkout import StripeCheckout, CheckoutSessionRequest

    host_url = str(request.base_url)
    webhook_url = f"{host_url}api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=sub_svc.STRIPE_API_KEY, webhook_url=webhook_url)

    origin = body.origin_url.rstrip("/")
    success_url = f"{origin}/subscription/success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin}/subscription?checkout=cancelled"

    checkout_req = CheckoutSessionRequest(
        amount=float(amount),
        currency="inr",
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={"user_id": user_id, "plan_slug": body.plan_slug, "billing_cycle": body.billing_cycle},
    )
    session = await stripe_checkout.create_checkout_session(checkout_req)

    await db.payment_transactions.insert_one({
        "id": str(uuid.uuid4()),
        "session_id": session.session_id,
        "user_id": user_id,
        "plan_slug": body.plan_slug,
        "billing_cycle": body.billing_cycle,
        "amount": float(amount),
        "currency": "INR",
        "status": "initiated",
        "payment_status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"checkout_url": session.url, "session_id": session.session_id, "amount": amount}


@api_router.get("/subscription/status/{session_id}")
async def subscription_status(session_id: str, request: Request, user: dict = Depends(get_current_user)):
    user_id = user.get("id") or str(user["_id"])
    record = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
    if not record:
        raise HTTPException(status_code=404, detail="Transaction not found")
    if record.get("user_id") != user_id and user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Not your transaction")
    if record.get("payment_status") != "paid":
        try:
            from emergentintegrations.payments.stripe.checkout import StripeCheckout
            host_url = str(request.base_url)
            stripe_checkout = StripeCheckout(api_key=sub_svc.STRIPE_API_KEY, webhook_url=f"{host_url}api/webhook/stripe")
            status = await stripe_checkout.get_checkout_status(session_id)
            if status.payment_status == "paid":
                already = await db.payment_transactions.find_one({"session_id": session_id, "payment_status": "paid"})
                await db.payment_transactions.update_one(
                    {"session_id": session_id, "payment_status": {"$ne": "paid"}},
                    {"$set": {"status": "completed", "payment_status": "paid", "updated_at": datetime.now(timezone.utc).isoformat()}},
                )
                if not already:
                    await sub_svc.activate_paid_subscription(
                        record["user_id"], record["plan_slug"], record["billing_cycle"], record["amount"], session_id
                    )
                record = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
        except Exception as exc:
            logger.error(f"Stripe status check failed: {exc}")
    return {"session_id": session_id, "status": record.get("status"), "payment_status": record.get("payment_status")}


@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    try:
        from emergentintegrations.payments.stripe.checkout import StripeCheckout
        host_url = str(request.base_url)
        stripe_checkout = StripeCheckout(api_key=sub_svc.STRIPE_API_KEY, webhook_url=f"{host_url}api/webhook/stripe")
        body = await request.body()
        sig = request.headers.get("Stripe-Signature", "")
        result = await stripe_checkout.handle_webhook(body, sig)
        if result.payment_status == "paid" and result.session_id:
            record = await db.payment_transactions.find_one({"session_id": result.session_id})
            if record and record.get("payment_status") != "paid":
                await db.payment_transactions.update_one(
                    {"session_id": result.session_id},
                    {"$set": {"status": "completed", "payment_status": "paid", "updated_at": datetime.now(timezone.utc).isoformat()}},
                )
                await sub_svc.activate_paid_subscription(
                    record["user_id"], record["plan_slug"], record["billing_cycle"], record["amount"], result.session_id
                )
        return {"status": "ok"}
    except Exception as exc:
        logger.error(f"Webhook error: {exc}")
        raise HTTPException(status_code=400, detail="Webhook processing failed")


@api_router.post("/subscription/cancel")
async def cancel_my_subscription(user: dict = Depends(get_current_user)):
    user_id = user.get("id") or str(user["_id"])
    ok = await sub_svc.cancel_subscription(user_id)
    if not ok:
        raise HTTPException(status_code=400, detail="No active subscription to cancel")
    return {"message": "Subscription will be cancelled at the end of the current period."}


# ==========================================
# Ask Vyastha - AI Business Assistant
# ==========================================
class AskBody(BaseModel):
    question: str
    language: str = "hinglish"
    session_id: Optional[str] = None


@api_router.get("/ai/suggestions")
async def ai_suggestions(user: dict = Depends(get_current_user)):
    user_id = user.get("id") or str(user["_id"])
    return await ai_svc.suggested_questions(user_id)


@api_router.get("/ai/alerts")
async def ai_alerts(user: dict = Depends(get_current_user)):
    user_id = user.get("id") or str(user["_id"])
    return await ai_data_svc.get_business_alerts(user_id)


@api_router.post("/ai/ask")
async def ai_ask(body: AskBody, user: dict = Depends(get_current_user)):
    user_id = user.get("id") or str(user["_id"])
    if not await features_lib.has_feature(user_id, "ai_business_assistant"):
        raise HTTPException(status_code=402, detail={"error": "upgrade_required", "feature": "ai_business_assistant",
                                                     "message": "Ask Vyastha AI is a Pro feature. Upgrade to unlock it."})
    if not body.question.strip():
        raise HTTPException(status_code=422, detail="Question cannot be empty")
    result = await ai_svc.ask(
        user_id=user_id,
        question=body.question.strip()[:1000],
        language=body.language,
        business_name=user.get("company_name", "your business"),
        session_id=body.session_id,
    )
    return result


# ==========================================
# Notifications & Alerts
# ==========================================
@api_router.get("/notifications")
async def get_notifications(user: dict = Depends(get_current_user)):
    user_id = user.get("id") or str(user["_id"])
    notifications = []
    alerts = await ai_data_svc.get_business_alerts(user_id)
    for a in alerts["alerts"]:
        notifications.append({"type": a["type"], "severity": a["severity"], "message": a["message"]})
    # Trial / subscription expiry
    sub = await features_lib.get_business_subscription(user_id)
    if sub and sub.get("current_period_end"):
        pe = sub["current_period_end"]
        if isinstance(pe, str):
            try:
                pe = datetime.fromisoformat(pe)
            except Exception:
                pe = None
        if pe:
            if pe.tzinfo is None:
                pe = pe.replace(tzinfo=timezone.utc)
            days_left = (pe - datetime.now(timezone.utc)).days
            if sub.get("status") == "trialing" and days_left <= 14:
                notifications.append({"type": "trial_expiry", "severity": "warning" if days_left > 3 else "critical",
                                      "message": f"Aapka free trial {max(0, days_left)} din mein khatam ho raha hai. Upgrade karein."})
            elif sub.get("status") in ("active", "cancelled") and days_left <= 7:
                notifications.append({"type": "subscription_expiry", "severity": "warning",
                                      "message": f"Aapki subscription {max(0, days_left)} din mein renew/expire hogi."})
    return {"count": len(notifications), "notifications": notifications}


@api_router.get("/notification-preferences")
async def get_notification_prefs(user: dict = Depends(get_current_user)):
    user_id = user.get("id") or str(user["_id"])
    prefs = await db.notification_prefs.find_one({"user_id": user_id}, {"_id": 0})
    if not prefs:
        prefs = {"user_id": user_id, "in_app": True, "email": False, "whatsapp": False,
                 "low_stock": True, "overdue_payments": True, "trial_expiry": True}
    return prefs


class NotifPrefs(BaseModel):
    in_app: bool = True
    email: bool = False
    whatsapp: bool = False
    low_stock: bool = True
    overdue_payments: bool = True
    trial_expiry: bool = True


@api_router.put("/notification-preferences")
async def update_notification_prefs(prefs: NotifPrefs, user: dict = Depends(get_current_user)):
    user_id = user.get("id") or str(user["_id"])
    doc = prefs.model_dump()
    doc["user_id"] = user_id
    await db.notification_prefs.update_one({"user_id": user_id}, {"$set": doc}, upsert=True)
    return doc


@api_router.get("/integrations/status")
async def integrations_status(user: dict = Depends(get_current_user)):
    return {
        "email": email_service.is_configured(),
        "whatsapp": False,
        "payments": sub_svc.is_stripe_configured(),
        "ai": bool(ai_svc.EMERGENT_LLM_KEY),
    }


# ==========================================
# Admin Panel
# ==========================================
@api_router.get("/admin/stats")
async def admin_stats(admin: dict = Depends(require_admin)):
    total_users = await db.users.count_documents({})
    total_businesses = await db.users.count_documents({"role": "business_owner"})
    subs = await db.subscriptions.find({"status": {"$ne": "superseded"}}, {"_id": 0}).to_list(5000)
    by_status: Dict[str, int] = {}
    by_plan: Dict[str, int] = {}
    for s in subs:
        by_status[s.get("status", "unknown")] = by_status.get(s.get("status", "unknown"), 0) + 1
        by_plan[s.get("plan_slug", "free")] = by_plan.get(s.get("plan_slug", "free"), 0) + 1
    paid = await db.payment_transactions.find({"payment_status": "paid"}, {"_id": 0}).to_list(5000)
    revenue = sum(p.get("amount", 0) for p in paid)
    return {
        "total_users": total_users,
        "total_businesses": total_businesses,
        "active_subscriptions": by_status.get("active", 0),
        "trialing": by_status.get("trialing", 0),
        "cancelled": by_status.get("cancelled", 0),
        "expired": by_status.get("expired", 0),
        "revenue_total": round(revenue, 2),
        "plan_counts": by_plan,
        "status_counts": by_status,
    }


@api_router.get("/admin/users")
async def admin_users(admin: dict = Depends(require_admin)):
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).sort("created_at", -1).to_list(1000)
    for u in users:
        sub = await features_lib.get_business_subscription(u.get("id", ""))
        u["subscription_status"] = sub.get("status") if sub else "none"
        u["plan_slug"] = sub.get("plan_slug") if sub else "free"
    return users


@api_router.get("/admin/plans")
async def admin_plans(admin: dict = Depends(require_admin)):
    return await db.plans.find({}, {"_id": 0}).sort("rank", 1).to_list(50)


class AdminPlanUpdate(BaseModel):
    monthly_price: Optional[float] = None
    yearly_price: Optional[float] = None
    trial_days: Optional[int] = None
    active: Optional[bool] = None
    name: Optional[str] = None
    description: Optional[str] = None
    features: Optional[Dict[str, bool]] = None
    limits: Optional[Dict[str, int]] = None


@api_router.put("/admin/plans/{slug}")
async def admin_update_plan(slug: str, body: AdminPlanUpdate, admin: dict = Depends(require_admin)):
    update = {k: v for k, v in body.model_dump().items() if v is not None}
    if not update:
        raise HTTPException(status_code=400, detail="No fields to update")
    update["updated_at"] = datetime.now(timezone.utc).isoformat()
    res = await db.plans.update_one({"slug": slug.strip().lower()}, {"$set": update})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Plan not found")
    return await db.plans.find_one({"slug": slug.strip().lower()}, {"_id": 0})


@api_router.get("/admin/audit-logs")
async def admin_audit_logs(admin: dict = Depends(require_admin)):
    logs = await db.ai_audit_logs.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return logs


# ==========================================
# WhatsApp Payment Reminders (click-to-chat)
# ==========================================
def _wa_phone(raw: str) -> str:
    digits = "".join(c for c in (raw or "") if c.isdigit())
    if len(digits) == 10:
        digits = "91" + digits
    if digits.startswith("0") and len(digits) == 11:
        digits = "91" + digits[1:]
    return digits


@api_router.get("/reminders/pending")
async def reminders_pending(user: dict = Depends(get_current_user)):
    user_id = user.get("id") or str(user["_id"])
    profile = await db.company_profiles.find_one({"user_id": user_id}, {"_id": 0}) or {}
    biz_name = profile.get("company_name") or user.get("company_name") or "our business"
    upi = (profile.get("bank_details") or {}).get("upi_id", "")
    invs = await db.invoices.find(
        {"user_id": user_id, "status": {"$ne": "cancelled"}, "payment_status": {"$ne": "paid"}},
        {"_id": 0},
    ).sort("invoice_date", 1).to_list(500)
    today = date.today().isoformat()
    items = []
    for i in invs:
        buyer = i.get("buyer_details") or {}
        phone = _wa_phone(buyer.get("phone", ""))
        balance = round(i.get("balance_due", i.get("total_amount", 0)), 2)
        overdue = bool(i.get("invoice_date") and i.get("invoice_date") < (date.today().replace(day=1)).isoformat())
        msg = (
            f"Namaste {buyer.get('company_name', 'ji')}, "
            f"aapke invoice {i.get('invoice_number')} ka payment {_inr(balance)} pending hai. "
            f"Kripya jaldi payment karein."
            + (f" UPI: {upi}." if upi else "")
            + f"\n\nDhanyavaad,\n{biz_name}"
        )
        wa_link = (f"https://wa.me/{phone}?text=" + _url_quote(msg)) if phone else ""
        items.append({
            "invoice_id": i.get("id"),
            "invoice_number": i.get("invoice_number"),
            "customer": buyer.get("company_name", ""),
            "phone": buyer.get("phone", ""),
            "has_phone": bool(phone),
            "balance_due": balance,
            "invoice_date": i.get("invoice_date"),
            "overdue": overdue,
            "message": msg,
            "whatsapp_url": wa_link,
        })
    items.sort(key=lambda x: (not x["overdue"], -x["balance_due"]))
    return {"count": len(items), "total_outstanding": round(sum(x["balance_due"] for x in items), 2), "reminders": items}


# ==========================================
# Subscription payment receipts (GST-style)
# ==========================================
@api_router.get("/subscription/receipts")
async def subscription_receipts(user: dict = Depends(get_current_user)):
    user_id = user.get("id") or str(user["_id"])
    profile = await db.company_profiles.find_one({"user_id": user_id}, {"_id": 0}) or {}
    paid = await db.payment_transactions.find(
        {"user_id": user_id, "payment_status": "paid"}, {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    receipts = []
    for idx, p in enumerate(paid):
        gross = float(p.get("amount", 0))
        taxable = round(gross / 1.18, 2)  # price is GST-inclusive
        gst = round(gross - taxable, 2)
        created = p.get("created_at", "")
        rno = f"VYA-RCP-{(created[:10] or '').replace('-', '')}-{str(idx + 1).zfill(3)}"
        plan = await sub_svc.get_plan_doc(p.get("plan_slug", "pro")) or {}
        receipts.append({
            "receipt_number": rno,
            "date": created[:10],
            "plan_name": plan.get("name", p.get("plan_slug", "Pro")),
            "billing_cycle": p.get("billing_cycle"),
            "amount": round(gross, 2),
            "taxable_value": taxable,
            "gst_amount": gst,
            "cgst": round(gst / 2, 2),
            "sgst": round(gst / 2, 2),
            "gst_rate": 18,
            "currency": "INR",
            "session_id": p.get("session_id"),
            "seller_gstin": profile.get("gstin_number", ""),
            "buyer_name": user.get("company_name", ""),
        })
    return {"count": len(receipts), "receipts": receipts}


# ==========================================
# Analytics (advanced_analytics feature)
# ==========================================
@api_router.get("/analytics/overview")
async def analytics_overview(user: dict = Depends(get_current_user)):
    user_id = user.get("id") or str(user["_id"])
    if not await features_lib.has_feature(user_id, "advanced_analytics"):
        raise HTTPException(status_code=402, detail={"error": "upgrade_required", "feature": "advanced_analytics",
                                                     "message": "Advanced analytics is a Pro feature."})
    invoices = await db.invoices.find({"user_id": user_id, "status": {"$ne": "cancelled"}}, {"_id": 0}).to_list(5000)
    payments = await db.payments.find({"user_id": user_id, "status": "successful"}, {"_id": 0}).to_list(5000)

    # last 6 months buckets
    months = []
    cur = date.today().replace(day=1)
    for _ in range(6):
        months.append(cur.strftime("%Y-%m"))
        prev_month_last = cur - timedelta(days=1)
        cur = prev_month_last.replace(day=1)
    months = list(reversed(months))
    sales_by_month = {m: 0.0 for m in months}
    pay_by_month = {m: 0.0 for m in months}
    for i in invoices:
        d = (i.get("invoice_date") or "")[:7]
        if d in sales_by_month:
            sales_by_month[d] += i.get("total_amount", 0)
    for p in payments:
        d = (p.get("payment_date") or "")[:7]
        if d in pay_by_month:
            pay_by_month[d] += p.get("amount", 0)
    monthly = [{"month": m, "sales": round(sales_by_month[m], 2), "collected": round(pay_by_month[m], 2)} for m in months]

    # payment status breakdown
    status_counts = {"paid": 0, "partially_paid": 0, "unpaid": 0}
    for i in invoices:
        st = i.get("payment_status", "unpaid")
        status_counts[st] = status_counts.get(st, 0) + 1
    breakdown = [{"name": k, "value": v} for k, v in status_counts.items() if v > 0]

    top = await ai_data_svc.get_top_products(user_id, 6)
    total_sales = sum(i.get("total_amount", 0) for i in invoices)
    total_collected = sum(p.get("amount", 0) for p in payments)
    return {
        "monthly": monthly,
        "payment_breakdown": breakdown,
        "top_products": top["top_products"],
        "totals": {
            "total_sales": round(total_sales, 2),
            "total_collected": round(total_collected, 2),
            "outstanding": round(total_sales - total_collected, 2),
            "invoice_count": len(invoices),
        },
    }


# Include the router LAST so every route above is registered.
app.include_router(api_router)
