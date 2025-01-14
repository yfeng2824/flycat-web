import { DbEvent } from 'core/db/schema';
import { Filter } from 'core/nostr/type';
import { Event } from 'core/nostr/Event';
import { createHash } from 'crypto';

export const scrollPositionCache = new Map<string, number>();
export const queryCache = new Map<string, DbEvent[]>();

export function createQueryCacheId(deps: {
  msgId?: string;
  msgFilter?: Filter;
  isValidEvent?: (event: Event) => boolean;
  relayUrls?: string[];
}): string {
  const msgFilterStr = JSON.stringify(deps.msgFilter);
  const isValidEventStr = deps.isValidEvent?.toString() || '';
  const relayUrlsStr = JSON.stringify(deps.relayUrls); // todo: order doesn't matter

  const combinedString = `${deps.msgId}-${msgFilterStr}-${isValidEventStr}-${relayUrlsStr}`;
  const hash = createHash('sha256');
  hash.update(combinedString);
  const uniqueId = hash.digest('hex');

  return uniqueId;
}
