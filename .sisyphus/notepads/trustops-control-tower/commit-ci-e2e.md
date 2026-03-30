Added `tests/e2e/commit-ci.spec.ts` covering the full commit → CI → logs → metrics flow with Playwright route interception for `/api/git/commit`, `/api/jenkins/trigger`, `/api/jenkins/logs`, and `/api/metrics`.

Also adjusted the browser metrics display to fetch the mocked metrics route and normalize the API response into the app's internal `Metrics` shape so the success state renders reliably in E2E.

Verification: `cd trustOpsFront && npm run test:e2e tests/e2e/commit-ci.spec.ts` passed.
