import '../src/app.css';
import { mount } from 'svelte';
import type { ChatQuestionnairePart } from '../src/lib/ai/protocol';
import { primeQuestionnaireForE2E } from '../src/lib/chat.svelte';
import QuestionnaireDock from '../src/lib/components/chat/QuestionnaireDock.svelte';

/** Playlab spawn_prop clarify path — Flow A from TRL-229 design. */
const part: ChatQuestionnairePart = {
  type: 'questionnaire',
  id: 'e2e-spawn-clarify',
  status: 'pending',
  items: [
    {
      name: 'mesh',
      prompt: 'Choose a mesh',
      description: 'Before spawn_prop',
      required: true,
      default: 'primitive:box',
      choices: [
        { value: 'primitive:box', label: 'Box', shortcut: 'A' },
        { value: 'primitive:sphere', label: 'Sphere', shortcut: 'B' },
      ],
    },
    {
      name: 'position',
      prompt: 'World position [x, y, z]',
      required: true,
      default: '[0, 1, 0]',
      input: { label: 'Position', placeholder: '[0, 1, 0]', inputType: 'text' },
    },
    {
      name: 'color',
      prompt: 'Hex tint',
      required: true,
      default: '#ff0000',
      input: { label: 'Color', placeholder: '#ff0000', inputType: 'text' },
    },
  ],
};

primeQuestionnaireForE2E(part);

const target = document.getElementById('app');
if (!target) throw new Error('Missing #app');

mount(QuestionnaireDock, { target });
