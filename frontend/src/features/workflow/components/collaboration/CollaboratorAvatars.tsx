'use client';

import { useEffect, useState } from 'react';
import { fetchCollaborators, type Collaborator } from '@/services/collaboration.service';

interface Props {
  workflowId: string;
}

export default function CollaboratorAvatars({ workflowId }: Props) {
  const [collabs, setCollabs] = useState<Collaborator[]>([]);

  useEffect(() => {
    let cancelled = false;

    void fetchCollaborators(workflowId)
      .then((data) => {
        if (!cancelled) {
          setCollabs(data.filter((c) => c.status === 'accepted'));
        }
      })
      .catch(() => {
        // Viewer role cannot list collaborators — silently ignore
      });

    return () => {
      cancelled = true;
    };
  }, [workflowId]);

  if (collabs.length === 0) return null;

  const visible = collabs.slice(0, 4);
  const overflow = collabs.length - visible.length;

  return (
    <div className="flex items-center -space-x-1.5">
      {visible.map((c, i) => {
        const initial = (c.nickname || c.email || '?')[0].toUpperCase();
        const hue = ((c.user_id.charCodeAt(0) ?? 0) * 37) % 360;
        return (
          <div
            key={c.id}
            className="relative h-5 w-5 rounded-full border-[1.5px] border-background flex items-center justify-center text-[8px] font-semibold text-white shadow-sm transition-transform hover:scale-110 hover:z-10"
            style={{
              backgroundColor: `hsl(${hue}, 55%, 50%)`,
              zIndex: visible.length - i,
            }}
            title={`${c.nickname || c.email} (${c.role === 'editor' ? '编辑' : '查看'})`}
          >
            {initial}
          </div>
        );
      })}
      {overflow > 0 && (
        <div
          className="relative h-5 w-5 rounded-full border-[1.5px] border-background bg-muted flex items-center justify-center text-[8px] font-medium text-muted-foreground shadow-sm"
          style={{ zIndex: 0 }}
          title={`还有 ${overflow} 位协作者`}
        >
          +{overflow}
        </div>
      )}
    </div>
  );
}
