# Business Rules (do not break)

1. **Voting eligibility**: county + zip must match active `EligibilityRule` rows. Logic in `MemberService.calculateMemberType()`
2. **Auto-downgrade**: 2 consecutive missed **board elections** -> `VOTING` -> `GENERAL` (tracked by `consecutiveMissedVotes`). General meetings do NOT count toward downgrade.
3. **Reinstatement**: member requests, admin approves/denies via `ReinstatementRequest` table
4. **Profile edits**: phone/email update immediately; name/address changes require admin approval (`pendingChanges` JSON)
5. **PII encryption**: all personal data encrypted at application level. Never store raw PII
6. **No Microbilt**: identity verification is manual admin review only

## Timeline Constraints (critical)
7. **Temporal voting rule**: Members can ONLY vote in events that occur on or after their `membershipStartDate`. The `recordAttendance()` method enforces this.
8. **lastVotedAt integrity**: `lastVotedAt` must always be >= `membershipStartDate`. It should only be set from board elections the member actually attended after their membership started.
9. **Missed vote accountability**: `finalizeEvent()` only counts a member as having "missed" an event if their `membershipStartDate` is before the event date. New members are NOT penalized for events before they joined.
10. **membershipStartDate = approvedAt**: When a member is approved, `membershipStartDate` is set to the approval timestamp. These are always identical.

## Search & Performance
11. **Blind index for search**: Never decrypt all member rows for search. Use `searchIndex` column with HMAC tokens. Call `refreshSearchIndex()` after any PII field change.
12. **Admin-created members**: Auto-approved immediately (no PENDING state). Uses `register()` + `approveMember()` in sequence.

## Role Hierarchy
13. **EVENT_VOLUNTEER**: Temporary role scoped to one voting event. Auto-deactivated on event finalization. Can only access their assigned event and record attendance.
14. **Manager can manage Viewers**: MEMBERSHIP_MANAGER can create/delete VIEWER accounts but not other managers or super admins.
15. **Viewer is read-only**: Dashboard, Members (read), Voting Events (read), Reports only. No write access, no audit log, no rules, no user management.
