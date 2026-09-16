from motor.motor_asyncio import AsyncIOMotorClient
import os

mongo_url = os.environ.get('MONGO_URL')
db_name = os.environ.get('DB_NAME')
client = AsyncIOMotorClient(mongo_url)
db = client[db_name]


async def ensure_indexes():
    await db.users.create_index('email', unique=True)
    await db.businesses.create_index('id', unique=True)
    await db.plans.create_index('slug', unique=True)
    await db.subscriptions.create_index('id', unique=True)
    await db.subscriptions.create_index('business_id')
    await db.subscriptions.create_index('plan_slug')
    await db.payments.create_index('id', unique=True)
    await db.payments.create_index('subscription_id')
    await db.payments.create_index('razorpay_payment_id', unique=True)