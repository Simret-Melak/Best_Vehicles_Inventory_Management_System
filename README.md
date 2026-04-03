# 🚛 Beast Vehicles Inventory System

A full-stack inventory management system for best vehicles (off-road vehicles, trucks, and electric bajajs) with serialized vehicle tracking, parts inventory, sales orders, and role-based approvals.

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)


## Overview

Beast Vehicles Inventory System helps workshops and dealerships track:

- **Vehicles** - Each vehicle tracked individually by chassis number
- **Parts** - Quantity-based inventory for accessories and spares
- **Sales Orders** - Complete order management with customer tracking
- **Payments** - Deposit and payment tracking with confirmation workflow
- **Role-Based Access** - Workers create requests, Admins confirm sales

## Features

### Core Features
- ✅ Serialized Vehicle Tracking - Each vehicle has unique chassis number
- ✅ Parts Inventory - Quantity-based with low stock alerts
- ✅ Customer Management - Store customer details and order history
- ✅ Sales Orders - Create orders with multiple items (vehicles + parts)
- ✅ Payment Processing - Track deposits with bank details
- ✅ Role-Based Access - Worker and Admin roles
- ✅ Inventory History - Complete audit trail of all transactions

### Admin Features
- ✅ Confirm/Reject sale requests
- ✅ Confirm deposits
- ✅ View all pending approvals
- ✅ Generate inventory reports

### Worker Features
- ✅ Add new vehicles to inventory
- ✅ Add parts stock
- ✅ Create sales orders
- ✅ Request sale approvals
- ✅ View inventory and history

## Tech Stack

### Backend
| Technology | Version | Purpose |
|------------|---------|---------|
| Node.js | 18+ | Runtime environment |
| Express | 4.18 | API framework |
| TypeScript | 5.x | Type safety |
| Supabase | Latest | Database + Auth |
| Cors | Latest | Cross-origin requests |

### Frontend (Mobile)
| Technology | Version | Purpose |
|------------|---------|---------|
| React Native | 0.72 | Mobile framework |
| Expo | SDK 50 | Development platform |
| React Navigation | 6.x | Screen navigation |
| TanStack Query | 4.x | Data fetching |
| Axios | 1.x | HTTP client |

## Project Structure
beast-vehicles-inventory/
│
├── backend/
│ ├── src/
│ │ ├── config/
│ │ │ └── supabase.ts
│ │ ├── controllers/
│ │ │ └── inventoryController.ts
│ │ ├── routes/
│ │ │ └── inventoryRoutes.ts
│ │ ├── middleware/
│ │ ├── services/
│ │ ├── utils/
│ │ └── server.ts
│ ├── .env
│ ├── package.json
│ └── tsconfig.json
│
├── frontend/
│ ├── src/
│ │ ├── screens/
│ │ ├── components/
│ │ ├── services/
│ │ ├── contexts/
│ │ └── App.tsx
│ ├── package.json
│ └── app.json
│
├── database/
│ ├── schema.sql
│ └── seed.sql
│
└── README.md

text

## Prerequisites

- **Node.js** v18 or higher
- **npm** v9 or higher
- **Supabase** account (free tier works)
- **Expo Go** app (for mobile testing)
- **Postman** (optional, for API testing)

