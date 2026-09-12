#!/usr/bin/env python3
"""
Streamlit Frontend for Amazon Product Scraper
Integrates with Flask Backend API
"""

import streamlit as st
import requests
import pandas as pd
import folium
from streamlit_folium import st_folium
from datetime import datetime
import json

# ==================== CONFIGURATION ====================
API_BASE_URL = "http://localhost:5000/api"

# Initialize session state
if 'logged_in' not in st.session_state:
    st.session_state.logged_in = False
if 'user' not in st.session_state:
    st.session_state.user = None
if 'session_cookies' not in st.session_state:
    st.session_state.session_cookies = None

# ==================== API HELPER FUNCTIONS ====================
def api_request(endpoint, method='GET', data=None):
    """Make API request with session handling"""
    url = f"{API_BASE_URL}{endpoint}"
    try:
        if method == 'GET':
            response = requests.get(url, cookies=st.session_state.session_cookies, timeout=30)
        else:
            response = requests.post(url, json=data, cookies=st.session_state.session_cookies, timeout=60)

        # Update session cookies
        if response.cookies:
            if st.session_state.session_cookies is None:
                st.session_state.session_cookies = {}
            st.session_state.session_cookies.update(response.cookies.get_dict())

        return response
    except requests.exceptions.ConnectionError:
        st.error("❌ Cannot connect to backend server. Make sure Flask is running on port 5000.")
        return None
    except requests.exceptions.Timeout:
        st.error("❌ Request timed out. The scraping process may take longer for some products.")
        return None

# ==================== AUTHENTICATION PAGES ====================
def login_page():
    """Login page UI"""
    st.title("🔐 Login")

    with st.form("login_form"):
        username = st.text_input("Username")
        password = st.text_input("Password", type="password")
        submit = st.form_submit_button("Login", use_container_width=True)

        if submit:
            if username and password:
                response = api_request('/login', 'POST', {
                    'username': username,
                    'password': password
                })

                if response and response.status_code == 200:
                    data = response.json()
                    st.session_state.logged_in = True
                    st.session_state.user = data['user']
                    st.success(f"✅ Welcome back, {data['user']['username']}!")
                    st.rerun()
                elif response:
                    st.error(f"❌ {response.json().get('error', 'Login failed')}")
            else:
                st.warning("Please enter both username and password")

def signup_page():
    """Signup page UI"""
    st.title("📝 Create Account")

    with st.form("signup_form"):
        username = st.text_input("Username")
        password = st.text_input("Password", type="password")
        confirm_password = st.text_input("Confirm Password", type="password")
        role = st.selectbox("Account Type", ["customer", "seller"])

        st.info("💡 **Customer**: Can scrape and view products\n**Seller**: Can also view analytics and heatmaps")

        submit = st.form_submit_button("Create Account", use_container_width=True)

        if submit:
            if not username or not password:
                st.warning("Please fill in all fields")
            elif password != confirm_password:
                st.error("Passwords do not match")
            elif len(password) < 6:
                st.warning("Password must be at least 6 characters")
            else:
                response = api_request('/signup', 'POST', {
                    'username': username,
                    'password': password,
                    'role': role
                })

                if response and response.status_code == 201:
                    st.success("✅ Account created successfully! Please login.")
                elif response:
                    st.error(f"❌ {response.json().get('error', 'Signup failed')}")

def logout():
    """Handle logout"""
    api_request('/logout', 'POST')
    st.session_state.logged_in = False
    st.session_state.user = None
    st.session_state.session_cookies = None
    st.rerun()

# ==================== MAIN APPLICATION PAGES ====================
def scrape_page():
    """Product scraping page"""
    st.title("🔍 Scrape Amazon Product")
    st.markdown("Enter an Amazon product URL to extract product information using AI-powered scraping.")

    with st.form("scrape_form"):
        url = st.text_input(
            "Amazon Product URL",
            placeholder="https://www.amazon.in/dp/XXXXXXXXXX"
        )
        submit = st.form_submit_button("🚀 Scrape Product", use_container_width=True)

        if submit:
            if not url:
                st.warning("Please enter a product URL")
            elif 'amazon' not in url.lower():
                st.error("Please enter a valid Amazon URL")
            else:
                with st.spinner("🔄 AI is analyzing and scraping the product... This may take a moment."):
                    response = api_request('/scrape', 'POST', {'url': url})

                    if response and response.status_code == 200:
                        data = response.json()
                        st.success(f"✅ {data['message']}")

                        col1, col2, col3 = st.columns(3)
                        with col1:
                            st.metric("Product ID", data['product_id'])
                        with col2:
                            st.metric("ASIN", data['asin'])
                        with col3:
                            st.metric("Images Stored", data['images_stored'])

                        st.info(f"📦 **Title:** {data.get('title', 'N/A')}")

                        if data.get('is_update'):
                            st.info("ℹ️ This product was updated (already existed in database)")

                        activity = data.get('activity_logged', 'none')
                        if activity == 'customer_scrape':
                            st.success("📊 Your view has been logged for seller analytics")
                        elif activity == 'seller_own_scrape':
                            st.info("📊 Activity logged as owner scrape")

                    elif response:
                        st.error(f"❌ {response.json().get('error', 'Scraping failed')}")

def products_page():
    """View scraped products"""
    st.title("📦 My Products")

    response = api_request('/products')

    if response and response.status_code == 200:
        products = response.json().get('products', [])

        if not products:
            st.info("No products found. Start by scraping some Amazon products!")
            return

        st.markdown(f"**Total Products:** {len(products)}")

        for product in products:
            with st.expander(f"📦 {product.get('title', 'Untitled')[:60]}...", expanded=False):
                col1, col2 = st.columns([2, 1])

                with col1:
                    st.markdown(f"**ASIN:** `{product.get('asin')}`")
                    st.markdown(f"**Price:** {product.get('currency', '')} {product.get('price', 'N/A')}")
                    st.markdown(f"**[View on Amazon]({product.get('url')})**")

                with col2:
                    if st.button("View Details", key=f"view_{product['product_id']}"):
                        st.session_state.selected_product_id = product['product_id']
                        st.rerun()
    else:
        st.error("Failed to load products")

def product_detail_page(product_id):
    """View detailed product information"""
    st.title("📋 Product Details")

    if st.button("← Back to Products"):
        if 'selected_product_id' in st.session_state:
            del st.session_state.selected_product_id
        st.rerun()

    response = api_request(f'/product/{product_id}')

    if response and response.status_code == 200:
        product = response.json().get('product', {})

        st.header(product.get('title', 'Product'))

        col1, col2, col3 = st.columns(3)
        with col1:
            st.metric("Price", f"{product.get('currency', '')} {product.get('price', 'N/A')}")
        with col2:
            st.metric("ASIN", product.get('asin', 'N/A'))
        with col3:
            st.metric("Images", product.get('image_count', 0))

        st.markdown(f"**[View on Amazon]({product.get('url')})**")

        json_data = product.get('product_json', {})
        if json_data:
            st.subheader("Product Information")

            if json_data.get('description'):
                with st.expander("📝 Description", expanded=True):
                    st.write(json_data['description'])

            if json_data.get('feature_bullets'):
                with st.expander("✨ Features"):
                    for feature in json_data['feature_bullets']:
                        st.markdown(f"• {feature}")

            if json_data.get('specifications'):
                with st.expander("📊 Specifications"):
                    specs = json_data['specifications']
                    if isinstance(specs, dict):
                        for key, value in specs.items():
                            st.markdown(f"**{key}:** {value}")
                    else:
                        st.write(specs)

            if json_data.get('technical_details'):
                with st.expander("🔧 Technical Details"):
                    tech = json_data['technical_details']
                    if isinstance(tech, dict):
                        for key, value in tech.items():
                            st.markdown(f"**{key}:** {value}")
                    else:
                        st.write(tech)

            if json_data.get('rating') or json_data.get('reviews_count'):
                with st.expander("⭐ Rating & Reviews"):
                    if json_data.get('rating'):
                        st.metric("Rating", f"{json_data['rating']} / 5")
                    if json_data.get('reviews_count'):
                        st.metric("Reviews", json_data['reviews_count'])
    else:
        st.error("Product not found")

def seller_activity_page():
    """Seller/customer activity logs"""
    st.title("📊 Activity")
    st.markdown("View scraping activity related to you.")

    response = api_request('/seller/activity')

    if response and response.status_code == 200:
        activities = response.json().get('activities', [])

        if not activities:
            st.info("No activity recorded yet.")
            return

        st.markdown(f"**Total Activities:** {len(activities)}")

        df = pd.DataFrame(activities)

        if 'timestamp' in df.columns:
            df['timestamp'] = pd.to_datetime(df['timestamp']).dt.strftime('%Y-%m-%d %H:%M')

        # Show all available useful cols
        candidate_cols = [
            'customer_username',    # for seller view
            'seller_username',      # if you later add it
            'action',
            'location',
            'timestamp'
        ]
        display_cols = [c for c in candidate_cols if c in df.columns]

        st.dataframe(
            df[display_cols],
            use_container_width=True,
            hide_index=True,
            column_config={
                "customer_username": "Customer",
                "seller_username": "Seller",
                "action": "Action",
                "location": "Location",
                "timestamp": "Time",
            }
        )
    elif response and response.status_code == 403:
        st.error("You are not allowed to view this activity.")
    else:
        st.error("Failed to load activity data")

def heatmap_page():
    """Geographic heatmap for current user (seller or customer)"""
    st.title("🗺️ My Heatmap")
    st.markdown("See where scraping activity related to you is happening.")

    response = api_request('/heatmap')
    if not response:
        st.error("Failed to load heatmap data")
        return

    if response.status_code != 200:
        try:
            err = response.json().get('error', 'Failed to load heatmap data')
        except Exception:
            err = 'Failed to load heatmap data'
        st.error(err)
        return

    data = response.json()
    user_role = data.get('user_role')
    heatmap_data = data.get('heatmap_data', [])

    st.caption(data.get('description', ''))

    if not heatmap_data:
        st.info("No geographic data available yet.")
        return

    col1, col2 = st.columns(2)
    with col1:
        st.metric("Total Locations", data.get('total_locations', 0))
    with col2:
        st.metric("Total Scrapes", data.get('total_scrapes', 0))

    valid_coords = [
        (d['latitude'], d['longitude'])
        for d in heatmap_data
        if d.get('latitude') and d.get('longitude')
    ]

    if valid_coords:
        avg_lat = sum(c[0] for c in valid_coords) / len(valid_coords)
        avg_lon = sum(c[1] for c in valid_coords) / len(valid_coords)

        m = folium.Map(location=[avg_lat, avg_lon], zoom_start=4)

        for point in heatmap_data:
            if point.get('latitude') and point.get('longitude'):
                popup_lines = [point.get('location', 'Unknown')]
                popup_lines.append(f"Views: {point.get('scrape_count', 0)}")

                if user_role == 'seller':
                    if point.get('product_title'):
                        popup_lines.append(f"Product: {point['product_title']}")
                    if point.get('asin'):
                        popup_lines.append(f"ASIN: {point['asin']}")
                    if point.get('unique_customers') is not None:
                        popup_lines.append(f"Unique customers: {point['unique_customers']}")
                else:
                    if point.get('seller_name'):
                        popup_lines.append(f"Seller: {point['seller_name']}")
                    if point.get('activity_type'):
                        popup_lines.append(f"Type: {point['activity_type']}")

                popup_html = "<br>".join(popup_lines)

                folium.CircleMarker(
                    location=[point['latitude'], point['longitude']],
                    radius=min(point.get('scrape_count', 1) * 3, 20),
                    popup=popup_html,
                    color='red',
                    fill=True,
                    fillColor='red',
                    fillOpacity=0.6,
                ).add_to(m)

        st_folium(m, width=700, height=500)

    st.subheader("Location Details")
    df = pd.DataFrame(heatmap_data)
    if not df.empty:
        if user_role == 'seller':
            display_cols = [
                c for c in [
                    'location',
                    'scrape_count',
                    'unique_customers',
                    'product_title',
                    'asin',
                    'last_scrape',
                ] if c in df.columns
            ]
        else:
            display_cols = [
                c for c in [
                    'location',
                    'scrape_count',
                    'seller_name',
                    'activity_type',
                    'last_scrape',
                ] if c in df.columns
            ]

        st.dataframe(
            df[display_cols],
            use_container_width=True,
            hide_index=True,
            column_config={
                "location": "Location",
                "scrape_count": "Views",
                "unique_customers": "Unique customers",
                "product_title": "Product",
                "asin": "ASIN",
                "seller_name": "Seller",
                "activity_type": "Type",
                "last_scrape": "Last Activity",
            },
        )

def global_heatmap_page():
    """Global heatmap for all activity on the platform"""
    st.title("🌍 Global Heatmap")
    st.markdown("See scraping activity across all users on the platform.")

    response = api_request('/global-heatmap')
    if not response:
        st.error("Failed to load global heatmap data")
        return

    if response.status_code != 200:
        try:
            err = response.json().get('error', 'Failed to load global heatmap data')
        except Exception:
            err = 'Failed to load global heatmap data'
        st.error(err)
        return

    data = response.json()
    global_data = data.get('global_heatmap_data', [])

    st.caption(data.get('description', ''))

    if not global_data:
        st.info("No global geographic data available yet.")
        return

    col1, col2 = st.columns(2)
    with col1:
        st.metric("Total Locations", data.get('total_locations', 0))
    with col2:
        st.metric("Total Scrapes", data.get('total_scrapes', 0))

    valid_coords = [
        (d['latitude'], d['longitude'])
        for d in global_data
        if d.get('latitude') and d.get('longitude')
    ]

    if valid_coords:
        avg_lat = sum(c[0] for c in valid_coords) / len(valid_coords)
        avg_lon = sum(c[1] for c in valid_coords) / len(valid_coords)

        m = folium.Map(location=[avg_lat, avg_lon], zoom_start=3)

        for point in global_data:
            if point.get('latitude') and point.get('longitude'):
                popup_lines = [
                    point.get('location', 'Unknown'),
                    f"Total scrapes: {point.get('total_scrapes', 0)}",
                ]
                if point.get('unique_customers') is not None:
                    popup_lines.append(f"Unique customers: {point['unique_customers']}")
                if point.get('products_from_sellers') is not None:
                    popup_lines.append(f"Sellers: {point['products_from_sellers']}")
                popup_html = "<br>".join(popup_lines)

                folium.CircleMarker(
                    location=[point['latitude'], point['longitude']],
                    radius=min(point.get('total_scrapes', 1) * 3, 25),
                    popup=popup_html,
                    color='blue',
                    fill=True,
                    fillColor='blue',
                    fillOpacity=0.5,
                ).add_to(m)

        st_folium(m, width=700, height=500)

    st.subheader("Global Location Details")
    df = pd.DataFrame(global_data)
    if not df.empty:
        display_cols = [
            c for c in [
                'location',
                'total_scrapes',
                'unique_customers',
                'products_from_sellers',
                'last_activity',
            ] if c in df.columns
        ]
        st.dataframe(
            df[display_cols],
            use_container_width=True,
            hide_index=True,
            column_config={
                "location": "Location",
                "total_scrapes": "Total scrapes",
                "unique_customers": "Unique customers",
                "products_from_sellers": "Sellers",
                "last_activity": "Last Activity",
            },
        )

# ==================== MAIN APP ====================
def main():
    st.set_page_config(
        page_title="Amazon Product Scraper",
        page_icon="🛒",
        layout="wide"
    )

    st.markdown("""
        <style>
        .stMetric {
            background-color: #f0f2f6;
            padding: 10px;
            border-radius: 5px;
        }
        </style>
    """, unsafe_allow_html=True)

    if not st.session_state.logged_in:
        tab1, tab2 = st.tabs(["🔐 Login", "📝 Sign Up"])

        with tab1:
            login_page()
        with tab2:
            signup_page()
    else:
        with st.sidebar:
            st.title("🛒 Amazon Scraper")
            st.markdown(f"**User:** {st.session_state.user['username']}")
            st.markdown(f"**Role:** {st.session_state.user['role'].title()}")
            st.divider()

            page = st.radio(
                "Navigation",
                [
                    "🔍 Scrape Product",
                    "📦 My Products",
                    "📊 Activity",
                    "🗺️ My Heatmap",
                    "🌍 Global Heatmap",
                ],
                label_visibility="collapsed"
            )

            st.divider()
            if st.button("🚪 Logout", use_container_width=True):
                logout()

        if 'selected_product_id' in st.session_state:
            product_detail_page(st.session_state.selected_product_id)
        elif page == "🔍 Scrape Product":
            scrape_page()
        elif page == "📦 My Products":
            products_page()
        elif page == "📊 Activity":
            seller_activity_page()
        elif page == "🗺️ My Heatmap":
            heatmap_page()
        elif page == "🌍 Global Heatmap":
            global_heatmap_page()

if __name__ == "__main__":
    main()
