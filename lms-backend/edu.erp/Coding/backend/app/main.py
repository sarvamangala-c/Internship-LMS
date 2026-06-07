from fastapi import FastAPI
from .api.v1.routes import router as api_router
from fastapi.middleware.cors import CORSMiddleware
from .db.models import Base
from .core.database import engine

# Disabled auto table creation - database schema is already finalized in HeidiSQL
# Base.metadata.create_all(bind=engine)

app = FastAPI()

# Configuration for CORS - allows React frontend to communicate with backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "*"],  # Allow specific origins and all for dev
    allow_credentials=True,         # Allow credentials
    allow_methods=["*"],            # Allow all HTTP methods
    allow_headers=["*"],            # Allow all headers
)

# Include the main API router with v1 prefix
app.include_router(api_router, prefix="/api/v1")

@app.get("/")
def read_root():
    return {"message": "Welcome to IonCudos API", "status": "Online"}