import { describe, expect, it } from 'vitest';

import {
  abortAIChatStream as oldAbortAIChatStream,
  useAIChatStore as oldAIChatStore,
} from '@/stores/use-ai-chat-store';
import {
  useConversationStore as oldConversationStore,
} from '@/stores/use-conversation-store';
import {
  useWorkflowStore as oldWorkflowStore,
} from '@/stores/use-workflow-store';
import {
  IMMOVABLE_PANELS as oldImmovablePanels,
  LEFT_PANEL_MAX as oldLeftPanelMax,
  LEFT_PANEL_MIN as oldLeftPanelMin,
  PINNABLE_PANELS as oldPinnablePanels,
  RIGHT_PANEL_MAX as oldRightPanelMax,
  RIGHT_PANEL_MIN as oldRightPanelMin,
  usePanelStore as oldPanelStore,
} from '@/stores/use-panel-store';
import { useSettingsStore as oldSettingsStore } from '@/stores/use-settings-store';
import { useAdminStore as oldAdminStore } from '@/stores/use-admin-store';

import {
  abortAIChatStream as newAbortAIChatStream,
  useAIChatStore as newAIChatStore,
} from '@/stores/chat/use-ai-chat-store';
import { useConversationStore as newConversationStore } from '@/stores/chat/use-conversation-store';
import { useWorkflowStore as newWorkflowStore } from '@/stores/workflow/use-workflow-store';
import {
  IMMOVABLE_PANELS as newImmovablePanels,
  LEFT_PANEL_MAX as newLeftPanelMax,
  LEFT_PANEL_MIN as newLeftPanelMin,
  PINNABLE_PANELS as newPinnablePanels,
  RIGHT_PANEL_MAX as newRightPanelMax,
  RIGHT_PANEL_MIN as newRightPanelMin,
  usePanelStore as newPanelStore,
} from '@/stores/ui/use-panel-store';
import { useSettingsStore as newSettingsStore } from '@/stores/ui/use-settings-store';
import { useAdminStore as newAdminStore } from '@/stores/admin/use-admin-store';

import {
  useAIChatStore as barrelAIChatStore,
  useConversationStore as barrelConversationStore,
  useWorkflowStore as barrelWorkflowStore,
  usePanelStore as barrelPanelStore,
  useSettingsStore as barrelSettingsStore,
  useAdminStore as barrelAdminStore,
} from '@/stores';

describe('store path compatibility', () => {
  it('keeps ai chat store exports compatible across old and new paths', () => {
    expect(oldAIChatStore).toBe(newAIChatStore);
    expect(oldAIChatStore).toBe(barrelAIChatStore);
    expect(oldAbortAIChatStream).toBe(newAbortAIChatStream);
  });

  it('keeps conversation and workflow stores compatible across old and new paths', () => {
    expect(oldConversationStore).toBe(newConversationStore);
    expect(oldConversationStore).toBe(barrelConversationStore);
    expect(oldWorkflowStore).toBe(newWorkflowStore);
    expect(oldWorkflowStore).toBe(barrelWorkflowStore);
  });

  it('keeps ui and admin store exports compatible across old and new paths', () => {
    expect(oldPanelStore).toBe(newPanelStore);
    expect(oldPanelStore).toBe(barrelPanelStore);
    expect(oldSettingsStore).toBe(newSettingsStore);
    expect(oldSettingsStore).toBe(barrelSettingsStore);
    expect(oldAdminStore).toBe(newAdminStore);
    expect(oldAdminStore).toBe(barrelAdminStore);
  });

  it('keeps panel constants compatible across old and new paths', () => {
    expect(oldImmovablePanels).toBe(newImmovablePanels);
    expect(oldPinnablePanels).toBe(newPinnablePanels);
    expect(oldLeftPanelMin).toBe(newLeftPanelMin);
    expect(oldLeftPanelMax).toBe(newLeftPanelMax);
    expect(oldRightPanelMin).toBe(newRightPanelMin);
    expect(oldRightPanelMax).toBe(newRightPanelMax);
  });
});
