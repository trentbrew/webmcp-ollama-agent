import '../src/app.css';
import { mount } from 'svelte';
import type { ChatQuestionnairePart } from '../src/lib/ai/protocol';
import { primeQuestionnaireForE2E } from '../src/lib/chat.svelte';
import QuestionnaireDock from '../src/lib/components/chat/QuestionnaireDock.svelte';

const part: ChatQuestionnairePart = {
  type: 'questionnaire',
  id: 'e2e-questionnaire',
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
    {
      name: 'outboundDate',
      prompt: 'What is the outbound date?',
      required: true,
      input: { label: 'YYYY-MM-DD', placeholder: '2025-10-20', inputType: 'date' },
      validation: { message: 'Departure must be today or later.' },
    },
    {
      name: 'inboundDate',
      prompt: 'What is the inbound/return date?',
      required: true,
      when: { tripType: 'round-trip' },
      input: { label: 'YYYY-MM-DD', placeholder: '2025-10-27', inputType: 'date' },
    },
    {
      name: 'passengers',
      prompt: 'How many passengers are traveling?',
      required: true,
      input: { label: 'Number of Passengers', placeholder: '1', inputType: 'number' },
    },
  ],
};

primeQuestionnaireForE2E(part);

const target = document.getElementById('app');
if (!target) throw new Error('Missing #app');

mount(QuestionnaireDock, { target });
