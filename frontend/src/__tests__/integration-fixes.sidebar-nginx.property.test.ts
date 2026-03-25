import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import * as fs from 'fs';
import * as path from 'path';

interface WorkflowMeta {
  id: string;
  name: string;
  updated_at: string;
  isRunning?: boolean;
}

interface NavItem {
  href: string;
  name: string;
  workflowId: string;
}

function workflowsToNavItems(workflows: WorkflowMeta[]): NavItem[] {
  return workflows.map((workflow) => ({
    href: `/c/${workflow.id}`,
    name: workflow.name,
    workflowId: workflow.id,
  }));
}

const workflowMetaArb: fc.Arbitrary<WorkflowMeta> = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 50 }).filter((value) => value.trim().length > 0),
  updated_at: fc
    .integer({ min: new Date('2024-01-01').getTime(), max: new Date('2025-12-31').getTime() })
    .map((timestamp) => new Date(timestamp).toISOString()),
  isRunning: fc.option(fc.boolean(), { nil: undefined }),
});

const workflowListArb = fc.array(workflowMetaArb, { minLength: 0, maxLength: 20 }).map((list) => {
  const ids = new Set<string>();
  return list.filter((item) => {
    if (ids.has(item.id)) {
      return false;
    }
    ids.add(item.id);
    return true;
  });
});

describe('integration-fixes: sidebar nav mapping', () => {
  it('maps workflow list length to nav items length', () => {
    fc.assert(
      fc.property(workflowListArb, (workflows) => {
        const navItems = workflowsToNavItems(workflows);
        expect(navItems).toHaveLength(workflows.length);
      }),
      { numRuns: 100 }
    );
  });

  it('keeps name/id/link aligned with source workflow', () => {
    fc.assert(
      fc.property(workflowListArb, (workflows) => {
        const navItems = workflowsToNavItems(workflows);
        navItems.forEach((item, index) => {
          expect(item.name).toBe(workflows[index].name);
          expect(item.workflowId).toBe(workflows[index].id);
          expect(item.href).toBe(`/c/${workflows[index].id}`);
        });
      }),
      { numRuns: 100 }
    );
  });
});

describe('integration-fixes: nginx domain consistency', () => {
  const nginxConfPath = path.resolve(__dirname, '../../../scripts/nginx.conf');
  const nginxContent = fs.readFileSync(nginxConfPath, 'utf-8');

  it('does not contain placeholder domain', () => {
    expect(nginxContent).not.toContain('your-domain.com');
  });

  it('server_name and certificate directives use production domain', () => {
    const lines = nginxContent.split('\n').map((line) => line.trim());

    const serverNameLines = lines.filter((line) => line.startsWith('server_name'));
    const certLines = lines.filter(
      (line) => line.startsWith('ssl_certificate') && !line.startsWith('ssl_certificate_key')
    );
    const keyLines = lines.filter((line) => line.startsWith('ssl_certificate_key'));

    [serverNameLines, certLines, keyLines].forEach((group) => {
      expect(group.length).toBeGreaterThan(0);
      group.forEach((line) => {
        expect(line).toContain('studyflow.1037solo.com');
      });
    });
  });
});
