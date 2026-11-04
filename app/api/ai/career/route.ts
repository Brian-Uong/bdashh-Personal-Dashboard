import {env} from 'cloudflare:workers';
import {aiRoute} from '../../../../lib/ai-route.mjs';
export const dynamic='force-dynamic';
export const POST=aiRoute(env,'career');
