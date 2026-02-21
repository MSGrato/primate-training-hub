

# Fix and Deploy report-chat

## Issue
Line 1 of `supabase/functions/report-chat/index.ts` has a typo: `iimport` instead of `import`, causing a parse error.

## Fix
**File**: `supabase/functions/report-chat/index.ts`, line 1

Change:
```
iimport { createClient } from "https://esm.sh/@supabase/supabase-js@2";
```
to:
```
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
```

## After Fix
Redeploy the `report-chat` edge function.

