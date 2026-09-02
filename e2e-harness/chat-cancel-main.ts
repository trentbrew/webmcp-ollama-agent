import '../src/app.css';
import { mount } from 'svelte';
import type { ChatQuestionnairePart } from '../src/lib/ai/protocol';
import {
  primeQuestionnaireForE2E,
  primeStreamingChatForE2E,
} from '../src/lib/chat.svelte';
import ChatComposer from '../src/lib/components/chat/ChatComposer.svelte';
import QuestionnaireDock from '../src/lib/components/chat/QuestionnaireDock.svelte';

const params = new URLSearchParams(window.location.search);
const mode = params.get('mode') ?? 'streaming';

if (mode === 'questionnaire') {
  const part: ChatQuestionnairePart = {
    type: 'questionnaire',
    id: 'e2e-cancel-questionnaire',
    status: 'pending',
    items: [
      {
        name: 'tripType',
        prompt: 'What type of trip is this?',
        required: true,
        choices: [
          { value: 'one-way', label: 'One-way', shortcut: '1' },
          { value: 'round-trip', label: 'Round-trip', shortcut: '2' },
        ],
      },
    ],
  };
  primeQuestionnaireForE2E(part);
} else {
  primeStreamingChatForE2E();
}

const target = document.getElementById('app');
if (!target) throw new Error('Missing #app');

const dockHost = document.createElement('div');
dockHost.className = 'flex-1 min-h-0 overflow-auto p-4';
target.appendChild(dockHost);
mount(QuestionnaireDock, { target: dockHost });

const composerHost = document.createElement('div');
composerHost.className = 'flex-shrink-0';
target.appendChild(composerHost);
mount(ChatComposer, { target: composerHost });
