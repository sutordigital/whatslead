# WhatsLead deployment workflow

## Branches

- `main` = production release branch. SiteGround should deploy this branch only.
- `develop` = active development / staging branch. All routine coding work goes here first.

## Development flow

1. Make normal feature and bug-fix commits on `develop`.
2. Test the portal/API from the development or preview environment.
3. Batch related changes together until the feature is ready.
4. Open a pull request from `develop` to `main`.
5. Review the production checklist below.
6. Merge once. That merge is the deliberate production release.
7. SiteGround deploys the new `main` commit once.

## Production release checklist

- Backend builds successfully.
- Portal builds successfully.
- Database migrations are already applied and compatible.
- Required environment variables exist in production.
- `/health` returns OK after deployment.
- WhatsApp inbound message works.
- WhatsApp outbound AI reply works.
- Human CRM reply works.
- Booking flow still works.
- No debug secrets or temporary logging were committed.
- Note the release commit SHA.

## Important rule

Do not commit small development changes directly to `main`.

For substantial work, several commits on `develop` are expected. Production should receive one controlled merge after the work has been tested.

## SiteGround inode note

SiteGround stores Node.js deployment release directories under `public_html/.nodeapp/`. Reducing production deployments reduces the number of old release snapshots that accumulate. Old release directories should only be purged using SiteGround-supported cleanup or with SiteGround support confirming which releases are safe to remove.
