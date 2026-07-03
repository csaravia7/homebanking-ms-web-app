from fastapi import FastAPI
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from os import getenv
import logging

# Configuration
SERVICE_NAME_VALUE = getenv("OTEL_SERVICE_NAME", "account-service")
PORT = int(getenv("PORT", 3003))

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# FastAPI app
app = FastAPI(title=SERVICE_NAME_VALUE, version="1.0.0")

# Models
class AccountBase(BaseModel):
    account_number: str
    account_type: str = "CHECKING"
    balance: float = 0.0
    currency: str = "USD"

class AccountCreate(AccountBase):
    user_id: int

class AccountUpdate(BaseModel):
    balance: Optional[float] = None
    status: Optional[str] = None

class AccountResponse(AccountBase):
    id: int
    user_id: int
    status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# Mock database
accounts_db = {}
next_id = 1

# Health check
@app.get("/health")
async def health():
    return {"status": "OK", "service": "account-service"}

# Create account
@app.post("/accounts", response_model=AccountResponse)
async def create_account(account: AccountCreate):
    global next_id
    account_id = next_id
    next_id += 1
    
    db_account = {
        "id": account_id,
        **account.dict(),
        "status": "ACTIVE",
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    accounts_db[account_id] = db_account
    logger.info(f"Account created: {account_id}")
    return db_account

# Get account
@app.get("/accounts/{account_id}", response_model=AccountResponse)
async def get_account(account_id: int):
    if account_id not in accounts_db:
        return {"error": "Account not found"}, 404
    return accounts_db[account_id]

# List accounts for user
@app.get("/accounts/user/{user_id}", response_model=List[AccountResponse])
async def list_accounts(user_id: int):
    user_accounts = [acc for acc in accounts_db.values() if acc["user_id"] == user_id]
    return user_accounts

# Update account
@app.put("/accounts/{account_id}", response_model=AccountResponse)
async def update_account(account_id: int, account_update: AccountUpdate):
    if account_id not in accounts_db:
        return {"error": "Account not found"}, 404
    
    account = accounts_db[account_id]
    update_data = account_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        if value is not None:
            account[field] = value
    
    account["updated_at"] = datetime.utcnow()
    return account

# Delete account
@app.delete("/accounts/{account_id}")
async def delete_account(account_id: int):
    if account_id not in accounts_db:
        return {"error": "Account not found"}, 404
    
    del accounts_db[account_id]
    return {"message": "Account deleted"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=PORT)
