import React from "react";
import { LockKeyhole, UserRoundCheck } from "lucide-react";

export interface TaskClaimBannerProps {
  claimedBy?: string | null;
  claimedAt?: string | null;
  isClaimedByCurrentUser: boolean;
  className?: string;
  compact?: boolean;
}

function formatClaimTime(value?: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(date);
}

export const TaskClaimBanner: React.FC<TaskClaimBannerProps> = ({
  claimedBy,
  claimedAt,
  isClaimedByCurrentUser,
  className = "",
  compact = false,
}) => {
  if (!claimedBy) return null;
  const claimedTime = formatClaimTime(claimedAt);

  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex min-w-0 items-start gap-2.5 rounded-xl px-3.5 ${compact ? "py-2" : "py-3"} ${
        isClaimedByCurrentUser
          ? "bg-emerald-50/80 text-emerald-950 dark:bg-emerald-950/30 dark:text-emerald-100"
          : "bg-amber-50/85 text-amber-950 dark:bg-amber-950/30 dark:text-amber-100"
      } ${className}`}
    >
      {isClaimedByCurrentUser ? (
        <UserRoundCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-300" />
      ) : (
        <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300" />
      )}
      <div className="min-w-0">
        <p className="text-xs font-bold">
          {isClaimedByCurrentUser ? "You are working on this task" : "Someone else is working on this task"}
        </p>
        <p className="mt-0.5 break-words text-[11px] leading-relaxed opacity-80">
          {isClaimedByCurrentUser
            ? `This task is reserved for you${claimedTime ? ` since ${claimedTime}` : ""}.`
            : `Reserved for ${claimedBy}${claimedTime ? ` since ${claimedTime}` : ""}. You can view the request, but only the claimant can edit or submit this stage.`}
        </p>
      </div>
    </div>
  );
};

export default TaskClaimBanner;
