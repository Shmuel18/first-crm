import { resolveAiMode } from '@/lib/ai/flags';
import { getAiFeatureSettings } from '@/lib/ai/flags.server';
import { userHasPermission } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';

import { AiAssistantBubble } from './ai-assistant-bubble';

/**
 * Server gate for the global assistant bubble: mount it ONLY when the office
 * has NL queries active AND the user may use them (use_ai_queries — the same
 * permission the /api/ai endpoints enforce, so the bubble never appears where
 * its calls would 403). Fails closed: any error reading flags → no bubble.
 */
export async function AiAssistantGate(): Promise<React.ReactElement | null> {
  const supabase = await createClient();
  const [settings, canUse] = await Promise.all([
    getAiFeatureSettings(supabase),
    userHasPermission('use_ai_queries'),
  ]);
  if (!canUse || resolveAiMode(settings, 'nl_queries') === 'off') return null;
  return <AiAssistantBubble />;
}
