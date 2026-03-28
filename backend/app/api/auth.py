from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.security import verify_password, create_access_token
from app.api.deps import get_current_user
from app.models.user import User
from pydantic import BaseModel

router = APIRouter(prefix="/auth", tags=["auth"])

MAX_ATTEMPTS  = 5
LOCKOUT_MINUTES = 30


class Token(BaseModel):
    access_token: str
    token_type: str


class UserOut(BaseModel):
    id: int
    username: str
    email: str
    role: str
    member_id: int | None
    is_locked: bool = False

    class Config:
        from_attributes = True


def _is_locked(user: User) -> bool:
    if user.locked_until is None:
        return False
    return datetime.utcnow() < user.locked_until


@router.post("/login", response_model=Token)
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == form.username).first()

    # Unknown user → generic error (no info leak)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="Benutzername oder Passwort falsch.")

    # Account locked?
    if _is_locked(user):
        remaining = int((user.locked_until - datetime.utcnow()).total_seconds() / 60) + 1
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail=f"Konto gesperrt. Bitte warte noch {remaining} Minute(n) oder wende dich an einen Administrator.")

    # Wrong password?
    if not verify_password(form.password, user.hashed_password):
        user.failed_logins = (user.failed_logins or 0) + 1
        if user.failed_logins >= MAX_ATTEMPTS:
            user.locked_until = datetime.utcnow() + timedelta(minutes=LOCKOUT_MINUTES)
            db.commit()
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                                detail=f"Konto gesperrt nach {MAX_ATTEMPTS} fehlgeschlagenen Versuchen. Bitte wende dich an einen Administrator.")
        remaining_attempts = MAX_ATTEMPTS - user.failed_logins
        db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                            detail=f"Benutzername oder Passwort falsch. Noch {remaining_attempts} Versuch(e) vor der Sperrung.")

    # Inactive?
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="Dieses Konto ist deaktiviert.")

    # Success: reset counter
    user.failed_logins = 0
    user.locked_until  = None
    db.commit()

    token = create_access_token({"sub": user.username, "role": user.role})
    return {"access_token": token, "token_type": "bearer"}


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "username": current_user.username,
        "email": current_user.email,
        "role": current_user.role,
        "member_id": current_user.member_id,
        "is_locked": _is_locked(current_user),
    }


@router.post("/logout")
def logout():
    return {"message": "Logged out"}
