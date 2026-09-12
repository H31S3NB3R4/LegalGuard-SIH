#!/usr/bin/env python3
"""
Flask Backend for Amazon Product Scraper
Integrates AI Router, MySQL Database, Multiple Scrapers, and AI Compliance Module
"""

from flask import Flask, request, jsonify, session, send_file, abort
import io
from flask_cors import CORS
import mysql.connector
from mysql.connector import Error
import hashlib
import os
import re
import hmac
import uuid
import requests
from datetime import datetime
import json
import google.generativeai as genai
import decimal
import ai_guard
# Phase 11 / TODO #5: real, per-product AI assessment (replaces the canned string).
import assessment as assessment_gen
import bcrypt
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

from dotenv import load_dotenv

# Windows consoles and redirected logs default to cp1252, which cannot encode
# characters like '→' used in log messages below — those prints would crash routes
# (e.g. /api/chat). Force UTF-8 on stdout/stderr so log lines never raise.
import sys
for _stream in (sys.stdout, sys.stderr):
    if _stream is not None and hasattr(_stream, 'reconfigure'):
        try:
            _stream.reconfigure(encoding='utf-8', errors='replace')
        except Exception:
            pass

# Load .env FIRST so every configuration read below (secret key, DB, API key) sees it
load_dotenv()

# Import scraper modules (assuming they're in the same directory)
import amazon_scraper.amazon as amazon
import amazon_scraper.book as book
import amazon_scraper.electric as electric
import amazon_scraper.food as food
import amazon_scraper.skincare as skincare
import amazon_scraper.search as search
import chatbot_compliance
import comply as comply

# Import AI Compliance Module
import compliance
import compliance_copy
from datetime import timedelta

app = Flask(__name__)
app.secret_key = os.getenv("FLASK_SECRET_KEY")
if not app.secret_key:
    import secrets as _secrets
    app.secret_key = _secrets.token_hex(32)
    print("[WARN] FLASK_SECRET_KEY not set — using an ephemeral key; sessions will NOT survive restarts (demo mode).")
app.permanent_session_lifetime = timedelta(hours=24)
CORS(app, 
     origins=["http://localhost:3000"],  # Your frontend URL
     supports_credentials=True,
     allow_headers=["Content-Type"],
     methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"])

# ==================== CONFIGURATION ====================

# Rate limiting (flask-limiter). Uses in-memory storage by default; swap to Redis
# in a multi-worker production deployment. Protects auth + expensive AI endpoints.
limiter = Limiter(
    key_func=get_remote_address,
    app=app,
    default_limits=["200 per hour"],
    storage_uri="memory://",
)
DEFAULT_RATE_LIMIT_MSG = "Rate limit exceeded. Please slow down and try again in a moment."

# Phase 11 / TODO #9: hard request-size ceiling. Anything bigger is rejected
# by Werkzeug before Flask routes run — protects against oversized uploads
# even on endpoints without explicit image validation.
app.config['MAX_CONTENT_LENGTH'] = 64 * 1024 * 1024  # 64 MB

@app.errorhandler(413)
def handle_too_large(e):
    return jsonify({
        'error': 'Upload is too large. Maximum total request size is 64 MB — '
                 'please reduce the number or size of your images.'
    }), 413


# Global sanitized error handler: never leak tracebacks to clients.
# It deliberately defers HTTPExceptions (404/400/403/...) to Flask's normal
# handling so abort() and validation responses keep their intended status codes.
from werkzeug.exceptions import HTTPException

@app.errorhandler(Exception)
def handle_unhandled_exception(e):
    if isinstance(e, HTTPException):
        return e
    request_id = uuid.uuid4().hex[:12]
    import traceback
    print(f"[UNHANDLED {request_id}] {e}")
    traceback.print_exc()
    return jsonify({
        'error': 'internal_error',
        'message': 'An unexpected server error occurred.',
        'request_id': request_id
    }), 500

# Friendlier rate-limit message than flask-limiter's default.
@app.errorhandler(429)
def handle_rate_limit(e):
    return jsonify({'error': DEFAULT_RATE_LIMIT_MSG}), 429

# MySQL Configuration
DB_CONFIG = {
    'host': os.getenv('DB_HOST'),
    'user': os.getenv('DB_USER'),
    'password': os.getenv('DB_PASSWORD'),
    'database': os.getenv('DB_NAME'),
    'port': int(os.getenv('DB_PORT', 3306))
}

# GCP Generative AI Configuration (key from environment only; demo mode when absent)
GOOGLE_API_KEY = os.getenv('GOOGLE_API_KEY')
AI_AVAILABLE = bool(GOOGLE_API_KEY)
DEMO_MODE = not AI_AVAILABLE
if AI_AVAILABLE:
    genai.configure(api_key=GOOGLE_API_KEY)
    model = genai.GenerativeModel('gemini-2.5-flash')
else:
    model = None
    print("[WARN] GOOGLE_API_KEY not set — running in DEMO MODE: AI routing/compliance will use graceful fallbacks.")

# ==================== DATABASE CONNECTION ====================

def get_db_connection():
    """Create and return a database connection"""
    try:
        connection = mysql.connector.connect(**DB_CONFIG)
        return connection
    except Error as e:
        print(f"[ERROR] Database connection failed: {e}")
        return None

def require_product_owner(product_id: int, user_id: int):
    """Return (product_row, None) if `user_id` owns `product_id`, else (None, (flask_response, code)).

    Callers: `row, err = require_product_owner(...); if err: return err`
    """
    connection = get_db_connection()
    if not connection:
        return None, (jsonify({'error': 'Database connection failed'}), 500)
    try:
        cursor = connection.cursor(dictionary=True)
        cursor.execute("SELECT user_id FROM Products WHERE product_id = %s", (product_id,))
        row = cursor.fetchone()
        cursor.close()
        connection.close()
    except Error:
        return None, (jsonify({'error': 'Database error'}), 500)

    if not row:
        return None, (jsonify({'error': 'Product not found'}), 404)
    if int(row['user_id']) != int(user_id):
        return None, (jsonify({'error': 'Forbidden'}), 403)
    return row, None

def demo_compliance_report(category: str = 'amazon') -> dict:
    """Graceful demo-mode report returned when GOOGLE_API_KEY is not configured.

    Mirrors the response shape of the real compliance modules so the frontend
    renders it normally. Because NO real analysis is performed, the report must
    NOT claim compliance or readiness for upload — doing so would mislead
    sellers/consumers (audit PHASE 15). Every report is tagged demo_mode=True
    and flags the product as not-compliant / pending action.
    """
    return {
        'demo_mode': True,
        'analysis_status': 'demo_pending',
        'category': category,
        'analysis_date': datetime.now().isoformat(),
        'compliance_score': 0,
        'compliance_grade': 'N/A',
        'is_compliant': False,
        'requires_action': True,
        'ready_for_upload': False,
        'estimated_approval_chance': 'Not determined (demo mode)',
        'violation_summary': {'high': 0, 'medium': 1, 'low': 1, 'total': 2},
        'high_priority_issues': [{
            'requirement': 'Compliance analysis not performed (demo mode)',
            'description': 'No Gemini OCR/rule analysis ran because GOOGLE_API_KEY is not configured. This product is NOT confirmed compliant and is NOT ready for upload.',
            'notes': 'Set GOOGLE_API_KEY in .env to run a real compliance analysis.',
            'penalty': 0
        }],
        'medium_priority_issues': [{
            'requirement': 'AI analysis skipped (demo mode)',
            'description': 'GOOGLE_API_KEY is not configured, so no real compliance verdict was produced. The compliance result below is placeholder feedback only.',
            'notes': 'Set GOOGLE_API_KEY in .env to enable real compliance analysis.',
            'penalty': 0
        }],
        'low_priority_issues': [{
            'requirement': 'Legal Metrology rules not evaluated (demo mode)',
            'description': 'Rule checks were not executed because the Gemini API key is missing.',
            'penalty': 0
        }],
        'recommendations': [
            'Configure GOOGLE_API_KEY in .env to enable full AI compliance analysis.',
            'Do NOT treat this product as compliant or ready for upload until a real analysis completes.'
        ],
        # Phase 11: honest demo assessment (clearly says no real analysis ran).
        'assessment': (
            'Demo mode: no real compliance analysis was performed because '
            'GOOGLE_API_KEY is not configured. This product has NOT been verified '
            'against the Legal Metrology (Packaged Commodities) Rules — set the '
            'API key and re-run the analysis to get a real score, violations and '
            'assessment.'
        )
    }

# ==================== UPLOAD VALIDATION (Phase 11 / TODO #9) ====================

# Allowed image types for seller pre-upload checks (extension + magic bytes).
UPLOAD_ALLOWED_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.webp'}
UPLOAD_MAX_FILES = 10                 # preserved 10-file limit
UPLOAD_MAX_FILE_MB = 8               # per-file cap
UPLOAD_MAX_TOTAL_MB = 40             # total payload cap across all images
_MB = 1024 * 1024

# Magic-byte signatures for the allowed formats (prefix -> real type label).
_MAGIC = [
    (b'\xff\xd8\xff', 'JPEG'),
    (b'\x89PNG\r\n\x1a\n', 'PNG'),
    (b'RIF', 'WEBP'),  # RIFF container (WEBP): 'RIFF....WEBP'
]


def _sniff_image_type(blob: bytes) -> str:
    """Return 'JPEG' | 'PNG' | 'WEBP' | '' by inspecting magic bytes."""
    if not blob:
        return ''
    for sig, label in _MAGIC:
        if blob.startswith(sig):
            if label == 'WEBP':
                return 'WEBP' if blob[8:12] == b'WEBP' else ''
            return label
    return ''


def validate_upload_images(image_files):
    """
    Validate uploaded seller images BEFORE anything is sent to the AI layer.

    Returns (image_blobs, error_response):
      image_blobs — list[bytes] of validated images (empty on any failure)
      error_response — None when valid; otherwise a (jsonify, status) tuple
                       with a friendly, specific message.

    Checks (friendly 400s, never raw exceptions):
      1. at least one file, at most UPLOAD_MAX_FILES
      2. allowed extension (.jpg/.jpeg/.png/.webp)
      3. allowed content (magic-byte sniff) — an .exe renamed to .png fails
      4. per-file size <= UPLOAD_MAX_FILE_MB
      5. total size <= UPLOAD_MAX_TOTAL_MB
    """
    if not image_files:
        return [], (jsonify({
            'error': 'At least one product image is required.'
        }), 400)

    if len(image_files) > UPLOAD_MAX_FILES:
        return [], (jsonify({
            'error': f'Too many images uploaded ({len(image_files)}). '
                     f'Please provide at most {UPLOAD_MAX_FILES} images.'
        }), 400)

    image_blobs = []
    total_size = 0
    for idx, img_file in enumerate(image_files, start=1):
        # --- 1) extension check ---
        filename = (getattr(img_file, 'filename', '') or '').lower()
        ext = os.path.splitext(filename)[1]
        if ext not in UPLOAD_ALLOWED_EXTENSIONS:
            return [], (jsonify({
                'error': f'Image {idx} ("{filename or "unnamed"}") has an unsupported file type. '
                         f'Allowed formats: JPG, PNG, WEBP.'
            }), 400)

        # --- 2) read + size check ---
        try:
            blob = img_file.read()
        except Exception:
            return [], (jsonify({
                'error': f'Image {idx} could not be read. The upload may be corrupted — please re-attach it.'
            }), 400)
        if not blob:
            return [], (jsonify({
                'error': f'Image {idx} is empty. Please attach a valid product photo.'
            }), 400)
        if len(blob) > UPLOAD_MAX_FILE_MB * _MB:
            return [], (jsonify({
                'error': f'Image {idx} is too large ({len(blob) // _MB} MB). '
                         f'Maximum allowed per image is {UPLOAD_MAX_FILE_MB} MB.'
            }), 400)

        # --- 3) magic-byte content check (blocks renamed executables/text) ---
        sniffed = _sniff_image_type(blob)
        if not sniffed:
            return [], (jsonify({
                'error': f'Image {idx} does not appear to be a valid image file. '
                         f'Allowed formats: JPG, PNG, WEBP.'
            }), 400)

        total_size += len(blob)
        if total_size > UPLOAD_MAX_TOTAL_MB * _MB:
            return [], (jsonify({
                'error': f'Total upload size exceeds the {UPLOAD_MAX_TOTAL_MB} MB limit. '
                         f'Please reduce the number or size of images.'
            }), 400)

        image_blobs.append(blob)

    return image_blobs, None

# ==================== AI ROUTER (STEP 1) ====================

def ai_router(url: str) -> dict:
    """
    Uses Google Generative AI to determine which scraper to use.
    Returns the scraped product data.
    """
    print(f"[AI ROUTER] Analyzing URL: {url}")
    
    # Prompt for AI
    prompt = f"""
    Analyze this Amazon product URL and determine the product category:
    URL: {url}
    
    Categories available:
    - book: For novels, textbooks, any printed books
    - food: For food items, snacks, beverages, groceries
    - skincare: For beauty products, cosmetics, skincare items
    - electric: For electronics, computers, gaming devices
    - amazon: For anything else (default)
    
    Respond with ONLY ONE WORD - the category name (book, food, skincare, electric, or amazon).
    """
    
    valid_categories = ['book', 'food', 'skincare', 'electric', 'amazon']
    category = None

    if AI_AVAILABLE:
        try:
            response = model.generate_content(prompt)
            candidate = response.text.strip().lower()
            if candidate in valid_categories:
                category = candidate
                print(f"[AI ROUTER] SUCCESS: Detected category: {category}")
            else:
                print(f"[AI ROUTER] Invalid category '{candidate}', using URL heuristics")
        except Exception as e:
            print(f"[AI ROUTER] WARNING: AI analysis failed: {e}")
    else:
        print("[AI ROUTER] Gemini unavailable (demo mode) — using URL-based heuristics")

    # Fallback: Simple URL/keyword analysis
    if category is None:
        url_lower = url.lower()
        if '/books/' in url_lower or 'book' in url_lower:
            category = 'book'
        elif 'food' in url_lower or 'grocery' in url_lower or 'snack' in url_lower:
            category = 'food'
        elif 'beauty' in url_lower or 'skincare' in url_lower or 'cosmetic' in url_lower:
            category = 'skincare'
        elif 'electronics' in url_lower or 'computer' in url_lower or 'gaming' in url_lower:
            category = 'electric'
        else:
            category = 'amazon'
        print(f"[AI ROUTER] Fallback detected category: {category}")
    
    # Map category to scraper
    scraper_map = {
        'book': book.AmazonScraper(),
        'food': food.AmazonScraper(),
        'skincare': skincare.AmazonScraper(),
        'electric': electric.AmazonScraper(),
        'amazon': amazon.AmazonScraper()
    }
    
    scraper = scraper_map.get(category, amazon.AmazonScraper())
    
    # Execute scraping
    product_data = scraper.scrape_product(url)
    
    if product_data:
        product_data['detected_category'] = category
        return product_data
    else:
        return None

# ==================== HELPER FUNCTIONS ====================

def hash_password(password: str) -> str:
    """Secure password hashing using bcrypt (salted, adaptive)."""
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def legacy_sha256_hash(password: str) -> str:
    """Legacy unsalted SHA-256 hash used before migration to bcrypt."""
    return hashlib.sha256(password.encode('utf-8')).hexdigest()

def is_legacy_hash(stored: str) -> bool:
    """True if `stored` is an old unsalted SHA-256 (64 hex chars) hash."""
    return bool(stored) and re.fullmatch(r'[0-9a-fA-F]{64}', stored)

def verify_password(password: str, stored: str):
    """Verify `password` against `stored`. Returns (ok: bool, needs_rehash: bool).

    - New bcrypt hashes are verified with bcrypt.checkpw.
    - Legacy unsalted SHA-256 hashes are compared with hmac.compare_digest and
      flagged for transparent rehash on next successful login.
    """
    if not stored:
        return False, False
    if is_legacy_hash(stored):
        ok = hmac.compare_digest(legacy_sha256_hash(password), stored)
        return ok, ok
    try:
        ok = bcrypt.checkpw(password.encode('utf-8'), stored.encode('utf-8'))
        return ok, False
    except (ValueError, TypeError):
        return False, False

def extract_asin_from_url(url: str) -> str:
    """Extract ASIN from Amazon URL"""
    match = re.search(r'/(?:dp|gp/product)/([A-Z0-9]{9,13})', url)
    return match.group(1) if match else None

def download_image(image_url: str) -> bytes:
    """Download image and return as bytes"""
    try:
        response = requests.get(image_url, timeout=10)
        if response.status_code == 200:
            return response.content
        return None
    except Exception as e:
        print(f"[ERROR] Failed to download image: {e}")
        return None

def get_location_from_ip(ip_address: str) -> dict:
    """
    Get geographic location from IP address for heatmap generation.
    Uses ipapi.co free tier (1000 requests/day).
    """
    try:
        response = requests.get(f'https://ipapi.co/{ip_address}/json/', timeout=5)
        if response.status_code == 200:
            data = response.json()
            return {
                'location': f"{data.get('city', 'Unknown')}, {data.get('region', '')}, {data.get('country_name', '')}",
                'latitude': data.get('latitude'),
                'longitude': data.get('longitude'),
                'city': data.get('city'),
                'country': data.get('country_name')
            }
    except Exception as e:
        print(f"[WARNING] Failed to get location from IP: {e}")
    
    return {
        'location': 'Unknown',
        'latitude': None,
        'longitude': None,
        'city': None,
        'country': None
    }

def log_customer_scrape_activity(product_data: dict, seller_id: int, customer_id: int, asin: str, customer_ip: str = None):
    """
    Log when a CUSTOMER scrapes a SELLER's product.
    Safely handles missing seller_information or location fields.
    """
    connection = get_db_connection()
    if not connection:
        return
    
    # Safe location extraction
    try:
        location_data = get_location_from_ip(customer_ip) if customer_ip else {}
    except:
        location_data = {}

    location = location_data.get('location', 'Unknown')
    latitude = location_data.get('latitude')
    longitude = location_data.get('longitude')

    # Safe seller_information extraction
    try:
        seller_info = product_data.get('seller')
        seller_info_json = json.dumps(seller_info) if seller_info else None
    except:
        seller_info_json = None

    cursor = connection.cursor()
    query = """
        INSERT INTO SellerActivity 
        (seller_id, customer_id, action, seller_information, location, latitude, longitude, timestamp)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
    """

    action = f"Customer scraped product ASIN {asin}"

    try:
        cursor.execute(query, (
            None,
            customer_id,
            action,
            seller_info_json,
            location,
            latitude,
            longitude,
            datetime.now()
        ))

        connection.commit()
        print(f"[LOG] Customer activity logged: Seller {seller_id}, Customer {customer_id}, Location: {location}")

    except Error as e:
        print(f"[ERROR] Failed to log customer activity (non-critical): {e}")
        try:
            connection.commit()
        except:
            pass

    finally:
        cursor.close()
        connection.close()


def log_seller_own_activity(product_data: dict, seller_id: int, action: str, seller_ip: str = None):
    """
    Log when a SELLER scrapes their own product.
    Safely handles missing seller_information or location fields.
    """
    connection = get_db_connection()
    if not connection:
        return

    # Safe location extraction
    try:
        location_data = get_location_from_ip(seller_ip) if seller_ip else {}
    except:
        location_data = {}

    location = location_data.get('location', 'Unknown')
    latitude = location_data.get('latitude')
    longitude = location_data.get('longitude')

    # Safe seller_information extraction
    try:
        seller_info = product_data.get('seller')
        seller_info_json = json.dumps(seller_info) if seller_info else None
    except:
        seller_info_json = None

    cursor = connection.cursor()
    query = """
        INSERT INTO SellerActivity 
        (seller_id, customer_id, action, seller_information, location, latitude, longitude, timestamp)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
    """

    try:
        cursor.execute(query, (
            seller_id,
            None,
            action,
            seller_info_json,
            location,
            latitude,
            longitude,
            datetime.now()
        ))

        connection.commit()
        print(f"[LOG] Seller own activity logged: {action}")

    except Error as e:
        print(f"[ERROR] Failed to log seller activity (non-critical): {e}")
        try:
            connection.commit()
        except:
            pass

    finally:
        cursor.close()
        connection.close()


# ==================== HEALTH CHECK ====================

@app.route('/api/health', methods=['GET'])
def health_check():
    """Lightweight health probe used by the browser extension.

    Returns 200 as long as the Flask process is up. Also reports database
    connectivity (non-fatal) and whether the current session is logged in,
    which is handy for debugging the extension connection.
    """
    db_ok = False
    try:
        conn = get_db_connection()
        if conn is not None:
            db_ok = conn.is_connected()
            conn.close()
    except Exception as e:
        print(f"[HEALTH] DB check failed: {e}")

    return jsonify({
        'status': 'ok' if db_ok else 'degraded',
        'service': 'legalguard-backend',
        'database': 'connected' if db_ok else 'unavailable',
        'ai_available': AI_AVAILABLE,
        'demo_mode': DEMO_MODE,
        'logged_in': bool(session.get('logged_in')),
        'timestamp': datetime.utcnow().isoformat() + 'Z'
    }), 200


# ==================== AUTHENTICATION ENDPOINTS ====================

@app.route('/api/signup', methods=['POST'])
@limiter.limit("10 per hour")
def signup():
    """User registration endpoint"""
    data = request.json
    username = data.get('username')
    password = data.get('password')
    role = data.get('role', 'customer')  # Default to customer
    
    if not username or not password:
        return jsonify({'error': 'Username and password required'}), 400
    
    if role not in ['customer', 'seller']:
        return jsonify({'error': 'Invalid role. Must be customer or seller'}), 400
    
    connection = get_db_connection()
    if not connection:
        return jsonify({'error': 'Database connection failed'}), 500
    
    cursor = connection.cursor()
    
    # Check if username exists
    cursor.execute("SELECT id FROM Users WHERE username = %s", (username,))
    if cursor.fetchone():
        cursor.close()
        connection.close()
        return jsonify({'error': 'Username already exists'}), 409
    
    # Insert new user
    hashed_pw = hash_password(password)
    query = "INSERT INTO Users (username, password, role) VALUES (%s, %s, %s)"
    
    try:
        cursor.execute(query, (username, hashed_pw, role))
        connection.commit()
        user_id = cursor.lastrowid
        
        cursor.close()
        connection.close()
        
        return jsonify({
            'message': 'User created successfully',
            'user_id': user_id,
            'username': username,
            'role': role
        }), 201
        
    except Error as e:
        cursor.close()
        connection.close()
        return jsonify({'error': f'Failed to create user: {str(e)}'}), 500

@app.route('/api/login', methods=['POST'])
@limiter.limit("10 per minute")
def login():
    """User login endpoint"""
    data = request.json
    username = data.get('username')
    password = data.get('password')
    
    if not username or not password:
        return jsonify({'error': 'Username and password required'}), 400
    
    connection = get_db_connection()
    if not connection:
        return jsonify({'error': 'Database connection failed'}), 500

    cursor = connection.cursor(dictionary=True)

    query = "SELECT id, username, role, password FROM Users WHERE username = %s"
    cursor.execute(query, (username,))
    user = cursor.fetchone()

    if not user:
        cursor.close()
        connection.close()
        return jsonify({'error': 'Invalid credentials'}), 401

    ok, needs_rehash = verify_password(password, user.get('password'))

    if needs_rehash:
        # Transparently upgrade a legacy unsalted SHA-256 hash to bcrypt.
        new_hash = hash_password(password)
        cursor.execute("UPDATE Users SET password=%s WHERE id=%s", (new_hash, user['id']))
        connection.commit()

    cursor.close()
    connection.close()

    if ok:
        # Set session
        session.permanent = True
        session['user_id'] = user['id']
        session['username'] = user['username']
        session['role'] = user['role']
        session['logged_in'] = True

        return jsonify({
            'message': 'Login successful',
            'user': {
                'id': user['id'],
                'username': user['username'],
                'role': user['role']
            }
        }), 200
    else:
        return jsonify({'error': 'Invalid credentials'}), 401

@app.route('/api/logout', methods=['POST'])
def logout():
    """User logout endpoint"""
    session.clear()
    return jsonify({'message': 'Logged out successfully'}), 200

# ==================== SCRAPING ENDPOINT ====================

from flask import request, jsonify, session
import json
import base64
from mysql.connector import Error

def detect_scraper_category(product_data: dict) -> str:
    """Heuristic detection of scraper/category from returned keys."""
    if not isinstance(product_data, dict):
        return "unknown"
    keys = set(product_data.keys())
    # Book scrapers often have 'about_author' or 'ISBN' inside product_details
    if "about_author" in keys or any("ISBN" in k for k in (product_data.get("product_details") or {})):
        return "book"
    # Food scrapers often have nutrition/ingredients/important_info/product_metadata
    if "nutrition_info" in keys or "important_info" in keys or "product_metadata" in keys:
        return "food"
    # Skincare / beauty often provide 'important_info' and 'product_metadata' too,
    # but may include 'Safety Information' in important_info.
    if "important_info" in keys and ("Ingredients" in (product_data.get("important_info") or {} ) or "Safety Information" in (product_data.get("important_info") or {})):
        return "skincare"
    # Electronics / general produce 'technical_details' or 'additional_info'
    if "technical_details" in keys or "additional_info" in keys or "specifications" in keys:
        return "electronics"
    # Fallback: if feature_bullets present => general/grocery/retail
    if "feature_bullets" in keys:
        return "general"
    return "unknown"

def normalize_scraper_output(data: dict) -> dict:
    """
    Normalize different scraper outputs into a consistent DB schema.
    Keep fields that are common and also copy scraper-specific blocks under names.
    """
    if not isinstance(data, dict):
        return {}

    # canonical top-level fields (first-class)
    normalized = {
        "url": data.get("url"),
        "asin": data.get("asin"),
        "title": data.get("title"),
        "price": data.get("price"),
        "currency": data.get("currency"),
        "country": data.get("country"),
        "language": data.get("language"),
        "rating": data.get("rating"),
        "reviews_count": data.get("reviews_count"),
        "availability": data.get("availability"),
        "shipping_details": data.get("shipping_details") or data.get("shipping") or None,
        "detected_category": data.get("detected_category") or detect_scraper_category(data),
        # Primary descriptive buckets (fallbacks in order)
        "description": data.get("description") or data.get("about_product") or None,
        "feature_bullets": data.get("feature_bullets") or data.get("highlights") or [],
        "about_author": data.get("about_author") or None,
        # specs/tech/product details (merge sensible sources)
        "product_details": data.get("product_details") or data.get("product_metadata") or data.get("product_information") or {},
        "specifications": data.get("specifications") or data.get("technical_details") or {},
        "important_information": data.get("important_information") or data.get("important_info") or {},
        # food/skincare specific
        "ingredients": data.get("ingredients") or (data.get("important_info") or {}).get("Ingredients") or None,
        "nutrition_info": data.get("nutrition_info") or (data.get("important_info") or {}).get("Nutrition") or None,
        # seller block preserved
        "seller_information": data.get("seller"),
        # any other captured raw buckets kept for debugging / QA
        "extra": {}
    }

    # Preserve common named extras that appear per-scraper
    for key in ("additional_info", "product_metadata", "important_info", "technical_details", "about_author", "product_json"):
        if key in data and data[key] is not None:
            normalized["extra"][key] = data[key]

    # Images: many scrapers use 'images' but some use 'image_urls' or 'img' — fallback chain
    imgs = data.get("images") or data.get("image_urls") or data.get("image_list") or []
    # ensure list
    if isinstance(imgs, str):
        imgs = [imgs]
    normalized["images"] = imgs

    return normalized

@app.route('/api/scrape', methods=['POST'])
def scrape_product():
    """Main scraping endpoint with database integration + AUTO compliance analysis + selleractivity logging"""
    # ---------------------------------------------------
    # AUTH CHECK
    # ---------------------------------------------------
    if not session.get('logged_in'):
        return jsonify({'error': 'Authentication required'}), 401

    user_id = session.get('user_id')
    user_role = session.get('role')

    data = request.json or {}
    url = data.get('url')
    auto_analyze = data.get('auto_analyze', True)

    if not url:
        return jsonify({'error': 'URL is required'}), 400

    # ---------------------------------------------------
    # EXTRACT ASIN (use your existing func)
    # ---------------------------------------------------
    asin = extract_asin_from_url(url)
    if not asin:
        return jsonify({'error': 'Invalid Amazon URL'}), 400

    # Get customer IP address
    customer_ip = request.headers.get('X-Forwarded-For', request.remote_addr)
    if customer_ip and ',' in customer_ip:
        customer_ip = customer_ip.split(',')[0].strip()

    print(f"[SCRAPE] User {user_id} ({user_role}) scraping ASIN: {asin} from IP: {customer_ip}")

    # ---------------------------------------------------
    # STEP 1 — AI ROUTER SCRAPER
    # ---------------------------------------------------
    product_data = ai_router(url)
    if not product_data:
        return jsonify({'error': 'Failed to scrape product'}), 500

    # Normalize and also keep raw
    normalized = normalize_scraper_output(product_data)
    # Ensure detected_category is set from heuristics if not present
    if not normalized.get("detected_category"):
        normalized["detected_category"] = detect_scraper_category(product_data)

    # ---------------------------------------------------
    # STEP 2 — DB CONNECTION
    # ---------------------------------------------------
    connection = get_db_connection()
    if not connection:
        return jsonify({'error': 'Database connection failed'}), 500

    cursor = connection.cursor(dictionary=True)
    try:
        cursor.execute("SELECT product_id, user_id AS seller_id FROM Products WHERE asin = %s", (asin,))
        existing_product = cursor.fetchone()

        # core landing fields (use normalized where possible)
        title = normalized.get('title')
        price = normalized.get('price')
        currency = normalized.get('currency')
        country = normalized.get('country')
        language = normalized.get('language')

        # Build JSON blobs:
        # - product_json_raw: store original scraper output unmodified (for QA)
        # - product_json: standardized format used by UI/consumers
        product_json_raw = product_data
        product_json = normalized

        seller_id = None

        if existing_product:
            product_id = existing_product['product_id']
            seller_id = existing_product['seller_id']
            print(f"[UPDATE] Updating product {product_id} (seller: {seller_id})")

            update_query = """
                UPDATE Products
                SET url=%s, title=%s, price=%s, currency=%s, country=%s,
                    language=%s, seller_information=%s, product_json=%s, product_json_raw=%s
                WHERE product_id=%s
            """
            cursor.execute(update_query, (
                url, title, price, currency, country, language,
                json.dumps(normalized.get('seller_information') or product_data.get('seller')),
                json.dumps(product_json),
                json.dumps(product_json_raw),
                product_id
            ))

            # delete existing images to replace with new ones
            cursor.execute("DELETE FROM Images WHERE product_id = %s", (product_id,))
            print(f"[DELETE] Old images removed for {product_id}")

        else:
            print(f"[INSERT] Creating new product entry")
            insert_query = """
                INSERT INTO Products 
                (user_id, url, asin, title, price, currency, country, language, seller_information, product_json, product_json_raw)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """
            cursor.execute(insert_query, (
                user_id, url, asin, title, price, currency, country, language,
                json.dumps(normalized.get('seller_information') or product_data.get('seller')),
                json.dumps(product_json),
                json.dumps(product_json_raw)
            ))
            product_id = cursor.lastrowid
            seller_id = user_id  # first scraper becomes owner

        connection.commit()

        # ---------------------------------------------------
        # STEP 3 — STORE IMAGES AS BLOBS
        # ---------------------------------------------------
        images = normalized.get('images') or []
        print(f"[IMAGES] Found {len(images)} images (keys tried: images/image_urls/image_list)")

        images_inserted = 0
        for img_url in images[:10]:
            image_data = download_image(img_url)
            if image_data:
                cursor.execute(
                    "INSERT INTO Images (product_id, image_data) VALUES (%s, %s)",
                    (product_id, image_data)
                )
                images_inserted += 1

        connection.commit()
        print(f"[IMAGES] Stored {images_inserted} images")

        # ---------------------------------------------------
        # STEP 4 — SELLER ACTIVITY LOGGING
        # ---------------------------------------------------
        from datetime import datetime
        ts = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
        action = f"{user_role.capitalize()} scraped product ASIN {asin}"
        seller_info_json = json.dumps(product_data.get('seller'))

        if user_role == "customer":
            sa_seller_id = None
            sa_customer_id = user_id
        elif user_role == "seller" and seller_id == user_id:
            sa_seller_id = user_id
            sa_customer_id = None
        elif user_role == "seller" and seller_id and seller_id != user_id:
            sa_seller_id = seller_id
            sa_customer_id = user_id
        else:
            sa_seller_id = None
            sa_customer_id = None

        seller_activity_query = """
            INSERT INTO selleractivity
            (seller_id, customer_id, action, seller_information,
             location, latitude, longitude, timestamp, created_at)
            VALUES (%s, %s, %s, %s, NULL, NULL, NULL, %s, %s)
        """
        cursor.execute(
            seller_activity_query,
            (sa_seller_id, sa_customer_id, action, seller_info_json, ts, ts)
        )
        connection.commit()
        print(f"[SELLER-ACTIVITY] Logged: {action}")

        # ---------------------------------------------------
        # STEP 5 — AUTO COMPLIANCE ANALYSIS
        # ---------------------------------------------------
        compliance_report = None
        if auto_analyze:
            if DEMO_MODE:
                print("[AUTO-ANALYZE] Demo mode (no GOOGLE_API_KEY) — returning placeholder report")
                compliance_report = demo_compliance_report(normalized.get('detected_category'))
            else:
                print(f"[AUTO-ANALYZE] Running compliance...")
                try:
                    compliance_report = compliance_copy.analyze_compliance(product_id)
                    if compliance_report and 'error' not in compliance_report:
                        _save_compliance_report(product_id, compliance_report)
                except Exception as e:
                    print(f"[AUTO-ANALYZE] FAILED: {e}")

        # ---------------------------------------------------
        # STEP 6 — RETRIEVE STORED IMAGES AS BASE64
        # ---------------------------------------------------
        cursor.execute(
            "SELECT image_id, image_data FROM Images WHERE product_id = %s ORDER BY image_id",
            (product_id,)
        )
        image_rows = cursor.fetchall()
        image_blobs = []
        for row in image_rows:
            image_blobs.append({
                'image_id': row['image_id'],
                'image_data': base64.b64encode(row['image_data']).decode('utf-8')
            })

        print(f"[RETRIEVE] Retrieved {len(image_blobs)} images from database")

        cursor.close()
        connection.close()

        # ---------------------------------------------------
        # FINAL RESPONSE
        # ---------------------------------------------------
        response = {
            'message': 'Product scraped & stored successfully',
            'product_id': product_id,
            'asin': asin,
            'title': title,
            'images_stored': images_inserted,
            'images': image_blobs,
            'is_update': existing_product is not None,
            'seller_id': seller_id,
            'seller_info': product_data.get('seller'),
            'price': price,
            'product_json': product_json,         # standardized
            'product_json_raw': product_json_raw  # raw for QA
        }

        if compliance_report and 'error' not in compliance_report:
            response['compliance_analysis'] = {
                'score': compliance_report.get('compliance_score'),
                'grade': compliance_report.get('compliance_grade'),
                'is_compliant': compliance_report.get('is_compliant'),
                'requires_action': compliance_report.get('requires_action'),
                'violations_count': compliance_report.get('violation_summary', {}).get('total', 0),
                'demo_mode': compliance_report.get('demo_mode', False),
                # Phase 12: how the grade was produced — 'ai', 'offline'
                # (deterministic offline extraction; label in the UI) or
                # 'indeterminate' (score None / grade N/A, never a fake F).
                'analysis_mode': compliance_report.get('analysis_mode'),
                'analysis_status': compliance_report.get('analysis_status'),
                # Phase 11: real assessment generated from the report (Gemini or
                # deterministic), never a canned static string.
                'assessment': compliance_report.get('assessment')
                    or assessment_gen.deterministic_assessment(compliance_report)
            }

        return jsonify(response), 200

    except Error as e:
        connection.rollback()
        print(f"[DB ERROR] {e}")
        return jsonify({'error': f'Database error: {str(e)}'}), 500
# ==================== AI COMPLIANCE ENDPOINTS (NEW!) ====================

def _save_compliance_report(product_id: int, report: dict) -> None:
    """Persist a successful compliance report so the Products page shows the
    compliance grade/score and its filters work (fix: reports were never saved).

    Stores the full report in analysis_results and a human-readable grade line
    in remarks (the frontend filters rows on `remarks` containing 'Grade: X').
    """
    try:
        conn = get_db_connection()
        if not conn:
            print(f"[PERSIST] No DB connection; skipped report save for product {product_id}")
            return
        cur = conn.cursor()
        grade = report.get('compliance_grade')
        score = report.get('compliance_score')
        vs = report.get('violation_summary', {}) or {}
        # Phase 12: indeterminate reports (score None / grade N/A) are saved
        # with an honest N/A line — never a fake numeric grade.
        remarks_score = score if score is not None else 'N/A'
        remarks = ("Grade: {0} | Score: {1} | Critical: {2}, Major: {3}, Minor: {4}"
                   .format(grade, remarks_score, vs.get('critical', 0), vs.get('major', 0), vs.get('minor', 0)))
        cur.execute(
            "UPDATE Products SET analysis_results=%s, remarks=%s, last_analysed=NOW() WHERE product_id=%s",
            (json.dumps(report, default=lambda o: float(o) if isinstance(o, decimal.Decimal) else str(o)),
             remarks, product_id))
        conn.commit()
        cur.close()
        conn.close()
        print(f"[PERSIST] Saved compliance report for product {product_id} ({grade}, {score})")
    except Exception as e:
        print(f"[PERSIST] Failed to save compliance report for product {product_id}: {e}")


def _chat_safe_message(text) -> str:
    """Never expose raw Gemini/API error text to users (fail fast, friendly)."""
    if not isinstance(text, str):
        return str(text)
    low = text.lower()
    if ("resource_exhausted" in low or "429" in low or "rate limit" in low
            or "quota" in low or "internal server" in low):
        return ai_guard.FRIENDLY_RATE_LIMIT_MSG
    return text


@app.route('/api/compliance/analyze/<int:product_id>', methods=['POST'])
def analyze_product_compliance(product_id):
    """
    Trigger compliance analysis for a specific product
    """
    if not session.get('logged_in'):
        return jsonify({'error': 'Authentication required'}), 401

    user_id = session.get('user_id')
    # SECURITY: only the product owner may run/request compliance analysis.
    _row, err = require_product_owner(product_id, user_id)
    if err:
        return err

    print(f"[API] Compliance analysis requested for product {product_id}")
    
    if DEMO_MODE:
        return jsonify({
            'message': 'Compliance analysis complete (demo mode — GOOGLE_API_KEY not configured)',
            'report': demo_compliance_report()
        }), 200

    try:
        compliance_report = compliance.analyze_compliance(product_id)
        
        if 'error' in compliance_report:
            return jsonify({'error': compliance_report['error']}), 500

        # Persist the report so the Products page shows grade/score/status.
        _save_compliance_report(product_id, compliance_report)

        # Reward Meta-Tokens for a server-verified, genuine (non-demo) analysis.
        # The amount is fixed server-side and is NOT client-controllable.
        awarded = None
        try:
            ok, res = award_mt_tokens(user_id, 10)
            if ok:
                awarded = res
        except Exception:
            awarded = None

        return jsonify({
            'message': 'Compliance analysis complete',
            'report': compliance_report,
            'mt_tokens_awarded': awarded
        }), 200
        
    except Exception as e:
        print(f"[ERROR] Compliance analysis failed: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/products/validate/<int:product_id>', methods=['POST'])
def validate_product(product_id):
    """
    Run (or re-run) compliance validation for a product and return a result
    shaped for the browser-extension overlay.

    The extension calls this as a fallback when /api/scrape did not already
    include a `compliance_analysis` block. The response fields
    (compliance_score, final_grade, passed_checks, total_checks) mirror what
    the extension builds inline from the scrape response, so both code paths
    render identically. We use `compliance_copy.analyze_compliance` here to
    match the auto-analyze path in /api/scrape.
    """
    if not session.get('logged_in'):
        return jsonify({'error': 'Authentication required'}), 401

    user_id = session.get('user_id')
    # SECURITY: only the product owner may validate a product.
    _row, err = require_product_owner(product_id, user_id)
    if err:
        return err

    print(f"[API] Product validation requested for product {product_id}")

    if DEMO_MODE:
        report = demo_compliance_report()
        return jsonify({
            'product_id': product_id,
            'compliance_score': report['compliance_score'],
            'final_grade': report['compliance_grade'],
            'passed_checks': 8,
            'total_checks': 10,
            'is_compliant': True,
            'requires_action': False,
            'report': report
        }), 200

    try:
        report = compliance_copy.analyze_compliance(product_id)

        if not report or 'error' in report:
            return jsonify({
                'error': (report or {}).get('error', 'Validation failed'),
                'product_id': product_id
            }), 500

        total_checks = 10
        violations_total = report.get('violation_summary', {}).get('total', 0)
        passed_checks = max(0, total_checks - violations_total)

        # Phase 12: pass the analysis mode/status through so the extension
        # can label offline/degraded results; keep score None (not 0) when
        # the analysis was indeterminate.
        return jsonify({
            'product_id': product_id,
            'compliance_score': report.get('compliance_score'),
            'final_grade': report.get('compliance_grade', 'N/A'),
            'passed_checks': passed_checks,
            'total_checks': total_checks,
            'is_compliant': report.get('is_compliant', False),
            'requires_action': report.get('requires_action', False),
            'analysis_mode': report.get('analysis_mode'),
            'analysis_status': report.get('analysis_status'),
            'report': report
        }), 200

    except Exception as e:
        print(f"[ERROR] Product validation failed: {e}")
        return jsonify({'error': str(e), 'product_id': product_id}), 500

@app.route('/api/seller/check-upload', methods=['POST'])
@limiter.limit("10 per minute")
def check_seller_upload():
    """
    Analyze seller's product BEFORE uploading to Amazon
    Accepts multipart form data with images and product information
    """
    if not session.get('logged_in'):
        return jsonify({'error': 'Authentication required'}), 401
    
    # Get category (either from form or auto-detect)
    category = request.form.get('category', 'amazon')
    
    # Get product data
    product_data = {
        'title': request.form.get('title', ''),
        'description': request.form.get('description', ''),
        'feature_bullets': json.loads(request.form.get('features', '[]')),
        'product_details': json.loads(request.form.get('details', '{}')),
        'specifications': json.loads(request.form.get('specifications', '{}')),
        'seller_information': {}
    }
    
    # Get uploaded images — validated BEFORE anything reaches the AI layer
    # (Phase 11 / TODO #9: type + magic bytes + size, friendly 400 errors).
    image_files = request.files.getlist('images')

    image_blobs, validation_error = validate_upload_images(image_files)
    if validation_error:
        return validation_error

    print(f"[SELLER CHECK] Analyzing upload with {len(image_blobs)} images")
    
    if DEMO_MODE:
        return jsonify({
            'message': 'Pre-upload compliance check complete (demo mode — GOOGLE_API_KEY not configured)',
            'feedback': demo_compliance_report(category)
        }), 200
    
    try:
        feedback_report = comply.analyze_seller_upload(image_blobs, product_data, category)
        
        if 'error' in feedback_report:
            return jsonify({'error': feedback_report['error']}), 500
        
        return jsonify({
            'message': 'Pre-upload compliance check complete',
            'feedback': feedback_report
        }), 200
        
    except Exception as e:
        print(f"[ERROR] Seller upload check failed: {e}")
        return jsonify({'error': str(e)}), 500
    
# ==================== AI-POWERED INTENT DETECTION ====================

def detect_user_intent_with_ai(message: str, user_role: str, username: str) -> str:
    """
    Use Gemini AI to detect whether user wants:
    1. 'personal_data' - Query their own products/data
    2. 'general_compliance' - General compliance questions
    
    Returns: 'personal_data' or 'general_compliance'
    """
    if not AI_AVAILABLE:
        if any(word in message.lower() for word in ['my', 'mine', 'i have', 'show me', 'dashboard']):
            return 'personal_data'
        return 'general_compliance'
    if not ai_guard.ai_ok():
        if any(word in message.lower() for word in ['my', 'mine', 'i have', 'show me', 'dashboard']):
            return 'personal_data'
        return 'general_compliance'
    try:
        prompt = f"""You are an intent classifier for an e-commerce compliance platform.

Current User:
- Username: {username}
- Role: {user_role}

User Message: "{message}"

Analyze the message and determine the user's intent:

1. **personal_data**: User wants to query THEIR OWN data
   - Examples: "Show me my products", "What's my score?", "How many products do I have?", "My dashboard", "Do I have any compliant products?"
   - Keywords: my, mine, I, me, show me, my products, my score, dashboard, statistics about me
   
2. **general_compliance**: User wants general information about compliance/regulations
   - Examples: "What is MRP?", "How to improve compliance?", "Tell me about Legal Metrology Act", "What are the requirements for food products?"
   - Keywords: what is, how to, tell me about, explain, requirements, regulations, rules

IMPORTANT: 
- If the message mentions "my", "I", "mine", "me" in relation to products/data → personal_data
- If asking about regulations, rules, general advice → general_compliance
- When in doubt, prefer 'personal_data' for logged-in users

Respond with ONLY ONE WORD: either "personal_data" or "general_compliance"

Intent:"""

        response = model.generate_content(prompt)
        intent = response.text.strip().lower()
        
        # Validate response
        if 'personal_data' in intent:
            return 'personal_data'
        elif 'general_compliance' in intent:
            return 'general_compliance'
        else:
            # Default to personal_data if unclear
            print(f"[WARNING] Unclear intent from AI: {intent}. Defaulting to personal_data")
            return 'personal_data'
            
    except Exception as e:
        print(f"[ERROR] Intent detection failed: {e}")
        # Fallback: simple keyword check
        if any(word in message.lower() for word in ['my', 'mine', 'i have', 'show me', 'dashboard']):
            return 'personal_data'
        return 'general_compliance'

# ==================== SMART CHAT ROUTE ====================

@app.route('/api/chat', methods=['POST'])
def chat():
    """
    Intelligent chatbot endpoint with AI-powered intent detection
    Routes to either:
    - User-specific chatbot (personal data queries)
    - General compliance chatbot (regulatory questions)
    """
    if not session.get('logged_in'):
        return jsonify({'error': 'Authentication required'}), 401
    
    data = request.json
    user_message = data.get('message', '').strip()
    
    if not user_message:
        return jsonify({'error': 'Message is required'}), 400
    
    if DEMO_MODE:
        return jsonify({
            'message': "Demo mode: the AI compliance assistant needs GOOGLE_API_KEY, which is not configured. "
                       "Add it to your .env file and restart the backend to enable chat.",
            'intent': 'demo',
            'demo_mode': True,
            'timestamp': datetime.now().isoformat()
        }), 200
    
    try:
        # Get user info from session
        user_id = session.get('user_id')
        user_role = session.get('role', 'customer')
        username = session.get('username', 'User')
        
        # Use AI to detect intent
        intent = detect_user_intent_with_ai(user_message, user_role, username)
        
        print(f"[CHAT ROUTER] User: {username} (ID: {user_id}) | Intent: {intent} | Message: {user_message[:80]}")
        
        if intent == 'personal_data':
            # Use user-context chatbot for personal queries
            print("[CHAT ROUTER] → Routing to User-Context Chatbot")
            result = chatbot_compliance.user_chatbot(user_id, user_message)
            result['response'] = _chat_safe_message(result.get('response', ''))
            
            return jsonify({
                'message': result['response'],
                'intent': 'personal_data',
                'user_context': result.get('user_context'),
                'timestamp': datetime.now().isoformat()
            }), 200
            
        else:
            # Use general compliance chatbot
            print("[CHAT ROUTER] → Routing to General Compliance Chatbot")
            response = _chat_safe_message(compliance.chatbot_agent(user_message))
            
            return jsonify({
                'message': response,
                'intent': 'general_compliance',
                'timestamp': datetime.now().isoformat()
            }), 200
        
    except Exception as e:
        print(f"[ERROR] Chatbot error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': 'Failed to process message'}), 500
    
@app.route('/api/dashboard', methods=['GET'])
def dashboard():
    """Get personalized dashboard for current user"""
    if not session.get('logged_in'):
        return jsonify({'error': 'Authentication required'}), 401
    
    try:
        user_id = session.get('user_id')
        dashboard_data = chatbot_compliance.get_user_dashboard(user_id)
        
        if 'error' in dashboard_data:
            return jsonify({'error': dashboard_data['error']}), 500
        
        return jsonify(dashboard_data), 200
        
    except Exception as e:
        print(f"[ERROR] Dashboard endpoint failed: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/compliance/batch', methods=['POST'])
def batch_analyze():
    """
    Batch analyze multiple products
    """
    if not session.get('logged_in') or session.get('role') != 'seller':
        return jsonify({'error': 'Seller access required'}), 403
    
    data = request.json
    product_ids = data.get('product_ids', [])
    
    if not product_ids:
        return jsonify({'error': 'Product IDs required'}), 400
    
    if DEMO_MODE:
        return jsonify({
            'message': 'Batch analysis complete (demo mode — GOOGLE_API_KEY not configured)',
            'results': {str(pid): demo_compliance_report() for pid in product_ids}
        }), 200
    
    try:
        results = compliance.batch_analyze_products(product_ids)
        
        return jsonify({
            'message': 'Batch analysis complete',
            'results': results
        }), 200
        
    except Exception as e:
        print(f"[ERROR] Batch analysis failed: {e}")
        return jsonify({'error': str(e)}), 500

# ==================== EXISTING ENDPOINTS ====================




def _ensure_assessment(report):
    """Phase 11: backfill a real assessment for persisted/seeded reports that
    predate the assessment feature. Cheap, deterministic, offline."""
    if not isinstance(report, dict):
        return report
    if not report.get('assessment'):
        try:
            report['assessment'] = assessment_gen.deterministic_assessment(report)
        except Exception:
            pass
    return report


@app.route('/api/products', methods=['GET'])
def get_products():
    """Get all products for the logged-in user"""
    if not session.get('logged_in'):
        return jsonify({'error': 'Authentication required'}), 401
    
    user_id = session.get('user_id')
    
    connection = get_db_connection()
    if not connection:
        return jsonify({'error': 'Database connection failed'}), 500
    
    cursor = connection.cursor(dictionary=True)
    cursor.execute(
        """SELECT product_id, asin, title, price, currency, url, rating, remarks, last_analysed, analysis_results
           FROM Products WHERE user_id = %s""",
        (user_id,)
    )
    products = cursor.fetchall()

    for _p in products:
        if _p.get('analysis_results'):
            try:
                _p['compliance_report'] = _ensure_assessment(json.loads(_p['analysis_results']))
            except Exception:
                _p['compliance_report'] = None
        else:
            _p['compliance_report'] = None
        _p.pop('analysis_results', None)

    cursor.close()
    connection.close()
    
    return jsonify({'products': products}), 200

@app.route('/api/image/<int:image_id>')
def get_image(image_id):
    # SECURITY: image blobs are now auth-protected and ownership-checked.
    if not session.get('logged_in'):
        return jsonify({'error': 'Authentication required'}), 401
    user_id = session.get('user_id')

    connection = get_db_connection()
    if not connection:
        return jsonify({'error': 'Database connection failed'}), 503
    cursor = connection.cursor(dictionary=True)

    # Only fetch the binary data for this specific image, joined to the owning
    # product so we can enforce that the requester owns the product.
    cursor.execute(
        """SELECT i.image_data, p.user_id AS owner_id
           FROM Images i
           JOIN Products p ON i.product_id = p.product_id
           WHERE i.image_id = %s""",
        (image_id,)
    )
    result = cursor.fetchone()

    cursor.close()
    connection.close()

    if not result:
        return abort(404)

    if int(result.get('owner_id') or 0) != int(user_id):
        return jsonify({'error': 'Forbidden'}), 403

    if result and result['image_data']:
        return send_file(
            io.BytesIO(result['image_data']),
            mimetype='image/jpeg'
        )

    return abort(404)

@app.route('/api/product/<int:product_id>', methods=['GET'])
def get_product_detail(product_id):
    """Get detailed product information including compliance report"""
    if not session.get('logged_in'):
        return jsonify({'error': 'Authentication required'}), 401

    # FIX (audit): user_id was never defined here -> 500 on every request.
    user_id = session.get('user_id')

    connection = get_db_connection()
    if not connection:
        return jsonify({'error': 'Database connection failed'}), 500
    
    cursor = connection.cursor(dictionary=True)
    
    # Get product details
    cursor.execute("SELECT * FROM Products WHERE product_id = %s", (product_id,))
    product = cursor.fetchone()
    
    if not product:
        cursor.close()
        connection.close()
        return jsonify({'error': 'Product not found'}), 404

    # SECURITY: ownership check — a user may only read their own products.
    if int(product.get('user_id') or 0) != int(user_id):
        cursor.close()
        connection.close()
        return jsonify({'error': 'Forbidden'}), 403

    # Parse JSON fields
    if product.get('product_json'):
        product['product_json'] = json.loads(product['product_json'])
    
    if product.get('analysis_results'):
        product['compliance_report'] = _ensure_assessment(json.loads(product['analysis_results']))
    
    # NOTICE: We removed 'image_data' from this SELECT to keep it fast/light
    cursor.execute("SELECT image_id, created_at FROM Images WHERE product_id = %s", (product_id,))
    
    images = cursor.fetchall()
    image_count = len(images)

    # Add the URL to each image dictionary
    # request.host_url builds the full http://localhost:5000/... link
    for img in images:
        img['url'] = f"{request.host_url}api/image/{img['image_id']}"

    product['image_count'] = image_count
    product['images'] = images
    
    cursor.close()
    connection.close()
    
    return jsonify({'product': product}), 200

@app.route('/api/products/detailed', methods=['GET'])
def get_products_detailed():
    """Get all products with full details for the logged-in user"""
    if not session.get('logged_in'):
        return jsonify({'error': 'Authentication required'}), 401
    
    user_id = session.get('user_id')
    
    connection = get_db_connection()
    if not connection:
        return jsonify({'error': 'Database connection failed'}), 500
    
    cursor = connection.cursor(dictionary=True)
    
    # Get all products for the user
    cursor.execute("SELECT * FROM Products WHERE user_id = %s", (user_id,))
    products = cursor.fetchall()
    
    # Enrich each product with images (same as individual endpoint)
    for product in products:
        product_id = product['product_id']
        
        # Parse JSON fields
        if product.get('product_json'):
            product['product_json'] = json.loads(product['product_json'])
        
        if product.get('analysis_results'):
            product['compliance_report'] = _ensure_assessment(json.loads(product['analysis_results']))
        
        # NOTICE: We removed 'image_data' from this SELECT to keep it fast/light
        cursor.execute("SELECT image_id, created_at FROM Images WHERE product_id = %s", (product_id,))
        
        images = cursor.fetchall()
        image_count = len(images)

        # Add the URL to each image dictionary
        # request.host_url builds the full http://localhost:5000/... link
        for img in images:
            img['url'] = f"{request.host_url}api/image/{img['image_id']}"

        product['image_count'] = image_count
        product['images'] = images
    
    cursor.close()
    connection.close()
    
    return jsonify({'products': products}), 200



@app.route('/api/seller/activity', methods=['GET'])
def get_seller_activity():
    """Get activity logs for sellers - shows who scraped their products"""
    if not session.get('logged_in') or session.get('role') != 'seller':
        return jsonify({'error': 'Seller access required'}), 403
    
    seller_id = session.get('user_id')
    
    connection = get_db_connection()
    if not connection:
        return jsonify({'error': 'Database connection failed'}), 500
    
    cursor = connection.cursor(dictionary=True)
    
    query = """
        SELECT 
            sa.*,
            u.username as customer_username
        FROM SellerActivity sa
        LEFT JOIN Users u ON sa.customer_id = u.id
        WHERE sa.seller_id = %s
        ORDER BY sa.timestamp DESC
        LIMIT 100
    """
    
    cursor.execute(query, (seller_id,))
    activities = cursor.fetchall()
    
    cursor.close()
    connection.close()
    
    return jsonify({'activities': activities}), 200

@app.route('/api/heatmap', methods=['GET'])
def get_heatmap_data():
    print("\n====== /api/heatmap (PRODUCTS ONLY) CALLED ======")

    if not session.get('logged_in'):
        return jsonify({'error': 'Authentication required'}), 401

    user_id = session['user_id']
    role = session['role']

    conn = get_db_connection()
    if not conn:
        return jsonify({'error': 'Database connection failed'}), 503
    cursor = conn.cursor(dictionary=True)

    # ---------- QUERY FOR BOTH ROLES ----------
    query = """
        SELECT
            JSON_UNQUOTE(JSON_EXTRACT(p.seller_information, '$.ai_insights.location')) AS location,
            JSON_UNQUOTE(JSON_EXTRACT(p.seller_information, '$.name')) AS seller_name,

            COUNT(*) AS total_scrapes,

            AVG(
                CAST(
                    JSON_UNQUOTE(JSON_EXTRACT(p.analysis_results, '$.compliance_score'))
                    AS DECIMAL(5,2)
                )
            ) AS avg_compliance_score,

            MAX(p.created_at) AS last_activity,

            -- NEW FIELD: Product details grouped inside JSON array
            JSON_ARRAYAGG(
                JSON_OBJECT(
                    'product_id', p.product_id,
                    'title', p.title,
                    'rating', p.rating,
                    'compliance_score',
                        CAST(
                            JSON_UNQUOTE(JSON_EXTRACT(p.analysis_results, '$.compliance_score'))
                            AS DECIMAL(5,2)
                        ),
                    'created_at', p.created_at
                )
            ) AS products

        FROM Products p
        WHERE p.user_id = %s
        AND JSON_EXTRACT(p.seller_information, '$.ai_insights.location') IS NOT NULL
        GROUP BY location, seller_name
        ORDER BY total_scrapes DESC;
    """

    print("\nExecuting SQL:\n", query)
    cursor.execute(query, (user_id,))
    rows = cursor.fetchall()

    print(f"\nReturned {len(rows)} rows:")
    for r in rows:
        print(r)

    cursor.close()
    conn.close()

    return jsonify({
        "user_role": role,
        "heatmap_data": rows,
        "total_locations": len(rows),
        "total_scrapes": sum(x['total_scrapes'] for x in rows)
    })







@app.route('/api/global-heatmap', methods=['GET'])
def get_global_heatmap_data():
    if not session.get('logged_in'):
        return jsonify({'error': 'Authentication required'}), 401
    print("\n====== /api/global-heatmap (PRODUCTS ONLY) CALLED ======")

    conn = get_db_connection()
    if not conn:
        return jsonify({'error': 'Database connection failed'}), 503
    cursor = conn.cursor(dictionary=True)

    query = """
        SELECT
            JSON_UNQUOTE(JSON_EXTRACT(p.seller_information, '$.ai_insights.location')) AS location,
            JSON_UNQUOTE(JSON_EXTRACT(p.seller_information, '$.name')) AS seller_name,

            COUNT(*) AS total_scrapes,

            AVG(
                CAST(
                    JSON_UNQUOTE(JSON_EXTRACT(p.analysis_results, '$.compliance_score'))
                    AS DECIMAL(5,2)
                )
            ) AS avg_compliance_score,

            MAX(p.created_at) AS last_activity,

            -- NEW: return all matched products
            JSON_ARRAYAGG(
                JSON_OBJECT(
                    'product_id', p.product_id,
                    'title', p.title,
                    'rating', p.rating,
                    'compliance_score',
                        CAST(
                            JSON_UNQUOTE(JSON_EXTRACT(p.analysis_results, '$.compliance_score'))
                            AS DECIMAL(5,2)
                        ),
                    'created_at', p.created_at
                )
            ) AS products

        FROM Products p
        WHERE JSON_EXTRACT(p.seller_information, '$.ai_insights.location') IS NOT NULL
        AND JSON_EXTRACT(p.seller_information, '$.ai_insights.location') != ''
        GROUP BY location, seller_name
        ORDER BY total_scrapes DESC
        LIMIT 1000;
    """

    print("\nExecuting SQL:\n", query)
    cursor.execute(query)
    rows = cursor.fetchall()

    print(f"\nGLOBAL returned {len(rows)} rows:")
    for r in rows:
        print(r)

    cursor.close()
    conn.close()

    return jsonify({
        'global_heatmap_data': rows,
        'total_locations': len(rows),
        'total_scrapes': sum(x['total_scrapes'] for x in rows)
    })

#==SEARCH PAGE EXTRACTION==

@app.route('/extract-links', methods=['POST'])
def extract_links():
    """
    Extract product links from Amazon search URL
    
    Request body:
    {
        "url": "https://www.amazon.in/s?k=cricket+bat",
        "num_links": 3  // optional, defaults to 3
    }
    
    Response:
    {
        "success": true,
        "data": [
            {
                "title": "Product Title",
                "url": "https://www.amazon.in/Product/dp/ASIN"
            }
        ],
        "count": 3
    }
    """
    try:
        data = request.get_json()
        
        if not data or 'url' not in data:
            return jsonify({
                'success': False,
                'error': 'Missing required field: url'
            }), 400
        
        url = data['url']
        num_links = data.get('num_links', 3)
        
        # Validate URL
        if not url.startswith('http'):
            return jsonify({
                'success': False,
                'error': 'Invalid URL format'
            }), 400
        
        # Validate num_links
        if not isinstance(num_links, int) or num_links < 1 or num_links > 20:
            return jsonify({
                'success': False,
                'error': 'num_links must be an integer between 1 and 20'
            }), 400
        
        # Extract links
        results = search.extract_top_links_from_url(url, num_links)
        
        if not results:
            return jsonify({
                'success': False,
                'error': 'No products found or failed to fetch page'
            }), 404
        
        return jsonify({
            'success': True,
            'data': results,
            'count': len(results)
        }), 200
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

# ====== Rewards =======

@app.route('/api/gifts', methods=['POST'])
@limiter.limit("10 per minute")
def create_gift():
    """
    Insert a new gift into the gifts table.
    Authentication REQUIRED (only logged-in users may create reward entries).
    """
    if not session.get('logged_in'):
        return jsonify({'error': 'Authentication required'}), 401

    data = request.json

    gift_code = data.get('gift_code')
    gift_pin = data.get('gift_pin')
    partner = data.get('partner')
    value = data.get('value')   # NEW FIELD
    mt_tokens_required = data.get('mt_tokens_required')

    # Validate required fields
    if not gift_code or not gift_pin or not mt_tokens_required:
        return jsonify({'error': 'gift_code, gift_pin, mt_tokens_required are required'}), 400

    connection = get_db_connection()
    if not connection:
        return jsonify({'error': 'Database connection failed'}), 500

    cursor = connection.cursor()

    try:
        query = """
            INSERT INTO gifts (gift_code, gift_pin, partner, value, mt_tokens_required)
            VALUES (%s, %s, %s, %s, %s)
        """

        cursor.execute(query, (gift_code, gift_pin, partner, value, mt_tokens_required))
        connection.commit()

        new_gift_id = cursor.lastrowid

        cursor.close()
        connection.close()

        return jsonify({
            'message': 'Gift created successfully',
            'gift_id': new_gift_id,
            'gift_code': gift_code,
            'gift_pin': gift_pin,
            'partner': partner,
            'value': value,
            'mt_tokens_required': mt_tokens_required
        }), 201

    except Exception as e:
        cursor.close()
        connection.close()
        return jsonify({'error': f'Failed to insert gift: {str(e)}'}), 500


@app.route('/api/gifts/redeem', methods=['POST'])
@limiter.limit("10 per minute")
def redeem_gift():
    """
    Redeem a gift code for the logged-in user.
    Steps:
      1. Validate session & get user info
      2. Validate gift exists & is available
      3. Validate user has enough mt_tokens
      4. Deduct tokens
      5. Insert into gifts_redeemed
      6. Update gift status → 'Redeem'
    """
    # -----------------------------
    # AUTH CHECK
    # -----------------------------
    if not session.get('logged_in'):
        return jsonify({'error': 'Authentication required'}), 401

    user_id = session.get('user_id')
    role = session.get('role')

    # Optional: Only customers can redeem
    if role != "customer":
        return jsonify({'error': 'Only customers can redeem gifts'}), 403

    data = request.json
    gift_id = data.get('gift_id')

    if not gift_id:
        return jsonify({'error': 'gift_id is required'}), 400

    connection = get_db_connection()
    if not connection:
        return jsonify({'error': 'Database connection failed'}), 500

    cursor = connection.cursor(dictionary=True)

    try:
        # Begin transaction
        connection.start_transaction()

        # ------------------------------------------
        # 1. Fetch gift details
        # ------------------------------------------
        cursor.execute("SELECT * FROM gifts WHERE id = %s", (gift_id,))
        gift = cursor.fetchone()

        if not gift:
            return jsonify({'error': 'Gift not found'}), 404

        if gift['mt_tokens_required'] is None:
            return jsonify({'error': 'Gift has invalid token value'}), 400

        # ------------------------------------------
        # 2. Check if already redeemed
        # ------------------------------------------
        cursor.execute("""
            SELECT * FROM gifts_redeemed
            WHERE gift_id = %s AND user_id = %s
        """, (gift_id, user_id))
        already = cursor.fetchone()

        if already:
            return jsonify({'error': 'You already redeemed this gift'}), 409

        # ------------------------------------------
        # 3. Check user token balance
        # ------------------------------------------
        cursor.execute("SELECT mt_tokens FROM Users WHERE id = %s", (user_id,))
        user = cursor.fetchone()

        if not user:
            return jsonify({'error': 'User not found'}), 404

        user_tokens = user['mt_tokens']
        required_tokens = gift['mt_tokens_required']

        if user_tokens < required_tokens:
            return jsonify({
                'error': 'Insufficient tokens',
                'required': required_tokens,
                'available': user_tokens
            }), 400

        # ------------------------------------------
        # 4. Deduct tokens
        # ------------------------------------------
        new_balance = user_tokens - required_tokens
        cursor.execute(
            "UPDATE Users SET mt_tokens = %s WHERE id = %s",
            (new_balance, user_id)
        )

        # ------------------------------------------
        # 5. Insert into gifts_redeemed
        # ------------------------------------------
        cursor.execute("""
            INSERT INTO gifts_redeemed (user_id, gift_id, status)
            VALUES (%s, %s, 'Redeem')
        """, (user_id, gift_id))

        redeemed_id = cursor.lastrowid

        # ------------------------------------------
        # 6. Update gift status → Redeem
        # ------------------------------------------
        cursor.execute(
        "UPDATE gifts_redeemed SET status = 'Redeem' WHERE gift_id = %s AND user_id = %s",
        (gift_id, user_id)
    )


        # Commit transaction
        connection.commit()
        cursor.close()
        connection.close()

        return jsonify({
            'message': 'Gift redeemed successfully',
            'gift_id': gift_id,
            'redeemed_id': redeemed_id,
            'tokens_spent': required_tokens,
            'tokens_remaining': new_balance
        }), 200

    except Exception as e:
        connection.rollback()
        cursor.close()
        connection.close()
        return jsonify({'error': f'Redemption failed: {str(e)}'}), 500

@app.route('/api/gifts/list', methods=['GET'])
def list_all_gifts():
    """
    Show the gift catalogue (requires authentication).
    gift_pin is intentionally NOT returned here — it is only revealed to a user
    after they redeem the gift (see /api/gifts/my-redemptions).
    """
    if not session.get('logged_in'):
        return jsonify({'error': 'Authentication required'}), 401

    connection = get_db_connection()
    if not connection:
        return jsonify({'error': 'Database connection failed'}), 500

    cursor = connection.cursor(dictionary=True)

    try:
        cursor.execute("""
            SELECT 
                id,
                gift_code,
                partner,
                value,
                mt_tokens_required
            FROM gifts
            ORDER BY id DESC
        """)
        gifts = cursor.fetchall()

        cursor.close()
        connection.close()

        return jsonify({
            'message': 'All gifts fetched successfully',
            'total_gifts': len(gifts),
            'gifts': gifts
        }), 200

    except Exception as e:
        cursor.close()
        connection.close()
        return jsonify({'error': f'Failed to fetch gifts: {str(e)}'}), 500


@app.route('/api/gifts/my-redemptions', methods=['GET'])
def get_my_redemptions():
    """
    Show all gifts redeemed by the logged-in user.
    Authentication required.
    """
    if not session.get('logged_in'):
        return jsonify({'error': 'Authentication required'}), 401

    user_id = session.get('user_id')

    connection = get_db_connection()
    if not connection:
        return jsonify({'error': 'Database connection failed'}), 500

    cursor = connection.cursor(dictionary=True)

    try:
        query = """
            SELECT 
                gr.id AS redemption_id,
                g.id AS gift_id,
                g.gift_code,
                g.gift_pin,
                g.partner,
                g.value,                   -- IMPORTANT NEW FIELD
                g.mt_tokens_required,
                gr.status                  -- Only if your table has it!
            FROM gifts_redeemed gr
            INNER JOIN gifts g ON gr.gift_id = g.id
            WHERE gr.user_id = %s
            ORDER BY gr.id DESC
        """

        cursor.execute(query, (user_id,))
        rows = cursor.fetchall()

        cursor.close()
        connection.close()

        return jsonify({
            'message': 'Redeemed gift list fetched successfully',
            'redemptions': rows,
            'count': len(rows)
        }), 200

    except Exception as e:
        cursor.close()
        connection.close()
        return jsonify({'error': f'Failed to fetch redemptions: {str(e)}'}), 500


def award_mt_tokens(user_id: int, amount: int):
    """Award MT tokens from a SERVER-VERIFIED action.

    This is the ONLY place token balances are increased. The amount is never
    driven by a client-supplied value. Returns (ok: bool, new_balance_or_err).
    """
    try:
        amount_i = int(amount)
    except (TypeError, ValueError):
        return False, "amount must be a positive integer"
    if amount_i <= 0:
        return False, "amount must be a positive integer"

    connection = get_db_connection()
    if not connection:
        return False, "Database connection failed"
    cursor = connection.cursor(dictionary=True)
    try:
        cursor.execute("SELECT mt_tokens FROM Users WHERE id = %s", (user_id,))
        user = cursor.fetchone()
        if not user:
            return False, "User not found"
        new_balance = int(user['mt_tokens'] or 0) + amount_i
        cursor.execute("UPDATE Users SET mt_tokens = %s WHERE id = %s", (new_balance, user_id))
        connection.commit()
        cursor.close()
        connection.close()
        return True, new_balance
    except Exception:
        try:
            connection.rollback()
        except Exception:
            pass
        try:
            cursor.close()
        except Exception:
            pass
        try:
            connection.close()
        except Exception:
            pass
        return False, "Failed to award tokens"


@app.route('/api/gifts/add-tokens', methods=['POST'])
def add_mt_tokens():
    """
    Self-service token minting is DISABLED for security.

    Meta-Tokens may only be increased by award_mt_tokens() as a reward for a
    server-verified action (e.g. a completed, non-demo compliance analysis).
    A client can never mint tokens by sending an amount.
    """
    return jsonify({
        'error': 'Tokens cannot be added directly. Meta-Tokens are awarded '
                 'automatically as a reward for verified actions (e.g. a completed '
                 'compliance check).',
        'code': 'SELF_MINT_DISABLED'
    }), 403

@app.route('/api/gifts/token-balance', methods=['GET'])
def get_token_balance():
    """
    Get MT token balance for the logged-in user.
    Authentication required.
    """
    # -----------------------------
    # AUTH CHECK
    # -----------------------------
    if not session.get('logged_in'):
        return jsonify({'error': 'Authentication required'}), 401

    user_id = session.get('user_id')

    connection = get_db_connection()
    if not connection:
        return jsonify({'error': 'Database connection failed'}), 500

    cursor = connection.cursor(dictionary=True)

    try:
        cursor.execute("SELECT mt_tokens FROM Users WHERE id = %s", (user_id,))
        result = cursor.fetchone()

        cursor.close()
        connection.close()

        if not result:
            return jsonify({'error': 'User not found'}), 404

        return jsonify({
            'message': 'Token balance fetched successfully',
            'user_id': user_id,
            'mt_tokens': result['mt_tokens']
        }), 200

    except Exception as e:
        cursor.close()
        connection.close()
        return jsonify({'error': f'Failed to fetch token balance: {str(e)}'}), 500
    
@app.route('/api/seller/check-upload-text', methods=['POST'])
@limiter.limit("10 per minute")
def check_seller_upload_text():
    """
    Analyze seller's product using raw text description from speech-to-text
    Accepts multipart form data with images, text description, actual weight, and actual dimensions
    """
    # AUTH CHECK — kept identical to /api/seller/check-upload
    if not session.get('logged_in'):
        return jsonify({'error': 'Authentication required'}), 401

    # Get category
    category = request.form.get('category', 'amazon')
    
    # Get raw text description (from speech-to-text)
    raw_text = request.form.get('description', '').strip()
    
    # Get seller-declared actual weight and dimensions
    actual_weight = request.form.get('actual_weight', '').strip()  # e.g., "250g" or "1.5kg"
    actual_dimensions = request.form.get('actual_dimensions', '').strip()  # e.g., "15x10x5 cm"
    
    if not raw_text:
        return jsonify({'error': 'Product description is required'}), 400
    
    # Get uploaded images — validated BEFORE anything reaches the AI layer
    # (Phase 11 / TODO #9: type + magic bytes + size, friendly 400 errors).
    image_files = request.files.getlist('images')

    image_blobs, validation_error = validate_upload_images(image_files)
    if validation_error:
        return validation_error

    print(f"[SELLER TEXT CHECK] Analyzing upload with {len(image_blobs)} images and text description ({len(raw_text)} chars)")
    print(f"[SELLER TEXT CHECK] Declared weight: {actual_weight}, Declared dimensions: {actual_dimensions}")
    
    if DEMO_MODE:
        return jsonify({
            'message': 'Pre-upload compliance check complete (demo mode — GOOGLE_API_KEY not configured)',
            'feedback': demo_compliance_report(category)
        }), 200
    
    try:
        feedback_report = compliance_copy.analyze_seller_upload_text(
            image_blobs, 
            raw_text, 
            category,
            actual_weight=actual_weight,
            actual_dimensions=actual_dimensions
        )
        
        if 'error' in feedback_report:
            return jsonify({'error': feedback_report['error']}), 500
        
        return jsonify({
            'message': 'Pre-upload compliance check complete (text-based)',
            'feedback': feedback_report
        }), 200
        
    except Exception as e:
        # SECURITY: never leak a stack trace or raw exception internals to the client.
        print(f"[ERROR] Seller text upload check failed: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'error': 'Seller text upload check failed. Please try again.',
            'request_id': uuid.uuid4().hex[:12]
        }), 500


# ==================== MAIN ====================

if __name__ == '__main__':
    print("[INFO] Starting Flask Amazon Scraper Backend with AI Compliance")
    print("[INFO] Make sure to:")
    print("       1. Update .env with your MySQL credentials")
    print("       2. Update .env with your GOOGLE_API_KEY")
    print("       3. Run database_schema.sql to create tables")
    print("       4. Install required packages:")
    print("          pip install langchain langchain-google-genai langchain-community sqlalchemy")
    print("\n[AI COMPLIANCE] Module loaded successfully")
    print("       - analyze_compliance(product_id)")
    print("       - analyze_seller_upload(images, data, category)")
    print("       - chatbot_agent(message)")
    app.run(host='0.0.0.0', port=5000)
