# CraftCorps Launcher - Web Integration Features

## Overview
Complete integration between the CraftCorps launcher and web platform, enabling real-time synchronization of game data, notifications, friends, and stats.

---

## ✅ Implemented Features

### 1. Web Notifications System
**Location**: Title bar (bell icon with badge)

**Features**:
- 🔔 Real-time notification bell with unread count badge
- 🎵 Sound alerts for new notifications
- 🔄 Auto-polling every 30 seconds
- 📋 Dropdown panel with full notification history
- ✅ Mark individual or all notifications as read
- 🎯 Click notifications to navigate to relevant pages
- ⏰ Timestamp formatting ("Just now", "5m ago", etc.)

**Notification Types**:
- 🎁 **Vote Rewards** - "Thank you for voting! Here's +100 coins!"
- 👥 **Friend Requests** - New friend request alerts
- 💬 **Private Messages** - Message notifications from web/game
- 📦 **Market Sales** - Item sale notifications (future)

**API Endpoints** (Backend):
- `GET /api/launcher/notifications/list` - Fetch notifications
- `GET /api/launcher/notifications/unread-count` - Get unread count
- `POST /api/launcher/notifications/mark-read` - Mark as read

---

### 2. Real Seeds Balance
**Location**: Profile View (top-right card)

**Features**:
- 💰 Live Seeds (currency) balance display
- 🔄 Auto-refreshes on profile load
- 📊 Formatted with thousands separators

**API Endpoint**:
- `GET /api/launcher/balance` - Fetch Seeds balance

**Convex Query**:
- `launcher.getBalance(minecraftUuid)` - Returns balance and lastUpdated

---

### 3. In-Launcher Friends List
**Location**: Profile View (new card in right column)

**Features**:
- 👥 Complete friends list with avatars
- 🟢 Online status indicators (EU/India servers)
- 🔄 Auto-refreshes every 30 seconds
- 💬 Quick message button (prepared for future)
- 📊 Friend count display
- ⚡ Real-time online status from playerLocations table

**API Endpoint**:
- `GET /api/launcher/friends` - Fetch friends list

**Convex Query**:
- `launcher.getFriends(minecraftUuid)` - Returns enriched friends array

---

### 4. Dashboard Stats Integration
**Location**: Available via API (ready for integration)

**Features**:
- 💰 Seeds balance
- 🏠 Land claims count (EU/India/Total)
- 👥 Friends count
- ⏱️ Playtime (EU/India/Total minutes)
- 📬 Pending friend requests count
- 💬 Recent messages count
- 📊 Game stats (deaths, mob kills, PvP kills, teleports)

**API Endpoint**:
- `GET /api/launcher/stats` - Fetch comprehensive dashboard stats

**Convex Query**:
- `launcher.getDashboardStats(minecraftUuid)` - Returns all stats

---

### 5. Navigation System
**Features**:
- 🧭 Click notification → navigate to relevant page
  - Friend requests → Profile
  - Messages → Profile
  - Market sales → Market
- 🎯 Seamless tab switching from notification context

---

## 🔧 Technical Architecture

### Backend (Web App)
**Convex Functions** (`convex/launcher.ts`):
- `getBalance` - Fetch Seeds balance
- `getFriends` - Fetch friends with online status
- `getPendingRequests` - Get incoming friend requests
- `getDashboardStats` - Get comprehensive player stats
- `getRecentTransactions` - Get coin transaction history

**API Layer** (`src/pages/api/launcher/`):
- All endpoints use Bearer token authentication
- Validate with `auth.craftcorps.net/auth/me`
- Extract Minecraft UUID from linked accounts
- Query Convex with UUID

**Notification Queries** (`convex/notifications.ts`):
- `getNotificationsByUuid` - Launcher-specific query
- `getUnreadCountByUuid` - Unread count by UUID
- `markNotificationsReadByUuid` - Mark read mutation

### Launcher (Desktop App)

**IPC Handlers** (`electron/handlers/notificationHandler.cjs`):
- `get-notifications` - Fetch all notifications
- `get-unread-count` - Get unread count
- `mark-notifications-read` - Mark notifications as read
- `get-balance` - Fetch Seeds balance
- `get-friends` - Fetch friends list
- `get-dashboard-stats` - Fetch comprehensive stats

**Preload API** (`electron/preload.cjs`):
```javascript
window.electronAPI.getNotifications()
window.electronAPI.getUnreadCount()
window.electronAPI.markNotificationsRead(ids)
window.electronAPI.getBalance()
window.electronAPI.getFriends()
window.electronAPI.getDashboardStats()
```

**UI Components**:
- `NotificationBell.jsx` - Bell icon, dropdown, sound alerts
- `FriendsList.jsx` - Friends list with online status
- `ProfileView.jsx` - Enhanced with real balance + friends

---

## 🔐 Authentication Flow

1. **Launcher → Backend**:
   - Launcher has Bearer token from `authService`
   - Passes token in `Authorization: Bearer <token>` header

2. **Backend → Auth Service**:
   - API validates token with `auth.craftcorps.net/auth/me`
   - Extracts `linkedAccounts` from user data
   - Finds Microsoft account with Minecraft UUID

3. **Backend → Convex**:
   - Queries Convex with Minecraft UUID
   - Returns data to launcher

4. **Security**:
   - No Minecraft UUID in launcher storage
   - Token refreshes automatically via authService
   - All endpoints return safe defaults on auth failure

---

## 🎨 UI/UX Features

### Notification Bell
- **Badge**: Red circle with count (max "9+")
- **Sound**: Plays on new notifications
- **Toast**: Shows "You have new notifications!"
- **Dropdown**:
  - Max height 500px with custom scrollbar
  - Unread notifications highlighted (emerald bg)
  - Icons per notification type
  - Click to navigate + mark as read
  - "Mark all as read" button
  - "View all notifications" footer

### Friends List
- **Online Status**: Green dot + "ONLINE (EU/INDIA)"
- **Offline Status**: Gray dot + "OFFLINE"
- **Avatars**: Minecraft head renders (pixelated style)
- **Message Button**: Prepared for future messaging
- **Auto-refresh**: Updates every 30 seconds

### Profile View
- **Seeds Balance**: Live balance in top-right card
- **Friends Section**: New card showing all friends

---

## 📊 Data Sources

### Tables Used
- `coinBalances` - Seeds balance
- `friendships` - Friend relationships (bidirectional)
- `friendRequests` - Pending friend requests
- `landClaims` - Land claims by server
- `playerStats` - Playtime and game stats
- `playerLocations` - Online status (5min window)
- `coinTransactions` - Transaction history
- `notifications` - Web notifications
- `privateMessages` - Recent messages

---

## 🚀 Deployment Status

### Backend
✅ Convex deployed (`https://zany-lyrebird-881.convex.cloud`)
✅ Web app deployed (`craftcorps.net`, `6-7.uk`)

### Launcher
⏳ Needs build and testing

---

## 🧪 Testing Checklist

### Notifications
- [ ] Bell shows correct unread count
- [ ] Sound plays on new notification
- [ ] Dropdown shows all notifications
- [ ] Mark as read works
- [ ] Mark all as read works
- [ ] Navigation works (friend request → profile)
- [ ] Polling updates count every 30s

### Balance
- [ ] Profile shows correct Seeds balance
- [ ] Balance updates on profile load
- [ ] Formatted with commas (e.g., "1,234")

### Friends
- [ ] Friends list loads correctly
- [ ] Online status accurate (green = online, gray = offline)
- [ ] Server shown for online friends (EU/INDIA)
- [ ] Auto-refreshes every 30s
- [ ] Empty state shows when no friends

### Authentication
- [ ] Works with Microsoft-linked accounts
- [ ] Safe defaults for offline accounts
- [ ] Token refresh handled automatically

---

## 🔮 Future Enhancements

### Ready to Add
- [ ] In-launcher messaging system
- [ ] Dashboard stats panel on Home view
- [ ] Transaction history viewer
- [ ] Market sales notifications with actions
- [ ] Friend online/offline desktop notifications
- [ ] Claim visualization map

### API Ready
- `GET /api/launcher/stats` - Full dashboard stats available
- `launcher.getRecentTransactions()` - Transaction history query exists
- `launcher.getPendingRequests()` - Friend request query exists

---

## 📝 Code Locations

### Backend
```
/convex/launcher.ts            - Main launcher queries
/convex/notifications.ts       - Notification queries (UUID-based)
/src/pages/api/launcher/
  ├── balance.ts               - Balance endpoint
  ├── friends.ts               - Friends endpoint
  ├── stats.ts                 - Stats endpoint
  └── notifications/
      ├── list.ts              - Notification list
      ├── unread-count.ts      - Unread count
      └── mark-read.ts         - Mark read mutation
```

### Launcher
```
/electron/handlers/notificationHandler.cjs  - IPC handlers
/electron/preload.cjs                       - API exposure
/src/components/common/NotificationBell.jsx - Bell component
/src/components/profile/FriendsList.jsx     - Friends component
/src/views/ProfileView.jsx                  - Profile with balance + friends
/src/components/layout/TitleBar.jsx         - Bell integration
/src/App.jsx                                - Navigation handler
```

---

## 🎯 Impact

### User Benefits
- 📱 Stay connected without opening browser
- 🎁 Never miss vote rewards
- 👥 See friends online status instantly
- 💰 Track Seeds balance in real-time
- 🔔 Get notified of important events

### Technical Benefits
- 🔐 Secure Bearer token authentication
- 📊 Real-time data synchronization
- 🎨 Consistent UI/UX with web platform
- 🔄 Auto-refresh and polling
- 🎵 Native notification sounds

---

## 📞 Support

For issues or questions:
- Check console logs: `%APPDATA%/CraftCorps/logs/` (Windows)
- Check network tab for API calls
- Verify authentication status
- Test with different account types (Microsoft vs Offline)
