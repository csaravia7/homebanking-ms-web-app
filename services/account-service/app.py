from fastapi import FastAPI, HTTPException, Query, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from os import getenv
import logging
import uuid
import base64
import json
import random
from enum import Enum

from sqlalchemy import create_engine, Column, String, Float, ForeignKey
from sqlalchemy.orm import declarative_base, sessionmaker, relationship, Session

# Configuration
SERVICE_NAME_VALUE = getenv("OTEL_SERVICE_NAME", "account-service")
PORT = int(getenv("PORT", 3003))
DATABASE_URL = getenv(
    "DATABASE_URL",
    "postgresql+psycopg://homebank:secure123@localhost:5432/homebanking_db"
)

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ── Database setup ────────────────────────────────────────────────────────────
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# FastAPI app
app = FastAPI(title=SERVICE_NAME_VALUE, version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Enums
class AccountType(str, Enum):
    CHECKING = "CHECKING"
    SAVINGS = "SAVINGS"
    CREDIT = "CREDIT"

class CardType(str, Enum):
    DEBIT = "DEBIT"
    CREDIT = "CREDIT"
    PREPAID = "PREPAID"

class CardStatus(str, Enum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
    BLOCKED = "BLOCKED"
    EXPIRED = "EXPIRED"

class AccountStatus(str, Enum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
    CLOSED = "CLOSED"

# ── ORM Models ────────────────────────────────────────────────────────────────
class DBAccount(Base):
    __tablename__ = "accounts"

    id            = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    userId        = Column(String, nullable=False, index=True)
    accountNumber = Column(String, unique=True, nullable=False)
    accountType   = Column(String, nullable=False)
    balance       = Column(Float, default=0.0)
    currency      = Column(String, default="USD")
    status        = Column(String, default="ACTIVE")
    createdAt     = Column(String, nullable=False)
    updatedAt     = Column(String, nullable=False)

    cards = relationship("DBCard", back_populates="account", cascade="all, delete-orphan")


class DBCard(Base):
    __tablename__ = "cards"

    id              = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    accountId       = Column(String, ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False, index=True)
    cardNumber      = Column(String, unique=True, nullable=False)
    cardType        = Column(String, nullable=False)
    cardholderName  = Column(String, nullable=False)
    expiryDate      = Column(String, nullable=False)
    cvv             = Column(String, nullable=False)
    status          = Column(String, default="ACTIVE")
    balance         = Column(Float, nullable=True)
    creditLimit     = Column(Float, nullable=True)
    availableCredit = Column(Float, nullable=True)
    createdAt       = Column(String, nullable=False)
    updatedAt       = Column(String, nullable=False)

    account = relationship("DBAccount", back_populates="cards")


# Create tables if they don't exist yet
Base.metadata.create_all(bind=engine)

# Models - Card
class CardCreate(BaseModel):
    accountId: str
    cardType: CardType
    cardholderName: str

class CardResponse(BaseModel):
    id: str
    accountId: str
    cardNumber: str
    cardType: CardType
    cardholderName: str
    expiryDate: str
    cvv: str
    status: CardStatus
    balance: Optional[float] = None
    creditLimit: Optional[float] = None
    availableCredit: Optional[float] = None
    createdAt: str
    updatedAt: str

    class Config:
        from_attributes = True

# Models - Account
class AccountBase(BaseModel):
    accountType: AccountType = AccountType.CHECKING
    initialDeposit: float = 0.0
    currency: str = "USD"

class AccountCreate(AccountBase):
    pass

class AccountWithCardCreate(AccountBase):
    cardholderName: str
    cardType: CardType

class AccountUpdate(BaseModel):
    balance: Optional[float] = None
    status: Optional[AccountStatus] = None

class CardUpdate(BaseModel):
    status: Optional[CardStatus] = None
    balance: Optional[float] = None
    creditLimit: Optional[float] = None
    availableCredit: Optional[float] = None
    cardholderName: Optional[str] = None

class AccountResponse(BaseModel):
    id: str
    userId: str
    accountNumber: str
    accountType: AccountType
    balance: float
    currency: str
    status: AccountStatus
    cards: Optional[List[CardResponse]] = None
    createdAt: str
    updatedAt: str

    class Config:
        from_attributes = True

# ── Helper functions ──────────────────────────────────────────────────────────
def generate_account_number():
    return f"ACC{uuid.uuid4().hex[:12].upper()}"

def generate_card_number():
    return f"4532{random.randint(10000000, 99999999)}{random.randint(10000000, 99999999)}"

def generate_expiry_date():
    from datetime import timedelta
    future = datetime.utcnow() + timedelta(days=365*4)
    return f"{future.month:02d}/{future.year % 100:02d}"

def generate_cvv():
    return f"{random.randint(100, 999)}"

# ── Serialisation helpers ─────────────────────────────────────────────────────
def card_to_dict(c: DBCard) -> dict:
    return {
        "id": c.id, "accountId": c.accountId, "cardNumber": c.cardNumber,
        "cardType": c.cardType, "cardholderName": c.cardholderName,
        "expiryDate": c.expiryDate, "cvv": c.cvv, "status": c.status,
        "balance": c.balance, "creditLimit": c.creditLimit,
        "availableCredit": c.availableCredit,
        "createdAt": c.createdAt, "updatedAt": c.updatedAt,
    }

def account_to_dict(a: DBAccount, include_cards: bool = True) -> dict:
    d = {
        "id": a.id, "userId": a.userId, "accountNumber": a.accountNumber,
        "accountType": a.accountType, "balance": a.balance,
        "currency": a.currency, "status": a.status,
        "createdAt": a.createdAt, "updatedAt": a.updatedAt,
    }
    if include_cards:
        d["cards"] = [card_to_dict(c) for c in a.cards]
    return d

# ── Routes ────────────────────────────────────────────────────────────────────

def get_user_id_from_request(request: Request, query_userId: Optional[str] = None) -> str:
    """Extract userId from JWT token in Authorization header, or query param, or default."""
    if query_userId:
        return query_userId
    auth = request.headers.get("authorization", "")
    if auth.startswith("Bearer "):
        token = auth[7:]
        try:
            parts = token.split(".")
            if len(parts) == 3:
                payload = parts[1]
                # Add padding
                payload += "=" * (4 - len(payload) % 4)
                decoded = json.loads(base64.b64decode(payload).decode("utf-8"))
                uid = decoded.get("userId") or decoded.get("id") or decoded.get("sub")
                if uid:
                    return str(uid)
        except Exception:
            pass
    return "default-user"

# Health check
@app.get("/health")
async def health():
    return {"status": "OK", "service": "account-service"}

# Create account only
@app.post("/api/accounts", response_model=AccountResponse)
async def create_account(account: AccountCreate, request: Request,
                         user_id: str = Query(default=None), db: Session = Depends(get_db)):
    user_id = get_user_id_from_request(request, user_id)
    now = datetime.utcnow().isoformat()
    db_account = DBAccount(
        id=str(uuid.uuid4()), userId=user_id,
        accountNumber=generate_account_number(),
        accountType=account.accountType, balance=account.initialDeposit,
        currency=account.currency, status=AccountStatus.ACTIVE,
        createdAt=now, updatedAt=now,
    )
    db.add(db_account)
    db.commit()
    db.refresh(db_account)
    logger.info(f"Account created: {db_account.id} for user {user_id}")
    return account_to_dict(db_account)

# Create account with card (Onboarding)
@app.post("/api/accounts/with-card", response_model=AccountResponse)
async def create_account_with_card(account: AccountWithCardCreate, request: Request,
                                   user_id: str = Query(default=None), db: Session = Depends(get_db)):
    user_id = get_user_id_from_request(request, user_id)
    now = datetime.utcnow().isoformat()
    db_account = DBAccount(
        id=str(uuid.uuid4()), userId=user_id,
        accountNumber=generate_account_number(),
        accountType=account.accountType, balance=account.initialDeposit,
        currency=account.currency, status=AccountStatus.ACTIVE,
        createdAt=now, updatedAt=now,
    )
    db.add(db_account)
    db.flush()  # get db_account.id before creating card
    db_card = DBCard(
        id=str(uuid.uuid4()), accountId=db_account.id,
        cardNumber=generate_card_number(), cardType=account.cardType,
        cardholderName=account.cardholderName,
        expiryDate=generate_expiry_date(), cvv=generate_cvv(),
        status=CardStatus.ACTIVE, balance=account.initialDeposit,
        creditLimit=5000.0 if account.cardType == CardType.CREDIT else None,
        availableCredit=5000.0 if account.cardType == CardType.CREDIT else None,
        createdAt=now, updatedAt=now,
    )
    db.add(db_card)
    db.commit()
    db.refresh(db_account)
    logger.info(f"Account with card created: {db_account.id} for user {user_id}")
    return account_to_dict(db_account)

# Get account
@app.get("/api/accounts/{account_id}", response_model=AccountResponse)
async def get_account(account_id: str, db: Session = Depends(get_db)):
    a = db.query(DBAccount).filter(DBAccount.id == account_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Account not found")
    return account_to_dict(a)

# List accounts for user
@app.get("/api/accounts", response_model=List[AccountResponse])
async def list_accounts(request: Request, userId: str = Query(default=None),
                        db: Session = Depends(get_db)):
    userId = get_user_id_from_request(request, userId)
    accounts = db.query(DBAccount).filter(DBAccount.userId == userId).all()
    return [account_to_dict(a) for a in accounts]

# Update account
@app.put("/api/accounts/{account_id}", response_model=AccountResponse)
async def update_account(account_id: str, account_update: AccountUpdate,
                         db: Session = Depends(get_db)):
    a = db.query(DBAccount).filter(DBAccount.id == account_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Account not found")
    if account_update.balance is not None:
        a.balance = account_update.balance
    if account_update.status is not None:
        a.status = account_update.status
    a.updatedAt = datetime.utcnow().isoformat()
    db.commit()
    db.refresh(a)
    return account_to_dict(a)

# Delete account
@app.delete("/api/accounts/{account_id}")
async def delete_account(account_id: str, db: Session = Depends(get_db)):
    a = db.query(DBAccount).filter(DBAccount.id == account_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Account not found")
    db.delete(a)
    db.commit()
    logger.info(f"Account deleted: {account_id}")
    return {"message": "Account deleted successfully"}

# Get account cards
@app.get("/api/accounts/{account_id}/cards", response_model=List[CardResponse])
async def get_account_cards(account_id: str, db: Session = Depends(get_db)):
    a = db.query(DBAccount).filter(DBAccount.id == account_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Account not found")
    return [card_to_dict(c) for c in a.cards]

# Create card
@app.post("/api/cards", response_model=CardResponse)
async def create_card(card: CardCreate, db: Session = Depends(get_db)):
    a = db.query(DBAccount).filter(DBAccount.id == card.accountId).first()
    if not a:
        raise HTTPException(status_code=404, detail="Account not found")
    existing = db.query(DBCard).filter(
        DBCard.accountId == card.accountId, DBCard.cardType == card.cardType
    ).first()
    if existing:
        raise HTTPException(
            status_code=409,
            detail=f"A {card.cardType} card already exists for this account. Cannot create duplicate."
        )
    now = datetime.utcnow().isoformat()
    db_card = DBCard(
        id=str(uuid.uuid4()), accountId=card.accountId,
        cardNumber=generate_card_number(), cardType=card.cardType,
        cardholderName=card.cardholderName,
        expiryDate=generate_expiry_date(), cvv=generate_cvv(),
        status=CardStatus.ACTIVE, balance=a.balance,
        creditLimit=5000.0 if card.cardType == CardType.CREDIT else None,
        availableCredit=5000.0 if card.cardType == CardType.CREDIT else None,
        createdAt=now, updatedAt=now,
    )
    db.add(db_card)
    db.commit()
    db.refresh(db_card)
    logger.info(f"Card created: {db_card.id}")
    return card_to_dict(db_card)

# Get card
@app.get("/api/cards/{card_id}", response_model=CardResponse)
async def get_card(card_id: str, db: Session = Depends(get_db)):
    c = db.query(DBCard).filter(DBCard.id == card_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Card not found")
    return card_to_dict(c)

# List cards
@app.get("/api/cards", response_model=List[CardResponse])
async def list_cards(accountId: str = Query(default=None), db: Session = Depends(get_db)):
    q = db.query(DBCard)
    if accountId:
        q = q.filter(DBCard.accountId == accountId)
    return [card_to_dict(c) for c in q.all()]

# Update card
@app.put("/api/cards/{card_id}", response_model=CardResponse)
async def update_card(card_id: str, card_update: CardUpdate, db: Session = Depends(get_db)):
    c = db.query(DBCard).filter(DBCard.id == card_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Card not found")
    for field, value in card_update.dict(exclude_unset=True).items():
        if value is not None:
            setattr(c, field, value)
    c.updatedAt = datetime.utcnow().isoformat()
    db.commit()
    db.refresh(c)
    return card_to_dict(c)

# Block card
@app.patch("/api/cards/{card_id}/block")
async def block_card(card_id: str, db: Session = Depends(get_db)):
    c = db.query(DBCard).filter(DBCard.id == card_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Card not found")
    c.status = CardStatus.BLOCKED
    c.updatedAt = datetime.utcnow().isoformat()
    db.commit()
    db.refresh(c)
    return card_to_dict(c)

# Activate card
@app.patch("/api/cards/{card_id}/activate")
async def activate_card(card_id: str, db: Session = Depends(get_db)):
    c = db.query(DBCard).filter(DBCard.id == card_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Card not found")
    c.status = CardStatus.ACTIVE
    c.updatedAt = datetime.utcnow().isoformat()
    db.commit()
    db.refresh(c)
    return card_to_dict(c)

# Delete card
@app.delete("/api/cards/{card_id}")
async def delete_card(card_id: str, db: Session = Depends(get_db)):
    c = db.query(DBCard).filter(DBCard.id == card_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Card not found")
    
    del cards_db[card_id]
    logger.info(f"Card deleted: {card_id}")
    return {"message": "Card deleted successfully"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=PORT)
