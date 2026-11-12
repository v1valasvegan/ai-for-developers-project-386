import type { ReactNode } from "react";
import { ScrollArea } from "@mantine/core";

export default function ScrollRegion({
  label,
  children,
  maxHeight = "min(56svh, 32rem)",
}: {
  label: string;
  children: ReactNode;
  maxHeight?: string;
}) {
  return (
    <ScrollArea.Autosize
      className="scroll-region"
      mah={maxHeight}
      type="auto"
      offsetScrollbars="y"
      scrollbarSize={8}
      viewportProps={{ role: "region", "aria-label": label, tabIndex: 0 }}
    >
      {children}
    </ScrollArea.Autosize>
  );
}
