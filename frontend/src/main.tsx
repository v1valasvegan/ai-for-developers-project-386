import "@mantine/core/styles.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MantineProvider } from "@mantine/core";
import App from "./App";

const root = document.getElementById("root");
if (!root) throw new Error("Не найден корневой элемент приложения");

createRoot(root).render(
  <StrictMode>
    <MantineProvider defaultColorScheme="light">
      <App path={window.location.pathname} />
    </MantineProvider>
  </StrictMode>,
);
