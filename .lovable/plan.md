

## Rearrange Chat Layout: Input on Top, Results Hidden Until Needed

**Goal**: Keep the quick prompt buttons where they are. Move the text input and Ask button above the chat results window. Hide the results window until a question has been asked.

### Current Layout (top to bottom)
1. Quick prompt buttons
2. ScrollArea (chat/results) -- always visible
3. Text input + Ask button

### New Layout (top to bottom)
1. Quick prompt buttons
2. Text input + Ask button (moved up)
3. ScrollArea (chat/results) -- hidden until first interaction

### Changes

**File: `src/components/ReportChatAgent.tsx`**

1. Add a derived boolean: `const hasInteraction = messages.length > 0 || chatLoading;`
2. Move the `<form>` block (lines 325-338) to right after the quick prompt buttons (after line 260), before the ScrollArea.
3. Wrap the `<ScrollArea>` block (lines 262-322) in `{hasInteraction && ( ... )}` so it only appears once a question has been submitted or is loading.

No logic, data, or styling changes beyond this reorder and conditional render.

