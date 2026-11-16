import type { ReactNode } from "react";
import { Container } from "@mantine/core";

export default function SiteHeader({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <header className="site-header" id={id}>
      <Container size="xl" className="page-container header-content">
        {children}
      </Container>
    </header>
  );
}
