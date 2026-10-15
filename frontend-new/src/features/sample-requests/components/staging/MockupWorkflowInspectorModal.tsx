import React from "react";
import type { SampleRequestItem } from "../../types";
import { SampleRequestInspector } from "../SampleRequestInspector";

export interface MockupWorkflowInspectorModalProps {
  request: SampleRequestItem | null;
  role: "creative" | "studio";
  readOnly?: boolean;
  actorName?: string;
  actorUserId?: number;
  onClose: () => void;
  onRefresh?: () => Promise<void>;
}

export const MockupWorkflowInspectorModal: React.FC<MockupWorkflowInspectorModalProps> = ({
  request,
  role,
  readOnly = false,
  actorName,
  actorUserId,
  onClose,
  onRefresh,
}) => {
  return (
    <SampleRequestInspector
      request={request}
      isOpen={Boolean(request)}
      onClose={onClose}
      onRefresh={onRefresh}
      role={role}
      readOnly={readOnly}
      actorName={actorName}
      actorUserId={actorUserId}
    />
  );
};

export default MockupWorkflowInspectorModal;
