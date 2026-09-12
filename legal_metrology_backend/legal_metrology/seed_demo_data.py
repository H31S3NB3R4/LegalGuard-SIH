#!/usr/bin/env python3
"""Seed demo data for LegalGuard (idempotent).

Creates:
  - a `demo` user (login: demo / Dem0@LegalGuard!) with Meta-Tokens,
  - 3 realistic products (compliant A+, partially compliant C, non-compliant F)
    with persisted compliance reports, remarks and seller locations so the
    Products list, grade filter, dashboard and heatmap are populated,
  - 3 gifts/rewards in the catalogue.

Run from the backend dir:
    .\\venv\\Scripts\\python.exe seed_demo_data.py
"""
import os
import json
from datetime import datetime

import bcrypt
import mysql.connector
from dotenv import load_dotenv

# Phase 11: real per-product assessments in seeded reports.
import assessment as assessment_gen

load_dotenv()

DB_CONFIG = {
    'host': os.getenv('DB_HOST', '127.0.0.1'),
    'user': os.getenv('DB_USER'),
    'password': os.getenv('DB_PASSWORD'),
    'database': os.getenv('DB_NAME'),
    'port': int(os.getenv('DB_PORT', '3306')),
}

DEMO_USERNAME = 'demo'
DEMO_PASSWORD = 'Dem0@LegalGuard!'


def report(pid, asin, title, grade, score, summary, violations, recommendations,
           is_compliant, requires_action, quality=0.9, missing=None):
    rep = {
        'product_id': pid,
        'asin': asin,
        'title': title,
        'category': 'food',
        'analysis_date': datetime.now().isoformat(),
        'compliance_score': score,
        'compliance_grade': grade,
        'violation_summary': summary,
        'violations': violations,
        'data_analysis': {
            'quality_score': quality,
            'missing_critical_info': missing or [],
        },
        'ocr_analysis': {
            'success': True,
            'image_quality': 'good',
            'confidence': 0.92,
            'symbols_found': ['veg-mark'] if grade in ('A+', 'C') else [],
        },
        'recommendations': recommendations,
        'is_compliant': is_compliant,
        'requires_action': requires_action,
        'demo_seed': True,
    }
    # Phase 11: real per-product assessment derived from these actual results.
    rep['assessment'] = assessment_gen.deterministic_assessment(rep)
    return rep


def main():
    conn = mysql.connector.connect(**DB_CONFIG)
    cur = conn.cursor(dictionary=True)

    # ---------- demo user ----------
    cur.execute("SELECT id FROM Users WHERE username = %s", (DEMO_USERNAME,))
    row = cur.fetchone()
    if row:
        uid = row['id']
        print(f"[SEED] demo user already exists (id={uid}); nothing to create -> exit")
        return

    pw_hash = bcrypt.hashpw(DEMO_PASSWORD.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    cur.execute(
        "INSERT INTO Users (username, password, role, mt_tokens) VALUES (%s, %s, 'customer', 120)",
        (DEMO_USERNAME, pw_hash))
    uid = cur.lastrowid
    print(f"[SEED] created demo user id={uid}")

    # ---------- products ----------
    products = [
        # 1) COMPLIANT (A+)
        ('B0DEMOF000000SALT', 'Tata Salt 1kg - Iodized Table Salt', 'food',
         {'name': 'Tata Consumer Products Ltd',
          'store_url': 'http://www.amazon.in',
          'ai_insights': {'location': 'Mumbai, Maharashtra', 'seller_type': 'Certified Brand',
                          'reputation': 'High', 'description': 'Indian FMCG manufacturer'},
          'category': 'food', 'price': 28.0, 'rating': 4.5},
         {'title': 'Tata Salt 1kg - Iodized Table Salt',
          'product_details': 'MRP Rs. 28.00 (INR) incl. of all taxes',
          'net_quantity': '1 kg e', 'fssai_license_number': '10012011000123',
          'mfg_date': 'May 2026', 'best_before': '24 months from packaging',
          'manufacturer_name': 'Tata Consumer Products Ltd',
          'manufacturer_address': 'M. Visvesvaraya Industrial Area, Turbhe, Navi Mumbai - 400705',
          'country_of_origin': 'India', 'customer_care': '1800-123-456',
          'vegetarian': 'Veg mark present', 'ingredients': 'Refined salt, potassium iodate',
          'nutritional_info': 'per 100g: Energy 0 kcal, Sodium 38 g'},
         92.0, 'A+',
         {'critical': 0, 'major': 0, 'minor': 0, 'total': 0},
         [],
         ['Maintain the same labelling on all SKUs.'],
         True, False, 0.96, []),
        # 2) PARTIALLY COMPLIANT (C)
        ('B0DEMOF000YUMCHIP', 'YumCrunch Masala Chips 70g', 'food',
         {'name': 'YumCrunch Foods Pvt Ltd',
          'store_url': 'http://www.amazon.in',
          'ai_insights': {'location': 'Delhi NCR', 'seller_type': 'Regional Brand',
                          'reputation': 'Medium', 'description': 'Snack manufacturer'},
          'category': 'food', 'price': 20.0, 'rating': 3.9},
         {'title': 'YumCrunch Masala Chips 70g',
          'product_details': 'Tasty masala potato chips, great for parties',
          'net_quantity': '70 g', 'mfg_date': 'Apr 2026',
          'best_before': 'see on pack', 'manufacturer_name': 'YumCrunch Foods Pvt Ltd',
          'ingredients': 'Potato, edible vegetable oil, salt, spices'},
         55.0, 'C',
         {'critical': 1, 'major': 2, 'minor': 1, 'total': 4},
         [{'category': 'food', 'severity': 'critical', 'rule': 'FSSAI License Number',
           'description': 'Must display valid 14-digit FSSAI license number', 'remedy': 'Add FSSAI licence no.'},
          {'category': 'food', 'severity': 'major', 'rule': 'MRP (Maximum Retail Price)',
           'description': 'Must state MRP incl. of all taxes', 'remedy': 'Print MRP incl. of taxes'},
          {'category': 'food', 'severity': 'major', 'rule': 'Net Quantity Declaration',
           'description': 'Net quantity must use standard metric units with "e" mark', 'remedy': 'Declare net qty with e mark'},
          {'category': 'food', 'severity': 'minor', 'rule': 'Best Before Date',
           'description': 'Best before date is vague ("see on pack")', 'remedy': 'Print explicit date'}],
         ['Add a valid 14-digit FSSAI licence number.',
          'Print MRP including all taxes.',
          'Declare net quantity in standard units with the "e" mark.',
          'Print a clear best-before/expiry date.'],
         False, True, 0.71,
         ['FSSAI License Number', 'MRP', 'Best Before Date']),
        # 3) NON-COMPLIANT (F)
        ('B0DEMOF000GLOWCRM', 'GlowBeauty Face Cream 50ml', 'cosmetics',
         {'name': 'GlowBeauty (HK) Ltd',
          'store_url': 'http://www.amazon.in',
          'ai_insights': {'location': 'Kolkata, West Bengal', 'seller_type': 'Importer',
                          'reputation': 'Low', 'description': 'Cosmetic importer'},
          'category': 'cosmetics', 'price': 649.0, 'rating': 3.2},
         {'title': 'GlowBeauty Face Cream 50ml',
          'product_details': 'Price $12.99 USD. Total quantity: 50 ml',
          'manufacturer_name': 'GlowBeauty (HK) Ltd', 'country_of_origin': 'China'},
         15.0, 'F',
         {'critical': 3, 'major': 1, 'minor': 0, 'total': 4},
         [{'category': 'cosmetics', 'severity': 'critical', 'rule': 'MRP in INR',
           'description': 'Price shown in USD, not MRP in Indian rupees incl. of taxes', 'remedy': 'Print MRP in INR'},
          {'category': 'cosmetics', 'severity': 'critical', 'rule': 'Manufacture Date',
           'description': 'Manufacture date not declared', 'remedy': 'Print month/year of manufacture'},
          {'category': 'cosmetics', 'severity': 'critical', 'rule': 'Best Before / Use By',
           'description': 'Expiry / best-before not declared', 'remedy': 'Print use-by / best-before'},
          {'category': 'cosmetics', 'severity': 'major', 'rule': 'Manufacturer/Importer Address',
           'description': 'No importer name & registered address in India', 'remedy': 'Add importer details'}],
         ['Print MRP in Indian rupees including all taxes.',
          'Declare manufacture and use-by dates.',
          'Add importer name and registered address in India.'],
         False, True, 0.42,
         ['MRP', 'Manufacture Date', 'Expiry Date', 'Importer Address']),
    ]

    for asin, title, category, seller_info, raw, score, grade, summary, viol, rec, comp, act, quality, missing in products:
        cur.execute(
            """INSERT INTO Products (user_id, url, asin, title, price, currency, country, language,
               seller_information, product_json, product_json_raw, analysis_results, remarks,
               rating, last_analysed)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())""",
            (uid, f'https://www.amazon.in/dp/{asin}', asin, title,
             score, 'INR', 'India', 'en',
             json.dumps(seller_info),
             json.dumps({'detected_category': category, 'asin': asin}),
             json.dumps(raw),
             json.dumps(report(0, asin, title, grade, score, summary, viol, rec, comp, act,
                               quality=quality, missing=missing)),
             f"Grade: {grade} | Score: {score} | Critical: {summary['critical']}, Major: {summary['major']}, Minor: {summary['minor']}",
             4.0))
        pid = cur.lastrowid
        # fix product_id inside the persisted report
        rep = report(pid, asin, title, grade, score, summary, viol, rec, comp, act,
                     quality=quality, missing=missing)
        cur.execute("UPDATE Products SET analysis_results=%s WHERE product_id=%s",
                    (json.dumps(rep), pid))
        print(f"[SEED] product {pid}: {title} -> Grade {grade} ({score})")

    # ---------- gifts / rewards ----------
    gifts = [
        ('GFT-AMZ-500-001', 'AMZ-500-9F2K', 'Amazon.in', 500.00, 120),
        ('GFT-FLP-250-001', 'FLP-250-7H1Q', 'Flipkart', 250.00, 80),
        ('GFT-UPI-200-001', 'UPI-200-3X8W', 'UPI Cashback', 200.00, 50),
    ]
    for code, pin, partner, value, tokens in gifts:
        cur.execute("INSERT INTO Gifts (gift_code, gift_pin, partner, value, mt_tokens_required) VALUES (%s,%s,%s,%s,%s)",
                    (code, pin, partner, value, tokens))
    print(f"[SEED] gifts added: {len(gifts)}")

    conn.commit()
    cur.close()
    conn.close()
    print("\n[SEED] Done. Login with -> username: demo  password: Dem0@LegalGuard!")


if __name__ == '__main__':
    main()