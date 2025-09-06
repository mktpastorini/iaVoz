import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./globals.css";

checkReactVersions();

createRoot(document.getElementById("root")!).render(<App />);

import { checkReactVersions } from "./utils/checkReactVersions";