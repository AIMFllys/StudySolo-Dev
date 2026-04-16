import { ChevronDown, History, MoreHorizontal, Plus, Trash2, X } from 'lucide-react';
import type { ConversationRecord, ChatEntry } from '@/stores/chat/use-conversation-store';

interface Props {
  showHistoryDropdown: boolean;
  setShowHistoryDropdown: (v: boolean) => void;
  showMoreMenu: boolean;
  setShowMoreMenu: (v: boolean) => void;
  conversations: ConversationRecord[];
  syncHistory: (messages: ChatEntry[]) => void;
  switchConversation: (id: string) => void;
  deleteConversation: (id: string) => void;
  onNewConversation: () => void;
  onClearAll: () => void;
  historyDropdownRef: React.RefObject<HTMLDivElement>;
  moreMenuRef: React.RefObject<HTMLDivElement>;
}

export function SidebarAIPanelHeader({
  showHistoryDropdown,
  setShowHistoryDropdown,
  showMoreMenu,
  setShowMoreMenu,
  conversations,
  syncHistory,
  switchConversation,
  deleteConversation,
  onNewConversation,
  onClearAll,
  historyDropdownRef,
  moreMenuRef,
}: Props) {
  return (
    <div className="shrink-0 flex items-center justify-between px-3 py-3 border-b border-border/50">
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground font-serif">
          AI 对话
        </span>
      </div>

      <div className="flex items-center gap-1">
        <div className="relative" ref={historyDropdownRef}>
          <button
            type="button"
            onClick={() => setShowHistoryDropdown(!showHistoryDropdown)}
            className="flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-muted-foreground transition-all hover:bg-white/5 hover:text-foreground"
            title="对话记录"
          >
            <History className="h-3 w-3" />
            <ChevronDown className={`h-2.5 w-2.5 transition-transform duration-200 opacity-70 ${showHistoryDropdown ? 'rotate-180' : ''}`} />
          </button>
          {showHistoryDropdown ? (
            <div className="absolute right-0 top-full z-50 mt-1 w-56 rounded-xl border-[1.5px] border-border/50 node-paper-bg p-1.5 shadow-lg animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80 font-serif">
                最近对话
              </div>
              {conversations.length === 0 ? (
                <p className="px-2 py-3 text-center text-xs text-muted-foreground/50">暂无记录</p>
              ) : (
                <div className="max-h-56 overflow-y-auto scrollbar-hide">
                  {[...conversations].reverse().map((conversation) => (
                    <div
                      key={conversation.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => { syncHistory(conversation.messages); switchConversation(conversation.id); setShowHistoryDropdown(false); }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          syncHistory(conversation.messages);
                          switchConversation(conversation.id);
                          setShowHistoryDropdown(false);
                        }
                      }}
                      className="group flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-all hover:bg-white/5 cursor-pointer"
                    >
                      <div className="min-w-0 flex-1">
                        <span className="text-[11px] font-medium text-foreground/90 truncate block">{conversation.title}</span>
                        <span className="text-[10px] text-muted-foreground/50 truncate block">{conversation.preview}</span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); deleteConversation(conversation.id); }}
                        className="opacity-0 group-hover:opacity-60 hover:!opacity-100 text-destructive transition-opacity"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </div>

        <div className="h-3 w-px bg-border/50 mx-0.5" />

        <button
          type="button"
          onClick={onNewConversation}
          className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-all hover:bg-white/5 hover:text-foreground"
          title="新建对话"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>

        <div className="relative" ref={moreMenuRef}>
          <button
            type="button"
            onClick={() => setShowMoreMenu(!showMoreMenu)}
            className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-all hover:bg-white/5 hover:text-foreground"
            title="更多"
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </button>
          {showMoreMenu ? (
            <div className="absolute right-0 top-full z-50 mt-1 w-36 rounded-xl border-[1.5px] border-border/50 node-paper-bg p-1 shadow-lg animate-in fade-in slide-in-from-top-2 duration-200">
              <button
                type="button"
                onClick={onClearAll}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-[11px] text-muted-foreground transition-all hover:bg-white/5 hover:text-destructive"
              >
                <Trash2 className="h-3 w-3" />
                清空对话
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
