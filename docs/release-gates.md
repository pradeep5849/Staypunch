# Release gates

All modules default to `coming_soon`. The module registry is not a substitute for server-side authorization.

A module can be marked `live` only after:
1. Authentication and tenant isolation are implemented and tested.
2. All module APIs enforce server-side permissions and release state.
3. Required integration credentials are configured outside source control.
4. Functional, security and regression tests pass in CI.
5. The release is reviewed and merged through a pull request.

No booking, payment or OTA operation exists in this initial dashboard preview.
