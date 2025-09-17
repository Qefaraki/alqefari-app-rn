# Marriage System Implementation Roadmap

This document outlines the necessary steps to complete the Marriage and Relationship Architecture (MARA). Use this as your primary to-do list and guide.

---

### 🔴 **High Priority: Complete Marriage Management System**

1.  **Redesign the `MarriageEditor` UI Component**
    - **Location**: `src/components/admin/MarriageEditor.js`
    - **Task**: The component currently uses `BlurView` and `GlassSurface`. Rebuild its UI to match the project's "neo-native" (no blur) design system. Use `CardSurface` and other native-style controls as seen in `NameEditor.js` and `DateEditor.js`.

2.  **Implement a Spouse Selector for Linking Existing Profiles**
    - **Location**: `src/components/admin/MarriageEditor.js`
    - **Task**: Add a feature that allows an admin to search for and select an existing profile from the database to link as a spouse. This is crucial for handling intra-family marriages.

3.  **Build Out the Admin Workflow in `ProfileSheet.js`**
    - **Location**: `src/components/ProfileSheet.js`
    - **Task**: Make the "الزوجات" (Wives) section (lines 1249-1279) in the admin edit view an interactive list. Clicking a marriage should allow an admin to update its details. The list must show all of a person's marriages (past and present).

4.  **Deploy the `admin_create_marriage` Backend Function**
    - **Location**: `supabase/migrations/021_marriage_admin_rpcs.sql`
    - **Task**: Ensure the SQL functions in this file are deployed to the Supabase instance so that the frontend has the necessary backend support.

---

### 🟡 **Medium Priority: UI Enhancements & Backend Cleanup**

1.  **Implement Marital Status Display on Public Profiles**
    - **Location**: `src/components/ProfileSheet.js`
    - **Task**: In the public view, add a "الحالة الاجتماعية" (Marital Status) field to the `DefinitionList` (lines 1308-1352). It should display "متزوج" (Married) if the person has an active marriage, without revealing any names.

2.  **Display Mother's Name on Children's Profiles**
    - **Location**: `src/components/ProfileSheet.js`
    - **Task**: In the children's list (both standard and `DraggableChildrenList`), display the mother's name (`child.mother.name`) next to each child. The data is already available in the `relationshipChildren` state.

3.  **Resolve the Missing `get_person_with_relations` Function**
    - **Location**: `src/services/profiles.js` (line 104)
    - **Task**: The code calls an RPC function `get_person_with_relations` that doesn't exist. Either implement this function in SQL for better performance or remove the call from the service layer and refactor any dependent code.

---

### 🔵 **Low Priority: Admin Toolkit & Technical Debt**

1.  **Build Advanced Admin Dashboard Features**
    - **Task**: Implement UI for batch operations and a viewer for the `audit_log` table to allow admins to track and revert changes.

2.  **Address Codebase Warnings and Deprecations**
    - **Task**: Systematically fix linting warnings and update deprecated function calls (e.g., from `react-native-reanimated`) throughout the project to improve code health.

---

---

# MARA System: Marriage and Relationship Architecture

This document provides a comprehensive analysis of the MARA system, which governs how marriages, spouses, and parent-child relationships are structured and managed within the Alqefari Family Tree application.

## 1. Core Architecture

The system's design is built on a clear separation of concerns between individuals (`profiles`) and their spousal relationships (`marriages`). This ensures a single source of truth and avoids data redundancy.

### Key Components:

- **`profiles` Table**: This is the central repository for **every individual**, whether they are a blood relative or someone who has married into the family.
  - `id`: A unique UUID for every person.
  - `hid` (Hierarchical ID): A dot-notation string (e.g., `1.2.4`) that defines a person's position within the family tree's bloodline.
  - `father_id` / `mother_id`: These fields link a person to their parents, establishing the core genealogical structure.

- **`marriages` Table**: This table exclusively defines the **relationships between spouses**.
  - It connects two profiles via `husband_id` and `wife_id`.
  - It stores metadata about the union, such as `status` ('married', 'divorced', 'widowed') and start/end dates.

### The "Munasib" Concept: The Key to Integration

The most critical innovation is the "Munasib" system, designed to handle individuals who marry into the family.

- **A Munasib is a spouse who is not a blood relative.**
- **Implementation**: A Munasib is represented as a standard entry in the `profiles` table, but with one key difference: their **`hid` column is `NULL`**.
- **Benefit**: This allows the system to store complete information about a spouse and link them as a parent to their children (`mother_id` or `father_id`) without incorrectly placing them in the visual family tree hierarchy. They exist within the database but not on the tree itself.

---

## 2. Handling Specific Scenarios

The architecture is designed to handle various complex relationship scenarios gracefully.

### Scenario 1: Intra-Family Marriage (e.g., Cousins)

- **How it Works**: This is handled seamlessly. Both individuals already exist in the `profiles` table and both have a valid, non-null `hid`. The `admin_create_marriage` function is called with their respective UUIDs, creating a new entry in the `marriages` table that links them.
- **System Impact**: No special logic is required. The system correctly links two existing blood relatives as spouses.

### Scenario 2: Divorces

- **How it Works**: The `marriages` table is designed for historical accuracy. A divorce is not a deletion but a status change.
  1.  The `status` field for the marriage record is updated from `'married'` to `'divorced'`.
  2.  The `end_date` field can be populated to record when the marriage officially ended.
- **System Impact**: The relationship record is preserved, allowing the application to display a person's full marital history. The `UNIQUE` constraint on the table only applies to _active_ marriages, so it does not prevent a person from remarrying.

### Scenario 3: Multiple Marriages & Remarriage

- **How it Works**: The system fully supports this. A single person's `id` can appear in the `marriages` table multiple times (either in `husband_id` or `wife_id` column).
- **Example**: If a man divorces and remarries, he will have two entries in the `marriages` table:
  1.  A record with his first wife, with `status` = `'divorced'`.
  2.  A new record with his second wife, with `status` = `'married'`.
- **System Impact**: This provides a complete and accurate timeline of a person's relationships.

---

## 3. Privacy and Display Logic (CRITICAL)

A core principle of the MARA system is to protect the privacy and honor of individuals, particularly concerning marital history. The public display of relationships is handled with the following rules:

- **Spouse Lists are Prohibited**: A person's profile page **must not** publicly display a list of their current or past spouses. This is to avoid potential social discomfort, especially in cases of divorce.
- **Parentage is Key**: Genealogical accuracy is maintained by displaying a child's parentage. A child's profile **will** show the names of their father and mother, linked from the `father_id` and `mother_id` fields. This is the _only_ approved way spousal information is revealed.
- **Simple Status Indicator**: A simple, non-specific status indicator (e.g., "متزوج" - Married) can be displayed on a profile. This confirms a person's current marital status without revealing the identity of their spouse.
- **Admin View**: Admins, through the admin toolkit, will have the ability to see a person's full marital history for data management purposes. This information is not for public consumption.

---

## 4. Implementation Status & Next Steps

While the backend architecture is robust and largely complete, several frontend and UI components are needed to fully realize its potential.

### ✅ **What is Complete (Backend)**

- **Database Schema**: The `profiles` and `marriages` tables are well-defined.
- **The Munasib System**: The core logic of using a `NULL hid` is fully implemented.
- **Admin Functions**: Secure RPC functions (`admin_create_marriage`, `admin_update_marriage`, `admin_delete_marriage`) are in place for managing marriage records safely.
- **Data Integrity**: The separation of parent-child links from spousal links is correctly enforced at the database level.

### 🚧 **What Needs to be Finished (Frontend/UI)**

1.  **MarriageEditor UI Component**: This is the highest priority. The current `MarriageEditor` uses a "glass/blur" aesthetic that violates the project's neo-native design principles.
    - **Action**: Redesign the component using `CardSurface` and other established UI elements.
    - **Action**: Ensure the form allows for creating a new Munasib profile or searching for an existing profile.

2.  **Spouse Selector UI**: To handle intra-family marriages, the UI needs a powerful and intuitive way for an admin to search for and select an existing person from the `profiles` table to link as a spouse.

3.  **Integrated Admin Workflow**: The admin panel (`ProfileSheet` or a dedicated section) needs a clear workflow for:
    - Adding a new marriage to a person.
    - Viewing a person's marriage history (current and past spouses).
    - Updating a marriage status (e.g., to 'divorced') and setting an end date.

4.  **Implement Privacy Logic**: The UI needs to be audited and updated to ensure it strictly adheres to the privacy rules. This means removing any code that displays a list of spouses on a public profile.
5.  **Display of Spouses**: The UI needs to be updated to visually represent a person's spouse(s) on their profile card or detail view, pulling data from the `marriages` table.
