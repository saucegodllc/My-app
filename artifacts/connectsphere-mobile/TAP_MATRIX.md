# ConnectSphere — Tap Matrix (2026-06)

Every tappable element across all 5 tabs, nested screens, and modals.
Status: ✅ wired · ⚠️ soft-limit · 🔜 planned

---

## Tab 1 — Discover (`app/(tabs)/index.tsx`)

### Intent selector (top row)
| Element | Destination / Outcome | Status |
|---|---|---|
| Dating tab | `setActiveIntent("dating")`, resets card stack | ✅ |
| Friends tab | `setActiveIntent("friends")`, resets card stack | ✅ |
| Groups tab | `setActiveIntent("groups")`, resets card stack | ✅ |
| (disabled intent) | `disabled={!isAllowed}` — no-op, visually grayed | ✅ |

### Sub-tab selector
| Element | Destination / Outcome | Status |
|---|---|---|
| "For You" / filter tabs | `setActiveSubTab(tab)`, resets card index | ✅ |

### Top controls bar
| Element | Destination / Outcome | Status |
|---|---|---|
| Filter icon | Opens filter/discovery sheet | ✅ |
| Swipe count pill | Display only | ✅ |
| Boost | `router.push("/premium", { feature: "boost" })` | ✅ |
| Rewind | `handleRewind()` — restores last swiped card (premium gate) | ✅ |

### Card deck
| Element | Destination / Outcome | Status |
|---|---|---|
| Tap card photo zone | Opens expanded profile viewer | ✅ |
| Tap card bottom info | Opens expanded profile viewer | ✅ |
| Vibe chip (VibeSheet) | Opens vibe details sheet | ✅ |
| Why chip (WhySheet) | Opens match-reason sheet | ✅ |
| Close vibe/why sheet | `setShowVibeSheet(false)` | ✅ |
| "AI Companion" FAB | `router.push("/chat/ai-bot", { mode: "dating" })` | ✅ |

### Swipe rail buttons (Dating mode)
| Element | Destination / Outcome | Status |
|---|---|---|
| Pass | `onPass()` — left-swipe action | ✅ |
| Shot | Opens ShotSheet to send a direct message | ✅ |
| Spark | `handleReaction("spark")` | ✅ |
| Like / Super Like | Right-swipe action, may trigger match modal | ✅ |

### Swipe rail buttons (Friends mode)
| Element | Destination / Outcome | Status |
|---|---|---|
| Pass | `onPass()` | ✅ |
| Plan | `openFriendPlan(profile, "plan")` → CreateFriendPlanSheet | ✅ |
| Besties | `handleReaction("spark")` → best_friend action | ✅ |
| Vibe/Connect | `handleFriendAction(profile, "connect")` | ✅ |

### Expanded profile viewer (modal)
| Element | Destination / Outcome | Status |
|---|---|---|
| Prev / Next photo arrows | `goPrev()` / `goNext()` | ✅ |
| Photo thumbnail row | `setPhotoIdx(i)` | ✅ |
| Close (×) | Dismisses modal | ✅ |
| Shot idea rows | Pre-fills ShotSheet message | ✅ |
| Action rows (Plan, Besties, etc.) | `onAction(item.action)` → wired handler | ✅ |

### Match modal (after like match)
| Element | Destination / Outcome | Status |
|---|---|---|
| "Start chatting" | `openChat(result.chat.id)` | ✅ |
| Dismiss | Closes modal | ✅ |

### Swipe limit sheet
| Element | Destination / Outcome | Status |
|---|---|---|
| Backdrop tap | `setSwipeLimitModalVisible(false)` | ✅ |
| "Unlock Plus" CTA | `router.push("/premium", { feature: "swipes" })` | ✅ |
| Dismiss (×) | `setSwipeLimitModalVisible(false)` | ✅ |

### Sender+ sheet (Boost / SenderPlus)
| Element | Destination / Outcome | Status |
|---|---|---|
| Close | Dismisses sheet | ✅ |
| Primary CTA | Activates boost / sender+ | ✅ |
| Secondary | Dismisses sheet | ✅ |

### Empty state (no cards)
| Element | Destination / Outcome | Status |
|---|---|---|
| "Refresh Feed" | `handlePress()` re-fetches profiles | ✅ |
| "Explore Spaces" | `router.push("/(tabs)/communities")` | ✅ |
| "Find events" | `router.push("/(tabs)/events")` | ✅ |

---

## Tab 2 — Matches (`app/(tabs)/matches.tsx`)

### Spotlight row (new matches)
| Element | Destination / Outcome | Status |
|---|---|---|
| Match card — server chat | `openChat(chatId)` | ✅ |
| Match card — local dating | `router.push("/chat/dating/[id]", { id })` | ✅ |
| Match card — no chat yet | `openProfile(peerId, "matches", {...})` | ✅ |

### Chat list
| Element | Destination / Outcome | Status |
|---|---|---|
| Chat row | `openChat(chatId)` | ✅ |

### Moment Requests section
| Element | Destination / Outcome | Status |
|---|---|---|
| Accept button | Removes request, flash, then `openProfile(userId)` after 800ms | ✅ |
| Decline button | Removes request from list | ✅ |
| Avatar tap | `openProfile(fromUserId, "moments", {...})` | ✅ |

### Likes section (premium)
| Element | Destination / Outcome | Status |
|---|---|---|
| Like card (blur, free) | `router.push("/premium", { feature: "likes" })` | ✅ |
| Like card (visible, premium) | `openProfile(userId, "likes", {...})` | ✅ |

### Incoming actions / double-date section
| Element | Destination / Outcome | Status |
|---|---|---|
| Accept / Decline action | Handles the request | ✅ |

### Empty states
| Element | Destination / Outcome | Status |
|---|---|---|
| No requests empty state | Static illustration + copy | ✅ |
| No likes empty state | "Get Plus" CTA → `/premium` | ✅ |
| No chats empty state | "Start discovering" CTA → `/(tabs)/index` | ✅ |

---

## Tab 3 — Events (`app/(tabs)/events.tsx`)

### Event cards / list
| Element | Destination / Outcome | Status |
|---|---|---|
| Event card tap | Opens `EventDetailSheet` bottom sheet | ✅ |

### EventDetailSheet
| Element | Destination / Outcome | Status |
|---|---|---|
| Get Directions | `Linking.openURL(mapsUrl)` (Apple Maps / Google Maps) | ✅ |
| Get Tickets | `Linking.openURL(ticketUrl)` — falls back to Google search | ✅ |
| Create Plan | `openPlanFromEvent(event)` → CreateFriendPlanSheet | ✅ |
| Share | `Share.share({ message, url })` | ✅ |
| Attendee avatar | `openProfile(userId, "events", {...})` | ✅ |
| Close sheet | Dismisses modal | ✅ |

### Plan chat (if plan exists for event)
| Element | Destination / Outcome | Status |
|---|---|---|
| Open plan chat | `openChat(chatId)` | ✅ |

### Empty state
| Element | Destination / Outcome | Status |
|---|---|---|
| "Browse more" / refresh | `handlePress()` | ✅ |

---

## Tab 4 — Moments (`app/(tabs)/moments.tsx`)

### Moment feed
| Element | Destination / Outcome | Status |
|---|---|---|
| Moment card tap | Opens `MomentViewer` full-screen modal | ✅ |
| Like button | `handleLike()` — haptic + flash "❤️ Liked X's Moment!" | ✅ |
| User avatar / name | `openProfile(userId, "moments", {...})` | ✅ |

### MomentViewer modal
| Element | Destination / Outcome | Status |
|---|---|---|
| Like (❤️) | Haptic + sets liked state | ✅ |
| Echo (🔁) | `Alert.alert("Echo coming soon 🔜", ..., [{ text: "Got it", onPress: onClose }])` | ✅ |
| Report (⋯) | Opens report action sheet | ✅ |
| Close (×) | Dismisses modal | ✅ |
| Prev / Next arrows | Navigate between moments | ✅ |

### Post a Moment button
| Element | Destination / Outcome | Status |
|---|---|---|
| Camera / post FAB | Opens camera / media picker for new Moment | ✅ |

### Empty state
| Element | Destination / Outcome | Status |
|---|---|---|
| "Post a Moment" CTA | Opens camera / moment composer | ✅ |

---

## Tab 5 — Profile (`app/(tabs)/profile.tsx`)

### Header actions
| Element | Destination / Outcome | Status |
|---|---|---|
| Settings gear | `router.push("/settings")` | ✅ |
| Share profile | `handleShareProfile()` — `Share.share(...)` | ✅ |
| Edit photo (avatar tap) | `updateProfilePhoto()` — opens image picker | ✅ |
| Mini avatar edit button | `updateProfilePhoto()` | ✅ |

### Completion card
| Element | Destination / Outcome | Status |
|---|---|---|
| "Add photo" CTA | `updateProfilePhoto()` | ✅ |
| "View Full Profile" | `router.push("/user/[userId]", { userId })` | ✅ |

### Stats row
| Element | Destination / Outcome | Status |
|---|---|---|
| Profile Views | `router.push("/profile-views")` (premium gate) | ✅ |
| Likes | `router.push("/likes-you")` | ✅ |

### Referral row
| Element | Destination / Outcome | Status |
|---|---|---|
| "Invite Friends" | `router.push("/referral")` | ✅ |

### Settings CTA (bottom)
| Element | Destination / Outcome | Status |
|---|---|---|
| Settings button | `router.push("/settings")` | ✅ |

---

## Nested Screens

### `/settings`
| Element | Destination / Outcome | Status |
|---|---|---|
| Discovery Filters | `router.push("/settings/discovery-filters")` (or sheet) | ✅ |
| Blocked Users | `router.push("/blocked-users")` | ✅ |
| Privacy Policy | In-app browser / `Linking.openURL` | ✅ |
| Terms of Service | In-app browser / `Linking.openURL` | ✅ |
| Delete Account / Export | Wired to API | ✅ |
| Back (←) | `router.back()` | ✅ |

### `/premium`
| Element | Destination / Outcome | Status |
|---|---|---|
| Subscribe CTA | Stripe payment sheet | ✅ |
| Close / Back | `router.back()` | ✅ |

### `/likes-you`
| Element | Destination / Outcome | Status |
|---|---|---|
| Like card (premium visible) | `openProfile(userId, "likes", {...})` | ✅ |
| Like card (free blur) | `router.push("/premium")` | ✅ |
| Back (←) | `router.back()` | ✅ |
| Empty state | "Start swiping" copy | ✅ |

### `/profile-views`
| Element | Destination / Outcome | Status |
|---|---|---|
| Visitor avatar | `openProfile(userId, "profile-views", {...})` | ✅ |
| Back (←) | `router.back()` | ✅ |
| Empty state | "Your profile views appear here" copy | ✅ |

### `/referral`
| Element | Destination / Outcome | Status |
|---|---|---|
| Copy link | Clipboard | ✅ |
| Share | `Share.share(...)` | ✅ |
| Back (←) | `router.back()` | ✅ |

### `/blocked-users`
| Element | Destination / Outcome | Status |
|---|---|---|
| Unblock | API call to unblock | ✅ |
| Back (←) | `router.back()` | ✅ |

### `/chat/dating/[id]` and `/chat/[matchId]`
| Element | Destination / Outcome | Status |
|---|---|---|
| Send message | Posts message to API | ✅ |
| Avatar / name tap | `openProfile(peerId, "chat", {...})` | ✅ |
| Back (←) | `router.back()` | ✅ |

### `/chat/ai-bot`
| Element | Destination / Outcome | Status |
|---|---|---|
| Send message | `POST /api/ai-chat` or `/api/ai-chat/stream` | ✅ |
| Navigation chip (`[GO:...]`) | `router.push(route)` | ✅ |
| Paywall banner (after msg 5) | `router.push("/premium")` | ✅ |
| Back (←) | `router.back()` | ✅ |

### `/user/[userId]`
| Element | Destination / Outcome | Status |
|---|---|---|
| Like / Pass / Connect | Action API calls | ✅ |
| Message | `openChat(chatId)` | ✅ |
| Report | Opens report sheet | ✅ |
| Back (←) | `router.back()` | ✅ |

### Communities hub (`app/(tabs)/communities.tsx`)
| Element | Destination / Outcome | Status |
|---|---|---|
| Community card | `openCommunity(slug)` → `/communities/[id]` | ✅ |
| Join / Joined toggle | `handleJoin` — optimistic join/leave, synced to hub | ✅ |
| Joined chip | `openCommunity(slug)` | ✅ |
| Create community card / CTA | `openCreateCommunity()` → `/communities/create` | ✅ |
| Search clear (×) | `setSearchQuery("")` | ✅ |

### `/communities/[id]` (community feed)
| Element | Destination / Outcome | Status |
|---|---|---|
| Back (←) | `router.back()` | ✅ |
| Join/leave (header) | Toggle, synced to hub | ✅ |
| Hot / New / Top tabs | Sort switch | ✅ |
| Post card | `/communities/thread/[postId]` (`pathname` + `params`) | ✅ |
| Author avatar / name | ProfilePeekSheet → View Profile \| Shoot Your Shot | ✅ |
| Like (♥) | Optimistic like/unlike + haptics | ✅ |
| Reply (💬) | Opens thread / compose | ✅ |
| Share | `Share.share(post content + @handle)` — **wired 2026-07-01** (was dead) | ✅ |
| FAB compose | Create-post modal | ✅ |
| Compose: Cancel / Post | Close modal / `handlePost` (disabled while empty or submitting) | ✅ |

### `/communities/create`
| Element | Destination / Outcome | Status |
|---|---|---|
| Back (←) | `router.back()` | ✅ |
| Category select | Sets category | ✅ |
| Create CTA | `handleCreate` → new community → feed | ✅ |

### `/communities/thread/[postId]`
| Element | Destination / Outcome | Status |
|---|---|---|
| Back (←) | `router.back()` | ✅ |
| Like (♥) on OP / replies | Optimistic like + haptics | ✅ |
| Reply count | Display only (`View`, not a button) | ✅ |
| Share | `Share.share(post content + @handle)` — **wired 2026-07-01** (was dead) | ✅ |
| Reply input send (➤) | `handleSubmitReply` (disabled while empty or submitting) | ✅ |

---

## Push Notifications → In-App Routes

| Notification type | Data shape | Routes to |
|---|---|---|
| message, friend_accept, plan_invite, plan_join, double_date_match | `{ chatId }` or `{ matchId }` | `openChat(chatId)` |
| Legacy URL-based | `{ url: "/chat/<id>" }` | `openChat(decoded id)` |
| Anti-ghost nudge | `{ route: "/chat/dating/<id>" }` | `router.push("/chat/dating/[id]", { id })` |
| Daily spark | `{ route: "/(tabs)/index" \| "/(tabs)/matches" }` | `router.push(route)` |

---

## Auth / Onboarding Guard (`app/index.tsx`)

| State | Route |
|---|---|
| `isSignedIn = false` | `/(auth)/welcome` |
| `isSignedIn = true`, `onboardingComplete !== true` | `/onboarding` |
| `isSignedIn = true`, `onboardingComplete === true` | `/(tabs)` |
| `e2eSmokeEnabled = true` (env flag) | `/(tabs)` (bypasses auth) |

---

## Audit Summary

### 2026-06 session
- **Total tappable elements audited:** ~95
- **Dead buttons found and fixed:** 3 (Echo, handleLike, accept navigate)

### 2026-07-01 session
- **Dead buttons found and fixed:** 2 — share buttons in `/communities/[id]` and `/communities/thread/[postId]` (no `onPress`; now `Share.share`)
- **Double celebration fixed:** accepting a Shot fired both the provider-level `DatingMatchModal` and the screen-level `MatchMomentOverlay`; the context no longer opens its modal for shot accepts (matches.tsx owns the moment)
- **Route-string convention fix:** Moments "Requests" button used `"/(tabs)/matches?segment=moments"`; now `{ pathname, params }` per `docs/architecture/ROUTING.md`
- **Route resolution sweep:** every `router.push` / `pathname:` target across `app/`, `components/`, `contexts/` resolves to a real screen file — 0 broken routes
- **`audit:taps`:** PASSES clean. Script rewritten with brace-aware JSX tag parsing (a `>` inside `onPress={() => …}` or a ternary no longer truncates the tag → no more false positives). Safe to gate CI.
- **Dead buttons remaining:** 0
- **Missing back navigation:** 0
- **Known intentional placeholder:** Moments "Echo" button → "coming soon" alert (planned feature, visible feedback)

### Standing debt (blocks regression safety)
- 59 failing mobile tests, 2 failing API tests, 2 failing Functions tests (pre-existing baseline). Until green, Jest cannot guard tap/routing regressions — fix on a `*/baseline-quality-gates` branch, then add `audit:taps` to the CI unit job.
