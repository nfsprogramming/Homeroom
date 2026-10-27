from __future__ import annotations

import hashlib
import hmac
import os
import secrets
import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Annotated, Literal

import jwt
from fastapi import Depends, FastAPI, HTTPException, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, EmailStr, Field
from pwdlib import PasswordHash
from sqlalchemy import Date, DateTime, ForeignKey, String, UniqueConstraint, create_engine, delete, select
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, relationship, sessionmaker


APP_ENV = os.getenv("APP_ENV", "development").strip().lower()
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./homeroom.db").strip()
if DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg://", 1)
SECRET_KEY = os.getenv("SECRET_KEY", "")
COOKIE_SECURE = os.getenv("COOKIE_SECURE", "false").lower() == "true"
COOKIE_SAMESITE = os.getenv("COOKIE_SAMESITE", "lax").lower()
ALLOWED_ORIGINS = [
    origin.strip().rstrip("/")
    for origin in os.getenv(
        "CORS_ORIGINS", "http://localhost:8080,http://127.0.0.1:8080"
    ).split(",")
    if origin.strip()
]
SESSION_HOURS = 8
SESSION_COOKIE = "homeroom_session"
CSRF_COOKIE = "homeroom_csrf"
password_hash = PasswordHash.recommended()

if APP_ENV == "production":
    if len(SECRET_KEY) < 32 or not os.getenv("DATABASE_URL"):
        raise RuntimeError("Production requires DATABASE_URL and a SECRET_KEY of at least 32 characters.")
    if not COOKIE_SECURE:
        raise RuntimeError("Production requires COOKIE_SECURE=true.")
    if COOKIE_SAMESITE == "none" and not os.getenv("CORS_ORIGINS"):
        raise RuntimeError("Cross-origin production (COOKIE_SAMESITE=none) requires CORS_ORIGINS.")
elif not SECRET_KEY:
    SECRET_KEY = "local-development-only-change-before-deploy-32"

if COOKIE_SAMESITE not in {"lax", "strict", "none"}:
    raise RuntimeError("COOKIE_SAMESITE must be lax, strict, or none.")

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {},
    pool_pre_ping=True,
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


class School(Base):
    __tablename__ = "schools"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(120))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class User(Base):
    __tablename__ = "users"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    school_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("schools.id", ondelete="CASCADE"), index=True)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(512))


class UserSession(Base):
    __tablename__ = "user_sessions"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    csrf_hash: Mapped[str] = mapped_column(String(64))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)


class ClassRoom(Base):
    __tablename__ = "classes"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    school_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("schools.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    grade: Mapped[str] = mapped_column(String(40))
    room: Mapped[str] = mapped_column(String(80), default="")
    teacher: Mapped[str] = mapped_column(String(120), default="")
    accent: Mapped[str] = mapped_column(String(12), default="teal")
    students: Mapped[list[Student]] = relationship(back_populates="classroom", cascade="all, delete-orphan")


class Student(Base):
    __tablename__ = "students"
    __table_args__ = (UniqueConstraint("class_id", "roll_no"),)
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    school_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("schools.id", ondelete="CASCADE"), index=True)
    class_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("classes.id", ondelete="CASCADE"), index=True)
    first_name: Mapped[str] = mapped_column(String(100))
    last_name: Mapped[str] = mapped_column(String(100))
    roll_no: Mapped[str] = mapped_column(String(20))
    classroom: Mapped[ClassRoom] = relationship(back_populates="students")
    attendance: Mapped[list[Attendance]] = relationship(back_populates="student", cascade="all, delete-orphan")


class Attendance(Base):
    __tablename__ = "attendance"
    __table_args__ = (UniqueConstraint("student_id", "date"),)
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    school_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("schools.id", ondelete="CASCADE"), index=True)
    student_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"), index=True)
    date: Mapped[date] = mapped_column(Date, index=True)
    status: Mapped[str] = mapped_column(String(12))
    student: Mapped[Student] = relationship(back_populates="attendance")


class SchoolInput(BaseModel):
    school_name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=12, max_length=128)


class Credentials(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class ClassInput(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    grade: str = Field(min_length=1, max_length=40)
    room: str = Field(default="", max_length=80)
    teacher: str = Field(default="", max_length=120)
    accent: Literal["teal", "olive", "ink"] = "teal"


class StudentInput(BaseModel):
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)


class StudentUpdate(StudentInput):
    pass


class MarkInput(BaseModel):
    student_id: uuid.UUID
    status: Literal["present", "late", "absent", "excused"]


class AttendanceInput(BaseModel):
    date: date
    marks: list[MarkInput] = Field(max_length=1000)


class ClearAttendanceInput(BaseModel):
    date: date
    student_ids: list[uuid.UUID] = Field(max_length=1000)


class StudentView(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    class_id: uuid.UUID
    first_name: str
    last_name: str
    roll_no: str


class ClassView(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    name: str
    grade: str
    room: str
    teacher: str
    accent: str


class AttendanceView(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    student_id: uuid.UUID
    date: date
    status: str


class Snapshot(BaseModel):
    classes: list[ClassView]
    students: list[StudentView]
    records: list[AttendanceView]


def get_db():
    with SessionLocal() as db:
        yield db


Db = Annotated[Session, Depends(get_db)]


def csrf_digest(token: str) -> str:
    return hmac.new(SECRET_KEY.encode(), token.encode(), hashlib.sha256).hexdigest()


def require_trusted_origin(request: Request) -> None:
    origin = request.headers.get("origin", "").rstrip("/")
    if not origin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Untrusted request origin")
    if origin in ALLOWED_ORIGINS:
        return
    request_origin = f"{request.url.scheme}://{request.url.netloc}".rstrip("/")
    if origin == request_origin:
        return
    raise HTTPException(status.HTTP_403_FORBIDDEN, "Untrusted request origin")


def get_current_session(request: Request, db: Db) -> tuple[User, UserSession]:
    token = request.cookies.get(SESSION_COOKIE)
    if not token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Sign in required")
    try:
        claims = jwt.decode(token, SECRET_KEY, algorithms=["HS256"], options={"require": ["sub", "exp"]})
        session_id = uuid.UUID(claims["sub"])
    except (jwt.PyJWTError, ValueError, KeyError) as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Session expired") from exc
    session = db.get(UserSession, session_id)
    if not session:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Session expired")
    expires_at = session.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at <= datetime.now(timezone.utc):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Session expired")
    user = db.get(User, session.user_id)
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Session expired")
    return user, session


def require_csrf(request: Request, session: tuple[User, UserSession] = Depends(get_current_session)) -> tuple[User, UserSession]:
    user, current = session
    require_trusted_origin(request)
    cookie = request.cookies.get(CSRF_COOKIE, "")
    header = request.headers.get("x-csrf-token", "")
    if not cookie or not header or not hmac.compare_digest(cookie, header):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Invalid CSRF token")
    if not hmac.compare_digest(csrf_digest(header), current.csrf_hash):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Invalid CSRF token")
    return user, current


def set_session(response: Response, user: User, db: Session) -> str:
    now = datetime.now(timezone.utc)
    db.execute(delete(UserSession).where(UserSession.expires_at < now))
    csrf_token = secrets.token_urlsafe(32)
    expires = now + timedelta(hours=SESSION_HOURS)
    session = UserSession(user_id=user.id, csrf_hash=csrf_digest(csrf_token), expires_at=expires)
    db.add(session)
    db.commit()
    token = jwt.encode({"sub": str(session.id), "exp": expires}, SECRET_KEY, algorithm="HS256")
    common = {
        "httponly": True,
        "secure": COOKIE_SECURE,
        "samesite": COOKIE_SAMESITE,
        "path": "/",
        "max_age": SESSION_HOURS * 3600,
    }
    response.set_cookie(SESSION_COOKIE, token, **common)
    response.set_cookie(CSRF_COOKIE, csrf_token, **common)
    return csrf_token


app = FastAPI(title="Homeroom API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Content-Type", "X-CSRF-Token"],
)


@app.on_event("startup")
def prepare_local_schema() -> None:
    if APP_ENV != "production" and os.getenv("AUTO_CREATE_SCHEMA", "true").lower() == "true":
        Base.metadata.create_all(engine)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/v1/auth/register", status_code=status.HTTP_201_CREATED)
def register(payload: SchoolInput, response: Response, db: Db, request: Request) -> dict[str, str]:
    require_trusted_origin(request)
    email = str(payload.email).lower()
    if db.scalar(select(User.id).where(User.email == email)):
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with that email already exists")
    school = School(name=payload.school_name.strip())
    db.add(school)
    db.flush()
    user = User(school_id=school.id, email=email, password_hash=password_hash.hash(payload.password))
    db.add(user)
    db.flush()
    csrf = set_session(response, user, db)
    return {"id": str(user.id), "email": user.email, "school_name": school.name, "csrf_token": csrf}


@app.post("/api/v1/auth/login")
def login(payload: Credentials, response: Response, db: Db, request: Request) -> dict[str, str]:
    require_trusted_origin(request)
    user = db.scalar(select(User).where(User.email == str(payload.email).lower()))
    if not user or not password_hash.verify(payload.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Email or password is incorrect")
    csrf = set_session(response, user, db)
    school = db.get(School, user.school_id)
    return {"id": str(user.id), "email": user.email, "school_name": school.name, "csrf_token": csrf}


@app.get("/api/v1/auth/session")
def session_info(request: Request, db: Db) -> dict[str, str]:
    user, current = get_current_session(request, db)
    csrf = request.cookies.get(CSRF_COOKIE, "")
    if not csrf or not hmac.compare_digest(csrf_digest(csrf), current.csrf_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Session expired")
    school = db.get(School, user.school_id)
    return {"id": str(user.id), "email": user.email, "school_name": school.name, "csrf_token": csrf}


@app.post("/api/v1/auth/logout")
def logout(response: Response, db: Db, auth: tuple[User, UserSession] = Depends(require_csrf)) -> dict[str, str]:
    _, current = auth
    db.delete(current)
    db.commit()
    response.delete_cookie(SESSION_COOKIE, path="/", secure=COOKIE_SECURE, httponly=True, samesite=COOKIE_SAMESITE)
    response.delete_cookie(CSRF_COOKIE, path="/", secure=COOKIE_SECURE, httponly=True, samesite=COOKIE_SAMESITE)
    return {"status": "signed out"}


@app.get("/api/v1/snapshot", response_model=Snapshot)
def snapshot(db: Db, auth: tuple[User, UserSession] = Depends(get_current_session)) -> Snapshot:
    user, _ = auth
    classes = db.scalars(select(ClassRoom).where(ClassRoom.school_id == user.school_id).order_by(ClassRoom.grade, ClassRoom.name)).all()
    students = db.scalars(select(Student).where(Student.school_id == user.school_id).order_by(Student.roll_no)).all()
    records = db.scalars(select(Attendance).where(Attendance.school_id == user.school_id)).all()
    return Snapshot(classes=classes, students=students, records=records)


@app.post("/api/v1/classes", response_model=ClassView, status_code=status.HTTP_201_CREATED)
def create_class(payload: ClassInput, db: Db, auth: tuple[User, UserSession] = Depends(require_csrf)) -> ClassRoom:
    user, _ = auth
    classroom = ClassRoom(school_id=user.school_id, **payload.model_dump())
    db.add(classroom)
    db.commit()
    db.refresh(classroom)
    return classroom


@app.delete("/api/v1/classes/{class_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_class(class_id: uuid.UUID, db: Db, auth: tuple[User, UserSession] = Depends(require_csrf)) -> Response:
    user, _ = auth
    classroom = db.scalar(select(ClassRoom).where(ClassRoom.id == class_id, ClassRoom.school_id == user.school_id))
    if not classroom:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Class not found")
    db.delete(classroom)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


def next_roll(db: Session, class_id: uuid.UUID) -> str:
    rolls = db.scalars(select(Student.roll_no).where(Student.class_id == class_id)).all()
    numbers = [int(value) for value in rolls if value.isdecimal()]
    return str(max(numbers, default=0) + 1).zfill(2)


@app.post("/api/v1/classes/{class_id}/students", response_model=StudentView, status_code=status.HTTP_201_CREATED)
def create_student(class_id: uuid.UUID, payload: StudentInput, db: Db, auth: tuple[User, UserSession] = Depends(require_csrf)) -> Student:
    user, _ = auth
    classroom = db.scalar(select(ClassRoom).where(ClassRoom.id == class_id, ClassRoom.school_id == user.school_id))
    if not classroom:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Class not found")
    student = Student(school_id=user.school_id, class_id=class_id, roll_no=next_roll(db, class_id), **payload.model_dump())
    db.add(student)
    db.commit()
    db.refresh(student)
    return student


@app.patch("/api/v1/students/{student_id}", response_model=StudentView)
def update_student(student_id: uuid.UUID, payload: StudentUpdate, db: Db, auth: tuple[User, UserSession] = Depends(require_csrf)) -> Student:
    user, _ = auth
    student = db.scalar(select(Student).where(Student.id == student_id, Student.school_id == user.school_id))
    if not student:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Student not found")
    for key, value in payload.model_dump().items():
        setattr(student, key, value.strip())
    db.commit()
    db.refresh(student)
    return student


@app.delete("/api/v1/students/{student_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_student(student_id: uuid.UUID, db: Db, auth: tuple[User, UserSession] = Depends(require_csrf)) -> Response:
    user, _ = auth
    student = db.scalar(select(Student).where(Student.id == student_id, Student.school_id == user.school_id))
    if not student:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Student not found")
    db.delete(student)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@app.put("/api/v1/attendance", status_code=status.HTTP_204_NO_CONTENT)
def save_attendance(payload: AttendanceInput, db: Db, auth: tuple[User, UserSession] = Depends(require_csrf)) -> Response:
    user, _ = auth
    ids = {mark.student_id for mark in payload.marks}
    if len(ids) != len(payload.marks):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Duplicate student in attendance marks")
    students = db.scalars(select(Student).where(Student.id.in_(ids), Student.school_id == user.school_id)).all() if ids else []
    if len(students) != len(ids):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "One or more students were not found")
    existing_rows = db.scalars(
        select(Attendance).where(
            Attendance.student_id.in_(ids),
            Attendance.date == payload.date,
        )
    ).all() if ids else []
    row_map = {row.student_id: row for row in existing_rows}
    for mark in payload.marks:
        row = row_map.get(mark.student_id)
        if row:
            row.status = mark.status
        else:
            db.add(Attendance(school_id=user.school_id, student_id=mark.student_id, date=payload.date, status=mark.status))
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@app.delete("/api/v1/attendance", status_code=status.HTTP_204_NO_CONTENT)
def clear_attendance_for_students(payload: ClearAttendanceInput, db: Db, auth: tuple[User, UserSession] = Depends(require_csrf)) -> Response:
    user, _ = auth
    ids = set(payload.student_ids)
    rows = db.scalars(
        select(Attendance).where(
            Attendance.school_id == user.school_id,
            Attendance.date == payload.date,
            Attendance.student_id.in_(ids),
        )
    ).all() if ids else []
    for row in rows:
        db.delete(row)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
