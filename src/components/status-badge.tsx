import { Badge } from "@/components/ui/badge";
import { STATUS_META, type Status } from "@/lib/types";

export function StatusBadge({ status }: { status: Status }) {
  return <Badge variant={status}>{STATUS_META[status].label}</Badge>;
}
