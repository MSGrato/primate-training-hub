

# Switch Agent Train AI Model to Gemini

## Change

Update the `callAI` function in `supabase/functions/report-chat/index.ts` to use Google Gemini instead of OpenAI GPT-5.

**Line 46** — change:
```
model: "openai/gpt-5"
```
to:
```
model: "google/gemini-3-flash-preview"
```

This is a single-line change. The Lovable AI Gateway handles both models with the same API format, so no other code changes are needed.

## Technical Details

- **File**: `supabase/functions/report-chat/index.ts`, line 46
- **Old model**: `openai/gpt-5`
- **New model**: `google/gemini-3-flash-preview` (Google's latest fast model with strong reasoning and tool-calling support)
- The edge function will be redeployed automatically after the change

