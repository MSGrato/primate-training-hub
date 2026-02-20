

## Simplify and Format Agent Train Responses

### Problem
Agent Train responses are cluttered with raw badge chips, dense tables, and verbose AI summaries that are hard to scan quickly.

### Changes

**1. Simplify AI System Prompt (`supabase/functions/report-chat/index.ts`)**
- Update the `generateAISummary` system prompt to produce shorter, scannable responses
- Instruct the AI to use short bullet points, bold key numbers, and skip unnecessary preamble
- Reduce max word count from 300 to 150
- Tell it to avoid repeating data that's already shown in the table below

**2. Clean Up Chat Message Rendering (`src/components/ReportChatAgent.tsx`)**
- Remove the badge chips row (Users, Assignments, Overdue, etc.) -- this data is redundant with the AI summary and the table
- Make the table collapsible using the existing Collapsible component, defaulting to open, so users can collapse it when reading the summary
- Add a small row count label above the table (e.g., "12 results") instead of the verbose "Showing 20 of 45 rows" text
- Style suggested follow-up prompts as outlined pill buttons instead of ghost buttons so they're more discoverable
- Add a subtle separator between messages for visual clarity

**3. Improve Table Header Formatting (`src/components/SortableReportTable.tsx`)**
- Capitalize column headers (e.g., "Full Name" instead of "full name")
- Format status values with color-coded badges (overdue = red, due_soon = yellow, compliant = green, not_started = gray)

### Technical Details

Files to modify:
- `supabase/functions/report-chat/index.ts` -- lines 127-136 (AI system prompt)
- `src/components/ReportChatAgent.tsx` -- message rendering section (remove badges, add collapsible table, restyle suggested prompts)
- `src/components/SortableReportTable.tsx` -- capitalize headers, add status badges

The collapsible will use the existing `@radix-ui/react-collapsible` already installed and exported from `src/components/ui/collapsible.tsx`.

