import type { MenuItem } from '../types';
import { Settings, HelpCircle, MessageCircle, Radar, Activity, Layers } from '../icons';
import { navigateTo } from '../stores/navigation';

export const MENU_ITEMS: MenuItem[] = [
  { icon: MessageCircle, label: 'Chat', action: () => navigateTo('chat') },
  { icon: Radar, label: 'MCP', action: () => navigateTo('mcp') },
  { icon: Activity, label: 'Traces', action: () => navigateTo('traces') },
  { icon: Layers, label: 'Facts', action: () => navigateTo('facts') },
  { icon: Settings, label: 'Settings', action: () => navigateTo('settings') },
  { icon: HelpCircle, label: 'Help', action: () => navigateTo('help') },
];