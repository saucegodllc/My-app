# Opportunities Open Doors Design

## Goal

Revamp the Opportunities tab inside Discover into a complete, useful, safe, and fun open-doors product for users ages 18-50. The tab should help people find practical chances to move forward: career opportunities, side hustles, live pop-ups, events, useful people, professional connections, groups, and local openings.

The tab should not feel like a plain job board. It should feel like:

- Here are doors that are open right now.
- Here is why each door might matter to you.
- Here is the next action to take.
- Here are the people, groups, and moments around that opportunity.
- Here is a safe way to explore without pressure.

## Product Direction

Use an Open Doors Feed as the primary structure. The experience should combine actionable listings and human connection in one smart feed. Opportunities, people, groups, and events should appear as different door types instead of separate disconnected sections.

The main action model is:

- Primary: claim the door through `Apply`, `RSVP`, `Claim`, `Connect`, or `Join`.
- Secondary: save, share, message, or view details.
- Social layer: show who is connected to the door, why the user might want to meet them, and where a group or chat can continue.

This keeps the tab immediate and useful while preserving the ConnectSphere advantage: people and real-world openings are connected.

## Audience Fit For Ages 18-50

The tab must work for a wide age range without feeling childish or corporate.

For younger users, it should surface:

- Internships.
- First jobs.
- Side hustles.
- Creator collaborations.
- Campus or local groups.
- Pop-ups and events where they can meet people.

For mid-career users, it should surface:

- Hiring leads.
- Consulting or contract work.
- Mentorship.
- Professional groups.
- Business development leads.
- Local events and high-intent people.

For users seeking day-to-day openings, it should surface:

- Weekend gigs.
- Vendor calls.
- Local pop-ups.
- Workshops.
- Useful people nearby.
- Groups with momentum.

The interface should avoid assuming every user is a student, founder, or job seeker. It should let each person choose the kind of door they want today.

## Design Pillars

### Useful

Every card should answer three questions quickly:

- What is this?
- Why is it relevant?
- What can I do next?

The tab should never rely on vague hype such as `network more` or `grow your circle`. Each item needs a concrete action, context, and benefit.

### Friendly

Copy should be plain and encouraging. Use language like `Open door`, `Good fit`, `People to know`, and `Worth a look`. Avoid cold recruiter language and avoid making users feel behind.

The screen should feel organized even when the feed is broad. Filters, search, detail sheets, and saved states should make the experience easy to control.

### Safe

Safety must be visible and functional:

- Each person profile includes verification or trust cues where available.
- Person detail sheets include report and block actions.
- Event and pop-up details include public-location and source cues.
- External links are validated before opening.
- Suspicious or placeholder apply links are blocked.
- Group chats should make it clear whether the group is public, event-based, or opportunity-based.
- Users should be able to save or share without committing.

For mock data, avoid unrealistic promises, guaranteed income, predatory language, or opportunities that imply unsafe private meetups.

### Fun

The tab should feel alive, not bureaucratic. Use lightweight momentum:

- `Hot nearby`, `New today`, `People going`, `Fast reply`, and `Open this week` badges.
- A daily `Door of the Day`.
- Friendly microcopy in empty states.
- Small success feedback when saving, connecting, joining, or claiming.
- Human profile cards that feel like real people with needs, skills, and openings.

Fun should support usefulness. It should not add noisy animations or unclear mechanics.

## Final Screen Structure

### 1. Header And Actions

The top section should clearly name the purpose:

- Title: `Opportunities`
- Subtitle: `Find people, places, work, and moments that can open a door.`

Header actions:

- Search.
- Saved.
- Post.

The current `128 active now` idea can remain, but it should be reframed as open-door momentum, such as `128 doors active` or `Live in Miami`.

### 2. Door Filters

Use these first-class filters:

- `For You`
- `Hiring`
- `Side Hustles`
- `Pop-Ups`
- `Events`
- `People`
- `Groups`

Filters should narrow the unified feed. They should not navigate to completely separate screens.

`For You` should blend high-value doors across all categories. It should prioritize freshness, local relevance, actionable links, saved interests, and people with clear connect reasons.

### 3. Door Of The Day

The first content card should be a featured recommendation. It can be derived from mock feed data in the first implementation pass.

Priority order:

1. A live pop-up or event happening soon.
2. A hiring or side-hustle item with a valid action URL.
3. A person who is open to connect and has a clear need.
4. A group with active members and a strong theme.

The card should include:

- Door type.
- Headline.
- One-line why.
- Primary action.
- Secondary save/share action.
- Safety/source cue.

### 4. Unified Open Doors Feed

The main feed should render card types from one data model:

- `Hiring Door`: jobs, internships, contracts, apprenticeships.
- `Side Hustle Door`: paid gigs, creator work, vendor calls, local services, weekend income.
- `Pop-Up Door`: brand activations, temporary openings, markets, launch events.
- `Event Door`: networking events, workshops, career fairs, mixers, panels.
- `Person Door`: people looking to connect, people needing help, mentors, recruiters, founders, creators, operators, local professionals.
- `Group Door`: professional communities, local opportunity circles, career groups, founder groups, creator circles.

Each door card should include:

- Type badge.
- Title or person name.
- Source or role.
- Location or remote status.
- Timing or freshness.
- Three tags maximum.
- Relevance reason.
- Primary action.
- Save/share actions.
- Trust or safety cue.

### 5. Mock People Profiles

The first implementation pass should include realistic mock profiles so the tab feels human immediately.

Profile labels:

- `Looking to connect`
- `Needs help`
- `Hiring`
- `Mentor`
- `Collaborator`
- `Professional`
- `Local plug`

Each mock person should include:

- Name.
- Age when appropriate.
- Role or identity.
- Location.
- Profile image or initials fallback.
- Open-door label.
- What they are looking for.
- What they can offer.
- Tags or skills.
- Trust cue.
- Suggested opener.
- Primary action: `Connect`.
- Secondary actions: `Message`, `Save`, `View`.

Example profiles:

- A recruiter hiring for hospitality shifts.
- A creator looking for a weekend videographer.
- A mentor open to helping junior designers.
- A small business owner looking for vendor partners.
- A founder seeking a technical collaborator.
- A real estate professional open to warm introductions.
- A student looking for internship leads.
- A project manager open to coffee chats.

Mock profiles should feel broad across ages and careers. They should not all be startup or nightlife focused.

### 6. Search

Search should cover:

- Doors.
- People.
- Groups.
- Tags.
- Sources.
- Locations.

Search results should use the same door categories as the feed. Results should appear after the user starts typing, with filters still available.

Suggested search chips:

- `remote`
- `weekend`
- `internship`
- `mentor`
- `pop-up`
- `creator`
- `Miami`

### 7. Saved Doors

Saved should be visible from the header and supported on every card.

First implementation can persist saved state locally in component state. A later backend pass can persist saved doors per account.

Saved view should show:

- Saved opportunities.
- Saved people.
- Saved groups.
- Saved events.

If empty, show a friendly empty state and suggest saving doors to revisit later.

### 8. Post Door

The `Post` action should open a lightweight sheet or modal, even if the first implementation only creates a local mock item.

Fields:

- Door type: hiring, side hustle, pop-up, event, person, group.
- Title.
- Details.
- Location or remote.
- Tags.
- Action link or contact preference.
- Safety/source note.

The first pass can keep posts local to the session. The UI should still make the flow feel real and validate required fields.

### 9. Detail Sheet

Every card should open a detail sheet.

Detail sheet content:

- Full title/person name.
- Description.
- Why it might fit.
- Location/timing.
- Tags.
- Source/trust cue.
- People or groups connected to it when available.
- Primary action.
- Save/share.
- Report/block for person cards.

The detail sheet should make external navigation deliberate. For apply, RSVP, or claim links, show enough context before opening the link.

### 10. Groups

Group doors should help users find ongoing momentum.

Group card content:

- Group name.
- Member count.
- Active now count.
- Theme.
- Example doors inside the group.
- Primary action: `Join`.

Groups can be mock data in the first pass, but joining should change local state and give feedback.

## Actions And State Changes

Primary actions by type:

- Hiring: `Apply`
- Side hustle: `Claim`
- Pop-up: `RSVP` or `Claim`
- Event: `RSVP`
- Person: `Connect`
- Group: `Join`

Secondary actions:

- `Save`
- `Share`
- `Message`
- `View Details`

State changes:

- Saving toggles visual saved state.
- Joining a group changes `Join` to `Joined`.
- Connecting changes `Connect` to `Requested` or `Connected`, depending on available local model.
- Posting a door inserts the new item near the top of the feed.
- RSVP/claim/apply opens a valid external link or shows a safe unavailable state.
- Sharing uses the native share sheet when available.

## Safety And Trust Requirements

Safety should be integrated without making the tab feel scary.

Requirements:

- Keep existing apply URL validation and extend it to all external actions.
- Reject empty, placeholder, non-HTTPS, and known parked-domain URLs.
- Show source labels on external listings.
- Show `Public event`, `Verified source`, `ConnectSphere post`, or similar trust cues.
- Person detail sheets include `Report` and `Block`.
- Person cards avoid private-meetup pressure.
- Event and pop-up cards should indicate public place or verified source when possible.
- Empty and error states should not push users into unsafe off-app contact.

## Error Handling And Empty States

Every feed state should be useful:

- Loading: show skeleton or compact loading state.
- API error with cached items: keep the last good feed visible and show a small retry notice.
- API error with no items: show retry and mock fallback if available.
- Empty filter: suggest another filter or search.
- Empty saved: explain that saved doors will appear here.
- Invalid external link: show `This link is not ready yet. Save it or check back later.`
- Post validation: show clear field-level feedback.

The tab should always feel operational, even when live sources fail.

## Data Model

Introduce a UI-level `DoorItem` model inside the Opportunities component layer.

Suggested fields:

- `id`
- `kind`: hiring, sideHustle, popup, event, person, group
- `title`
- `subtitle`
- `description`
- `location`
- `timing`
- `source`
- `trustCue`
- `tags`
- `primaryAction`
- `actionUrl`
- `image`
- `profile`
- `group`
- `relevanceReason`
- `isRemote`
- `isSaved`
- `isJoined`
- `isConnected`

Existing `/api/opportunities` items should map into `DoorItem` with kind `hiring`, `sideHustle`, or `event` depending on `type` and tags.

Mock people, groups, pop-ups, and side hustles should also map into `DoorItem` so filtering, search, save, share, and detail sheets can work consistently.

## Existing Foundation

The current mobile app already provides:

- Discover intent switching in `artifacts/connectsphere-mobile/app/(tabs)/index.tsx`.
- Opportunities rendering through `artifacts/connectsphere-mobile/components/NetworkingTab.tsx`.
- Live opportunities from `GET /api/opportunities`.
- Apply URL validation and native/web external link handling.
- Search overlay for opportunities, people, and groups.
- Save/share/join group actions in the current opportunities section.
- Mock people and groups in the networking tab.

The revamp should focus on restructuring `NetworkingTab.tsx` around the Open Doors Feed instead of adding a separate page.

## Implementation Boundaries

The current `NetworkingTab.tsx` should be split into focused pieces during implementation:

- `NetworkingTab` as orchestrator.
- `OpportunityHeader`.
- `DoorFilterBar`.
- `DoorOfTheDay`.
- `OpenDoorsFeed`.
- `DoorCard`.
- `PersonDoorCard`.
- `GroupDoorCard`.
- `DoorDetailSheet`.
- `SavedDoorsSheet`.
- `PostDoorSheet`.
- `OpportunitySearchOverlay`.
- `doorData.ts` for mock people, groups, pop-ups, side hustles, and mapping helpers.
- `doorActions.ts` for URL validation, action labels, filtering, and search matching.

This keeps the feature easier to test and prevents the tab from becoming one oversized file.

## Testing And Verification

The implementation plan should include:

- Typecheck for the mobile app.
- Verification that each filter returns expected card types.
- Verification that saved, joined, connected, and posted local states update.
- Verification that invalid external URLs do not open.
- Verification that search covers all card types.
- Manual review in Expo or web preview for small and large screens.
- Safety review of mock copy for unrealistic income claims, private-meetup pressure, or unsafe calls to action.

## Launch Readiness Checklist

The Opportunities tab is launch-ready when:

- A user understands the open-doors purpose within five seconds.
- Filters include `For You`, `Hiring`, `Side Hustles`, `Pop-Ups`, `Events`, `People`, and `Groups`.
- The feed includes live opportunities plus mock people, groups, side hustles, pop-ups, and events.
- Every card has a primary action and at least one useful secondary action.
- People cards include realistic mock profiles with clear needs, offers, and safe connect actions.
- Search works across doors, people, groups, tags, and locations.
- Saved doors are accessible from the header.
- Posting a local door works for the session.
- Detail sheets work for every card type.
- Invalid links are blocked with clear feedback.
- Report/block are available for person profiles.
- Empty, loading, and error states are friendly and useful.
- The experience feels useful, friendly, safe, and fun without becoming noisy.

## Recommended Scope For First Implementation Pass

Build the launch-ready revamp in this order:

1. Create the `DoorItem` model and mock door data.
2. Map live `/api/opportunities` data into door items.
3. Replace the current section-heavy tab with the Open Doors Feed structure.
4. Add the filter bar and feed filtering.
5. Add Door of the Day.
6. Add full card actions: save, share, join, connect, apply/claim/RSVP.
7. Add detail sheet for all card types.
8. Add saved doors sheet.
9. Add post door sheet with local session insertion.
10. Update search to use the unified door model.
11. Add friendly, safe empty/error states.
12. Run typecheck and manual visual verification.

The first pass should prioritize a complete, believable product loop over extra animation or visual effects.
