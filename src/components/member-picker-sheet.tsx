"use client";

interface MemberOption {
  id: string;
  name: string;
  icon: string;
}

export function MemberPickerSheet({
  title,
  members,
  onSelect,
  onClose,
}: {
  title: string;
  members: MemberOption[];
  onSelect: (memberId: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-t-[2rem] bg-surface p-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-border" />
        <h2 className="mb-4 text-center text-lg font-extrabold">{title}</h2>
        <div className="grid grid-cols-2 gap-3">
          {members.map((member) => (
            <button
              key={member.id}
              onClick={() => onSelect(member.id)}
              className="flex flex-col items-center gap-2 rounded-2xl border-2 border-border bg-surface-alt py-6 text-lg font-bold transition active:scale-95 active:border-primary"
            >
              <span className="text-4xl">{member.icon}</span>
              {member.name}
            </button>
          ))}
        </div>
        <button
          onClick={onClose}
          className="mt-4 w-full rounded-2xl py-3 text-center text-sm font-semibold text-text-muted"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
