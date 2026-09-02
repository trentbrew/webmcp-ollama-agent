import type { MenuItem } from '../types';
import McpLogo from '../components/icons/McpLogo.svelte';
import { Settings, HelpCircle, MessageCircle, Activity, Layers, FlaskConical } from '../icons';
import { navigateTo } from '../stores/navigation';

export const MENU_ITEMS: MenuItem[] = [
  { icon: MessageCircle, label: 'Chat', action: () => navigateTo('chat') },
  { icon: McpLogo, label: 'MCP', action: () => navigateTo('mcp') },
  { icon: Activity, label: 'Traces', action: () => navigateTo('traces') },
  { icon: FlaskConical, label: 'Evals', action: () => navigateTo('evals') },
  { icon: Layers, label: 'Facts', action: () => navigateTo('facts') },
  { icon: Settings, label: 'Settings', action: () => navigateTo('settings') },
  { icon: HelpCircle, label: 'Help', action: () => navigateTo('help') },
];