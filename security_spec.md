# Security Specification — Vehicle Monitoring System (VMS) Manual

## 1. Data Invariants
1. **Identity Integrity**: Every `VehicleLog` document must set `createdBy == request.auth.uid` on creation, and `createdBy`, `createdByEmail`, `direction`, and `createdAt` are immutable after creation.
2. **Booth-Direction Coupling**: `direction == 'IN'` is strictly limited to Booth `5`–`10`; `direction == 'OUT'` is strictly limited to Booth `1`–`4`.
3. **Temporal Integrity**: `createdAt == request.time` on creation; `updatedAt == request.time` on both creation and update.
4. **Verified Auth & Admin Bootstrapping**: All reads and writes require a verified Google account (`request.auth.token.email_verified == true`). Access is restricted to the record creator (`createdBy == request.auth.uid`) or the verified system admin (`admin.apps.kastam@gmail.com`).
5. **Bounded Payloads**: `plateNo` (1–64 chars), `notes` (0–200 chars), `eventTimestamp` (10–40 chars), `logId` (`^[a-zA-Z0-9_\-]+$`, max 128 chars).

## 2. Adversarial Test Payloads ("Dirty Dozen")
1. **Unauthenticated read/write**: Request with `auth == null` -> `PERMISSION_DENIED`.
2. **Unverified email admin spoof**: `auth.token.email == 'admin.apps.kastam@gmail.com'`, `email_verified == false` -> `PERMISSION_DENIED`.
3. **Cross-user read**: Signed-in non-admin user attempts `get` on another user's `vehicleLogs/{id}` -> `PERMISSION_DENIED`.
4. **Blanket list without owner filter**: Non-admin executes `list` on `/vehicleLogs` without `where('createdBy', '==', uid)` -> `PERMISSION_DENIED`.
5. **Identity spoofing on create**: `incoming().createdBy != request.auth.uid` -> `PERMISSION_DENIED`.
6. **Shadow / ghost field injection**: Create or update payload includes `{ isApproved: true }` -> `PERMISSION_DENIED`.
7. **Invalid booth for direction**: `direction == 'IN'` with `boothNo == '2'` -> `PERMISSION_DENIED`.
8. **Oversized plateNo**: `plateNo` length 65+ chars -> `PERMISSION_DENIED`.
9. **Oversized notes**: `notes` length 201+ chars -> `PERMISSION_DENIED`.
10. **Immortal field mutation**: Update attempts to change `createdAt`, `createdBy`, or `direction` -> `PERMISSION_DENIED`.
11. **Forged server timestamp**: Create with client-chosen `createdAt != request.time` or update without `updatedAt == request.time` -> `PERMISSION_DENIED`.
12. **ID poisoning**: Document ID contains spaces, `$`, or length > 128 -> `PERMISSION_DENIED`.
