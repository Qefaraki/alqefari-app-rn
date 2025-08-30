# PROJECT ROADMAP: Alqefari Family Tree Application

## Executive Summary

This roadmap documents the migration of the Alqefari Family Tree web prototype to a high-performance, truly native mobile application. Our mission is to create a digital home for the Alqefari family's legacy - a tool to strengthen the ties of kinship ("صلة الرحم") with a fluid, intuitive, premium user experience.

**Core Vision**: "A Google Map of Our Family" - seamless panning, zooming, and navigation at massive scale.

--Executive Summary


This roadmap documents the full lifecycle of the Alqafari Family Tree application, from its successful prototype migration to its future as a community hub. It reflects a critical strategic pivot to an "Admin-First" development model. Given the unreliability of automated data extraction, the fastest path to a complete and accurate tree is to build a highly efficient, in-app creation and editing toolkit for administrators before a public launch.

Core Vision: "A Google Map of Our Family" - a seamless, explorable archive, built and curated with powerful, intuitive tools, that stands as the definitive and most cherished digital record of the Alqafari lineage.

Key Strategic Change: We are de-prioritizing the public launch and focusing all immediate efforts on building a pragmatic, speed-optimized Admin Toolkit. The public will only get access once the tree is substantially complete, ensuring our first impression is one of quality and comprehensiveness.


---

1. Project Vision & Goals

1.1 Core Objectives

- Create a premium native mobile experience for exploring the Alqafari family tree.
- Support massive scale (5,000-10,000+ family members) without performance degradation.
- Provide an Arabic-first, RTL-native experience.
- [New Priority] Build a powerful, intuitive in-app administrative toolkit for creating, editing, and managing the family tree data with maximum speed and efficiency.
- Strengthen family connections through an accurate and beautifully presented digital archive.

1.2 Key Requirements

- Performance: Google Maps-level smoothness and responsiveness.
- Scale: Architecture ready for 10,000+ nodes.
- Language: Arabic-first with flawless RTL support.
- Backend: Designed for Supabase integration.
- Platform: Native mobile (iOS/Android via React Native).

---

2. Technology Stack (Finalized)

- Framework: React Native with Expo
- Graphics Engine: @shopify/react-native-skia
- Styling: NativeWind
- UI Components: shadcn-rn & @gorhom/bottom-sheet
- State Management: Zustand
- Layout Calculation: d3-hierarchy
- Animation: React Native Reanimated & Worklets

---

3. Completed Phases: The Frontend MVP (Phases 1-4)

- Phase 1: Environment Setup & Project Initialization ✅ (2025-08-27)
- Phase 2: Core Tree Experience Migration ✅ (2025-08-27)
- Phase 3: UI Components with iOS 26 Liquid Glass ✅ (2025-08-27)
- Phase 4: Performance & Rendering Engine Finalization ✅ (2025-08-27)
- Phase 5: High-Velocity Admin Toolkit & Backend Engine ✅ (2025-08-30)
Current Status: We have a high-performance frontend with a complete admin toolkit including bulk operations, real-time updates, and revert functionality. The application is now ready for high-velocity data entry by administrators.


---

4. The Path Forward: The Admin-First Roadmap


This revised roadmap prioritizes content creation and management tools.

📋 Phase 5: High-Velocity Admin Toolkit & Backend Engine ✅ (COMPLETED - 2025-08-30)


Goal: To build a functional, fast, and intuitive in-app toolkit for administrators to create and edit the family tree directly. "Perfect" is the enemy of "fast"—the UI for these tools should be clean and functional, not overly designed.
The 'Why': This is the fastest path to a complete dataset. By enabling the core team to build the tree in-app, we bypass the entire data-cleaning and CSV-management bottleneck.

Completed:
- ✅ Backend Infrastructure:
  - Created background_jobs table with real-time lifecycle tracking
  - Implemented admin_bulk_create_children RPC for atomic multi-child creation
  - Implemented admin_revert_action RPC with dry-run and audit trail
  - Updated Edge Function for background job integration
- ✅ Frontend Admin Toolkit:
  - AdminModeProvider context for role-based UI features
  - System Status Indicator with real-time job monitoring
  - Global FAB for quick access to admin actions
  - Multi-Add Children Modal with validation and bulk operations
  - Activity Screen with audit log display and revert functionality
- ✅ Real-time Integration:
  - Background jobs service for status updates
  - Profile updates service for instant tree refreshes
  - Audit log subscriptions for activity feed

Steps:

1. Backend Setup (The Foundation):
	- Implement the full, finalized Supabase schema (profiles, marriages).
	- Create a full suite of RPC functions for CRUD (Create, Read, Update, Delete) on profiles and marriages. These functions must be robust and handle data validation on the server-side to prevent errors (e.g., preventing orphan nodes, checking for required fields).
2. Frontend Integration:
	- Install and configure the supabase-js client.
	- Create a dedicated API service layer to handle all backend communication, including both read and write operations.
3. Implement "Admin Mode" Access:
	- Create a hidden trigger to enter Admin Mode (e.g., a five-tap gesture on a corner of the screen).
	- This trigger will prompt for a simple, hardcoded passcode stored as an environment variable. If correct, a global state (isAdmin: true) is set in Zustand. This is a pragmatic, temporary security measure.
4. Build the Contextual Admin UI:
	- When isAdmin is true, new UI elements will appear contextually, styled to be simple and clear:
		- On the Tree: A subtle "+" icon appears on parent nodes. Tapping it opens the "Add Child" form, pre-filled with the parent's ID.
		- On the Profile Sheet: A prominent "Edit" button appears in the header.
5. Develop Speed-Optimized Admin Forms:
	- The "Add/Edit Person" Form: This will be a single, reusable component presented as a full-screen modal for maximum focus.
		- It will contain clean input fields for the essential data: name, gender, dob (optional), profile_photo_url (optional).
		- It will include a simple but effective "Parent Selector" utility. This will be a search input that allows the admin to find and select a person's father by name, showing the full lineage of the selected parent for confirmation before saving.
	- The "Manage Marriages" Interface: Within the Edit form, a simple section to add a spouse (by searching for their profile) and enter the munasib.
6. Real-Time Updates:
	- After an admin creates, edits, or deletes a node, the application must intelligently invalidate its local cache, refetch the relevant branch data from Supabase, and re-render the tree to show the changes instantly. The feedback loop must be immediate and seamless.

---

📋 Phase 6: The Data Build-Out (Manual Curation)


Goal: For the core administrative team to use the new in-app tools to build out a significant portion of the Alqafari family tree.
The 'Why': This is the manual work phase, now empowered by the tools we just built. The goal is to reach a "critical mass" of data that makes the tree valuable enough for a public launch.

Steps:

1. The core team uses the app in Admin Mode to add family members, branch by branch, starting from the root.
2. During this phase, we will identify any friction points or bugs in the admin tools (e.g., "it takes too many taps to add a child") and perform rapid, weekly iterations to improve the creation workflow. This is an agile, feedback-driven process.

---

📋 Phase 7: The Public Viewer Launch


Goal: With a substantially complete and accurate tree, we now open the doors to the wider family.
The 'Why': We are now ready to compete. We are launching a product that is not only beautiful and performant but is also populated with rich, accurate data, giving us an immediate advantage over any generic, empty alternative.

Steps:

1. Disable Admin Access in the Public Build: The public version of the app will have the admin trigger code disabled via an environment variable.
2. Distribution: The app is compiled and distributed to the family via TestFlight (for iOS) and APK (for Android) for a controlled initial release.
3. Gather Feedback: Collect initial feedback from the family on the viewing experience and identify any major bugs or points of confusion.

---

📋 Phase 8 & 9: Public Contribution & The Digital Majlis


These phases remain the long-term vision, to be implemented after the successful public launch and based on family feedback.


- Phase 8: User Authentication & Contribution: Implement a formal Supabase OTP login for all users and introduce the "Suggest an Edit" feature, which will feed into an admin approval queue.
- Phase 9: Community & Communication: Build the News & Events module, photo galleries, and other community features to make the app a central hub for family life.

---

5. Pitfalls, Risks, and Mitigation Strategy


This revised strategy introduces different risks that we must actively manage.


- 
Pitfall 1: The Admin Tools are Clunky.


	- Risk: If the creation process is slow or buggy, the data build-out phase will stall, delaying the entire project.
	- Mitigation: We will prioritize the speed and reliability of the admin forms over their visual beauty. The workflow for adding a new person must be as few taps as possible. We will conduct weekly check-ins with the admin team during Phase 6 to gather feedback and deploy rapid improvements.
- 
Pitfall 2: The Rival Launches an "Empty" App First.


	- Risk: They might launch first, but their app will be a generic template with little to no actual family data.
	- Mitigation: We Win on Content and Quality. Our launch will be more impactful because it will be a complete, rich experience from day one. Our messaging will be: "The official, accurate, and complete Alqafari Family Tree." We are choosing to be "first to be right" rather than just "first to launch."
- 
Pitfall 3: Data Integrity Errors during Manual Entry.


	- Risk: Manual data entry can lead to mistakes (e.g., linking to the wrong parent, typos).
	- Mitigation: The admin tools must have simple but effective safeguards. The "Parent Selector" must show the full lineage of the selected parent for confirmation. The backend functions will perform validation to prevent catastrophic errors like circular dependencies. We will also build a simple "data validation" view in the admin toolkit that can flag potential issues like orphan nodes.
- 
Pitfall 4: Admin Burnout.


	- Risk: The manual data entry in Phase 6 is a significant undertaking for a small team.
	- Mitigation: We will keep the long-term goal of the AI Data Extraction Tool (from the previous roadmap) as a potential future feature to assist with this. If the manual process proves too slow, we can re-prioritize building this tool to accelerate the completion of the tree.