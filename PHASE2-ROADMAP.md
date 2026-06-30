# Phase 2 Roadmap - Post-MVP Enhancements

This document outlines potential improvements for the prompt enhancement system after the MVP is validated.

## Validation Checklist (Before Phase 2)

- [ ] MVP tested in real VS Code environment
- [ ] No crashes or major bugs found
- [ ] False positive rate acceptable (< 10% on casual chat)
- [ ] Copy-paste workflow works smoothly
- [ ] Performance is acceptable (no lag on typing)
- [ ] User feedback collected
- [ ] Core detection logic proven effective

## Phase 2 Priorities

### Priority 1: Enhanced Detection & Analysis

#### 1.1 Auto-Detect Use Case

**Goal:** Analyze prompt to guess use case (coding vs writing vs research)

**Implementation:**

- Add `detectUseCase()` function to promptIntegration.ts
- Check for language/framework keywords (react, python, etc.)
- Check for writing indicators (tone, audience, style)
- Check for research keywords (sources, evidence, citations)
- Update popup to pass detected use case to analyzer

**Files to modify:**

- `lib/promptIntegration.ts` - add detectUseCase()
- `extension/extension.ts` - pass useCase to analysis

**Testing:**

```typescript
const coding = detectUseCase('create a React component');
const writing = detectUseCase('write a professional email');
const research = detectUseCase('compare these two approaches');
```

**Estimated effort:** 2-3 hours

#### 1.2 Show Analysis Details

**Goal:** Display analysis breakdown in popup (not just improved text)

**Implementation:**

- Create `AnalysisPopup` React component
- Tab 1: "Improved" (current view)
- Tab 2: "Analysis" showing:
  - Overall score
  - Category scores (clarity, context, goal, etc.)
  - Issues identified
  - Strengths found
- Show confidence breakdown by signal

**Files to modify:**

- `extension/extension.ts` - webview HTML/CSS/JS
- New component (optional): `components/AnalysisView.tsx`

**Estimated effort:** 4-5 hours

### Priority 2: UI Polish

#### 2.1 Better Visual Feedback

**Goal:** Improve popup appearance and user experience

**Enhancements:**

- Add confidence indicator (progress bar)
- Color-code by quality level (weak/decent/strong/excellent)
- Smooth animations for panel open/close
- Keyboard shortcuts (Cmd+C = copy, Esc = close)
- Show improvement metrics (word count reduction, clarity gain)

**Files to modify:**

- `extension/extension.ts` - update webview HTML/CSS

**Estimated effort:** 2-3 hours

#### 2.2 Light/Dark Theme Support

**Goal:** Better theme integration for light and dark modes

**Enhancements:**

- Test in VS Code light, dark, and high contrast themes
- Adjust colors for better contrast in each theme
- Use VS Code color variables more completely

**Files to modify:**

- `extension/extension.ts` - CSS variables section

**Estimated effort:** 1-2 hours

#### 2.3 Status Bar Integration

**Goal:** Better indicator of when popup is available

**Enhancements:**

- Show confidence score in status bar (instead of message)
- Update in real-time as user types
- Click status bar to open popup directly

**Files to modify:**

- `extension/extension.ts` - add status bar item

**Estimated effort:** 2-3 hours

### Priority 3: Performance Optimization

#### 3.1 Analysis Caching

**Goal:** Avoid re-analyzing same text multiple times

**Implementation:**

- Add simple in-memory cache of (text hash → analysis)
- Clear cache periodically (5 min)
- Optional: Save to file for session persistence

**Files to add:**

- `lib/analysisCache.ts` - cache management

**Estimated effort:** 2 hours

#### 3.2 Lazy Loading

**Goal:** Don't load full analyzer until needed

**Implementation:**

- Detach analyzer module into separate chunk
- Load only on first popup open
- Show loading indicator while loading

**Files to modify:**

- `extension/extension.ts` - dynamic import

**Estimated effort:** 1-2 hours

#### 3.3 Incremental Analysis

**Goal:** Show partial results while full analysis completes

**Implementation:**

- Show just improved prompt immediately
- Load analysis details in background
- Update popup when analysis completes

**Files to modify:**

- `lib/promptIntegration.ts` - progressive analysis
- `extension/extension.ts` - handle updates

**Estimated effort:** 3-4 hours

### Priority 4: Feature Expansion

#### 4.1 Multi-Language Support

**Goal:** Support Portuguese, Spanish, French, etc.

**Implementation:**

- Already available in analyzer (Portuguese in place)
- Add language detection to extension
- Pass language to analyzer

**Files to modify:**

- `extension/extension.ts` - detect OS language
- `lib/promptIntegration.ts` - pass language parameter

**Estimated effort:** 2 hours

#### 4.2 Prompt Templates

**Goal:** Suggest templates based on use case

**Implementation:**

- Extract templates from `lib/templates.ts`
- Show relevant templates in popup
- One-click apply template

**Files to modify:**

- `extension/extension.ts` - add template UI
- `lib/promptIntegration.ts` - template lookup

**Estimated effort:** 3-4 hours

#### 4.3 History & Favorites

**Goal:** Track previous prompts and allow favoriting

**Implementation:**

- Store to VS Code globalState (built-in storage)
- Show history in side panel
- Favorite commonly-used prompts
- Quick-apply from history

**Files to add:**

- `lib/promptHistory.ts` - history management
- `extension/historyPanel.ts` - side panel UI

**Estimated effort:** 4-5 hours

### Priority 5: Quality Improvements

#### 5.1 Better Rewrite Quality

**Goal:** Improve the suggestions the analyzer generates

**Implementation:**

- Review current rewriter output
- Identify weak areas
- Adjust prompt templates in analyzer
- Add more sophisticated rule engine

**Files to modify:**

- `lib/promptRewriter.ts` - enhance logic
- `lib/promptEnhancer.ts` - quality rules

**Estimated effort:** 5+ hours (exploratory)

#### 5.2 Custom Rules Engine

**Goal:** Allow users to define their own improvement rules

**Implementation:**

- YAML/JSON config for custom rules
- Load from workspace settings
- Compose multiple rule sets

**Files to add:**

- `lib/customRules.ts` - rule parser/executor
- VS Code settings schema

**Estimated effort:** 6+ hours

#### 5.3 Feedback Loop

**Goal:** Track what users accept/reject to improve detection

**Implementation:**

- Anonymous opt-in feedback
- Track which improvements users copy vs ignore
- Use to tune thresholds and weights

**Files to add:**

- `lib/feedbackAnalytics.ts`
- `extension/analytics.ts`

**Estimated effort:** 4-6 hours

### Priority 6: Distribution & Marketing

#### 6.1 Publish to VS Code Marketplace

**Goal:** Make extension available to general public

**Prerequisites:**

- Create Microsoft account
- Complete extension metadata
- Create icon & screenshots
- Write marketplace description

**Steps:**

1. Generate icon (512x512 PNG)
2. Create 1-2 animated GIFs showing usage
3. Polish README for marketplace
4. Run `npm run package`
5. Publish with `npm run publish`

**Estimated effort:** 2-3 hours

#### 6.2 Create Demo Video

**Goal:** Show MVP in action

**Content:**

- Open VS Code Chat
- Type a prompt
- Show popup with improvement
- Copy and use in chat
- Show 2-3 examples

**Estimated effort:** 1 hour production + 1 hour editing

#### 6.3 Documentation Website

**Goal:** Host docs outside of GitHub

**Options:**

- Use GitHub Pages
- Use Docs.rs style site
- Create simple landing page

**Content:**

- Feature overview
- Installation instructions
- Usage guide
- Configuration reference
- FAQ

**Estimated effort:** 3-4 hours

## Technical Debt to Address

1. **Type Safety**
   - Add strict null checks everywhere
   - Create discriminated unions for results
   - Add more specific types (not just string/number)

2. **Error Handling**
   - Add more specific error types
   - Better error messages for users
   - Logging for debugging

3. **Testing**
   - Add integration tests (extension.test.ts)
   - Add e2e tests with VS Code extension tester
   - Add performance benchmarks

4. **Code Organization**
   - Consider extracting webview generation to separate module
   - Separate concerns in extension.ts (could be 500+ lines)
   - Add constants file for magic numbers

## Estimated Timeline

**Quick wins (1-2 weeks):**

- Auto-detect use case
- Better visual feedback
- Keyboard shortcuts

**Medium features (2-4 weeks):**

- Analysis caching
- Template suggestions
- History & favorites

**Larger features (4+ weeks):**

- Custom rules engine
- Marketplace publication
- Demo video + landing page

## Success Metrics for Phase 2

1. **Usage**
   - # of extension installs
   - Daily active users
   - # of prompts analyzed per day

2. **Quality**
   - Crash rate < 0.1%
   - False positive rate < 5%
   - Improvement acceptance rate > 50%

3. **Performance**
   - Detection latency < 50ms
   - Popup load time < 200ms
   - No noticeable UI lag

4. **User Satisfaction**
   - Rating > 4.5/5 stars
   - Positive reviews mention specific features
   - Low complaint rate on detection accuracy

## Dependencies to Monitor

- VS Code API (monitor for breaking changes)
- TypeScript (stay current with latest)
- Test framework (vitest - watch for updates)
- Node.js (maintain 16+ support)

## Questions for Users/Team

1. What's the top missing feature?
2. How often do users want to enhance prompts?
3. Would they prefer enhancement during typing or after?
4. Is multi-language important?
5. Would custom rules add value?

## Next Review Date

- **MVP Review:** 1-2 weeks after release
- **Phase 2 Planning:** After MVP validation
- **Phase 2 Start:** When roadmap is approved
