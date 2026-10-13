# GeistDesk Security Specification

## Data Invariants
1. **Identity Integrity**: `ownerId` and `senderId` fields must strictly match the authenticated user's UID.
2. **Relational Sync**: Access to ticket messages is only granted if the user has access to the parent ticket.
3. **Role Enforcement**: Only users with the `agent` or `admin` role (verified via `/users`) can list all tickets. Customers can only list their own.
4. **PII Protection**: Customer profile data containing `email` must be restricted to the owner or admins.
5. **Terminal State**: Once a ticket status is `closed`, non-admin users cannot modify it.

## The Dirty Dozen (Vulnerability Test Payloads)

| Test ID | Method | Collection | Payload / Condition | Expected |
|---------|--------|------------|---------------------|----------|
| D-01 | create | /tickets | Setting `customerId` to someone else's UID | DENY |
| D-02 | list | /tickets | Customer trying to fetch all tickets without where(customerId) | DENY |
| D-03 | update | /tickets | Modifying `agentId` as a standard user | DENY |
| D-04 | create | /messages | Posting a message to a ticket the user doesn't own | DENY |
| D-05 | delete | /kb | Standard agent trying to delete a global KB article | DENY |
| D-06 | create | /users | User trying to register themselves as `admin` | DENY |
| D-07 | get | /tickets | Accessing a ticket ID that is a 1MB string (DDoS) | DENY |
| D-08 | update | /tickets | Changing the `subject` of a `closed` ticket | DENY |
| D-09 | create | /tickets | Missing `priority` field (Schema bypass) | DENY |
| D-10 | update | /users | User trying to change their own `email` field | DENY |
| D-11 | create | /messages | `senderType` set to `ai` by a client SDK | DENY |
| D-12 | list | /messages | Scraping messages across different ticket threads | DENY |
