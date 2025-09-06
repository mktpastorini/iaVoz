import React from "react";
import { createRoot } from "react-dom/client";
import TestReact from "./components/TestReact";
import "./globals.css";

createRoot(document.getElementById("root")!).render(<TestReact />);