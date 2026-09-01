import { parseSimple, type Atom, type EntityRecord, type KernelOp } from 'trellis/browser-core';
import type { OllamaTool } from '../ai/protocol';
import { getTrellisKernel, trellisState } from './kernel.svelte';

type ToolResult = { ok: boolean; result?: unknown; error?: string };

export const TRELLIS_TOOL_NAMES = {
  status: 'trellis_status',
  createEntity: 'trellis_create_entity',
  readEntity: 'trellis_read_entity',
  updateEntity: 'trellis_update_entity',
  deleteEntity: 'trellis_delete_entity',
  listEntities: 'trellis_list_entities',
  addLink: 'trellis_add_link',
  removeLink: 'trellis_remove_link',
  query: 'trellis_query',
  readOps: 'trellis_read_ops',
} as const;

const TRELLIS_TOOL_NAME_SET = new Set<string>(Object.values(TRELLIS_TOOL_NAMES));

export function isTrellisTool(name: string): boolean {
  return TRELLIS_TOOL_NAME_SET.has(name);
}

export const TRELLIS_TOOLS: OllamaTool[] = [
  {
    type: 'function',
    function: {
      name: TRELLIS_TOOL_NAMES.status,
      description: "Read the embedded Trellis graph kernel's status, op count, replay count, and entity count.",
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: TRELLIS_TOOL_NAMES.createEntity,
      description: 'Create an entity in the embedded Trellis graph. Attribute values must be strings, numbers, booleans, or null.',
      parameters: {
        type: 'object',
        required: ['type', 'attributes'],
        properties: {
          id: { type: 'string', description: 'Optional caller-provided entity id. Defaults to a random UUID.' },
          type: { type: 'string', description: 'Entity type, for example "Task", "Note", or "webmcp.pageObservation".' },
          attributes: {
            type: 'object',
            description: 'Primitive attributes to store as EAV facts.',
            additionalProperties: { type: ['string', 'number', 'boolean', 'null'] },
          },
          links: {
            type: 'array',
            description: 'Optional outbound graph links from the new entity.',
            items: {
              type: 'object',
              required: ['attribute', 'targetEntityId'],
              properties: {
                attribute: { type: 'string' },
                targetEntityId: { type: 'string' },
              },
            },
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: TRELLIS_TOOL_NAMES.readEntity,
      description: 'Read a single embedded Trellis entity by id.',
      parameters: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: TRELLIS_TOOL_NAMES.updateEntity,
      description: 'Update primitive attributes on an embedded Trellis entity.',
      parameters: {
        type: 'object',
        required: ['id', 'attributes'],
        properties: {
          id: { type: 'string' },
          attributes: {
            type: 'object',
            additionalProperties: { type: ['string', 'number', 'boolean', 'null'] },
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: TRELLIS_TOOL_NAMES.deleteEntity,
      description: 'Delete an embedded Trellis entity and its facts/links.',
      parameters: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: TRELLIS_TOOL_NAMES.listEntities,
      description: 'List embedded Trellis entities by optional type and exact primitive attribute filters.',
      parameters: {
        type: 'object',
        properties: {
          type: { type: 'string' },
          filters: {
            type: 'object',
            additionalProperties: { type: ['string', 'number', 'boolean', 'null'] },
          },
          limit: { type: 'number', description: 'Maximum entities to return. Defaults to 20, capped at 100.' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: TRELLIS_TOOL_NAMES.addLink,
      description: 'Add a link between two embedded Trellis entities.',
      parameters: {
        type: 'object',
        required: ['sourceId', 'attribute', 'targetId'],
        properties: {
          sourceId: { type: 'string' },
          attribute: { type: 'string' },
          targetId: { type: 'string' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: TRELLIS_TOOL_NAMES.removeLink,
      description: 'Remove a link between two embedded Trellis entities.',
      parameters: {
        type: 'object',
        required: ['sourceId', 'attribute', 'targetId'],
        properties: {
          sourceId: { type: 'string' },
          attribute: { type: 'string' },
          targetId: { type: 'string' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: TRELLIS_TOOL_NAMES.query,
      description:
        'Run an EQL-S query against the embedded Trellis graph. Supports full SELECT/WHERE syntax or shorthand like: find ?e where type = "Task".',
      parameters: {
        type: 'object',
        required: ['query'],
        properties: {
          query: { type: 'string' },
          limit: { type: 'number', description: 'Maximum bindings to return when the query has no LIMIT. Defaults to 50, capped at 200.' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: TRELLIS_TOOL_NAMES.readOps,
      description: 'Read recent embedded Trellis kernel ops, newest first.',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Maximum ops to return. Defaults to 20, capped at 100.' },
        },
      },
    },
  },
];

export async function runTrellisTool(name: string, args: unknown): Promise<ToolResult> {
  try {
    const input = asRecord(args);
    const kernel = await getTrellisKernel();

    switch (name) {
      case TRELLIS_TOOL_NAMES.status: {
        return {
          ok: true,
          result: {
            status: trellisState.status,
            opsReplayed: trellisState.opsReplayed,
            opCount: kernel.getBackend().getOpCount(),
            entityCount: kernel.listEntities().length,
            agentId: kernel.getAgentId(),
          },
        };
      }

      case TRELLIS_TOOL_NAMES.createEntity: {
        const type = requireString(input.type, 'type');
        const id = typeof input.id === 'string' && input.id.trim() ? input.id.trim() : crypto.randomUUID();
        const attributes = normalizeAttributes(input.attributes, 'attributes');
        const links = normalizeLinks(input.links);
        const result = await kernel.createEntity(id, type, attributes, links.length ? links : undefined);
        trellisState.opCount = kernel.getBackend().getOpCount();
        return {
          ok: true,
          result: {
            id,
            type,
            factsAdded: result.factsDelta.added,
            linksAdded: result.linksDelta.added,
            opHash: result.op.hash,
          },
        };
      }

      case TRELLIS_TOOL_NAMES.readEntity: {
        const id = requireString(input.id, 'id');
        return { ok: true, result: serializeEntity(kernel.getEntity(id)) };
      }

      case TRELLIS_TOOL_NAMES.updateEntity: {
        const id = requireString(input.id, 'id');
        const attributes = normalizeAttributes(input.attributes, 'attributes');
        const result = await kernel.updateEntity(id, attributes);
        trellisState.opCount = kernel.getBackend().getOpCount();
        return {
          ok: true,
          result: {
            id,
            factsAdded: result.factsDelta.added,
            factsDeleted: result.factsDelta.deleted,
            opHash: result.op.hash,
          },
        };
      }

      case TRELLIS_TOOL_NAMES.deleteEntity: {
        const id = requireString(input.id, 'id');
        const result = await kernel.deleteEntity(id);
        trellisState.opCount = kernel.getBackend().getOpCount();
        return {
          ok: true,
          result: {
            id,
            factsDeleted: result.factsDelta.deleted,
            linksDeleted: result.linksDelta.deleted,
            opHash: result.op.hash,
          },
        };
      }

      case TRELLIS_TOOL_NAMES.listEntities: {
        const type = typeof input.type === 'string' && input.type.trim() ? input.type.trim() : undefined;
        const filters = input.filters === undefined ? undefined : normalizeAttributes(input.filters, 'filters');
        const limit = clampLimit(input.limit, 20, 100);
        const entities = kernel.listEntities(type, filters).slice(0, limit).map(serializeEntity);
        return { ok: true, result: { entities, count: entities.length, limit } };
      }

      case TRELLIS_TOOL_NAMES.addLink: {
        const sourceId = requireString(input.sourceId, 'sourceId');
        const attribute = requireString(input.attribute, 'attribute');
        const targetId = requireString(input.targetId, 'targetId');
        const result = await kernel.addLink(sourceId, attribute, targetId);
        trellisState.opCount = kernel.getBackend().getOpCount();
        return { ok: true, result: { sourceId, attribute, targetId, opHash: result.op.hash } };
      }

      case TRELLIS_TOOL_NAMES.removeLink: {
        const sourceId = requireString(input.sourceId, 'sourceId');
        const attribute = requireString(input.attribute, 'attribute');
        const targetId = requireString(input.targetId, 'targetId');
        const result = await kernel.removeLink(sourceId, attribute, targetId);
        trellisState.opCount = kernel.getBackend().getOpCount();
        return { ok: true, result: { sourceId, attribute, targetId, opHash: result.op.hash } };
      }

      case TRELLIS_TOOL_NAMES.query: {
        const source = requireString(input.query, 'query');
        const query = parseSimple(source);
        if (query.limit === 0) query.limit = clampLimit(input.limit, 50, 200);
        const result = await kernel.query(query);
        return {
          ok: true,
          result: {
            bindings: result.bindings,
            count: result.count,
            executionTime: result.executionTime,
            limit: query.limit,
          },
        };
      }

      case TRELLIS_TOOL_NAMES.readOps: {
        const limit = clampLimit(input.limit, 20, 100);
        const ops = kernel.readAllOps().slice(-limit).reverse().map(serializeOp);
        return { ok: true, result: { ops, count: ops.length, limit } };
      }

      default:
        return { ok: false, error: `Unhandled Trellis tool "${name}".` };
    }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function requireString(value: unknown, name: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${name} must be a non-empty string.`);
  }
  return value.trim();
}

function normalizeAttributes(value: unknown, name: string): Record<string, Atom> {
  const source = asRecord(value);
  const normalized: Record<string, Atom> = {};

  for (const [key, raw] of Object.entries(source)) {
    if (!key.trim()) continue;
    if (raw === null || raw === undefined) continue;
    if (typeof raw === 'string' || typeof raw === 'number' || typeof raw === 'boolean') {
      normalized[key] = raw;
      continue;
    }
    throw new Error(`${name}.${key} must be a string, number, boolean, or null.`);
  }

  return normalized;
}

function normalizeLinks(value: unknown): Array<{ attribute: string; targetEntityId: string }> {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error('links must be an array.');

  return value.map((entry, index) => {
    const link = asRecord(entry);
    return {
      attribute: requireString(link.attribute, `links[${index}].attribute`),
      targetEntityId: requireString(link.targetEntityId, `links[${index}].targetEntityId`),
    };
  });
}

function clampLimit(value: unknown, defaultLimit: number, maxLimit: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return defaultLimit;
  return Math.max(1, Math.min(maxLimit, Math.floor(value)));
}

function serializeEntity(entity: EntityRecord | null): unknown {
  if (!entity) return null;
  return {
    id: entity.id,
    type: entity.type,
    attributes: Object.fromEntries(entity.facts.filter((fact) => fact.a !== 'type').map((fact) => [fact.a, fact.v])),
    facts: entity.facts,
    links: entity.links,
  };
}

function serializeOp(op: KernelOp): unknown {
  return {
    hash: op.hash,
    kind: op.kind,
    timestamp: op.timestamp,
    agentId: op.agentId,
    previousHash: op.previousHash,
    facts: op.facts,
    links: op.links,
    deleteFacts: op.deleteFacts,
    deleteLinks: op.deleteLinks,
  };
}
