# ConnectSphere Launch Tap Matrix

Use this before every preview or production submission. Every visible control must either complete a real action, navigate to a real route, open a real sheet, or be disabled with clear copy.

## Mobile

| Surface | Control | Expected result |
| --- | --- | --- |
| Discovery | Intent tabs | Switches deck, resets subtab and card position |
| Discovery | Subtabs | Filters deck and resets card position |
| Discovery | Profile card | Opens profile preview |
| Discovery | Like/Spark/Shot/Pass | Calls dating action, plays motion, persists interaction or shows recoverable error |
| Discovery | Friend Like/Plan/Besties/Pass | Calls friend action, opens plan sheet or premium gate when required |
| Discovery empty state | Refresh Feed | Clears session passes and refetches backend feed |
| Discovery exhausted state | Start Over | Clears passed profiles and restarts local deck |
| Profile | Add more photos | Opens photo picker and updates profile completion |
| Profile | Preview profile | Opens the public profile route for the signed-in user |
| Settings | Save profile fields | Persists to backend and shows success/error |
| Settings | Export data | Creates backend data export request |
| Settings | Delete account | Requires confirmation and queues deletion |
| Premium | Select package | Updates selected RevenueCat package |
| Premium | Unlock | Starts RevenueCat purchase or fails closed if not configured |
| Premium | Restore | Restores RevenueCat purchases and syncs backend entitlement |
| Matches | Incoming free card | Opens sender/profile or chat if unlocked |
| Matches | Locked card | Plays denial motion and opens full Plus sheet |
| Matches | Invite | Opens invite sheet, share/copy actions work |
| Chat | Send message | Persists message, updates receipts/read state |
| Chat | More menu | Opens chat controls sheet |
| Chat | Mute/archive/clear/unmatch | Confirms where destructive, calls API, rolls back on failure |
| Chat | Long-press message | Opens report-message flow and persists report |

## Web Admin

| Surface | Control | Expected result |
| --- | --- | --- |
| Matches web | Match row | Opens real message route |
| Matches web | Discover CTA | Opens discover route |
| Moderation | Load token | Loads report queue with admin token |
| Moderation | Status buttons | Updates report status and audit log |
| Moderation | Suspend/ban | Calls admin moderation endpoint and records reason/request |

## Production Guardrails

| Check | Expected result |
| --- | --- |
| Missing RevenueCat public keys | `pnpm --filter @workspace/connectsphere-mobile run pre-submit` fails |
| Demo seeds enabled | Pre-submit fails |
| Local DB fallback enabled | Pre-submit fails |
| Missing Sentry/push/API/Clerk keys | Pre-submit fails |
| Tap audit | `pnpm --filter @workspace/connectsphere-mobile run audit:taps` passes |
