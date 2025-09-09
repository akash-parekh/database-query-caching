# Database Query Caching with Redis in Node.js

## 📖 Overview
This project demonstrates how to integrate **Redis** as a caching layer in a **Node.js** application with **PostgreSQL** as the database.  
The goal is to reduce repeated queries to the database and serve faster API responses.

---

## 🚀 Tech Stack
- **Backend:** Node.js + Express
- **Database:** PostgreSQL (via Docker)
- **Cache:** Redis (via Docker)
- **Testing:** Postman

---

## ⚙️ How It Works
1. Client requests a **product list** from API.
2. Server checks **Redis cache**:
   - If found → return cached result (fast).
   - If not found → query PostgreSQL, store in Redis, return response.
3. If database is updated → **invalidate cache** so fresh data is stored on next request.

---

## 📦 Setup Instructions

### 1. Clone Repository
```bash
git clone https://github.com/your-username/redis-query-cache.git
cd redis-query-cache
