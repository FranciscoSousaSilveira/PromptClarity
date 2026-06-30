# Release process

1. Update the root version in `package.json`.
2. Run `npm run release:sync`.
3. Run lint, coverage, builds, E2E, and audits.
4. Run `npm run package:all` on Windows.
5. Test the Chrome ZIP, VSIX, and Windows installer on a clean profile.
6. Create a signed GitHub release. Desktop update checks use that release feed when the repository metadata is configured.
